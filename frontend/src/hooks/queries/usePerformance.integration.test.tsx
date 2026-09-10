// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import axios, { CanceledError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import clienteAxios from '../../api/clienteAxios';
import { createDashboardRequestAdapter } from '../../api/dashboardRequestQueue';
import { usePerformanceHistorico, usePerformanceStatus, usePerformanceTabelaPaginada } from './usePerformance';

const originalAdapter = clienteAxios.defaults.adapter;
const filtro = { dataInicio: '2026-08-01', dataFim: '2026-08-31', filiais: ['CWB'] };
let client: QueryClient;
afterEach(() => { cleanup(); client?.clear(); clienteAxios.defaults.adapter = originalAdapter; });
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
function install(adapter: AxiosAdapter) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clienteAxios.defaults.adapter = createDashboardRequestAdapter(adapter);
}
const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ config, data, status: 200, statusText: 'OK', headers: {} });

describe('hooks, QueryClient e transporte Axios juntos', () => {
  it('aborta o filtro anterior e apresenta somente a resposta do novo filtro', async () => {
    const requests: Array<{ config: InternalAxiosRequestConfig; finish: (data: unknown) => void }> = [];
    install((config) => new Promise<AxiosResponse>((resolve, reject) => {
      requests.push({ config, finish: (data) => resolve(response(config, data)) });
      config.signal?.addEventListener?.('abort', () => reject(new CanceledError()), { once: true });
    }));
    const hook = renderHook(({ filial }) => usePerformanceStatus({ ...filtro, filiais: [filial] }), { wrapper, initialProps: { filial: 'CWB' } });
    await waitFor(() => expect(requests).toHaveLength(1));
    hook.rerender({ filial: 'SPO' });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].config.signal?.aborted).toBe(true);
    await act(async () => requests[1].finish([{ status: 'Finalizada', total: 7 }]));
    await waitFor(() => expect(hook.result.current.data?.[0].total).toBe(7));
    requests[0].finish([{ status: 'Finalizada', total: 999 }]);
    expect(hook.result.current.data?.[0].total).toBe(7);
  });

  it('deduplica consumidores e preserva a consulta enquanto outro consumidor está montado', async () => {
    let finish!: () => void;
    let signal: InternalAxiosRequestConfig['signal'];
    const transport = vi.fn<AxiosAdapter>((config) => new Promise<AxiosResponse>((resolve) => {
      signal = config.signal; finish = () => resolve(response(config, []));
    }));
    install(transport);
    const first = renderHook(() => usePerformanceStatus(filtro), { wrapper });
    const second = renderHook(() => usePerformanceStatus(filtro), { wrapper });
    await waitFor(() => expect(transport).toHaveBeenCalledOnce());
    first.unmount();
    expect(signal?.aborted).toBe(false);
    await act(async () => finish());
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));
  });

  it('não envia queries desabilitadas e transmite cancelamento da tabela na desmontagem', async () => {
    let captured: InternalAxiosRequestConfig | undefined;
    install((config) => new Promise<AxiosResponse>((_resolve, reject) => {
      captured = config;
      config.signal?.addEventListener?.('abort', () => reject(new CanceledError()), { once: true });
    }));
    const hook = renderHook(({ enabled }) => usePerformanceTabelaPaginada(filtro, 1, 10, undefined, enabled), { wrapper, initialProps: { enabled: false } });
    await act(async () => undefined);
    expect(captured).toBeUndefined();
    hook.rerender({ enabled: true });
    await waitFor(() => expect(captured).toBeDefined());
    hook.unmount();
    expect(captured?.signal?.aborted).toBe(true);
  });

  it('histórico de outro parceiro é consultado mesmo com cache fresco', async () => {
    const transport = vi.fn<AxiosAdapter>(async (config) => response(config, []));
    install(transport);
    const hook = renderHook(({ parceiro }) => usePerformanceHistorico({ ...filtro, parceirosLogisticos: [parceiro] }, 3), { wrapper, initialProps: { parceiro: 'A' } });
    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    hook.rerender({ parceiro: 'B' });
    await waitFor(() => expect(transport).toHaveBeenCalledTimes(2));
    expect((transport.mock.calls[1][0].params as URLSearchParams).getAll('f.parceirosLogisticos')).toEqual(['B']);
    expect(axios.isCancel(hook.result.current.error)).toBe(false);
  });
});
