import { RadialChart, RadialSlice, useRadial } from '@astryxdesign/lab';
import { useLayoutEffect, useRef, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChartLegend, ChartSwatch, useChartColors } from '@astryxdesign/charts';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import type { ChartEvents } from './AstryxDashboardChart';
import { asList, readDashboardChart, tooltipLines, valueOf } from './dashboardChartData';

interface SliceDatum extends Record<string, unknown> {
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
  fitDonut?: boolean;
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export default function AstryxRadialPlot({ option, height, label, onEvents, fitDonut = false }: RadialPlotProps) {
  const { series: [spec], config } = readDashboardChart(option);
  const data = spec.data ?? [];
  const palette = useChartColors().categorical(Math.max(data.length, 1));
  const colors = Array.isArray(option.color) ? option.color.filter((color): color is string => typeof color === 'string') : palette;
  const gauge = data.some(item => typeof item === 'object' && item?.itemStyle?.color === 'transparent');
  const slices = data.flatMap((datum, index): SliceDatum[] => {
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
  const segments = visibleSlices.filter(slice => slice.value > 0);
  // The transparent half completes the circle for the semicircular gauge.
  const radialData = gauge && total > 0
    ? [...segments, { name: 'Metade oculta', value: total, color: 'transparent', index: -1, opacity: 0 }]
    : segments;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visible = visibleSlices.find(slice => slice.index === hoveredIndex);
  const legend = !gauge && config.legend?.show !== false;
  const legendRef = useRef<HTMLDivElement>(null);
  const [legendHeight, setLegendHeight] = useState(0);
  useLayoutEffect(() => {
    const element = legendRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setLegendHeight(Math.ceil(entry.contentRect.height)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [legend]);
  const labels = asList(option.graphic).flatMap(graphic => {
    const config = graphic as { style?: { text?: string } };
    return config.style?.text === undefined ? [] : [String(config.style.text)];
  });
  const [centerCaption] = asList(option.title);
  const legendLabel = (name: string) => config.legend?.formatter?.(name) ?? name;
  const point = (slice: SliceDatum) => ({
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
  const tooltip = (slice: SliceDatum) => {
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
      <div className={gauge ? 'dashboard-radial-gauge' : undefined} style={gauge ? { height, overflow: 'clip' } : undefined}>
        <RadialChart data={radialData} label={label ?? spec.name ?? 'Distribuição'} labelKey="name" valueKey="value"
          innerRadius={radiusRatio(spec.radius, gauge)} padAngle={gauge ? 0 : Math.min(0.02, 0.5 / Math.max(1, segments.length))}
          height={gauge ? Math.round(height * 1.54) : Math.max(40, height - (legend ? legendHeight : 0))}>
          <SliceMarks data={radialData} gauge={gauge} active={hoveredIndex} labels={labels}
            fittedInnerRadius={fitDonut && !gauge ? radiusRatio(spec.radius, false) : undefined}
            centerTitle={centerCaption?.text} centerSubtitle={centerCaption?.subtext}
            showLabels={!gauge && spec.label?.show !== false && !legend}
            onHover={slice => {
              setHoveredIndex(slice?.index ?? null);
              if (slice) onEvents?.mouseover?.(point(slice));
            }}
            onSelect={onEvents?.click ? slice => onEvents.click(point(slice)) : undefined} />
        </RadialChart>
      </div>
      {legend && <div ref={legendRef} className="dashboard-radial-legend dashboard-plot-legend" style={{ maxHeight: Math.max(48, height - 112) }}>
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

function SliceMarks({ data, gauge, active, labels, centerTitle, centerSubtitle, showLabels, onHover, onSelect, fittedInnerRadius }: {
  data: SliceDatum[];
  gauge: boolean;
  active: number | null;
  labels: string[];
  centerTitle?: string;
  centerSubtitle?: string;
  showLabels: boolean;
  fittedInnerRadius?: number;
  onHover: (slice: SliceDatum | null) => void;
  onSelect?: (slice: SliceDatum) => void;
}) {
  const { cx, cy, radius, slices } = useRadial();
  // A separate HTML legend frees the space the radial renderer reserves for outer labels.
  const outer = Math.max(1, Math.min(cx, cy) - 8);
  const inner = fittedInnerRadius === undefined ? undefined : outer * fittedInnerRadius;
  const scale = inner !== undefined && radius > 0 ? outer / radius : 1;
  const fittedTransform = scale === 1 ? undefined : `translate(${cx} ${cy}) scale(${scale}) translate(${-cx} ${-cy})`;
  const centerFont = (value: string | undefined, maximum: number) =>
    inner && value ? Math.min(maximum, inner * 1.6 / (value.length * 0.62)) : undefined;
  const marks = useRef<SVGGElement>(null);
  // RadialSlice owns the geometry. Attach the dashboard's drill-down semantics
  // to its visible marks so pointer and keyboard select the same original row.
  useLayoutEffect(() => {
    marks.current?.querySelectorAll('path').forEach((path, position) => {
      const item = data[position];
      if (!item || item.index < 0) {
        path.setAttribute('aria-hidden', 'true');
        path.style.pointerEvents = 'none';
        return;
      }
      path.dataset.position = String(position);
      path.setAttribute('tabindex', '0');
      path.setAttribute('role', onSelect ? 'button' : 'img');
      path.setAttribute('aria-label', item.name + ', ' + numberFormat.format(item.value));
    });
  }, [data, onSelect]);

  function datum(target: EventTarget | null) {
    if (!(target instanceof Element)) return null;
    const position = target.getAttribute('data-position');
    return position == null ? null : data[Number(position)];
  }

  const colors = data.map(item => {
    const opacity = item.opacity * (active !== null && item.index !== active ? 0.72 : 1);
    return opacity === 1 ? item.color : `color-mix(in srgb, ${item.color} ${opacity * 100}%, transparent)`;
  });
  return (
    <>
      <g ref={marks} transform={gauge ? `rotate(-90 ${cx} ${cy})` : fittedTransform}
        className={onSelect ? 'cursor-pointer' : undefined}
        onPointerOver={event => onHover(datum(event.target))} onPointerLeave={() => onHover(null)}
        onFocus={event => onHover(datum(event.target))} onBlur={() => onHover(null)}
        onClick={event => { const item = datum(event.target); if (item) onSelect?.(item); }}
        onKeyDown={event => {
          const item = datum(event.target);
          if (item && onSelect && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            onSelect(item);
          }
        }}>
        <RadialSlice colors={colors} labels={false} cornerRadius={gauge ? 1 : 0} />
      </g>
      <g pointerEvents="none" className="dashboard-plot-annotation" textAnchor="middle">
        {showLabels && slices?.map((slice, i) => {
          if (slice.percentage < 0.08) return null;
          const angle = (slice.startAngle + slice.endAngle) / 2;
          const x = cx + Math.cos(angle) * (radius + 8);
          const y = cy + Math.sin(angle) * (radius + 8);
          // Keep each label inside the SVG, even in a narrow dashboard card.
          const edge = Math.min(55, cx / 2);
          const labelX = Math.max(edge, Math.min(cx * 2 - edge, x));
          const name = data[i].name;
          return <text key={data[i].index} x={labelX} y={y}>
            {name.length > 13 ? name.slice(0, 12) + '…' : name}
            <tspan x={labelX} dy={14}>{numberFormat.format(slice.percentage * 100)}%</tspan>
          </text>;
        })}
        {(gauge || centerTitle) && <text x={cx} y={cy - (gauge ? 9 : 0)} className="dashboard-gauge-value" style={{ fontSize: centerFont(centerTitle, 24) }}>{gauge ? labels[0] : centerTitle}</text>}
        {gauge ? <>
          <text x={cx - radius} y={cy + 20} textAnchor="start">{labels[1]}</text>
          <text x={cx + radius} y={cy + 20} textAnchor="end">{labels[2]}</text>
        </> : centerSubtitle && <text x={cx} y={cy + (inner === undefined ? 18 : Math.min(16, inner * 0.4))} style={{ fontSize: centerFont(centerSubtitle, 11) }}>{centerSubtitle}</text>}
      </g>
    </>
  );
}
