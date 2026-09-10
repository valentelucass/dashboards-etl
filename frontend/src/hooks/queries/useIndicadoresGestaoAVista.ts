import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  atualizarKpiGoalsFilial,
  atualizarKpiGoalsGlobais,
  buscarClientesExcecaoCubagem,
  buscarCubagemMercadoriasOverview,
  buscarCubagemMercadoriasSerie,
  buscarCubagemMercadoriasTabela,
  buscarCubagemMercadoriasTabelaPaginada,
  buscarHorariosCorteOverview,
  buscarHorariosCorteSerie,
  buscarHorariosCorteTabela,
  buscarHorariosCorteTabelaPaginada,
  buscarKpiGoalsCompleto,
  buscarKpiGoalsEfetivos,
  buscarKpiGoalsHistoricoPaginado,
  buscarKpiGoalOverrides,
  buscarIndenizacaoMercadoriasOverview,
  buscarIndenizacaoMercadoriasSerie,
  buscarIndenizacaoMercadoriasTabela,
  buscarIndenizacaoMercadoriasTabelaPaginada,
  buscarPerformanceEntregaOverview,
  buscarPerformanceEntregaSerie,
  buscarPerformanceEntregaTabela,
  buscarPerformanceEntregaTabelaPaginada,
  excluirClienteExcecaoCubagem,
  excluirJustificativaHorarioCorte,
  removerKpiGoalsOverride,
  salvarJustificativaHorarioCorte,
  buscarUtilizacaoColetoresOverview,
  buscarUtilizacaoColetoresRanking,
  buscarUtilizacaoColetoresSerie,
  buscarUtilizacaoColetoresTabela,
  buscarUtilizacaoColetoresTabelaPaginada,
  importarClientesExcecaoCubagem,
  preValidarClientesExcecaoCubagem,
} from '../../api/endpoints/indicadoresGestaoAVistaServico';
import type {
  IndicadoresGestaoVistaFiltro,
  KpiGoalIndicatorKey,
  KpiGoalsUpdatePayload,
  PerformanceEntregaSerieParams,
  ViagemJustificativaPayload,
} from '../../types/indicadoresGestaoAVista';
import type { TableApiFilters } from '../../types/tableFilters';
import { normalizarCompetenciaApiOpcional } from '../../utils/competencia';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../utils/pollingUtils';

const STALE_TIME = 5 * 60 * 1000;

export function useKpiGoalsEffective(branchId: string, competencia?: string, enabled = true) {
  const competenciaApi = normalizarCompetenciaApiOpcional(competencia);
  return useQuery({
    queryKey: ['kpi-goals', 'effective', branchId, competenciaApi],
    queryFn: ({ signal }) => buscarKpiGoalsEfetivos(branchId, competenciaApi, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useKpiGoalsFull(competencia?: string, enabled = true) {
  const competenciaApi = normalizarCompetenciaApiOpcional(competencia);
  return useQuery({
    queryKey: ['kpi-goals', 'full', competenciaApi],
    queryFn: ({ signal }) => buscarKpiGoalsCompleto(competenciaApi, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useKpiGoalHistory(branchId: string, pagina = 1, tamanhoPagina = 10, enabled = true) {
  return useQuery({
    queryKey: ['kpi-goals', 'history', branchId, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarKpiGoalsHistoricoPaginado(branchId, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled: enabled && Boolean(branchId),
  });
}

export function useKpiGoalOverrides(indicatorKey: KpiGoalIndicatorKey, competencia?: string, enabled = true) {
  const competenciaApi = normalizarCompetenciaApiOpcional(competencia);
  return useQuery({
    queryKey: ['kpi-goals', 'overrides', indicatorKey, competenciaApi],
    queryFn: ({ signal }) => buscarKpiGoalOverrides(indicatorKey, competenciaApi, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useAtualizarKpiGoalsGlobais() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: KpiGoalsUpdatePayload) => atualizarKpiGoalsGlobais(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals'] });
    },
  });
}

export function useAtualizarKpiGoalsFilial() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, payload }: { branchId: string; payload: KpiGoalsUpdatePayload }) => atualizarKpiGoalsFilial(branchId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals'] });
    },
  });
}

export function useRemoverKpiGoalsOverride() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, competencia }: { branchId: string; competencia?: string }) => removerKpiGoalsOverride(branchId, competencia),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kpi-goals'] });
    },
  });
}

export function usePerformanceEntregaOverview(filtro: IndicadoresGestaoVistaFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'performance-entrega', 'overview', filtro],
    queryFn: ({ signal }) => buscarPerformanceEntregaOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function usePerformanceEntregaSerie(
  filtro: IndicadoresGestaoVistaFiltro,
  serieParams: PerformanceEntregaSerieParams,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [
      'indicadores-gestao-a-vista',
      'performance-entrega',
      'serie',
      filtro,
      serieParams.visao,
      serieParams.responsavelFiltro ?? null,
      serieParams.regiaoFiltro ?? null,
    ],
    queryFn: ({ signal }) => buscarPerformanceEntregaSerie(filtro, serieParams, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceEntregaTabela(filtro: IndicadoresGestaoVistaFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'performance-entrega', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarPerformanceEntregaTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function usePerformanceEntregaTabelaPaginada(
  filtro: IndicadoresGestaoVistaFiltro,
  pagina: number,
  tamanhoPagina: number,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'performance-entrega', 'tabela-paginada', filtro, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarPerformanceEntregaTabelaPaginada(filtro, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useUtilizacaoColetoresOverview(filtro: IndicadoresGestaoVistaFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'utilizacao-coletores', 'overview', filtro],
    queryFn: ({ signal }) => buscarUtilizacaoColetoresOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useUtilizacaoColetoresSerie(filtro: IndicadoresGestaoVistaFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'utilizacao-coletores', 'serie', filtro],
    queryFn: ({ signal }) => buscarUtilizacaoColetoresSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useUtilizacaoColetoresRanking(filtro: IndicadoresGestaoVistaFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'utilizacao-coletores', 'ranking', filtro],
    queryFn: ({ signal }) => buscarUtilizacaoColetoresRanking(filtro, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useUtilizacaoColetoresTabela(filtro: IndicadoresGestaoVistaFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'utilizacao-coletores', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarUtilizacaoColetoresTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useUtilizacaoColetoresTabelaPaginada(
  filtro: IndicadoresGestaoVistaFiltro,
  pagina: number,
  tamanhoPagina: number,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'utilizacao-coletores', 'tabela-paginada', filtro, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarUtilizacaoColetoresTabelaPaginada(filtro, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useCubagemMercadoriasOverview(filtro: IndicadoresGestaoVistaFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias', 'overview', filtro],
    queryFn: ({ signal }) => buscarCubagemMercadoriasOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useCubagemMercadoriasSerie(filtro: IndicadoresGestaoVistaFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias', 'serie', filtro],
    queryFn: ({ signal }) => buscarCubagemMercadoriasSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCubagemMercadoriasTabela(filtro: IndicadoresGestaoVistaFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarCubagemMercadoriasTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useCubagemMercadoriasTabelaPaginada(
  filtro: IndicadoresGestaoVistaFiltro,
  pagina: number,
  tamanhoPagina: number,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias', 'tabela-paginada', filtro, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarCubagemMercadoriasTabelaPaginada(filtro, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useClientesExcecaoCubagem(enabled = true) {
  return useQuery({
    queryKey: ['indicadores-gestao-a-vista', 'cubagem-clientes-excecao'],
    queryFn: ({ signal }) => buscarClientesExcecaoCubagem(signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useExcluirClienteExcecaoCubagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: excluirClienteExcecaoCubagem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'cubagem-clientes-excecao'] });
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias'] });
    },
  });
}

export function usePreValidarClientesExcecaoCubagem() {
  return useMutation({
    mutationFn: preValidarClientesExcecaoCubagem,
  });
}

export function useImportarClientesExcecaoCubagem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: importarClientesExcecaoCubagem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'cubagem-clientes-excecao'] });
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'cubagem-mercadorias'] });
    },
  });
}

export function useIndenizacaoMercadoriasOverview(filtro: IndicadoresGestaoVistaFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'indenizacao-mercadorias', 'overview', filtro],
    queryFn: ({ signal }) => buscarIndenizacaoMercadoriasOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useIndenizacaoMercadoriasSerie(filtro: IndicadoresGestaoVistaFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'indenizacao-mercadorias', 'serie', filtro],
    queryFn: ({ signal }) => buscarIndenizacaoMercadoriasSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useIndenizacaoMercadoriasTabela(filtro: IndicadoresGestaoVistaFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'indenizacao-mercadorias', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarIndenizacaoMercadoriasTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useIndenizacaoMercadoriasTabelaPaginada(
  filtro: IndicadoresGestaoVistaFiltro,
  pagina: number,
  tamanhoPagina: number,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'indenizacao-mercadorias', 'tabela-paginada', filtro, pagina, tamanhoPagina],
    queryFn: ({ signal }) => buscarIndenizacaoMercadoriasTabelaPaginada(filtro, pagina, tamanhoPagina, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useHorariosCorteOverview(filtro: IndicadoresGestaoVistaFiltro) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'horarios-corte', 'overview', filtro],
    queryFn: ({ signal }) => buscarHorariosCorteOverview(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

export function useHorariosCorteSerie(filtro: IndicadoresGestaoVistaFiltro, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'horarios-corte', 'serie', filtro],
    queryFn: ({ signal }) => buscarHorariosCorteSerie(filtro, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useHorariosCorteTabela(filtro: IndicadoresGestaoVistaFiltro, limite = 100, enabled = true) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'horarios-corte', 'tabela', filtro, limite],
    queryFn: ({ signal }) => buscarHorariosCorteTabela(filtro, limite, signal),
    staleTime: STALE_TIME,
    retry: 1,
    enabled,
  });
}

export function useHorariosCorteTabelaPaginada(
  filtro: IndicadoresGestaoVistaFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  enabled = true,
) {
  return useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['indicadores-gestao-a-vista', 'horarios-corte', 'tabela-paginada', filtro, pagina, tamanhoPagina, filtrosTabela],
    queryFn: ({ signal }) => buscarHorariosCorteTabelaPaginada(filtro, pagina, tamanhoPagina, filtrosTabela, signal),
    staleTime: STALE_TIME,
    retry: false,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function useSalvarJustificativaHorarioCorte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ViagemJustificativaPayload) => salvarJustificativaHorarioCorte(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'horarios-corte'] });
    },
  });
}

export function useExcluirJustificativaHorarioCorte() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sm: number | string) => excluirJustificativaHorarioCorte(sm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indicadores-gestao-a-vista', 'horarios-corte'] });
    },
  });
}
