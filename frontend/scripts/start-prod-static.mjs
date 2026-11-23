import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from 'serve-handler';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = process.env.FRONTEND_DIST_DIR
  ? path.resolve(process.env.FRONTEND_DIST_DIR)
  : path.resolve(__dirname, '..', 'dist-prod');
const buildInfoPath = path.join(publicDir, 'build-info.json');
const host = process.env.FRONTEND_HOST || '127.0.0.1';
const port = Number(process.env.FRONTEND_PORT || 5173);
const buildInfo = validateStaticBuild();
const buildId = buildInfo.buildId;
const assetDirectories = publishedAssetDirectories();

const blockedDevPaths = [
  /^\/@vite(?:\/|$)/,
  /^\/@react-refresh(?:\/|$)/,
  /^\/src(?:\/|$)/,
  /^\/node_modules(?:\/|$)/,
  /^\/@fs(?:\/|$)/,
  /^\/vite\.svg$/,
];

function requestPath(url) {
  try {
    return new URL(url, `http://${host}:${port}`).pathname;
  } catch {
    return '/';
  }
}

function readBuildInfo() {
  if (!fs.existsSync(buildInfoPath)) {
    failStartup('Metadados do build nao encontrados em frontend/dist-prod/build-info.json. Execute iniciar-prod.bat.');
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
    if (typeof parsed.buildId === 'string' && parsed.buildId.trim()) {
      return { ...parsed, buildId: parsed.buildId.trim() };
    }
  } catch {
    failStartup('Metadados do build invalidos em frontend/dist-prod/build-info.json. Execute iniciar-prod.bat.');
  }

  failStartup('Metadados do build sem buildId em frontend/dist-prod/build-info.json. Execute iniciar-prod.bat.');
}

function failStartup(message) {
  console.error(`[ERRO] ${message}`);
  process.exit(1);
}

function hasSourceMapFile(directory) {
  if (!fs.existsSync(directory)) {
    return false;
  }

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() && hasSourceMapFile(entryPath)) {
      return true;
    }
    if (entry.isFile() && entry.name.endsWith('.map')) {
      return true;
    }
  }

  return false;
}

function validateStaticBuild() {
  const indexPath = path.join(publicDir, 'index.html');
  const assetsDir = path.join(publicDir, 'assets');

  if (!fs.existsSync(indexPath)) {
    failStartup('Build estatico nao encontrado em frontend/dist-prod/index.html. Execute iniciar-prod.bat.');
  }

  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const devMarkers = ['/@vite/client', '/@react-refresh', '/src/main.tsx', '/src/main.jsx', '/node_modules/', '/@fs/'];
  const devMarker = devMarkers.find((marker) => indexHtml.includes(marker));
  if (devMarker) {
    failStartup(`dist-prod/index.html contem marcador de Vite dev: ${devMarker}`);
  }

  if (!fs.existsSync(assetsDir)) {
    failStartup('Build estatico sem pasta frontend/dist-prod/assets.');
  }

  const assets = fs.readdirSync(assetsDir).filter((name) => /\.(js|css)$/i.test(name));
  if (assets.length === 0) {
    failStartup('Build estatico sem assets JS/CSS em frontend/dist-prod/assets.');
  }

  if (hasSourceMapFile(publicDir)) {
    failStartup('Build de producao contem sourcemaps .map; isso exporia a arvore de fontes no DevTools.');
  }

  return readBuildInfo();
}

// As abas abertas continuam importando módulos da versão em que iniciaram.
// Somente as distribuições ligadas pelo manifesto da versão ativa participam.
function publishedAssetDirectories() {
  const directories = new Map();
  const releases = path.dirname(path.dirname(publicDir));
  let id = buildId;
  let dist = publicDir;
  while (path.basename(dist) === 'frontend' && path.basename(path.dirname(dist)) === id && !directories.has(id)) {
    try {
      const info = JSON.parse(fs.readFileSync(path.join(dist, 'build-info.json'), 'utf8'));
      if (info.buildId !== id) break;
      directories.set(id, dist);
      const manifest = JSON.parse(fs.readFileSync(path.join(path.dirname(dist), 'build-manifest.json'), 'utf8'));
      if (manifest.buildId !== id || !/^\d{8}T\d{6}-[a-f0-9]{8}$/.test(manifest.previousBuild)) break;
      id = manifest.previousBuild;
      dist = path.join(releases, id, 'frontend');
    } catch {
      // A limpeza de uma distribuição antiga não impede a inicialização da atual.
      break;
    }
  }
  return directories;
}

function noStore(response) {
  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  response.setHeader('CDN-Cache-Control', 'no-store');
  response.setHeader('Cloudflare-CDN-Cache-Control', 'no-store');
  response.setHeader('Surrogate-Control', 'no-store');
  response.setHeader('Pragma', 'no-cache');
  response.setHeader('Expires', '0');
}

function applySecurityHeaders(request, response) {
  const pathname = requestPath(request.url);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Dashboard-Build-Id', buildId);
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; connect-src 'self' https://api-analytics.rodogarcia.com.br; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );

  if (pathname.startsWith('/assets/')) {
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else {
    noStore(response);
  }
}

const server = http.createServer((request, response) => {
  const pathname = requestPath(request.url);
  applySecurityHeaders(request, response);

  if (blockedDevPaths.some((pattern) => pattern.test(pathname))) {
    response.statusCode = 404;
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.end('Not found');
    return;
  }

  if (pathname === '/build-info.json') {
    response.statusCode = 200;
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(fs.readFileSync(buildInfoPath, 'utf8'));
    return;
  }

  if (pathname === '/assets' || pathname.startsWith('/assets/')) {
    const version = /^\/assets\/[\w.-]+-(\d{8}T\d{6}-[a-f0-9]{8})-[\w-]+\.\w+$/.exec(pathname)?.[1];
    return handler(request, response, {
      public: assetDirectories.get(version) ?? publicDir,
      directoryListing: false,
      cleanUrls: false,
    }, {
      sendError(_file, res, _json, _root, _methods, _config, { statusCode }) {
        noStore(res);
        res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Arquivo indisponível');
      },
    });
  }

  return handler(request, response, {
    public: publicDir,
    directoryListing: false,
    rewrites: [
      { source: '/**', destination: '/index.html' },
    ],
  });
});

server.listen(port, host, () => {
  console.log(`[OK] Frontend estatico servido em http://${host}:${server.address().port} | build=${buildId}`);
});
