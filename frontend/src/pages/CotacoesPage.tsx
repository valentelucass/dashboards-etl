import { escapeHtml } from '../utils/escapeHtml';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import ReactECharts from '../components/charts/DashboardEChart';
import { Building2, ChevronDown, ChevronUp, Table2, UserRound, UsersRound } from 'lucide-react';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import CotacoesKpiGrid from '../components/domain/cotacoes/CotacoesKpiGrid';
import CotacoesResumoVisualTable, { type CotacoesResumoVisualView } from '../components/domain/cotacoes/CotacoesResumoVisualTable';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import ChartCard from '../components/shared/ChartCard';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarCotacoesCsv } from '../api/endpoints/cotacoesServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import {
  useClientes,
  useCotacoesClassificacoes,
  useCotacoesDestinos,
  useCotacoesOrigens,
  useCotacoesUsuarios,
  useFiliais,
} from '../hooks/queries/useDimensoes';
import {
  useCotacoesGraficos,
  useCotacoesOverview,
  useCotacoesResumoCliente,
  useCotacoesResumoFilial,
  useCotacoesResumoUsuario,
  useCotacoesSerie,
  useCotacoesTabelaPaginada,
} from '../hooks/queries/useCotacoes';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useStaggeredQueryEnabled } from '../hooks/useStaggeredQueryEnabled';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type {
  CotacaoResumoRow,
  CotacoesAgrupamento,
  CotacoesFiltro,
  CotacoesMotivoPerda,
  CotacoesTrendPoint,
} from '../types/cotacoes';
import { CORES, PALETA_SERIES } from '../utils/chartColors';
import { dataHojeLocal, primeiroDiaMesesAtrasLocal } from '../utils/dateUtils';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda, formatarNumero, formatarPeso, formatarPorcentagem } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

type PeriodDrillLevel = 'ano' | 'mes' | 'dia';
type ConversionDrillLevel = 'ano' | 'mes';
type TrechoDrillLevel = 'trecho' | 'origem' | 'destino';
type PerdaDrillLevel = 'motivo' | 'cliente' | 'trecho';
type FunnelMetric = 'quantidade' | 'valor';
type ConversionViewMode = 'completo' | 'valor' | 'quantidade';
type ConversionMetric = Exclude<ConversionViewMode, 'completo'>;
type ConversionPeriodoMeses = 3 | 6 | 12;
type TrechoMetric = 'potencial' | 'convertido';
type CotacoesViewTab = CotacoesResumoVisualView | 'analitica';

interface TrendBucket {
  key: string;
  label: string;
  cotacoes: number;
  convertidas: number;
  reprovadas: number;
  valorPotencial: number;
  valorConvertido: number;
}

const KPI_CARD_HEIGHT_CLASS = 'h-full min-h-0';
const COTACOES_VIEW_TABS: Array<{ value: CotacoesViewTab; label: string; compactLabel: string; icon: typeof UserRound }> = [
  { value: 'usuario', label: 'Por Usuário', compactLabel: 'Usuário', icon: UserRound },
  { value: 'filial', label: 'Por Filial', compactLabel: 'Filial', icon: Building2 },
  { value: 'clientes', label: 'Top 40 Clientes', compactLabel: 'Clientes', icon: UsersRound },
  { value: 'analitica', label: 'Visão Analítica', compactLabel: 'Análise', icon: Table2 },
];
const PERIOD_LEVELS: PeriodDrillLevel[] = ['ano', 'mes', 'dia'];
const CONVERSION_LEVELS: ConversionDrillLevel[] = ['ano', 'mes'];
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const TRECHO_LEVELS: Array<{ value: TrechoDrillLevel; label: string }> = [
  { value: 'trecho', label: 'Trecho' },
  { value: 'origem', label: 'UF origem' },
  { value: 'destino', label: 'UF destino' },
];
const PERDA_LEVELS: Array<{ value: PerdaDrillLevel; label: string }> = [
  { value: 'motivo', label: 'Motivo' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'trecho', label: 'Trecho' },
];
const CONVERSION_VIEW_OPTIONS: Array<{ value: ConversionViewMode; label: string; title?: string }> = [
  { value: 'completo', label: 'Completo' },
  { value: 'valor', label: 'Valor', title: 'Somente Valor' },
  { value: 'quantidade', label: 'Quantidade', title: 'Somente Quantidade' },
];
const CONVERSION_PERIOD_OPTIONS: Array<{ value: ConversionPeriodoMeses; label: string }> = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '1 ano' },
];
const TRECHO_METRIC_OPTIONS: Array<{ value: TrechoMetric; label: string }> = [
  { value: 'potencial', label: 'Potencial' },
  { value: 'convertido', label: 'Convertido' },
];
const FUNNEL_STAGES = [
  { key: 'pendente', label: 'Pendentes', color: CORES.aviso },
  { key: 'convertida', label: 'Convertidas', color: CORES.sucesso },
  { key: 'reprovada', label: 'Reprovadas', color: CORES.perigo },
] as const;

function parseDateLocal(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function normalizarTexto(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function statusStageKey(value: string | null | undefined) {
  const status = normalizarTexto(value);
  if (status === 'perdida' || status === 'perdido' || status === 'reprovado') return 'reprovada';
  if (status === 'convertido') return 'convertida';
  return status;
}

function normalizeConversionPeriodoMeses(value: string): ConversionPeriodoMeses {
  if (value === '6') return 6;
  if (value === '12') return 12;
  return 3;
}

function percentual(parte: number, total: number): number {
  return total > 0 ? (parte / total) * 100 : 0;
}

function taxaConversao(item: CotacoesAgrupamento): number {
  return percentual(item.convertidas, item.cotacoes);
}

function chartClickName(params: unknown): string | null {
  const item = params as { name?: unknown; data?: { name?: unknown } };
  if (typeof item.data?.name === 'string') return item.data.name;
  return typeof item.name === 'string' ? item.name : null;
}

function mergePlainObject(base: unknown, override: unknown) {
  return { ...((base ?? {}) as object), ...((override ?? {}) as object) };
}

function mergeAxis(baseAxis: unknown, optionAxis: unknown) {
  const mergeSingleAxis = (axis: unknown) => ({
    ...((baseAxis ?? {}) as object),
    ...((axis ?? {}) as object),
    axisLabel: mergePlainObject((baseAxis as { axisLabel?: unknown })?.axisLabel, (axis as { axisLabel?: unknown })?.axisLabel),
    axisLine: mergePlainObject((baseAxis as { axisLine?: unknown })?.axisLine, (axis as { axisLine?: unknown })?.axisLine),
    axisTick: mergePlainObject((baseAxis as { axisTick?: unknown })?.axisTick, (axis as { axisTick?: unknown })?.axisTick),
    splitLine: mergePlainObject((baseAxis as { splitLine?: unknown })?.splitLine, (axis as { splitLine?: unknown })?.splitLine),
    nameTextStyle: mergePlainObject((baseAxis as { nameTextStyle?: unknown })?.nameTextStyle, (axis as { nameTextStyle?: unknown })?.nameTextStyle),
  });

  if (Array.isArray(optionAxis)) {
    return optionAxis.map(mergeSingleAxis);
  }

  return mergeSingleAxis(optionAxis);
}

function ThemedEChart({
  option,
  altura = '100%',
}: {
  option: EChartsOption;
  altura?: number | string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const { baseOption } = useEchartsTheme();
  const mergedOption: EChartsOption = {
    ...baseOption,
    ...option,
    tooltip: { ...baseOption.tooltip, ...(option.tooltip as object) },
    legend: { ...baseOption.legend, ...(option.legend as object) },
    grid: { ...baseOption.grid, ...(option.grid as object) },
    xAxis: mergeAxis(baseOption.xAxis, option.xAxis),
    yAxis: mergeAxis(baseOption.yAxis, option.yAxis),
  };
  const chartHeight = typeof altura === 'number' ? altura : Math.max(1, measuredHeight);

  useEffect(() => {
    if (typeof altura === 'number') return undefined;

    const element = containerRef.current;
    if (!element) return undefined;

    let frameId = 0;

    const measure = () => {
      frameId = 0;
      const nextHeight = Math.floor(element.getBoundingClientRect().height);
      setMeasuredHeight((current) => (current === nextHeight ? current : nextHeight));
    };

    const scheduleMeasure = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(element);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [altura]);

  return (
    <div ref={containerRef} className="h-full max-h-full min-h-0 overflow-hidden">
      <ReactECharts
        option={mergedOption}
        className="h-full max-h-full min-h-0 overflow-hidden"
        style={{ height: chartHeight, maxHeight: '100%', width: '100%', overflow: 'hidden' }}
        opts={{ renderer: 'canvas' }}
        notMerge
      />
    </div>
  );
}

function PeriodControls({
  level,
  levels = PERIOD_LEVELS,
  onChange,
}: {
  level: PeriodDrillLevel | ConversionDrillLevel;
  levels?: Array<PeriodDrillLevel | ConversionDrillLevel>;
  onChange: (level: never) => void;
}) {
  const currentIndex = Math.max(levels.indexOf(level), 0);
  const canDrillUp = currentIndex > 0;
  const canDrillDown = currentIndex < levels.length - 1;

  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
      <button
        type="button"
        title="Drill up"
        aria-label="Drill up"
        disabled={!canDrillUp}
        onClick={() => canDrillUp && onChange(levels[currentIndex - 1] as never)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <ChevronUp size={14} />
      </button>
      <button
        type="button"
        title="Drill down"
        aria-label="Drill down"
        disabled={!canDrillDown}
        onClick={() => canDrillDown && onChange(levels[currentIndex + 1] as never)}
        className="flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <ChevronDown size={14} />
      </button>
      <span className="mx-1 hidden sm:inline">{levels.map((item) => item[0].toUpperCase() + item.slice(1)).join(' > ')}</span>
      {levels.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item as never)}
          className="rounded-md px-2 py-1 font-semibold uppercase transition"
          style={{
            backgroundColor: item === level ? 'rgba(33, 71, 138, 0.12)' : 'transparent',
            color: item === level ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

function MetricToggle({
  metric,
  onChange,
}: {
  metric: FunnelMetric;
  onChange: (metric: FunnelMetric) => void;
}) {
  return (
    <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
      {(['quantidade', 'valor'] as FunnelMetric[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className="rounded-md px-2 py-1 text-[11px] font-semibold transition"
          style={{
            backgroundColor: item === metric ? 'rgba(33, 71, 138, 0.12)' : 'transparent',
            color: item === metric ? 'var(--color-primary)' : 'var(--color-text-muted)',
          }}
        >
          {item === 'quantidade' ? 'Quantidade' : 'Valor'}
        </button>
      ))}
    </div>
  );
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  color = CORES.primaria,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; title?: string }>;
  onChange: (value: T) => void;
  color?: string;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
      {options.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            title={item.title ?? item.label}
            onClick={() => onChange(item.value)}
            className="whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold transition"
            style={{
              backgroundColor: active ? `${color}1F` : 'transparent',
              color: active ? color : 'var(--color-text-muted)',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function CotacoesViewTabs({
  activeView,
  onChange,
}: {
  activeView: CotacoesViewTab;
  onChange: (view: CotacoesViewTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Visões de cotações"
      className="grid w-fit min-w-0 shrink-0 grid-cols-4 gap-1 overflow-hidden rounded-lg border p-0.5"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {COTACOES_VIEW_TABS.map((item) => {
        const Icon = item.icon;
        const active = item.value === activeView;

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            data-state={active ? 'active' : 'inactive'}
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-md px-2 text-xs font-semibold transition-colors hover:bg-[var(--color-card)] data-[state=active]:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{
              backgroundColor: active ? 'var(--color-card)' : 'transparent',
              color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}
          >
            <Icon size={14} aria-hidden="true" />
            <span className="truncate 2xl:hidden">{item.compactLabel}</span>
            <span className="hidden truncate 2xl:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function DrillBreadcrumb<T extends string>({
  levels,
  level,
  color,
  onChange,
}: {
  levels: Array<{ value: T; label: string }>;
  level: T;
  color: string;
  onChange: (level: T) => void;
}) {
  const currentIndex = Math.max(levels.findIndex((item) => item.value === level), 0);
  const canGoBack = currentIndex > 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1 rounded-lg border px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}>
      <button
        type="button"
        title="Drill up"
        aria-label="Drill up"
        disabled={!canGoBack}
        onClick={() => canGoBack && onChange(levels[currentIndex - 1].value)}
        className="flex h-6 w-6 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35"
        style={{ color: canGoBack ? color : 'var(--color-text-muted)' }}
      >
        <ChevronUp size={13} />
      </button>
      {levels.map((item, index) => {
        const active = item.value === level;
        return (
          <span key={item.value} className="inline-flex items-center gap-1">
            {index > 0 && <span style={{ color: 'var(--color-text-subtle)' }}>&gt;</span>}
            <button
              type="button"
              onClick={() => onChange(item.value)}
              className="rounded-md px-1.5 py-1 text-[11px] font-semibold transition"
              style={{
                backgroundColor: active ? `${color}24` : 'transparent',
                color: active ? color : 'var(--color-text-muted)',
              }}
            >
              {item.label}
            </button>
          </span>
        );
      })}
    </div>
  );
}

function ConversionPeriodoActions({
  periodoMeses,
  onPeriodoChange,
}: {
  periodoMeses: ConversionPeriodoMeses;
  onPeriodoChange: (periodoMeses: ConversionPeriodoMeses) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Período das taxas de conversão</span>
      <select
        aria-label="Período das taxas de conversão"
        value={periodoMeses}
        onChange={(event) => onPeriodoChange(normalizeConversionPeriodoMeses(event.target.value))}
        className="h-8 rounded-md border px-2 text-xs font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        {CONVERSION_PERIOD_OPTIONS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function criarBucketsVazios(level: PeriodDrillLevel | ConversionDrillLevel, dataInicio: string, dataFim: string): Map<string, TrendBucket> {
  const inicio = parseDateLocal(dataInicio);
  const fim = parseDateLocal(dataFim);
  const buckets = new Map<string, TrendBucket>();

  if (level === 'dia') {
    for (let current = new Date(inicio); current <= fim; current.setDate(current.getDate() + 1)) {
      const key = toIsoDate(current);
      buckets.set(key, {
        key,
        label: current.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        cotacoes: 0,
        convertidas: 0,
        reprovadas: 0,
        valorPotencial: 0,
        valorConvertido: 0,
      });
    }
    return buckets;
  }

  if (level === 'mes') {
    const current = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
    const limite = new Date(fim.getFullYear(), fim.getMonth(), 1);
    while (current <= limite) {
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, {
        key,
        label: `${MONTH_LABELS[current.getMonth()]} ${current.getFullYear()}`,
        cotacoes: 0,
        convertidas: 0,
        reprovadas: 0,
        valorPotencial: 0,
        valorConvertido: 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return buckets;
  }

  for (let year = inicio.getFullYear(); year <= fim.getFullYear(); year += 1) {
    const key = String(year);
    buckets.set(key, {
      key,
      label: key,
      cotacoes: 0,
      convertidas: 0,
      reprovadas: 0,
      valorPotencial: 0,
      valorConvertido: 0,
    });
  }

  return buckets;
}

function bucketKey(date: Date, level: PeriodDrillLevel | ConversionDrillLevel) {
  if (level === 'dia') return toIsoDate(date);
  if (level === 'mes') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  return String(date.getFullYear());
}

function aggregateTrend(serie: CotacoesTrendPoint[], level: PeriodDrillLevel | ConversionDrillLevel, dataInicio: string, dataFim: string): TrendBucket[] {
  const buckets = criarBucketsVazios(level, dataInicio, dataFim);

  serie.forEach((item) => {
    const date = parseDateLocal(item.date);
    const key = bucketKey(date, level);
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.cotacoes += item.cotacoes;
    bucket.convertidas += item.convertidas;
    bucket.reprovadas += item.reprovadas;
    bucket.valorPotencial += item.valorPotencial ?? 0;
    bucket.valorConvertido += item.valorConvertido ?? 0;
  });

  return Array.from(buckets.values());
}

function buildSerieOption(buckets: TrendBucket[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return buildBaseLineOption(isDark, {
    grid: { left: 44, right: 18, top: 20, bottom: 42, containLabel: true },
    legend: { bottom: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] as { dataIndex?: number } : null;
        const bucket = typeof item?.dataIndex === 'number' ? buckets[item.dataIndex] : null;
        if (!bucket) return '';
        return [
          `<strong>${escapeHtml(bucket.label)}</strong>`,
          `Quantidade total: ${formatarNumero(bucket.cotacoes)}`,
          `Convertidas: ${formatarNumero(bucket.convertidas)}`,
          `Reprovadas: ${formatarNumero(bucket.reprovadas)}`,
          `Taxa conversão: ${formatarPorcentagem(percentual(bucket.convertidas, bucket.cotacoes), 1)}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      data: buckets.map((item) => item.label),
      axisLabel: { interval: 'auto', rotate: buckets.length > 18 ? 35 : 0 },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'Cotações',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: {},
        data: buckets.map((item) => item.cotacoes),
        itemStyle: { color: tokens.palette[0] },
      },
      {
        name: 'Convertidas',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: {},
        data: buckets.map((item) => item.convertidas),
        itemStyle: { color: tokens.palette[2] },
      },
      {
        name: 'Reprovadas',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        areaStyle: {},
        data: buckets.map((item) => item.reprovadas),
        itemStyle: { color: tokens.palette[3] },
      },
    ],
  });
}

function getTrechoMetricValue(item: CotacoesAgrupamento, metric: TrechoMetric): number {
  return metric === 'convertido' ? item.valorConvertido : item.valorPotencial;
}

function formatTrechoMetricValue(value: number): string {
  return formatarMoeda(value);
}

function buildTrechosOption(entries: CotacoesAgrupamento[], selectedName: string | null, metric: TrechoMetric, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const metricLabel = metric === 'convertido' ? 'Convertido' : 'Potencial';
  const metricColor = metric === 'convertido' ? tokens.palette[2] : tokens.palette[1];
  const sorted = [...entries].sort((left, right) => getTrechoMetricValue(right, metric) - getTrechoMetricValue(left, metric)).slice(0, 8);
  const dados = sorted.reverse();
  const hasSelection = Boolean(selectedName && entries.some((item) => item.nome === selectedName));

  return buildBaseBarOption(isDark, {
    grid: { left: 6, right: 12, top: 10, bottom: 10, containLabel: true },
    legend: { show: false },
    xAxis: { type: 'value', name: 'R$' },
    yAxis: {
      type: 'category',
      data: dados.map((item) => truncateLabel(item.nome, 20)),
    },
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      confine: false,
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] as { dataIndex?: number } : null;
        const original = typeof item?.dataIndex === 'number' ? dados[item.dataIndex] : null;
        if (!original) return '';
        return [
          `<strong>${escapeHtml(original.nome)}</strong>`,
          `${metricLabel}: ${formatTrechoMetricValue(getTrechoMetricValue(original, metric))}`,
          `Potencial: ${formatarMoeda(original.valorPotencial)}`,
          `Convertido: ${formatarMoeda(original.valorConvertido)}`,
          `Cotações: ${formatarNumero(original.cotacoes)}`,
          `Taxa conversão: ${formatarPorcentagem(taxaConversao(original), 1)}`,
        ].join('<br/>');
      },
    },
    series: [
      {
        name: metricLabel,
        type: 'bar',
        data: dados.map((item) => ({
          name: item.nome,
          value: getTrechoMetricValue(item, metric),
          itemStyle: {
            color: metricColor,
            opacity: hasSelection && selectedName !== item.nome ? 0.35 : 1,
          },
        })),
        barMaxWidth: 18,
      },
    ],
  });
}

function buildConversionOption(buckets: TrendBucket[], metric: ConversionMetric, expanded = false, isDark = false): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const color = metric === 'valor' ? tokens.palette[0] : tokens.palette[1];
  const values = buckets.map((item) => (
    metric === 'valor'
      ? percentual(item.valorConvertido, item.valorPotencial)
      : percentual(item.convertidas, item.cotacoes)
  ));

  return buildBaseLineOption(isDark, {
    grid: expanded
      ? { left: 42, right: 30, top: 32, bottom: 30, containLabel: true }
      : { left: 34, right: 24, top: 26, bottom: 22, containLabel: true },
    tooltip: {
      trigger: 'axis',
      appendToBody: true,
      confine: false,
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] as { dataIndex?: number; value?: number } : null;
        const bucket = typeof item?.dataIndex === 'number' ? buckets[item.dataIndex] : null;
        if (!bucket) return '';
        return [
          `<strong>${escapeHtml(bucket.label)}</strong>`,
          `Taxa: ${formatarPorcentagem(Number(item?.value ?? 0), 1)}`,
          `Potencial: ${formatarMoeda(bucket.valorPotencial)}`,
          `Convertido: ${formatarMoeda(bucket.valorConvertido)}`,
          `Qtde cotadas: ${formatarNumero(bucket.cotacoes)}`,
          `Qtde convertidas: ${formatarNumero(bucket.convertidas)}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
        data: buckets.map((item) => item.label),
        axisLabel: { fontSize: expanded ? 11 : 10, interval: 'auto', margin: 10 },
      },
    yAxis: {
      type: 'value',
      splitNumber: expanded ? 5 : 4,
      axisLabel: { formatter: '{value}%', fontSize: expanded ? 11 : 10 },
    },
    series: [
      {
        name: metric === 'valor' ? 'Conversão Valor' : 'Conversão Qtde',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        label: {
          show: true,
          formatter: (params: unknown) => `${formatarNumero(Number((params as { value?: number }).value ?? 0), 0)}%`,
          fontSize: expanded ? 11 : 10,
        },
        data: values,
        itemStyle: { color },
        lineStyle: { width: 2.5, color },
      },
    ],
  });
}

function buildMotivosOption(entries: CotacoesMotivoPerda[], selectedName: string | null, totalReprovadas: number, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const sorted = [...entries].sort((left, right) => right.total - left.total).slice(0, 8);
  const total = totalReprovadas > 0 ? totalReprovadas : entries.reduce((acc, item) => acc + item.total, 0);
  const hasSelection = Boolean(selectedName && entries.some((item) => item.motivo === selectedName));

  return buildBaseBarOption(isDark, {
    grid: { left: 6, right: 42, top: 8, bottom: 18, containLabel: true },
    legend: { show: false },
    tooltip: {
      trigger: 'item',
      appendToBody: true,
      confine: false,
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number };
        const original = sorted.find((entrada) => entrada.motivo === item.name);
        if (!original) return '';
        return [
          `<strong>${escapeHtml(original.motivo)}</strong>`,
          `Quantidade: ${formatarNumero(original.total)}`,
          `Sobre reprovadas: ${formatarPorcentagem(percentual(original.total, total), 1)}`,
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      splitNumber: 3,
      axisLabel: {
        fontSize: 11,
        formatter: (value: number) => formatarNumero(value, 0),
      },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: sorted.map((item) => item.motivo),
      axisLabel: {
        fontSize: 11,
        formatter: (value: string) => truncateLabel(value, 18),
      },
    },
    series: [
      {
        name: 'Perdas',
        type: 'bar',
        data: sorted.map((item, index) => ({
          name: item.motivo,
          value: item.total,
          itemStyle: {
            color: tokens.palette[index % tokens.palette.length],
            opacity: hasSelection && selectedName !== item.motivo ? 0.35 : 1,
          },
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'right',
          formatter: (params: unknown) => formatarNumero(Number((params as { value?: number }).value ?? 0), 0),
          fontSize: 10,
        },
      },
    ],
  });
}

function getFunilValue(
  funil: Array<{ etapa: string; total: number; valor: number }>,
  stageKey: string,
  metric: FunnelMetric,
) {
  return funil
    .filter((item) => {
      const etapa = statusStageKey(item.etapa);
      if (stageKey === 'pendente') return etapa === 'pendente' || etapa === 'sem status';
      return etapa === stageKey;
    })
    .reduce((acc, item) => acc + (metric === 'valor' ? item.valor : item.total), 0);
}

function FunilComercialCard({
  funil,
  metric,
  periodLevel,
  isLoading,
  onMetricChange,
  onPeriodChange,
}: {
  funil: Array<{ etapa: string; total: number; valor: number }>;
  metric: FunnelMetric;
  periodLevel: PeriodDrillLevel;
  isLoading: boolean;
  onMetricChange: (metric: FunnelMetric) => void;
  onPeriodChange: (level: PeriodDrillLevel) => void;
}) {
  const rows = FUNNEL_STAGES.map((stage) => ({
    ...stage,
    value: getFunilValue(funil, stage.key, metric),
  }));
  const total = rows.reduce((acc, item) => acc + item.value, 0);
  const max = Math.max(...rows.map((item) => item.value), 1);

  return (
    <ChartCard
      titulo="Funil Comercial"
      chartKey="cotacoesFunil"
      actions={(
        <div className="flex flex-wrap justify-end gap-1">
          <MetricToggle metric={metric} onChange={onMetricChange} />
          <PeriodControls level={periodLevel} onChange={onPeriodChange as (level: never) => void} />
        </div>
      )}
      isLoading={isLoading}
      isEmpty={funil.length === 0 || total === 0}
      className={KPI_CARD_HEIGHT_CLASS}
    >
      <div className="flex h-full min-h-0 flex-col justify-center gap-4 px-4">
        {rows.map((row, index) => {
          const width = 38 + (row.value / max) * 58;
          const pct = percentual(row.value, total);
          return (
            <div
              key={row.key}
              className="grid items-center gap-3 md:grid-cols-[1fr_190px]"
              title={`${row.label}: ${metric === 'valor' ? formatarMoeda(row.value) : formatarNumero(row.value)} (${formatarPorcentagem(pct, 1)})`}
            >
              <div className="flex justify-center">
                <div
                  className="flex h-14 items-center justify-center rounded-xl px-4 text-sm font-bold text-white shadow-sm transition"
                  style={{
                    width: `${width}%`,
                    backgroundColor: row.color,
                    clipPath: index === 2 ? 'polygon(16% 0, 84% 0, 100% 100%, 0 100%)' : 'polygon(5% 0, 95% 0, 100% 100%, 0 100%)',
                  }}
                >
                  {row.label}
                </div>
              </div>
              <div className="rounded-lg border px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
                <div className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{row.label}</div>
                <div className="text-lg font-bold" style={{ color: row.color }}>
                  {metric === 'valor' ? formatarMoeda(row.value) : formatarNumero(row.value)}
                </div>
                <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatarPorcentagem(pct, 1)} do funil</div>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}

function TaxasConversaoCard({
  buckets,
  tipos,
  level,
  viewMode,
  periodoMeses,
  isLoading,
  erro,
  onLevelChange,
  onViewModeChange,
  onPeriodoChange,
}: {
  buckets: TrendBucket[];
  tipos: CotacoesAgrupamento[];
  level: ConversionDrillLevel;
  viewMode: ConversionViewMode;
  periodoMeses: ConversionPeriodoMeses;
  isLoading: boolean;
  erro?: string | null;
  onLevelChange: (level: ConversionDrillLevel) => void;
  onViewModeChange: (mode: ConversionViewMode) => void;
  onPeriodoChange: (periodoMeses: ConversionPeriodoMeses) => void;
}) {
  const { isDark } = useEchartsTheme();
  const tipoMap = new Map(tipos.map((item) => [normalizarTexto(item.nome), item]));
  const blocos = ['LTL', 'FTL', 'PTL'].map((tipo) => (
    tipoMap.get(tipo.toLowerCase()) ?? {
      nome: tipo,
      valorPotencial: 0,
      valorConvertido: 0,
      cotacoes: 0,
      convertidas: 0,
      reprovadas: 0,
    }
  ));
  const hasData = buckets.some((item) => item.cotacoes > 0 || item.valorPotencial > 0) || tipos.length > 0;
  const chartMetrics: ConversionMetric[] = viewMode === 'completo' ? ['valor', 'quantidade'] : [viewMode];
  const isSingleMode = chartMetrics.length === 1;
  const chartTitles: Record<ConversionMetric, string> = {
    valor: 'Evolução Conversão Valor',
    quantidade: 'Evolução Conversão Quantidade',
  };
  const conversionOptions = useMemo(() => ({
    valor: buildConversionOption(buckets, 'valor', isSingleMode, isDark),
    quantidade: buildConversionOption(buckets, 'quantidade', isSingleMode, isDark),
  }), [buckets, isSingleMode, isDark]);

  return (
    <ChartCard
      titulo="Taxas de Conversão"
      chartKey="cotacoesTaxasConversao"
      actions={(
        <div className="flex flex-wrap items-center justify-end gap-2">
          <ConversionPeriodoActions periodoMeses={periodoMeses} onPeriodoChange={onPeriodoChange} />
          <SegmentedControl
            value={viewMode}
            options={CONVERSION_VIEW_OPTIONS}
            onChange={onViewModeChange}
            ariaLabel="Modo de visualização das taxas de conversão"
          />
          <PeriodControls level={level} levels={CONVERSION_LEVELS} onChange={onLevelChange as (level: never) => void} />
        </div>
      )}
      isLoading={isLoading}
      erro={erro}
      isEmpty={!hasData}
      className="h-full min-h-0"
      contentClassName="h-[350px] max-h-[350px] min-h-0 overflow-hidden"
    >
      <div className="grid h-full max-h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,1fr)] lg:grid-rows-1">
        <div className="flex h-full max-h-full min-h-0 flex-col gap-2 overflow-hidden">
          {chartMetrics.map((metric) => (
            <div key={metric} className={`flex max-h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg px-2 ${isSingleMode ? 'py-2' : 'py-1.5'}`} style={{ backgroundColor: 'var(--color-bg)' }}>
              <div className="shrink-0 px-1 text-xs font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>{chartTitles[metric]}</div>
              <div className="max-h-full min-h-[100px] flex-1 overflow-hidden pt-1">
                <ThemedEChart option={conversionOptions[metric]} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="flex h-full max-h-full min-h-0 flex-col gap-2">
              {blocos.map((item) => {
                const index = blocos.findIndex((bloco) => normalizarTexto(bloco.nome) === normalizarTexto(item.nome));
                const accent = PALETA_SERIES[Math.max(index, 0) % PALETA_SERIES.length];
                const taxa = taxaConversao(item);
                const metricas = [
                  ['Potencial', formatarMoeda(item.valorPotencial)],
                  ['Convertido', formatarMoeda(item.valorConvertido)],
                  ['Cotadas', formatarNumero(item.cotacoes)],
                  ['Convertidas', formatarNumero(item.convertidas)],
                ];

                return (
                  <div key={item.nome} className="max-h-full min-h-0 flex-1 rounded-xl border p-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                    <div className="grid h-full max-h-full min-h-0 grid-cols-[4.4rem_1fr] gap-2 overflow-hidden">
                      <div className="flex min-h-0 flex-col items-center justify-center rounded-lg px-1 text-center" style={{ backgroundColor: `${accent}18` }}>
                        <span className="text-base font-black leading-none" style={{ color: accent }}>{item.nome}</span>
                        <span className="mt-1 text-xl font-black leading-none" style={{ color: 'var(--color-text)' }}>{formatarPorcentagem(taxa, 0)}</span>
                      </div>
                      <div className="grid max-h-full min-h-0 grid-cols-2 gap-1 overflow-hidden">
                        {metricas.map(([label, value]) => (
                          <div key={label} className="min-w-0 rounded-md border px-1.5 py-1" style={{ borderColor: 'var(--color-border)' }}>
                            <div className="truncate text-[9px] font-semibold uppercase leading-tight" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
                            <div className="truncate text-[11px] font-bold leading-tight" title={value} style={{ color: 'var(--color-text)' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </ChartCard>
  );
}

export default function CotacoesPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const [activeView, setActiveView] = useState<CotacoesViewTab>('usuario');
  const [serieDrillLevel, setSerieDrillLevel] = useState<PeriodDrillLevel>('dia');
  const [funilMetric, setFunilMetric] = useState<FunnelMetric>('quantidade');
  const [funilDrillLevel, setFunilDrillLevel] = useState<PeriodDrillLevel>('dia');
  const [trechoDrillLevel, setTrechoDrillLevel] = useState<TrechoDrillLevel>('trecho');
  const [trechoMetric, setTrechoMetric] = useState<TrechoMetric>('potencial');
  const [conversionLevel, setConversionLevel] = useState<ConversionDrillLevel>('mes');
  const [conversionViewMode, setConversionViewMode] = useState<ConversionViewMode>('completo');
  const [conversionPeriodoMeses, setConversionPeriodoMeses] = useState<ConversionPeriodoMeses>(3);
  const [perdaDrillLevel, setPerdaDrillLevel] = useState<PerdaDrillLevel>('motivo');
  const [selectedTrecho, setSelectedTrecho] = useState<string | null>(null);
  const [selectedPerda, setSelectedPerda] = useState<string | null>(null);
  const filiais = useFiliais();
  const clientes = useClientes();

  const filtro: CotacoesFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    clientes: filtros.clientes,
    statusConversao: filtros.statusConversao,
    usuarios: filtros.usuarios,
    classificacoes: filtros.classificacoes,
    origens: filtros.origens,
    destinos: filtros.destinos,
  }), [
    dataFim,
    dataInicio,
    filtros.classificacoes,
    filtros.clientes,
    filtros.destinos,
    filtros.filiais,
    filtros.origens,
    filtros.parceirosLogisticos,
    filtros.statusConversao,
    filtros.usuarios,
  ]);

  const conversionFiltro: CotacoesFiltro = useMemo(() => ({
    dataInicio: primeiroDiaMesesAtrasLocal(conversionPeriodoMeses - 1),
    dataFim: dataHojeLocal(),
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    clientes: filtros.clientes,
    statusConversao: filtros.statusConversao,
    usuarios: filtros.usuarios,
    classificacoes: filtros.classificacoes,
    origens: filtros.origens,
    destinos: filtros.destinos,
  }), [
    conversionPeriodoMeses,
    filtros.classificacoes,
    filtros.clientes,
    filtros.destinos,
    filtros.filiais,
    filtros.origens,
    filtros.parceirosLogisticos,
    filtros.statusConversao,
    filtros.usuarios,
  ]);

  const usuariosCotacoes = useCotacoesUsuarios(filtro);
  const classificacoesCotacoes = useCotacoesClassificacoes(filtro);
  const origensCotacoes = useCotacoesOrigens(filtro);
  const destinosCotacoes = useCotacoesDestinos(filtro);

  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Clientes', count: filtros.clientes?.length ?? 0, onRemove: () => setFiltro('clientes', []) },
    { label: 'Status', count: filtros.statusConversao?.length ?? 0, onRemove: () => setFiltro('statusConversao', []) },
    { label: 'Usuário', count: filtros.usuarios?.length ?? 0, onRemove: () => setFiltro('usuarios', []) },
    { label: 'Classificação', count: filtros.classificacoes?.length ?? 0, onRemove: () => setFiltro('classificacoes', []) },
    { label: 'Origem', count: filtros.origens?.length ?? 0, onRemove: () => setFiltro('origens', []) },
    { label: 'Destino', count: filtros.destinos?.length ?? 0, onRemove: () => setFiltro('destinos', []) },
  ];

  const overview = useCotacoesOverview(filtro);
  const overviewReady = overview.isSuccess && Boolean(overview.data);
  const abaAtiva = activeView;
  const analyticalViewReady = overviewReady && abaAtiva === 'analitica';
  const serieEnabled = useStaggeredQueryEnabled(analyticalViewReady, 150);
  const graficosEnabled = useStaggeredQueryEnabled(analyticalViewReady, 320);
  const conversionSerieEnabled = useStaggeredQueryEnabled(analyticalViewReady, 520);
  const tabelaEnabled = useStaggeredQueryEnabled(analyticalViewReady, 850);
  const serie = useCotacoesSerie(filtro, serieEnabled);
  const conversionSerie = useCotacoesSerie(conversionFiltro, conversionSerieEnabled);
  const graficos = useCotacoesGraficos(filtro, graficosEnabled);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useCotacoesTabelaPaginada(
    filtro,
    paginacaoTabela.pagina,
    paginacaoTabela.tamanhoPagina,
    filtrosTabela.apiFilters,
    tabelaEnabled,
  );
  const resumoUsuario = useCotacoesResumoUsuario(filtro, abaAtiva === 'usuario');
  const resumoFilial = useCotacoesResumoFilial(filtro, abaAtiva === 'filial');
  const resumoCliente = useCotacoesResumoCliente(filtro, abaAtiva === 'clientes');
  const resumoVisual = abaAtiva === 'usuario'
    ? resumoUsuario
    : abaAtiva === 'filial'
      ? resumoFilial
      : resumoCliente;
  const resumoVisualErrorMessage = resumoVisual.isError
    ? getApiErrorMessage(resumoVisual.error, 'Erro ao carregar resumo de cotações.')
    : null;

  usePageHeader({
    title: 'Cotações',
    description: 'Taxas de conversão - Funil comercial - Trechos mais valiosos e motivos de perda',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const funil = useMemo(() => graficos.data?.funil ?? [], [graficos.data?.funil]);
  const motivos = useMemo(() => graficos.data?.motivosPerda ?? [], [graficos.data?.motivosPerda]);
  const totalReprovadas = useMemo(() => getFunilValue(funil, 'reprovada', 'quantidade'), [funil]);
  const statusTabelaOptions = combinarStatusOptions(
    ['Convertida', 'Reprovada', 'Pendente'],
    funil.map((item) => item.etapa),
    (tabela.data?.conteudo ?? []).map((item) => item.statusConversao),
    filtros.statusConversao,
  );

  const serieBuckets = useMemo(
    () => aggregateTrend(serie.data ?? [], serieDrillLevel, dataInicio, dataFim),
    [dataFim, dataInicio, serie.data, serieDrillLevel],
  );
  const conversionBuckets = useMemo(
    () => aggregateTrend(conversionSerie.data ?? [], conversionLevel, conversionFiltro.dataInicio, conversionFiltro.dataFim),
    [conversionFiltro.dataFim, conversionFiltro.dataInicio, conversionLevel, conversionSerie.data],
  );
  const trechosEntries = useMemo(() => {
    if (trechoDrillLevel === 'origem') return graficos.data?.trechosPorUfOrigem ?? [];
    if (trechoDrillLevel === 'destino') return graficos.data?.trechosPorUfDestino ?? [];
    return graficos.data?.trechosMaisValiosos ?? [];
  }, [graficos.data?.trechosMaisValiosos, graficos.data?.trechosPorUfDestino, graficos.data?.trechosPorUfOrigem, trechoDrillLevel]);
  const perdasEntries = useMemo(() => {
    if (perdaDrillLevel === 'cliente') return graficos.data?.perdasPorCliente ?? [];
    if (perdaDrillLevel === 'trecho') return graficos.data?.perdasPorTrecho ?? [];
    return motivos;
  }, [graficos.data?.perdasPorCliente, graficos.data?.perdasPorTrecho, motivos, perdaDrillLevel]);

  const serieOption = useMemo(() => buildSerieOption(serieBuckets, isDark), [isDark, serieBuckets]);
  const trechosOption = useMemo(() => buildTrechosOption(trechosEntries, selectedTrecho, trechoMetric, isDark), [isDark, selectedTrecho, trechoMetric, trechosEntries]);
  const motivosOption = useMemo(() => buildMotivosOption(perdasEntries, selectedPerda, totalReprovadas, isDark), [isDark, perdasEntries, selectedPerda, totalReprovadas]);

  const colunas: ColunaTabelaAnalitica<CotacaoResumoRow>[] = [
    { chave: 'numeroCotacao', label: 'N° Cotação', fixo: true, filtroTabela: 'codigo' },
    { chave: 'dataCotacao', label: 'Data' },
    { chave: 'filial', label: 'Filial' },
    { chave: 'clientePagador', label: 'Pagador', largura: '220px', filtroTabela: 'razaoSocial' },
    { chave: 'trecho', label: 'Trecho', largura: '220px', filtroTabela: 'origem' },
    { chave: 'valorFrete', label: 'Valor Frete', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'statusConversao', label: 'Status', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
    { chave: 'motivoPerda', label: 'Motivo Perda', largura: '220px' },
    { chave: 'tipoOperacao', label: 'Classificação' },
    { chave: 'volumes', label: 'Volumes' },
    { chave: 'pesoTaxado', label: 'Peso', formato: (valor) => formatarPeso(Number(valor ?? 0)) },
    { chave: 'fretePorKg', label: 'R$/Kg', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'minFreteKg', label: 'Min. R$/Kg', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'valorNf', label: 'Valor NF', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'percentualNf', label: '% NF', formato: (valor) => formatarPorcentagem(Number(valor ?? 0), 2) },
    { chave: 'tabela', label: 'Tabela' },
    { chave: 'origem', label: 'Origem', filtroTabela: 'origem' },
    { chave: 'destino', label: 'Destino', filtroTabela: 'destino' },
  ];

  return (
    <div className="w-full">
      <FilterBar
        period={(
          <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
        )}
        onClear={limparFiltros}
        activeFilters={activeFilters}
        dataInicio={dataInicio}
        dataFim={dataFim}
        actions={<CotacoesViewTabs activeView={activeView} onChange={setActiveView} />}
      >
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? []}
          filiaisSelecionadas={filtros.filiais ?? []}
          parceirosSelecionados={filtros.parceirosLogisticos ?? []}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
        <AsyncMultiSelect label="Clientes" opcoes={clientes.data ?? []} selecionados={filtros.clientes ?? []} onChange={(valores) => setFiltro('clientes', valores)} isLoading={clientes.isLoading} />
        <AsyncMultiSelect label="Status" opcoes={['Convertida', 'Reprovada', 'Pendente']} selecionados={filtros.statusConversao ?? []} onChange={(valores) => setFiltro('statusConversao', valores)} />
        <AsyncMultiSelect label="Classificação" opcoes={classificacoesCotacoes.data ?? []} selecionados={filtros.classificacoes ?? []} onChange={(valores) => setFiltro('classificacoes', valores)} isLoading={classificacoesCotacoes.isLoading} />
        <AsyncMultiSelect label="Cidade Origem" opcoes={origensCotacoes.data ?? []} selecionados={filtros.origens ?? []} onChange={(valores) => setFiltro('origens', valores)} isLoading={origensCotacoes.isLoading} />
        <AsyncMultiSelect label="Cidade Destino" opcoes={destinosCotacoes.data ?? []} selecionados={filtros.destinos ?? []} onChange={(valores) => setFiltro('destinos', valores)} isLoading={destinosCotacoes.isLoading} />
        <AsyncMultiSelect label="Usuário" opcoes={usuariosCotacoes.data ?? []} selecionados={filtros.usuarios ?? []} onChange={(valores) => setFiltro('usuarios', valores)} isLoading={usuariosCotacoes.isLoading} />
      </FilterBar>

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de cotações.')} tipo={getTipoErro(overview.error)} />}
      {overview.data && <CotacoesKpiGrid overview={overview.data} />}

      {activeView === 'analitica' ? (
        <>
          <div className="mb-6 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 2xl:grid-cols-12">
            <div className="col-span-full min-h-0 2xl:col-span-6">
              <ChartWrapper
                titulo="Cotações por Dia, Mês e Ano"
                chartKey="cotacoesSerie"
                option={serieOption}
                actions={<PeriodControls level={serieDrillLevel} onChange={setSerieDrillLevel as (level: never) => void} />}
                isLoading={serie.isLoading}
                isEmpty={(serie.data ?? []).length === 0}
                className={KPI_CARD_HEIGHT_CLASS}
                altura="100%"
              />
            </div>
            <div className="min-h-0 2xl:col-span-6">
              <FunilComercialCard
                funil={funil}
                metric={funilMetric}
                periodLevel={funilDrillLevel}
                isLoading={graficos.isLoading}
                onMetricChange={setFunilMetric}
                onPeriodChange={setFunilDrillLevel}
              />
            </div>
            <div className="h-[28rem] min-h-0 2xl:col-span-5">
              <TaxasConversaoCard
                buckets={conversionBuckets}
                tipos={graficos.data?.conversaoPorTipoOperacao ?? []}
                level={conversionLevel}
                viewMode={conversionViewMode}
                periodoMeses={conversionPeriodoMeses}
                isLoading={conversionSerie.isPending || graficos.isPending}
                erro={conversionSerie.isError ? getApiErrorMessage(conversionSerie.error, 'Erro ao carregar evolução das taxas de conversão.') : null}
                onLevelChange={setConversionLevel}
                onViewModeChange={setConversionViewMode}
                onPeriodoChange={setConversionPeriodoMeses}
              />
            </div>
            <div className="min-h-0 2xl:col-span-4">
              <ChartWrapper
                titulo="Trechos Mais Valiosos"
                chartKey="cotacoesTrechos"
                option={trechosOption}
                actions={(
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <SegmentedControl
                      value={trechoMetric}
                      options={TRECHO_METRIC_OPTIONS}
                      onChange={setTrechoMetric}
                      color={CORES.secundaria}
                      ariaLabel="Métrica dos trechos mais valiosos"
                    />
                    <DrillBreadcrumb levels={TRECHO_LEVELS} level={trechoDrillLevel} color={CORES.secundaria} onChange={setTrechoDrillLevel} />
                  </div>
                )}
                onEvents={{
                  click: (params) => {
                    setSelectedTrecho(chartClickName(params));
                    if (trechoDrillLevel === 'trecho') setTrechoDrillLevel('origem');
                    else if (trechoDrillLevel === 'origem') setTrechoDrillLevel('destino');
                  },
                }}
                isLoading={graficos.isLoading}
                isEmpty={trechosEntries.length === 0}
                className={KPI_CARD_HEIGHT_CLASS}
                altura="100%"
              />
            </div>
            <div className="min-h-0 2xl:col-span-3">
              <ChartWrapper
                titulo="Motivos de Perda"
                chartKey="cotacoesMotivosPerda"
                option={motivosOption}
                actions={<DrillBreadcrumb levels={PERDA_LEVELS} level={perdaDrillLevel} color={CORES.aviso} onChange={setPerdaDrillLevel} />}
                onEvents={{
                  click: (params) => {
                    setSelectedPerda(chartClickName(params));
                    if (perdaDrillLevel === 'motivo') setPerdaDrillLevel('cliente');
                    else if (perdaDrillLevel === 'cliente') setPerdaDrillLevel('trecho');
                  },
                }}
                isLoading={graficos.isLoading}
                isEmpty={perdasEntries.length === 0}
                emptyMessage="Sem perdas/reprovações no período selecionado."
                className={KPI_CARD_HEIGHT_CLASS}
                altura="100%"
              />
            </div>
          </div>

          <AnalyticalDataTable
            titulo="Cotações Analíticas"
            acoesCabecalho={<ExportButton nomeArquivo="cotacoes" onExport={() => exportarCotacoesCsv(filtro, filtrosTabela.apiFilters)} />}
            dados={tabela.data?.conteudo ?? []}
            colunas={colunas}
            chaveLinha="numeroCotacao"
            filtros={filtrosTabela.filters}
            hiddenActiveCount={filtrosTabela.hiddenActiveCount}
            hasAnyFilter={filtrosTabela.hasAnyFilter}
            onTextFilterChange={filtrosTabela.setTextFilter}
            onMultiFilterChange={filtrosTabela.setMultiFilter}
            onColumnFilterChange={filtrosTabela.setColumnFilter}
            onClearFilters={filtrosTabela.clearTableFilters}
            statusOptions={statusTabelaOptions}
            statusOptionsLoading={graficos.isLoading}
            isLoading={tabela.isLoading}
            error={tabela.error}
            errorFallbackMessage="Erro ao carregar cotações analíticas."
            totalRegistros={tabela.data?.totalElementos}
            paginaAtual={paginacaoTabela.pagina}
            tamanhoPagina={paginacaoTabela.tamanhoPagina}
            onPaginaChange={paginacaoTabela.setPagina}
            onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
          />
        </>
      ) : (
        <CotacoesResumoVisualTable
          view={activeView}
          rows={resumoVisual.data ?? []}
          isLoading={resumoVisual.isLoading || resumoVisual.isFetching}
          errorMessage={resumoVisualErrorMessage}
        />
      )}
    </div>
  );
}
