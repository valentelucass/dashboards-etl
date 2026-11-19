import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { area, bar, Chart, ChartAxis, ChartGrid, ChartSwatch, line, referenceLine, useChart, xPixel, type SeriesContext, type SeriesDef } from '@astryxdesign/charts';
import { Card } from '@astryxdesign/core/Card';
import type { ChartEvents, PlotSeries } from './AstryxDashboardChart';
import { chartDomain, dataForPoint, formatAxis, tooltipLines, valueOf, type ChartCategory, type DashboardAxis, type readDashboardChart } from './dashboardChartData';

const valueField = (index: number) => `value-${index}`;

function transpose(ctx: SeriesContext): SeriesContext {
  return {
    ...ctx,
    xScale: ctx.xScale.copy().range([0, ctx.height]),
    yScale: ctx.yScale.copy().range([ctx.width, 0]),
    width: ctx.height,
    height: ctx.width,
  };
}

function makeBar(item: PlotSeries, horizontal: boolean, grouped: boolean): SeriesDef {
  const { spec, color, name, index } = item;
  const mark = bar(valueField(index), {
    label: name,
    radius: 5,
    stack: spec.stack,
    group: grouped && !spec.stack ? 'bars' : undefined,
    opacity: spec.itemStyle?.opacity,
    color: row => {
      const fill = String(row[`color-${index}`] ?? color);
      const opacity = row[`opacity-${index}`];
      return typeof opacity === 'number' && opacity < 1
        ? `color-mix(in srgb, ${fill} ${Math.max(0, opacity) * 100}%, transparent)`
        : fill;
    },
  });
  if (!horizontal) return mark;
  return {
    ...mark,
    resolve: (ctx, offsets, group) => mark.resolve(transpose(ctx), offsets, group),
    render: (points, ctx) => (
      <g transform={`matrix(0 1 -1 0 ${ctx.width} 0)`}>{mark.render(points, transpose(ctx))}</g>
    ),
  };
}

function makeLine({ spec, name, index, color }: PlotSeries): SeriesDef {
  const key = valueField(index);
  const curve = spec.smooth === false ? 'linear' : 'monotone';
  if (spec.areaStyle && spec.lineStyle?.type !== 'dashed') {
    return area(key, { color, label: name, curve, opacity: spec.areaStyle.opacity ?? 0.12, stroke: true });
  }
  const mark = line(key, {
    color,
    label: name,
    curve,
    strokeWidth: spec.lineStyle?.width,
    dots: spec.symbol !== 'none' && spec.showSymbol !== false,
  });
  if (spec.lineStyle?.type !== 'dashed') return mark;
  return {
    ...mark,
    render: (points, ctx) => <g strokeDasharray="5 4">{mark.render(points, ctx)}</g>,
  };
}

function axisInset(axis: DashboardAxis, domain: [number, number]) {
  const labelWidths = domain.map(value => formatAxis(axis, value).length * 6.4);
  return Math.min(126, Math.max(58, Math.ceil(Math.max(...labelWidths)) + 17));
}

interface CartesianPlotProps {
  model: ReturnType<typeof readDashboardChart>;
  series: PlotSeries[];
  rows: ChartCategory[];
  height: number;
  width: number;
  label?: string;
  onEvents?: ChartEvents;
}

export default function AstryxCartesianPlot({ model, series, rows, width, height, label, onEvents }: CartesianPlotProps) {
  const { category, horizontal, xAxis, yAxis, rightAxis, config } = model;
  const [hover, setHover] = useState<{ row: ChartCategory; x: number; y: number } | null>(null);
  const axis = horizontal ? xAxis : yAxis;
  const primary = series.filter(item => !item.spec.yAxisIndex);
  const secondary = series.filter(item => item.spec.yAxisIndex === 1);
  const primaryDomain = chartDomain(primary.map(item => item.spec), axis, primary.some(item => item.spec.type === 'bar'));
  const secondaryDomain = rightAxis && chartDomain(secondary.map(item => item.spec), rightAxis, secondary.some(item => item.spec.type === 'bar') || rightAxis.min !== 'dataMin');
  const convertScale = (value: number, reverse = false) => {
    if (!secondaryDomain) return value;
    const [source, target] = reverse ? [primaryDomain, secondaryDomain] : [secondaryDomain, primaryDomain];
    return target[0] + (value - source[0]) * (target[1] - target[0]) / (source[1] - source[0]);
  };
  const categoryById = new Map(rows.map(row => [row.id, row]));
  const orderedRows = horizontal && !category.inverse ? [...rows].reverse() : rows;
  const data = orderedRows.map(row => {
    const record: Record<string, unknown> = { categoria: row.id };
    for (const { spec, index } of series) {
      const datum = spec.data?.[row.index];
      const value = valueOf(datum);
      record[valueField(index)] = value != null && spec.yAxisIndex === 1 ? convertScale(value) : value;
      const override = typeof datum === 'object' && datum ? datum.itemStyle : undefined;
      const configuredColor = spec.itemStyle?.color;
      record[`color-${index}`] = override?.color ?? (typeof configuredColor === 'function'
        ? configuredColor(dataForPoint(spec, row, index) as never)
        : configuredColor);
      record[`opacity-${index}`] = override?.opacity;
    }
    return record;
  });
  const grouped = series.filter(item => item.spec.type === 'bar').length > 1;
  const marks = series.map(item => item.spec.type === 'bar' ? makeBar(item, horizontal, grouped) : makeLine(item));
  for (const { spec, color } of series) {
    for (const marker of spec.markLine?.data ?? []) {
      if (typeof marker.yAxis === 'number') marks.push(referenceLine({ y: marker.yAxis, color, strokeDasharray: '5 4' }));
    }
  }
  const categoryFormat = (id: unknown) => formatAxis(category, categoryById.get(String(id))?.name ?? '');
  const leftInset = config.grid?.containLabel === false && typeof config.grid.left === 'number'
    ? config.grid.left : axisInset(yAxis, primaryDomain);
  const categoryInset = Math.min(154, Math.max(82, category.axisLabel?.width ?? config.grid?.left ?? 92));
  const margin = {
    left: horizontal ? Math.min(categoryInset, Math.round(width * 0.35)) : leftInset,
    right: rightAxis && secondaryDomain ? axisInset(rightAxis, secondaryDomain)
      : horizontal ? Math.max(42, Math.ceil(axisInset(axis, primaryDomain) / 2)) : 16,
    bottom: horizontal ? 32 : 35,
    top: axis.name || rightAxis?.name ? 34 : 22,
  };
  const tooltip = config.tooltip?.show === false ? false : {
    render(id: unknown) {
      const row = categoryById.get(String(id));
      return row ? <ChartTooltipBody model={model} row={row} series={series} /> : null;
    },
  };
  const axes = horizontal ? <HorizontalAxes axis={axis} category={category} rows={orderedRows} />
    : <>
        <ChartAxis position="left" tickFormat={value => formatAxis(yAxis, Number(value))} animated={false} />
        <CategoryAxis format={categoryFormat} categoryCount={rows.length} />
        {secondaryDomain && <ChartAxis position="right" tickFormat={value => formatAxis(rightAxis, convertScale(Number(value), true))} animated={false} />}
        <AxisNames left={yAxis.name} right={rightAxis?.name} />
      </>;

  return (
    <>
      <Chart
        aria-label={label}
        height={height}
        margin={margin}
        data={data}
        xKey="categoria"
        yDomain={secondaryDomain || axis.min != null || axis.max != null ? primaryDomain : undefined}
        series={marks}
        axes={axes}
        grid={horizontal ? undefined : <ChartGrid horizontal tickCount={5} />}
        tooltip={horizontal ? false : tooltip}
        interactions={horizontal
          ? <HorizontalTargets rows={orderedRows} onHover={config.tooltip?.show === false ? undefined : setHover} onEvents={onEvents} series={series} />
          : <VerticalEvents rows={categoryById} series={series} onEvents={onEvents} />}
      >
        <PlotLabels series={series} rows={categoryById} horizontal={horizontal} />
      </Chart>
      {horizontal && hover && series.length > 0 && (
        <Card className="dashboard-plot-hover" style={{ top: Math.min(Math.max(4, hover.y), Math.max(4, height - 112)), left: Math.max(4, Math.min(hover.x, width - 248)), maxWidth: 'calc(100% - 8px)', overflowWrap: 'anywhere' }}>
          <ChartTooltipBody model={model} row={hover.row} series={series} />
        </Card>
      )}
    </>
  );
}

function ChartTooltipBody({ model, row, series }: { model: CartesianPlotProps['model']; row: ChartCategory; series: PlotSeries[] }) {
  const { config, category, horizontal, xAxis, yAxis } = model;
  const items = series.map(item => dataForPoint(item.spec, row, item.index));
  const { formatter, trigger, valueFormatter } = config.tooltip ?? {};
  const body = typeof formatter === 'function' && items.length
    ? tooltipLines(formatter(trigger === 'item' ? items[0] : items)) : [];
  if (body.length) return <div className="dashboard-plot-tooltip-content">{body.map((text, index) => index === 0 ? <strong key={index}>{text}</strong> : <span key={index}>{text}</span>)}</div>;
  return (
    <div className="dashboard-plot-tooltip-content">
      <strong>{formatAxis(category, row.name)}</strong>
      {items.map((point, index) => point.value != null && (
        <span key={point.seriesIndex} className="dashboard-plot-tooltip-value">
          <ChartSwatch color={series[index].color} variant={point.seriesType === 'bar' ? 'square' : 'line'} />
          {point.seriesName && `${point.seriesName}: `}
          {valueFormatter?.(point.value) ?? formatAxis(horizontal ? xAxis : model.rightAxis && series[index].spec.yAxisIndex === 1 ? model.rightAxis : yAxis, point.value)}
        </span>
      ))}
    </div>
  );
}

function CategoryAxis({ format, categoryCount }: { format: (value: unknown) => string; categoryCount: number }) {
  const { width } = useChart();
  const bandWidth = width / Math.max(1, categoryCount);
  // Match Astryx's tick spacing so shorter labels fit before the axis skips ticks.
  const characters = Math.max(6, Math.min(18, Math.floor((bandWidth - 16) / 7) - 1));
  return <ChartAxis position="bottom" tickFormat={format} truncate={characters} animated={false} />;
}

function AxisNames({ left, right }: { left?: string; right?: string }) {
  const { width } = useChart();
  return <g className="dashboard-plot-annotation">
    {left && <text x={0} y={-12}>{left}</text>}
    {right && <text x={width} y={-12} textAnchor="end">{right}</text>}
  </g>;
}

function HorizontalAxes({ rows, axis, category }: { rows: ChartCategory[]; axis: DashboardAxis; category: DashboardAxis }) {
  const { xScale, yScale, width, height, margin } = useChart();
  const band = xScale.copy().range([0, height]);
  const scale = yScale.copy().range([0, width]);
  const ticks: number[] = scale.ticks(4);
  const labelWidth = Math.max(1, ...ticks.map(value => formatAxis(axis, value).length * 7)) + 12;
  const tickSpacing = ticks.length < 2 ? width : Math.abs(scale(ticks[1]) - scale(ticks[0]));
  const labelStride = Math.max(1, Math.ceil(labelWidth / Math.max(1, tickSpacing)));
  const maxLength = Math.max(3, Math.floor((margin.left - 10) / 7));
  return (
    <g className="dashboard-plot-annotation" pointerEvents="none">
      {ticks.map((value: number, index: number) => (
        <g key={value} transform={`translate(${scale(value)},0)`}>
          <line y2={height} stroke="var(--color-border)" />
          {index % labelStride === 0 && <text y={height + 18} textAnchor="middle">{formatAxis(axis, value)}</text>}
        </g>
      ))}
      {rows.map(row => {
        const name = formatAxis(category, row.name);
        return <text key={row.id} x={-8} y={xPixel(row, 'id', band)} textAnchor="end" dominantBaseline="middle">
          {name.length > maxLength ? `${name.slice(0, maxLength - 1)}…` : name}
          <title>{name}</title>
        </text>;
      })}
    </g>
  );
}

interface EventProps {
  series: PlotSeries[];
  onEvents?: ChartEvents;
}

function HorizontalTargets({ rows, series, onEvents, onHover }: EventProps & {
  rows: ChartCategory[];
  onHover?: (hover: { row: ChartCategory; x: number; y: number } | null) => void;
}) {
  const { width, height, xScale, margin } = useChart();
  const band = xScale.copy().range([0, height]);
  if (!('step' in band) || !series[0]) return null;
  const item = series[0];
  const click = onEvents?.click;
  return <g onPointerLeave={() => onHover?.(null)}>
    {rows.map(row => {
      const center = xPixel(row, 'id', band);
      const step = band.step();
      const params = dataForPoint(item.spec, row, item.index);
      const show = () => onHover?.({ row, y: margin.top + center, x: margin.left + Math.min(20, width / 4) });
      return <rect
        key={row.id}
        x={0} y={center - step / 2} width={width} height={step}
        fill="transparent" className={click ? 'dashboard-plot-target cursor-pointer' : 'dashboard-plot-target'}
        role={click ? 'button' : undefined} tabIndex={click ? 0 : undefined} aria-label={click ? row.name : undefined}
        onPointerEnter={() => { show(); onEvents?.mouseover?.(params); }}
        onFocus={show} onBlur={() => onHover?.(null)}
        onClick={click ? () => click(params) : undefined}
        onKeyDown={click ? event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            click(params);
          }
        } : undefined}
      />;
    })}
  </g>;
}

function VerticalEvents({ rows, series, onEvents }: EventProps & { rows: Map<string, ChartCategory> }) {
  const { svgRef, xScale, width, height, margin, onPointer } = useChart();
  useEffect(() => {
    const svg = svgRef.current;
    const first = series[0];
    if (!onEvents || !svg || !first || !('bandwidth' in xScale)) return;
    let lastHoveredRow = '';
    function categoryAt(x: number) {
      if (!('step' in xScale)) return undefined;
      return [...rows.values()].find(row => Math.abs(xPixel(row, 'id', xScale) - x) <= xScale.step() / 2);
    }
    const unsubscribe = onPointer(event => {
      const row = event.x >= 0 ? categoryAt(event.x) : undefined;
      if (row?.id === lastHoveredRow) return;
      lastHoveredRow = row?.id ?? '';
      if (row) onEvents.mouseover?.(dataForPoint(first.spec, row, first.index));
    });
    function handleClick(event: MouseEvent) {
      if (!svg) return;
      const transform = svg.getScreenCTM()?.inverse();
      if (!transform) return;
      const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(transform);
      const x = point.x - margin.left;
      const y = point.y - margin.top;
      if (x < 0 || x > width || y < 0 || y > height) return;
      const row = categoryAt(x);
      if (row) onEvents?.click?.(dataForPoint(first.spec, row, first.index));
    }
    svg.addEventListener('click', handleClick);
    return () => { unsubscribe(); svg.removeEventListener('click', handleClick); };
  }, [rows, series, onEvents, svgRef, xScale, width, height, margin, onPointer]);
  return null;
}

function PlotLabels({ series, rows, horizontal }: { series: PlotSeries[]; rows: Map<string, ChartCategory>; horizontal: boolean }) {
  const { xScale, yScale, width, height } = useChart();
  const content = useMemo(() => {
    const x = horizontal ? xScale.copy().range([0, height]) : xScale;
    const y = horizontal ? yScale.copy().range([0, width]) : yScale;
    const nodes: ReactNode[] = [];
    for (const { spec, index } of series) {
      if (horizontal) {
        for (const marker of spec.markLine?.data ?? []) {
          if (marker.xAxis == null) continue;
          const position = y(marker.xAxis);
          nodes.push(<g key={`ref-${index}-${marker.xAxis}`}>
            <line x1={position} x2={position} y2={height} stroke="var(--color-text-muted)" strokeDasharray="5 4" />
            {spec.markLine?.label?.formatter && <text x={position} y={-7} textAnchor="middle">{spec.markLine.label.formatter}</text>}
          </g>);
        }
      }
      if (!spec.label?.show || (!horizontal && width / rows.size < 45)) continue;
      for (const row of rows.values()) {
        const point = dataForPoint(spec, row, index);
        if (point.value == null) continue;
        const formatter = spec.label.formatter;
        const value = typeof formatter === 'function' ? formatter(point as never) : String(point.value);
        const across = xPixel(row, 'id', x);
        const along = y(point.value);
        nodes.push(<text key={`${index}-${row.id}`}
          x={horizontal ? Math.min(along + 5, width + 3) : across}
          y={horizontal ? across : along - 9}
          textAnchor={horizontal ? 'start' : 'middle'} dominantBaseline={horizontal ? 'middle' : undefined}>{value}</text>);
      }
    }
    return nodes;
  }, [series, rows, horizontal, xScale, yScale, width, height]);
  return <g className="dashboard-plot-annotation" pointerEvents="none">{content}</g>;
}
