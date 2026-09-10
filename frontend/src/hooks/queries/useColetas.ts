import { useQuery } from '@tanstack/react-query';
import {
  buscarColetasCidadesOrigem,
  buscarColetasGraficos,
  buscarColetasStatus,
  buscarColetasOperacao,
  buscarColetasHistoricoPerformance,
  buscarColetasOverview,
  buscarColetasSerie,
  buscarColetasTabela,
  buscarColetasTabelaPaginada,
  buscarColetasTabelaTotal,
} from '../../api/endpoints/coletasServico';
import type { ColetasFiltro, ColetasHistoricoPeriodo } from '../../types/coletas';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

export function useColetasOverview(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'overview', filtro],
    queryFn: ({ signal }) => buscarColetasOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasSerie(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'serie', filtro],
    queryFn: ({ signal }) => buscarColetasSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasGraficos(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'graficos', filtro],
    queryFn: ({ signal }) => buscarColetasGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasStatus(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'status', filtro],
    queryFn: ({ signal }) => buscarColetasStatus(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasOperacao(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'operacao', filtro],
    queryFn: ({ signal }) => buscarColetasOperacao(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasHistoricoPerformance(
  filtro: ColetasFiltro,
  historicoPeriodo: ColetasHistoricoPeriodo = 'dias',
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'graficos', 'historico-performance', filtro, historicoPeriodo],
    queryFn: ({ signal }) => buscarColetasHistoricoPerformance(filtro, historicoPeriodo, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasCidadesOrigem(filtro: ColetasFiltro, regiaoLogistica: string | null) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'graficos', 'cidades-origem', filtro, regiaoLogistica],
    queryFn: ({ signal }) => buscarColetasCidadesOrigem(filtro, regiaoLogistica ?? '', signal),
    enabled: Boolean(regiaoLogistica),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasTabela(filtro: ColetasFiltro, limite = 100) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarColetasTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasTabelaTotal(filtro: ColetasFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarColetasTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useColetasTabelaPaginada(
  filtro: ColetasFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['coletas', 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarColetasTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
  });
}
