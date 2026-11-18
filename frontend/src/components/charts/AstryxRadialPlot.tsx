import { useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Chart, ChartLegend, ChartSwatch, useChart, useChartColors } from '@astryxdesign/charts';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import type { ChartEvents } from './AstryxDashboardChart';
import { asList, readDashboardChart, tooltipLines, valueOf } from './dashboardChartData';

interface RadialSlice {
  name: string;
  value: number;
  color: string;
  opacity: number;
  index: number;
}

interface RadialPlotProps {
  option: EChartsOption;
  height: number;
  label?: string;
  onEvents?: ChartEvents;
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const fullTurn = Math.PI * 2;

export default function AstryxRadialPlot({ option, height, label, onEvents }: RadialPlotProps) {
  const { series: [spec], config } = readDashboardChart(option);
  const data = spec.data ?? [];
  const palette = useChartColors().categorical(Math.max(data.length, 1));
  const colors = Array.isArray(option.color) ? option.color.filter((color): color is string => typeof color === 'string') : palette;
  const gauge = data.some(item => typeof item === 'object' && item?.itemStyle?.color === 'transparent');
  const slices = data.flatMap((datum, index): RadialSlice[] => {
    const value = valueOf(datum);
    if (value == null || value < 0) return [];
    const item = typeof datum === 'object' ? datum : null;
    if (item?.itemStyle?.color === 'transparent') return [];
    return [{
      name: item?.name ?? String(index + 1),
      value,
      color: item?.itemStyle?.color ?? colors[index % colors.length] ?? palette[index],
      opacity: item?.itemStyle?.opacity ?? 1,
      index,
    }];
  });
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const visibleSlices = slices.filter(slice => !hidden.has(slice.name) && config.legend?.selected?.[slice.name] !== false);
  const total = visibleSlices.reduce((sum, slice) => sum + slice.value, 0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visible = visibleSlices.find(slice => slice.index === hoveredIndex);
  const legend = !gauge && config.legend?.show !== false;
  const legendHeight = legend ? Math.min(92, Math.max(30, Math.ceil(slices.length / 4) * 22)) : 0;
  const labels = asList(option.graphic).flatMap(graphic => {
    const config = graphic as { style?: { text?: string } };
    return config.style?.text === undefined ? [] : [String(config.style.text)];
  });
  const [centerCaption] = asList(option.title);
  const legendLabel = (name: string) => config.legend?.formatter?.(name) ?? name;
  const point = (slice: RadialSlice) => ({
    name: slice.name,
    value: slice.value,
    percent: total ? slice.value / total * 100 : 0,
    color: slice.color,
    data: data[slice.index],
    dataIndex: slice.index,
    seriesName: spec.name ?? '',
    seriesType: 'pie',
    componentType: 'series',
    marker: '',
  });
  const tooltip = (slice: RadialSlice) => {
    const details = point(slice);
    const formatter = config.tooltip?.formatter;
    if (typeof formatter === 'function') return tooltipLines(formatter(details));
    if (typeof formatter === 'string') {
      return tooltipLines(formatter.replaceAll('{a}', details.seriesName).replaceAll('{b}', slice.name)
        .replaceAll('{c}', numberFormat.format(slice.value)).replaceAll('{d}', numberFormat.format(details.percent)));
    }
    return [slice.name, `${config.tooltip?.valueFormatter?.(slice.value) ?? numberFormat.format(slice.value)} · ${numberFormat.format(details.percent)}%`];
  };

  return (
    <div className="dashboard-plot-radial">
      <Chart
        aria-label={label}
        data={[]}
        xKey="name"
        series={[]}
        height={Math.max(40, height - legendHeight)}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        interactions={<RadialSegments
          slices={visibleSlices} total={total} label={label} active={hoveredIndex} gauge={gauge} labels={labels}
          centerTitle={centerCaption?.text}
          centerSubtitle={centerCaption?.subtext}
          innerRatio={radiusRatio(spec.radius, gauge)}
          showLabels={!gauge && spec.label?.show !== false && !legend}
          onHover={slice => {
            setHoveredIndex(slice?.index ?? null);
            if (slice) onEvents?.mouseover?.(point(slice));
          }}
          onClick={onEvents?.click ? slice => onEvents.click(point(slice)) : undefined}
        />}
      />
      {legend && <div className="dashboard-radial-legend dashboard-plot-legend" style={{ maxHeight: legendHeight }}>
        {config.legend?.selectedMode === false
          ? <ChartLegend alignment="center" items={slices.map(slice => ({ label: legendLabel(slice.name), color: slice.color, type: 'bar' }))} />
          : slices.map(slice => <Button key={slice.index} label={legendLabel(slice.name)} variant="ghost" size="sm"
              icon={<ChartSwatch color={slice.color} variant="square" />}
              aria-pressed={!hidden.has(slice.name)}
              onClick={() => setHidden(current => {
                const next = new Set(current);
                if (next.has(slice.name)) next.delete(slice.name);
                else next.add(slice.name);
                return next;
              })}
            />)}
      </div>}
      {visible && config.tooltip?.show !== false && (
        <Card className="dashboard-plot-hover dashboard-radial-hover">
          <div className="dashboard-plot-tooltip-content">{tooltip(visible).map((text, index) => (
            index === 0 ? <strong key={index}>{text}</strong> : <span key={index}>{text}</span>
          ))}</div>
        </Card>
      )}
    </div>
  );
}

function radiusRatio(radius: (string | number)[] | string | number | undefined, gauge: boolean) {
  if (!Array.isArray(radius)) return 0;
  const inner = Number.parseFloat(String(radius[0]));
  const outer = Number.parseFloat(String(radius[1]));
  return outer > 0 && inner >= 0 && inner < outer ? inner / outer : gauge ? 0.72 : 0.57;
}

function ringSegment(cx: number, cy: number, outer: number, inner: number, from: number, to: number) {
  const end = Math.min(to, from + fullTurn - 0.00001);
  const x = (r: number, angle: number) => cx + Math.cos(angle) * r;
  const y = (r: number, angle: number) => cy + Math.sin(angle) * r;
  const large = end - from > Math.PI ? 1 : 0;
  const outside = `M${x(outer, from)},${y(outer, from)} A${outer},${outer} 0 ${large} 1 ${x(outer, end)},${y(outer, end)}`;
  if (inner <= 0) return `${outside} L${cx},${cy} Z`;
  return `${outside} L${x(inner, end)},${y(inner, end)} A${inner},${inner} 0 ${large} 0 ${x(inner, from)},${y(inner, from)} Z`;
}

function RadialSegments({ slices, total, active, gauge, innerRatio, showLabels, labels, label, centerTitle, centerSubtitle, onHover, onClick }: {
  slices: RadialSlice[];
  total: number;
  active: number | null;
  gauge: boolean;
  innerRatio: number;
  showLabels: boolean;
  labels: string[];
  label?: string;
  centerTitle?: string;
  centerSubtitle?: string;
  onHover: (slice: RadialSlice | null) => void;
  onClick?: (slice: RadialSlice) => void;
}) {
  const { width, height } = useChart();
  const centerX = width / 2;
  const centerY = gauge ? height * 0.78 : height / 2;
  const outer = Math.max(0, Math.min(width * (showLabels ? 0.32 : 0.43), height * (gauge ? 0.65 : 0.45)));
  if (outer === 0) return null;
  let start = gauge ? Math.PI : -Math.PI / 2;
  return (
    <g role="group" aria-label={label} onPointerLeave={() => onHover(null)}>
      {total > 0 && slices.map(slice => {
        const angle = slice.value / total * (gauge ? Math.PI : fullTurn);
        const from = start;
        start += angle;
        if (angle <= 0) return null;
        const middle = from + angle / 2;
        const leadX = centerX + Math.cos(middle) * (outer + 9);
        const leadY = centerY + Math.sin(middle) * (outer + 11);
        const anchor = Math.cos(middle) < 0 ? 'end' : 'start';
        return (
          <g key={slice.index}>
            <path
              d={ringSegment(centerX, centerY, outer, outer * innerRatio, from, start)}
              fill={slice.color} opacity={active !== null && active !== slice.index ? slice.opacity * 0.72 : slice.opacity}
              stroke="var(--color-background-surface, var(--color-card))" strokeWidth={gauge ? 0 : 2}
              aria-label={`${slice.name}, ${numberFormat.format(slice.value)}`}
              role={onClick ? 'button' : undefined} tabIndex={0}
              className={onClick ? 'cursor-pointer' : undefined}
              onPointerEnter={() => onHover(slice)} onFocus={() => onHover(slice)} onBlur={() => onHover(null)}
              onClick={onClick ? () => onClick(slice) : undefined}
              onKeyDown={onClick ? event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onClick(slice);
                }
              } : undefined}
            />
            {showLabels && slice.value / total >= 0.08 && (
              <text className="dashboard-plot-annotation" x={leadX} y={leadY} textAnchor={anchor} pointerEvents="none">
                {slice.name.length > 13 ? `${slice.name.slice(0, 12)}…` : slice.name}
                <tspan x={leadX} dy={14}>{numberFormat.format(slice.value / total * 100)}%</tspan>
              </text>
            )}
          </g>
        );
      })}
      {gauge && <g pointerEvents="none" className="dashboard-plot-annotation">
        <text x={centerX} y={centerY - 9} textAnchor="middle" className="dashboard-gauge-value">{labels[0]}</text>
        <text x={centerX - outer} y={centerY + 20} textAnchor="start">{labels[1]}</text>
        <text x={centerX + outer} y={centerY + 20} textAnchor="end">{labels[2]}</text>
      </g>}
      {!gauge && centerTitle && <g pointerEvents="none" className="dashboard-plot-annotation" textAnchor="middle">
        <text x={centerX} y={centerY} className="dashboard-gauge-value">{centerTitle}</text>
        {centerSubtitle && <text x={centerX} y={centerY + 18}>{centerSubtitle}</text>}
      </g>}
    </g>
  );
}
