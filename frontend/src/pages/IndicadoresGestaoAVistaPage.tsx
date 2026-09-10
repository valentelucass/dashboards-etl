import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BarChart3, Boxes, CheckCircle2, ChevronRight, ChevronUp, Clock3, Gauge, MessageSquarePlus, PackageCheck, Settings, ShieldAlert, Truck } from 'lucide-react';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import type { ColunaTabela } from '../components/shared/DataTable';
import type { ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import BranchGoalOverridesBanner from '../components/indicadores-gestao/BranchGoalOverridesBanner';
import CubagemClientesExcecaoPanel from '../components/indicadores-gestao/CubagemClientesExcecaoPanel';
import CubagemClientesImportacaoModal from '../components/indicadores-gestao/CubagemClientesImportacaoModal';
import IndicadoresGestaoPanoramaSection, { type PanoramaOperacionalItem } from '../components/indicadores-gestao/IndicadoresGestaoPanoramaSection';
import IndicadoresGestaoSection from '../components/indicadores-gestao/IndicadoresGestaoSection';
import IndicadoresGestaoSummaryCard from '../components/indicadores-gestao/IndicadoresGestaoSummaryCard';
import JustificativaHorarioCorteModal from '../components/indicadores-gestao/JustificativaHorarioCorteModal';
import KpiGoalsManagerPanel from '../components/indicadores-gestao/KpiGoalsManagerPanel';
import { KpiDictionary } from '../constants/kpiDictionary';
import {
  exportarCubagemMercadoriasCsv,
  exportarHorariosCorteCsv,
  exportarIndenizacaoMercadoriasCsv,
  exportarPerformanceEntregaCsv,
  exportarUtilizacaoColetoresCsv,
  GLOBAL_KPI_GOAL_BRANCH_ID,
} from '../api/endpoints/indicadoresGestaoAVistaServico';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais } from '../hooks/queries/useDimensoes';
import {
  useAtualizarKpiGoalsFilial,
  useAtualizarKpiGoalsGlobais,
  useCubagemMercadoriasOverview,
  useCubagemMercadoriasSerie,
  useCubagemMercadoriasTabelaPaginada,
  useExcluirJustificativaHorarioCorte,
  useHorariosCorteOverview,
  useHorariosCorteSerie,
  useHorariosCorteTabelaPaginada,
  useKpiGoalHistory,
  useKpiGoalOverrides,
  useKpiGoalsEffective,
  useKpiGoalsFull,
  useIndenizacaoMercadoriasOverview,
  useIndenizacaoMercadoriasSerie,
  useIndenizacaoMercadoriasTabelaPaginada,
  usePerformanceEntregaOverview,
  usePerformanceEntregaSerie,
  usePerformanceEntregaTabelaPaginada,
  useRemoverKpiGoalsOverride,
  useSalvarJustificativaHorarioCorte,
  useUtilizacaoColetoresOverview,
  useUtilizacaoColetoresRanking,
  useUtilizacaoColetoresTabelaPaginada,
} from '../hooks/queries/useIndicadoresGestaoAVista';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { usePermissions } from '../hooks/usePermissions';
import { useStaggeredQueryEnabled } from '../hooks/useStaggeredQueryEnabled';
import type {
  CubagemMercadoriasRow,
  HorarioCorteRow,
  IndenizacaoMercadoriasRow,
  IndicadoresGestaoVistaFiltro,
  KpiGoalIndicatorKey,
  KpiGoalIndicatorOverride,
  KpiGoalsMap,
  NivelVisaoPerformance,
  PerformanceEntregaRow,
  UtilizacaoColetoresRow,
} from '../types/indicadoresGestaoAVista';
import { getApiErrorMessage } from '../utils/apiError';
import { isParceiroLogistico } from '../utils/filiais';
import { formatarData, formatarDataHora, formatarMoeda, formatarNumero, formatarPorcentagem } from '../utils/formatadores';
import {
  aggregateCubagemRanking,
  aggregateHorariosRanking,
  aggregateIndenizacaoRanking,
  aggregatePerformanceRanking,
  avaliarMetaIndicador,
  calcularDistanciaRelativaMeta,
  type GoalMode,
  type PerformanceRankingItem,
} from '../utils/indicadoresGestaoVistaUi';
import { buildMetaComparisonOption, buildRankingOption } from '../utils/indicadoresGestaoVistaCharts';
import { normalizarCompetenciaApi } from '../utils/competencia';

type SectionId = 'performance' | 'coletores' | 'cubagem' | 'indenizacao' | 'horarios';

interface HorarioCorteJustificativaSelecionada {
  codSolicitacao: number;
  justificativa: string | null;
}

interface GoalConfig {
  threshold: number;
  mode: GoalMode;
  label: string;
}

const DEFAULT_KPI_GOALS: KpiGoalsMap = {
  delivery_performance: 95,
  collector_usage: 90,
  cargo_cubage: 85,
  cargo_indemnity: 2,
  cutoff_time: 98,
};
const KPI_GOAL_HISTORY_PAGE_SIZE = 30;
const HORARIOS_CORTE_STATUS_OPTIONS = ['NO PRAZO', 'FORA DO PRAZO', 'SEM DADO'];

const SECTION_GOAL_KEYS: Record<SectionId, KpiGoalIndicatorKey> = {
  performance: 'delivery_performance',
  coletores: 'collector_usage',
  cubagem: 'cargo_cubage',
  indenizacao: 'cargo_indemnity',
  horarios: 'cutoff_time',
};

const SECTION_GOAL_MODES: Record<SectionId, GoalMode> = {
  performance: 'atLeast',
  coletores: 'atLeast',
  cubagem: 'atLeast',
  indenizacao: 'atMost',
  horarios: 'atLeast',
};

function formatarMetaValor(value: number): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

function buildGoalConfigs(kpiGoals: KpiGoalsMap): Record<SectionId, GoalConfig> {
  return (Object.keys(SECTION_GOAL_KEYS) as SectionId[]).reduce((acc, sectionId) => {
    const mode = SECTION_GOAL_MODES[sectionId];
    const threshold = kpiGoals[SECTION_GOAL_KEYS[sectionId]];
    const prefix = mode === 'atLeast' ? 'Meta' : 'Limite';
    acc[sectionId] = {
      threshold,
      mode,
      label: `${prefix} ${formatarMetaValor(threshold)}%`,
    };
    return acc;
  }, {} as Record<SectionId, GoalConfig>);
}

function latestUpdatedAt(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, timestamp: Date.parse(value) }))
    .filter((item) => !Number.isNaN(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp)[0]?.value ?? null;
}

function calcularGap(value: number, threshold: number, mode: GoalMode): number {
  if (mode === 'atLeast') {
    return Math.max(threshold - value, 0);
  }
  return Math.max(value - threshold, 0);
}

function formatarGap(gap: number, mode: GoalMode, decimais = 1): string {
  if (gap <= 0) {
    return mode === 'atLeast' ? 'Meta atendida' : 'Dentro do limite';
  }
  const prefixo = mode === 'atLeast' ? 'Gap' : 'Acima do limite';
  return `${prefixo}: ${formatarNumero(gap, decimais)} p.p.`;
}

function formatarGapComBase(hasData: boolean, gap: number, mode: GoalMode, decimais = 1): string {
  return hasData ? formatarGap(gap, mode, decimais) : 'Sem base de cálculo';
}

function normalizarFilialMeta(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('pt-BR');
}

function resolverMetaFilial(
  branchName: string,
  globalGoal: number,
  overrides?: KpiGoalIndicatorOverride[],
): number {
  const normalized = normalizarFilialMeta(branchName);
  const override = overrides?.find((item) => (
    normalizarFilialMeta(item.branchId) === normalized
    || normalizarFilialMeta(item.branchName) === normalized
  ));
  return override?.goalValue ?? globalGoal;
}

function formatarDiferencaMeta(value: number, goal: number): string {
  const difference = Number((value - goal).toFixed(1));
  const prefix = difference > 0 ? '+' : '';
  return `${prefix}${formatarNumero(difference, 1)} p.p.`;
}

const PERFORMANCE_VISAO_LABELS: Record<NivelVisaoPerformance, string> = {
  RESPONSAVEL: 'Responsáveis',
  REGIAO: 'Regiões',
  CIDADE: 'Cidades',
};

function normalizarPerformanceDrillTexto(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function performanceChartClickItem(params: unknown, items: PerformanceRankingItem[]): PerformanceRankingItem | null {
  const dataIndex = typeof params === 'object' && params !== null && 'dataIndex' in params
    ? Number((params as { dataIndex?: number }).dataIndex)
    : -1;

  if (dataIndex < 0) {
    return null;
  }

  if (items.length === 1) {
    return dataIndex === 1 ? items[0] : null;
  }

  return [...items.slice(0, 8)].reverse()[dataIndex] ?? null;
}

function PerformanceDrilldownBreadcrumbs({
  nivel,
  responsavel,
  regiao,
  onNivelClick,
}: {
  nivel: NivelVisaoPerformance;
  responsavel: string | null;
  regiao: string | null;
  onNivelClick: (nivel: NivelVisaoPerformance) => void;
}) {
  const buttonClassName = 'max-w-36 truncate rounded px-1.5 py-1 transition hover:bg-[var(--color-primary)]/10 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';
  const disabledButtonClassName = 'cursor-not-allowed opacity-45 hover:bg-transparent hover:no-underline';
  const drillUpDesabilitado = nivel === 'RESPONSAVEL';
  const regiaoDesabilitada = !responsavel;
  const cidadeDesabilitada = !responsavel || !regiao;
  const resolveButtonClassName = (disabled: boolean) => `${buttonClassName} ${disabled ? disabledButtonClassName : ''}`;
  const resolveButtonColor = (ativo: boolean, disabled = false) => {
    if (disabled) {
      return 'var(--color-text-subtle)';
    }
    return ativo ? 'var(--color-primary)' : 'var(--color-text-muted)';
  };

  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-[11px] font-semibold">
      <button
        type="button"
        title="Drill up"
        aria-label="Drill up"
        disabled={drillUpDesabilitado}
        aria-disabled={drillUpDesabilitado}
        onClick={() => {
          if (!drillUpDesabilitado) {
            onNivelClick('RESPONSAVEL');
          }
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-md border transition focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
          drillUpDesabilitado ? 'cursor-not-allowed opacity-45' : 'cursor-pointer hover:border-[var(--color-primary)]'
        }`}
        style={{ borderColor: 'var(--color-border)', color: resolveButtonColor(true, drillUpDesabilitado) }}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        onClick={() => onNivelClick('RESPONSAVEL')}
        className={buttonClassName}
        style={{ color: nivel === 'RESPONSAVEL' ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
      >
        Responsáveis
      </button>
      <ChevronRight size={12} style={{ color: 'var(--color-text-subtle)' }} />
      <button
        type="button"
        disabled={regiaoDesabilitada}
        aria-disabled={regiaoDesabilitada}
        onClick={() => {
          if (!regiaoDesabilitada) {
            onNivelClick('REGIAO');
          }
        }}
        className={resolveButtonClassName(regiaoDesabilitada)}
        title={responsavel ? `Responsável: ${responsavel}` : 'Clique em um responsável no gráfico para habilitar regiões'}
        style={{ color: resolveButtonColor(nivel === 'REGIAO', regiaoDesabilitada) }}
      >
        {responsavel ? `Regiões de ${responsavel}` : 'Regiões'}
      </button>
      <ChevronRight size={12} style={{ color: 'var(--color-text-subtle)' }} />
      <button
        type="button"
        disabled={cidadeDesabilitada}
        aria-disabled={cidadeDesabilitada}
        onClick={() => {
          if (!cidadeDesabilitada) {
            onNivelClick('CIDADE');
          }
        }}
        className={resolveButtonClassName(cidadeDesabilitada)}
        title={regiao ? `Região: ${regiao}` : 'Clique em uma região no gráfico para habilitar cidades'}
        style={{ color: resolveButtonColor(nivel === 'CIDADE', cidadeDesabilitada) }}
      >
        {regiao ? `Cidades de ${regiao}` : 'Cidades'}
      </button>
    </div>
  );
}

export default function IndicadoresGestaoAVistaPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, setFiltros, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const { canAccess } = usePermissions();
  const filiais = useFiliais();
  const [expandedSection, setExpandedSection] = useState<SectionId | null>(null);
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [goalsPanelBranchId, setGoalsPanelBranchId] = useState('');
  const [goalsPanelCompetencia, setGoalsPanelCompetencia] = useState(() => normalizarCompetenciaApi(dataInicio));
  const [goalsHistoryPage, setGoalsHistoryPage] = useState(1);
  const [cubagemImportModalOpen, setCubagemImportModalOpen] = useState(false);
  const [horarioCorteJustificativaSelecionada, setHorarioCorteJustificativaSelecionada] = useState<HorarioCorteJustificativaSelecionada | null>(null);
  const [nivelVisaoPerformance, setNivelVisaoPerformance] = useState<NivelVisaoPerformance>('RESPONSAVEL');
  const [responsavelSelecionado, setResponsavelSelecionado] = useState<string | null>(null);
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string | null>(null);
  const dataInicioIndicadores = dataInicio;
  const dataFimIndicadores = dataFim;
  const competenciaFiltroGlobal = useMemo(() => normalizarCompetenciaApi(dataInicioIndicadores), [dataInicioIndicadores]);
  const filtroBase: IndicadoresGestaoVistaFiltro = {
    dataInicio: dataInicioIndicadores,
    dataFim: dataFimIndicadores,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
  };
  const filtroColetores: IndicadoresGestaoVistaFiltro = filtroBase;
  const filiaisSelecionadas = [...(filtros.filiais ?? []), ...(filtros.parceirosLogisticos ?? [])];
  const goalBranchId = filiaisSelecionadas.length === 1 ? filiaisSelecionadas[0] : GLOBAL_KPI_GOAL_BRANCH_ID;
  const filtroBaseKey = JSON.stringify(filtroBase);
  const filtroColetoresKey = JSON.stringify(filtroColetores);
  const horariosFiltrosTabela = useAnalyticalTableFilters();
  const performancePaginacao = useTabelaPaginadaState(`${filtroBaseKey}|performance`);
  const coletoresPaginacao = useTabelaPaginadaState(`${filtroColetoresKey}|coletores`);
  const cubagemPaginacao = useTabelaPaginadaState(`${filtroBaseKey}|cubagem`);
  const indenizacaoPaginacao = useTabelaPaginadaState(`${filtroBaseKey}|indenizacao`);
  const horariosPaginacao = useTabelaPaginadaState(`${filtroBaseKey}|horarios|${horariosFiltrosTabela.resetKey}`);
  const activeFilters: ActiveFilter[] = [
    { label: 'Filial base', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiro logístico base', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
  ].filter((item) => item.count > 0);
  const canManageKpiGoals = canAccess('can_manage_kpi_goals');

  const performanceOverview = usePerformanceEntregaOverview(filtroBase);
  const coletoresOverview = useUtilizacaoColetoresOverview(filtroColetores);
  const cubagemOverview = useCubagemMercadoriasOverview(filtroBase);
  const indenizacaoOverview = useIndenizacaoMercadoriasOverview(filtroBase);
  const horariosOverview = useHorariosCorteOverview(filtroBase);
  const performanceSecondaryEnabled = useStaggeredQueryEnabled(performanceOverview.isSuccess && Boolean(performanceOverview.data), 150);
  const coletoresSecondaryEnabled = useStaggeredQueryEnabled(coletoresOverview.isSuccess && Boolean(coletoresOverview.data), 220);
  const cubagemSecondaryEnabled = useStaggeredQueryEnabled(cubagemOverview.isSuccess && Boolean(cubagemOverview.data), 290);
  const indenizacaoSecondaryEnabled = useStaggeredQueryEnabled(indenizacaoOverview.isSuccess && Boolean(indenizacaoOverview.data), 360);
  const horariosSecondaryEnabled = useStaggeredQueryEnabled(horariosOverview.isSuccess && Boolean(horariosOverview.data), 430);
  const performanceSerieParams = useMemo(() => ({
    visao: nivelVisaoPerformance,
    responsavelFiltro: responsavelSelecionado,
    regiaoFiltro: regiaoSelecionada,
  }), [nivelVisaoPerformance, regiaoSelecionada, responsavelSelecionado]);
  const performanceSerie = usePerformanceEntregaSerie(filtroBase, performanceSerieParams, performanceSecondaryEnabled);
  const performanceTabela = usePerformanceEntregaTabelaPaginada(
    filtroBase,
    performancePaginacao.pagina,
    performancePaginacao.tamanhoPagina,
    expandedSection === 'performance' && performanceSecondaryEnabled,
  );
  const coletoresRankingQuery = useUtilizacaoColetoresRanking(filtroColetores, coletoresSecondaryEnabled);
  const coletoresTabela = useUtilizacaoColetoresTabelaPaginada(
    filtroColetores,
    coletoresPaginacao.pagina,
    coletoresPaginacao.tamanhoPagina,
    expandedSection === 'coletores' && coletoresSecondaryEnabled,
  );
  const cubagemSerie = useCubagemMercadoriasSerie(filtroBase, cubagemSecondaryEnabled);
  const cubagemTabela = useCubagemMercadoriasTabelaPaginada(
    filtroBase,
    cubagemPaginacao.pagina,
    cubagemPaginacao.tamanhoPagina,
    expandedSection === 'cubagem' && cubagemSecondaryEnabled,
  );
  const indenizacaoSerie = useIndenizacaoMercadoriasSerie(filtroBase, indenizacaoSecondaryEnabled);
  const indenizacaoTabela = useIndenizacaoMercadoriasTabelaPaginada(
    filtroBase,
    indenizacaoPaginacao.pagina,
    indenizacaoPaginacao.tamanhoPagina,
    expandedSection === 'indenizacao' && indenizacaoSecondaryEnabled,
  );
  const horariosSerie = useHorariosCorteSerie(filtroBase, horariosSecondaryEnabled);
  const horariosTabela = useHorariosCorteTabelaPaginada(
    filtroBase,
    horariosPaginacao.pagina,
    horariosPaginacao.tamanhoPagina,
    horariosFiltrosTabela.apiFilters,
    expandedSection === 'horarios' && horariosSecondaryEnabled,
  );
  const kpiGoals = useKpiGoalsEffective(goalBranchId, competenciaFiltroGlobal);
  const canFetchGoalOverrides = kpiGoals.isSuccess;
  const performanceOverrides = useKpiGoalOverrides('delivery_performance', competenciaFiltroGlobal, canFetchGoalOverrides);
  const coletoresOverrides = useKpiGoalOverrides('collector_usage', competenciaFiltroGlobal, canFetchGoalOverrides);
  const cubagemOverrides = useKpiGoalOverrides('cargo_cubage', competenciaFiltroGlobal, canFetchGoalOverrides);
  const indenizacaoOverrides = useKpiGoalOverrides('cargo_indemnity', competenciaFiltroGlobal, canFetchGoalOverrides);
  const horariosOverrides = useKpiGoalOverrides('cutoff_time', competenciaFiltroGlobal, canFetchGoalOverrides);
  const managerKpiGoals = useKpiGoalsFull(goalsPanelCompetencia, canManageKpiGoals && goalsPanelOpen);
  const managerHistory = useKpiGoalHistory(
    goalsPanelBranchId,
    goalsHistoryPage,
    KPI_GOAL_HISTORY_PAGE_SIZE,
    canManageKpiGoals && goalsPanelOpen && Boolean(goalsPanelBranchId),
  );
  const atualizarGlobais = useAtualizarKpiGoalsGlobais();
  const atualizarFilial = useAtualizarKpiGoalsFilial();
  const removerOverride = useRemoverKpiGoalsOverride();
  const salvarJustificativaHorarioCorte = useSalvarJustificativaHorarioCorte();
  const excluirJustificativaHorarioCorte = useExcluirJustificativaHorarioCorte();
  const goals = useMemo(() => buildGoalConfigs(kpiGoals.data?.goals ?? DEFAULT_KPI_GOALS), [kpiGoals.data]);
  const overridesByIndicator = useMemo<Record<KpiGoalIndicatorKey, KpiGoalIndicatorOverride[]>>(() => ({
    delivery_performance: performanceOverrides.data?.overrides ?? [],
    collector_usage: coletoresOverrides.data?.overrides ?? [],
    cargo_cubage: cubagemOverrides.data?.overrides ?? [],
    cargo_indemnity: indenizacaoOverrides.data?.overrides ?? [],
    cutoff_time: horariosOverrides.data?.overrides ?? [],
  }), [
    performanceOverrides.data?.overrides,
    coletoresOverrides.data?.overrides,
    cubagemOverrides.data?.overrides,
    indenizacaoOverrides.data?.overrides,
    horariosOverrides.data?.overrides,
  ]);
  const goalBranchOptions = useMemo(
    () => {
      const options = [goalBranchId, ...(filiais.data ?? []), ...(managerKpiGoals.data?.branches.map((branch) => branch.branchId) ?? [])]
        .filter((option): option is string => Boolean(option));
      return Array.from(new Set(options)).filter((option) => option !== GLOBAL_KPI_GOAL_BRANCH_ID);
    },
    [filiais.data, goalBranchId, managerKpiGoals.data?.branches],
  );

  function abrirGerenciadorMetas() {
    atualizarGlobais.reset();
    atualizarFilial.reset();
    removerOverride.reset();
    if (!goalsPanelOpen) {
      setGoalsPanelCompetencia(competenciaFiltroGlobal);
    }
    setGoalsPanelBranchId(goalBranchId === GLOBAL_KPI_GOAL_BRANCH_ID ? (filiais.data?.[0] ?? '') : goalBranchId);
    setGoalsHistoryPage(1);
    setGoalsPanelOpen((current) => !current);
  }

  async function aplicarMetasGlobais(kpiGoalValues: KpiGoalsMap) {
    atualizarFilial.reset();
    removerOverride.reset();
    await atualizarGlobais.mutateAsync({ goals: kpiGoalValues, competencia: goalsPanelCompetencia });
    setGoalsHistoryPage(1);
  }

  async function salvarMetasFilial(branchId: string, kpiGoalValues: KpiGoalsMap) {
    atualizarGlobais.reset();
    removerOverride.reset();
    await atualizarFilial.mutateAsync({ branchId, payload: { goals: kpiGoalValues, competencia: goalsPanelCompetencia } });
    setGoalsHistoryPage(1);
  }

  async function removerOverrideFilial(branchId: string) {
    atualizarGlobais.reset();
    atualizarFilial.reset();
    await removerOverride.mutateAsync({ branchId, competencia: goalsPanelCompetencia });
    setGoalsHistoryPage(1);
  }

  async function salvarJustificativaSm(payload: { codSolicitacao: number; justificativa: string }) {
    await salvarJustificativaHorarioCorte.mutateAsync(payload);
    setHorarioCorteJustificativaSelecionada(null);
  }

  async function excluirJustificativaSm(codSolicitacao: number) {
    await excluirJustificativaHorarioCorte.mutateAsync(codSolicitacao);
    setHorarioCorteJustificativaSelecionada(null);
  }

  function alterarFilialPainelMetas(branchId: string) {
    atualizarGlobais.reset();
    atualizarFilial.reset();
    removerOverride.reset();
    setGoalsPanelBranchId(branchId);
    setGoalsHistoryPage(1);
  }

  function alterarCompetenciaPainelMetas(competencia: string) {
    atualizarGlobais.reset();
    atualizarFilial.reset();
    removerOverride.reset();
    setGoalsPanelCompetencia(normalizarCompetenciaApi(competencia));
    setGoalsHistoryPage(1);
  }

  function rolarParaTopoIndicadores() {
    requestAnimationFrame(() => {
      document.querySelector('[data-indicadores-gestao-top]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function selecionarFilialMeta(branchId: string) {
    const isParceiro = isParceiroLogistico(branchId);
    setFiltros({
      filiais: isParceiro ? [] : [branchId],
      parceirosLogisticos: isParceiro ? [branchId] : [],
    });
    rolarParaTopoIndicadores();
  }

  function limparFiltroFilialMeta() {
    setFiltros({ filiais: [], parceirosLogisticos: [] });
    rolarParaTopoIndicadores();
  }

  function navegarPerformanceParaNivel(nivel: NivelVisaoPerformance) {
    if (nivel === 'RESPONSAVEL') {
      setNivelVisaoPerformance('RESPONSAVEL');
      setResponsavelSelecionado(null);
      setRegiaoSelecionada(null);
      return;
    }

    if (nivel === 'REGIAO' && responsavelSelecionado) {
      setNivelVisaoPerformance('REGIAO');
      setRegiaoSelecionada(null);
      return;
    }

    if (nivel === 'CIDADE' && responsavelSelecionado && regiaoSelecionada) {
      setNivelVisaoPerformance('CIDADE');
    }
  }

  const drillDownPerformance = useCallback((item: PerformanceRankingItem | null) => {
    const filtroDrill = normalizarPerformanceDrillTexto(item?.filtro ?? item?.group);

    if (!filtroDrill || nivelVisaoPerformance === 'CIDADE') {
      return;
    }

    if (nivelVisaoPerformance === 'RESPONSAVEL') {
      setResponsavelSelecionado(filtroDrill);
      setRegiaoSelecionada(null);
      setNivelVisaoPerformance('REGIAO');
      return;
    }

    setRegiaoSelecionada(filtroDrill);
    setNivelVisaoPerformance('CIDADE');
  }, [nivelVisaoPerformance]);

  useEffect(() => {
    if (!goalsPanelOpen || goalsPanelBranchId || goalBranchOptions.length === 0) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGoalsPanelBranchId(goalBranchOptions[0]);
    setGoalsHistoryPage(1);
  }, [goalBranchOptions, goalsPanelBranchId, goalsPanelOpen]);
  const managerSaveError = atualizarGlobais.error ?? atualizarFilial.error ?? removerOverride.error;
  const managerIsSaving = atualizarGlobais.isPending || atualizarFilial.isPending || removerOverride.isPending;

  const updatedAt = latestUpdatedAt([
    performanceOverview.data?.updatedAt,
    coletoresOverview.data?.updatedAt,
    cubagemOverview.data?.updatedAt,
    indenizacaoOverview.data?.updatedAt,
    horariosOverview.data?.updatedAt,
  ]);
  usePageHeader({
    title: 'Indicadores de Gestão à Vista',
    description: 'Painel operacional diário com leitura rápida por filial e tabela analítica sob demanda.',
    updatedAt,
  });
  const performanceRanking = useMemo(() => aggregatePerformanceRanking(performanceSerie.data ?? []), [performanceSerie.data]);
  const coletoresRanking = useMemo(() => (coletoresRankingQuery.data ?? []).map((item) => ({
    group: item.branchName || item.branchId,
    branchId: item.branchId,
    branchName: item.branchName,
    goal: item.goal,
    pctUtilizacao: item.utilization,
    manifestosBipados: item.ordensConferencia,
    manifestosEmitidos: Math.max(item.manifestosBipaveis - item.descarregamentos, 0),
    manifestosDescarregamento: item.descarregamentos,
    totalManifestos: item.manifestosBipaveis,
    manifestosIncompletos: item.ordensIncompletas,
  })), [coletoresRankingQuery.data]);
  const cubagemRanking = useMemo(() => aggregateCubagemRanking(cubagemSerie.data ?? []), [cubagemSerie.data]);
  const indenizacaoRanking = useMemo(() => aggregateIndenizacaoRanking(indenizacaoSerie.data ?? []), [indenizacaoSerie.data]);
  const horariosRanking = useMemo(() => aggregateHorariosRanking(horariosSerie.data ?? []), [horariosSerie.data]);
  const selectedBranchForOverrides = filiaisSelecionadas.length === 1 ? filiaisSelecionadas[0] : null;
  const globalGoalByIndicator = useMemo<KpiGoalsMap>(() => ({
    delivery_performance: performanceOverrides.data?.globalGoal ?? kpiGoals.data?.goals.delivery_performance ?? DEFAULT_KPI_GOALS.delivery_performance,
    collector_usage: coletoresOverrides.data?.globalGoal ?? kpiGoals.data?.goals.collector_usage ?? DEFAULT_KPI_GOALS.collector_usage,
    cargo_cubage: cubagemOverrides.data?.globalGoal ?? kpiGoals.data?.goals.cargo_cubage ?? DEFAULT_KPI_GOALS.cargo_cubage,
    cargo_indemnity: indenizacaoOverrides.data?.globalGoal ?? kpiGoals.data?.goals.cargo_indemnity ?? DEFAULT_KPI_GOALS.cargo_indemnity,
    cutoff_time: horariosOverrides.data?.globalGoal ?? kpiGoals.data?.goals.cutoff_time ?? DEFAULT_KPI_GOALS.cutoff_time,
  }), [
    performanceOverrides.data?.globalGoal,
    coletoresOverrides.data?.globalGoal,
    cubagemOverrides.data?.globalGoal,
    indenizacaoOverrides.data?.globalGoal,
    horariosOverrides.data?.globalGoal,
    kpiGoals.data?.goals,
  ]);
  const metaFilial = useCallback((sectionId: SectionId, branchName: string) => {
    const indicatorKey = SECTION_GOAL_KEYS[sectionId];
    return resolverMetaFilial(branchName, globalGoalByIndicator[indicatorKey], overridesByIndicator[indicatorKey]);
  }, [globalGoalByIndicator, overridesByIndicator]);
  const goalOverridesNotice = (indicatorKey: KpiGoalIndicatorKey) => (
    <BranchGoalOverridesBanner
      indicatorKey={indicatorKey}
      globalGoal={globalGoalByIndicator[indicatorKey]}
      overrides={overridesByIndicator[indicatorKey]}
      selectedBranch={selectedBranchForOverrides}
      onSelectBranch={selecionarFilialMeta}
      onClearFilter={limparFiltroFilialMeta}
    />
  );

  const performanceHasData = (performanceOverview.data?.totalEntregas ?? 0) > 0;
  const coletoresHasData = (coletoresOverview.data?.manifestosBipados ?? 0) > 0 || (coletoresOverview.data?.totalManifestos ?? 0) > 0;
  const cubagemHasData = (cubagemOverview.data?.totalFretes ?? 0) > 0;
  const indenizacaoHasData = (indenizacaoOverview.data?.totalSinistros ?? 0) > 0;
  const horariosHasData = (horariosOverview.data?.totalProgramado ?? 0) > 0;

  const performanceAssessment = avaliarMetaIndicador({
    value: performanceOverview.data?.pctNoPrazo ?? 0,
    threshold: goals.performance.threshold,
    mode: goals.performance.mode,
    hasData: performanceHasData,
    isLoading: performanceOverview.isLoading || kpiGoals.isLoading,
    isError: performanceOverview.isError || kpiGoals.isError,
  });
  const coletoresAssessment = avaliarMetaIndicador({
    value: coletoresOverview.data?.pctUtilizacao ?? 0,
    threshold: goals.coletores.threshold,
    mode: goals.coletores.mode,
    hasData: coletoresHasData,
    isLoading: coletoresOverview.isLoading || kpiGoals.isLoading,
    isError: coletoresOverview.isError || kpiGoals.isError,
  });
  const cubagemAssessment = avaliarMetaIndicador({
    value: cubagemOverview.data?.pctCubagem ?? 0,
    threshold: goals.cubagem.threshold,
    mode: goals.cubagem.mode,
    hasData: cubagemHasData,
    isLoading: cubagemOverview.isLoading || kpiGoals.isLoading,
    isError: cubagemOverview.isError || kpiGoals.isError,
  });
  const indenizacaoAssessment = avaliarMetaIndicador({
    value: indenizacaoOverview.data?.pctIndenizacao ?? 0,
    threshold: goals.indenizacao.threshold,
    mode: goals.indenizacao.mode,
    hasData: indenizacaoHasData,
    isLoading: indenizacaoOverview.isLoading || kpiGoals.isLoading,
    isError: indenizacaoOverview.isError || kpiGoals.isError,
  });
  const horariosAssessment = avaliarMetaIndicador({
    value: horariosOverview.data?.pctNoHorario ?? 0,
    threshold: goals.horarios.threshold,
    mode: goals.horarios.mode,
    hasData: horariosHasData,
    isLoading: horariosOverview.isLoading || kpiGoals.isLoading,
    isError: horariosOverview.isError || kpiGoals.isError,
  });

  const performanceGap = calcularGap(performanceOverview.data?.pctNoPrazo ?? 0, goals.performance.threshold, goals.performance.mode);
  const coletoresGap = calcularGap(coletoresOverview.data?.pctUtilizacao ?? 0, goals.coletores.threshold, goals.coletores.mode);
  const cubagemGap = calcularGap(cubagemOverview.data?.pctCubagem ?? 0, goals.cubagem.threshold, goals.cubagem.mode);
  const indenizacaoGap = calcularGap(indenizacaoOverview.data?.pctIndenizacao ?? 0, goals.indenizacao.threshold, goals.indenizacao.mode);
  const horariosGap = calcularGap(horariosOverview.data?.pctNoHorario ?? 0, goals.horarios.threshold, goals.horarios.mode);
  const performanceGapLabel = formatarGapComBase(performanceHasData, performanceGap, goals.performance.mode);
  const coletoresGapLabel = formatarGapComBase(coletoresHasData, coletoresGap, goals.coletores.mode);
  const cubagemGapLabel = formatarGapComBase(cubagemHasData, cubagemGap, goals.cubagem.mode);
  const indenizacaoGapLabel = formatarGapComBase(indenizacaoHasData, indenizacaoGap, goals.indenizacao.mode, 2);
  const horariosGapLabel = formatarGapComBase(horariosHasData, horariosGap, goals.horarios.mode);
  const performanceChartTitle = performanceRanking.length <= 1
    ? 'Comparativo contra meta'
    : `Performance por ${PERFORMANCE_VISAO_LABELS[nivelVisaoPerformance].toLocaleLowerCase('pt-BR')}`;

  const performanceChartOption = useMemo(() => (
    performanceRanking.length <= 1
      ? buildMetaComparisonOption({
          label: performanceRanking[0]?.group ?? 'Periodo filtrado',
          value: performanceRanking[0]?.pctNoPrazo ?? performanceOverview.data?.pctNoPrazo ?? 0,
          threshold: goals.performance.threshold,
          mode: goals.performance.mode,
          thresholdLabel: goals.performance.label,
          isDark,
        })
      : buildRankingOption({
          items: performanceRanking,
          getLabel: (item) => item.group,
          getValue: (item) => item.pctNoPrazo,
          threshold: goals.performance.threshold,
          mode: goals.performance.mode,
          thresholdLabel: goals.performance.label,
          isDark,
          tooltipLines: (item) => [
            `Visão: ${PERFORMANCE_VISAO_LABELS[nivelVisaoPerformance]}`,
            `Meta: ${formatarPorcentagem(goals.performance.threshold)}`,
            `Diferença: ${formatarDiferencaMeta(item.pctNoPrazo, goals.performance.threshold)}`,
            `Total: ${formatarNumero(item.totalEntregas)}`,
            `No prazo: ${formatarNumero(item.entregasNoPrazo)}`,
            `Fora do prazo: ${formatarNumero(item.entregasForaDoPrazo)}`,
          ],
        })
  ), [goals.performance.label, goals.performance.mode, goals.performance.threshold, isDark, nivelVisaoPerformance, performanceRanking, performanceOverview.data?.pctNoPrazo]);
  const performanceChartEvents = useMemo(() => ({
    click: (params: unknown) => {
      drillDownPerformance(performanceChartClickItem(params, performanceRanking));
    },
  }), [drillDownPerformance, performanceRanking]);
  const performanceChartActions = (
    <PerformanceDrilldownBreadcrumbs
      nivel={nivelVisaoPerformance}
      responsavel={responsavelSelecionado}
      regiao={regiaoSelecionada}
      onNivelClick={navegarPerformanceParaNivel}
    />
  );

  const coletoresChartOption = useMemo(() => (
    coletoresRanking.length <= 1
      ? buildMetaComparisonOption({
          label: coletoresRanking[0]?.group ?? 'Periodo filtrado',
          value: coletoresOverview.data?.pctUtilizacao ?? 0,
          threshold: goals.coletores.threshold,
          mode: goals.coletores.mode,
          thresholdLabel: goals.coletores.label,
          isDark,
        })
      : buildRankingOption({
          items: coletoresRanking,
          getLabel: (item) => item.group,
          getValue: (item) => item.pctUtilizacao,
          threshold: goals.coletores.threshold,
          getThreshold: (item) => item.goal ?? metaFilial('coletores', item.group),
          mode: goals.coletores.mode,
          thresholdLabel: goals.coletores.label,
          isDark,
          tooltipLines: (item) => [
            `Utilização: ${formatarPorcentagem(item.pctUtilizacao)}`,
            `Meta: ${formatarPorcentagem(item.goal ?? metaFilial('coletores', item.group))}`,
            `Diferença: ${formatarDiferencaMeta(item.pctUtilizacao, item.goal ?? metaFilial('coletores', item.group))}`,
            `Ordens de conferência: ${formatarNumero(item.manifestosBipados)}`,
            `Manifestos criados: ${formatarNumero(item.manifestosEmitidos)}`,
            `Descarregamento: ${formatarNumero(item.manifestosDescarregamento)}`,
            `Ordens incompletas: ${formatarNumero(item.manifestosIncompletos)}`,
            `Manifestos bipáveis: ${formatarNumero(item.totalManifestos)}`,
          ],
        })
  ), [coletoresRanking, coletoresOverview.data?.pctUtilizacao, goals, isDark, metaFilial]);

  const cubagemChartOption = useMemo(() => (
    cubagemRanking.length <= 1
      ? buildMetaComparisonOption({
          label: cubagemRanking[0]?.group ?? 'Periodo filtrado',
          value: cubagemOverview.data?.pctCubagem ?? 0,
          threshold: goals.cubagem.threshold,
          mode: goals.cubagem.mode,
          thresholdLabel: goals.cubagem.label,
          isDark,
        })
      : buildRankingOption({
          items: cubagemRanking,
          getLabel: (item) => item.group,
          getValue: (item) => item.pctCubagem,
          threshold: goals.cubagem.threshold,
          getThreshold: (item) => metaFilial('cubagem', item.group),
          mode: goals.cubagem.mode,
          thresholdLabel: goals.cubagem.label,
          isDark,
          tooltipLines: (item) => [
            `Meta da filial: ${formatarPorcentagem(metaFilial('cubagem', item.group))}`,
            `Diferença: ${formatarDiferencaMeta(item.pctCubagem, metaFilial('cubagem', item.group))}`,
            `Minutas: ${formatarNumero(item.totalFretes)}`,
            `Cubadas: ${formatarNumero(item.fretesCubados)}`,
            `Sem cubagem: ${formatarNumero(item.fretesNaoCubados)}`,
          ],
        })
  ), [cubagemRanking, cubagemOverview.data?.pctCubagem, goals, isDark, metaFilial]);
  const indenizacaoChartOption = useMemo(() => (
    indenizacaoRanking.length <= 1
      ? buildMetaComparisonOption({
          label: indenizacaoRanking[0]?.group ?? 'Periodo filtrado',
          value: indenizacaoOverview.data?.pctIndenizacao ?? 0,
          threshold: goals.indenizacao.threshold,
          mode: goals.indenizacao.mode,
          thresholdLabel: goals.indenizacao.label,
          isDark,
          valueFormatter: (value) => formatarPorcentagem(value, 2),
          axisFormatter: (value) => formatarPorcentagem(value, 2),
        })
      : buildRankingOption({
          items: indenizacaoRanking,
          getLabel: (item) => item.group,
          getValue: (item) => item.pctIndenizacao,
          threshold: goals.indenizacao.threshold,
          getThreshold: (item) => metaFilial('indenizacao', item.group),
          mode: goals.indenizacao.mode,
          thresholdLabel: goals.indenizacao.label,
          isDark,
          tooltipLines: (item) => [
            `Limite da filial: ${formatarPorcentagem(metaFilial('indenizacao', item.group), 2)}`,
            `Diferença: ${formatarDiferencaMeta(item.pctIndenizacao, metaFilial('indenizacao', item.group))}`,
            `Valor indenizado: ${formatarMoeda(item.valorIndenizadoAbs)}`,
            `Faturamento base: ${formatarMoeda(item.faturamentoBase)}`,
            `Sinistros: ${formatarNumero(item.totalSinistros)}`,
          ],
          valueFormatter: (value) => formatarPorcentagem(value, 2),
          axisFormatter: (value) => formatarPorcentagem(value, 2),
        })
  ), [goals, indenizacaoRanking, indenizacaoOverview.data?.pctIndenizacao, isDark, metaFilial]);

  const horariosChartOption = useMemo(() => (
    horariosRanking.length <= 1
      ? buildMetaComparisonOption({
          label: horariosRanking[0]?.group ?? 'Periodo filtrado',
          value: horariosOverview.data?.pctNoHorario ?? 0,
          threshold: goals.horarios.threshold,
          mode: goals.horarios.mode,
          thresholdLabel: goals.horarios.label,
          isDark,
        })
      : buildRankingOption({
          items: horariosRanking,
          getLabel: (item) => item.group,
          getValue: (item) => item.pctNoHorario,
          threshold: goals.horarios.threshold,
          getThreshold: (item) => metaFilial('horarios', item.group),
          mode: goals.horarios.mode,
          thresholdLabel: goals.horarios.label,
          isDark,
          tooltipLines: (item) => [
            `Meta da filial: ${formatarPorcentagem(metaFilial('horarios', item.group))}`,
            `Diferença: ${formatarDiferencaMeta(item.pctNoHorario, metaFilial('horarios', item.group))}`,
            `Programado: ${formatarNumero(item.totalProgramado)}`,
            `No horario: ${formatarNumero(item.saidasNoHorario)}`,
            `Fora do horario: ${formatarNumero(item.saidasForaDoHorario)}`,
          ],
        })
  ), [goals, horariosRanking, horariosOverview.data?.pctNoHorario, isDark, metaFilial]);

  const performanceColumns: ColunaTabela<PerformanceEntregaRow>[] = [
    { chave: 'numeroMinuta', label: 'Minuta', fixo: true },
    { chave: 'dataFrete', label: 'Data Frete', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'filialPerformance', label: 'Filial Performance', largura: '240px' },
    { chave: 'filialEmissora', label: 'Filial Emissora' },
    { chave: 'previsaoEntrega', label: 'Previsão', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'dataFinalizacao', label: 'Finalização', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'performanceDiferencaDias', label: 'Dif. Dias', formato: (v) => v == null ? '—' : formatarNumero(Number(v)) },
    { chave: 'performanceStatus', label: 'Status', formato: (v) => <StatusBadge status={String(v ?? 'SEM DADO')} /> },
  ];
  const coletoresColumns: ColunaTabela<UtilizacaoColetoresRow>[] = [
    { chave: 'date', label: 'Data', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'filial', label: 'Filial', fixo: true },
    { chave: 'classificacao', label: 'Classificação' },
    { chave: 'manifestosBipados', label: 'Ordens de Conferência', formato: (v) => formatarNumero(Number(v ?? 0)) },
    { chave: 'manifestosEmitidos', label: 'Manifestos Criados', formato: (v) => formatarNumero(Number(v ?? 0)) },
    { chave: 'manifestosDescarregamento', label: 'Descarreg.', formato: (v) => formatarNumero(Number(v ?? 0)) },
    { chave: 'totalManifestos', label: 'Manifestos Bipáveis', formato: (v) => formatarNumero(Number(v ?? 0)) },
    { chave: 'manifestosIncompletos', label: 'Ordens Incompletas', formato: (v) => formatarNumero(Number(v ?? 0)) },
    { chave: 'pctUtilizacao', label: '% Utilização', formato: (v) => formatarPorcentagem(Number(v ?? 0)) },
  ];
  const cubagemColumns: ColunaTabela<CubagemMercadoriasRow>[] = [
    { chave: 'numeroMinuta', label: 'Minuta', fixo: true },
    { chave: 'dataFrete', label: 'Data Frete', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'filialEmissora', label: 'Filial Emissora' },
    { chave: 'pagador', label: 'Pagador', largura: '220px' },
    { chave: 'remetenteDocumento', label: 'Pagador Doc', largura: '160px' },
    { chave: 'destino', label: 'Destino' },
    { chave: 'pesoTaxado', label: 'Peso Taxado', formato: (v) => formatarNumero(Number(v ?? 0), 2) },
    { chave: 'pesoReal', label: 'Peso Real', formato: (v) => formatarNumero(Number(v ?? 0), 2) },
    { chave: 'pesoCubado', label: 'Peso Cubado', formato: (v) => formatarNumero(Number(v ?? 0), 2) },
    { chave: 'totalM3', label: 'Total M3', formato: (v) => formatarNumero(Number(v ?? 0), 3) },
    { chave: 'cubado', label: 'Cubado', formato: (v) => <StatusBadge status={v ? 'SIM' : 'NAO'} /> },
  ];
  const indenizacaoColumns: ColunaTabela<IndenizacaoMercadoriasRow>[] = [
    { chave: 'numeroSinistro', label: 'Sinistro', fixo: true },
    { chave: 'dataFinalizacao', label: 'Data Abertura', formato: (v) => v ? formatarData(String(v)) : '—' },
    { chave: 'filial', label: 'Filial Indenização' },
    { chave: 'minuta', label: 'Minuta', formato: (v) => v == null ? '—' : formatarNumero(Number(v)) },
    { chave: 'resultadoFinalOriginal', label: 'Valor a Pagar Cliente', formato: (v) => formatarMoeda(Number(v ?? 0)) },
    { chave: 'resultadoFinalAbs', label: 'Valor Indenizado', formato: (v) => formatarMoeda(Number(v ?? 0)) },
    { chave: 'pctSobreFaturamentoFilial', label: '% Fat. Filial', formato: (v) => formatarPorcentagem(Number(v ?? 0), 2) },
    { chave: 'causaRaiz', label: 'Causa Raiz', largura: '220px' },
    { chave: 'solucao', label: 'Solução', largura: '220px' },
  ];
  const horariosColumns: ColunaTabelaAnalitica<HorarioCorteRow>[] = [
    { chave: 'id', label: 'ID', fixo: true, filtravel: false },
    { chave: 'data', label: 'Data', formato: (v) => v ? formatarData(String(v)) : '—', filtravel: false },
    { chave: 'filial', label: 'Filial' },
    { chave: 'linhaOuOperacao', label: 'Linha/Operação', largura: '220px' },
    { chave: 'origemSm', label: 'Origem SM', largura: '180px', filtravel: false },
    { chave: 'destinoSm', label: 'Destino SM', largura: '180px', filtravel: false },
    { chave: 'origemDestino', label: 'Origem x Destino', largura: '240px', filtravel: false },
    { chave: 'origem', label: 'Origem', filtravel: false },
    { chave: 'ordem', label: 'Ordem', filtravel: false },
    { chave: 'destino', label: 'Destino', filtravel: false },
    { chave: 'horarioCorteSm', label: 'Horário Corte', filtravel: false },
    { chave: 'previsaoChegadaDestino', label: 'Prev. Chegada', filtravel: false },
    { chave: 'transitTime', label: 'Transit Time', filtravel: false },
    { chave: 'inicio', label: 'Início', filtravel: false },
    { chave: 'manifestado', label: 'Manifestado', filtravel: false },
    { chave: 'smGerada', label: 'SM Gerada', filtravel: false },
    { chave: 'corte', label: 'Corte', filtravel: false },
    { chave: 'saiuNoHorario', label: 'Status', filtroTabela: 'status', formato: (v) => <StatusBadge status={v === true ? 'NO PRAZO' : v === false ? 'FORA DO PRAZO' : 'SEM DADO'} /> },
    { chave: 'atrasoMinutos', label: 'Atraso (min)', formato: (v) => v == null ? '—' : formatarNumero(Number(v)), filtravel: false },
    {
      chave: 'acaoJustificativa',
      label: 'Justificar',
      largura: '120px',
      alinhamento: 'center',
      filtravel: false,
      formato: (_v, row) => {
        const possuiJustificativa = Boolean(row.justificativa?.trim());
        const podeJustificar = row.saiuNoHorario === false || possuiJustificativa;

        if (!podeJustificar) {
          return '—';
        }

        return (
          <button
            type="button"
            onClick={() => setHorarioCorteJustificativaSelecionada({ codSolicitacao: row.id, justificativa: row.justificativa })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={possuiJustificativa
              ? { borderColor: 'rgba(22, 163, 74, 0.45)', color: '#16a34a', backgroundColor: 'rgba(22, 163, 74, 0.08)' }
              : { borderColor: 'var(--color-border)', color: 'var(--color-primary)' }}
            aria-label={possuiJustificativa ? `SM ${row.id} justificada` : `Justificar SM ${row.id}`}
            title={possuiJustificativa ? 'Justificado' : 'Justificar SM'}
          >
            {possuiJustificativa ? <CheckCircle2 size={15} /> : <MessageSquarePlus size={15} />}
          </button>
        );
      },
    },
    { chave: 'observacao', label: 'Observação', largura: '260px', filtravel: false },
    { chave: 'nomeArquivo', label: 'Fonte', largura: '220px', filtravel: false },
    { chave: 'importadoEm', label: 'Extraído em', formato: (v) => v ? formatarDataHora(String(v)) : '—', filtravel: false },
    { chave: 'importadoPor', label: 'Origem técnica', filtravel: false },
  ];

  const toggleSection = (sectionId: SectionId) => setExpandedSection((current) => current === sectionId ? null : sectionId);

  const horariosFonteBox = (
    <div className="mb-5 rounded-[20px] border p-4 shadow-sm" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          <Clock3 size={17} />
          Fonte Raster via SQL Server
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Última extração: {horariosOverview.data?.ultimaImportacaoEm ? formatarDataHora(horariosOverview.data.ultimaImportacaoEm) : '—'}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Fonte: {horariosOverview.data?.ultimaImportacaoArquivo ?? 'Raster API - SQL Server'}
        </div>
        <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Regra: início real da viagem comparado com a data de fim da viagem somada ao horário de corte da rota.
        </div>
      </div>
    </div>
  );

  const coletoresFilterBox = (
    <div className="mb-4 rounded-[20px] border px-4 py-3" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>
        Regra operacional
      </div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        Ordens de conferência distintas sobre manifestos bipáveis do período.
      </div>
    </div>
  );

  const performanceForaPrazo = performanceOverview.data?.entregasForaDoPrazo ?? 0;
  const cubagemNaoCubados = Math.max((cubagemOverview.data?.totalFretes ?? 0) - (cubagemOverview.data?.fretesCubados ?? 0), 0);
  const horariosForaHorario = Math.max((horariosOverview.data?.totalProgramado ?? 0) - (horariosOverview.data?.saidasNoHorario ?? 0), 0);
  const panoramaItems: PanoramaOperacionalItem[] = [
    {
      id: 'performance',
      definition: KpiDictionary.gestaoAVista.resumo.performanceFretes,
      title: 'Nova Tela de Fretes - Performance',
      value: formatarPorcentagem(performanceOverview.data?.pctNoPrazo ?? 0),
      statusLabel: performanceAssessment.label,
      tone: performanceAssessment.tone,
      progressPct: performanceAssessment.progressPct,
      detail: `${formatarNumero(performanceOverview.data?.entregasNoPrazo ?? 0)} no prazo / ${formatarNumero(performanceOverview.data?.totalEntregas ?? 0)} entregas · ${goals.performance.label}`,
      alertDetail: `${performanceGapLabel} · ${formatarNumero(performanceOverview.data?.entregasNoPrazo ?? 0)} no prazo de ${formatarNumero(performanceOverview.data?.totalEntregas ?? 0)}`,
      severityScore: calcularDistanciaRelativaMeta(performanceOverview.data?.pctNoPrazo ?? 0, goals.performance.threshold, goals.performance.mode),
      icon: <Truck size={16} />,
    },
    {
      id: 'coletores',
      definition: KpiDictionary.gestaoAVista.resumo.utilizacaoColetores,
      title: 'Utilização dos Coletores',
      value: formatarPorcentagem(coletoresOverview.data?.pctUtilizacao ?? 0),
      statusLabel: coletoresAssessment.label,
      tone: coletoresAssessment.tone,
      progressPct: coletoresAssessment.progressPct,
      detail: `${formatarNumero(coletoresOverview.data?.manifestosBipados ?? 0)} ordens / ${formatarNumero(coletoresOverview.data?.totalManifestos ?? 0)} manifestos bipáveis · ${goals.coletores.label}`,
      alertDetail: `${coletoresGapLabel} · ${formatarNumero(coletoresOverview.data?.manifestosBipados ?? 0)} ordens sobre ${formatarNumero(coletoresOverview.data?.totalManifestos ?? 0)} manifestos bipáveis`,
      severityScore: calcularDistanciaRelativaMeta(coletoresOverview.data?.pctUtilizacao ?? 0, goals.coletores.threshold, goals.coletores.mode),
      icon: <Boxes size={16} />,
    },
    {
      id: 'cubagem',
      definition: KpiDictionary.gestaoAVista.resumo.cubagemMercadorias,
      title: 'Cubagem de Mercadorias',
      value: formatarPorcentagem(cubagemOverview.data?.pctCubagem ?? 0),
      statusLabel: cubagemAssessment.label,
      tone: cubagemAssessment.tone,
      progressPct: cubagemAssessment.progressPct,
      detail: `${formatarNumero(cubagemOverview.data?.fretesCubados ?? 0)} cubadas / ${formatarNumero(cubagemOverview.data?.totalFretes ?? 0)} minutas · ${goals.cubagem.label}`,
      alertDetail: `${cubagemGapLabel} · ${formatarNumero(cubagemOverview.data?.fretesCubados ?? 0)} minutas cubadas de ${formatarNumero(cubagemOverview.data?.totalFretes ?? 0)}`,
      severityScore: calcularDistanciaRelativaMeta(cubagemOverview.data?.pctCubagem ?? 0, goals.cubagem.threshold, goals.cubagem.mode),
      icon: <PackageCheck size={16} />,
    },
    {
      id: 'indenizacao',
      definition: KpiDictionary.gestaoAVista.resumo.indenizacaoMercadorias,
      title: 'Indenização de Mercadorias',
      value: formatarPorcentagem(indenizacaoOverview.data?.pctIndenizacao ?? 0, 2),
      statusLabel: indenizacaoAssessment.label,
      tone: indenizacaoAssessment.tone,
      progressPct: indenizacaoAssessment.progressPct,
      detail: `${formatarMoeda(indenizacaoOverview.data?.valorIndenizadoAbs ?? 0)} / ${formatarMoeda(indenizacaoOverview.data?.faturamentoBase ?? 0)} · ${goals.indenizacao.label}`,
      alertDetail: `${indenizacaoGapLabel} · ${formatarMoeda(indenizacaoOverview.data?.valorIndenizadoAbs ?? 0)} indenizados`,
      severityScore: calcularDistanciaRelativaMeta(indenizacaoOverview.data?.pctIndenizacao ?? 0, goals.indenizacao.threshold, goals.indenizacao.mode),
      icon: <ShieldAlert size={16} />,
    },
    {
      id: 'horarios',
      definition: KpiDictionary.gestaoAVista.resumo.horariosCorte,
      title: 'Horários de Corte',
      value: formatarPorcentagem(horariosOverview.data?.pctNoHorario ?? 0),
      statusLabel: horariosAssessment.label,
      tone: horariosAssessment.tone,
      progressPct: horariosAssessment.progressPct,
      detail: `${formatarNumero(horariosOverview.data?.saidasNoHorario ?? 0)} no horário / ${formatarNumero(horariosOverview.data?.totalProgramado ?? 0)} saídas · ${goals.horarios.label}`,
      alertDetail: `${horariosGapLabel} · ${formatarNumero(horariosOverview.data?.saidasNoHorario ?? 0)} de ${formatarNumero(horariosOverview.data?.totalProgramado ?? 0)} no horário`,
      severityScore: calcularDistanciaRelativaMeta(horariosOverview.data?.pctNoHorario ?? 0, goals.horarios.threshold, goals.horarios.mode),
      icon: <Clock3 size={16} />,
    },
  ];

  return (
    <div className="w-full" data-indicadores-gestao-top>
      <FilterBar
        period={(
          <DateRangePicker dataInicio={dataInicioIndicadores} dataFim={dataFimIndicadores} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
        )}
        onClear={limparFiltros}
        activeFilters={activeFilters}
        dataInicio={dataInicioIndicadores}
        dataFim={dataFimIndicadores}
        actions={canManageKpiGoals ? (
          <button
            type="button"
            onClick={abrirGerenciadorMetas}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-[var(--color-bg)] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{ color: 'var(--color-text)' }}
          >
            <Settings size={14} aria-hidden="true" />
            Gerenciar Metas
          </button>
        ) : null}
      >
        <FiliaisParceirosFilter
          filialLabel="Filial base"
          parceiroLabel="Parceiro logístico base"
          opcoes={filiais.data ?? []}
          filiaisSelecionadas={filtros.filiais ?? []}
          parceirosSelecionados={filtros.parceirosLogisticos ?? []}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
      </FilterBar>

      {canManageKpiGoals ? (
        <KpiGoalsManagerPanel
          open={goalsPanelOpen}
          branchId={goalsPanelBranchId}
          competencia={goalsPanelCompetencia}
          branchOptions={goalBranchOptions}
          data={managerKpiGoals.data}
          history={managerHistory.data}
          historyPage={goalsHistoryPage}
          isLoading={managerKpiGoals.isLoading}
          isHistoryLoading={managerHistory.isLoading}
          isSaving={managerIsSaving}
          error={managerKpiGoals.error}
          saveError={managerSaveError}
          onBranchChange={alterarFilialPainelMetas}
          onCompetenciaChange={alterarCompetenciaPainelMetas}
          onApplyGlobal={aplicarMetasGlobais}
          onSaveBranch={salvarMetasFilial}
          onRemoveOverride={removerOverrideFilial}
          onHistoryPageChange={setGoalsHistoryPage}
        />
      ) : null}

      <div className="gestao-scoreboard" role="group" aria-label="Resultados dos indicadores de gestão">
        <IndicadoresGestaoSummaryCard
          definition={KpiDictionary.gestaoAVista.resumo.performanceFretes}
          title="Nova Tela de Fretes = Performance"
          description="Pontualidade por previsão de entrega, incluindo registros em aberto no denominador."
          value={formatarPorcentagem(performanceOverview.data?.pctNoPrazo ?? 0)}
          detail={`${formatarNumero(performanceOverview.data?.entregasNoPrazo ?? 0)} no prazo de ${formatarNumero(performanceOverview.data?.totalEntregas ?? 0)} · ${performanceGapLabel}`}
          goalLabel={goals.performance.label}
          statusLabel={performanceAssessment.label}
          tone={performanceAssessment.tone}
          progressPct={performanceAssessment.progressPct}
          icon={<Truck size={18} />}
        />
        <IndicadoresGestaoSummaryCard
          definition={KpiDictionary.gestaoAVista.resumo.utilizacaoColetores}
          title="Utilização dos Coletores"
          description="Aderência operacional da conferência."
          value={formatarPorcentagem(coletoresOverview.data?.pctUtilizacao ?? 0)}
          detail={`${formatarNumero(coletoresOverview.data?.manifestosBipados ?? 0)} ordens sobre ${formatarNumero(coletoresOverview.data?.totalManifestos ?? 0)} manifestos bipáveis · ${coletoresGapLabel}`}
          goalLabel={goals.coletores.label}
          statusLabel={coletoresAssessment.label}
          tone={coletoresAssessment.tone}
          progressPct={coletoresAssessment.progressPct}
          icon={<Boxes size={18} />}
        />
        <IndicadoresGestaoSummaryCard
          definition={KpiDictionary.gestaoAVista.resumo.cubagemMercadorias}
          title="Cubagem de Mercadorias"
          description="Cobertura de cubagem das minutas emitidas."
          value={formatarPorcentagem(cubagemOverview.data?.pctCubagem ?? 0)}
          detail={`${formatarNumero(cubagemOverview.data?.fretesCubados ?? 0)} cubadas de ${formatarNumero(cubagemOverview.data?.totalFretes ?? 0)} minutas · ${cubagemGapLabel}`}
          goalLabel={goals.cubagem.label}
          statusLabel={cubagemAssessment.label}
          tone={cubagemAssessment.tone}
          progressPct={cubagemAssessment.progressPct}
          icon={<PackageCheck size={18} />}
        />
        <IndicadoresGestaoSummaryCard
          definition={KpiDictionary.gestaoAVista.resumo.indenizacaoMercadorias}
          title="Indenização de Mercadorias"
          description="Valor a pagar ao cliente por abertura do sinistro sobre o faturamento da filial."
          value={formatarPorcentagem(indenizacaoOverview.data?.pctIndenizacao ?? 0, 2)}
          detail={`${formatarMoeda(indenizacaoOverview.data?.valorIndenizadoAbs ?? 0)} indenizados · ${indenizacaoGapLabel}`}
          goalLabel={goals.indenizacao.label}
          statusLabel={indenizacaoAssessment.label}
          tone={indenizacaoAssessment.tone}
          progressPct={indenizacaoAssessment.progressPct}
          icon={<ShieldAlert size={18} />}
        />
        <IndicadoresGestaoSummaryCard
          definition={KpiDictionary.gestaoAVista.resumo.horariosCorte}
          title="Horários de Corte"
          description="Pontualidade das saídas programadas."
          value={formatarPorcentagem(horariosOverview.data?.pctNoHorario ?? 0)}
          detail={`${formatarNumero(horariosOverview.data?.saidasNoHorario ?? 0)} no horário de ${formatarNumero(horariosOverview.data?.totalProgramado ?? 0)} · ${horariosGapLabel}`}
          goalLabel={goals.horarios.label}
          statusLabel={horariosAssessment.label}
          tone={horariosAssessment.tone}
          progressPct={horariosAssessment.progressPct}
          icon={<Clock3 size={18} />}
        />
      </div>

      <IndicadoresGestaoPanoramaSection items={panoramaItems} />

      <IndicadoresGestaoSection
        title="Nova Tela de Fretes = Performance"
        description="Performance de entrega com drill-down por responsável, região e cidade, usando previsão de entrega e registros em aberto no denominador."
        goalLabel={goals.performance.label}
        goalTone={performanceAssessment.tone}
        error={performanceOverview.error}
        goalOverridesNotice={goalOverridesNotice('delivery_performance')}
        kpis={[
          { definition: KpiDictionary.gestaoAVista.performance.totalEntregas, label: 'Total de Entregas', value: formatarNumero(performanceOverview.data?.totalEntregas ?? 0), icon: <Truck size={16} />, progressPct: performanceAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.performance.foraDoPrazo, label: 'Entregas Fora do Prazo', value: formatarNumero(performanceForaPrazo), icon: <AlertCircle size={16} />, progressPct: performanceAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.performance.noPrazo, label: 'Entregas No Prazo', value: formatarNumero(performanceOverview.data?.entregasNoPrazo ?? 0), icon: <Truck size={16} />, progressPct: performanceAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.performance.gapMeta, label: `Gap vs ${goals.performance.label.toLowerCase()}`, value: performanceGapLabel, icon: <Gauge size={16} />, progressPct: performanceAssessment.progressPct },
        ]}
        chartTitle={performanceChartTitle}
        chartOption={performanceChartOption}
        chartKey="gestaoPerformanceRanking"
        chartActions={performanceChartActions}
        chartEvents={performanceChartEvents}
        chartLoading={performanceSerie.isLoading}
        chartEmpty={performanceRanking.length === 0}
        chartError={performanceSerie.isError ? getApiErrorMessage(performanceSerie.error, 'Erro ao carregar gráfico.') : null}
        exportName="indicadores-gestao-a-vista-performance-entrega"
        onExport={() => exportarPerformanceEntregaCsv(filtroBase)}
        tableTitle="Entregas Analíticas por Minuta"
        tableData={performanceTabela.data?.conteudo ?? []}
        tableColumns={performanceColumns}
        rowKey="numeroMinuta"
        tableLoading={performanceTabela.isLoading}
        tableError={performanceTabela.error}
        tableTotal={performanceTabela.data?.totalElementos}
        tablePage={performancePaginacao.pagina}
        tablePageSize={performancePaginacao.tamanhoPagina}
        onTablePageChange={performancePaginacao.setPagina}
        onTablePageSizeChange={performancePaginacao.setTamanhoPagina}
        isExpanded={expandedSection === 'performance'}
        onToggleTable={() => toggleSection('performance')}
      />

      <IndicadoresGestaoSection
        title="Utilização dos Coletores"
        description="Filiais com menor utilização operacional de coletores no período."
        goalLabel={goals.coletores.label}
        goalTone={coletoresAssessment.tone}
        error={coletoresOverview.error}
        goalOverridesNotice={goalOverridesNotice('collector_usage')}
        extra={coletoresFilterBox}
        kpis={[
          { definition: KpiDictionary.gestaoAVista.coletores.ordensConferencia, label: 'Ordens de Conferência', value: formatarNumero(coletoresOverview.data?.manifestosBipados ?? 0), icon: <Boxes size={16} />, progressPct: coletoresAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.coletores.manifestosBipaveis, label: 'Manifestos Bipáveis', value: formatarNumero(coletoresOverview.data?.totalManifestos ?? 0), icon: <BarChart3 size={16} />, progressPct: coletoresAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.coletores.descarregamentos, label: 'Descarregamentos', value: formatarNumero(coletoresOverview.data?.manifestosDescarregamento ?? 0), icon: <Truck size={16} />, progressPct: coletoresAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.coletores.ordensIncompletas, label: 'Ordens Incompletas', value: formatarNumero(coletoresOverview.data?.manifestosIncompletos ?? 0), icon: <AlertCircle size={16} />, progressPct: coletoresAssessment.progressPct },
        ]}
        chartTitle={coletoresRanking.length <= 1 ? 'Comparativo contra meta' : 'Filiais com menor utilização'}
        chartOption={coletoresChartOption}
        chartKey="gestaoColetoresRanking"
        chartLoading={coletoresRankingQuery.isLoading}
        chartEmpty={coletoresRanking.length === 0}
        chartError={coletoresRankingQuery.isError ? getApiErrorMessage(coletoresRankingQuery.error, 'Erro ao carregar gráfico.') : null}
        exportName="indicadores-gestao-a-vista-utilizacao-coletores"
        onExport={() => exportarUtilizacaoColetoresCsv(filtroColetores)}
        tableTitle="Coletores por Data e Filial"
        tableData={coletoresTabela.data?.conteudo ?? []}
        tableColumns={coletoresColumns}
        rowKey="chave"
        tableLoading={coletoresTabela.isLoading}
        tableError={coletoresTabela.error}
        tableTotal={coletoresTabela.data?.totalElementos}
        tablePage={coletoresPaginacao.pagina}
        tablePageSize={coletoresPaginacao.tamanhoPagina}
        onTablePageChange={coletoresPaginacao.setPagina}
        onTablePageSizeChange={coletoresPaginacao.setTamanhoPagina}
        isExpanded={expandedSection === 'coletores'}
        onToggleTable={() => toggleSection('coletores')}
      />

      <IndicadoresGestaoSection
        title="Cubagem de Mercadorias"
        description="Filiais com menor cubagem por minuta emitida nao cancelada, considerando apenas `Total M3 > 0` ou `Peso Cubado > 0`."
        goalLabel={goals.cubagem.label}
        goalTone={cubagemAssessment.tone}
        error={cubagemOverview.error}
        goalOverridesNotice={goalOverridesNotice('cargo_cubage')}
        alert={<div className="mb-4 rounded-xl border border-dashed px-3 py-3 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>A regra oficial considera `Status != CANCELADO`, cubagem por `Total M3` ou `Peso Cubado` e exclusão pelo flag legado da fato mais a whitelist de clientes sem cubagem importada por CNPJ do pagador.</div>}
        extra={<CubagemClientesExcecaoPanel onImportClick={() => setCubagemImportModalOpen(true)} />}
        kpis={[
          { definition: KpiDictionary.gestaoAVista.cubagem.minutasCubadas, label: 'Minutas Cubadas', value: formatarNumero(cubagemOverview.data?.fretesCubados ?? 0), icon: <PackageCheck size={16} />, progressPct: cubagemAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.cubagem.minutasSemCubagem, label: 'Minutas Sem Cubagem', value: formatarNumero(cubagemNaoCubados), icon: <AlertCircle size={16} />, progressPct: cubagemAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.cubagem.minutasComPesoReal, label: 'Minutas com Peso Real', value: formatarNumero(cubagemOverview.data?.fretesComPesoReal ?? 0), icon: <BarChart3 size={16} />, progressPct: cubagemAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.cubagem.gapMeta, label: `Gap vs ${goals.cubagem.label.toLowerCase()}`, value: cubagemGapLabel, icon: <Gauge size={16} />, progressPct: cubagemAssessment.progressPct },
        ]}
        chartTitle={cubagemRanking.length <= 1 ? 'Comparativo contra meta' : 'Filiais com menor cubagem por minuta'}
        chartOption={cubagemChartOption}
        chartKey="gestaoCubagemRanking"
        chartLoading={cubagemSerie.isLoading}
        chartEmpty={cubagemRanking.length === 0}
        chartError={cubagemSerie.isError ? getApiErrorMessage(cubagemSerie.error, 'Erro ao carregar gráfico.') : null}
        exportName="indicadores-gestao-a-vista-cubagem-mercadorias"
        onExport={() => exportarCubagemMercadoriasCsv(filtroBase)}
        tableTitle="Cubagem Analítica por Minuta"
        tableData={cubagemTabela.data?.conteudo ?? []}
        tableColumns={cubagemColumns}
        rowKey="numeroMinuta"
        tableLoading={cubagemTabela.isLoading}
        tableError={cubagemTabela.error}
        tableTotal={cubagemTabela.data?.totalElementos}
        tablePage={cubagemPaginacao.pagina}
        tablePageSize={cubagemPaginacao.tamanhoPagina}
        onTablePageChange={cubagemPaginacao.setPagina}
        onTablePageSizeChange={cubagemPaginacao.setTamanhoPagina}
        isExpanded={expandedSection === 'cubagem'}
        onToggleTable={() => toggleSection('cubagem')}
      />

      <IndicadoresGestaoSection
        title="Indenização de Mercadorias"
        description="Filiais com maior impacto percentual por data de abertura do sinistro."
        goalLabel={goals.indenizacao.label}
        goalTone={indenizacaoAssessment.tone}
        error={indenizacaoOverview.error}
        goalOverridesNotice={goalOverridesNotice('cargo_indemnity')}
        alert={<div className="mb-4 rounded-xl border border-dashed px-3 py-3 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>A competência do custo segue `Data abertura` e o numerador usa `valor a pagar ao cliente`. O faturamento base continua vindo de `Valor Total do Serviço`.</div>}
        kpis={[
          { definition: KpiDictionary.gestaoAVista.indenizacao.valorIndenizado, label: 'Valor Indenizado', value: formatarMoeda(indenizacaoOverview.data?.valorIndenizadoAbs ?? 0), icon: <ShieldAlert size={16} />, progressPct: indenizacaoAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.indenizacao.totalSinistros, label: 'Total de Sinistros', value: formatarNumero(indenizacaoOverview.data?.totalSinistros ?? 0), icon: <ShieldAlert size={16} />, progressPct: indenizacaoAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.indenizacao.faturamentoBase, label: 'Faturamento Base', value: formatarMoeda(indenizacaoOverview.data?.faturamentoBase ?? 0), icon: <BarChart3 size={16} />, progressPct: indenizacaoAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.indenizacao.acimaDoLimite, label: `Acima do ${goals.indenizacao.label.toLowerCase()}`, value: indenizacaoGapLabel, icon: <Gauge size={16} />, progressPct: indenizacaoAssessment.progressPct },
        ]}
        chartTitle={indenizacaoRanking.length <= 1 ? 'Comparativo contra limite' : 'Filiais com maior impacto por abertura de sinistro'}
        chartOption={indenizacaoChartOption}
        chartKey="gestaoIndenizacaoRanking"
        chartLoading={indenizacaoSerie.isLoading}
        chartEmpty={indenizacaoRanking.length === 0}
        chartError={indenizacaoSerie.isError ? getApiErrorMessage(indenizacaoSerie.error, 'Erro ao carregar gráfico.') : null}
        exportName="indicadores-gestao-a-vista-indenizacao-mercadorias"
        onExport={() => exportarIndenizacaoMercadoriasCsv(filtroBase)}
        tableTitle="Sinistros Analíticos por Abertura"
        tableData={indenizacaoTabela.data?.conteudo ?? []}
        tableColumns={indenizacaoColumns}
        rowKey="numeroSinistro"
        tableLoading={indenizacaoTabela.isLoading}
        tableError={indenizacaoTabela.error}
        tableTotal={indenizacaoTabela.data?.totalElementos}
        tablePage={indenizacaoPaginacao.pagina}
        tablePageSize={indenizacaoPaginacao.tamanhoPagina}
        onTablePageChange={indenizacaoPaginacao.setPagina}
        onTablePageSizeChange={indenizacaoPaginacao.setTamanhoPagina}
        isExpanded={expandedSection === 'indenizacao'}
        onToggleTable={() => toggleSection('indenizacao')}
      />

      <IndicadoresGestaoSection
        title="Horários de Corte"
        description="Filiais com menor pontualidade de saída a partir das viagens Raster persistidas no SQL Server."
        goalLabel={goals.horarios.label}
        goalTone={horariosAssessment.tone}
        error={horariosOverview.error}
        goalOverridesNotice={goalOverridesNotice('cutoff_time')}
        extra={horariosFonteBox}
        kpis={[
          { definition: KpiDictionary.gestaoAVista.horariosCorte.saidasNoHorario, label: 'Saídas no horário', value: formatarNumero(horariosOverview.data?.saidasNoHorario ?? 0), icon: <Truck size={16} />, progressPct: horariosAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.horariosCorte.saidasForaHorario, label: 'Saídas fora do horário', value: formatarNumero(horariosForaHorario), icon: <AlertCircle size={16} />, progressPct: horariosAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.horariosCorte.totalProgramado, label: 'Total programado', value: formatarNumero(horariosOverview.data?.totalProgramado ?? 0), icon: <BarChart3 size={16} />, progressPct: horariosAssessment.progressPct },
          { definition: KpiDictionary.gestaoAVista.horariosCorte.gapMeta, label: `Gap vs ${goals.horarios.label.toLowerCase()}`, value: horariosGapLabel, icon: <Gauge size={16} />, progressPct: horariosAssessment.progressPct },
        ]}
        chartTitle={horariosRanking.length <= 1 ? 'Comparativo contra meta' : 'Filiais com menor pontualidade de saída'}
        chartOption={horariosChartOption}
        chartKey="gestaoHorariosRanking"
        chartLoading={horariosSerie.isLoading}
        chartEmpty={horariosRanking.length === 0}
        chartError={horariosSerie.isError ? getApiErrorMessage(horariosSerie.error, 'Erro ao carregar gráfico.') : null}
        exportName="indicadores-gestao-a-vista-horarios-corte"
        onExport={() => exportarHorariosCorteCsv(filtroBase, horariosFiltrosTabela.apiFilters)}
        tableTitle="Horários de Corte Analíticos"
        tableData={horariosTabela.data?.conteudo ?? []}
        tableColumns={horariosColumns}
        rowKey="id"
        tableLoading={horariosTabela.isLoading}
        tableFetching={horariosTabela.isFetching}
        tableError={horariosTabela.error}
        tableTotal={horariosTabela.data?.totalElementos}
        tablePage={horariosPaginacao.pagina}
        tablePageSize={horariosPaginacao.tamanhoPagina}
        onTablePageChange={horariosPaginacao.setPagina}
        onTablePageSizeChange={horariosPaginacao.setTamanhoPagina}
        tableFilters={horariosFiltrosTabela.filters}
        tableHiddenActiveCount={horariosFiltrosTabela.hiddenActiveCount}
        tableHasAnyFilter={horariosFiltrosTabela.hasAnyFilter}
        onTableTextFilterChange={horariosFiltrosTabela.setTextFilter}
        onTableMultiFilterChange={horariosFiltrosTabela.setMultiFilter}
        onTableColumnFilterChange={horariosFiltrosTabela.setColumnFilter}
        onTableClearFilters={horariosFiltrosTabela.clearTableFilters}
        tableStatusOptions={HORARIOS_CORTE_STATUS_OPTIONS}
        isExpanded={expandedSection === 'horarios'}
        onToggleTable={() => toggleSection('horarios')}
      />

      <JustificativaHorarioCorteModal
        codSolicitacao={horarioCorteJustificativaSelecionada?.codSolicitacao ?? null}
        justificativaAtual={horarioCorteJustificativaSelecionada?.justificativa ?? null}
        isSubmitting={salvarJustificativaHorarioCorte.isPending}
        isDeleting={excluirJustificativaHorarioCorte.isPending}
        onClose={() => {
          if (!salvarJustificativaHorarioCorte.isPending && !excluirJustificativaHorarioCorte.isPending) {
            setHorarioCorteJustificativaSelecionada(null);
          }
        }}
        onSubmit={salvarJustificativaSm}
        onDelete={excluirJustificativaSm}
      />
      <CubagemClientesImportacaoModal
        open={cubagemImportModalOpen}
        onClose={() => setCubagemImportModalOpen(false)}
      />
    </div>
  );
}
