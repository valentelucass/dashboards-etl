import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, it } from 'vitest';

const older = '20261120T100000-11111111';
const previous = '20261121T100000-22222222';
const active = '20261122T100000-33333333';
const unpublished = '20261121T110000-44444444';
const asset = (id: string) => `IndicadoresGestaoAVistaPage-${id}-abc12345.js`;
const html = '<!doctype html><title>Painel</title>';
let root: string;
let server: ChildProcess;
let origin: string;

async function release(id: string, predecessor?: string) {
  const releaseDir = join(root, id);
  const dist = join(releaseDir, 'frontend');
  await mkdir(join(dist, 'assets'), { recursive: true });
  await Promise.all([
    writeFile(join(dist, 'index.html'), html),
    writeFile(join(dist, 'build-info.json'), JSON.stringify({ buildId: id })),
    writeFile(join(dist, 'assets', asset(id)), `export default '${id}';`),
    writeFile(join(dist, 'assets', 'styles-' + id + '-abc12345.css'), 'html { color: black; }'),
    writeFile(join(releaseDir, 'build-manifest.json'), JSON.stringify({ buildId: id, previousBuild: predecessor })),
  ]);
  return dist;
}

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'gestao-assets-'));
  await release(older);
  await release(previous, older);
  await release(unpublished);
  const dist = await release(active, previous);
  server = spawn(process.execPath, [fileURLToPath(new URL('../scripts/start-prod-static.mjs', import.meta.url))], {
    env: { ...process.env, FRONTEND_HOST: '127.0.0.1', FRONTEND_PORT: '0', FRONTEND_DIST_DIR: dist },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.once('exit', code => reject(new Error('Servidor de teste encerrou com ' + code)));
    server.stdout!.once('data', data => {
      const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/);
      if (!match) return reject(new Error('Servidor de teste não informou a porta'));
      origin = match[0];
      resolve();
    });
  });
});

afterAll(async () => {
  if (server && server.exitCode === null && server.signalCode === null) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
  if (root) await rm(root, { recursive: true, force: true });
});

it.each([active, previous, older])('serve o JavaScript exato da versão publicada %s', async id => {
  const res = await fetch(origin + '/assets/' + asset(id));
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toMatch(/javascript/);
  expect(res.headers.get('cache-control')).toContain('immutable');
  expect(await res.text()).toBe(`export default '${id}';`);
});

it('serve também o CSS carregado pela aba antiga', async () => {
  const res = await fetch(origin + '/assets/styles-' + previous + '-abc12345.css');
  expect(res.headers.get('content-type')).toMatch(/text\/css/);
  expect(await res.text()).toBe('html { color: black; }');
});

it.each(['inexistente.js', asset(unpublished)])('devolve 404 sem cache para o arquivo indisponível %s', async name => {
  const res = await fetch(origin + '/assets/' + name);
  expect(res.status).toBe(404);
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(res.headers.get('cloudflare-cdn-cache-control')).toBe('no-store');
  expect(await res.text()).not.toContain(html);
});

it('preserva o acesso direto à tela com os filtros', async () => {
  const res = await fetch(origin + '/indicadores-gestao-a-vista?dataInicio=2026-11-01');
  expect(res.status).toBe(200);
  expect(res.headers.get('cache-control')).toContain('no-store');
  expect(await res.text()).toBe(html);
});
