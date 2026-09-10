// Synthetic browser benchmark. All API requests are intercepted; external DNS is disabled.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { setTimeout as sleep } from 'node:timers/promises';
import { chartCounts, pageFixture, chartApiPaths } from './benchmark-page-fixtures.mjs';
import { chartAnimationProbe, chartTitleProbe } from './chart-animation-probe.mjs';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [beforeDir = '.tmp/quality-perf-before', afterDir = '.tmp/quality-perf-after', outputDir = '.tmp/chart-benchmark', route = 'coletas', repetitions = '3', check = 'timing'] = process.argv.slice(2);
const smoke = check === 'smoke';
const loading = check === 'loading';
const navigation = check === 'navigation';
const animation = check === 'animation' || check === 'animation-fast';
const apiDelay = check === 'animation-fast' ? 10 : 200;
if (!['timing', 'smoke', 'animation', 'animation-fast', 'loading', 'navigation'].includes(check)) throw new Error('Use timing, smoke, animation, animation-fast, loading ou navigation.');
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
function fixture(path, params) {
  const pageData = pageFixture(path, params);
  if (path === '/api/painel/tracking/dashboard' && params.get('f.statusCarga') === 'Em entrega') return {
    ...pageData, overview: { ...pageData.overview, totalCargas: 30 },
    graficos: { ...pageData.graficos, statusDistribuicao: pageData.graficos.statusDistribuicao.filter(item => item.status === 'Em entrega') },
  };
  if (pageData !== undefined) return pageData;
  if (path === '/api/auth/refresh' || path === '/api/auth/me') {
    const usuario = { id: 'synthetic', nome: 'Teste sintético', email: 'synthetic@example.test', papel: 'usuario_comum',
      setor: { id: 'teste', nome: 'Teste' }, permissoesEfetivas: { coletas: true, performance: true, faturamento: true, fretes: true, manifestos: true, executivo: true, dimensoes: true, tracking: true,
        contasAPagar: true, faturasPorCliente: true, etlSaude: true, integracoes: true, indicadoresGestaoAVista: true, cotacoes: true },
      filiaisPermitidasEfetivas: ['CWB'], exigeTrocaSenha: false };
    if (path.endsWith('/me')) return usuario;
    return { usuario, exigeTrocaSenha: false, sessaoExpiraEm: new Date(Date.now() + 3_600_000).toISOString(),
      token: `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.synthetic` };
  }
  if (path === '/api/painel/home/comunicados') return [];
  if (path === '/api/sessao/presenca') return {};
  if (path === '/api/painel/coletas/graficos/status') return fixture('/api/painel/coletas/graficos', params).statusDistribuicao;
  if (path === '/api/painel/coletas/graficos/operacao') {
    const { regioesOrigem, agingAbertas } = fixture('/api/painel/coletas/graficos', params);
    return { regioesOrigem, agingAbertas };
  }
  if (path === '/api/dimensoes/filiais') return route === 'tracking' ? ['AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'] : ['CWB'];
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
    const counted = event.request.method === 'GET' && /^\/api\/(painel|dimensoes)\/(coletas|cotacoes|contas-a-pagar|faturas-por-cliente|tracking|etl-saude|indicadores-gestao-a-vista|integracoes|performance|fretes|faturamento|manifestos|executivo)(?:\/|$)/.test(path);
    if (counted) { activePerformance++; peakPerformance = Math.max(peakPerformance, activePerformance); }
    const body = fixture(path, url.searchParams);
    if (body === undefined) errors.push(`Missing fixture: ${path}`);
    // Delayed unrelated data must arrive after the entrance animation has finished.
    const delayed = animation && event.request.method === 'GET' &&
      (path.endsWith('/detalhes') || path.endsWith('/tabela/paginada') || path.endsWith('/resumo-financeiro'));
    // Modelo controlado: o pacote legado de Coletas executa três agregações SQL em série.
    // A separação usa uma agregação para status e duas para operação; nenhuma é duplicada.
    const sqlUnits = loading && event.request.method === 'GET'
      ? path === '/api/painel/coletas/graficos' ? 3 : path === '/api/painel/coletas/graficos/operacao' ? 2 : 1 : 1;
    await sleep(loading && event.request.method === 'OPTIONS' ? 0 : delayed ? 2200 : apiDelay * sqlUnits);
    const overviewFailure = smoke && event.request.method === 'GET' &&
      (path === '/api/painel/performance/overview' || path === '/api/painel/fretes' || path === '/api/painel/executivo');
    request.responseCode = body === undefined ? 404 : overviewFailure ? 503 : 200;
    if (counted) activePerformance--;
    try {
      await send('Fetch.fulfillRequest', { requestId: event.requestId, responseCode: request.responseCode,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json' },
        { name: 'Access-Control-Allow-Origin', value: currentOrigin }, { name: 'Access-Control-Allow-Credentials', value: 'true' },
        { name: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, OPTIONS' },
        { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-Dashboard-Route' }],
        body: Buffer.from(JSON.stringify(body ?? {})).toString('base64') });
    } catch (error) {
      // A navegação/troca de filtro pode cancelar o request enquanto o mock aguarda.
      if (!error.message.includes('Invalid InterceptionId')) throw error;
      request.canceled = true;
    }
    request.completedAt = Date.now();
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
  await send('Page.addScriptToEvaluateOnNewDocument', { source: chartTitleProbe });
  if (animation || smoke) await send('Page.addScriptToEvaluateOnNewDocument', { source: chartAnimationProbe });
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
            key = window.__chartTitleFor(element) || 'chart-' + (++chartId);
            chartElements.set(element, key);
            window.__chartMetrics.charts[key] = { firstDraw: performance.now(), lastDraw: 0,
              top: element.getBoundingClientRect().top,
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
  for (const mode of smoke || navigation ? modes.slice(0, 1) : modes) {
    await send('Emulation.setCPUThrottlingRate', { rate: mode.cpu });
    await send('Network.emulateNetworkConditions', { offline: false, latency: mode.cpu === 1 ? 0 : 40,
      downloadThroughput: mode.bytesPerSecond, uploadThroughput: mode.bytesPerSecond });
    for (let repetition = 1; repetition <= Number(repetitions); repetition++) {
      for (const version of smoke || navigation ? ['after'] : repetition % 2 ? ['before', 'after'] : ['after', 'before']) {
        activeRoot = builds[version]; apiRequests = []; errors.length = 0; externalBlocked = 0; activePerformance = 0; peakPerformance = 0;
        await send('Page.navigate', { url: `${origin}/${route}?dataInicio=2026-08-01&dataFim=2026-08-30&qualityRun=${mode.name}-${version}-${repetition}` });
        let metrics;
        let settled = false;
        let needsChartTab = route === 'cotacoes';
        for (let attempt = 0; attempt < 250; attempt++) {
          await sleep(100);
          if (needsChartTab) {
            const tab = await send('Runtime.evaluate', { expression: `(() => { const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Visão Analítica')); if (!button) return false; button.click(); return true; })()`, returnByValue: true });
            needsChartTab = !tab.result.value;
          }
          const evaluation = await send('Runtime.evaluate', { expression: `JSON.stringify({ ...window.__chartMetrics, timeOrigin: performance.timeOrigin, now: performance.now(), canvases: document.querySelectorAll('.echarts-for-react canvas').length })`, returnByValue: true });
          metrics = JSON.parse(evaluation.result.value ?? '{}');
          if (metrics.canvases === expectedCharts && Object.keys(metrics.charts ?? {}).length === expectedCharts && metrics.firstDraw > 0 && metrics.now - metrics.lastDraw > 400
            && apiRequests.every(request => request.completedAt) && Date.now() - Math.max(...apiRequests.map(request => request.completedAt)) > 400) { settled = true; break; }
        }
        if (!settled || metrics.canvases !== expectedCharts || Object.keys(metrics.charts ?? {}).length !== expectedCharts || !metrics.firstDraw || errors.length) {
          const diagnostic = await send('Runtime.evaluate', { expression: 'document.body.innerText.slice(0,1500)', returnByValue: true });
          throw new Error(JSON.stringify({ metrics, errors, apiRequests, page: diagnostic.result.value }));
        }
        const resourceResult = await send('Runtime.evaluate', { expression: `JSON.stringify(performance.getEntriesByType('resource').filter(x => x.name.endsWith('.js')).map(x => ({bytes:x.encodedBodySize,duration:x.duration})))`, returnByValue: true });
        const resources = JSON.parse(resourceResult.result.value);
        if (animation) {
          const probe = await send('Runtime.evaluate', { expression: 'JSON.stringify({ updates: window.__chartUpdates, finished: window.__chartFinished, initializations: window.__chartInitializations })', returnByValue: true });
          metrics.animation = JSON.parse(probe.result.value);
          if (new Set(metrics.animation.updates.map(update => update.title)).size !== expectedCharts) throw new Error(`Incomplete chart animation probe: ${JSON.stringify({ charts: metrics.charts, updates: metrics.animation.updates.map(({title, at}) => ({title, at})), initializations: metrics.animation.initializations })}`);
        }
        for (const [title, chart] of Object.entries(metrics.charts)) {
          const paths = chartApiPaths(route, title);
          const sources = apiRequests.filter(request => request.method === 'GET' && paths.includes(request.path)
            && new URLSearchParams(request.query).get('limite') !== '50');
          if (sources.length && sources.every(request => request.completedAt)) {
            chart.dataReadyAt = Math.max(...sources.map(request => request.completedAt)) - metrics.timeOrigin;
            chart.finalDrawAfterDataMs = chart.lastDraw - chart.dataReadyAt;
          }
        }
        const firstRowTop = Math.min(...Object.values(metrics.charts).map(chart => chart.top));
        const firstRowCharts = Object.values(metrics.charts).filter(chart => Math.abs(chart.top - firstRowTop) < 60);
        metrics.firstRowReadyMs = Math.max(...firstRowCharts.map(chart => chart.firstDraw));
        metrics.allChartsReadyMs = Math.max(...Object.values(metrics.charts).map(chart => chart.firstDraw));
        const pageGets = apiRequests.filter(request => request.method === 'GET' && request.path.startsWith('/api/painel/') && !request.path.includes('/home/'));
        metrics.firstDataRequestMs = Math.min(...pageGets.map(request => request.receivedAt)) - metrics.timeOrigin;
        metrics.firstRowAfterRequestsMs = metrics.firstRowReadyMs - metrics.firstDataRequestMs;
        metrics.allChartsAfterRequestsMs = metrics.allChartsReadyMs - metrics.firstDataRequestMs;
        metrics.allDataAfterRequestsMs = Math.max(...pageGets.map(request => request.completedAt)) - metrics.timeOrigin - metrics.firstDataRequestMs;
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

  if (navigation) {
    const checks = [];
    async function evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
      return result.result.value;
    }
    async function navigateMenu(targetRoute, expectedCache) {
      await evaluate(`document.querySelector('button[aria-label="Abrir menu de navegação"]').click()`);
      await sleep(250);
      const beforeCalls = apiRequests.length;
      const startedAt = Date.now();
      const target = '/' + targetRoute;
      const href = await evaluate(`(() => { const link = [...document.querySelectorAll('a[href]')].find(link => new URL(link.href).pathname === ${JSON.stringify(target)}); if (!link) throw new Error("Link ausente"); const href = link.getAttribute("href"); link.click(); return href; })()`);
      let state;
      for (let attempt = 0; attempt < 150; attempt++) {
        await sleep(100);
        state = await evaluate('({ path: location.pathname, search: location.search, canvases: document.querySelectorAll(".echarts-for-react canvas").length, pending: [...document.querySelectorAll("[data-dashboard-chart]")].some(card => card.querySelector(".animate-pulse")), width: innerWidth, scrollWidth: document.documentElement.scrollWidth })');
        if (state.path === target && state.canvases === chartCounts[targetRoute] && !state.pending
          && apiRequests.slice(beforeCalls).every(request => request.completedAt) && Date.now() - startedAt > 500) break;
      }
      const calls = apiRequests.slice(beforeCalls).filter(request => request.method === 'GET' && request.path.startsWith('/api/painel/') && !request.path.includes('/home/'));
      if (state.path !== target || state.canvases !== chartCounts[targetRoute] || state.pending || errors.length) throw new Error(JSON.stringify({ target, state, errors }));
      if (expectedCache === true && calls.length) throw new Error('Retorno fresco disparou consultas: ' + JSON.stringify(calls));
      if (expectedCache === false && !calls.length) throw new Error('Página removida do cache não foi consultada');
      await send('HeapProfiler.collectGarbage');
      const heap = await send('Runtime.getHeapUsage');
      checks.push({ route: targetRoute, href, apiGets: calls.length, elapsedMs: Date.now() - startedAt, heapBytes: heap.usedSize, ...state });
      for (const width of [390, 1265, 1920]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
        await sleep(150);
        const layout = await evaluate('({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, canvases: document.querySelectorAll(".echarts-for-react canvas").length })');
        if (layout.scrollWidth > width + 2 || layout.canvases !== chartCounts[targetRoute]) throw new Error(JSON.stringify({ target, layout }));
      }
      return checks.at(-1);
    }
    await navigateMenu('performance');
    const returned = await navigateMenu('coletas', true);
    if (!returned.search.includes('dataInicio=2026-08-01') || !returned.search.includes('dataFim=2026-08-30')) throw new Error('Período não preservado ao retornar');
    for (const targetRoute of Object.keys(chartCounts).filter(key => !['coletas', 'performance'].includes(key))) await navigateMenu(targetRoute);
    await navigateMenu('coletas', false);
    await writeFile(resolve(out, 'navigation.json'), JSON.stringify({ checks, errors, externalBlocked }, null, 2));
  }

  if (smoke) {
    const legendResult = await send('Runtime.evaluate', { expression: `JSON.stringify([...window.__chartTestInstances].map(([title, instance]) => {
      const legend = instance.getModel().getComponent('legend');
      const name = legend?.get('show') ? legend.getData()[0]?.get('name') : undefined;
      if (!name) return { title, applicable: false };
      instance.dispatchAction({ type: 'legendUnSelect', name });
      const unselected = instance.getOption().legend[0].selected[name] === false;
      instance.dispatchAction({ type: 'legendSelect', name });
      return { title, applicable: true, unselected, selected: instance.getOption().legend[0].selected[name] === true };
    }))`, returnByValue: true });
    const legends = JSON.parse(legendResult.result.value);
    if (legends.some(result => result.applicable && (!result.unselected || !result.selected))) throw new Error('Legend interaction failed');
    const layouts = [];
    for (const width of [1024, 390]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
      await sleep(700);
      const result = await send('Runtime.evaluate', { expression: `JSON.stringify({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, charts: [...document.querySelectorAll('.echarts-for-react')].map(x => {
        const title = window.__chartTitleFor(x); const instance = window.__chartTestInstances.get(title);
        const style = getComputedStyle(x);
        return { title, width: x.clientWidth, height: x.clientHeight, paddingX: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight),
          paddingY: parseFloat(style.paddingTop) + parseFloat(style.paddingBottom), canvas: !!x.querySelector('canvas'), renderedWidth: instance?.getWidth(), renderedHeight: instance?.getHeight() };
      }) })`, returnByValue: true });
      const layout = JSON.parse(result.result.value);
      const minimumCanvasHeight = route === 'manifestos' ? 300 : 350;
      // The existing 100%-height cost canvas is 4px shorter at 1024px in BOTH builds.
      // Keep this measured baseline exception local; other charts must fit within 1px.
      const heightTolerance = chart => route === 'manifestos' && chart.title === 'Evolução do Custo Real x Meta Diária Base' ? 4 : 1;
      if (layout.scrollWidth > layout.width + 2 || layout.charts.length !== expectedCharts || layout.charts.some(x => !x.canvas || x.width <= 0
        || x.height < (route === 'cotacoes' && x.title.startsWith('Taxas de Conversão') ? 1 : minimumCanvasHeight)
        || Math.abs(x.renderedWidth - (x.width - x.paddingX)) > 1 || Math.abs(x.renderedHeight - (x.height - x.paddingY)) > heightTolerance(x))) throw new Error(`Invalid responsive layout: ${JSON.stringify(layout)}`);
      layouts.push(layout);
    }
    await send('Runtime.evaluate', { expression: `document.querySelector('button[aria-label="Alternar para modo escuro"]').click()` });
    await sleep(700);
    const dark = await send('Runtime.evaluate', { expression: `JSON.stringify({ dark: document.documentElement.classList.contains('dark'), canvases: document.querySelectorAll('.echarts-for-react canvas').length, classes: document.documentElement.className })`, returnByValue: true });
    const themeState = JSON.parse(dark.result.value);
    if (!themeState.dark || themeState.canvases !== expectedCharts || errors.length) throw new Error(`Theme smoke failed: ${JSON.stringify({ themeState, errors })}`);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(out, 'mobile-dark.png'), Buffer.from(screenshot.data, 'base64'));
    let trackingFilter;
    if (route === 'tracking') {
      await send('Runtime.evaluate', { expression: `[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Em entrega').click()` });
      for (let attempt = 0; attempt < 80; attempt++) {
        await sleep(100);
        const state = await send('Runtime.evaluate', { expression: `JSON.stringify(window.__chartTestInstances.get('Distribuição de Status').getOption().series[0].data.map(item => ({name:item.name, value:item.value})))`, returnByValue: true });
        trackingFilter = JSON.parse(state.result.value);
        if (trackingFilter.length === 1 && trackingFilter[0].name === 'Em entrega' && trackingFilter[0].value === 30) break;
      }
      if (trackingFilter?.length !== 1 || trackingFilter[0].value !== 30 || errors.length) throw new Error('Tracking filter did not update chart');
    }
    await writeFile(resolve(out, 'smoke.json'), JSON.stringify({ overview503: apiRequests.some(request => request.method === 'GET' && request.responseCode === 503), chartsRendered: expectedCharts, layouts, legends, trackingFilter, darkTheme: true, errors }, null, 2));
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify({ fixture: `Synthetic data, ${apiDelay}ms API delay${loading ? ", Coletas legacy charts = 3 SQL units, operation = 2 units, OPTIONS = 0ms" : ""}${animation ? ', unrelated table GET delayed 2200ms' : ''}, ${expectedCharts} real ${route} charts`, builds, results }, null, 2));
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    try { await send('Browser.close'); } catch { /* browser closes its socket before acknowledging */ }
    socket.close();
  }
  browser.kill();
  server.closeAllConnections();
  server.close();
}
