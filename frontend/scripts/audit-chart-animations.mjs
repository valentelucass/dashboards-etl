// Runs one isolated browser at a time; no operational API or database is contacted.
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chartCounts } from './benchmark-page-fixtures.mjs';

const frontend = fileURLToPath(new URL('..', import.meta.url));
const [before, after, output = '.tmp/animation-audit', ...selected] = process.argv.slice(2);
if (!before || !after) throw new Error('Use: node scripts/audit-chart-animations.mjs <before> <after> <output> [routes...]');
const routes = selected.length ? selected : Object.keys(chartCounts);
if (routes.some(route => !(route in chartCounts))) throw new Error('Unsupported route');
const root = resolve(frontend, output);
await mkdir(root, { recursive: true });
const summaries = [];

async function run(route, mode, directory) {
  const log = createWriteStream(`${directory}.log`);
  const child = spawn(process.execPath, ['scripts/benchmark-charts.mjs', before, after, directory, route, '1', mode],
    { cwd: frontend, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false });
  const code = await new Promise((done, reject) => { child.on('error', reject); child.on('close', done); });
  await new Promise(done => log.end(done));
  if (code !== 0) throw new Error(`${route}/${mode} failed: ${directory}.log`);
}
function values(update) {
  return JSON.stringify(update.series.map(series => ({ type: series.type, name: series.name,
    data: series.data?.map(item => item && typeof item === 'object' && !Array.isArray(item)
      ? { name: item.name, value: item.value } : item) })));
}

async function compare(route, directory) {
  const { results } = JSON.parse(await readFile(resolve(directory, 'results.json'), 'utf8'));
  const charts = [];
  for (const current of results.filter(result => result.version === 'after')) {
    const previous = results.find(result => result.version === 'before' && result.mode === current.mode);
    for (const title of Object.keys(current.charts)) {
      const updatesBefore = previous.animation.updates.filter(update => update.title === title);
      const updatesAfter = current.animation.updates.filter(update => update.title === title);
      const initsAfter = current.animation.initializations.filter(instance => instance.title === title).length;
      const sameData = values(updatesBefore.at(-1)) === values(updatesAfter.at(-1));
      charts.push({ mode: current.mode, title, updatesBefore: updatesBefore.length, updatesAfter: updatesAfter.length,
        initializationsBefore: previous.animation.initializations.filter(instance => instance.title === title).length,
        initializationsAfter: initsAfter, sameData });
    }
  }
  await writeFile(resolve(directory, 'comparison.json'), JSON.stringify(charts, null, 2));
  if (charts.some(chart => chart.updatesAfter !== 1 || chart.initializationsAfter !== 1 || !chart.sameData)) {
    throw new Error(`Unexpected replay or data difference in ${route}: ${directory}/comparison.json`);
  }
  return charts;
}

for (const route of routes) {
  console.log(`[animation] ${route}`);
  const directory = resolve(root, route.replaceAll('/', '-'));
  await run(route, 'animation', directory);
  const charts = await compare(route, directory);
  if (route === 'cotacoes') {
    await run(route, 'animation-fast', `${directory}-fast`);
    await compare(route, `${directory}-fast`);
  }
  await run(route, 'smoke', `${directory}-smoke`);
  summaries.push({ route, charts: chartCounts[route], chartsCompared: charts.length, singleInitialization: true,
    singleDataApplication: true, sameData: true, responsiveAndTheme: true });
  await writeFile(resolve(root, 'summary.json'), JSON.stringify(summaries, null, 2));
  console.log(`[animation] ${route}: OK (${chartCounts[route]} charts)`);
}
