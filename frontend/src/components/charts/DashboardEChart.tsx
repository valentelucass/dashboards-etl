import ReactEChartsCore from 'echarts-for-react/lib/core';
import type { ComponentProps } from 'react';
import { echarts } from './echartsRuntime';

type DashboardEChartProps = Omit<ComponentProps<typeof ReactEChartsCore>, 'echarts'>;

export default function DashboardEChart(props: DashboardEChartProps) {
  return <ReactEChartsCore {...props} echarts={echarts} />;
}
