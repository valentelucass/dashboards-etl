import { useQuery } from '@tanstack/react-query';
import {
  buscarEtlSaudeEvolucaoInsercoesAtualizacoes,
  buscarEtlSaudeGraficos,
  buscarEtlSaudeOverview,
  buscarEtlSaudeTabela,
  buscarEtlSaudeTabelaPaginada,
  buscarEtlSaudeTabelaTotal,
  buscarEtlSaudeTabelasResumo,
  buscarEtlSaudeTaxasDiarias,
} from '../../api/endpoints/etlSaudeServico';
import type { FiltroQuery } from '../../types/common';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

export function useEtlSaudeOverview(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'overview', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeTaxasDiarias(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'taxas-diarias', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeTaxasDiarias(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeEvolucaoInsercoesAtualizacoes(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'evolucao-insercoes-atualizacoes', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeEvolucaoInsercoesAtualizacoes(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeGraficos(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'graficos', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeTabela(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'tabela', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeTabela(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeTabelasResumo(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'tabelas-resumo', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeTabelasResumo(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeTabelaTotal(filtro: FiltroQuery) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarEtlSaudeTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useEtlSaudeTabelaPaginada(filtro: FiltroQuery, pagina: number, tamanhoPagina: number) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['etl-saude', 'tabela-paginada', filtro, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarEtlSaudeTabelaPaginada(filtro, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}
