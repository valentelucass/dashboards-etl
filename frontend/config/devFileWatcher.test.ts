import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer, normalizePath, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

describe('monitoramento de arquivos do Vite DEV', () => {
  const tempPrefix = path.join(tmpdir(), 'dashboard-watcher-test-');
  const generatedDirs = ['.tmp', 'dist', 'dist-prod', 'dist-ssr', 'coverage', 'logs'];
  let root: string;
  let vite: ViteDevServer;
  const errors: Error[] = [];
  const changes: string[] = [];

  const relative = (file: string) => normalizePath(path.relative(root, file));

  beforeAll(async () => {
    root = await mkdtemp(tempPrefix);
    for (const dir of [...generatedDirs, 'src', 'public']) {
      await mkdir(path.join(root, dir), { recursive: true });
    }
    const browserDir = path.join(root, '.tmp', 'browser', 'Default', 'Safe Browsing Network');
    await mkdir(browserDir, { recursive: true });
    await writeFile(path.join(browserDir, 'Safe Browsing Cookies'), 'fixture');
    for (const dir of generatedDirs) {
      await writeFile(path.join(root, dir, 'generated.txt'), 'initial');
    }
    await writeFile(path.join(root, 'src', 'probe.ts'), 'export const value = 1;');
    await writeFile(path.join(root, 'src', 'probe.css'), 'body { color: red; }');
    await writeFile(path.join(root, 'public', 'probe.txt'), 'initial');
    await writeFile(path.join(root, 'index.html'), '<main>initial</main>');

    // Carrega a configuração real, com fixture e cache isolados, sem API/banco.
    vite = await createServer({
      configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
      root, mode: 'development', envFile: false, logLevel: 'silent',
      cacheDir: path.join(root, 'node_modules', '.vite'),
      server: { middlewareMode: true, hmr: false },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    vite.watcher.on('error', (error) => errors.push(error));
    vite.watcher.on('all', (_event, file) => changes.push(relative(file)));
    await new Promise<void>((resolve) => vite.watcher.once('ready', resolve));
  }, 15000);

  afterAll(async () => {
    await vite?.close();
    // Só remove a fixture criada por este teste, dentro do temporário do sistema.
    if (root && path.resolve(root).startsWith(path.resolve(tempPrefix))) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('não entra em perfis de navegador, builds, relatórios ou logs, mesmo após criação de novos arquivos', async () => {
    for (const dir of generatedDirs) {
      await writeFile(path.join(root, dir, 'generated.txt'), 'changed');
      await mkdir(path.join(root, dir, 'new'), { recursive: true });
      await writeFile(path.join(root, dir, 'new', 'output.txt'), 'new');
    }
    // Dá ao watcher nativo tempo para observar tanto a escrita quanto a criação.
    await new Promise((resolve) => setTimeout(resolve, 300));
    const watched = Object.keys(vite.watcher.getWatched()).map(relative);
    for (const dir of generatedDirs) {
      expect(watched.some((file) => file === dir || file.startsWith(`${dir}/`))).toBe(false);
      expect(changes.some((file) => file === dir || file.startsWith(`${dir}/`))).toBe(false);
    }
    expect(errors).toEqual([]);
  });

  it('continua detectando código, CSS, HTML e arquivos públicos e invalida o módulo alterado', async () => {
    const first = await vite.transformRequest('/src/probe.ts');
    expect(first?.code).toContain('value = 1');
    const files = {
      'src/probe.ts': 'export const value = 2;',
      'src/probe.css': 'body { color: blue; }',
      'public/probe.txt': 'changed',
      'index.html': '<main>changed</main>',
    };
    for (const [file, content] of Object.entries(files)) {
      await writeFile(path.join(root, file), content);
    }
    await expect.poll(() => Object.keys(files).every((file) => changes.includes(file))).toBe(true);
    await expect.poll(async () => (await vite.transformRequest('/src/probe.ts'))?.code).toContain('value = 2');
    expect(errors).toEqual([]);
  });
});
