import type { EChartsOption } from 'echarts';

type AxisFormatter = string | ((value: never) => string);

export interface DashboardAxis {
  type?: string;
  data?: (string | number | { value: string | number })[];
  name?: string;
  min?: number | 'dataMin';
  max?: number | 'dataMax';
  inverse?: boolean;
  show?: boolean;
  axisLabel?: { formatter?: AxisFormatter; width?: number };
}

interface Datum {
  name?: string;
  value?: number | null;
  itemStyle?: { color?: string; opacity?: number };
}

export interface DashboardSeries {
  name?: string;
  type?: string;
  data?: (number | null | Datum)[];
  yAxisIndex?: number;
  stack?: string;
  smooth?: boolean;
  symbol?: string;
  showSymbol?: boolean;
  radius?: string | number | (string | number)[];
  label?: { show?: boolean; formatter?: string | ((params: never) => string); position?: string };
  lineStyle?: { color?: string; width?: number; type?: string };
  itemStyle?: { color?: string | ((params: never) => string); opacity?: number };
  areaStyle?: { opacity?: number };
  markLine?: { data?: { xAxis?: number; yAxis?: number }[]; label?: { formatter?: string } };
}

type MaybeArray<T> = T | T[] | undefined;

interface DashboardOptions {
  xAxis?: MaybeArray<DashboardAxis>;
  yAxis?: MaybeArray<DashboardAxis>;
  series?: MaybeArray<DashboardSeries>;
  tooltip?: { show?: boolean; trigger?: string; formatter?: string | ((params: unknown) => unknown); valueFormatter?: (value: number) => string };
  legend?: {
    data?: (string | { name: string })[];
    show?: boolean;
    top?: string | number;
    orient?: string;
    selected?: Record<string, boolean>;
    selectedMode?: boolean;
    formatter?: (name: string) => string;
  };
  dataZoom?: { type?: string; end?: number }[];
  grid?: { containLabel?: boolean; left?: number; right?: number; top?: number; bottom?: number };
}

export function asList<T>(items: MaybeArray<T>): T[] {
  return items == null ? [] : Array.isArray(items) ? items : [items];
}

// Keep existing data builders and formatter contracts while Astryx draws the chart.
export function readDashboardChart(option: EChartsOption) {
  const config = option as DashboardOptions;
  const [xAxis = {}] = asList(config.xAxis);
  const [yAxis = {}, rightAxis] = asList(config.yAxis);
  const series = asList(config.series);
  const horizontal = yAxis.type === 'category' && xAxis.type !== 'category';
  const category = horizontal ? yAxis : xAxis;
  const rows = (category.data ?? []).map((item, index) => ({
    name: String(typeof item === 'object' ? item.value : item),
    id: String(index),
    index,
  }));
  return { config, series, rows, xAxis, yAxis, rightAxis, category, horizontal };
}

export type ChartCategory = {
  id: string;
  name: string;
  index: number;
};

export function valueOf(data: number | Datum | null | undefined) {
  const value = typeof data === 'number' ? data : data?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function dataForPoint(series: DashboardSeries, category: ChartCategory, seriesIndex: number) {
  const data = series.data?.[category.index];
  return {
    componentType: 'series',
    seriesType: series.type,
    seriesName: series.name ?? '',
    seriesIndex,
    name: category.name,
    axisValue: category.name,
    axisValueLabel: category.name,
    dataIndex: category.index,
    value: valueOf(data),
    data,
    marker: '',
  };
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2, notation: 'compact' });

export function formatAxis(axis: DashboardAxis | undefined, value: string | number): string {
  const formatter = axis?.axisLabel?.formatter;
  if (typeof formatter === 'function') return String(formatter(value as never));
  if (typeof formatter === 'string') return formatter.replace('{value}', String(value));
  return typeof value === 'number' ? numberFormat.format(value) : value;
}

const entityText: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'", '#x27': "'", nbsp: ' ',
};

export function tooltipLines(value: unknown): string[] {
  return String(value ?? '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&([a-z]+|#39|#x27);/gi, (entity, key: string) => entityText[key] ?? entity)
    .split('\n').map(line => line.trim()).filter(Boolean);
}

export function chartDomain(series: DashboardSeries[], axis: DashboardAxis, includeZero: boolean): [number, number] {
  let smallest = includeZero ? 0 : Infinity;
  let largest = includeZero ? 0 : -Infinity;
  for (const item of series) {
    for (const datum of item.data ?? []) {
      const value = valueOf(datum);
      if (value === null) continue;
      smallest = Math.min(smallest, value);
      largest = Math.max(largest, value);
    }
  }
  if (!Number.isFinite(smallest)) smallest = 0;
  if (!Number.isFinite(largest)) largest = 0;
  const padding = Math.max((largest - smallest) * 0.06, 1);
  const min = typeof axis.min === 'number' ? axis.min : (includeZero && smallest === 0 ? 0 : smallest - padding);
  const max = typeof axis.max === 'number' ? axis.max : largest + padding;
  return [min, max > min ? max : min + padding];
}
