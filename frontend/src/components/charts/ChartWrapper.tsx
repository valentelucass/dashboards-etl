import { memo, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import ReactECharts from './DashboardEChart';
import ChartCard from '../shared/ChartCard';
import type { ChartDictionaryKey } from '../../constants/chartDictionary';
import { useEchartsTheme } from './useEchartsTheme';

const ECHARTS_CANVAS_OPTS = { renderer: 'canvas' as const };
const MIN_CHART_HEIGHT = 350;

function mergePlainObject(base: unknown, override: unknown) {
  return { ...(base as object), ...(override as object) };
}

function mergeAxis(baseAxis: unknown, optionAxis: unknown) {
  const mergeSingleAxis = (axis: unknown) => {
    const base = baseAxis as Record<string, unknown>;
    const current = (axis ?? {}) as Record<string, unknown>;
    const baseAxisLine = base.axisLine as Record<string, unknown> | undefined;
    const currentAxisLine = current.axisLine as Record<string, unknown> | undefined;
    const baseSplitLine = base.splitLine as Record<string, unknown> | undefined;
    const currentSplitLine = current.splitLine as Record<string, unknown> | undefined;

    return {
      ...base,
      ...current,
      axisLabel: mergePlainObject(base.axisLabel, current.axisLabel),
      axisLine: {
        ...baseAxisLine,
        ...currentAxisLine,
        lineStyle: mergePlainObject(baseAxisLine?.lineStyle, currentAxisLine?.lineStyle),
      },
      splitLine: {
        ...baseSplitLine,
        ...currentSplitLine,
        lineStyle: mergePlainObject(baseSplitLine?.lineStyle, currentSplitLine?.lineStyle),
      },
      nameTextStyle: mergePlainObject(base.nameTextStyle, current.nameTextStyle),
    };
  };

  if (Array.isArray(optionAxis)) {
    return optionAxis.map(mergeSingleAxis);
  }
  return mergeSingleAxis(optionAxis);
}

interface ChartWrapperProps {
  titulo: string;
  option: EChartsOption;
  actions?: ReactNode;
  onEvents?: Record<string, (params: unknown) => void>;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  erro?: string | null;
  altura?: number | string;
  className?: string;
  contentClassName?: string;
  chartClassName?: string;
  chartKey?: ChartDictionaryKey;
  sideContent?: ReactNode;
  sideContentLayoutClassName?: string;
  sideContentChartClassName?: string;
  sideContentAsideClassName?: string;
}

function ChartWrapperInner({
  titulo,
  option,
  actions,
  onEvents,
  isLoading,
  isEmpty,
  emptyMessage,
  erro,
  altura = MIN_CHART_HEIGHT,
  className,
  contentClassName,
  chartClassName,
  chartKey,
  sideContent,
  sideContentLayoutClassName,
  sideContentChartClassName,
  sideContentAsideClassName,
}: ChartWrapperProps) {
  const { baseOption } = useEchartsTheme();

  const mergedOption: EChartsOption = useMemo(() => ({
    ...baseOption,
    ...option,
    tooltip: { ...baseOption.tooltip, ...(option.tooltip as object) },
    legend: { ...baseOption.legend, ...(option.legend as object) },
    grid: { ...baseOption.grid, ...(option.grid as object) },
    xAxis: mergeAxis(baseOption.xAxis, option.xAxis),
    yAxis: mergeAxis(baseOption.yAxis, option.yAxis),
  }), [baseOption, option]);
  const resolvedHeight = typeof altura === 'number' ? Math.max(altura, MIN_CHART_HEIGHT) : altura;
  const chartStyle: CSSProperties = useMemo(() => ({
    height: resolvedHeight,
    minHeight: MIN_CHART_HEIGHT,
    width: '100%',
  }), [resolvedHeight]);
  const resolvedSideContentLayoutClassName = sideContentLayoutClassName
    ?? 'grid h-full min-h-0 grid-cols-1 gap-4 2xl:grid-cols-3 2xl:gap-6';
  const resolvedSideContentChartClassName = sideContentChartClassName ?? '2xl:col-span-2';
  const resolvedSideContentAsideClassName = sideContentAsideClassName ?? '2xl:col-span-1';

  return (
    <ChartCard titulo={titulo} actions={actions} isLoading={isLoading} isEmpty={isEmpty} emptyMessage={emptyMessage} erro={erro} className={className} contentClassName={contentClassName} chartKey={chartKey}>
      <div className={sideContent ? resolvedSideContentLayoutClassName : 'h-full min-h-0'}>
        <div className={`h-full min-h-0 ${sideContent ? resolvedSideContentChartClassName : ''} ${chartClassName ?? ''}`} style={chartStyle}>
          <ReactECharts
            option={mergedOption}
            style={chartStyle}
            opts={ECHARTS_CANVAS_OPTS}
            onEvents={onEvents}
            notMerge
          />
        </div>
        {sideContent ? (
          <div className={`min-h-0 ${resolvedSideContentAsideClassName}`}>
            {sideContent}
          </div>
        ) : null}
      </div>
    </ChartCard>
  );
}

const ChartWrapper = memo(ChartWrapperInner);
export default ChartWrapper;
