import DashboardButton from "../../shared/DashboardButton";
import { useCallback, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import type { ManifestosTempoNivel, ManifestosTrendPoint } from '../../../types/manifestos';
import { buildBaseLineOption, getEchartsThemeTokens } from '../../../utils/echartsBuilders';

interface ManifestosTrendProps {
  dados: ManifestosTrendPoint[];
  nivel: ManifestosTempoNivel;
  onNivelChange: (nivel: ManifestosTempoNivel) => void;
  onPointClick: (data: string) => void;
  isLoading?: boolean;
}

const niveis: Array<{ valor: ManifestosTempoNivel; label: string }> = [
  { valor: 'ano', label: 'Ano' },
  { valor: 'mes', label: 'Mês' },
  { valor: 'dia', label: 'Dia' },
];

function formatarLabelTemporal(data: string, nivel: ManifestosTempoNivel): string {
  const [ano, mes, dia] = data.split('-');
  if (nivel === 'ano') return ano;
  if (nivel === 'mes') return `${mes}/${ano}`;
  return `${dia}/${mes}`;
}

export default function ManifestosTrend({ dados, nivel, onNivelChange, onPointClick, isLoading }: ManifestosTrendProps) {
  const { isDark } = useEchartsTheme();

  const option: EChartsOption = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);

    return buildBaseLineOption(isDark, {
      tooltip: {
        trigger: 'axis' as const,
      },
      legend: {
        top: 0,
      },
      grid: {
        top: 42,
        left: 18,
        right: 36,
        bottom: 18,
        containLabel: true,
      },
      xAxis: {
        type: 'category' as const,
        data: dados.map((d) => d.date),
        axisLabel: {
          formatter: (value: string) => formatarLabelTemporal(value, nivel),
        },
      },
      yAxis: {
        type: 'value' as const,
        name: 'Qtd',
      },
      series: [
        {
          name: 'Encerrado',
          type: 'line' as const,
          stack: 'total',
          areaStyle: {},
          data: dados.map((d) => d.encerrado),
          itemStyle: { color: tokens.palette[2] },
          smooth: true,
        },
        {
          name: 'Em Trânsito',
          type: 'line' as const,
          stack: 'total',
          areaStyle: {},
          data: dados.map((d) => d.emTransito),
          itemStyle: { color: tokens.palette[0] },
          smooth: true,
        },
        {
          name: 'Pendente',
          type: 'line' as const,
          stack: 'total',
          areaStyle: {},
          data: dados.map((d) => d.pendente),
          itemStyle: { color: tokens.palette[8] },
          smooth: true,
        },
      ],
    });
  }, [dados, isDark, nivel]);

  const handlePointClick = useCallback((params: unknown) => {
    const item = params as { name?: string };
    if (item.name) onPointClick(item.name);
  }, [onPointClick]);

  const chartEvents = useMemo(() => ({
    click: handlePointClick,
  }), [handlePointClick]);

  const nivelActions = useMemo(() => (
    <div className="flex rounded-md border p-0.5" style={{ borderColor: 'var(--color-border)' }}>
      {niveis.map((item) => (
        <DashboardButton
          key={item.valor}
          type="button"
          className="rounded px-2 py-1 text-xs font-semibold transition"
          style={{
            backgroundColor: nivel === item.valor ? 'var(--color-primary)' : 'transparent',
            color: nivel === item.valor ? '#fff' : 'var(--color-text-muted)',
          }}
          onClick={() => onNivelChange(item.valor)}
        >
          {item.label}
        </DashboardButton>
      ))}
    </div>
  ), [nivel, onNivelChange]);

  return (
    <ChartWrapper
      titulo="Status de Manifestos por dia, mês e ano"
      chartKey="manifestosStatusTemporal"
      option={option}
      actions={nivelActions}
      onEvents={chartEvents}
      isLoading={isLoading}
      isEmpty={dados.length === 0}
    />
  );
}
