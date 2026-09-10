import type { ProxyOptions } from 'vite';

export const DEV_API_TARGET = 'http://127.0.0.1:5011';
const LOCAL_FRONTEND_ORIGIN = 'http://127.0.0.1:5174';
const LOCAL_FRONTEND_ORIGINS = [LOCAL_FRONTEND_ORIGIN, 'http://localhost:5174'];

export function validarOrigemTunel(value: string | undefined): string | undefined {
  const origin = value?.trim();
  if (!origin) return undefined;

  try {
    const url = new URL(origin);
    if (url.protocol === 'https:' && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.devtunnels\.ms$/.test(url.hostname)
      && !url.username && !url.password && !url.port
      && url.pathname === '/' && !url.search && !url.hash) {
      return url.origin;
    }
  } catch {
    // Uma origem exata evita autorizar os túneis de outros usuários.
  }
  throw new Error('DASHBOARD_DEV_TUNNEL_ORIGIN deve ser a origem HTTPS exata do seu túnel devtunnels.ms, sem caminho.');
}

export function criarProxyApiDev(tunnelOrigin?: string): ProxyOptions {
  const allowedOrigins = new Set(LOCAL_FRONTEND_ORIGINS);
  const validatedOrigin = validarOrigemTunel(tunnelOrigin);
  if (validatedOrigin) allowedOrigins.add(validatedOrigin);

  return {
    target: DEV_API_TARGET,
    changeOrigin: true,
    bypass(req, res) {
      if (!res) return false;
      const origin = req.headers.origin;
      // Não transforme uma origem arbitrária em uma origem aceita pelo Spring.
      if ((origin !== undefined && !allowedOrigins.has(origin))
        || req.headers['sec-fetch-site'] === 'cross-site') {
        res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ mensagem: 'Origem não autorizada no proxy de desenvolvimento.' }));
        return req.url; // O Vite encerra o fluxo quando a resposta já terminou.
      }
    },
    configure(proxy) {
      proxy.on('proxyReq', (proxyReq, req) => {
        if (req.headers.origin) proxyReq.setHeader('Origin', LOCAL_FRONTEND_ORIGIN);
      });
      proxy.on('error', (_error, _req, res) => {
        if ('writeHead' in res && !res.headersSent && !res.writableEnded) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ mensagem: 'API de desenvolvimento indisponível na máquina do projeto (porta 5011).' }));
        }
      });
    },
  };
}
