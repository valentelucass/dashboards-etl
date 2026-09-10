import type { PaginacaoResponse } from '../../types/common';
import type {
  FaturamentoCharts,
  FaturamentoClienteRanking,
  FaturamentoDocumentMix,
  FaturamentoFiltro,
  FaturamentoGoalConfig,
  FaturamentoGoalConfigPayload,
  FaturamentoGoalReplicarPayload,
  FaturamentoGoalSummary,
  FaturamentoOverview,
  FaturamentoResumoRow,
  FaturamentoTrendPoint,
} from '../../types/faturamento';
import type { TableApiFilters } from '../../types/tableFilters';
import {
  buscarFretesGraficos,
  buscarFretesMetas,
  buscarFretesMetasConfiguracoes,
  buscarFretesMixDocumental,
  buscarFretesOverview,
  buscarFretesSerie,
  buscarFretesTabela,
  buscarFretesTabelaPaginada,
  buscarFretesTabelaTotal,
  buscarFretesTopClientes,
  exportarFretesCsv,
  replicarFretesMetasConfiguracoes,
  removerFretesMetaConfiguracao,
  salvarFretesMetaConfiguracao,
} from './fretesServico';

export const FATURAMENTO_LEGACY_API_BASE = '/api/painel/fretes';

export function mapFretesOverviewToFaturamento(data: FaturamentoOverview): FaturamentoOverview {
  return { ...data };
}

export async function buscarFaturamentoOverview(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<FaturamentoOverview> {
  return mapFretesOverviewToFaturamento(await buscarFretesOverview(filtro, signal));
}

export async function buscarFaturamentoSerie(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<FaturamentoTrendPoint[]> {
  return buscarFretesSerie(filtro, signal);
}

export async function buscarFaturamentoTopClientes(
  filtro: FaturamentoFiltro,
  limite = 10,
  signal?: AbortSignal,
): Promise<FaturamentoClienteRanking[]> {
  return buscarFretesTopClientes(filtro, limite, signal);
}

export async function buscarFaturamentoMixDocumental(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<FaturamentoDocumentMix[]> {
  return buscarFretesMixDocumental(filtro, signal);
}

export async function buscarFaturamentoGraficos(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<FaturamentoCharts> {
  return buscarFretesGraficos(filtro, signal);
}

export async function buscarFaturamentoMetas(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<FaturamentoGoalSummary> {
  return buscarFretesMetas(filtro, signal);
}

export async function buscarFaturamentoMetasConfiguracoes(ano: number, mes: number, signal?: AbortSignal): Promise<FaturamentoGoalConfig[]> {
  return buscarFretesMetasConfiguracoes(ano, mes, signal);
}

export async function salvarFaturamentoMetaConfiguracao(payload: FaturamentoGoalConfigPayload): Promise<FaturamentoGoalConfig> {
  return salvarFretesMetaConfiguracao(payload);
}

export async function replicarFaturamentoMetasConfiguracoes(
  payload: FaturamentoGoalReplicarPayload,
): Promise<FaturamentoGoalConfig[]> {
  return replicarFretesMetasConfiguracoes(payload);
}

export async function removerFaturamentoMetaConfiguracao(branchId: string, ano: number, mes: number): Promise<void> {
  await removerFretesMetaConfiguracao(branchId, ano, mes);
}

export async function buscarFaturamentoTabela(
  filtro: FaturamentoFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<FaturamentoResumoRow[]> {
  return buscarFretesTabela(filtro, limite, signal);
}

export async function buscarFaturamentoTabelaTotal(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<number> {
  return buscarFretesTabelaTotal(filtro, signal);
}

export async function buscarFaturamentoTabelaPaginada(
  filtro: FaturamentoFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<FaturamentoResumoRow>> {
  return buscarFretesTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal);
}

export async function exportarFaturamentoCsv(filtro: FaturamentoFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await exportarFretesCsv(filtro, filtrosTabela);
}
