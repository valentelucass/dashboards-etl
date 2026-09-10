import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [beforeArg = '.tmp/quality-perf-before', afterArg = '.tmp/quality-perf-after'] = process.argv.slice(2);

async function measure(directory) {
  const root = resolve(frontend, directory);
  const manifest = JSON.parse(await readFile(resolve(root, '.vite/manifest.json'), 'utf8'));
  const rows = {};
  for (const entry of Object.keys(manifest).filter((key) => key === 'index.html' || key.startsWith('src/pages/'))) {
    const visited = new Set();
    function visit(key) {
      if (visited.has(key)) return;
      visited.add(key);
      for (const child of manifest[key]?.imports ?? []) visit(child);
    }
    visit(entry);
    let bytes = 0;
    let gzipBytes = 0;
    for (const key of visited) {
      const data = await readFile(resolve(root, manifest[key].file));
      bytes += data.length;
      gzipBytes += gzipSync(data).length;
    }
    rows[entry] = { files: visited.size, bytes, gzipBytes };
  }
  return rows;
}

const before = await measure(beforeArg);
const after = await measure(afterArg);
const comparison = Object.entries(before).map(([page, old]) => ({
  page, before: old, after: after[page],
  savedBytes: old.bytes - after[page].bytes,
  savedGzipBytes: old.gzipBytes - after[page].gzipBytes,
  reductionPercent: Number((100 * (1 - after[page].bytes / old.bytes)).toFixed(2)),
}));
await writeFile(resolve(frontend, '.tmp/bundle-comparison.json'), JSON.stringify(comparison, null, 2));
console.table(comparison.map((row) => ({ page: row.page, beforeKB: (row.before.bytes / 1000).toFixed(1),
  afterKB: (row.after.bytes / 1000).toFixed(1), savedGzipKB: (row.savedGzipBytes / 1000).toFixed(1),
  reduction: `${row.reductionPercent}%` })));
