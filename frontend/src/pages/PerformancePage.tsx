import { escapeHtml } from '../utils/escapeHtml';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ArrowLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import PerformanceTabela from '../components/domain/performance/PerformanceTabela';
import AsyncMultiSelect, { type AsyncMultiSelectOpcao } from '../components/shared/AsyncMultiSelect';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import KpiCard from '../components/shared/KpiCard';
import TooltipKpi from '../components/shared/TooltipKpi';
import MensagemErro from '../components/ui/MensagemErro';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { exportarPerformanceCsv } from '../api/endpoints/performanceServico';
import {
  useFiliais,
  usePagadores,
  usePerformanceCidadesDestino,
  usePerformanceRegioesDestino,
  usePerformanceResponsaveis,
} from '../hooks/queries/useDimensoes';
import {
  usePerformanceAging,
  usePerformanceDrilldown,
  usePerformanceHistorico,
  usePerformanceOverview,
  usePerformanceSerieTemporal,
  usePerformanceStatus,
  usePerformanceTabelaPaginada,
} from '../hooks/queries/usePerformance';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { usePerformanceData } from '../hooks/usePerformanceData';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type {
  PerformanceAgingPoint,
  PerformanceDrilldownParams,
  PerformanceDrilldownNivel,
  PerformanceDrilldownPoint,
  PerformanceFiltro,
  PerformanceHistoricoPoint,
  PerformanceSerieTemporalPoint,
  PerformanceStatusDistribuicao,
  PerformanceTempoNivel,
} from '../types/performance';
import type { TableApiFilters } from '../types/tableFilters';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { CORES } from '../utils/chartColors';
import { dataHojeLocal, primeiroDiaMesesAtrasLocal } from '../utils/dateUtils';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarNumero, formatarPorcentagem } from '../utils/formatadores';
import type { GoalTone } from '../utils/indicadoresGestaoVistaUi';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const STATUS_OPTIONS = ['Pendente', 'Em Trânsito', 'Finalizada', 'Cancelada', 'Em Tratativa'];
const PERFORMANCE_EMPTY_MESSAGE = 'Nenhum dado encontrado para o período selecionado.';
const NIVEL_PARAM = 'performanceNivel';
const ANO_PARAM = 'performanceAno';
const MES_PARAM = 'performanceMes';
type HistoricoPeriodoMeses = 3 | 6 | 12;
const NIVEIS_TEMPORAIS: Array<{ valor: PerformanceTempoNivel; label: string }> = [
  { valor: 'ano', label: 'Ano' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'dia', label: 'Dia' },
];
const HISTORICO_PERIODOS: Array<{ valor: HistoricoPeriodoMeses; label: string }> = [
  { valor: 3, label: '3 meses' },
  { valor: 6, label: '6 meses' },
  { valor: 12, label: '1 ano' },
];

function normalizarDrillTexto(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const texto = value.replace(/\s+/g, ' ').trim();
  return texto.length > 0 ? texto : null;
}

function chartClickName(params: unknown, dados?: PerformanceDrilldownPoint[]): string | null {
  const item = params as { name?: unknown; value?: unknown; data?: unknown; dataIndex?: unknown };
  const data = item.data;

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const dataItem = data as { filtro?: unknown; drillName?: unknown; name?: unknown };
    const dataName = normalizarDrillTexto(dataItem.filtro)
      ?? normalizarDrillTexto(dataItem.drillName)
      ?? normalizarDrillTexto(dataItem.name);
    if (dataName) {
      return dataName;
    }
  }

  if (typeof data === 'string') {
    return normalizarDrillTexto(data);
  }

  if (typeof item.dataIndex === 'number') {
    const ponto = dados?.[item.dataIndex];
    return normalizarDrillTexto(ponto?.filtro)
      ?? normalizarDrillTexto(ponto?.nome);
  }

  return normalizarDrillTexto(item.name)
    ?? normalizarDrillTexto(item.value);
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function wrapAxisLabel(value: string, maxLineLength: number, maxLines = 2): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return value;

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLineLength) {
      currentLine = nextLine;
      continue;
    }

    if (currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      lines.push(truncateLabel(word, maxLineLength));
      currentLine = '';
    }

    if (lines.length === maxLines) break;
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const hasHiddenWords = lines.join(' ').length < value.trim().length;
  if (hasHiddenWords && lines.length > 0) {
    lines[lines.length - 1] = truncateLabel(lines[lines.length - 1], maxLineLength);
  }

  return lines.join('\n');
}

function formatMonthLabel(value: string): string {
  const [year, month] = value.split('-');
  if (!year || !month) {
    return value;
  }
  return `${month}/${year}`;
}

function normalizeTemporalNivel(value: string | null): PerformanceTempoNivel {
  return value === 'ano' || value === 'mes' || value === 'dia' ? value : 'dia';
}

function normalizeHistoricoPeriodoMeses(value: string): HistoricoPeriodoMeses {
  if (value === '6') return 6;
  if (value === '12') return 12;
  return 3;
}

function numeroParam(valor: string | null): number | null {
  if (!valor) return null;
  const parsed = Number.parseInt(valor, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatarLabelTemporal(data: string, nivel: PerformanceTempoNivel): string {
  const [ano, mes, dia] = data.split('-');
  if (nivel === 'ano') return ano;
  if (nivel === 'mes') return `${mes}/${ano}`;
  return `${dia}/${mes}`;
}

function monthName(value: string): string {
  const [year, month] = value.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) {
    return formatMonthLabel(value);
  }
  return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(date).replace('.', '');
}

function normalizeDrillNivel(value: string | null): PerformanceDrilldownNivel {
  if (value === 'regiao' || value === 'cidade') {
    return value;
  }
  return 'responsavel';
}

function buildSerieTemporalOption(dados: PerformanceSerieTemporalPoint[], nivel: PerformanceTempoNivel, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return buildBaseLineOption(isDark, {
    legend: { top: 0 },
    grid: { top: 42, left: 18, right: 28, bottom: 18, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dados.map((item) => item.date),
      axisLabel: {
        formatter: (value: string) => formatarLabelTemporal(value, nivel),
      },
    },
    yAxis: { type: 'value', name: 'Qtd' },
    series: [
      {
        name: 'Finalizadas',
        type: 'line',
        stack: 'total',
        areaStyle: {},
        smooth: true,
        data: dados.map((item) => item.finalizadas),
        itemStyle: { color: tokens.palette[2] },
      },
      {
        name: 'Em Trânsito',
        type: 'line',
        stack: 'total',
        areaStyle: {},
        smooth: true,
        data: dados.map((item) => item.emTransito ?? 0),
        itemStyle: { color: tokens.palette[0] },
      },
      {
        name: 'Pendente',
        type: 'line',
        stack: 'total',
        areaStyle: {},
        smooth: true,
        data: dados.map((item) => item.pendentes ?? 0),
        itemStyle: { color: tokens.palette[1] },
      },
      {
        name: 'Canceladas',
        type: 'line',
        stack: 'total',
        areaStyle: {},
        smooth: true,
        data: dados.map((item) => item.canceladas),
        itemStyle: { color: tokens.palette[3] },
      },
      {
        name: 'Em Tratativa',
        type: 'line',
        stack: 'total',
        areaStyle: {},
        smooth: true,
        data: dados.map((item) => item.emTratativa),
        itemStyle: { color: tokens.palette[4] },
      },
    ],
  });
}

function buildStatusOption(dados: PerformanceStatusDistribuicao[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return buildBaseBarOption(isDark, {
    grid: { top: 24, right: 18, bottom: 38, left: 34, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: dados.map((item) => item.status),
      axisLabel: {
        interval: 0,
        formatter: (value: string) => truncateLabel(value, 14),
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: dados.map((item, index) => ({
          name: item.status,
          value: item.total,
          itemStyle: { color: tokens.palette[index % tokens.palette.length] },
        })),
      },
    ],
  });
}

function buildHistoricoOption(dados: PerformanceHistoricoPoint[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const percentuais = dados.flatMap((item) => [item.performancePercentual, item.metaPercentual]);
  const menor = percentuais.length > 0 ? Math.min(...percentuais) : 0;
  const maior = percentuais.length > 0 ? Math.max(...percentuais) : 100;
  const yMin = Math.max(0, Math.floor(menor - 3));
  const yMax = Math.min(100, Math.ceil(maior + 3));

  return buildBaseLineOption(isDark, {
    title: {
      text: 'Histórico da Performance de Entregas',
      left: 8,
      top: 8,
      textStyle: {
        fontSize: 12,
        fontWeight: 500,
      },
    },
    grid: { top: 52, right: '2%', bottom: '10%', left: '2%', containLabel: true },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const entries = params as { marker?: string; seriesName: string; value: number; name: string }[];
        const name = entries[0]?.name ?? '';
        return [
          `<strong>${escapeHtml(name)}</strong>`,
          ...entries.map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName)}: ${formatarPorcentagem(Number(item.value ?? 0), 2)}`),
        ].join('<br/>');
      },
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dados.map((item) => item.date),
      axisLabel: {
        formatter: monthName,
        fontWeight: 600,
        interval: 0,
      },
    },
    yAxis: {
      type: 'value',
      min: yMin,
      max: yMax <= yMin ? yMin + 10 : yMax,
      splitLine: {
        lineStyle: { type: 'dashed' },
      },
      axisLabel: {
        formatter: (value: number) => `${value}%`,
      },
    },
    series: [
      {
        name: 'Performance',
        type: 'line',
        smooth: true,
        data: dados.map((item) => item.performancePercentual),
        symbol: 'circle',
        symbolSize: 6,
        label: {
          show: true,
          position: 'top',
          distance: 10,
          formatter: (params: unknown) => {
            const item = params as { value?: unknown };
            return formatarPorcentagem(Number(item.value ?? 0), 1);
          },
          fontSize: 10,
          fontWeight: 700,
        },
        lineStyle: { width: 3, color: tokens.palette[0] },
        itemStyle: { color: tokens.palette[0] },
      },
      {
        name: 'Meta',
        type: 'line',
        data: dados.map((item) => item.metaPercentual),
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed', color: tokens.mutedTextColor },
        itemStyle: { color: tokens.mutedTextColor },
      },
    ],
  });
}

function buildDrilldownOption(dados: PerformanceDrilldownPoint[], nivel: PerformanceDrilldownNivel, isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const labels = dados.map((item) => item.nome);
  const axisRotate = labels.some((label) => label.length > 14) ? 18 : 0;
  const isDrillable = nivel !== 'cidade';
  const cursor = isDrillable ? 'pointer' : 'default';
  const drillData = (
    metric: keyof Pick<PerformanceDrilldownPoint, 'foraDoPrazo' | 'noPrazo' | 'emAtraso'>,
  ) => dados.map((item) => ({
    name: item.nome,
    filtro: item.filtro ?? item.nome,
    drillName: item.filtro ?? item.nome,
    value: item[metric],
    cursor,
  }));

  return buildBaseBarOption(isDark, {
    legend: { top: 0 },
    grid: { top: 48, right: '3%', bottom: 0, left: '3%', containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      triggerEvent: isDrillable,
      data: labels,
      axisLabel: {
        interval: 0,
        rotate: axisRotate,
        hideOverlap: true,
        margin: 14,
        formatter: (value: string) => wrapAxisLabel(value, 12),
      },
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'FORA DO PRAZO',
        type: 'bar',
        stack: 'performance',
        data: drillData('foraDoPrazo'),
        itemStyle: { color: tokens.palette[3] },
        cursor,
      },
      {
        name: 'NO PRAZO',
        type: 'bar',
        stack: 'performance',
        data: drillData('noPrazo'),
        itemStyle: { color: tokens.palette[2] },
        cursor,
      },
      {
        name: 'EM ATRASO',
        type: 'bar',
        stack: 'performance',
        data: drillData('emAtraso'),
        itemStyle: { color: tokens.palette[1] },
        cursor,
      },
    ],
  });
}

function buildAgingOption(dados: PerformanceAgingPoint[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const ordem = ['0-2 dias', '3-5 dias', '6-10 dias', '11+ dias'];
  const agingColors = [tokens.palette[2], tokens.palette[8], tokens.palette[1], tokens.palette[3]];
  const porBucket = new Map(dados.map((item) => [item.bucket, item.total]));
  return buildBaseBarOption(isDark, {
    grid: { top: 24, right: 18, bottom: 32, left: 34, containLabel: true },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: ordem },
    yAxis: { type: 'value' },
    series: [
      {
        type: 'bar',
        data: ordem.map((bucket, index) => ({
          name: bucket,
          value: porBucket.get(bucket) ?? 0,
          itemStyle: { color: agingColors[index % agingColors.length] },
        })),
      },
    ],
  });
}

function PerformanceKpiSkeleton() {
  return (
    <div
      className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-12"
      aria-hidden="true"
    >
      {Array.from({ length: 9 }).map((_, index) => (
        <div
          key={index}
          className={`${index === 8 ? 'sm:col-span-2 lg:col-span-2' : index >= 6 ? 'lg:col-span-2' : 'lg:col-span-1'} h-[102px] animate-pulse rounded-lg border p-3`}
          style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        >
          <div className="mb-4 h-3 w-2/3 rounded bg-slate-200" />
          <div className="h-8 w-1/2 rounded bg-slate-200" />
          <div className="mt-3 h-2 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}

function kpiGridSpan(label: string): string {
  if (label === 'Valor NF sem Comprovante') {
    return 'sm:col-span-2 lg:col-span-2';
  }

  return label === 'Peso Taxado (t)' || label === 'Comprovante Anexado'
    ? 'lg:col-span-2'
    : 'lg:col-span-1';
}

function kpiValorToneClassName(tone?: GoalTone): string {
  if (tone === 'positive') return 'text-positive';
  if (tone === 'warning') return 'text-warning';
  if (tone === 'negative') return 'text-negative';
  return '';
}

function kpiValorClassName(label: string, tone?: GoalTone): string | undefined {
  const toneClassName = kpiValorToneClassName(tone);
  if (label === 'Valor NF sem Comprovante') {
    return `text-2xl font-bold truncate ${toneClassName}`.trim();
  }
  if (label === 'Comprovante Anexado') {
    return `text-2xl font-bold truncate ${toneClassName}`.trim();
  }
  if (label === 'Performance') {
    return `text-xl font-bold truncate ${toneClassName}`.trim();
  }
  return toneClassName ? `text-2xl font-bold truncate ${toneClassName}` : undefined;
}

function drillUpButtonLabel(nivel: PerformanceDrilldownNivel, regiao: string | null): string | null {
  if (nivel === 'cidade') {
    return `Voltar para Região${regiao ? `: ${regiao}` : ''}`;
  }

  if (nivel === 'regiao') {
    return 'Voltar para Responsáveis';
  }

  return null;
}

function DrillUpButton({
  nivel,
  regiao,
  onBack,
}: {
  nivel: PerformanceDrilldownNivel;
  regiao: string | null;
  onBack: () => void;
}) {
  const label = drillUpButtonLabel(nivel, regiao);

  if (!label) {
    return null;
  }

  return (
    <div className="mb-2 flex min-w-0 justify-start">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-primary)',
        }}
      >
        <ArrowLeft size={14} className="shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

function DrilldownActions({
  nivel,
  responsavel,
  regiao,
  onNivelClick,
}: {
  nivel: PerformanceDrilldownNivel;
  responsavel: string | null;
  regiao: string | null;
  onNivelClick: (nivel: PerformanceDrilldownNivel) => void;
}) {
  const levelButtonClassName = 'max-w-32 truncate rounded px-1.5 py-1 transition hover:bg-[var(--color-primary)]/10 hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';
  const disabledButtonClassName = 'cursor-not-allowed opacity-45 hover:bg-transparent hover:no-underline';
  const drillUpDesabilitado = nivel === 'responsavel';
  const regiaoDesabilitada = !responsavel;
  const cidadeDesabilitada = !responsavel || !regiao;
  const resolveButtonClassName = (disabled: boolean) => `${levelButtonClassName} ${disabled ? disabledButtonClassName : ''}`;
  const resolveButtonColor = (ativo: boolean, disabled = false) => {
    if (disabled) {
      return 'var(--color-text-subtle)';
    }
    return ativo ? CORES.primaria : 'var(--color-text-muted)';
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
            onNivelClick('responsavel');
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
        onClick={() => onNivelClick('responsavel')}
        className={levelButtonClassName}
        style={{ color: nivel === 'responsavel' ? CORES.primaria : 'var(--color-text-muted)' }}
      >
        Responsável
      </button>
      <ChevronRight size={12} style={{ color: 'var(--color-text-subtle)' }} />
      <button
        type="button"
        disabled={regiaoDesabilitada}
        aria-disabled={regiaoDesabilitada}
        onClick={() => {
          if (!regiaoDesabilitada) {
            onNivelClick('regiao');
          }
        }}
        className={resolveButtonClassName(regiaoDesabilitada)}
        title={responsavel ? `Responsável: ${responsavel}` : 'Clique em um responsável no gráfico para habilitar regiões'}
        style={{ color: resolveButtonColor(nivel === 'regiao', regiaoDesabilitada) }}
      >
        Região
      </button>
      <ChevronRight size={12} style={{ color: 'var(--color-text-subtle)' }} />
      <button
        type="button"
        disabled={cidadeDesabilitada}
        aria-disabled={cidadeDesabilitada}
        onClick={() => {
          if (!cidadeDesabilitada) {
            onNivelClick('cidade');
          }
        }}
        className={resolveButtonClassName(cidadeDesabilitada)}
        title={regiao ? `Região: ${regiao}` : 'Clique em uma região no gráfico para habilitar cidades'}
        style={{ color: resolveButtonColor(nivel === 'cidade', cidadeDesabilitada) }}
      >
        Cidade
      </button>
    </div>
  );
}

function aplicarDrillNosFiltrosTabela(
  filtrosTabela: TableApiFilters,
  nivel: PerformanceDrilldownNivel,
  responsavel: string | null,
  regiao: string | null,
): TableApiFilters {
  const tabelaColuna = { ...(filtrosTabela.tabelaColuna ?? {}) };
  const next: TableApiFilters = { ...filtrosTabela };

  if ((nivel === 'regiao' || nivel === 'cidade') && responsavel) {
    next.tabelaRazaoSocial = responsavel;
  }

  if (nivel === 'cidade' && regiao) {
    tabelaColuna.regiaoDestino = regiao;
  }

  if (Object.keys(tabelaColuna).length > 0) {
    next.tabelaColuna = tabelaColuna;
  } else {
    delete next.tabelaColuna;
  }

  return next;
}

function drillTabelaLabel(
  nivel: PerformanceDrilldownNivel,
  responsavel: string | null,
  regiao: string | null,
): string | null {
  const partes: string[] = [];

  if ((nivel === 'regiao' || nivel === 'cidade') && responsavel) {
    partes.push(`Responsável: ${responsavel}`);
  }

  if (nivel === 'cidade' && regiao) {
    partes.push(`Região: ${regiao}`);
  }

  return partes.length > 0 ? `Tabela sincronizada com ${partes.join(' / ')}` : null;
}

function TemporalActions({
  nivel,
  onNivelChange,
}: {
  nivel: PerformanceTempoNivel;
  onNivelChange: (nivel: PerformanceTempoNivel) => void;
}) {
  return (
    <div className="flex rounded-md border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
      {NIVEIS_TEMPORAIS.map((item) => (
        <button
          key={item.valor}
          type="button"
          className="rounded px-2 py-1 text-xs font-semibold transition"
          style={{
            backgroundColor: nivel === item.valor ? 'var(--color-primary)' : 'transparent',
            color: nivel === item.valor ? '#fff' : 'var(--color-text-muted)',
          }}
          onClick={() => onNivelChange(item.valor)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function HistoricoPeriodoActions({
  periodoMeses,
  onPeriodoChange,
}: {
  periodoMeses: HistoricoPeriodoMeses;
  onPeriodoChange: (periodoMeses: HistoricoPeriodoMeses) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">Período do histórico</span>
      <select
        aria-label="Período do histórico"
        value={periodoMeses}
        onChange={(event) => onPeriodoChange(normalizeHistoricoPeriodoMeses(event.target.value))}
        className="h-8 rounded-md border px-2 text-xs font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        {HISTORICO_PERIODOS.map((item) => (
          <option key={item.valor} value={item.valor}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function PerformancePage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [historicoPeriodoMeses, setHistoricoPeriodoMeses] = useState<HistoricoPeriodoMeses>(3);
  const [pagadorBusca, setPagadorBusca] = useState('');
  const pagadorBuscaDiferida = useDeferredValue(pagadorBusca);
  const filiais = useFiliais();
  const pagadores = usePagadores(pagadorBuscaDiferida);

  const drillNivel = normalizeDrillNivel(searchParams.get('drillNivel'));
  const drillResponsavel = normalizarDrillTexto(searchParams.get('drillResponsavel'));
  const drillRegiao = normalizarDrillTexto(searchParams.get('drillRegiao'));
  const nivelTemporal = normalizeTemporalNivel(searchParams.get(NIVEL_PARAM));
  const anoTemporal = numeroParam(searchParams.get(ANO_PARAM));
  const mesTemporal = numeroParam(searchParams.get(MES_PARAM));

  const filtro: PerformanceFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    status: filtros.status,
    pagadores: filtros.pagadores,
    responsaveis: filtros.responsaveis,
    regioesDestino: filtros.regioesDestino,
    cidadesDestino: filtros.cidadesDestino,
  }), [
    dataFim,
    dataInicio,
    filtros.cidadesDestino,
    filtros.filiais,
    filtros.pagadores,
    filtros.parceirosLogisticos,
    filtros.regioesDestino,
    filtros.responsaveis,
    filtros.status,
  ]);

  const filtroSemResponsaveis = useMemo<PerformanceFiltro>(() => ({
    ...filtro,
    responsaveis: undefined,
  }), [filtro]);

  const filtroSemRegioesDestino = useMemo<PerformanceFiltro>(() => ({
    ...filtro,
    regioesDestino: undefined,
  }), [filtro]);

  const filtroSemCidadesDestino = useMemo<PerformanceFiltro>(() => ({
    ...filtro,
    cidadesDestino: undefined,
  }), [filtro]);

  const historicoFiltro: PerformanceFiltro = useMemo(() => ({
    dataInicio: primeiroDiaMesesAtrasLocal(historicoPeriodoMeses - 1),
    dataFim: dataHojeLocal(),
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    status: filtros.status,
    pagadores: filtros.pagadores,
    responsaveis: filtros.responsaveis,
    regioesDestino: filtros.regioesDestino,
    cidadesDestino: filtros.cidadesDestino,
  }), [
    filtros.cidadesDestino,
    filtros.filiais,
    filtros.pagadores,
    filtros.parceirosLogisticos,
    filtros.regioesDestino,
    filtros.responsaveis,
    filtros.status,
    historicoPeriodoMeses,
  ]);

  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Status', count: filtros.status?.length ?? 0, onRemove: () => setFiltro('status', []) },
    { label: 'Pagadores', count: filtros.pagadores?.length ?? 0, onRemove: () => setFiltro('pagadores', []) },
    { label: 'Responsáveis', count: filtros.responsaveis?.length ?? 0, onRemove: () => setFiltro('responsaveis', []) },
    { label: 'Regiões', count: filtros.regioesDestino?.length ?? 0, onRemove: () => setFiltro('regioesDestino', []) },
    { label: 'Cidades', count: filtros.cidadesDestino?.length ?? 0, onRemove: () => setFiltro('cidadesDestino', []) },
  ];

  const overview = usePerformanceOverview(filtro);
  const responsaveis = usePerformanceResponsaveis(filtroSemResponsaveis);
  const regioesDestino = usePerformanceRegioesDestino(filtroSemRegioesDestino);
  const cidadesDestino = usePerformanceCidadesDestino(filtroSemCidadesDestino);
  const serieTemporal = usePerformanceSerieTemporal(filtro, nivelTemporal, anoTemporal, mesTemporal);
  const status = usePerformanceStatus(filtro);
  const historico = usePerformanceHistorico(historicoFiltro, historicoPeriodoMeses);
  const filtrosTabela = useAnalyticalTableFilters();
  const filtrosTabelaComDrill = useMemo(
    () => aplicarDrillNosFiltrosTabela(
      filtrosTabela.apiFilters,
      drillNivel,
      drillResponsavel,
      drillRegiao,
    ),
    [drillNivel, drillRegiao, drillResponsavel, filtrosTabela.apiFilters],
  );
  const drillTabelaResumo = useMemo(
    () => drillTabelaLabel(drillNivel, drillResponsavel, drillRegiao),
    [drillNivel, drillRegiao, drillResponsavel],
  );
  const drilldownParams = useMemo<PerformanceDrilldownParams>(() => ({
    nivel: drillNivel,
    responsavel: drillResponsavel,
    regiaoDestino: drillRegiao,
  }), [drillNivel, drillRegiao, drillResponsavel]);
  const drillStateKey = useMemo(
    () => [drilldownParams.nivel, drilldownParams.responsavel ?? '', drilldownParams.regiaoDestino ?? ''].join('|'),
    [drilldownParams],
  );
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabelaComDrill }));
  const tabela = usePerformanceTabelaPaginada(
    filtro,
    paginacaoTabela.pagina,
    paginacaoTabela.tamanhoPagina,
    filtrosTabelaComDrill,
  );
  const drilldown = usePerformanceDrilldown(filtro, drilldownParams);
  const aging = usePerformanceAging(filtro);

  usePageHeader({
    title: 'Performance',
    description: 'Entregas por previsão, prazo, comprovantes e aging operacional.',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const {
    kpis,
    serieTemporalData,
    statusData,
    historicoData,
    drilldownData,
    agingData,
  } = usePerformanceData({
    overview: overview.data,
    serieTemporal: serieTemporal.data,
    status: status.data,
    historico: historico.data,
    drilldown: drilldown.data,
    aging: aging.data,
  });

  const serieTemporalOption = useMemo(() => buildSerieTemporalOption(serieTemporalData, nivelTemporal, isDark), [isDark, nivelTemporal, serieTemporalData]);
  const statusOption = useMemo(() => buildStatusOption(statusData, isDark), [isDark, statusData]);
  const historicoOption = useMemo(() => buildHistoricoOption(historicoData, isDark), [historicoData, isDark]);
  const drilldownOption = useMemo(() => buildDrilldownOption(drilldownData, drillNivel, isDark), [drillNivel, drilldownData, isDark]);
  const agingOption = useMemo(() => buildAgingOption(agingData, isDark), [agingData, isDark]);
  const statusTabelaOptions = combinarStatusOptions(
    status.data?.map((item) => item.status),
    tabela.data?.conteudo.map((item) => item.status),
    filtros.status,
  );
  const pagadorOptions = useMemo<AsyncMultiSelectOpcao[]>(() => {
    const opcoes = new Map<string, AsyncMultiSelectOpcao>();

    (filtros.pagadores ?? []).forEach((nome) => {
      opcoes.set(nome, { value: nome, label: nome });
    });

    (pagadores.data ?? []).forEach((pagador) => {
      opcoes.set(pagador.nome, {
        value: pagador.nome,
        label: pagador.nome,
        description: pagador.documento,
      });
    });

    return Array.from(opcoes.values()).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [filtros.pagadores, pagadores.data]);

  const alterarNivelTemporal = useCallback((nivel: PerformanceTempoNivel) => {
    const next = new URLSearchParams(searchParams);
    next.set(NIVEL_PARAM, nivel);
    next.delete(ANO_PARAM);
    next.delete(MES_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const drillTemporal = useCallback((data: string) => {
    const [ano, mes] = data.split('-');
    const next = new URLSearchParams(searchParams);
    if (nivelTemporal === 'ano') {
      next.set(NIVEL_PARAM, 'mes');
      next.set(ANO_PARAM, ano);
      next.delete(MES_PARAM);
    } else if (nivelTemporal === 'mes') {
      next.set(NIVEL_PARAM, 'dia');
      next.set(ANO_PARAM, ano);
      next.set(MES_PARAM, mes);
    }
    setSearchParams(next, { replace: true });
  }, [nivelTemporal, searchParams, setSearchParams]);

  function drillUp() {
    const next = new URLSearchParams(searchParams);
    if (drillNivel === 'cidade') {
      next.set('drillNivel', 'regiao');
      next.delete('drillRegiao');
    } else {
      next.delete('drillNivel');
      next.delete('drillResponsavel');
      next.delete('drillRegiao');
    }
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function drillToNivel(nivelAlvo: PerformanceDrilldownNivel) {
    const next = new URLSearchParams(searchParams);

    if (nivelAlvo === 'responsavel') {
      next.delete('drillNivel');
      next.delete('drillResponsavel');
      next.delete('drillRegiao');
    } else if (nivelAlvo === 'regiao' && drillResponsavel) {
      next.set('drillNivel', 'regiao');
      next.set('drillResponsavel', drillResponsavel);
      next.delete('drillRegiao');
    } else if (nivelAlvo === 'cidade' && drillResponsavel && drillRegiao) {
      next.set('drillNivel', 'cidade');
      next.set('drillResponsavel', drillResponsavel);
      next.set('drillRegiao', drillRegiao);
    }

    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  function drillDown(nome: string | null) {
    const nomeDrill = normalizarDrillTexto(nome);

    if (!nomeDrill || drillNivel === 'cidade') {
      return;
    }

    const next = new URLSearchParams(searchParams);
    if (drillNivel === 'responsavel') {
      next.set('drillNivel', 'regiao');
      next.set('drillResponsavel', nomeDrill);
      next.delete('drillRegiao');
    } else {
      next.set('drillNivel', 'cidade');
      next.set('drillRegiao', nomeDrill);
    }
    setSearchParams(next, { replace: true, preventScrollReset: true });
  }

  return (
    <div className="w-full">
      <FilterBar onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
        <DateRangePicker
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicioChange={setDataInicio}
          onDataFimChange={setDataFim}
          onRangeChange={setDataRange}
        />
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? []}
          filiaisSelecionadas={filtros.filiais ?? []}
          parceirosSelecionados={filtros.parceirosLogisticos ?? []}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
        <AsyncMultiSelect
          label="Status"
          opcoes={STATUS_OPTIONS}
          selecionados={filtros.status ?? []}
          onChange={(valores) => setFiltro('status', valores)}
        />
        <AsyncMultiSelect
          label="Pagador"
          opcoes={pagadorOptions}
          selecionados={filtros.pagadores ?? []}
          onChange={(valores) => setFiltro('pagadores', valores)}
          onSearchChange={setPagadorBusca}
          isLoading={pagadores.isFetching}
        />
        <AsyncMultiSelect
          label="Responsáveis"
          opcoes={responsaveis.data ?? []}
          selecionados={filtros.responsaveis ?? []}
          onChange={(valores) => setFiltro('responsaveis', valores)}
          isLoading={responsaveis.isLoading}
        />
        <AsyncMultiSelect
          label="Regiões"
          opcoes={regioesDestino.data ?? []}
          selecionados={filtros.regioesDestino ?? []}
          onChange={(valores) => setFiltro('regioesDestino', valores)}
          isLoading={regioesDestino.isLoading}
        />
        <AsyncMultiSelect
          label="Cidades"
          opcoes={cidadesDestino.data ?? []}
          selecionados={filtros.cidadesDestino ?? []}
          onChange={(valores) => setFiltro('cidadesDestino', valores)}
          isLoading={cidadesDestino.isLoading}
        />
      </FilterBar>

      {overview.isError && (
        <MensagemErro
          mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de performance.')}
          tipo={getTipoErro(overview.error)}
        />
      )}

      {overview.isLoading ? (
        <PerformanceKpiSkeleton />
      ) : (
        <div
          className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 2xl:grid-cols-12"
        >
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`min-w-0 ${kpiGridSpan(kpi.label)}`}>
              <TooltipKpi definition={kpi.definition} className="h-full">
                <KpiCard
                  label={kpi.label}
                  valor={kpi.valor}
                  valorClassName={kpiValorClassName(kpi.label, kpi.tone)}
                  helperText={kpi.helperText}
                />
              </TooltipKpi>
            </div>
          ))}
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-6">
        <div className="col-span-full h-[28rem] min-h-0 2xl:col-span-2">
          <ChartWrapper
            titulo="Entregas por dia, mês e ano"
            chartKey="performanceSerieTemporal"
            option={serieTemporalOption}
            actions={<TemporalActions nivel={nivelTemporal} onNivelChange={alterarNivelTemporal} />}
            onEvents={{
              click: (params: unknown) => {
                const item = params as { name?: string };
                if (item.name) drillTemporal(item.name);
              },
            }}
            isLoading={serieTemporal.isLoading}
            isEmpty={serieTemporalData.length === 0}
            emptyMessage={PERFORMANCE_EMPTY_MESSAGE}
            erro={serieTemporal.isError ? getApiErrorMessage(serieTemporal.error, 'Erro ao carregar série temporal.') : null}
            altura="100%"
            className="h-full"
          />
        </div>
        <div className="h-[28rem] min-h-0 2xl:col-span-2">
          <ChartWrapper
            titulo="Distribuição por Status"
            chartKey="performanceStatus"
            option={statusOption}
            isLoading={status.isLoading}
            isEmpty={statusData.length === 0}
            emptyMessage={PERFORMANCE_EMPTY_MESSAGE}
            erro={status.isError ? getApiErrorMessage(status.error, 'Erro ao carregar status.') : null}
            altura="100%"
            className="h-full"
          />
        </div>
        <div className="h-[28rem] min-h-0 2xl:col-span-2">
          <ChartWrapper
            titulo="Histórico de Performance"
            chartKey="performanceHistorico"
            option={historicoOption}
            actions={(
              <HistoricoPeriodoActions
                periodoMeses={historicoPeriodoMeses}
                onPeriodoChange={setHistoricoPeriodoMeses}
              />
            )}
            isLoading={historico.isLoading}
            isEmpty={historicoData.length === 0}
            emptyMessage={PERFORMANCE_EMPTY_MESSAGE}
            erro={historico.isError ? getApiErrorMessage(historico.error, 'Erro ao carregar histórico.') : null}
            altura="100%"
            className="h-full"
          />
        </div>
        <div className="flex h-[30rem] min-h-0 flex-col 2xl:col-span-3">
          <DrillUpButton nivel={drillNivel} regiao={drillRegiao} onBack={drillUp} />
          <div className="min-h-0 flex-1">
            <ChartWrapper
              key={drillStateKey}
              titulo="Performance por responsável, região e cidade"
              chartKey="performanceDrilldown"
              actions={(
                <DrilldownActions
                  nivel={drillNivel}
                  responsavel={drillResponsavel}
                  regiao={drillRegiao}
                  onNivelClick={drillToNivel}
                />
              )}
              option={drilldownOption}
              isLoading={drilldown.isLoading}
              isEmpty={drilldownData.length === 0}
              emptyMessage={PERFORMANCE_EMPTY_MESSAGE}
              erro={drilldown.isError ? getApiErrorMessage(drilldown.error, 'Erro ao carregar drill-down.') : null}
              altura="100%"
              className="h-full"
              onEvents={{
                click: (params: unknown) => {
                  const nome = chartClickName(params, drilldownData);
                  if (nome) {
                    drillDown(nome);
                  }
                },
              }}
            />
          </div>
        </div>
        <div className="h-[30rem] min-h-0 2xl:col-span-3">
          <ChartWrapper
            titulo="Entregas em aberto"
            chartKey="performanceAging"
            option={agingOption}
            isLoading={aging.isLoading}
            isEmpty={agingData.length === 0}
            emptyMessage={PERFORMANCE_EMPTY_MESSAGE}
            erro={aging.isError ? getApiErrorMessage(aging.error, 'Erro ao carregar aging.') : null}
            altura="100%"
            className="h-full"
          />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-end gap-3">
        {drillTabelaResumo ? (
          <span
            className="mr-auto inline-flex min-w-0 max-w-full items-center rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-muted)',
            }}
          >
            <span className="truncate">{drillTabelaResumo}</span>
          </span>
        ) : null}
        <ExportButton nomeArquivo="performance" onExport={() => exportarPerformanceCsv(filtro, filtrosTabelaComDrill)} />
      </div>
      <PerformanceTabela
        pagina={tabela.data}
        filtros={filtrosTabela.filters}
        hiddenActiveCount={filtrosTabela.hiddenActiveCount}
        hasAnyFilter={filtrosTabela.hasAnyFilter}
        statusOptions={statusTabelaOptions}
        statusOptionsLoading={status.isLoading}
        isLoading={tabela.isLoading}
        error={tabela.error}
        paginaAtual={paginacaoTabela.pagina}
        tamanhoPagina={paginacaoTabela.tamanhoPagina}
        onTextFilterChange={filtrosTabela.setTextFilter}
        onMultiFilterChange={filtrosTabela.setMultiFilter}
        onColumnFilterChange={filtrosTabela.setColumnFilter}
        onClearFilters={filtrosTabela.clearTableFilters}
        onPaginaChange={paginacaoTabela.setPagina}
        onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
      />

      <span className="sr-only">
        Total de entregas carregadas: {formatarNumero(overview.data?.totalEntregas ?? 0)}
      </span>
    </div>
  );
}
