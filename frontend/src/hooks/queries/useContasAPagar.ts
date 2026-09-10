import { useQuery } from '@tanstack/react-query';
import {
  buscarContasAPagarGraficos,
  buscarContasAPagarDrilldownCentroCusto,
  buscarContasAPagarDrilldownFornecedores,
  buscarContasAPagarOverview,
  buscarContasAPagarSerie,
  buscarContasAPagarTabela,
  buscarContasAPagarTabelaPaginada,
  buscarContasAPagarTabelaTotal,
} from '../../api/endpoints/contasAPagarServico';
import type { ContasAPagarDrilldownRequest, ContasAPagarFiltro, ContasAPagarGranularidade, ContasAPagarReferenciaTemporal } from '../../types/contasAPagar';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

export function useContasAPagarOverview(filtro: ContasAPagarFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'overview', filtro],
    queryFn: ({ signal }) => buscarContasAPagarOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarSerie(
  filtro: ContasAPagarFiltro,
  granularidade: ContasAPagarGranularidade = 'mes',
  referencia: ContasAPagarReferenciaTemporal = 'emissao',
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'serie', filtro, granularidade, referencia],
    queryFn: ({ signal }) => buscarContasAPagarSerie(filtro, granularidade, referencia, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarDrilldownFornecedores(filtro: ContasAPagarFiltro, request: ContasAPagarDrilldownRequest) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'graficos', 'fornecedores', filtro, request],
    queryFn: ({ signal }) => buscarContasAPagarDrilldownFornecedores(filtro, request, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarDrilldownCentroCusto(filtro: ContasAPagarFiltro, request: ContasAPagarDrilldownRequest) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'graficos', 'centros-custo', filtro, request],
    queryFn: ({ signal }) => buscarContasAPagarDrilldownCentroCusto(filtro, request, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarGraficos(filtro: ContasAPagarFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'graficos', filtro],
    queryFn: ({ signal }) => buscarContasAPagarGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarTabela(filtro: ContasAPagarFiltro, limite = 100) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarContasAPagarTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarTabelaTotal(filtro: ContasAPagarFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarContasAPagarTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useContasAPagarTabelaPaginada(
  filtro: ContasAPagarFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['contas-a-pagar', 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarContasAPagarTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
  });
}
