import ChartLoading, { StatusBarsLoading } from '../../shared/ChartLoading';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { useMemo, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { Button } from '@astryxdesign/core/Button';
import { ProgressBar, type ProgressBarVariant } from '@astryxdesign/core/ProgressBar';
import type { VisaoOrigemColetas } from '../../../types/coletas';
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
      loadingContent={<StatusBarsLoading count={4} />} className="2xl:col-span-2" isLoading={isLoading} isEmpty={data.length === 0} erro={erro}>
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

export function ColetasRegionChart({ data, isLoading, visao, actions, onEvents, erro }: {
  data: RegionPoint[];
  isLoading: boolean;
  visao: VisaoOrigemColetas;
  erro?: string | null;
  actions: ReactNode;
  onEvents: ChartEvents;
}) {
  const porCidade = visao.nivel === 'cidade';
  const titulo = porCidade ? ['Coletas por cidade', visao.regiao].filter(Boolean).join(' · ') : 'Coletas por região de coleta';
  const option = useMemo<EChartsOption>(() => ({
    xAxis: { type: 'category', data: data.map(row => row.nome) },
    yAxis: [
      { type: 'value', name: 'Coletas', min: 0, minInterval: 1, axisLabel: { formatter: (v: number) => formatarNumero(v) } },
      { type: 'value', name: 'Peso taxado', min: 0, axisLabel: { formatter: (v: number) => formatarPeso(v) } },
    ],
    series: [
      { name: 'Coletas', type: 'bar', data: data.map(row => row.totalColetas), itemStyle: { color: 'var(--coletas-chart-volume)' } },
      { name: 'Peso taxado', type: 'line', smooth: false, yAxisIndex: 1, data: data.map(row => row.pesoTaxado),
        symbol: 'circle', lineStyle: { color: 'var(--coletas-chart-weight)' } },
    ],
    tooltip: { trigger: 'axis' },
  }), [data]);

  return (
    <ChartCard titulo={titulo} chartKey="coletasOrigem"
      className="2xl:col-span-3" actions={actions} isLoading={isLoading} isEmpty={data.length === 0} erro={erro}
      loadingContent={<div className="dashboard-coletas-regions">
        <div className="h-[300px]"><ChartLoading option={option} /></div>
        {!porCidade && <div className="dashboard-coletas-region-actions">{[0, 1, 2].map(i => <Skeleton key={i} width={90} height={28} />)}</div>}
      </div>}
      emptyMessage={porCidade ? 'Nenhuma cidade encontrada para os filtros selecionados.' : 'Nenhuma região de coleta encontrada no período.'}>
      <div className="dashboard-coletas-regions">
        <AstryxDashboardChart option={option} label={porCidade ? 'Coletas e peso taxado por cidade' : 'Coletas e peso taxado por região'}
          style={{ height: 300 }} onEvents={porCidade ? undefined : onEvents} />
        {!porCidade && (
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
