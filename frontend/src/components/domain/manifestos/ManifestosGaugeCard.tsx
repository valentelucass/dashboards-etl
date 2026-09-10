import { useMemo } from 'react';
import ReactECharts from '../../charts/DashboardEChart';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import ChartCard from '../../shared/ChartCard';
import TooltipKpi from '../../shared/TooltipKpi';
import type { KpiDefinition } from '../../../constants/kpiDictionary';
import type { GaugeMetric } from '../../../types/manifestos';
import { formatarPorcentagem } from '../../../utils/formatadores';
import { buildManifestosHalfDonutOption } from './manifestosGaugeOptions';

interface ManifestosGaugeCardProps {
  titulo: string;
  metric?: GaugeMetric | null;
  isLoading?: boolean;
  corDestaque?: string;
  definitions: {
    geral: KpiDefinition;
    distribuicao: KpiDefinition;
    transferencia: KpiDefinition;
    cargaFechada: KpiDefinition;
  };
}

function percentualSeguro(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, numero);
}

function normalizarMetric(metric?: GaugeMetric | null): GaugeMetric {
  return {
    global: percentualSeguro(metric?.global),
    distribuicao: percentualSeguro(metric?.distribuicao),
    transferencia: percentualSeguro(metric?.transferencia),
    cargaFechada: percentualSeguro(metric?.cargaFechada),
  };
}

export default function ManifestosGaugeCard({
  titulo,
  metric,
  isLoading,
  corDestaque,
  definitions,
}: ManifestosGaugeCardProps) {
  const { isDark } = useEchartsTheme();
  const dados = normalizarMetric(metric);
  const globalFormatado = formatarPorcentagem(dados.global, 1);

  const option = useMemo(() => buildManifestosHalfDonutOption(dados.global, corDestaque, isDark), [corDestaque, dados.global, isDark]);

  return (
    <ChartCard titulo={titulo} isLoading={isLoading}>
      <div className="flex h-full min-h-[350px] items-center justify-between gap-0 max-[900px]:min-h-[360px] max-[900px]:flex-col">
        <TooltipKpi
          definition={definitions.geral}
          className="max-[900px]:w-full"
          style={{ flex: '1 1 76%' }}
        >
          <div className="relative min-h-[300px] w-full min-w-0 max-[900px]:min-h-[252px]">
            <ReactECharts option={option} style={{ height: 300, width: '100%' }} opts={{ renderer: 'canvas' }} notMerge />
            <span className="sr-only">Global: {globalFormatado}</span>
          </div>
        </TooltipKpi>
        <div className="ml-auto flex min-w-[112px] flex-col gap-2 border-l pl-4 text-sm [flex:0_0_22%] max-[900px]:ml-0 max-[900px]:w-full max-[900px]:border-l-0 max-[900px]:border-t max-[900px]:pl-0 max-[900px]:pt-3" style={{ borderColor: 'var(--color-border)' }}>
          <GaugeLegendItem definition={definitions.distribuicao} label="Distribuição" valor={dados.distribuicao} />
          <GaugeLegendItem definition={definitions.transferencia} label="Transferência" valor={dados.transferencia} />
          <GaugeLegendItem definition={definitions.cargaFechada} label="Carga Fechada" valor={dados.cargaFechada} />
        </div>
      </div>
    </ChartCard>
  );
}

function GaugeLegendItem({
  definition,
  label,
  valor,
}: {
  definition: KpiDefinition;
  label: string;
  valor: number;
}) {
  return (
    <TooltipKpi definition={definition} className="w-full rounded-lg" style={{ flex: '0 0 auto' }}>
      <div className="flex min-h-[56px] w-full flex-col justify-center">
        <strong className="text-xl font-extrabold leading-tight" style={{ color: 'var(--color-text)' }}>
          {formatarPorcentagem(valor, 1)}
        </strong>
        <span className="mt-1 min-w-0 truncate text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      </div>
    </TooltipKpi>
  );
}
