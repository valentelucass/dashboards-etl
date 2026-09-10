// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { CanceledError } from 'axios';
import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import clienteAxios from '../../api/clienteAxios';
import { createDashboardRequestAdapter } from '../../api/dashboardRequestQueue';
import { useFaturamentoOverview, useFaturamentoSerie, useFaturamentoGraficos, useFaturamentoMetas, useFaturamentoTopClientes, useFaturamentoTabelaPaginada } from './useFaturamento';
import { useManifestosPerformance, useManifestosTabelaPaginada } from './useManifestos';
import { useExecutivoOverview, useExecutivoSerie, useExecutivoResumoFinanceiro } from './useExecutivo';
import { useFaturamentoStatus, useFaturamentoResponsaveis, useManifestosClassificacoes } from './useDimensoes';

const originalAdapter = clienteAxios.defaults.adapter;
const filtro = { dataInicio: '2026-08-01', dataFim: '2026-08-30', filiais: ['CWB'] };
let client: QueryClient;
afterEach(() => { cleanup(); client?.clear(); clienteAxios.defaults.adapter = originalAdapter; });
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
const useCases = [
  ['faturamento overview', useFaturamentoOverview], ['faturamento série', useFaturamentoSerie],
  ['faturamento gráficos', useFaturamentoGraficos], ['faturamento metas', useFaturamentoMetas],
  ['faturamento clientes', useFaturamentoTopClientes], ['faturamento status', useFaturamentoStatus],
  ['faturamento responsáveis', useFaturamentoResponsaveis], ['manifestos classificações', useManifestosClassificacoes],
  ['executivo overview', useExecutivoOverview], ['executivo série', useExecutivoSerie],
  ['executivo financeiro', useExecutivoResumoFinanceiro],
] as const;

describe('cancelamento entre hooks reais e Axios', () => {
  it.each(useCases)('%s cancela o filtro antigo e não o envia novamente', async (_name, useCase) => {
    const requests: InternalAxiosRequestConfig[] = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    clienteAxios.defaults.adapter = createDashboardRequestAdapter(config => new Promise<AxiosResponse>((_resolve, reject) => {
      requests.push(config);
      config.signal?.addEventListener?.('abort', () => reject(new CanceledError()), { once: true });
    }));
    const hook = renderHook(({ filial }) => useCase({ ...filtro, filiais: [filial] }), { wrapper, initialProps: { filial: 'CWB' } });
    await waitFor(() => expect(requests).toHaveLength(1));
    hook.rerender({ filial: 'SPO' });
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].signal?.aborted).toBe(true);
    expect((requests[1].params as URLSearchParams).getAll('f.filiais')).toEqual(['SPO']);
    hook.unmount();
    expect(requests[1].signal?.aborted).toBe(true);
  });

  it('descarta três queries de outra página ainda em espera sem chegar ao transporte', async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    clienteAxios.defaults.adapter = createDashboardRequestAdapter(config => new Promise<AxiosResponse>((_resolve, reject) => {
      requests.push(config);
      config.signal?.addEventListener?.('abort', () => reject(new CanceledError()), { once: true });
    }));
    const occupied = renderHook(() => {
      useExecutivoOverview(filtro); useExecutivoSerie(filtro); useExecutivoResumoFinanceiro(filtro);
    }, { wrapper });
    await waitFor(() => expect(requests).toHaveLength(3));
    const queued = renderHook(() => {
      useManifestosPerformance(filtro, 'dia');
      useManifestosTabelaPaginada(filtro, 1, 10);
      useFaturamentoTabelaPaginada(filtro, 1, 10);
    }, { wrapper });
    await act(async () => undefined);
    queued.unmount();
    occupied.unmount();
    await act(async () => undefined);
    expect(requests).toHaveLength(3);
    expect(requests.every(request => request.signal?.aborted)).toBe(true);
  });
});
