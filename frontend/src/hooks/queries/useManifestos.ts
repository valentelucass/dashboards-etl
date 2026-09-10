import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  baixarTemplateManifestosMetas,
  buscarManifestosGraficos,
  buscarManifestosMetas,
  buscarManifestosOverview,
  buscarManifestosPerformance,
  buscarManifestosSerie,
  buscarManifestosTabela,
  buscarManifestosTabelaPaginada,
  buscarManifestosTabelaTotal,
  importarManifestosMetas,
  preValidarManifestosMetasImportacao,
  replicarManifestosMetas,
  removerManifestosMeta,
  salvarManifestosMeta,
} from '../../api/endpoints/manifestosServico';
import type {
  ManifestosCostGoalPayload,
  ManifestosFiltro,
  ManifestosGoalReplicarPayload,
  ManifestosTempoNivel,
} from '../../types/manifestos';
import type { TableApiFilters } from '../../types/tableFilters';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;
const QUERY_KEY = ['manifestos'];
const METAS_QUERY_KEY = ['manifestosMetas'];

export function manifestosMetasQueryKey(branchId: string, mes: number, ano: number) {
  return [...METAS_QUERY_KEY, branchId, mes, ano] as const;
}

export function useManifestosOverview(filtro: ManifestosFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'overview', filtro],
    queryFn: ({ signal }) => buscarManifestosOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosSerie(filtro: ManifestosFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'serie', filtro],
    queryFn: ({ signal }) => buscarManifestosSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosGraficos(filtro: ManifestosFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'graficos', filtro],
    queryFn: ({ signal }) => buscarManifestosGraficos(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosPerformance(
  filtro: ManifestosFiltro,
  nivel: ManifestosTempoNivel,
  ano?: number | null,
  mes?: number | null,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'performance', filtro, nivel, ano, mes],
    queryFn: ({ signal }) => buscarManifestosPerformance(filtro, nivel, ano, mes, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosTabela(filtro: ManifestosFiltro, limite = 100) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarManifestosTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosTabelaTotal(filtro: ManifestosFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela-total', filtro],
    queryFn: ({ signal }) => buscarManifestosTabelaTotal(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosTabelaPaginada(
  filtro: ManifestosFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela, sortField, sortDirection],
    queryFn: ({ signal }) => buscarManifestosTabelaPaginada(
      filtro,
      pagina,
      tamanhoPagina,
      filtrosTabela,
      sortField,
      sortDirection,
      signal,
    ),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useManifestosMetas(branchId: string, ano: number, mes: number, enabled = true) {
  return useQuery({
    queryKey: manifestosMetasQueryKey(branchId, mes, ano),
    queryFn: ({ signal }) => buscarManifestosMetas(branchId, ano, mes, signal),
    staleTime: STALE_TIME,
    retry: false,
    enabled: enabled && Boolean(branchId),
  });
}

export function useSaveManifestosMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManifestosCostGoalPayload) => salvarManifestosMeta(payload),
    onSuccess: (_data, payload) => {
      queryClient.invalidateQueries({
        queryKey: manifestosMetasQueryKey(payload.branchId, payload.mes, payload.ano),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useReplicarManifestosMetasConfiguracoes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManifestosGoalReplicarPayload) => replicarManifestosMetas(payload.ano, payload.mes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: METAS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteManifestosMeta() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, ano, mes, contractTypeKey, classificationKey }: {
      branchId: string;
      ano: number;
      mes: number;
      contractTypeKey?: string;
      classificationKey?: string | null;
    }) => removerManifestosMeta(branchId, ano, mes, contractTypeKey, classificationKey),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: manifestosMetasQueryKey(variables.branchId, variables.mes, variables.ano),
        exact: true,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useBaixarTemplateManifestosMetas() {
  return useMutation({
    mutationFn: baixarTemplateManifestosMetas,
  });
}

export function usePreValidarManifestosMetasImportacao() {
  return useMutation({
    mutationFn: preValidarManifestosMetasImportacao,
  });
}

export function useImportarManifestosMetas() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importarManifestosMetas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: METAS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
