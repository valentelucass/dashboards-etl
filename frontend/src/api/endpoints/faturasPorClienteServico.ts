import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type {
  FaturaPorClienteResumoRow,
  FaturasPorClienteAgingBucket,
  FaturasPorClienteAgingEscopo,
  FaturasPorClienteDrilldownNivel,
  FaturasPorClienteDrilldownPoint,
  FaturasPorClienteFiltro,
  FaturasPorClienteGranularidade,
  FaturasPorClienteMensalTrend,
  FaturasPorClienteMetrica,
  FaturasPorClienteOverview,
  FaturasPorClienteReferenciaTemporal,
  FaturasPorClienteSerie,
  FaturasPorClienteStatusEvolucao,
  FaturasPorClienteStatusProcesso,
  FaturasPorClienteTopCliente,
} from '../../types/faturasPorCliente';
import type { TableApiFilters } from '../../types/tableFilters';

export async function buscarFaturasPorClienteOverview(
  filtro: FaturasPorClienteFiltro,
  signal?: AbortSignal,
): Promise<FaturasPorClienteOverview> {
  const { data } = await clienteAxios.get<FaturasPorClienteOverview>('/api/painel/faturas-por-cliente', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarFaturasPorClienteMensal(
  filtro: FaturasPorClienteFiltro,
  signal?: AbortSignal,
): Promise<FaturasPorClienteMensalTrend[]> {
  const { data } = await clienteAxios.get<FaturasPorClienteMensalTrend[]>('/api/painel/faturas-por-cliente/mensal', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarFaturasPorClienteSerie(
  filtro: FaturasPorClienteFiltro,
  granularidade: FaturasPorClienteGranularidade,
  referencia: FaturasPorClienteReferenciaTemporal,
  metrica: FaturasPorClienteMetrica,
  signal?: AbortSignal,
): Promise<FaturasPorClienteSerie[]> {
  const params = montarQueryParams(filtro);
  params.set('granularidade', granularidade);
  params.set('referencia', referencia);
  params.set('metrica', metrica);
  const { data } = await clienteAxios.get<FaturasPorClienteSerie[]>('/api/painel/faturas-por-cliente/serie', { signal, params });
  return data;
}

export async function buscarFaturasPorClienteAging(
  filtro: FaturasPorClienteFiltro,
  escopo: FaturasPorClienteAgingEscopo = 'todos',
  signal?: AbortSignal,
): Promise<FaturasPorClienteAgingBucket[]> {
  const params = montarQueryParams(filtro);
  params.set('escopo', escopo);
  const { data } = await clienteAxios.get<FaturasPorClienteAgingBucket[]>('/api/painel/faturas-por-cliente/aging', {
    signal,
    params,
  });
  return data;
}

export async function buscarFaturasPorClienteAgingDrilldown(
  filtro: FaturasPorClienteFiltro,
  faixa: string,
  nivel: FaturasPorClienteDrilldownNivel,
  cliente?: string | null,
  signal?: AbortSignal,
): Promise<FaturasPorClienteDrilldownPoint[]> {
  const params = montarQueryParams(filtro);
  params.set('faixa', faixa);
  params.set('nivel', nivel);
  if (cliente) params.set('cliente', cliente);
  const { data } = await clienteAxios.get<FaturasPorClienteDrilldownPoint[]>('/api/painel/faturas-por-cliente/aging/drilldown', { signal, params });
  return data;
}

export async function buscarFaturasPorClienteTopClientes(
  filtro: FaturasPorClienteFiltro,
  limite = 10,
  signal?: AbortSignal,
): Promise<FaturasPorClienteTopCliente[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<FaturasPorClienteTopCliente[]>('/api/painel/faturas-por-cliente/top-clientes', {
    signal,
    params,
  });
  return data;
}

export async function buscarFaturasPorClienteTopClientesDrilldown(
  filtro: FaturasPorClienteFiltro,
  limite: 5 | 10 | 15,
  metrica: FaturasPorClienteMetrica,
  nivel: FaturasPorClienteDrilldownNivel,
  cliente?: string | null,
  cnpj?: string | null,
  signal?: AbortSignal,
): Promise<FaturasPorClienteDrilldownPoint[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  params.set('metrica', metrica);
  params.set('nivel', nivel);
  if (cliente) params.set('cliente', cliente);
  if (cnpj) params.set('cnpj', cnpj);
  const { data } = await clienteAxios.get<FaturasPorClienteDrilldownPoint[]>('/api/painel/faturas-por-cliente/top-clientes/drilldown', { signal, params });
  return data;
}

export async function buscarFaturasPorClienteStatusProcesso(
  filtro: FaturasPorClienteFiltro,
  signal?: AbortSignal,
): Promise<FaturasPorClienteStatusProcesso[]> {
  const { data } = await clienteAxios.get<FaturasPorClienteStatusProcesso[]>('/api/painel/faturas-por-cliente/status-processo', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarFaturasPorClienteStatusEvolucao(
  filtro: FaturasPorClienteFiltro,
  granularidade: FaturasPorClienteGranularidade,
  signal?: AbortSignal,
): Promise<FaturasPorClienteStatusEvolucao[]> {
  const params = montarQueryParams(filtro);
  params.set('granularidade', granularidade);
  const { data } = await clienteAxios.get<FaturasPorClienteStatusEvolucao[]>('/api/painel/faturas-por-cliente/status-processo/evolucao', { signal, params });
  return data;
}

export async function buscarFaturasPorClienteTabela(
  filtro: FaturasPorClienteFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<FaturaPorClienteResumoRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<FaturaPorClienteResumoRow[]>('/api/painel/faturas-por-cliente/tabela', {
    signal,
    params,
  });
  return data;
}

export async function buscarFaturasPorClienteTabelaTotal(filtro: FaturasPorClienteFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/faturas-por-cliente/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarFaturasPorClienteTabelaPaginada(
  filtro: FaturasPorClienteFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<FaturaPorClienteResumoRow>> {
  return buscarTabelaPaginada('/api/painel/faturas-por-cliente/tabela/paginada', filtro, pagina, tamanhoPagina, filtrosTabela, undefined, undefined, signal);
}

export async function exportarFaturasPorClienteCsv(filtro: FaturasPorClienteFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/faturas-por-cliente/exportacao', filtro, 'faturas-por-cliente', filtrosTabela);
}
