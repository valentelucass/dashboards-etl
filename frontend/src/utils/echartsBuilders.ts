import type { EChartsOption } from 'echarts';
import { PALETA_SERIES } from './chartColors';

type PlainObject = Record<string, unknown>;

const DARK_PALETTE = ['#60a5fa', '#f97316', '#34d399', '#f87171', '#a78bfa', '#22d3ee', '#f472b6', '#a3e635', '#facc15', '#c4b5fd'];
const BAR_RADIUS = [4, 4, 0, 0] as const;

export function getEchartsThemeTokens(isDark: boolean) {
  return {
    textColor: isDark ? '#e5e7eb' : '#1e293b',
    mutedTextColor: isDark ? '#cbd5e1' : '#64748b',
    axisColor: isDark ? '#a7a7ae' : '#53565d',
    axisLineColor: isDark ? '#424247' : '#e2e2e5',
    splitLineColor: isDark ? '#343438' : '#e9e9ec',
    tooltipBg: isDark ? '#262626' : '#ffffff',
    tooltipBorder: isDark ? '#444449' : '#dedee2',
    tooltipText: isDark ? '#f8fafc' : '#374151',
    axisPointerBg: isDark ? '#1e293b' : '#536298',
    palette: isDark ? DARK_PALETTE : [...PALETA_SERIES],
    softTrack: isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(148, 163, 184, 0.24)',
  };
}

export function resolveEchartsColor(color: unknown): string | undefined {
  if (typeof color !== 'string') return undefined;

  const match = /^var\((--[\w-]+)\)$/.exec(color.trim());
  if (!match || typeof document === 'undefined') return color;

  return getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim() || color;
}

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeObject(base: unknown, override: unknown): PlainObject {
  return {
    ...(isPlainObject(base) ? base : {}),
    ...(isPlainObject(override) ? override : {}),
  };
}

function withAlpha(color: string | undefined, alpha: number) {
  if (!color) return `rgba(96, 165, 250, ${alpha})`;

  const resolved = resolveEchartsColor(color) ?? color;
  const hex = resolved.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const normalized = hex.length === 3
      ? hex.split('').map((char) => `${char}${char}`).join('')
      : hex;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  const rgb = resolved.match(/^rgba?\(([^)]+)\)$/i)?.[1]?.split(',').map((part) => part.trim());
  if (rgb && rgb.length >= 3) {
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
  }

  return resolved;
}

function areaGradient(color: string | undefined) {
  return {
    type: 'linear' as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: withAlpha(color, 0.28) },
      { offset: 1, color: withAlpha(color, 0.03) },
    ],
  };
}

function sanitizeLabel(label: unknown, color: string, defaults: PlainObject = {}) {
  return {
    ...defaults,
    ...mergeObject(undefined, label),
    color,
    textBorderWidth: 0,
    textShadowBlur: 0,
  };
}

function sanitizeAxis(axis: unknown, isDark: boolean, kind: 'bar' | 'line') {
  const tokens = getEchartsThemeTokens(isDark);
  const current = mergeObject(undefined, axis);
  const axisLine = mergeObject(current.axisLine, {
    lineStyle: {
      ...mergeObject((current.axisLine as PlainObject | undefined)?.lineStyle, undefined),
      color: tokens.axisLineColor,
    },
  });
  const splitLine = mergeObject(current.splitLine, {
    lineStyle: {
      ...mergeObject((current.splitLine as PlainObject | undefined)?.lineStyle, undefined),
      color: tokens.splitLineColor,
    },
  });
  const next: PlainObject = {
    ...current,
    axisLine,
    axisTick: { show: false, ...mergeObject(current.axisTick, undefined) },
    axisLabel: sanitizeLabel(current.axisLabel, tokens.axisColor, { fontSize: 11 }),
    splitLine,
    nameTextStyle: sanitizeLabel(current.nameTextStyle, tokens.axisColor, { fontSize: 11 }),
  };

  if (kind === 'line' && (next.type === 'category' || next.type === undefined)) {
    next.boundaryGap = true;
  }

  return next;
}

function mapAxis(axis: unknown, isDark: boolean, kind: 'bar' | 'line') {
  if (Array.isArray(axis)) {
    return axis.map((item) => sanitizeAxis(item, isDark, kind));
  }
  return sanitizeAxis(axis, isDark, kind);
}

function seriesArray(option: EChartsOption): PlainObject[] {
  if (!option.series) return [];
  return Array.isArray(option.series)
    ? option.series as PlainObject[]
    : [option.series as PlainObject];
}

function getSeriesColor(series: PlainObject, index: number, isDark: boolean) {
  const tokens = getEchartsThemeTokens(isDark);
  const itemStyle = series.itemStyle as PlainObject | undefined;
  const lineStyle = series.lineStyle as PlainObject | undefined;
  return resolveEchartsColor(lineStyle?.color)
    ?? resolveEchartsColor(itemStyle?.color)
    ?? tokens.palette[index % tokens.palette.length];
}

function tooltipBase(isDark: boolean, trigger: 'axis' | 'item') {
  const tokens = getEchartsThemeTokens(isDark);
  return {
    trigger,
    backgroundColor: tokens.tooltipBg,
    borderColor: tokens.tooltipBorder,
    borderWidth: 1,
    textStyle: {
      color: tokens.tooltipText,
      fontSize: 12,
      textBorderWidth: 0,
      textShadowBlur: 0,
    },
  };
}

function sanitizeTooltip(
  isDark: boolean,
  trigger: 'axis' | 'item',
  tooltip: unknown,
  axisPointerDefaults?: PlainObject,
) {
  const tokens = getEchartsThemeTokens(isDark);
  const current = mergeObject(undefined, tooltip);
  const currentAxisPointer = mergeObject(current.axisPointer, undefined);
  const defaultCrossStyle = mergeObject(axisPointerDefaults?.crossStyle, undefined);
  const currentCrossStyle = mergeObject(currentAxisPointer.crossStyle, undefined);
  const defaultLabel = mergeObject(axisPointerDefaults?.label, undefined);
  const currentLabel = mergeObject(currentAxisPointer.label, undefined);

  return {
    ...tooltipBase(isDark, trigger),
    ...current,
    textStyle: sanitizeLabel(current.textStyle, tokens.tooltipText, { fontSize: 12 }),
    ...(axisPointerDefaults ? {
      axisPointer: {
        ...currentAxisPointer,
        ...axisPointerDefaults,
        ...(axisPointerDefaults.crossStyle || currentAxisPointer.crossStyle ? {
          crossStyle: {
            ...currentCrossStyle,
            ...defaultCrossStyle,
            color: tokens.axisColor,
          },
        } : {}),
        ...(axisPointerDefaults.label || currentAxisPointer.label ? {
          label: {
            ...currentLabel,
            ...defaultLabel,
            show: true,
            backgroundColor: tokens.axisPointerBg,
            color: '#f8fafc',
            textBorderWidth: 0,
            textShadowBlur: 0,
          },
        } : {}),
      },
    } : {}),
  };
}

function sanitizeSingleTitle(title: PlainObject, tokens: ReturnType<typeof getEchartsThemeTokens>) {
  return {
    ...title,
    textStyle: sanitizeLabel(title.textStyle, tokens.textColor),
    subtextStyle: sanitizeLabel(title.subtextStyle, tokens.mutedTextColor),
  };
}

function sanitizeTitle(title: unknown, tokens: ReturnType<typeof getEchartsThemeTokens>): EChartsOption['title'] {
  if (Array.isArray(title)) {
    return title.map((item) => isPlainObject(item) ? sanitizeSingleTitle(item, tokens) : item) as EChartsOption['title'];
  }
  if (!isPlainObject(title)) return title as EChartsOption['title'];

  return sanitizeSingleTitle(title, tokens) as EChartsOption['title'];
}

export function buildBaseBarOption(isDark: boolean, options: EChartsOption): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return {
    ...options,
    color: options.color ?? tokens.palette,
    textStyle: sanitizeLabel(options.textStyle, tokens.textColor, { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }),
    title: sanitizeTitle(options.title, tokens),
    grid: {
      top: 42,
      right: 24,
      bottom: 36,
      left: 56,
      containLabel: true,
      ...mergeObject(options.grid, undefined),
    },
    tooltip: sanitizeTooltip(isDark, 'axis', options.tooltip, { type: 'shadow' }),
    legend: {
      ...mergeObject(options.legend, undefined),
      textStyle: sanitizeLabel((options.legend as PlainObject | undefined)?.textStyle, tokens.axisColor, { fontSize: 11 }),
    },
    xAxis: mapAxis(options.xAxis, isDark, 'bar'),
    yAxis: mapAxis(options.yAxis, isDark, 'bar'),
    series: seriesArray(options).map((series, index) => {
      if (series.type !== 'bar') return series;
      const color = getSeriesColor(series, index, isDark);

      return {
        ...series,
        barMaxWidth: 30,
        itemStyle: {
          ...mergeObject(series.itemStyle, undefined),
          color,
          borderRadius: BAR_RADIUS,
        },
        label: sanitizeLabel(series.label, tokens.textColor),
        emphasis: {
          ...mergeObject(series.emphasis, undefined),
          label: sanitizeLabel((series.emphasis as PlainObject | undefined)?.label, tokens.textColor),
        },
      };
    }),
  };
}

export function buildBaseLineOption(isDark: boolean, options: EChartsOption): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return {
    ...options,
    color: options.color ?? tokens.palette,
    textStyle: sanitizeLabel(options.textStyle, tokens.textColor, { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }),
    title: sanitizeTitle(options.title, tokens),
    grid: {
      top: 44,
      right: 36,
      bottom: 38,
      left: 52,
      containLabel: true,
      ...mergeObject(options.grid, undefined),
    },
    tooltip: sanitizeTooltip(isDark, 'axis', options.tooltip, {
      type: 'cross',
      crossStyle: { color: tokens.axisColor, type: 'dashed' },
      label: { show: true, backgroundColor: tokens.axisPointerBg, color: '#f8fafc', textBorderWidth: 0, textShadowBlur: 0 },
    }),
    legend: {
      ...mergeObject(options.legend, undefined),
      textStyle: sanitizeLabel((options.legend as PlainObject | undefined)?.textStyle, tokens.axisColor, { fontSize: 11 }),
    },
    xAxis: mapAxis(options.xAxis, isDark, 'line'),
    yAxis: mapAxis(options.yAxis, isDark, 'line'),
    series: seriesArray(options).map((series, index) => {
      if (series.type !== 'line') return series;
      const color = getSeriesColor(series, index, isDark);
      const areaStyle = mergeObject(series.areaStyle, undefined);
      const currentLineStyle = mergeObject(series.lineStyle, undefined);
      const shouldUseArea = Object.prototype.hasOwnProperty.call(series, 'areaStyle') || currentLineStyle.type !== 'dashed';

      return {
        ...series,
        smooth: series.smooth ?? true,
        showSymbol: series.symbol === 'none' ? false : true,
        symbol: series.symbol ?? 'circle',
        symbolSize: series.symbolSize ?? 6,
        itemStyle: {
          ...mergeObject(series.itemStyle, undefined),
          color,
        },
        lineStyle: {
          width: 2.5,
          ...currentLineStyle,
          color,
        },
        ...(shouldUseArea ? {
          areaStyle: {
            ...areaStyle,
            color: areaStyle.color ?? areaGradient(color),
          },
        } : {}),
        label: sanitizeLabel(series.label, tokens.textColor),
        emphasis: {
          focus: 'series',
          ...mergeObject(series.emphasis, undefined),
          label: sanitizeLabel((series.emphasis as PlainObject | undefined)?.label, tokens.textColor),
        },
      };
    }),
  };
}

export function buildBaseDonutOption(isDark: boolean, options: EChartsOption): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);

  return {
    ...options,
    color: options.color ?? tokens.palette,
    textStyle: sanitizeLabel(options.textStyle, tokens.textColor, { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12 }),
    grid: { top: 0, right: 0, bottom: 0, left: 0, ...mergeObject(options.grid, undefined) },
    xAxis: { show: false },
    yAxis: { show: false },
    tooltip: sanitizeTooltip(isDark, 'item', options.tooltip),
    legend: {
      type: 'scroll',
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      ...mergeObject(options.legend, undefined),
      textStyle: sanitizeLabel((options.legend as PlainObject | undefined)?.textStyle, tokens.axisColor, { fontSize: 11 }),
    },
    title: sanitizeTitle(options.title, tokens),
    series: seriesArray(options).map((series) => {
      if (series.type !== 'pie') return series;

      return {
        ...series,
        radius: series.radius ?? ['46%', '72%'],
        center: series.center ?? ['50%', '44%'],
        minAngle: series.minAngle ?? 4,
        avoidLabelOverlap: true,
        label: sanitizeLabel(series.label, tokens.textColor, {
          show: true,
          position: 'outside',
          formatter: '{b}\n{c} ({d}%)',
          fontSize: 11,
          fontWeight: 600,
        }),
        labelLine: {
          show: true,
          length: 10,
          length2: 8,
          lineStyle: { color: tokens.axisColor },
          ...mergeObject(series.labelLine, undefined),
        },
        emphasis: {
          ...mergeObject(series.emphasis, undefined),
          label: sanitizeLabel((series.emphasis as PlainObject | undefined)?.label, tokens.textColor, {
            show: true,
            formatter: '{b}\n{c}\n{d}%',
            fontSize: 12,
            fontWeight: 700,
          }),
        },
      };
    }),
  };
}
