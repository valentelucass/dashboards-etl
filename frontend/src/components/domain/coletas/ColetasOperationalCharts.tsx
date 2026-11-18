import { useMemo, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { Button } from '@astryxdesign/core/Button';
import { ProgressBar, type ProgressBarVariant } from '@astryxdesign/core/ProgressBar';
import ChartCard from '../../shared/ChartCard';
import AstryxDashboardChart, { type ChartEvents } from '../../charts/AstryxDashboardChart';
import { formatarNumero, formatarPeso } from '../../../utils/formatadores';

const statusVariants: Record<string, ProgressBarVariant> = {
  finalizada: 'success',
  cancelada: 'error',
  'em tratativa': 'warning',
};

export function ColetasStatusChart({ data, isLoading, erro }: {
  data: readonly { status: string; total: number }[];
  isLoading: boolean;
  erro?: string | null;
}) {
  const total = Math.max(1, data.reduce((sum, row) => sum + row.total, 0));
  return (
    <ChartCard titulo="Distribuição por Status" chartKey="coletasStatus"
      className="2xl:col-span-2" isLoading={isLoading} isEmpty={data.length === 0} erro={erro}>
      <div className="dashboard-coletas-status">
        {data.map(row => (
          <ProgressBar key={row.status} label={row.status} value={row.total} max={total}
            variant={statusVariants[row.status.trim().toLocaleLowerCase('pt-BR')] ?? 'accent'}
            hasValueLabel formatValueLabel={value => formatarNumero(value)} />
        ))}
      </div>
    </ChartCard>
  );
}

interface RegionPoint {
  nome: string;
  totalColetas: number;
  pesoTaxado: number;
}

const regionalMetrics = [
  { key: 'totalColetas', title: 'Coletas', color: 'var(--coletas-chart-volume)', format: (value: number) => formatarNumero(value) },
  { key: 'pesoTaxado', title: 'Peso taxado', color: 'var(--coletas-chart-weight)', format: formatarPeso },
] as const;

export function ColetasRegionChart({ data, isLoading, cityView, actions, onEvents }: {
  data: RegionPoint[];
  isLoading: boolean;
  cityView: boolean;
  actions: ReactNode;
  onEvents: ChartEvents;
}) {
  const options = useMemo(() => regionalMetrics.map((metric): EChartsOption => ({
    xAxis: { type: 'category', data: data.map(row => row.nome) },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar', name: metric.title,
      data: data.map(row => row[metric.key]), itemStyle: { color: metric.color },
    }],
    tooltip: { valueFormatter: value => metric.format(Number(value)) },
    legend: { show: false },
  })), [data]);

  return (
    <ChartCard titulo="Coletas por Região Logística e Cidade" chartKey="coletasOrigem"
      className="2xl:col-span-3" actions={actions} isLoading={isLoading} isEmpty={data.length === 0}
      emptyMessage={cityView ? 'Nenhuma cidade encontrada para a região logística selecionada.' : 'Nenhuma região logística encontrada para o período selecionado.'}>
      <div className="dashboard-coletas-regions">
        {regionalMetrics.map((metric, index) => (
          <section key={metric.key} className="min-w-0" aria-label={metric.title}>
            <h4>{metric.title}</h4>
            <AstryxDashboardChart option={options[index]} label={metric.title}
              style={{ height: 267 }} onEvents={cityView ? undefined : onEvents} />
          </section>
        ))}
        {!cityView && (
          <div className="dashboard-coletas-region-actions" role="group" aria-label="Detalhar por região">
            {data.map(row => (
              <Button key={row.nome} label={row.nome} variant="secondary" size="sm"
                onClick={() => onEvents.click?.({ name: row.nome })} />
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
