import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { criarProxyApiDev, validarOrigemTunel } from './config/devApiProxy'

const DEV_FRONTEND_PORT = 5174
const PROD_FRONTEND_PORT = 5173
const LOCAL_DEV_HOSTS = ['localhost', '127.0.0.1']

function normalizarBuildId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'dev'
}

function resolverBuildId(command: string): string {
  if (process.env.VITE_DASHBOARD_BUILD_ID) {
    return normalizarBuildId(process.env.VITE_DASHBOARD_BUILD_ID)
  }

  if (command === 'build') {
    return normalizarBuildId(new Date().toISOString())
  }

  return 'dev'
}

function dashboardBuildIdHtmlPlugin(buildId: string): Plugin {
  return {
    name: 'dashboard-build-id-html',
    enforce: 'pre',
    transformIndexHtml(html) {
      return html.replace(/%VITE_DASHBOARD_BUILD_ID%/g, buildId)
    },
  }
}

export default defineConfig(({ command, mode, isPreview }) => {
  const isNpmDev = process.env.npm_lifecycle_event === 'dev'

  if (command === 'serve' && isNpmDev && mode !== 'development') {
    throw new Error('Vite dev deve rodar com --mode development para carregar .env.development.')
  }

  const buildId = resolverBuildId(command)
  process.env.VITE_DASHBOARD_BUILD_ID = buildId
  const isDevServer = command === 'serve' && mode === 'development' && !isPreview
  const tunnelOrigin = isDevServer
    ? validarOrigemTunel(loadEnv(mode, fileURLToPath(new URL('..', import.meta.url)), 'DASHBOARD_DEV_TUNNEL_ORIGIN').DASHBOARD_DEV_TUNNEL_ORIGIN)
    : undefined

  return {
    envDir: '..',
    plugins: [dashboardBuildIdHtmlPlugin(buildId), react(), tailwindcss()],
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name]-${buildId}-[hash].js`,
          chunkFileNames: `assets/[name]-${buildId}-[hash].js`,
          assetFileNames: `assets/[name]-${buildId}-[hash][extname]`,
        },
      },
    },
    server: {
      host: '127.0.0.1',
      port: DEV_FRONTEND_PORT,
      strictPort: true,
      allowedHosts: [...LOCAL_DEV_HOSTS, ...(tunnelOrigin ? [new URL(tunnelOrigin).hostname] : [])],
      proxy: isDevServer ? { '^/api(?:/|\\?|$)': criarProxyApiDev(tunnelOrigin) } : undefined,
    },
    preview: {
      host: '127.0.0.1',
      port: PROD_FRONTEND_PORT,
      strictPort: true,
    },
  }
})
