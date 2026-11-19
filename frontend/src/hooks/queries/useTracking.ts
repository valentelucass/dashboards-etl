import { useQuery } from '@tanstack/react-query';
import {
  buscarTrackingGraficos,
  buscarTrackingDashboard,
  buscarTrackingDetalhesPaginada,
  buscarTrackingRegioes,
  buscarTrackingFretes,
  buscarTrackingOverview,
  buscarTrackingSerie,
  buscarTrackingTabela,
  buscarTrackingTabelaPaginada,
  buscarTrackingTabelaTotal,
} from '../../api/endpoints/trackingServico';
import type { TrackingFiltro } from '../../types/tracking';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

export function useTrackingOverview(filtro: TrackingFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'overview', filtro],
    queryFn: ({ signal }) => buscarTrackingOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingDashboard(filtro: TrackingFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'dashboard', filtro],
    queryFn: ({ signal }) => buscarTrackingDashboard(filtro, signal),
    enabled,
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingSerie(filtro: TrackingFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'serie', filtro],
    queryFn: ({ signal }) => buscarTrackingSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingGraficos(filtro: TrackingFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'graficos', filtro],
    queryFn: ({ signal }) => buscarTrackingGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingTabela(filtro: TrackingFiltro, limite = 100) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarTrackingTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingTabelaTotal(filtro: TrackingFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarTrackingTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingTabelaPaginada(
  filtro: TrackingFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarTrackingTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingDetalhesPaginada(
  filtro: TrackingFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'detalhes', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarTrackingDetalhesPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    enabled,
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingRegioes(filtro: TrackingFiltro, sigla: string, pagina: number, tamanho: number) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'regioes', filtro, sigla, pagina, tamanho],
    queryFn: ({ signal }) => buscarTrackingRegioes(filtro, sigla, pagina, tamanho, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useTrackingFretes(filtro: TrackingFiltro, sigla: string, regiao: string, pagina: number, tamanho: number) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['tracking', 'fretes', filtro, sigla, regiao, pagina, tamanho],
    queryFn: ({ signal }) => buscarTrackingFretes(filtro, sigla, regiao, pagina, tamanho, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}
