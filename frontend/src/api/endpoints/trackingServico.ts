import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { aplicarFiltrosTabelaParams } from '../tableFilters';
import { buscarTabelaPaginada, normalizarPaginacaoResponse } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type { TrackingCharts, TrackingDashboard, TrackingFiltro, TrackingFrete, TrackingOverview, TrackingRawRow, TrackingRegiao, TrackingTimelinePoint } from '../../types/tracking';
import type { TableApiFilters } from '../../types/tableFilters';

type TrackingApiRow = TrackingRawRow & { pesoTaxado?: number; valorNf?: number };

function normalizarTrackingRow(item: TrackingApiRow): TrackingRawRow {
  return {
    numeroMinuta: item.numeroMinuta,
    dataFrete: item.dataFrete,
    tipo: item.tipo,
    volumes: item.volumes,
    pesoTaxadoRaw: item.pesoTaxadoRaw ?? String(item.pesoTaxado ?? ''),
    valorNfRaw: item.valorNfRaw ?? String(item.valorNf ?? ''),
    valorFrete: item.valorFrete,
    filialEmissora: item.filialEmissora,
    filialOrigem: item.filialOrigem,
    filialAtual: item.filialAtual,
    filialDestino: item.filialDestino,
    regiaoOrigem: item.regiaoOrigem,
    regiaoDestino: item.regiaoDestino,
    classificacao: item.classificacao,
    statusCarga: item.statusCarga,
    previsaoEntrega: item.previsaoEntrega,
  };
}

export async function buscarTrackingClassificacoes(filtro: TrackingFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/tracking/classificacoes', {
    signal, params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarTrackingOverview(filtro: TrackingFiltro, signal?: AbortSignal): Promise<TrackingOverview> {
  const { data } = await clienteAxios.get<TrackingOverview>('/api/painel/tracking', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarTrackingDashboard(filtro: TrackingFiltro, signal?: AbortSignal): Promise<TrackingDashboard> {
  const { data } = await clienteAxios.get<TrackingDashboard>('/api/painel/tracking/dashboard', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarTrackingSerie(filtro: TrackingFiltro, signal?: AbortSignal): Promise<TrackingTimelinePoint[]> {
  const { data } = await clienteAxios.get<TrackingTimelinePoint[]>('/api/painel/tracking/serie', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarTrackingGraficos(filtro: TrackingFiltro, signal?: AbortSignal): Promise<TrackingCharts> {
  const { data } = await clienteAxios.get<TrackingCharts>('/api/painel/tracking/graficos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarTrackingTabela(
  filtro: TrackingFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<TrackingRawRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<TrackingApiRow[]>('/api/painel/tracking/tabela', { signal, params });
  return data.map(normalizarTrackingRow);
}

export async function buscarTrackingTabelaTotal(filtro: TrackingFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/tracking/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarTrackingTabelaPaginada(
  filtro: TrackingFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<TrackingRawRow>> {
  const resposta = await buscarTabelaPaginada<TrackingApiRow, TrackingFiltro>(
    '/api/painel/tracking/tabela/paginada',
    filtro,
    pagina,
    tamanhoPagina,
    filtrosTabela,
    undefined,
    undefined,
    signal,
  );
  return {
    ...resposta,
    conteudo: resposta.conteudo.map(normalizarTrackingRow),
  };
}

export async function buscarTrackingDetalhesPaginada(
  filtro: TrackingFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<TrackingRawRow>> {
  const params = montarQueryParams(filtro);
  aplicarFiltrosTabelaParams(params, filtrosTabela);
  params.set('pagina', String(pagina));
  params.set('tamanhoPagina', String(tamanhoPagina));
  params.set('page', String(pagina));
  params.set('size', String(tamanhoPagina));

  const { data } = await clienteAxios.get<PaginacaoResponse<TrackingApiRow>>('/api/painel/tracking/detalhes', { signal, params });
  const resposta = normalizarPaginacaoResponse(data, pagina, tamanhoPagina);
  return {
    ...resposta,
    conteudo: resposta.conteudo.map(normalizarTrackingRow),
  };
}

export async function exportarTrackingCsv(filtro: TrackingFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/tracking/exportacao', filtro, 'localizacao-cargas', filtrosTabela);
}

export async function buscarTrackingRegioes(filtro: TrackingFiltro, sigla: string, pagina: number, tamanho: number, signal?: AbortSignal) {
  const params = montarQueryParams({ ...filtro, siglaResponsavel: sigla });
  params.set('page', String(pagina));
  params.set('size', String(tamanho));
  const { data } = await clienteAxios.get<PaginacaoResponse<TrackingRegiao>>('/api/painel/tracking/regioes', { params, signal });
  return data;
}

export async function buscarTrackingFretes(filtro: TrackingFiltro, sigla: string, regiao: string, pagina: number, tamanho: number, signal?: AbortSignal) {
  const params = montarQueryParams({ ...filtro, siglaResponsavel: sigla, regiaoDestino: [regiao] });
  params.set('page', String(pagina));
  params.set('size', String(tamanho));
  const { data } = await clienteAxios.get<PaginacaoResponse<TrackingFrete>>('/api/painel/tracking/fretes', { params, signal });
  return data;
}
