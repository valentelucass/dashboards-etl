import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { EChartsOption } from 'echarts';
import { ChartLegend, ChartSwatch, swatchVariantForType, useChartColors } from '@astryxdesign/charts';
import { Button } from '@astryxdesign/core/Button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AstryxCartesianPlot from './AstryxCartesianPlot';
import AstryxRadialPlot from './AstryxRadialPlot';
import { readDashboardChart, type DashboardSeries } from './dashboardChartData';

export type ChartEvents = Record<string, (params: unknown) => void>;

export interface AstryxChartProps {
  option: EChartsOption;
  label?: string;
  style?: CSSProperties;
  onEvents?: ChartEvents;
}

export default function AstryxDashboardChart({ option, label, onEvents, style }: AstryxChartProps) {
  const model = useMemo(() => readDashboardChart(option), [option]);
  const { config, series, rows } = model;
  const palette = useChartColors();
  const colors = useMemo(() => palette.categorical(series.length || 1), [palette, series.length]);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [page, setPage] = useState(0);
  const plotRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.floor(entry.contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const radial = series[0]?.type === 'pie';
  const end = config.dataZoom?.find(item => item.type === 'slider')?.end;
  const pageSize = end ? Math.max(1, Math.round(rows.length * end / 100)) : rows.length;
  const pageCount = pageSize ? Math.ceil(rows.length / pageSize) : 1;
  const currentPage = Math.min(page, pageCount - 1);
  const candidates = series.map((item, index) => describeSeries(item, index, colors));
  const active = candidates.filter(item => !hidden.has(item.name) && config.legend?.selected?.[item.name] !== false);
  const allowedNames = config.legend?.data?.map(item => typeof item === 'string' ? item : item.name);
  const legendItems = candidates.filter(item => item.spec.name &&
    (allowedNames ? allowedNames.includes(item.name) : series.length > 1));
  const showLegend = !radial && config.legend?.show !== false && legendItems.length > 0;
  const legend = showLegend && (
    <div className="dashboard-plot-legend">
      {config.legend?.selectedMode === false
        ? <ChartLegend items={legendItems.map(({ name, color, spec }) => ({ label: name, color, type: spec.type }))} alignment="center" />
        : legendItems.map(({ name, key, color, spec }) => (
          <Button
            key={key}
            label={name}
            icon={<ChartSwatch color={color} variant={swatchVariantForType(spec.type ?? 'line')} />}
            variant="ghost"
            size="sm"
            aria-pressed={!hidden.has(name)}
            onClick={() => setHidden(previous => {
              const next = new Set(previous);
              if (next.has(name)) next.delete(name);
              else next.add(name);
              return next;
            })}
          />
        ))}
    </div>
  );

  return (
    <div className="dashboard-astryx-plot" data-chart-renderer="astryx" style={{ height: 350, ...style }}>
      {config.legend?.top != null && legend}
      <div className="dashboard-plot-area" ref={plotRef}>
        {height > 0 && (radial
          ? <AstryxRadialPlot option={option} height={height} label={label} onEvents={onEvents} />
          : <AstryxCartesianPlot
              model={model}
              height={height}
              label={label}
              onEvents={onEvents}
              series={active}
              rows={rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize)}
            />
        )}
      </div>
      {config.legend?.top == null && legend}
      {pageCount > 1 && (
        <div className="dashboard-plot-legend" aria-label="Paginação do gráfico">
          <Button label="Página anterior do gráfico" variant="ghost" size="sm" isIconOnly icon={<ChevronLeft size={16} />} isDisabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} />
          <span aria-live="polite">{currentPage + 1} / {pageCount}</span>
          <Button label="Próxima página do gráfico" variant="ghost" size="sm" isIconOnly icon={<ChevronRight size={16} />} isDisabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)} />
        </div>
      )}
    </div>
  );
}

export interface PlotSeries {
  spec: DashboardSeries;
  index: number;
  key: string;
  name: string;
  color: string;
}

function describeSeries(spec: DashboardSeries, index: number, colors: string[]): PlotSeries {
  return {
    spec,
    index,
    key: `series-${index}`,
    name: spec.name || 'Valor',
    color: spec.lineStyle?.color ?? (typeof spec.itemStyle?.color === 'string' ? spec.itemStyle.color : colors[index % colors.length]),
  };
}
