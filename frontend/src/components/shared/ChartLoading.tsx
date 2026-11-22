import type { EChartsOption } from 'echarts';
import type { ReactNode } from 'react';
import { Card } from '@astryxdesign/core/Card';
import { readDashboardChart } from '../charts/dashboardChartData';
import { Skeleton } from '@astryxdesign/core/Skeleton';

export function ChartPlaceholder({ className = '', round = false, children }: { className?: string; round?: boolean; children?: ReactNode }) {
  return <Card padding={4} className={'min-w-0 ' + className}>
    <div className="mb-3 border-b border-[var(--color-border)] pb-3"><Skeleton width="43%" height={20} /></div>
    {children ?? <div className="h-[350px]"><ChartLoading round={round} /></div>}
  </Card>;
}

export function MetricLoading({ bar = false }: { bar?: boolean }) {
  return <div className="grid min-w-0 content-center gap-2" aria-hidden="true">
    <Skeleton width="45%" height={12} /><Skeleton width={bar ? '100%' : '62%'} height={bar ? 8 : 20} />
  </div>;
}

export function StatusBarsLoading({ count }: { count: number }) {
  return <div className="dashboard-coletas-status">{Array.from({ length: count }, (_, i) => <MetricLoading key={i} bar />)}</div>;
}

interface ChartLoadingProps {
  option?: EChartsOption;
  round?: boolean;
  gauge?: boolean;
  bars?: boolean;
  legend?: boolean;
}

export default function ChartLoading({ option, round = false, gauge = false, bars = false, legend = true }: ChartLoadingProps) {
  const chart = option && readDashboardChart(option);
  const radial = round || gauge || chart?.series[0]?.type === 'pie';
  const barChart = bars || chart?.series.some(series => series.type === 'bar');
  const showLegend = legend && !gauge && chart?.config.legend?.show !== false;
  return <div aria-hidden="true" className="dashboard-loading-plot">
    <div className="dashboard-loading-plot-area">
      {radial ? <div className={'dashboard-loading-ring' + (gauge ? ' dashboard-loading-gauge' : '')}>
        <Skeleton width="100%" height="100%" radius="rounded" />
      </div> : <div className="dashboard-loading-axes">
        {barChart && <div className={'dashboard-loading-bars' + (chart?.horizontal ? ' is-horizontal' : '')}>
          {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} width="100%" height="100%" />)}
        </div>}
        {!barChart && <div className="dashboard-loading-guides">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} width="100%" height={2} />)}
        </div>}
      </div>}
    </div>
    {showLegend && <div className="flex justify-center gap-3"><Skeleton width="15%" height={10} /><Skeleton width="18%" height={10} /></div>}
  </div>;
}
