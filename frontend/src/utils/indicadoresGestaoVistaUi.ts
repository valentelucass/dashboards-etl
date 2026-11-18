import type { ProgressBarVariant } from '@astryxdesign/core/ProgressBar';
import type {
  CubagemMercadoriasSeriePoint,
  HorariosCorteSeriePoint,
  IndenizacaoMercadoriasSeriePoint,
  PerformanceEntregaSeriePoint,
  UtilizacaoColetoresSeriePoint,
} from '../types/indicadoresGestaoAVista';

export type GoalMode = 'atLeast' | 'atMost';
export type GoalTone = 'positive' | 'warning' | 'negative' | 'neutral' | 'loading' | 'error' | 'empty';

export const goalProgressVariant = {
  positive: 'success',
  warning: 'warning',
  negative: 'error',
  error: 'error',
  neutral: 'neutral',
  loading: 'neutral',
  empty: 'neutral',
} satisfies Record<GoalTone, ProgressBarVariant>;

export const GOAL_WARNING_PROGRESS_PCT = 50;

export interface GoalToneStyle {
  border: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  track: string;
  fill: string;
}

export interface GoalAssessment {
  tone: GoalTone;
  label: string;
  met: boolean | null;
  delta: number | null;
  progressPct: number | null;
}

export interface PerformanceRankingItem {
  group: string;
  filtro?: string | null;
  pctNoPrazo: number;
  totalEntregas: number;
  entregasNoPrazo: number;
  entregasForaDoPrazo: number;
}

export interface UtilizacaoRankingItem {
  group: string;
  branchId?: string;
  branchName?: string;
  goal?: number;
  pctUtilizacao: number;
  manifestosBipados: number;
  manifestosEmitidos: number;
  manifestosDescarregamento: number;
  totalManifestos: number;
  manifestosIncompletos: number;
}

export interface CubagemRankingItem {
  group: string;
  pctCubagem: number;
  totalFretes: number;
  fretesCubados: number;
  fretesNaoCubados: number;
}

export interface IndenizacaoRankingItem {
  group: string;
  pctIndenizacao: number;
  totalSinistros: number;
  valorIndenizadoOriginal: number;
  valorIndenizadoAbs: number;
  faturamentoBase: number;
}

export interface HorariosRankingItem {
  group: string;
  pctNoHorario: number;
  saidasNoHorario: number;
  saidasForaDoHorario: number;
  totalProgramado: number;
}

interface GoalAssessmentArgs {
  value: number;
  threshold: number;
  mode: GoalMode;
  hasData: boolean;
  isLoading?: boolean;
  isError?: boolean;
}

function percentual(parte: number, total: number, decimais = 1): number {
  if (total <= 0) {
    return 0;
  }
  const valor = (parte / total) * 100;
  return Number(valor.toFixed(decimais));
}

function groupLabel(value: string | null | undefined, fallback = 'Nao informado'): string {
  return value?.trim() ? value.trim() : fallback;
}

export function getGoalToneStyle(tone: GoalTone): GoalToneStyle {
  const palette: Record<GoalTone, GoalToneStyle> = {
    positive: {
      border: 'var(--color-positive-border, #16a34a)',
      text: 'var(--color-positive-text, #15803d)',
      badgeBg: 'var(--color-positive-badge-bg, rgba(22, 163, 74, 0.14))',
      badgeText: 'var(--color-positive-badge-text, #15803d)',
      track: 'var(--color-positive-track, #bbf7d0)',
      fill: 'var(--color-positive-fill, #16a34a)',
    },
    warning: {
      border: 'var(--color-warning-border, #facc15)',
      text: 'var(--color-warning-text, #713f12)',
      badgeBg: 'var(--color-warning-badge-bg, rgba(250, 204, 21, 0.20))',
      badgeText: 'var(--color-warning-badge-text, #713f12)',
      track: 'var(--color-warning-track, #fef08a)',
      fill: 'var(--color-warning-fill, #facc15)',
    },
    negative: {
      border: 'var(--color-negative-border, #dc2626)',
      text: 'var(--color-negative-text, #b91c1c)',
      badgeBg: 'var(--color-negative-badge-bg, rgba(220, 38, 38, 0.14))',
      badgeText: 'var(--color-negative-badge-text, #b91c1c)',
      track: 'var(--color-negative-track, #fecaca)',
      fill: 'var(--color-negative-fill, #ef4444)',
    },
    neutral: {
      border: '#64748b',
      text: '#475569',
      badgeBg: 'rgba(71, 85, 105, 0.14)',
      badgeText: '#475569',
      track: '#cbd5e1',
      fill: '#64748b',
    },
    loading: {
      border: '#2563eb',
      text: '#1d4ed8',
      badgeBg: 'rgba(37, 99, 235, 0.14)',
      badgeText: '#1d4ed8',
      track: '#bfdbfe',
      fill: '#3b82f6',
    },
    error: {
      border: '#dc2626',
      text: '#b91c1c',
      badgeBg: 'rgba(220, 38, 38, 0.14)',
      badgeText: '#b91c1c',
      track: '#fecaca',
      fill: '#ef4444',
    },
    empty: {
      border: 'var(--color-warning-border, #facc15)',
      text: 'var(--color-warning-text, #713f12)',
      badgeBg: 'var(--color-warning-badge-bg, rgba(250, 204, 21, 0.20))',
      badgeText: 'var(--color-warning-badge-text, #713f12)',
      track: 'var(--color-warning-track, #fef08a)',
      fill: 'var(--color-warning-fill, #facc15)',
    },
  };

  return palette[tone];
}

export function calcularProgressoMeta(value: number, threshold: number, mode: GoalMode): number {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  if (mode === 'atLeast') {
    return Math.max(0, Math.min(100, Number(((value / threshold) * 100).toFixed(1))));
  }

  if (value <= 0) {
    return 100;
  }

  return Math.max(0, Math.min(100, Number(((threshold / value) * 100).toFixed(1))));
}

export function calcularDistanciaRelativaMeta(value: number, threshold: number, mode: GoalMode): number {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) {
    return 0;
  }

  if (mode === 'atLeast') {
    return Number(Math.max((threshold - value) / threshold, 0).toFixed(4));
  }

  return Number(Math.max((value - threshold) / threshold, 0).toFixed(4));
}

export function resolverTomMetaPorProgresso(progressPct: number): GoalTone {
  if (progressPct >= 100) {
    return 'positive';
  }
  if (progressPct >= GOAL_WARNING_PROGRESS_PCT) {
    return 'warning';
  }
  return 'negative';
}

export function resolverTomMetaPorValor(value: number, threshold: number, mode: GoalMode): GoalTone {
  if (!Number.isFinite(value) || !Number.isFinite(threshold) || threshold <= 0) {
    return 'negative';
  }

  if (mode === 'atLeast') {
    if (value >= threshold) {
      return 'positive';
    }
    return value >= GOAL_WARNING_PROGRESS_PCT ? 'warning' : 'negative';
  }

  const progressPct = calcularProgressoMeta(value, threshold, mode);
  return value <= threshold ? 'positive' : resolverTomMetaPorProgresso(progressPct);
}

export function avaliarMetaIndicador({
  value,
  threshold,
  mode,
  hasData,
  isLoading = false,
  isError = false,
}: GoalAssessmentArgs): GoalAssessment {
  if (isError) {
    return { tone: 'error', label: 'Erro tecnico', met: null, delta: null, progressPct: null };
  }

  if (isLoading && !hasData) {
    return { tone: 'loading', label: 'Carregando', met: null, delta: null, progressPct: null };
  }

  if (!hasData) {
    return { tone: 'empty', label: 'Sem dados', met: null, delta: null, progressPct: null };
  }

  const met = mode === 'atLeast' ? value >= threshold : value <= threshold;
  const progressPct = calcularProgressoMeta(value, threshold, mode);
  const tone = resolverTomMetaPorValor(value, threshold, mode);
  return {
    tone,
    label: met ? 'Dentro da meta' : tone === 'warning' ? 'Em atenção' : 'Crítico',
    met,
    delta: Number((value - threshold).toFixed(2)),
    progressPct,
  };
}

export function aggregatePerformanceRanking(points: PerformanceEntregaSeriePoint[]): PerformanceRankingItem[] {
  return points
    .map((item) => ({
      group: groupLabel(item.label, 'Agrupamento nao informado'),
      filtro: item.filtro,
      totalEntregas: item.totalEntregas ?? 0,
      entregasNoPrazo: item.entregasNoPrazo ?? 0,
      entregasForaDoPrazo: item.entregasForaDoPrazo ?? 0,
      pctNoPrazo: item.pctNoPrazo ?? percentual(item.entregasNoPrazo, item.totalEntregas),
    }))
    .sort((left, right) => left.pctNoPrazo - right.pctNoPrazo || right.totalEntregas - left.totalEntregas || left.group.localeCompare(right.group));
}

export function aggregateUtilizacaoRanking(points: UtilizacaoColetoresSeriePoint[]): UtilizacaoRankingItem[] {
  const grouped = new Map<string, Omit<UtilizacaoRankingItem, 'pctUtilizacao'>>();

  for (const point of points) {
    const filial = groupLabel(point.filial, 'Filial nao informada');
    const classificacao = groupLabel(point.classificacao, 'Sem classificacao');
    const key = classificacao.toLocaleLowerCase('pt-BR') === 'geral' ? filial : `${filial} · ${classificacao}`;
    const current = grouped.get(key) ?? {
      group: key,
      manifestosBipados: 0,
      manifestosEmitidos: 0,
      manifestosDescarregamento: 0,
      totalManifestos: 0,
      manifestosIncompletos: 0,
    };

    current.manifestosBipados += point.manifestosBipados ?? 0;
    current.manifestosEmitidos += point.manifestosEmitidos ?? 0;
    current.manifestosDescarregamento += point.manifestosDescarregamento ?? 0;
    current.totalManifestos += point.totalManifestos ?? 0;
    current.manifestosIncompletos += point.manifestosIncompletos ?? 0;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      pctUtilizacao: percentual(item.manifestosBipados, item.totalManifestos),
    }))
    .sort((left, right) => left.pctUtilizacao - right.pctUtilizacao || right.totalManifestos - left.totalManifestos || left.group.localeCompare(right.group));
}

export function aggregateCubagemRanking(points: CubagemMercadoriasSeriePoint[]): CubagemRankingItem[] {
  const grouped = new Map<string, Omit<CubagemRankingItem, 'pctCubagem' | 'fretesNaoCubados'>>();

  for (const point of points) {
    const key = groupLabel(point.filial, 'Filial nao informada');
    const current = grouped.get(key) ?? {
      group: key,
      totalFretes: 0,
      fretesCubados: 0,
    };

    current.totalFretes += point.totalFretes ?? 0;
    current.fretesCubados += point.fretesCubados ?? 0;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      fretesNaoCubados: Math.max(item.totalFretes - item.fretesCubados, 0),
      pctCubagem: percentual(item.fretesCubados, item.totalFretes),
    }))
    .sort((left, right) => left.pctCubagem - right.pctCubagem || right.totalFretes - left.totalFretes || left.group.localeCompare(right.group));
}

export function aggregateIndenizacaoRanking(points: IndenizacaoMercadoriasSeriePoint[]): IndenizacaoRankingItem[] {
  const grouped = new Map<string, Omit<IndenizacaoRankingItem, 'pctIndenizacao' | 'valorIndenizadoAbs'> & { faturamentoPeriodoFilial: number; valorIndenizadoAbsFallback: number; temValorOriginal: boolean }>();

  for (const point of points) {
    const key = groupLabel(point.filial, 'Filial nao informada');
    const current = grouped.get(key) ?? {
      group: key,
      totalSinistros: 0,
      valorIndenizadoOriginal: 0,
      faturamentoBase: 0,
      faturamentoPeriodoFilial: 0,
      valorIndenizadoAbsFallback: 0,
      temValorOriginal: false,
    };

    current.totalSinistros += point.totalSinistros ?? 0;
    current.temValorOriginal = current.temValorOriginal || point.valorIndenizadoOriginal != null;
    current.valorIndenizadoOriginal += point.valorIndenizadoOriginal ?? 0;
    current.valorIndenizadoAbsFallback += point.valorIndenizadoAbs ?? 0;
    current.faturamentoBase += point.faturamentoBase ?? 0;
    current.faturamentoPeriodoFilial = Math.max(current.faturamentoPeriodoFilial, point.faturamentoPeriodoFilial ?? 0);
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => {
      const faturamentoBase = item.faturamentoPeriodoFilial > 0 ? item.faturamentoPeriodoFilial : item.faturamentoBase;
      const valorIndenizadoAbs = item.temValorOriginal
        ? Math.abs(item.valorIndenizadoOriginal)
        : item.valorIndenizadoAbsFallback;
      return {
        group: item.group,
        totalSinistros: item.totalSinistros,
        valorIndenizadoOriginal: Number(item.valorIndenizadoOriginal.toFixed(2)),
        valorIndenizadoAbs: Number(valorIndenizadoAbs.toFixed(2)),
        faturamentoBase: Number(faturamentoBase.toFixed(2)),
        pctIndenizacao: faturamentoBase > 0 ? Number(((valorIndenizadoAbs / faturamentoBase) * 100).toFixed(3)) : 0,
      };
    })
    .sort((left, right) => right.pctIndenizacao - left.pctIndenizacao || right.valorIndenizadoAbs - left.valorIndenizadoAbs || left.group.localeCompare(right.group));
}

export function aggregateHorariosRanking(points: HorariosCorteSeriePoint[]): HorariosRankingItem[] {
  const grouped = new Map<string, Omit<HorariosRankingItem, 'pctNoHorario' | 'saidasForaDoHorario'>>();

  for (const point of points) {
    const key = groupLabel(point.filial, 'Filial nao informada');
    const current = grouped.get(key) ?? {
      group: key,
      saidasNoHorario: 0,
      totalProgramado: 0,
    };

    current.saidasNoHorario += point.saidasNoHorario ?? 0;
    current.totalProgramado += point.totalProgramado ?? 0;
    grouped.set(key, current);
  }

  return Array.from(grouped.values())
    .map((item) => ({
      ...item,
      saidasForaDoHorario: Math.max(item.totalProgramado - item.saidasNoHorario, 0),
      pctNoHorario: percentual(item.saidasNoHorario, item.totalProgramado),
    }))
    .sort((left, right) => left.pctNoHorario - right.pctNoHorario || right.totalProgramado - left.totalProgramado || left.group.localeCompare(right.group));
}
