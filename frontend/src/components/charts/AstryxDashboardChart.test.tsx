// @vitest-environment jsdom
import type { EChartsOption } from 'echarts';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AstryxDashboardChart from './AstryxDashboardChart';

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class {
    private callback: ResizeObserverCallback;

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }

    observe(target: Element) {
      const entry = { target, contentRect: { width: 600, height: 350 } } as ResizeObserverEntry;
      this.callback([entry], this as unknown as ResizeObserver);
    }

    disconnect() {}
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('mantém a escala secundária percentual e alterna as séries pela legenda', () => {
  const option: EChartsOption = {
    xAxis: { type: 'category', data: ['Novembro', 'Dezembro'] },
    yAxis: [{ type: 'value', min: 0, max: 1000 }, {
      type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' },
    }],
    series: [
      { type: 'bar', name: 'Coletas', data: [400, 800] },
      { type: 'line', name: 'Performance', yAxisIndex: 1, data: [90, 95] },
    ],
  };
  const { container } = render(<AstryxDashboardChart label="Resumo" option={option} />);
  expect(container.querySelector('svg[role="img"]')).not.toBeNull();
  expect(container.querySelector('canvas')).toBeNull();
  expect(screen.getByText('100%')).toBeTruthy();
  const toggle = screen.getByRole('button', { name: 'Performance' });
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
});

it('mantém o índice original ao paginar e selecionar uma barra horizontal', () => {
  const click = vi.fn();
  const option: EChartsOption = {
    xAxis: { type: 'value' },
    yAxis: { type: 'category', data: ['A', 'B', 'C', 'D'], inverse: true },
    series: [{ type: 'bar', data: [20, 15, 10, 5] }],
    dataZoom: [{ type: 'slider', end: 50 }],
  };
  render(<AstryxDashboardChart option={option} onEvents={{ click }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página do gráfico' }));
  fireEvent.keyDown(screen.getByRole('button', { name: 'C' }), { key: 'Enter' });

  expect(click).toHaveBeenCalledWith(expect.objectContaining({ name: 'C', dataIndex: 2, value: 10 }));
});

it('usa o valor e a participação originais ao selecionar uma fatia', () => {
  const click = vi.fn();
  const option: EChartsOption = {
    legend: { show: false },
    series: [{ type: 'pie', data: [{ name: 'À vista', value: 20 }, { name: 'A prazo', value: 80 }] }],
  };
  render(<AstryxDashboardChart option={option} onEvents={{ click }} />);
  fireEvent.click(screen.getByRole('button', { name: 'À vista, 20' }));

  expect(click).toHaveBeenCalledWith(expect.objectContaining({ name: 'À vista', dataIndex: 0, value: 20, percent: 20 }));
});
