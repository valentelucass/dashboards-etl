// Read-only enrichment: sends public advisory IDs only; never reads environment credentials.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = resolve(process.argv[2] ?? '.tmp/quality/java-osv-audit.json');
const output = resolve(process.argv[3] ?? '.tmp/quality/java-osv-triage.json');
const audit = JSON.parse(await readFile(input, 'utf8'));
const ids = [...new Set(audit.packages.flatMap((item) => item.ids))];
const advisories = [];
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < ids.length) {
    const id = ids[cursor++];
    const response = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`${id}: HTTP ${response.status}`);
    const data = await response.json();
    advisories.push({ id, aliases: data.aliases ?? [], summary: data.summary, published: data.published,
      modified: data.modified, withdrawn: data.withdrawn, severity: data.database_specific?.severity,
      cvss: data.severity, references: data.references,
      affected: (data.affected ?? []).filter((entry) => audit.packages.some((item) => item.package.name === entry.package?.name))
        .map((entry) => ({ package: entry.package, ranges: entry.ranges, versions: entry.versions })),
      applicability: 'Requires review of application configuration and reachable code paths; not an exploit confirmation.',
    });
  }
}));
advisories.sort((a, b) => a.id.localeCompare(b.id));
const cves = [...new Set(advisories.flatMap((item) => item.aliases).filter((id) => id.startsWith('CVE-')))];
await writeFile(output, JSON.stringify({ checkedAt: new Date().toISOString(), packages: audit.packages,
  advisoryCount: advisories.length, uniqueCveAliases: cves.length, advisories }, null, 2));
console.log(JSON.stringify({ advisoryCount: advisories.length, uniqueCveAliases: cves.length, output }));
