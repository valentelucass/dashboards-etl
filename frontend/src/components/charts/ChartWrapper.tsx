import { memo, useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import AstryxDashboardChart from './AstryxDashboardChart';
import ChartCard from '../shared/ChartCard';
import type { ChartDictionaryKey } from '../../constants/chartDictionary';

const MIN_CHART_HEIGHT = 350;

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
          <AstryxDashboardChart option={option} label={titulo} style={chartStyle} onEvents={onEvents} />
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
