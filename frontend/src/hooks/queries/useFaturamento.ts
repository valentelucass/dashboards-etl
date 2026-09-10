import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  buscarFaturamentoGraficos,
  buscarFaturamentoMetas,
  buscarFaturamentoMetasConfiguracoes,
  buscarFaturamentoMixDocumental,
  buscarFaturamentoOverview,
  buscarFaturamentoSerie,
  buscarFaturamentoTabela,
  buscarFaturamentoTabelaPaginada,
  buscarFaturamentoTabelaTotal,
  buscarFaturamentoTopClientes,
  replicarFaturamentoMetasConfiguracoes,
  removerFaturamentoMetaConfiguracao,
  salvarFaturamentoMetaConfiguracao,
} from '../../api/endpoints/faturamentoServico';
import type {
  FaturamentoFiltro,
  FaturamentoGoalConfigPayload,
  FaturamentoGoalReplicarPayload,
} from '../../types/faturamento';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;
const QUERY_KEY = ['faturamento'];

export function useFaturamentoOverview(filtro: FaturamentoFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'overview', filtro],
    queryFn: ({ signal }) => buscarFaturamentoOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useFaturamentoSerie(filtro: FaturamentoFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'serie', filtro],
    queryFn: ({ signal }) => buscarFaturamentoSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoTopClientes(filtro: FaturamentoFiltro, limite = 10, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'top-clientes', filtro, limite],
    queryFn: ({ signal }) => buscarFaturamentoTopClientes(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoMixDocumental(filtro: FaturamentoFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'mix-documental', filtro],
    queryFn: ({ signal }) => buscarFaturamentoMixDocumental(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoGraficos(filtro: FaturamentoFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'graficos', filtro],
    queryFn: ({ signal }) => buscarFaturamentoGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoMetas(filtro: FaturamentoFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'metas', filtro],
    queryFn: ({ signal }) => buscarFaturamentoMetas(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoMetasConfiguracoes(ano: number, mes: number, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEY, 'metas-configuracoes', ano, mes],
    queryFn: ({ signal }) => buscarFaturamentoMetasConfiguracoes(ano, mes, signal),
    staleTime: STALE_TIME,
    retry: false,
    enabled,
  });
}

export function useSalvarFaturamentoMetaConfiguracao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FaturamentoGoalConfigPayload) => salvarFaturamentoMetaConfiguracao(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useReplicarFaturamentoMetasConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: FaturamentoGoalReplicarPayload) => replicarFaturamentoMetasConfiguracoes(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useRemoverFaturamentoMetaConfiguracao() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, ano, mes }: { branchId: string; ano: number; mes: number }) => removerFaturamentoMetaConfiguracao(branchId, ano, mes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useFaturamentoTabela(filtro: FaturamentoFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarFaturamentoTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoTabelaTotal(filtro: FaturamentoFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarFaturamentoTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useFaturamentoTabelaPaginada(
  filtro: FaturamentoFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarFaturamentoTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}
