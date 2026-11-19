import { useLayoutEffect, useRef, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Chart, ChartAxis, ChartGrid, ChartSwatch, line, referenceLine } from '@astryxdesign/charts';
import ChartCard from '../../shared/ChartCard';
import type { ColetasTrendPoint } from '../../../types/coletas';
import { formatarNumero } from '../../../utils/formatadores';

interface ColetasTrendProps {
  dados: ColetasTrendPoint[];
  isLoading?: boolean;
}

const seriesConfig = [
  { key: 'total', label: 'Total', color: 'var(--coletas-chart-volume)' },
  { key: 'finalizadas', label: 'Finalizadas', color: 'var(--coletas-chart-finalizadas)' },
  { key: 'canceladas', label: 'Canceladas', color: 'var(--coletas-chart-weight)' },
  { key: 'emTratativa', label: 'Em Tratativa', color: 'var(--coletas-chart-tratativa)' },
] as const;

function formatarDia(value: unknown) {
  const date = String(value);
  const parts = /^\d{4}-(\d{2})-(\d{2})/.exec(date);
  return parts ? `${parts[2]}/${parts[1]}` : date;
}

export default function ColetasTrend({ dados, isLoading }: ColetasTrendProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(307);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const visible = !isLoading && dados.length > 0;

  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!visible || !plot) return;
    const observer = new ResizeObserver(([entry]) => setHeight(Math.floor(entry.contentRect.height)));
    observer.observe(plot);
    return () => observer.disconnect();
  }, [visible]);
  const average = dados.length > 0
    ? dados.reduce((sum, item) => sum + item.total, 0) / dados.length : 0;
  const averageLabel = 'Média do período: ' + formatarNumero(average, Number.isInteger(average) ? 0 : 1);
  const visibleSeries = seriesConfig.filter(item => !hidden.has(item.key));
  const showAverage = !hidden.has('media') && !hidden.has('total');
  const max = dados.reduce((previous, item) => Math.max(
    previous, ...visibleSeries.map(({key}) => item[key]),
  ), 0);
  const step = 10 ** Math.floor(Math.log10(Math.max(1, max)));
  const axisMax = Math.max(1, Math.ceil(max / (step / 2)) * (step / 2));
  const marks = visibleSeries.map(({ key, label, color }) =>
    line(key, { label, color, strokeWidth: 2, curve: 'linear' }));
  if (showAverage) marks.push(referenceLine({
    y: average,
    color: 'var(--color-text-muted)',
    strokeDasharray: '4 4',
    label: 'Média: ' + formatarNumero(average, 1),
  }));

  function toggleSeries(key: string) {
    setHidden(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  return (
    <ChartCard titulo="Coletas por dia, mês e ano" chartKey="coletasSerie" isLoading={isLoading} isEmpty={dados.length === 0}
      contentClassName="dashboard-coletas-card-content">
      <div className="dashboard-coletas-plot">
        <div className="dashboard-coletas-trend-area" ref={plotRef}>
        <Chart
          aria-label="Evolução das coletas"
          data={dados.map(item => ({ ...item }))}
          xKey="date"
          series={marks}
          height={height}
          margin={{ left: 52, right: 16, top: 18, bottom: 37 }}
          yDomain={[0, axisMax]}
          grid={<ChartGrid horizontal tickCount={5} />}
          axes={<>
            <ChartAxis position="left" tickFormat={(value) => formatarNumero(Number(value))} />
            <ChartAxis position="bottom" tickFormat={formatarDia} />
          </>}
          tooltip={{
            render: (date, values) => (
              <div className="space-y-1 text-sm">
                <strong>{formatarDia(date)}</strong>
                {values.map(value => (
                  <div className="flex items-center justify-between gap-4" key={value.key}>
                    <span className="dashboard-code-button-content">
                      <ChartSwatch color={value.color} variant="line" />{value.label}
                    </span>
                    <span>{formatarNumero(Number(value.value))}</span>
                  </div>
                ))}
              </div>
            ),
          }}
        />
        </div>
        <div className="dashboard-coletas-legend" role="group" aria-label="Séries do gráfico">
          {seriesConfig.map(({ key, label, color }) => (
            <Button key={key} label={label} size="sm" variant="ghost" aria-pressed={!hidden.has(key)} onClick={() => toggleSeries(key)}>
              <span className="dashboard-code-button-content">
                <ChartSwatch color={color} variant="line" />{label}
              </span>
            </Button>
          ))}
          <Button label={averageLabel} size="sm" variant="ghost" isDisabled={hidden.has('total')} aria-pressed={showAverage} onClick={() => toggleSeries('media')}>
            <span className="dashboard-code-button-content">
              <ChartSwatch color="var(--color-text-muted)" variant="line" />{averageLabel}
            </span>
          </Button>
        </div>
      </div>
    </ChartCard>
  );
}
