import clienteAxios from '../clienteAxios';
import { montarQueryParams } from './queryParams';
import type { ExecutivoOverview, ExecutivoResumoFinanceiro, ExecutivoTrendPoint } from '../../types/executivo';
import type { FiltroQuery } from '../../types/common';

export async function buscarExecutivoOverview(filtro: FiltroQuery, signal?: AbortSignal): Promise<ExecutivoOverview> {
  const { data } = await clienteAxios.get<ExecutivoOverview>('/api/painel/executivo', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarExecutivoSerie(filtro: FiltroQuery, signal?: AbortSignal): Promise<ExecutivoTrendPoint[]> {
  const { data } = await clienteAxios.get<ExecutivoTrendPoint[]>('/api/painel/executivo/serie', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarExecutivoResumoFinanceiro(filtro: FiltroQuery, signal?: AbortSignal): Promise<ExecutivoResumoFinanceiro[]> {
  const { data } = await clienteAxios.get<ExecutivoResumoFinanceiro[]>('/api/painel/executivo/resumo-financeiro', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}
