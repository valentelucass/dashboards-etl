import { useQuery } from '@tanstack/react-query';
import {
  buscarCotacoesGraficos,
  buscarCotacoesOverview,
  buscarCotacoesResumoCliente,
  buscarCotacoesResumoFilial,
  buscarCotacoesResumoUsuario,
  buscarCotacoesSerie,
  buscarCotacoesTabela,
  buscarCotacoesTabelaPaginada,
  buscarCotacoesTabelaTotal,
} from '../../api/endpoints/cotacoesServico';
import type { CotacoesFiltro } from '../../types/cotacoes';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

function hasPeriodoValido(filtro: CotacoesFiltro) {
  return Boolean(filtro.dataInicio && filtro.dataFim);
}

export function useCotacoesOverview(filtro: CotacoesFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'overview', filtro],
    queryFn: ({ signal }) => buscarCotacoesOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useCotacoesSerie(filtro: CotacoesFiltro, enabled = true, chartKey: 'cotacoesSerie' | 'cotacoesTaxasConversao' = 'cotacoesSerie') {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'serie', filtro],
    queryFn: ({ signal }) => buscarCotacoesSerie(filtro, signal, chartKey),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCotacoesGraficos(filtro: CotacoesFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'graficos', filtro],
    queryFn: ({ signal }) => buscarCotacoesGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCotacoesTabela(filtro: CotacoesFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarCotacoesTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCotacoesResumoUsuario(filtro: CotacoesFiltro, isActive: boolean) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'resumo', 'usuario', filtro],
    queryFn: ({ signal }) => buscarCotacoesResumoUsuario(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled: isActive && hasPeriodoValido(filtro),
  });
}

export function useCotacoesResumoFilial(filtro: CotacoesFiltro, isActive: boolean) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'resumo', 'filial', filtro],
    queryFn: ({ signal }) => buscarCotacoesResumoFilial(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled: isActive && hasPeriodoValido(filtro),
  });
}

export function useCotacoesResumoCliente(filtro: CotacoesFiltro, isActive: boolean) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'resumo', 'cliente', filtro],
    queryFn: ({ signal }) => buscarCotacoesResumoCliente(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled: isActive && hasPeriodoValido(filtro),
  });
}

export function useCotacoesTabelaTotal(filtro: CotacoesFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarCotacoesTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCotacoesTabelaPaginada(
  filtro: CotacoesFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['cotacoes', 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarCotacoesTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}
