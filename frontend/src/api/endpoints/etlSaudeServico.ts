import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { EtlExecucaoRow, EtlInsercoesAtualizacoesPoint, EtlLogExtracaoAuditoriaRow, EtlSaudeCharts, EtlSaudeOverview, EtlTabelaAuditoriaResumoRow, EtlTaxasDiariasPoint } from '../../types/etlSaude';
import type { FiltroQuery, PaginacaoResponse } from '../../types/common';

export async function buscarEtlSaudeOverview(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlSaudeOverview> {
  const { data } = await clienteAxios.get<EtlSaudeOverview>('/api/painel/etl-saude', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarEtlSaudeTaxasDiarias(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlTaxasDiariasPoint[]> {
  const { data } = await clienteAxios.get<EtlTaxasDiariasPoint[]>('/api/painel/etl-saude/serie', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarEtlSaudeEvolucaoInsercoesAtualizacoes(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlInsercoesAtualizacoesPoint[]> {
  const { data } = await clienteAxios.get<EtlInsercoesAtualizacoesPoint[]>('/api/painel/etl-saude/evolucao-insercoes-atualizacoes', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarEtlSaudeGraficos(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlSaudeCharts> {
  const { data } = await clienteAxios.get<EtlSaudeCharts>('/api/painel/etl-saude/graficos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarEtlSaudeTabela(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlLogExtracaoAuditoriaRow[]> {
  const params = montarQueryParams(filtro);
  const { data } = await clienteAxios.get<EtlLogExtracaoAuditoriaRow[]>('/api/painel/etl-saude/tabela', { signal, params });
  return data;
}

export async function buscarEtlSaudeTabelasResumo(filtro: FiltroQuery, signal?: AbortSignal): Promise<EtlTabelaAuditoriaResumoRow[]> {
  const { data } = await clienteAxios.get<EtlTabelaAuditoriaResumoRow[]>('/api/painel/etl-saude/tabelas/resumo', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarEtlSaudeTabelaTotal(filtro: FiltroQuery, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/etl-saude/tabela/total', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data.total;
}

export async function buscarEtlSaudeTabelaPaginada(
  filtro: FiltroQuery,
  pagina: number,
  tamanhoPagina: number,
  signal?: AbortSignal,
): Promise<PaginacaoResponse<EtlExecucaoRow>> {
  return buscarTabelaPaginada('/api/painel/etl-saude/tabela/paginada', filtro, pagina, tamanhoPagina, undefined, undefined, undefined, signal);
}

export async function exportarEtlSaudeCsv(filtro: FiltroQuery): Promise<void> {
  await baixarCsv('/api/painel/etl-saude/exportacao', filtro, 'etl-saude');
}
