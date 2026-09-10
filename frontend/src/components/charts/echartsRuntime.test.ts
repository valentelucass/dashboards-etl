import { afterEach, describe, expect, it, vi } from 'vitest';
import { SVGRenderer } from 'echarts/renderers';
import type { EChartsType } from 'echarts/core';
import { echarts } from './echartsRuntime';
import { buildManifestosHalfDonutOption } from '../domain/manifestos/manifestosGaugeOptions';

// SVG is only registered in this test worker to render real ECharts without a browser/canvas mock.
echarts.use(SVGRenderer);
let chart: EChartsType | undefined;
afterEach(() => { chart?.dispose(); vi.restoreAllMocks(); });

function createChart() {
  chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 960, height: 350 });
  return chart;
}

describe('runtime modular real do ECharts', () => {
  it('renderiza barras e linhas, título, legenda, tooltip e meta sem módulos ausentes', () => {
    const error = vi.spyOn(console, 'error');
    const instance = createChart();
    instance.setOption({ animation: false, title: { text: 'Evolução' }, tooltip: { trigger: 'axis' }, legend: {},
      xAxis: { type: 'category', data: ['A', 'B', 'C'] }, yAxis: { type: 'value' },
      series: [
        { name: 'Volume', type: 'bar', data: [10, 20, 30] },
        { name: 'Meta', type: 'line', data: [20, 20, 20], markLine: { data: [{ yAxis: 25, name: 'Limite' }] } },
      ],
    });
    const svg = instance.renderToSVGString();
    expect(svg).toContain('<path');
    expect(svg).toContain('Evolução');
    expect(svg).toContain('Volume');
    expect(svg).toContain('25');
    expect(error).not.toHaveBeenCalled();
  });

  it('renderiza o indicador real de Manifestos com texto gráfico e meia rosca', () => {
    const error = vi.spyOn(console, 'error');
    const instance = createChart();
    instance.setOption({ ...buildManifestosHalfDonutOption(72.5, '#059669'), animation: false });
    const svg = instance.renderToSVGString();
    expect(svg).toContain('72,5%');
    expect(svg).toContain('100,0%');
    expect(svg).toContain('#059669');
    expect(error).not.toHaveBeenCalled();
  });

  it('mantém zoom, seleção de legenda e eventos interativos', () => {
    const instance = createChart();
    instance.setOption({ animation: false, legend: {}, tooltip: {},
      xAxis: { type: 'category', data: ['A', 'B', 'C', 'D'] }, yAxis: {},
      dataZoom: [{ type: 'inside' }, { type: 'slider' }],
      series: [{ name: 'Volume', type: 'bar', data: [10, 20, 30, 40] }],
    });
    const changed = vi.fn();
    instance.on('datazoom', changed);
    instance.dispatchAction({ type: 'dataZoom', start: 25, end: 75 });
    expect(changed).toHaveBeenCalledOnce();
    expect(instance.getOption().dataZoom).toEqual(expect.arrayContaining([expect.objectContaining({ start: 25, end: 75 })]));
    instance.dispatchAction({ type: 'legendUnSelect', name: 'Volume' });
    expect(instance.getOption().legend).toEqual(expect.arrayContaining([expect.objectContaining({ selected: { Volume: false } })]));
  });
});
