// @vitest-environment jsdom
import { QueryObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDashboardQueryClient } from './queryClient';
import { DASHBOARD_CACHE_TIME_MS, DASHBOARD_CACHE_QUERIES_PER_PAGE, DIMENSION_CACHE_QUERY_LIMIT } from './dashboardCache';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const clients: ReturnType<typeof createDashboardQueryClient>[] = [];
const client = () => { const value = createDashboardQueryClient(); clients.push(value); return value; };
afterEach(() => { clients.forEach(value => value.clear()); clients.length = 0; vi.useRealTimers(); });

describe('cache limitado de navegação', () => {
  it('reaproveita dados frescos sem HTTP e mantém os vencidos visíveis ao atualizar após seis minutos', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const c = client();
    const queryFn = vi.fn(async () => ({ total: 42 }));
    const options = { queryKey: ['coletas', 'overview', { filial: 'CWB' }], queryFn };
    await c.fetchQuery(options);
    const first = new QueryObserver(c, options);
    const stop = first.subscribe(() => undefined);
    expect(first.getCurrentResult()).toMatchObject({ data: { total: 42 }, isLoading: false, isFetching: false });
    expect(queryFn).toHaveBeenCalledTimes(1);
    stop();
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(c.getQueryData(options.queryKey)).toEqual({ total: 42 });
    let finish!: (value: { total: number }) => void;
    const second = new QueryObserver(c, { ...options, queryFn: () => new Promise<{ total: number }>(resolve => { finish = resolve; }) });
    const stopSecond = second.subscribe(() => undefined);
    expect(second.getCurrentResult()).toMatchObject({ data: { total: 42 }, isLoading: false, isFetching: true });
    finish({ total: 43 });
    await flush();
    expect(second.getCurrentResult().data).toEqual({ total: 43 });
    stopSecond();
    await vi.advanceTimersByTimeAsync(DASHBOARD_CACHE_TIME_MS + 1);
    expect(c.getQueryData(options.queryKey)).toBeUndefined();
  });

  it('retém as cinco páginas usadas mais recentemente e agrupa aliases de faturamento', async () => {
    const c = client();
    for (const domain of ['coletas', 'tracking', 'faturamento', 'manifestos', 'cotacoes']) {
      c.setQueryData([domain, 'overview'], { total: 1 });
      await flush();
    }
    const observer = new QueryObserver(c, { queryKey: ['coletas', 'overview'], enabled: false });
    const stop = observer.subscribe(() => undefined);
    stop();
    c.setQueryData(['fretes', 'serie'], []);
    c.setQueryData(['performance', 'overview'], {});
    await flush();
    expect(c.getQueryData(['tracking', 'overview'])).toBeUndefined();
    expect(c.getQueryData(['coletas', 'overview'])).toEqual({ total: 1 });
    expect(c.getQueryData(['faturamento', 'overview'])).toEqual({ total: 1 });
    expect(c.getQueryData(['fretes', 'serie'])).toEqual([]);
  });

  it('limita combinações de filtros, páginas de tabela e dimensões sem remover consultas observadas', async () => {
    const c = client();
    c.setQueryData(['coletas', 'overview'], { total: 5 });
    const observer = new QueryObserver(c, { queryKey: ['coletas', 'overview'], enabled: false });
    const stop = observer.subscribe(() => undefined);
    for (let i = 0; i < 100; i++) {
      c.setQueryData(['coletas', 'tabela', i], [i]);
      c.setQueryData(['dim', 'pagadores', String(i)], [i]);
    }
    await flush();
    expect(c.getQueryCache().findAll({ queryKey: ['coletas'] })).toHaveLength(DASHBOARD_CACHE_QUERIES_PER_PAGE + 1);
    expect(c.getQueryCache().findAll({ queryKey: ['dim'] })).toHaveLength(DIMENSION_CACHE_QUERY_LIMIT);
    expect(c.getQueryData(['coletas', 'overview'])).toEqual({ total: 5 });
    expect(c.getQueryData(['coletas', 'tabela', 0])).toBeUndefined();
    expect(c.getQueryData(['coletas', 'tabela', 99])).toEqual([99]);
    stop();
  });

  it('limpa dados e cancela respostas antigas quando a sessão perde seu escopo', async () => {
    const c = client();
    let finish!: (value: string) => void;
    let signal!: AbortSignal;
    const request = c.fetchQuery({ queryKey: ['coletas', 'overview'], queryFn: context => {
      signal = context.signal;
      return new Promise<string>(resolve => { finish = resolve; });
    } }).catch(() => undefined);
    c.setQueryData(['admin', 'usuarios'], ['privado']);
    c.clear();
    expect(signal.aborted).toBe(true);
    finish('resposta da sessão anterior');
    await request;
    await flush();
    expect(c.getQueryCache().getAll()).toHaveLength(0);
  });
});
