import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [output, ...inputs] = process.argv.slice(2);
if (!output || !inputs.length) throw new Error('Use <saida-sem-extensao> <diretorio-benchmark> [...diretorios].');
const pages = new Map();
for (const input of inputs) {
  const data = JSON.parse(await readFile(resolve(input, 'results.json'), 'utf8'));
  const route = data.fixture.match(/real (\w+) charts/)?.[1];
  if (!route) throw new Error(`Resultado sem rota: ${input}`);
  const page = pages.get(route) ?? { builds: data.builds, inputs: [], results: [] };
  if (JSON.stringify(page.builds) !== JSON.stringify(data.builds)) throw new Error('Não misture builds diferentes.');
  page.inputs.push(input);
  page.results.push(...data.results);
  pages.set(route, page);
}
const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length || sorted.some(value => !Number.isFinite(value))) return null;
  const i = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[i] : (sorted[i - 1] + sorted[i]) / 2;
};
const summaries = [];
const format = value => value === null ? '—' : value.toFixed(1).replace('.', ',');
let markdown = '## Medição no navegador\n\nMedianas em ms; variação negativa significa menor tempo. APIs sintéticas de 200 ms, sem custo SQL real.\n\n';
markdown += '| Página | Cenário | Amostras por versão | Último desenho antes | Depois | Variação |\n| --- | --- | ---: | ---: | ---: | ---: |\n';
let chartsMarkdown = '\n### Cada gráfico em CPU 4x / 2 Mbps\n\nTempos desde a navegação. “Dados” é a conclusão das APIs simuladas usadas pelo gráfico; “Após dados” inclui montagem, trabalho da thread principal e animações até o último desenho. Não é tempo de CPU exclusivo do gráfico.\n\n';
chartsMarkdown += '| Página / gráfico | Último desenho antes → depois | Dados antes → depois | Após dados antes → depois |\n| --- | ---: | ---: | ---: |\n';
for (const [route, page] of pages) {
  for (const mode of ['desktop', 'cpu4x-2Mbps']) {
    const summary = { route, mode, inputs: page.inputs, versions: {}, charts: {} };
    for (const version of ['before', 'after']) {
      const rows = page.results.filter(row => row.mode === mode && row.version === version);
      if (!rows.length) throw new Error(`Sem amostras: ${route}/${mode}/${version}`);
      summary.versions[version] = {
        samples: rows.length,
        firstDraw: median(rows.map(row => row.firstDraw)), lastDraw: median(rows.map(row => row.lastDraw)),
        lastDrawRange: [Math.min(...rows.map(row => row.lastDraw)), Math.max(...rows.map(row => row.lastDraw))],
        javascriptBytes: median(rows.map(row => row.javascriptBytes)),
        longTaskTotalMs: median(rows.map(row => row.longTaskTotalMs)),
        peakRequests: Math.max(...rows.map(row => row.peakPerformance)),
      };
      for (const title of Object.keys(rows[0].charts)) {
        summary.charts[title] ??= {};
        summary.charts[title][version] = Object.fromEntries(['firstDraw', 'lastDraw', 'dataReadyAt', 'finalDrawAfterDataMs', 'mounts']
          .map(key => [key, median(rows.map(row => row.charts[title]?.[key]))]));
      }
    }
    const { before, after } = summary.versions;
    summary.lastDrawChangePercent = 100 * (after.lastDraw / before.lastDraw - 1);
    markdown += `| ${route} | ${mode} | ${before.samples}/${after.samples} | ${format(before.lastDraw)} | ${format(after.lastDraw)} | ${format(summary.lastDrawChangePercent)}% |\n`;
    if (mode !== 'desktop') {
      for (const [title, times] of Object.entries(summary.charts)) {
        const pair = key => `${format(times.before[key])} → ${format(times.after[key])}`;
        chartsMarkdown += `| ${route}: ${title} | ${pair('lastDraw')} | ${pair('dataReadyAt')} | ${pair('finalDrawAfterDataMs')} |\n`;
      }
    }
    summaries.push(summary);
  }
}
await writeFile(resolve(output + '.json'), JSON.stringify({ inputs, summaries }, null, 2));
await writeFile(resolve(output + '.md'), markdown + chartsMarkdown);
console.log(markdown);
