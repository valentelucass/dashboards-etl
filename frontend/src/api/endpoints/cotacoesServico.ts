import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type {
  CotacaoResumoRow,
  CotacoesCharts,
  CotacoesFiltro,
  CotacoesOverview,
  CotacoesResumoAgregado,
  CotacoesTrendPoint,
} from '../../types/cotacoes';
import type { TableApiFilters } from '../../types/tableFilters';

export async function buscarCotacoesOverview(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<CotacoesOverview> {
  const { data } = await clienteAxios.get<CotacoesOverview>('/api/painel/cotacoes', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesSerie(filtro: CotacoesFiltro, signal?: AbortSignal, dashboardChartKey: 'cotacoesSerie' | 'cotacoesTaxasConversao' = 'cotacoesSerie'): Promise<CotacoesTrendPoint[]> {
  const { data } = await clienteAxios.get<CotacoesTrendPoint[]>('/api/painel/cotacoes/serie', {
    dashboardChartKey,
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesGraficos(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<CotacoesCharts> {
  const { data } = await clienteAxios.get<CotacoesCharts>('/api/painel/cotacoes/graficos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesTabela(
  filtro: CotacoesFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<CotacaoResumoRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<CotacaoResumoRow[]>('/api/painel/cotacoes/tabela', { signal, params });
  return data;
}

export async function buscarCotacoesResumoUsuario(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<CotacoesResumoAgregado[]> {
  const { data } = await clienteAxios.get<CotacoesResumoAgregado[]>('/api/painel/cotacoes/resumo/usuario', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesResumoFilial(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<CotacoesResumoAgregado[]> {
  const { data } = await clienteAxios.get<CotacoesResumoAgregado[]>('/api/painel/cotacoes/resumo/filial', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesResumoCliente(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<CotacoesResumoAgregado[]> {
  const { data } = await clienteAxios.get<CotacoesResumoAgregado[]>('/api/painel/cotacoes/resumo/cliente', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesTabelaTotal(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/cotacoes/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarCotacoesTabelaPaginada(
  filtro: CotacoesFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<CotacaoResumoRow>> {
  return buscarTabelaPaginada('/api/painel/cotacoes/tabela/paginada', filtro, pagina, tamanhoPagina, filtrosTabela, undefined, undefined, signal);
}

export async function exportarCotacoesCsv(filtro: CotacoesFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/cotacoes/exportacao', filtro, 'cotacoes', filtrosTabela);
}
