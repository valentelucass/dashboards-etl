// Reads Maven's public coordinates only. No environment files, credentials, API or database access.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? 'backend/target/quality/dependencies.txt');
const output = resolve(process.argv[3] ?? '.tmp/quality/java-osv-audit.json');
const coordinates = [...(await readFile(input, 'utf8')).matchAll(/^\s+([^\s:]+):([^\s:]+):jar:([^\s:]+):(compile|runtime)\b/gm)]
  .map((match) => ({ package: { ecosystem: 'Maven', name: `${match[1]}:${match[2]}` }, version: match[3] }));
if (!coordinates.length) throw new Error('No runtime dependencies found; generate dependency:list first.');
async function query(queries) {
  const response = await fetch('https://api.osv.dev/v1/querybatch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`OSV HTTP ${response.status}`);
  return (await response.json()).results;
}
const results = await query(coordinates);
const packages = [];
for (let index = 0; index < coordinates.length; index++) {
  let page = results[index];
  const ids = (page.vulns ?? []).map((item) => item.id);
  while (page.next_page_token) {
    [page] = await query([{ ...coordinates[index], page_token: page.next_page_token }]);
    ids.push(...(page.vulns ?? []).map((item) => item.id));
  }
  if (ids.length) packages.push({ ...coordinates[index], ids: [...new Set(ids)] });
}
const summary = { checkedAt: new Date().toISOString(), checkedPackages: coordinates.length,
  affectedPackages: packages.length, uniqueAdvisories: new Set(packages.flatMap((item) => item.ids)).size,
  limitation: 'Version matching only; applicability/exploitability has not been established.', packages };
await writeFile(output, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ checkedPackages: summary.checkedPackages, affectedPackages: summary.affectedPackages,
  uniqueAdvisories: summary.uniqueAdvisories, output }));
process.exitCode = packages.length ? 1 : 0;
