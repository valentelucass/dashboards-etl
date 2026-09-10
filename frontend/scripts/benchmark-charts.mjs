// Synthetic browser benchmark. All API requests are intercepted; external DNS is disabled.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';
import { chartCounts, pageFixture, chartApiPaths } from './benchmark-page-fixtures.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [beforeDir = '.tmp/quality-perf-before', afterDir = '.tmp/quality-perf-after', outputDir = '.tmp/chart-benchmark', route = 'coletas', repetitions = '3', check = 'timing'] = process.argv.slice(2);
const smoke = check === 'smoke';
if (!(route in chartCounts) || !/^[1-9]\d?$/.test(repetitions)) throw new Error('Use uma rota suportada e 1-99 repetições.');
const expectedCharts = chartCounts[route];
const out = resolve(frontend, outputDir);
await mkdir(out, { recursive: true });
const builds = { before: resolve(frontend, beforeDir), after: resolve(frontend, afterDir) };
for (const root of Object.values(builds)) await stat(resolve(root, 'index.html'));
let activeRoot = builds.before;
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const path = resolve(activeRoot, `.${pathname}`);
    if (!path.startsWith(activeRoot + sep) || pathname.startsWith('/api/')) {
      res.writeHead(403).end(); return;
    }
    const target = extname(path) ? path : resolve(activeRoot, 'index.html');
    const body = await readFile(target);
    const compressed = gzipSync(body);
    res.writeHead(200, { 'Content-Type': mime[extname(target)] ?? 'application/octet-stream',
      'Content-Encoding': 'gzip', 'Content-Length': compressed.length, 'Cache-Control': 'no-store' });
    res.end(compressed);
  } catch { res.writeHead(404).end(); }
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
const profile = resolve(out, `browser-${Date.now()}`);
await mkdir(profile);
const executable = process.env.QUALITY_BROWSER_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const browser = spawn(executable, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-component-update', '--disable-extensions', '--disable-sync',
  '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let launchError;
browser.on('error', (error) => { launchError = error; });
let socket;
let nextId = 0;
const pending = new Map();
const errors = [];
let apiRequests = [];
let currentOrigin = origin;
let externalBlocked = 0;
let activePerformance = 0;
let peakPerformance = 0;

function send(method, params = {}) {
  return new Promise((resolveCommand, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20_000);
    pending.set(id, { resolve: (value) => { clearTimeout(timeout); resolveCommand(value); }, reject: (error) => { clearTimeout(timeout); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}

const series = Array.from({ length: 30 }, (_, day) => ({ date: `2026-08-${String(day + 1).padStart(2, '0')}`,
  total: 50 + day, finalizadas: 40 + day, canceladas: 3, emTratativa: 7,
  performancePercentual: 85 + day % 10, metaPercentual: 95, noPrazo: 35 + day, foraDoPrazo: 5 }));
function fixture(path) {
  const pageData = pageFixture(path);
  if (pageData !== undefined) return pageData;
  if (path === '/api/auth/refresh' || path === '/api/auth/me') {
    const usuario = { id: 'synthetic', nome: 'Teste sintético', email: 'synthetic@example.test', papel: 'usuario_comum',
      setor: { id: 'teste', nome: 'Teste' }, permissoesEfetivas: { coletas: true, performance: true, faturamento: true, fretes: true, manifestos: true, executivo: true, dimensoes: true },
      filiaisPermitidasEfetivas: ['CWB'], exigeTrocaSenha: false };
    if (path.endsWith('/me')) return usuario;
    return { usuario, exigeTrocaSenha: false, sessaoExpiraEm: new Date(Date.now() + 3_600_000).toISOString(),
      token: `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.synthetic` };
  }
  if (path === '/api/dimensoes/filiais') return ['CWB'];
  if (path === '/api/dimensoes/clientes') return ['Cliente sintético'];
  if (path === '/api/dimensoes/pagadores') return [];
  if (path === '/api/dimensoes/usuarios') return [{ userId: '1', nome: 'Operador sintético' }];
  if (path === '/api/dimensoes/performance/responsaveis') return [{ value: 'CWB', label: 'CWB' }];
  if (path === '/api/dimensoes/performance/regioes-destino') return ['Sul'];
  if (path === '/api/dimensoes/performance/cidades-destino') return ['Curitiba'];
  if (path === '/api/painel/performance/overview') return { updatedAt: '2026-09-10T00:00:00Z', totalEntregas: 1500,
    finalizadas: 1400, noPrazo: 1300, foraDoPrazo: 100, performancePercentual: 92.85, emAtraso: 50,
    pesoTaxadoToneladas: 23, comprovanteAnexadoPercentual: 95, valorNfSemComprovante: 1000 };
  if (path === '/api/painel/performance/serie-temporal') return series.map((point) => ({ ...point, emTransito: 3, pendentes: 4 }));
  if (path === '/api/painel/performance/historico') return series.slice(0, 3).map((point, index) => ({ ...point, date: `2026-0${index + 6}-01` }));
  if (path === '/api/painel/performance/status') return [{ status: 'Finalizada', total: 1400 }, { status: 'Pendente', total: 100 }];
  if (path === '/api/painel/performance/drilldown') return [{ nome: 'CWB', filtro: 'CWB', nivel: 'responsavel', noPrazo: 1300, foraDoPrazo: 100, emAtraso: 50, total: 1450 }];
  if (path === '/api/painel/performance/aging') return ['0-2 dias', '3-5 dias', '6-10 dias', '11+ dias'].map((bucket, index) => ({ bucket, total: 40 - index * 10 }));
  if (path === '/api/painel/coletas') return { updatedAt: '2026-09-10T00:00:00Z', totalColetas: 1500, finalizadas: 1400,
    taxaSucesso: 93.3, taxaCancelamento: 2, slaNoAgendamento: 95, leadTimeMedioDias: 1.5, tentativasMedias: 1.1,
    pesoTaxadoTotal: 23000, valorNfTotal: 120000 };
  if (path.endsWith('/serie') || path.endsWith('/historico-performance')) return series;
  if (path === '/api/painel/coletas/graficos') return {
    statusDistribuicao: [{ status: 'Finalizada', total: 1400 }, { status: 'Pendente', total: 100 }], historicoPerformance: [],
    regioesOrigem: [{ regiaoLogistica: 'Sul', totalColetas: 1000, pesoTaxado: 17000 }, { regiaoLogistica: 'Sudeste', totalColetas: 500, pesoTaxado: 6000 }],
    agingAbertas: ['0-2 dias', '3-5 dias', '6-10 dias', '11+ dias'].map((faixa, index) => ({ faixa, total: 40 - index * 10 })),
  };
  if (path.endsWith('/tabela/paginada')) return { conteudo: [], totalElementos: 0, totalPaginas: 0, paginaAtual: 0, tamanhoPagina: 10 };
  if (path.includes('apresentac')) return [];
  return undefined;
}

async function intercept(event) {
  const url = new URL(event.request.url);
  const apiIndex = url.pathname.indexOf('/api/');
  if (apiIndex >= 0) {
    const path = url.pathname.slice(apiIndex);
    const request = { path, query: url.search, method: event.request.method, receivedAt: Date.now() };
    apiRequests.push(request);
    const counted = event.request.method === 'GET' && /^\/api\/(painel|dimensoes)\/(performance|fretes|faturamento|manifestos|executivo)(?:\/|$)/.test(path);
    if (counted) { activePerformance++; peakPerformance = Math.max(peakPerformance, activePerformance); }
    const body = fixture(path);
    if (body === undefined) errors.push(`Missing fixture: ${path}`);
    await sleep(200);
    const overviewFailure = smoke && event.request.method === 'GET' &&
      (path === '/api/painel/performance/overview' || path === '/api/painel/fretes' || path === '/api/painel/executivo');
    request.responseCode = body === undefined ? 404 : overviewFailure ? 503 : 200;
    await send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: request.responseCode,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: currentOrigin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
        { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Dashboard-Route' }],
      body: Buffer.from(JSON.stringify(body ?? {})).toString('base64') });
    request.completedAt = Date.now();
    if (counted) activePerformance--;
  } else if (url.origin === origin) {
    await send('Fetch.continueRequest', { requestId: event.requestId });
  } else {
    externalBlocked++;
    await send('Fetch.failRequest', { requestId: event.requestId, errorReason: 'BlockedByClient' });
  }
}

try {
  let debugPort;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    try { debugPort = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; }
    catch { await sleep(100); }
  }
  if (!debugPort) throw new Error('Browser did not expose an isolated debugging port');
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', (message) => {
    const event = JSON.parse(message.data);
    if (event.id) {
      const command = pending.get(event.id);
      pending.delete(event.id);
      if (event.error) command?.reject(new Error(event.error.message)); else command?.resolve(event.result);
    } else if (event.method === 'Fetch.requestPaused') void intercept(event.params).catch((error) => errors.push(error.message));
    else if (event.method === 'Runtime.exceptionThrown') errors.push(event.params.exceptionDetails.exception?.description ?? event.params.exceptionDetails.text);
    else if (event.method === 'Network.loadingFailed' && event.params.corsErrorStatus) errors.push(JSON.stringify(event.params.corsErrorStatus));
    else if (event.method === 'Runtime.consoleAPICalled' && event.params.type === 'error') errors.push(event.params.args.map((arg) => arg.value ?? arg.description).join(' '));
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    localStorage.setItem('dashboard_refresh_ativo', '1');
    window.__chartMetrics = { firstDraw: 0, lastDraw: 0, longTasks: [], charts: {} };
    const chartElements = new WeakMap();
    let chartId = 0;
    new PerformanceObserver(list => window.__chartMetrics.longTasks.push(...list.getEntries().map(x => ({ startTime: x.startTime, duration: x.duration })))).observe({type:'longtask', buffered:true});
    for (const method of ['fill', 'stroke', 'fillText', 'fillRect']) {
      const original = CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method] = function(...args) {
        const element = this.canvas.closest('.echarts-for-react');
        if (this.canvas.isConnected && element) {
          let key = chartElements.get(element);
          if (!key) {
            let card = element.parentElement;
            while (card && !card.querySelector('h3')) card = card.parentElement;
            key = card?.querySelector('h3')?.textContent || 'chart-' + (++chartId);
            chartElements.set(element, key);
            window.__chartMetrics.charts[key] = { firstDraw: performance.now(), lastDraw: 0,
              mounts: (window.__chartMetrics.charts[key]?.mounts ?? 0) + 1 };
          }
          window.__chartMetrics.charts[key].lastDraw = performance.now();
          window.__chartMetrics.firstDraw ||= performance.now(); window.__chartMetrics.lastDraw = performance.now();
        }
        return original.apply(this, args);
      };
    }
  ` });
  const results = [];
  const modes = [{ name: 'desktop', cpu: 1, bytesPerSecond: -1 }, { name: 'cpu4x-2Mbps', cpu: 4, bytesPerSecond: 250_000 }];
  for (const mode of smoke ? modes.slice(0, 1) : modes) {
    await send('Emulation.setCPUThrottlingRate', { rate: mode.cpu });
    await send('Network.emulateNetworkConditions', { offline: false, latency: mode.cpu === 1 ? 0 : 40,
      downloadThroughput: mode.bytesPerSecond, uploadThroughput: mode.bytesPerSecond });
    for (let repetition = 1; repetition <= Number(repetitions); repetition++) {
      for (const version of smoke ? ['after'] : repetition % 2 ? ['before', 'after'] : ['after', 'before']) {
        activeRoot = builds[version]; apiRequests = []; errors.length = 0; externalBlocked = 0; activePerformance = 0; peakPerformance = 0;
        await send('Page.navigate', { url: `${origin}/${route}?dataInicio=2026-08-01&dataFim=2026-08-30&qualityRun=${mode.name}-${version}-${repetition}` });
        let metrics;
        for (let attempt = 0; attempt < 250; attempt++) {
          await sleep(100);
          const evaluation = await send('Runtime.evaluate', { expression: `JSON.stringify({ ...window.__chartMetrics, timeOrigin: performance.timeOrigin, now: performance.now(), canvases: document.querySelectorAll('.echarts-for-react canvas').length })`, returnByValue: true });
          metrics = JSON.parse(evaluation.result.value ?? '{}');
          if (metrics.canvases === expectedCharts && Object.keys(metrics.charts ?? {}).length === expectedCharts && metrics.firstDraw > 0 && metrics.now - metrics.lastDraw > 400) break;
        }
        if (metrics.canvases !== expectedCharts || Object.keys(metrics.charts ?? {}).length !== expectedCharts || !metrics.firstDraw || errors.length) {
          const diagnostic = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,1500)', returnByValue: true });
          throw new Error(JSON.stringify({ metrics, errors, apiRequests, page: diagnostic.result.value }));
        }
        const resourceResult = await send('Runtime.evaluate', { expression: `JSON.stringify(performance.getEntriesByType('resource').filter(x => x.name.endsWith('.js')).map(x => ({bytes:x.encodedBodySize,duration:x.duration})))`, returnByValue: true });
        const resources = JSON.parse(resourceResult.result.value);
        for (const [title, chart] of Object.entries(metrics.charts)) {
          const paths = chartApiPaths(route, title);
          const sources = apiRequests.filter(request => request.method === 'GET' && paths.includes(request.path)
            && new URLSearchParams(request.query).get('limite') !== '50');
          if (sources.length && sources.every(request => request.completedAt)) {
            chart.dataReadyAt = Math.max(...sources.map(request => request.completedAt)) - metrics.timeOrigin;
            chart.finalDrawAfterDataMs = chart.lastDraw - chart.dataReadyAt;
          }
        }
        results.push({ mode: mode.name, version, repetition, ...metrics, apiCalls: apiRequests.length, externalBlocked, peakPerformance, apiRequests,
          javascriptBytes: resources.reduce((sum, item) => sum + item.bytes, 0),
          longTaskTotalMs: metrics.longTasks.reduce((sum, item) => sum + item.duration, 0) });
        console.log(JSON.stringify(results.at(-1)));
        if (repetition === 1) {
          const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
          await writeFile(resolve(out, `${mode.name}-${version}.png`), Buffer.from(screenshot.data, 'base64'));
        }
      }
    }
  }
  if (smoke) {
    const layouts = [];
    for (const width of [1024, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await sleep(700);
      const result = await send('Runtime.evaluate', { expression: `JSON.stringify({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, charts: [...document.querySelectorAll('.echarts-for-react')].map(x => ({ width: x.clientWidth, height: x.clientHeight, canvas: !!x.querySelector('canvas') })) })`, returnByValue: true });
      const layout = JSON.parse(result.result.value);
      const minimumCanvasHeight = route === 'manifestos' ? 300 : 350;
      if (layout.scrollWidth > layout.width + 2 || layout.charts.length !== expectedCharts || layout.charts.some(x => !x.canvas || x.width <= 0 || x.height < minimumCanvasHeight)) throw new Error(`Invalid responsive layout: ${JSON.stringify(layout)}`);
      layouts.push(layout);
    }
    await send('Runtime.evaluate', { expression: `document.querySelector('button[aria-label="Alternar para modo escuro"]').click()` });
    await sleep(700);
    const dark = await send('Runtime.evaluate', { expression: `JSON.stringify({ dark: document.documentElement.classList.contains('dark'), canvases: document.querySelectorAll('.echarts-for-react canvas').length, classes: document.documentElement.className })`, returnByValue: true });
    const themeState = JSON.parse(dark.result.value);
    if (!themeState.dark || themeState.canvases !== expectedCharts || errors.length) throw new Error(`Theme smoke failed: ${JSON.stringify({ themeState, errors })}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(out, 'mobile-dark.png'), Buffer.from(screenshot.data, 'base64'));
    await writeFile(resolve(out, 'smoke.json'), JSON.stringify({ overview503: apiRequests.some(request => request.method === 'GET' && request.responseCode === 503), chartsRendered: expectedCharts, layouts, darkTheme: true, errors }, null, 2));
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ fixture: `Synthetic data, 200ms API delay, ${expectedCharts} real ${route} charts`, builds, results }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch { /* browser closes its socket before acknowledging */ }
    socket.close();
  }
  browser.kill();
  server.closeAllConnections();
  server.close();
}
