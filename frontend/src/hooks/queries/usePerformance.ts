import { useQuery } from '@tanstack/react-query';
import {
  buscarPerformanceAging,
  buscarPerformanceDrilldown,
  buscarPerformanceHistorico,
  buscarPerformanceOverview,
  buscarPerformanceSerieTemporal,
  buscarPerformanceStatus,
  buscarPerformanceTabela,
  buscarPerformanceTabelaPaginada,
} from '../../api/endpoints/performanceServico';
import type { PerformanceDrilldownParams, PerformanceFiltro, PerformanceTempoNivel } from '../../types/performance';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;
const QUERY_KEY = ['performance'];

export function performanceHistoricoQueryKey(filtro: PerformanceFiltro, periodoMeses?: number) {
  return [
    ...QUERY_KEY,
    'historico',
    periodoMeses ?? null,
    filtro.dataInicio,
    filtro.dataFim,
    filtro.filiais ?? [],
    filtro.parceirosLogisticos ?? [],
    filtro.status ?? [],
    filtro.pagadores ?? [],
    filtro.responsaveis ?? [],
    filtro.regioesDestino ?? [],
    filtro.cidadesDestino ?? [],
  ];
}

export function usePerformanceOverview(filtro: PerformanceFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'overview', filtro],
    queryFn: ({ signal }) => buscarPerformanceOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function usePerformanceSerieTemporal(
  filtro: PerformanceFiltro,
  nivel: PerformanceTempoNivel,
  ano?: number | null,
  mes?: number | null,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'serie-temporal', filtro, nivel, ano, mes],
    queryFn: ({ signal }) => buscarPerformanceSerieTemporal(filtro, nivel, ano, mes, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceStatus(filtro: PerformanceFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'status', filtro],
    queryFn: ({ signal }) => buscarPerformanceStatus(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceHistorico(filtro: PerformanceFiltro, periodoMeses?: number, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: performanceHistoricoQueryKey(filtro, periodoMeses),
    queryFn: ({ signal }) => buscarPerformanceHistorico(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceDrilldown(
  filtro: PerformanceFiltro,
  drilldown: PerformanceDrilldownParams,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'drilldown', filtro, drilldown],
    queryFn: ({ signal }) => buscarPerformanceDrilldown(filtro, drilldown, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceAging(filtro: PerformanceFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'aging', filtro],
    queryFn: ({ signal }) => buscarPerformanceAging(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceTabela(
  filtro: PerformanceFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarPerformanceTabela(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceTabelaPaginada(
  filtro: PerformanceFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarPerformanceTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}
