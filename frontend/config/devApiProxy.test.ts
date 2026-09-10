import { createServer as createHttpServer, request, type Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { criarProxyApiDev, DEV_API_TARGET, validarOrigemTunel } from './devApiProxy';

const tunnelOrigin = 'https://teste-5174.brs.devtunnels.ms';
const localOrigin = 'http://127.0.0.1:5174';

describe('configuração do túnel', () => {
  it('mantém o destino fixo na API DEV e aceita somente um túnel exato', () => {
    expect(criarProxyApiDev().target).toBe(DEV_API_TARGET);
    expect(DEV_API_TARGET).toBe('http://127.0.0.1:5011');
    expect(validarOrigemTunel(undefined)).toBeUndefined();
    expect(validarOrigemTunel(`${tunnelOrigin}/`)).toBe(tunnelOrigin);
  });
  it.each(['https://devtunnels.ms', 'https://devtunnels.ms.evil.test', 'http://teste.devtunnels.ms', 'https://teste.devtunnels.ms/login', 'https://user:pass@teste.devtunnels.ms', 'https://teste.devtunnels.ms?x=1', 'https://*.devtunnels.ms', '.devtunnels.ms', '*'])('rejeita origem ampla ou inválida %s', (origin) => {
    expect(() => criarProxyApiDev(origin)).toThrow('origem HTTPS exata');
  });
});

describe('proxy Vite com API HTTP isolada', () => {
  let api: Server;
  let vite: ViteDevServer;
  let root: string;
  let baseUrl: string;
  const received: Array<{ url: string; body: string; origin?: string; authorization?: string; cookie?: string }> = [];

  beforeAll(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'dashboard-proxy-test-'));
    api = createHttpServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      received.push({ url: req.url!, body: Buffer.concat(chunks).toString('utf8'), origin: req.headers.origin, authorization: req.headers.authorization, cookie: req.headers.cookie });
      // Mesmo contrato de CORS do Spring no profile dev.
      if (req.headers.origin && req.headers.origin !== localOrigin) {
        res.writeHead(403).end('Invalid CORS request');
        return;
      }
      if (req.url === '/api/exportar') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename=teste.bin' });
        res.end(Buffer.from([0, 255, 1, 128]));
        return;
      }
      if (req.url === '/api/auth/me') {
        res.writeHead(401, { 'Content-Type': 'application/json' }).end('{"mensagem":"Sessão expirada"}');
        return;
      }
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/api/auth/login') res.setHeader('Set-Cookie', 'dashboard_refresh_token=sintetico; Path=/api/auth; HttpOnly; SameSite=Lax');
      if (req.url === '/api/auth/refresh') {
        if (req.headers.cookie !== 'dashboard_refresh_token=sintetico') {
          res.writeHead(401).end('{}');
          return;
        }
        res.setHeader('Set-Cookie', 'dashboard_refresh_token=renovado; Path=/api/auth; HttpOnly; SameSite=Lax');
      }
      if (req.url === '/api/auth/logout') res.setHeader('Set-Cookie', 'dashboard_refresh_token=; Path=/api/auth; Max-Age=0; HttpOnly; SameSite=Lax');
      res.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => api.listen(0, '127.0.0.1', resolve));
    const apiPort = (api.address() as AddressInfo).port;
    vite = await createServer({
      configFile: false, envFile: false, root, logLevel: 'silent', appType: 'custom',
      server: { host: '127.0.0.1', port: 0, hmr: false, watch: null,
        allowedHosts: ['teste-5174.brs.devtunnels.ms'],
        proxy: { '^/api(?:/|\\?|$)': { ...criarProxyApiDev(tunnelOrigin), target: `http://127.0.0.1:${apiPort}` } },
      },
      optimizeDeps: { noDiscovery: true, include: [] },
    });
    await vite.listen();
    baseUrl = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await vite?.close();
    if (api?.listening) await new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve()));
    // Diretório temporário criado exclusivamente por este teste.
    if (root?.startsWith(path.join(tmpdir(), 'dashboard-proxy-test-'))) await rm(root, { recursive: true, force: true });
  });

  function call(url: string, options: { origin?: string; method?: string; body?: string; headers?: Record<string, string> } = {}) {
    return new Promise<{ status: number; body: Buffer; headers: import('node:http').IncomingHttpHeaders }>((resolve, reject) => {
      const req = request(`${baseUrl}${url}`, {
        method: options.method ?? 'GET',
        headers: { ...(options.origin ? { Origin: options.origin } : {}), ...options.headers },
      }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks), headers: res.headers }));
      });
      req.on('error', reject);
      req.end(options.body);
    });
  }

  it.each([localOrigin, 'http://localhost:5174', tunnelOrigin])('encaminha POST com Origin %s, preservando corpo e autorização', async (origin) => {
    const result = await call('/api/auth/login', { origin, method: 'POST', body: '{"email":"teste@example.invalid","senha":"sintetica"}', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer sintetico' } });
    expect(result.status).toBe(200);
    expect(received.at(-1)).toMatchObject({ url: '/api/auth/login', origin: localOrigin, authorization: 'Bearer sintetico', body: '{"email":"teste@example.invalid","senha":"sintetica"}' });
    expect(result.headers['set-cookie']?.[0]).toContain('Path=/api/auth; HttpOnly; SameSite=Lax');
  });

  it('preserva login, cookie de refresh, rotação e logout no mesmo caminho', async () => {
    const login = await call('/api/auth/login', { method: 'POST', origin: tunnelOrigin });
    const cookie = login.headers['set-cookie']![0].split(';')[0];
    const refresh = await call('/api/auth/refresh', { method: 'POST', origin: tunnelOrigin, headers: { Cookie: cookie } });
    expect(refresh.status).toBe(200);
    expect(refresh.headers['set-cookie']![0]).toContain('dashboard_refresh_token=renovado');
    const logout = await call('/api/auth/logout', { method: 'POST', origin: tunnelOrigin });
    expect(logout.headers['set-cookie']![0]).toContain('Max-Age=0');
  });

  it.each(['https://outro-5174.brs.devtunnels.ms', 'https://evil.test', 'null'])('bloqueia %s antes de chegar à API', async (origin) => {
    const count = received.length;
    const result = await call('/api/auth/login', { origin, method: 'POST', headers: { 'X-Forwarded-Host': 'teste-5174.brs.devtunnels.ms' } });
    expect(result.status).toBe(403);
    expect(received).toHaveLength(count);
  });

  it('bloqueia requisição cross-site sem Origin e Host desconhecido', async () => {
    const count = received.length;
    expect((await call('/api/auth/refresh', { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
    expect((await call('/api/auth/refresh', { headers: { Host: 'evil.test' } })).status).toBe(403);
    expect(received).toHaveLength(count);
  });

  it('aceita Host do túnel explicitamente autorizado', async () => {
    expect((await call('/api/painel/teste?a=1&b=%C3%A7', { headers: { Host: 'teste-5174.brs.devtunnels.ms' } })).status).toBe(200);
    expect(received.at(-1)?.url).toBe('/api/painel/teste?a=1&b=%C3%A7');
  });

  it('preserva erro de autenticação, arquivo binário e cabeçalho de download', async () => {
    expect((await call('/api/auth/me')).status).toBe(401);
    const download = await call('/api/exportar');
    expect(download.body).toEqual(Buffer.from([0, 255, 1, 128]));
    expect(download.headers['content-disposition']).toBe('attachment; filename=teste.bin');
  });

  it('não encaminha caminhos fora de /api', async () => {
    const count = received.length;
    expect((await call('/api-outro')).status).toBe(404);
    expect(received).toHaveLength(count);
  });

  it('devolve 503 se a API estiver desligada, sem tentar outro destino', async () => {
    await new Promise<void>((resolve, reject) => api.close((error) => error ? reject(error) : resolve()));
    const result = await call('/api/auth/login', { method: 'POST', origin: tunnelOrigin });
    expect(result.status).toBe(503);
    expect(result.body.toString()).toContain('máquina do projeto');
  });
});
