import { escapeHtml } from '../../../utils/escapeHtml';
import type { EChartsOption } from 'echarts';
import { getEchartsThemeTokens, resolveEchartsColor } from '../../../utils/echartsBuilders';
import { formatarPorcentagem } from '../../../utils/formatadores';

function percentualSeguro(valor: unknown): number {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, numero);
}

function limitarPreenchimento(valor: number): number {
  return Math.min(100, valor);
}

export function buildManifestosHalfDonutOption(globalInput: number, corDestaque: string = 'var(--color-primary)', isDark = false): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const highlightColor = resolveEchartsColor(corDestaque) ?? tokens.palette[0];
  const globalReal = percentualSeguro(globalInput);
  const globalPreenchimento = limitarPreenchimento(globalReal);
  const restante = Math.max(0, 100 - globalPreenchimento);
  const textoGlobal = formatarPorcentagem(globalReal, 1);

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: tokens.tooltipBg,
      borderColor: tokens.tooltipBorder,
      borderWidth: 1,
      textStyle: {
        color: tokens.tooltipText,
        fontSize: 12,
        textBorderWidth: 0,
        textShadowBlur: 0,
      },
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number };
        if (!item.name || item.name === 'Metade Oculta') return '';
        const valor = item.name === 'Global' ? globalReal : Number(item.value ?? 0);
        return `${escapeHtml(item.name)}: ${formatarPorcentagem(valor, 1)}`;
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '61%',
        silent: true,
        style: {
          text: textoGlobal,
          fill: tokens.textColor,
          fontSize: 29,
          fontWeight: 800,
        },
      },
      {
        type: 'text',
        left: '4%',
        top: '86%',
        silent: true,
        style: {
          text: formatarPorcentagem(0, 1),
          fill: tokens.mutedTextColor,
          fontSize: 11,
          fontWeight: 600,
        },
      },
      {
        type: 'text',
        right: '3%',
        top: '86%',
        silent: true,
        style: {
          text: formatarPorcentagem(100, 1),
          fill: tokens.mutedTextColor,
          fontSize: 11,
          fontWeight: 600,
        },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['80%', '112%'],
        center: ['50%', '87%'],
        startAngle: 180,
        avoidLabelOverlap: false,
        label: {
          show: false,
        },
        labelLine: { show: false },
        emphasis: { disabled: true },
        data: [
          {
            name: 'Global',
            value: globalPreenchimento,
            itemStyle: { color: highlightColor, borderWidth: 0 },
          },
          {
            name: 'Restante',
            value: restante,
            itemStyle: { color: tokens.softTrack, borderWidth: 0 },
          },
          {
            name: 'Metade Oculta',
            value: 100,
            label: { show: false },
            labelLine: { show: false },
            itemStyle: { color: 'transparent', borderWidth: 0 },
            emphasis: { disabled: true },
            select: { disabled: true },
          },
        ],
      },
    ],
  };
}
