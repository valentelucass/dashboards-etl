import { escapeHtml } from './escapeHtml';
import type { EChartsOption } from 'echarts';
import { buildBaseBarOption, getEchartsThemeTokens } from './echartsBuilders';
import { getGoalToneStyle, resolverTomMetaPorValor, type GoalMode } from './indicadoresGestaoVistaUi';

interface RankingOptionArgs<T> {
  items: T[];
  getLabel: (item: T) => string;
  getValue: (item: T) => number;
  threshold: number;
  getThreshold?: (item: T) => number;
  mode: GoalMode;
  thresholdLabel: string;
  tooltipLines?: (item: T) => string[];
  valueFormatter?: (value: number) => string;
  axisFormatter?: (value: number) => string;
  max?: number;
  isDark?: boolean;
}

interface MetaComparisonOptionArgs {
  label: string;
  value: number;
  threshold: number;
  mode: GoalMode;
  thresholdLabel: string;
  valueFormatter?: (value: number) => string;
  axisFormatter?: (value: number) => string;
  max?: number;
  isDark?: boolean;
}

function truncarRotulo(label: string, limite = 26): string {
  if (label.length <= limite) {
    return label;
  }
  return `${label.slice(0, limite - 1)}…`;
}

function resolveCssColor(colorStr: string): string {
  if (typeof window === 'undefined' || !colorStr.startsWith('var(')) {
    return colorStr;
  }
  const match = colorStr.match(/var\(([^,\s)]+)(?:,\s*([^)]+))?\)/);
  if (!match) {
    return colorStr;
  }
  const varName = match[1].trim();
  const fallback = (match[2] || '').trim();
  try {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(varName);
    return value.trim() || fallback || '#64748b';
  } catch {
    return fallback || '#64748b';
  }
}

function resolveColor(value: number, threshold: number, mode: GoalMode): string {
  const tone = resolverTomMetaPorValor(value, threshold, mode);
  return resolveCssColor(getGoalToneStyle(tone).fill);
}

function defaultAxisFormatter(value: number): string {
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function defaultValueFormatter(value: number): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function resolveMax(values: number[], threshold: number, max?: number): number {
  if (typeof max === 'number') {
    return max;
  }
  const base = Math.max(threshold, ...values, 0);
  if (base <= 1) {
    return 1;
  }
  return Math.min(Math.ceil(base * 1.2), 200);
}

function resolveChartValue(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'number') {
    return value[0];
  }
  return Number(value ?? 0);
}

export function buildRankingOption<T>({
  items,
  getLabel,
  getValue,
  threshold,
  getThreshold,
  mode,
  thresholdLabel,
  tooltipLines,
  valueFormatter = defaultValueFormatter,
  axisFormatter = defaultAxisFormatter,
  max,
  isDark = false,
}: RankingOptionArgs<T>): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const topItems = items.slice(0, 8);
  const ordered = [...topItems].reverse();
  const labels = ordered.map((item) => truncarRotulo(getLabel(item)));
  const values = ordered.map((item) => getValue(item));
  const itemThresholds = getThreshold ? ordered.map((item) => getThreshold(item)) : [threshold];
  const resolvedMax = resolveMax([...values, ...itemThresholds], threshold, max);

  return buildBaseBarOption(isDark, {
    grid: { left: 110, right: 32, top: 20, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const [first] = Array.isArray(params) ? params : [];
        const index = typeof first === 'object' && first !== null && 'dataIndex' in first
          ? Number((first as { dataIndex: number }).dataIndex)
          : -1;
        const item = ordered[index];
        if (!item) {
          return '';
        }
        const lines = [`<strong>${getLabel(item)}</strong>`, valueFormatter(getValue(item))];
        if (tooltipLines) {
          lines.push(...tooltipLines(item));
        }
        return lines.join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: resolvedMax,
      axisLabel: { formatter: (value: number) => axisFormatter(Number(value)) },
      splitLine: { lineStyle: { color: tokens.splitLineColor } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: ordered.map((item) => ({
          value: getValue(item),
          itemStyle: { color: resolveColor(getValue(item), getThreshold ? getThreshold(item) : threshold, mode) },
        })),
        barMaxWidth: 24,
        label: {
          show: true,
          position: 'right',
          color: tokens.textColor,
          formatter: (params: { value?: unknown }) => valueFormatter(resolveChartValue(params.value)),
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: tokens.mutedTextColor, type: 'dashed', width: 2 },
          label: {
            formatter: thresholdLabel,
            color: tokens.tooltipText,
            backgroundColor: tokens.tooltipBg,
            padding: [2, 6],
            borderRadius: 999,
            textBorderWidth: 0,
            textShadowBlur: 0,
          },
          data: [{ xAxis: threshold }],
        },
      },
    ],
  });
}

export function buildMetaComparisonOption({
  label,
  value,
  threshold,
  mode,
  thresholdLabel,
  valueFormatter = defaultValueFormatter,
  axisFormatter = defaultAxisFormatter,
  max,
  isDark = false,
}: MetaComparisonOptionArgs): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const resolvedMax = resolveMax([value], threshold, max);

  return buildBaseBarOption(isDark, {
    grid: { left: 110, right: 32, top: 20, bottom: 20 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const items = Array.isArray(params) ? params : [];
        return items
          .map((item) => {
            const point = item as { name: string; value: number };
            return `<strong>${escapeHtml(point.name)}</strong><br/>${valueFormatter(Number(point.value))}`;
          })
          .join('<br/><br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 0,
      max: resolvedMax,
      axisLabel: { formatter: (axisValue: number) => axisFormatter(Number(axisValue)) },
      splitLine: { lineStyle: { color: tokens.splitLineColor } },
    },
    yAxis: {
      type: 'category',
      data: [thresholdLabel, label],
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: [
          {
            value: threshold,
            itemStyle: { color: tokens.mutedTextColor },
          },
          {
            value,
            itemStyle: { color: resolveColor(value, threshold, mode) },
          },
        ],
        barMaxWidth: 28,
        label: {
          show: true,
          position: 'right',
          color: tokens.textColor,
          formatter: (params: { value?: unknown }) => valueFormatter(resolveChartValue(params.value)),
        },
      },
    ],
  });
}
