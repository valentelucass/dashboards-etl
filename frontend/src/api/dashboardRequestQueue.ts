import { CanceledError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';

export const DASHBOARD_MAX_CONCURRENT_REQUESTS = 3;

function prioridade(config: InternalAxiosRequestConfig): number | null {
  if ((config.method ?? 'get').toLowerCase() !== 'get') return null;
  const path = new URL(config.url ?? '', 'http://dashboard.invalid').pathname;
  if (!/^\/api\/(painel|dimensoes)\/(performance|fretes|faturamento|manifestos|executivo)(?:\/|$)/.test(path)
      || path.endsWith('/exportacao') || path.includes('/importacao/')) return null;
  if (path.endsWith('/overview') || /^\/api\/painel\/(fretes|executivo)$/.test(path)
      || path === '/api/painel/manifestos/performance') return 0;
  if (path.includes('/tabela')) return 3;
  if (path.startsWith('/api/dimensoes/')) return 2;
  return 1;
}

// Limite compartilhado pelas quatro páginas, inclusive durante a navegação entre elas.
// Auth, exportações, downloads e escritas mantêm seu fluxo.
export function createDashboardRequestAdapter(adapter: AxiosAdapter): AxiosAdapter {
  let active = 0;
  let scheduled = false;
  const queue: Array<{ priority: number; start: () => void }> = [];

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      queue.sort((a, b) => a.priority - b.priority);
      while (active < DASHBOARD_MAX_CONCURRENT_REQUESTS && queue.length) queue.shift()!.start();
    });
  }

  return (config) => {
    const priority = prioridade(config);
    if (priority === null) return adapter(config);
    return new Promise((resolve, reject) => {
      const cancel = () => {
        const index = queue.indexOf(item);
        if (index >= 0) queue.splice(index, 1);
        config.signal?.removeEventListener?.('abort', cancel);
        reject(new CanceledError('Consulta cancelada antes do envio.', config));
      };
      const item = {
        priority,
        start: () => {
          config.signal?.removeEventListener?.('abort', cancel);
          if (config.signal?.aborted) { cancel(); return; }
          active++;
          // Captura também falhas síncronas do adapter e sempre libera a vaga.
          Promise.resolve().then(() => adapter(config)).then(resolve, reject).finally(() => {
            active--;
            schedule();
          });
        },
      };
      if (config.signal?.aborted) { cancel(); return; }
      config.signal?.addEventListener?.('abort', cancel, { once: true });
      queue.push(item);
      schedule();
    });
  };
}
