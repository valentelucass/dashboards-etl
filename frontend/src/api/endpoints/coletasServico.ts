import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type { ColetaResumoRow, ColetasCharts, ColetasCidadeOrigem, ColetasFiltro, ColetasHistoricoPerformance, ColetasHistoricoPeriodo, ColetasOverview, ColetasStatusDistribuicao, ColetasTrendPoint } from '../../types/coletas';
import type { TableApiFilters } from '../../types/tableFilters';

export async function buscarColetasOverview(filtro: ColetasFiltro, signal?: AbortSignal): Promise<ColetasOverview> {
  const { data } = await clienteAxios.get<ColetasOverview>('/api/painel/coletas', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarColetasSerie(filtro: ColetasFiltro, signal?: AbortSignal): Promise<ColetasTrendPoint[]> {
  const { data } = await clienteAxios.get<ColetasTrendPoint[]>('/api/painel/coletas/serie', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarColetasGraficos(filtro: ColetasFiltro, signal?: AbortSignal): Promise<ColetasCharts> {
  const { data } = await clienteAxios.get<ColetasCharts>('/api/painel/coletas/graficos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarColetasStatus(filtro: ColetasFiltro, signal?: AbortSignal): Promise<ColetasStatusDistribuicao[]> {
  const { data } = await clienteAxios.get<ColetasStatusDistribuicao[]>('/api/painel/coletas/graficos/status', { params: montarQueryParams(filtro), signal });
  return data;
}

export async function buscarColetasOperacao(filtro: ColetasFiltro, signal?: AbortSignal): Promise<Pick<ColetasCharts, 'regioesOrigem' | 'agingAbertas'>> {
  const { data } = await clienteAxios.get<Pick<ColetasCharts, 'regioesOrigem' | 'agingAbertas'>>('/api/painel/coletas/graficos/operacao', { params: montarQueryParams(filtro), signal });
  return data;
}

export async function buscarColetasHistoricoPerformance(
  filtro: ColetasFiltro,
  periodo: ColetasHistoricoPeriodo = 'dias',
  signal?: AbortSignal,
): Promise<ColetasHistoricoPerformance[]> {
  const params = montarQueryParams(filtro);
  params.set('periodo', periodo);
  const { data } = await clienteAxios.get<ColetasHistoricoPerformance[]>('/api/painel/coletas/graficos/historico-performance', {
    signal,
    params,
  });
  return data;
}

export async function buscarColetasCidadesOrigem(filtro: ColetasFiltro, regiaoLogistica: string, signal?: AbortSignal): Promise<ColetasCidadeOrigem[]> {
  const params = montarQueryParams(filtro);
  params.set('regiaoLogistica', regiaoLogistica);
  const { data } = await clienteAxios.get<ColetasCidadeOrigem[]>('/api/painel/coletas/graficos/cidades', {
    signal,
    params,
  });
  return data;
}

export async function buscarColetasTabela(
  filtro: ColetasFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<ColetaResumoRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<ColetaResumoRow[]>('/api/painel/coletas/tabela', { signal, params });
  return data;
}

export async function buscarColetasTabelaTotal(filtro: ColetasFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/coletas/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarColetasTabelaPaginada(
  filtro: ColetasFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<ColetaResumoRow>> {
  return buscarTabelaPaginada('/api/painel/coletas/tabela/paginada', filtro, pagina, tamanhoPagina, filtrosTabela, undefined, undefined, signal);
}

export async function exportarColetasCsv(filtro: ColetasFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/coletas/exportacao', filtro, 'coletas', filtrosTabela);
}
