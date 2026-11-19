import { LoadingKpiGrid } from '../components/shared/DashboardLoading';
import DashboardSegments from '../components/shared/DashboardSegments';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, TableText } from '../components/shared/DashboardTable';
import DashboardButton from "../components/shared/DashboardButton";
import { escapeHtml } from '../utils/escapeHtml';
import { useMemo, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import AstryxDashboardChart from '../components/charts/AstryxDashboardChart';
import { ArrowDown, ArrowUp, Info, Minus, Settings } from 'lucide-react';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import FaturamentoGoalsManagerPanel from '../components/domain/faturamento/FaturamentoGoalsManagerPanel';
import FaturamentoKpiGrid from '../components/domain/faturamento/FaturamentoKpiGrid';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import ChartCard from '../components/shared/ChartCard';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import TooltipKpi from '../components/shared/TooltipKpi';
import MensagemErro from '../components/ui/MensagemErro';
import type { ChartDictionaryKey } from '../constants/chartDictionary';
import { KpiDictionary } from '../constants/kpiDictionary';
import { exportarFaturamentoCsv } from '../api/endpoints/faturamentoServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useClientes, useFiliais, useFaturamentoResponsaveis, useFaturamentoStatus } from '../hooks/queries/useDimensoes';
import {
  useFaturamentoMetas,
  useFaturamentoMetasConfiguracoes,
  useFaturamentoGraficos,
  useFaturamentoOverview,
  useFaturamentoSerie,
  useFaturamentoTabelaPaginada,
  useFaturamentoTopClientes,
  useReplicarFaturamentoMetasConfiguracoes,
  useRemoverFaturamentoMetaConfiguracao,
  useSalvarFaturamentoMetaConfiguracao,
} from '../hooks/queries/useFaturamento';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { usePermissions } from '../hooks/usePermissions';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type {
  FaturamentoClienteRanking,
  FaturamentoFiltro,
  FaturamentoResumoRow,
  FaturamentoTrendPoint,
} from '../types/faturamento';
import { CORES } from '../utils/chartColors';
import { buildBaseBarOption, buildBaseDonutOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarDataHoraMinuto, formatarMoeda, formatarNumero, formatarPeso, formatarPorcentagem } from '../utils/formatadores';
import { isParceiroLogistico } from '../utils/filiais';
import { formatarStatusOperacional } from '../utils/statusLabels';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

type PeriodDrillLevel = 'ano' | 'mes' | 'dia';
type RouteDrillLevel = 'rota' | 'origem' | 'destino';
type ResponsavelDrillLevel = 'responsavel' | 'uf' | 'cidade';
type FaturamentoMetric = 'receita' | 'fretes';

interface ChartDatum {
  nome: string;
  receita: number;
  fretes: number;
}

const PERIOD_LEVELS = [{ value: 'ano', label: 'Ano' }, { value: 'mes', label: 'Mês' }, { value: 'dia', label: 'Dia' }] as const;
const METRIC_OPTIONS = [{ value: 'receita', label: 'Faturamento' }, { value: 'fretes', label: 'Minutas' }] as const;
const ROUTE_DRILL_LEVELS: Array<{ value: RouteDrillLevel; label: string }> = [
  { value: 'rota', label: 'Rota' },
  { value: 'origem', label: 'UF origem' },
  { value: 'destino', label: 'UF destino' },
];
const RESPONSAVEL_DRILL_LEVELS: Array<{ value: ResponsavelDrillLevel; label: string }> = [
  { value: 'responsavel', label: 'Responsável' },
  { value: 'uf', label: 'UF' },
  { value: 'cidade', label: 'Cidade' },
];
const FATURAMENTO_DATE_HELP = 'Usa a emissão do CT-e quando existir; se não existir, usa a data operacional.';
const MIN_CUSTOM_CHART_HEIGHT = 350;
const KPI_CARD_HEIGHT_CLASS = 'min-h-0 lg:h-[28rem]';
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const DAY_MS = 24 * 60 * 60 * 1000;

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

function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function countBusinessDays(start: Date, end: Date): number {
  if (end < start) return 0;
  let total = 0;
  for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
    if (isBusinessDay(current)) total += 1;
  }
  return total;
}

function countBusinessDaysInMonth(year: number, monthIndex: number): number {
  return countBusinessDays(new Date(year, monthIndex, 1), new Date(year, monthIndex + 1, 0));
}

function countBusinessDaysInYear(year: number): number {
  return countBusinessDays(new Date(year, 0, 1), new Date(year, 11, 31));
}

function criarFiltroPeriodoAnterior(filtro: FaturamentoFiltro): FaturamentoFiltro {
  const inicio = parseDateLocal(filtro.dataInicio);
  const fim = parseDateLocal(filtro.dataFim);
  const diasPeriodo = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / DAY_MS) + 1);
  const fimAnterior = new Date(inicio);
  fimAnterior.setDate(fimAnterior.getDate() - 1);
  const inicioAnterior = new Date(fimAnterior);
  inicioAnterior.setDate(inicioAnterior.getDate() - diasPeriodo + 1);

  return {
    ...filtro,
    dataInicio: toIsoDate(inicioAnterior),
    dataFim: toIsoDate(fimAnterior),
  };
}

function percentualVariacao(atual: number, anterior: number): number {
  if (anterior === 0) {
    return atual > 0 ? 100 : 0;
  }
  return ((atual - anterior) / anterior) * 100;
}

function chartClickName(params: unknown): string | null {
  const item = params as { name?: unknown; data?: { name?: unknown } };
  if (typeof item.data?.name === 'string') {
    return item.data.name;
  }
  return typeof item.name === 'string' ? item.name : null;
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function groupTopWithOthers(dados: ChartDatum[], limit: number, metric: FaturamentoMetric = 'receita'): ChartDatum[] {
  const sorted = [...dados].sort((left, right) => getMetricValue(right, metric) - getMetricValue(left, metric));
  if (sorted.length <= limit) {
    return sorted;
  }

  const top = sorted.slice(0, limit);
  const outros = sorted.slice(limit).reduce(
    (acc, item) => ({
      nome: 'Outros',
      receita: acc.receita + item.receita,
      fretes: acc.fretes + item.fretes,
    }),
    { nome: 'Outros', receita: 0, fretes: 0 },
  );

  return outros.receita > 0 || outros.fretes > 0 ? [...top, outros] : top;
}

function getMetricValue(item: ChartDatum, metric: FaturamentoMetric): number {
  return metric === 'receita' ? item.receita : item.fretes;
}

function RouteDrillControls({
  level,
  metric,
  onChange,
  onMetricChange,
}: {
  level: RouteDrillLevel;
  metric: FaturamentoMetric;
  onChange: (level: RouteDrillLevel) => void;
  onMetricChange: (metric: FaturamentoMetric) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <DashboardSegments label="Métrica" options={METRIC_OPTIONS} value={metric} onChange={onMetricChange} />
      <DashboardSegments label="Agrupamento"
        options={ROUTE_DRILL_LEVELS}
        value={level}
        onChange={onChange}
      />
    </div>
  );
}

function ResponsavelActions({
  drillLevel,
  metric,
  onDrillChange,
  onMetricChange,
}: {
  drillLevel: ResponsavelDrillLevel;
  metric: FaturamentoMetric;
  onDrillChange: (level: ResponsavelDrillLevel) => void;
  onMetricChange: (metric: FaturamentoMetric) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <DashboardSegments label="Métrica" options={METRIC_OPTIONS} value={metric} onChange={onMetricChange} />
      <DashboardSegments label="Agrupamento"
        options={RESPONSAVEL_DRILL_LEVELS}
        value={drillLevel}
        onChange={onDrillChange}
      />
    </div>
  );
}

function buildClassificacaoDonutOption(dados: ChartDatum[], selectedName: string | null, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const hasSelection = Boolean(selectedName && dados.some((item) => item.nome === selectedName));

  return buildBaseDonutOption(isDark, {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number; percent?: number };
        return [
          `<strong>${escapeHtml(item.name ?? '')}</strong>`,
          `Faturamento: ${formatarMoeda(Number(item.value ?? 0))}`,
          `Participação: ${formatarNumero(Number(item.percent ?? 0), 1)}%`,
        ].join('<br/>');
      },
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['38%', '64%'],
        center: ['50%', '50%'],
        data: dados.map((item, index) => ({
          name: item.nome,
          value: item.receita,
          itemStyle: {
            color: tokens.palette[index % tokens.palette.length],
            opacity: hasSelection && selectedName !== item.nome ? 0.35 : 1,
          },
        })),
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 10,
          width: 92,
          overflow: 'truncate',
        },
        labelLine: {
          show: true,
          length: 10,
          length2: 6,
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.22)' },
        },
      },
    ],
  });
}

function buildClientePieOption(dados: ChartDatum[], selectedName: string | null, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const hasSelection = Boolean(selectedName && dados.some((item) => item.nome === selectedName));

  return buildBaseDonutOption(isDark, {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number; percent?: number };
        return [
          `<strong>${escapeHtml(item.name ?? '')}</strong>`,
          `Faturamento: ${formatarMoeda(Number(item.value ?? 0))}`,
          `Participação: ${formatarNumero(Number(item.percent ?? 0), 1)}%`,
        ].join('<br/>');
      },
    },
    legend: { show: false },
    series: [
      {
        type: 'pie',
        radius: ['36%', '60%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        data: dados.map((item, index) => ({
          name: item.nome,
          value: item.receita,
          itemStyle: {
            color: tokens.palette[index % tokens.palette.length],
            opacity: hasSelection && selectedName !== item.nome ? 0.35 : 1,
          },
        })),
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 10,
          width: 88,
          overflow: 'truncate',
        },
        labelLine: {
          show: true,
          length: 8,
          length2: 5,
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: 'shiftY',
        },
        emphasis: {
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 11,
            fontWeight: 'bold',
          },
          itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.22)' },
        },
      },
    ],
  });
}

function buildHorizontalBarOption(
  dados: ChartDatum[],
  selectedName: string | null,
  metric: FaturamentoMetric,
  isDark: boolean,
  color?: string,
): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const barColor = color ?? tokens.palette[1];
  const sorted = [...dados].sort((left, right) => getMetricValue(right, metric) - getMetricValue(left, metric));
  const dadosRevertidos = sorted.reverse();
  const totalMetric = sorted.reduce((acc, item) => acc + getMetricValue(item, metric), 0);
  const metricLabel = metric === 'receita' ? 'Faturamento' : 'Minutas';
  const hasSelection = Boolean(selectedName && dados.some((item) => item.nome === selectedName));

  return buildBaseBarOption(isDark, {
    legend: { show: false },
    grid: { left: 8, right: 18, top: 18, bottom: 18, containLabel: true },
    xAxis: { type: 'value', name: metric === 'receita' ? 'R$' : 'Qtd' },
    yAxis: {
      type: 'category',
      data: dadosRevertidos.map((item) => truncateLabel(item.nome, 24)),
    },
    series: [
      {
        name: metricLabel,
        type: 'bar',
        data: dadosRevertidos.map((item) => ({
          name: item.nome,
          value: getMetricValue(item, metric),
          itemStyle: {
            color: barColor,
            opacity: hasSelection && selectedName !== item.nome ? 0.35 : 1,
          },
        })),
        barMaxWidth: 22,
      },
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = Array.isArray(params) ? params[0] as { dataIndex?: number } : null;
        const original = typeof item?.dataIndex === 'number' ? dadosRevertidos[item.dataIndex] : null;
        if (!original) return '';
        const value = getMetricValue(original, metric);
        const percent = totalMetric > 0 ? (value / totalMetric) * 100 : 0;
        return [
          `<strong>${escapeHtml(original.nome)}</strong>`,
          `Faturamento: ${formatarMoeda(original.receita)}`,
            `Minutas: ${formatarNumero(original.fretes)}`,
          `Participação: ${formatarPorcentagem(percent, 1)}`,
        ].join('<br/>');
      },
    },
  });
}

function buildEvolutionOption(
  dados: FaturamentoTrendPoint[],
  level: PeriodDrillLevel,
  dataFim: string,
  metaDiaria: number,
  isDark: boolean,
): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const referencia = parseDateLocal(dataFim);
  const anoReferencia = referencia.getFullYear();
  const mesReferencia = referencia.getMonth();
  const buckets = new Map<string, number>();

  for (const item of dados) {
    const date = parseDateLocal(item.date);
    let key = String(date.getFullYear());

    if (level === 'mes') {
      if (date.getFullYear() !== anoReferencia) continue;
      key = String(date.getMonth());
    }

    if (level === 'dia') {
      if (date.getFullYear() !== anoReferencia || date.getMonth() !== mesReferencia) continue;
      key = String(date.getDate());
    }

    buckets.set(key, (buckets.get(key) ?? 0) + item.receitaBruta);
  }

  let labels: string[];
  let values: number[];
  let metaValues: number[];

  if (level === 'ano') {
    const years = Array.from(new Set([...dados.map((item) => parseDateLocal(item.date).getFullYear()), anoReferencia]))
      .sort((left, right) => left - right);
    labels = years.map(String);
    values = years.map((year) => buckets.get(String(year)) ?? 0);
    metaValues = years.map((year) => metaDiaria * countBusinessDaysInYear(year));
  } else if (level === 'mes') {
    labels = MONTH_LABELS;
    values = MONTH_LABELS.map((_, monthIndex) => buckets.get(String(monthIndex)) ?? 0);
    metaValues = MONTH_LABELS.map((_, monthIndex) => metaDiaria * countBusinessDaysInMonth(anoReferencia, monthIndex));
  } else {
    const daysInMonth = new Date(anoReferencia, mesReferencia + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, index) => String(index + 1));
    values = labels.map((day) => buckets.get(day) ?? 0);
    metaValues = labels.map(() => metaDiaria);
  }

  return buildBaseLineOption(isDark, buildBaseBarOption(isDark, {
    grid: { left: 10, right: 20, top: 42, bottom: 34, containLabel: true },
    legend: { bottom: 0 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', name: 'R$' },
    series: [
      {
        name: 'Real',
        type: 'bar',
        data: values.map((value, index) => ({
          value,
          itemStyle: { color: value >= metaValues[index] ? tokens.palette[2] : tokens.palette[3] },
        })),
        barCategoryGap: level === 'dia' ? '18%' : '24%',
        barMaxWidth: level === 'dia' ? 30 : 52,
      },
      {
        name: 'Meta',
        type: 'line',
        data: metaValues,
        symbol: 'none',
        lineStyle: {
          color: tokens.palette[0],
          type: 'dashed',
          width: 3,
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params as Array<{ marker?: string; seriesName?: string; value?: number | { value?: number } }> : [];
        return items
          .map((item) => {
            const rawValue = typeof item.value === 'object' ? item.value?.value : item.value;
            return `${item.marker ?? ''}${escapeHtml(item.seriesName)}: ${formatarMoeda(Number(rawValue ?? 0))}`;
          })
          .join('<br/>');
      },
    },
  }));
}

function FaturamentoEvolutionCard({
  chartKey,
  dados,
  isLoading,
  drillLevel,
  onDrillLevelChange,
  dataFim,
  metaDiaria,
  faturamentoDiarioReal,
  diferencaDiaria,
  faturamentoFaltante,
  metaDiariaDinamica,
}: {
  chartKey?: ChartDictionaryKey;
  dados: FaturamentoTrendPoint[];
  isLoading?: boolean;
  drillLevel: PeriodDrillLevel;
  onDrillLevelChange: (level: PeriodDrillLevel) => void;
  dataFim: string;
  metaDiaria: number;
  faturamentoDiarioReal: number;
  diferencaDiaria: number;
  faturamentoFaltante: number;
  metaDiariaDinamica: number;
}) {
  const { isDark } = useEchartsTheme();
  const option = useMemo(
    () => buildEvolutionOption(dados, drillLevel, dataFim, metaDiaria, isDark),
    [dados, dataFim, drillLevel, isDark, metaDiaria],
  );

  const indicadores = [
    { definition: KpiDictionary.faturamento.metaDiaria, label: 'Meta de Faturamento Diário', value: formatarMoeda(metaDiaria), tone: 'neutral' },
    { definition: KpiDictionary.faturamento.faturamentoDiarioReal, label: 'Faturamento Diário Real', value: formatarMoeda(faturamentoDiarioReal), tone: 'neutral' },
    { definition: KpiDictionary.faturamento.diferencaDiaria, label: 'Diferença', value: formatarMoeda(diferencaDiaria), tone: diferencaDiaria < 0 ? 'danger' : 'success' },
    { definition: KpiDictionary.faturamento.faturamentoFaltante, label: 'Faturamento Faltante', value: formatarMoeda(faturamentoFaltante), tone: 'neutral' },
    { definition: KpiDictionary.faturamento.metaDiariaDinamica, label: 'Meta Diária Dinâmica', value: formatarMoeda(metaDiariaDinamica), tone: 'neutral' },
  ];

  return (
    <ChartCard
      titulo="Evolução do Faturamento"
      chartKey={chartKey}
      actions={<DashboardSegments label="Agrupar por período" options={PERIOD_LEVELS} value={drillLevel} onChange={onDrillLevelChange} />}
      isLoading={isLoading}
      isEmpty={dados.length === 0}
      className="h-full"
    >
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1 lg:flex-row lg:overflow-hidden">
        <div className="w-full shrink-0 space-y-3 lg:w-[13rem]">
          {indicadores.map((item) => (
            <TooltipKpi
              key={item.label}
              definition={item.definition}
              className="w-full rounded-lg"
              style={{ flex: '0 0 auto' }}
            >
              <div className="w-full">
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.label}</p>
                <p
                  className="mt-0.5 text-xl font-bold leading-tight"
                  style={{
                    color: item.tone === 'danger' ? CORES.perigo : item.tone === 'success' ? CORES.sucesso : 'var(--color-text)',
                  }}
                >
                  {item.value}
                </p>
              </div>
            </TooltipKpi>
          ))}
        </div>
        <div className="min-h-[350px] min-w-0 flex-1 lg:min-h-0">
          <AstryxDashboardChart option={option} label="Evolução do faturamento" style={{ height: "100%", minHeight: MIN_CUSTOM_CHART_HEIGHT }} />
        </div>
      </div>
    </ChartCard>
  );
}

function buildTopClientesRows(
  atuais: FaturamentoClienteRanking[],
  anteriores: FaturamentoClienteRanking[],
) {
  const anteriorPorCliente = new Map(anteriores.map((item) => [clienteRankingKey(item), item.receita]));

  return atuais.slice(0, 10).map((item, index) => {
    const clienteKey = clienteRankingKey(item);
    const mesAnterior = anteriorPorCliente.get(clienteKey) ?? 0;
    return {
      ranking: index + 1,
      clienteKey,
      cliente: clienteRankingLabel(item),
      mesAnterior,
      mesAtual: item.receita,
      variacao: percentualVariacao(item.receita, mesAnterior),
    };
  });
}

function clienteRankingKey(item: FaturamentoClienteRanking) {
  return item.cnpjBase || item.cliente;
}

function clienteRankingLabel(item: FaturamentoClienteRanking) {
  return item.cnpjBase ? `${item.cliente} (${item.cnpjBase})` : item.cliente;
}

function TopClientesTableCard({
  atuais,
  anteriores,
  isLoading,
}: {
  atuais: FaturamentoClienteRanking[];
  anteriores: FaturamentoClienteRanking[];
  isLoading?: boolean;
}) {
  const rows = useMemo(() => buildTopClientesRows(atuais, anteriores), [atuais, anteriores]);
  const totalAnterior = rows.reduce((acc, item) => acc + item.mesAnterior, 0);
  const totalAtual = rows.reduce((acc, item) => acc + item.mesAtual, 0);
  const variacaoTotal = percentualVariacao(totalAtual, totalAnterior);

  function renderVariacao(value: number) {
    if (value > 0) {
      return <span className="inline-flex max-w-full items-center gap-1 font-semibold text-emerald-600"><ArrowUp className="shrink-0" size={16} /><TableText>{formatarPorcentagem(value, 0)}</TableText></span>;
    }
    if (value < 0) {
      return <span className="inline-flex max-w-full items-center gap-1 font-semibold text-red-600"><ArrowDown className="shrink-0" size={16} /><TableText>{formatarPorcentagem(value, 0)}</TableText></span>;
    }
    return <span className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--color-text-muted)' }}><Minus size={16} />0%</span>;
  }

  return (
    <ChartCard
      titulo="Top 10 Clientes"
      isLoading={isLoading}
      isEmpty={rows.length === 0}
      className="h-full"
    >
      <div className="flex h-full min-h-0 flex-col overflow-x-auto overflow-y-hidden">
        <div className="flex h-full min-h-0 min-w-[560px] flex-1 flex-col">
          <Table className="w-full table-fixed text-sm shrink-0">
            <colgroup>
              <col className="w-[70px]" />
              <col />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[95px]" />
            </colgroup>
            <TableHeader>
              <TableRow isHeaderRow className="border-b text-left" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
                <TableHeaderCell className="px-2 py-2 text-center font-bold">Ranking</TableHeaderCell>
                <TableHeaderCell className="px-2 py-2 font-bold">Cliente</TableHeaderCell>
                <TableHeaderCell className="px-2 py-2 text-right font-bold">Mês Anterior</TableHeaderCell>
                <TableHeaderCell className="px-2 py-2 text-right font-bold">Mês Atual</TableHeaderCell>
                <TableHeaderCell className="px-2 py-2 text-center font-bold">Variação</TableHeaderCell>
              </TableRow>
            </TableHeader>
          </Table>

          <div
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <Table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[70px]" />
                <col />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[95px]" />
              </colgroup>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${row.clienteKey}-${index}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                    <TableCell className="px-2 py-1.5 text-center" style={{ color: 'var(--color-text)' }}>{`${row.ranking}º`}</TableCell>
                    <TableCell className="px-2 py-1.5" style={{ color: 'var(--color-text)' }}>{row.cliente}</TableCell>
                    <TableCell className="px-2 py-1.5 text-right" style={{ color: 'var(--color-text)' }}>{formatarMoeda(row.mesAnterior)}</TableCell>
                    <TableCell className="px-2 py-1.5 text-right" style={{ color: 'var(--color-text)' }}>{formatarMoeda(row.mesAtual)}</TableCell>
                    <TableCell className="px-2 py-1.5 text-center">{renderVariacao(row.variacao)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Table className="w-full table-fixed text-sm shrink-0">
            <colgroup>
              <col className="w-[70px]" />
              <col />
              <col className="w-[130px]" />
              <col className="w-[130px]" />
              <col className="w-[95px]" />
            </colgroup>
            <tfoot>
              <TableRow className="border-t text-sm font-bold" style={{ borderColor: 'var(--color-text)', color: 'var(--color-text)' }}>
                <TableCell className="px-2 py-2" />
                <TableCell className="px-2 py-2">Total</TableCell>
                <TableCell className="px-2 py-2 text-right">{formatarMoeda(totalAnterior)}</TableCell>
                <TableCell className="px-2 py-2 text-right">{formatarMoeda(totalAtual)}</TableCell>
                <TableCell className="px-2 py-2 text-center">{renderVariacao(variacaoTotal)}</TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      </div>
    </ChartCard>
  );
}

export default function FaturamentoPage() {
  const [carregarOpcoesDeFiltro, setCarregarOpcoesDeFiltro] = useState(false);
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, setFiltros, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const [periodDrillLevel, setPeriodDrillLevel] = useState<PeriodDrillLevel>('dia');
  const [routeDrillLevel, setRouteDrillLevel] = useState<RouteDrillLevel>('rota');
  const [routeMetric, setRouteMetric] = useState<FaturamentoMetric>('receita');
  const [responsavelDrillLevel, setResponsavelDrillLevel] = useState<ResponsavelDrillLevel>('responsavel');
  const [responsavelMetric, setResponsavelMetric] = useState<FaturamentoMetric>('receita');
  const [selectedClassificacao, setSelectedClassificacao] = useState<string | null>(null);
  const [selectedResponsavel, setSelectedResponsavel] = useState<string | null>(null);
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null);
  const [selectedRota, setSelectedRota] = useState<string | null>(null);
  const [goalsPanelOpen, setGoalsPanelOpen] = useState(false);
  const [goalsPanelYear, setGoalsPanelYear] = useState(() => new Date().getFullYear());
  const [goalsPanelMonth, setGoalsPanelMonth] = useState(() => new Date().getMonth() + 1);
  const faturamentoTableRef = useRef<HTMLDivElement>(null);
  const { canAccess } = usePermissions();
  const filiais = useFiliais();
  const clientes = useClientes(carregarOpcoesDeFiltro);

  const filtro: FaturamentoFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    status: filtros.status,
    pagadores: filtros.pagadores,
    responsaveis: filtros.responsaveis,
  }), [dataFim, dataInicio, filtros.filiais, filtros.pagadores, filtros.parceirosLogisticos, filtros.responsaveis, filtros.status]);
  const filtroPeriodoAnterior = useMemo(
    () => criarFiltroPeriodoAnterior(filtro),
    [filtro],
  );
  const filtroSemResponsaveis = useMemo<FaturamentoFiltro>(() => ({
    ...filtro,
    responsaveis: undefined,
  }), [filtro]);

  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais',   count: filtros.filiais?.length   ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Pagadores', count: filtros.pagadores?.length ?? 0, onRemove: () => setFiltro('pagadores', []) },
    { label: 'Responsáveis', count: filtros.responsaveis?.length ?? 0, onRemove: () => setFiltro('responsaveis', []) },
    { label: 'Status',    count: filtros.status?.length    ?? 0, onRemove: () => setFiltro('status', []) },
  ];

  const overview = useFaturamentoOverview(filtro);
  const serie = useFaturamentoSerie(filtro);
  const graficos = useFaturamentoGraficos(filtro);
  const metas = useFaturamentoMetas(filtro);
  const metasConfiguracoes = useFaturamentoMetasConfiguracoes(goalsPanelYear, goalsPanelMonth, goalsPanelOpen);
  const salvarMeta = useSalvarFaturamentoMetaConfiguracao();
  const removerMeta = useRemoverFaturamentoMetaConfiguracao();
  const replicarMetas = useReplicarFaturamentoMetasConfiguracoes();
  const topClientes = useFaturamentoTopClientes(filtro, 10);
  const topClientesPeriodoAnterior = useFaturamentoTopClientes(filtroPeriodoAnterior, 50);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useFaturamentoTabelaPaginada(
    filtro,
    paginacaoTabela.pagina,
    paginacaoTabela.tamanhoPagina,
    filtrosTabela.apiFilters,
  );

  const filtroParaStatus: FaturamentoFiltro = {
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    pagadores: filtros.pagadores,
    responsaveis: filtros.responsaveis,
  };
  const statusFaturamento = useFaturamentoStatus(filtroParaStatus);
  const responsaveis = useFaturamentoResponsaveis(filtroSemResponsaveis, carregarOpcoesDeFiltro);

  usePageHeader({
    title: 'Faturamento',
    description: 'Carteira de clientes - Meta e evolução do faturamento',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const canManageFaturamentoGoals = canAccess('can_manage_kpi_goals');

  const overviewData = overview.data;
  const metasData = metas.data;
  const metasIndisponiveis = metas.isError;
  const metaFaturamento = metasIndisponiveis
    ? 0
    : metasData?.metaFaturamento ?? overviewData?.metaFaturamento ?? 0;
  const progressoMeta = metaFaturamento > 0
    ? (metasData?.percentualAtingimentoFaturamento ?? overviewData?.percentualAtingimentoFaturamento ?? 0)
    : 0;
  const faturamentoDiario = overviewData?.faturamentoDiario;
  const metaDiaria = faturamentoDiario?.metaDiariaBase ?? 0;
  const faturamentoDiarioReal = faturamentoDiario?.faturamentoDiarioReal ?? 0;
  const diferencaDiaria = faturamentoDiarioReal - metaDiaria;
  const faturamentoFaltante = faturamentoDiario?.faturamentoFaltante ?? 0;
  const metaDiariaDinamica = faturamentoDiario?.metaDiariaDinamica ?? 0;

  const classificacaoEntries = useMemo(
    () => groupTopWithOthers(graficos.data?.faturamentoPorClassificacao ?? [], 5),
    [graficos.data?.faturamentoPorClassificacao],
  );
  const responsavelEntries = useMemo(() => {
    if (responsavelDrillLevel === 'uf') {
      return groupTopWithOthers(graficos.data?.faturamentoPorUfDestino ?? [], 10, responsavelMetric);
    }
    if (responsavelDrillLevel === 'cidade') {
      return groupTopWithOthers(graficos.data?.faturamentoPorCidadeDestino ?? [], 10, responsavelMetric);
    }
    return groupTopWithOthers(graficos.data?.faturamentoPorResponsavelDestino ?? [], 10, responsavelMetric);
  }, [
    graficos.data?.faturamentoPorCidadeDestino,
    graficos.data?.faturamentoPorResponsavelDestino,
    graficos.data?.faturamentoPorUfDestino,
    responsavelDrillLevel,
    responsavelMetric,
  ]);
  const rotaEntries = useMemo(() => {
    if (routeDrillLevel === 'origem') {
      return groupTopWithOthers(graficos.data?.faturamentoPorUfOrigem ?? [], 10, routeMetric);
    }
    if (routeDrillLevel === 'destino') {
      return groupTopWithOthers(graficos.data?.faturamentoPorUfDestino ?? [], 10, routeMetric);
    }
    return groupTopWithOthers(
      (graficos.data?.topRotasPorReceita ?? []).map((item) => ({
        nome: `${item.origemUf} -> ${item.destinoUf}`,
        receita: item.receita,
        fretes: item.fretes,
      })),
      10,
      routeMetric,
    );
  }, [
    graficos.data?.faturamentoPorUfDestino,
    graficos.data?.faturamentoPorUfOrigem,
    graficos.data?.topRotasPorReceita,
    routeDrillLevel,
    routeMetric,
  ]);
  const topClientesData = useMemo(() => topClientes.data ?? [], [topClientes.data]);
  const participacaoClientes = useMemo<ChartDatum[]>(() => {
    const top = topClientesData.slice(0, 8).map((item) => ({ nome: clienteRankingLabel(item), receita: item.receita, fretes: item.fretes }));
    const somaTop = top.reduce((acc, item) => acc + item.receita, 0);
    const outros = Math.max((overviewData?.receitaBruta ?? 0) - somaTop, 0);
    return outros > 0 ? [...top, { nome: 'Outros', receita: outros, fretes: 0 }] : top;
  }, [overviewData?.receitaBruta, topClientesData]);

  const classificacaoOption = useMemo(
    () => buildClassificacaoDonutOption(classificacaoEntries, selectedClassificacao, isDark),
    [classificacaoEntries, isDark, selectedClassificacao],
  );
  const participacaoClientesOption = useMemo(
    () => buildClientePieOption(participacaoClientes, selectedCliente, isDark),
    [isDark, participacaoClientes, selectedCliente],
  );
  const responsavelOption = useMemo(
    () => buildHorizontalBarOption(responsavelEntries, selectedResponsavel, responsavelMetric, isDark, getEchartsThemeTokens(isDark).palette[2]),
    [isDark, responsavelEntries, responsavelMetric, selectedResponsavel],
  );
  const rotaOption = useMemo(
    () => buildHorizontalBarOption(rotaEntries, selectedRota, routeMetric, isDark, getEchartsThemeTokens(isDark).palette[1]),
    [isDark, rotaEntries, routeMetric, selectedRota],
  );

  const statusTabelaOptions = combinarStatusOptions(
    statusFaturamento.data,
    (tabela.data?.conteudo ?? []).map((item) => item.status),
    filtros.status,
  );
  const metasPorFilial = useMemo(() => {
    const map = new Map<string, NonNullable<typeof metasData>['branches'][number]>();
    for (const branch of metasData?.branches ?? []) {
      map.set(branch.branchId, branch);
    }
    return map;
  }, [metasData]);
  const usarMetaGlobalNaTabela = (filtros.filiais?.length ?? 0) + (filtros.parceirosLogisticos?.length ?? 0) === 0;
  const tabelaConteudo = useMemo(() => (
    (tabela.data?.conteudo ?? []).map((row) => {
      const metaFilial = row.filial ? metasPorFilial.get(row.filial) : null;
      const metaAplicada = usarMetaGlobalNaTabela && metasData
        ? metasData
        : metaFilial;
      return {
        ...row,
        metaFaturamento: metaAplicada?.metaFaturamento ?? 0,
        percentualAtingimentoFaturamento: metaAplicada?.percentualAtingimentoFaturamento ?? 0,
      };
    })
  ), [metasData, metasPorFilial, tabela.data, usarMetaGlobalNaTabela]);
  const managerIsSaving = salvarMeta.isPending || removerMeta.isPending || replicarMetas.isPending;
  const managerSaveError = salvarMeta.error ?? removerMeta.error;

  function abrirGerenciadorMetas() {
    const fim = parseDateLocal(dataFim);
    setGoalsPanelYear(fim.getFullYear());
    setGoalsPanelMonth(fim.getMonth() + 1);
    setGoalsPanelOpen((current) => !current);
  }

  async function salvarMetaFaturamento(payload: Parameters<typeof salvarMeta.mutateAsync>[0]) {
    await salvarMeta.mutateAsync(payload);
  }

  async function removerMetaFaturamento(branchId: string, ano: number, mes: number) {
    await removerMeta.mutateAsync({ branchId, ano, mes });
  }

  async function replicarMetasFaturamento(ano: number, mes: number) {
    return replicarMetas.mutateAsync({ ano, mes });
  }

  function renderMetaPercentualTabela(valor: unknown) {
    const numberValue = Number(valor ?? 0);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
      return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
    }
    return <span className={numberValue >= 100 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'}><TableText>{formatarPorcentagem(numberValue, 1)}</TableText></span>;
  }

  function renderDataFaturamentoTabela(valor: unknown, row: FaturamentoResumoRow) {
    const texto = valor ? formatarDataHoraMinuto(String(valor)) : '—';
    const origem = row.dataFaturamentoOrigem ?? 'Origem não informada';
    return (
      <span className="inline-flex max-w-full items-center gap-1">
        <TableText>{texto}</TableText>
        <span className="shrink-0" title={`Origem desta data: ${origem}`}>
          <Info size={12} style={{ color: 'var(--color-text-muted)' }} aria-label={`Origem desta data: ${origem}`} />
        </span>
      </span>
    );
  }

  function renderStatusFaturamentoTabela(valor: unknown) {
    const status = formatarStatusOperacional(valor);
    return status ? <StatusBadge status={status} /> : '—';
  }

  const colunas: ColunaTabelaAnalitica<FaturamentoResumoRow>[] = [
    { chave: 'numeroMinuta', label: 'Nº Minuta', largura: '136px', fixo: true, filtroTabela: 'codigo' },
    { chave: 'dataFrete', label: 'Data Faturamento', largura: '184px', tooltip: FATURAMENTO_DATE_HELP, formato: renderDataFaturamentoTabela },
    { chave: 'status', label: 'Status', filtroTabela: 'status', formato: renderStatusFaturamentoTabela },
    { chave: 'filial', label: 'Filial', largura: '206px' },
    { chave: 'pagador', label: 'Pagador', largura: '280px', filtroTabela: 'razaoSocial' },
    { chave: 'documentoTipo', label: 'Documento', largura: '138px' },
    { chave: 'valorFrete', label: 'Faturamento Líquido', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'valorTotalServico', label: 'Faturamento', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'metaFaturamento', label: 'Meta Faturamento', formato: (valor) => Number(valor ?? 0) > 0 ? formatarMoeda(Number(valor ?? 0)) : '—' },
    {
      chave: 'percentualAtingimentoFaturamento',
      label: '% Ating. Fat.',
      formato: renderMetaPercentualTabela,
    },
    { chave: 'pesoTaxado', label: 'Peso', largura: '110px', formato: (valor) => formatarPeso(Number(valor ?? 0)) },
    { chave: 'volumes', label: 'Volumes', largura: '106px' },
    { chave: 'origemUf', label: 'UF Origem', largura: '125px', filtroTabela: 'origem' },
    { chave: 'destinoUf', label: 'UF Destino', largura: '125px', filtroTabela: 'destino' },
    { chave: 'previsaoEntrega', label: 'Previsao' },
  ];

  return (
    <div className="w-full">
      <FilterBar
        onOpen={() => setCarregarOpcoesDeFiltro(true)}
        period={(
          <DateRangePicker
            dataInicio={dataInicio}
            dataFim={dataFim}
            onDataInicioChange={setDataInicio}
            onDataFimChange={setDataFim}
            onRangeChange={setDataRange}
          />
        )}
        onClear={limparFiltros}
        activeFilters={activeFilters}
        dataInicio={dataInicio}
        dataFim={dataFim}
        dateAccessory={overview.data ? (
          <span
            className="font-medium tabular-nums"
            style={{ color: 'var(--color-text)' }}
          >
            {overview.data.totalDiasUteis} Dias Úteis
          </span>
        ) : null}
        actions={canManageFaturamentoGoals ? (
          <DashboardButton
            type="button"
            onClick={abrirGerenciadorMetas}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-[var(--color-bg)] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{ color: 'var(--color-text)' }}
          >
            <Settings size={14} aria-hidden="true" />
            Gerenciar Metas
          </DashboardButton>
        ) : null}
      >
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? []}
          filiaisSelecionadas={filtros.filiais ?? []}
          parceirosSelecionados={filtros.parceirosLogisticos ?? []}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
        <AsyncMultiSelect
          label="Pagadores"
          opcoes={clientes.data ?? []}
          selecionados={filtros.pagadores ?? []}
          onChange={(valores) => setFiltro('pagadores', valores)}
          isLoading={clientes.isLoading}
        />
        <AsyncMultiSelect
          label="Responsáveis"
          opcoes={responsaveis.data ?? []}
          selecionados={filtros.responsaveis ?? []}
          onChange={(valores) => setFiltro('responsaveis', valores)}
          isLoading={responsaveis.isLoading}
        />
        <AsyncMultiSelect
          label="Status"
          opcoes={statusFaturamento.data ?? []}
          selecionados={filtros.status ?? []}
          onChange={(valores) => setFiltro('status', valores)}
          isLoading={statusFaturamento.isLoading}
        />
      </FilterBar>

      {canManageFaturamentoGoals ? (
        <FaturamentoGoalsManagerPanel
          open={goalsPanelOpen}
          branchOptions={filiais.data ?? []}
          data={metasConfiguracoes.data}
          ano={goalsPanelYear}
          mes={goalsPanelMonth}
          isLoading={metasConfiguracoes.isLoading}
          isSaving={managerIsSaving}
          error={metasConfiguracoes.error}
          saveError={managerSaveError}
          replicateError={replicarMetas.error}
          isReplicating={replicarMetas.isPending}
          onPeriodChange={(ano, mes) => {
            setGoalsPanelYear(ano);
            setGoalsPanelMonth(mes);
          }}
          onSave={salvarMetaFaturamento}
          onRemove={removerMetaFaturamento}
          onReplicatePreviousMonth={replicarMetasFaturamento}
          onViewScope={(branchId) => {
            const isParceiro = isParceiroLogistico(branchId);
            setFiltros({
              filiais: branchId !== 'GLOBAL' && !isParceiro ? [branchId] : [],
              parceirosLogisticos: branchId !== 'GLOBAL' && isParceiro ? [branchId] : [],
            });
            paginacaoTabela.setPagina(1);
            setGoalsPanelOpen(false);
            window.requestAnimationFrame(() => {
              faturamentoTableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
        />
      ) : null}

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de faturamento.')} tipo={getTipoErro(overview.error)} />}
      {overview.isLoading && !overview.data && <LoadingKpiGrid count={8} className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[0.8fr_2fr_2fr_1fr_1.1fr_1fr_2fr_1.25fr]" />}
      {overview.data && (
        <FaturamentoKpiGrid
          overview={overview.data}
          metaFaturamento={metaFaturamento}
          progressoMeta={progressoMeta}
          faturamentoDiario={faturamentoDiario}
          metasIndisponiveis={metasIndisponiveis}
        />
      )}

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-12">
        <div className={`${KPI_CARD_HEIGHT_CLASS} lg:col-span-full 2xl:col-span-5`}>
          <FaturamentoEvolutionCard
            chartKey="evolucaoFaturamento"
            dados={serie.data ?? []}
            isLoading={serie.isLoading}
            drillLevel={periodDrillLevel}
            onDrillLevelChange={setPeriodDrillLevel}
            dataFim={dataFim}
            metaDiaria={metaDiaria}
            faturamentoDiarioReal={faturamentoDiarioReal}
            diferencaDiaria={diferencaDiaria}
            faturamentoFaltante={faturamentoFaltante}
            metaDiariaDinamica={metaDiariaDinamica}
          />
        </div>
        <div className={`${KPI_CARD_HEIGHT_CLASS} 2xl:col-span-3`}>
          <ChartWrapper
            titulo="Faturamento por Classificação (FTL/LTL/PTL)"
            chartKey="faturamentoClassificacao"
            className="h-full"
            option={classificacaoOption}
            isLoading={graficos.isLoading}
            isEmpty={classificacaoEntries.length === 0}
            altura="100%"
            onEvents={{
              click: (params) => {
                const name = chartClickName(params);
                setSelectedClassificacao((current) => current === name ? null : name);
              },
            }}
          />
        </div>
        <div className={`${KPI_CARD_HEIGHT_CLASS} 2xl:col-span-4`}>
          <ChartWrapper
            titulo="Faturamento por Responsável pela Região de Destino"
            chartKey="faturamentoResponsavel"
            actions={(
              <ResponsavelActions
                drillLevel={responsavelDrillLevel}
                metric={responsavelMetric}
                onDrillChange={(level) => {
                  setSelectedResponsavel(null);
                  setResponsavelDrillLevel(level);
                }}
                onMetricChange={setResponsavelMetric}
              />
            )}
            className="h-full"
            option={responsavelOption}
            isLoading={graficos.isLoading}
            isEmpty={responsavelEntries.length === 0}
            altura="100%"
            onEvents={{
              click: (params) => {
                const name = chartClickName(params);
                setSelectedResponsavel((current) => current === name ? null : name);
              },
            }}
          />
        </div>
        <div className={`${KPI_CARD_HEIGHT_CLASS} lg:col-span-full 2xl:col-span-5`}>
          <TopClientesTableCard
            atuais={topClientesData}
            anteriores={topClientesPeriodoAnterior.data ?? []}
            isLoading={topClientes.isLoading || topClientesPeriodoAnterior.isLoading}
          />
        </div>
        <div className={`${KPI_CARD_HEIGHT_CLASS} 2xl:col-span-3`}>
          <ChartWrapper
            titulo="Participação de Clientes no Faturamento"
            chartKey="faturamentoParticipacaoClientes"
            className="h-full"
            option={participacaoClientesOption}
            isLoading={topClientes.isLoading || overview.isLoading}
            isEmpty={participacaoClientes.length === 0}
            altura="100%"
            onEvents={{
              click: (params) => {
                const name = chartClickName(params);
                setSelectedCliente((current) => current === name ? null : name);
              },
            }}
          />
        </div>
        <div className={`${KPI_CARD_HEIGHT_CLASS} 2xl:col-span-4`}>
          <ChartWrapper
            titulo="Faturamento por Rota"
            chartKey="faturamentoRota"
            actions={(
              <RouteDrillControls
                level={routeDrillLevel}
                metric={routeMetric}
                onChange={(level) => {
                  setSelectedRota(null);
                  setRouteDrillLevel(level);
                }}
                onMetricChange={setRouteMetric}
              />
            )}
            className="h-full"
            option={rotaOption}
            isLoading={graficos.isLoading}
            isEmpty={rotaEntries.length === 0}
            altura="100%"
            onEvents={{
              click: (params) => {
                const name = chartClickName(params);
                setSelectedRota((current) => current === name ? null : name);
              },
            }}
          />
        </div>
      </div>

      <div ref={faturamentoTableRef}>
        <AnalyticalDataTable
          titulo="Faturamento Analítico"
          acoesCabecalho={<ExportButton nomeArquivo="faturamento" onExport={() => exportarFaturamentoCsv(filtro, filtrosTabela.apiFilters)} />}
          dados={tabelaConteudo}
          colunas={colunas}
          chaveLinha="id"
          filtros={filtrosTabela.filters}
          hiddenActiveCount={filtrosTabela.hiddenActiveCount}
          hasAnyFilter={filtrosTabela.hasAnyFilter}
          onTextFilterChange={filtrosTabela.setTextFilter}
          onMultiFilterChange={filtrosTabela.setMultiFilter}
          onColumnFilterChange={filtrosTabela.setColumnFilter}
          onClearFilters={filtrosTabela.clearTableFilters}
          statusOptions={statusTabelaOptions}
          statusOptionsLoading={statusFaturamento.isLoading}
          isLoading={tabela.isLoading}
          error={tabela.error}
          errorFallbackMessage="Erro ao carregar faturamento analítico."
          totalRegistros={tabela.data?.totalElementos}
          paginaAtual={paginacaoTabela.pagina}
          tamanhoPagina={paginacaoTabela.tamanhoPagina}
          onPaginaChange={paginacaoTabela.setPagina}
          onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
        />
      </div>
    </div>
  );
}
