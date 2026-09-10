import { CanceledError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { dashboardRequestPath, dashboardRequestPriority } from '../config/dashboardLoadPriority';

export const DASHBOARD_MAX_CONCURRENT_REQUESTS = 3;

// Limite compartilhado pelos dashboards, inclusive durante a navegação entre eles.
// Auth, exportações, downloads e escritas mantêm seu fluxo.
export function createDashboardRequestAdapter(adapter: AxiosAdapter): AxiosAdapter {
  let active = 0;
  let scheduled = false;
  const queue: Array<{ path: string; config: InternalAxiosRequestConfig; start: () => void }> = [];

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      // Uma leitura de layout por endpoint/lote, sem listeners de scroll ou timers.
      const priorityKey = (item: (typeof queue)[number]) => `${item.path}|${item.config.dashboardChartKey ?? ''}`;
      const priorities = new Map<string, number>();
      for (const item of queue) {
        const key = priorityKey(item);
        if (!priorities.has(key)) priorities.set(key, dashboardRequestPriority(item.path, item.config.dashboardChartKey));
      }
      queue.sort((a, b) => priorities.get(priorityKey(a))! - priorities.get(priorityKey(b))!);
      while (active < DASHBOARD_MAX_CONCURRENT_REQUESTS && queue.length) queue.shift()!.start();
    });
  }

  return (config) => {
    const path = dashboardRequestPath(config);
    if (path === null) return adapter(config);
    return new Promise((resolve, reject) => {
      const cancel = () => {
        const index = queue.indexOf(item);
        if (index >= 0) queue.splice(index, 1);
        config.signal?.removeEventListener?.('abort', cancel);
        reject(new CanceledError('Consulta cancelada antes do envio.', config));
      };
      const item = {
        path,
        config,
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
