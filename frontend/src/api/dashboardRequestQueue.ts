import { CanceledError, isAxiosError } from 'axios';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { dashboardRequestPath, dashboardRequestPriority } from '../config/dashboardLoadPriority';

export const DASHBOARD_MAX_CONCURRENT_REQUESTS = 3;
const browserSlots = Array.from({ length: DASHBOARD_MAX_CONCURRENT_REQUESTS }, (_, i) => `dashboard-consulta-${i}`);

async function sendReport(adapter: AxiosAdapter, config: InternalAxiosRequestConfig) {
  const deadline = Date.now() + (config.timeout || 90000);
  for (;;) {
    if (config.signal?.aborted) throw new CanceledError('Consulta cancelada.', config);
    try {
      return await adapter({ ...config, timeout: Math.max(1, deadline - Date.now()) });
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 503) throw error;
      const delay = Number(error.response.headers['retry-after']) * 1000;
      if (!Number.isFinite(delay) || delay <= 0 || Date.now() + delay >= deadline) throw error;
      await new Promise<void>((resolve, reject) => {
        const signal = config.signal;
        const cancel = () => {
          clearTimeout(timer);
          reject(new CanceledError('Consulta cancelada.', config));
        };
        const timer = setTimeout(() => {
          signal?.removeEventListener?.('abort', cancel);
          resolve();
        }, delay);
        signal?.addEventListener?.('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
      });
    }
  }
}

// Cada vaga pertence à mesma origem em todas as abas e é liberada ao concluir a leitura ou fechar a aba.
async function sendInBrowserSlot(adapter: AxiosAdapter, config: InternalAxiosRequestConfig, firstSlot: number) {
  const signal = config.signal;
  let started = false;
  const send = () => {
    started = true;
    return sendReport(adapter, config);
  };
  try {
    const locks = globalThis.window?.navigator.locks;
    if (!locks || (signal && !(signal instanceof AbortSignal))) return send();

    for (let i = 0; i < browserSlots.length; i++) {
      if (signal?.aborted) throw new CanceledError('Consulta cancelada antes do envio.', config);
      const name = browserSlots[(firstSlot + i) % browserSlots.length];
      const response = await locks.request(name, { ifAvailable: true }, lock => lock ? send() : null);
      if (response !== null) return response;
    }
    return await locks.request(browserSlots[firstSlot], { signal }, send);
  } catch (error) {
    if (!started && signal?.aborted) throw new CanceledError('Consulta cancelada antes do envio.', config);
    if (!started && error instanceof DOMException && ['SecurityError', 'NotSupportedError'].includes(error.name)) return send();
    throw error;
  }
}

export function createDashboardRequestAdapter(adapter: AxiosAdapter): AxiosAdapter {
  let active = 0;
  let nextSlot = 0;
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
          const slot = nextSlot;
          nextSlot = (nextSlot + 1) % browserSlots.length;
          sendInBrowserSlot(adapter, config, slot).then(resolve, reject).finally(() => {
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
