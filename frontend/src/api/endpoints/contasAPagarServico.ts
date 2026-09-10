import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type {
  ContaPagarResumoRow,
  ContasAPagarCharts,
  ContasAPagarDrilldownPoint,
  ContasAPagarDrilldownRequest,
  ContasAPagarFiltro,
  ContasAPagarGranularidade,
  ContasAPagarMensalTrend,
  ContasAPagarOverview,
  ContasAPagarReferenciaTemporal,
} from '../../types/contasAPagar';
import type { TableApiFilters } from '../../types/tableFilters';

export async function buscarContasAPagarOverview(filtro: ContasAPagarFiltro, signal?: AbortSignal): Promise<ContasAPagarOverview> {
  const { data } = await clienteAxios.get<ContasAPagarOverview>('/api/painel/contas-a-pagar', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarContasAPagarSerie(
  filtro: ContasAPagarFiltro,
  granularidade: ContasAPagarGranularidade = 'mes',
  referencia: ContasAPagarReferenciaTemporal = 'emissao',
  signal?: AbortSignal,
): Promise<ContasAPagarMensalTrend[]> {
  const params = montarQueryParams(filtro);
  params.set('granularidade', granularidade);
  params.set('referencia', referencia);
  const { data } = await clienteAxios.get<ContasAPagarMensalTrend[]>('/api/painel/contas-a-pagar/serie', {
    signal,
    params,
  });
  return data;
}

export async function buscarContasAPagarGraficos(filtro: ContasAPagarFiltro, signal?: AbortSignal): Promise<ContasAPagarCharts> {
  const { data } = await clienteAxios.get<ContasAPagarCharts>('/api/painel/contas-a-pagar/graficos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarContasAPagarDrilldownFornecedores(
  filtro: ContasAPagarFiltro,
  request: ContasAPagarDrilldownRequest,
  signal?: AbortSignal,
): Promise<ContasAPagarDrilldownPoint[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(request.limite));
  params.set('metrica', request.metrica);
  params.set('nivel', request.nivel);
  if (request.fornecedor) params.set('fornecedor', request.fornecedor);
  if (request.classificacao) params.set('classificacao', request.classificacao);
  const { data } = await clienteAxios.get<ContasAPagarDrilldownPoint[]>('/api/painel/contas-a-pagar/graficos/fornecedores', { signal, params });
  return data;
}

export async function buscarContasAPagarDrilldownCentroCusto(
  filtro: ContasAPagarFiltro,
  request: ContasAPagarDrilldownRequest,
  signal?: AbortSignal,
): Promise<ContasAPagarDrilldownPoint[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(request.limite));
  params.set('metrica', request.metrica);
  params.set('nivel', request.nivel);
  if (request.centroCusto) params.set('centroCusto', request.centroCusto);
  if (request.classificacao) params.set('classificacao', request.classificacao);
  const { data } = await clienteAxios.get<ContasAPagarDrilldownPoint[]>('/api/painel/contas-a-pagar/graficos/centros-custo', { signal, params });
  return data;
}

export async function buscarContasAPagarTabela(
  filtro: ContasAPagarFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<ContaPagarResumoRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<ContaPagarResumoRow[]>('/api/painel/contas-a-pagar/tabela', { signal, params });
  return data;
}

export async function buscarContasAPagarTabelaTotal(filtro: ContasAPagarFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/contas-a-pagar/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarContasAPagarTabelaPaginada(
  filtro: ContasAPagarFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<ContaPagarResumoRow>> {
  return buscarTabelaPaginada('/api/painel/contas-a-pagar/tabela/paginada', filtro, pagina, tamanhoPagina, filtrosTabela, undefined, undefined, signal);
}

export async function exportarContasAPagarCsv(filtro: ContasAPagarFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/contas-a-pagar/exportacao', filtro, 'contas-a-pagar', filtrosTabela);
}
