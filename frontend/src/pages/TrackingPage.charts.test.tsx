// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EChartsOption } from 'echarts';
import type { TrackingDashboard } from '../types/tracking';
import TrackingPage from './TrackingPage';

const state = vi.hoisted(() => ({ dark: false, tableLoading: true, data: undefined as TrackingDashboard | undefined,
  options: new Map<string, EChartsOption>(), branch: ['AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA'] }));
vi.mock('../components/charts/ChartWrapper', () => ({ default: ({ titulo, option }: { titulo: string; option: EChartsOption }) => {
  state.options.set(titulo, option); return null;
} }));
vi.mock('../components/charts/useEchartsTheme', () => ({ useEchartsTheme: () => ({ isDark: state.dark }) }));
vi.mock('../hooks/queries/useTracking', () => ({
  useTrackingDashboard: () => ({ data: state.data, isLoading: !state.data }),
  useTrackingDetalhesPaginada: () => ({ data: { conteudo: [] }, isLoading: state.tableLoading }),
}));
vi.mock('../hooks/queries/useDimensoes', () => ({ useFiliais: () => ({ data: state.branch }) }));
vi.mock('../contexts/FiltroContext', () => ({ useFiltro: () => ({
  dataInicio: '2026-08-01', dataFim: '2026-08-30', filtros: { filialAtual: state.branch }, setFiltro: vi.fn(),
}) }));
vi.mock('../contexts/PageHeaderContext', () => ({ usePageHeader: vi.fn() }));
vi.mock('../components/shared/AnalyticalDataTable', () => ({ default: () => null }));
vi.mock('../components/shared/DateRangePicker', () => ({ default: () => null }));
vi.mock('../components/shared/AsyncMultiSelect', () => ({ default: () => null }));
vi.mock('../components/shared/FilterBar', () => ({ default: () => null }));
vi.mock('../components/domain/tracking/TrackingKpiGrid', () => ({ default: () => null }));

const page = () => <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><TrackingPage /></MemoryRouter>;
beforeEach(() => {
  state.dark = false; state.tableLoading = true; state.options.clear();
  state.data = { overview: { updatedAt: '', totalCargas: 30, emTransito: 30, previsaoVencida: 0,
    valorFreteEmCarteira: 15000, pesoTaxadoTotal: 1000, pctFinalizado: 0 }, matrizRegiaoDestino: [],
    graficos: { statusDistribuicao: [{ status: 'Em entrega', total: 30, valorFrete: 15000 }],
      previsaoVencidaPorFilialAtual: [], valorPorRegiaoDestino: [{ regiaoDestino: 'SUL', valorFrete: 15000, cargas: 30 }] } };
});
afterEach(cleanup);

it('o fim do carregamento da tabela mantém as duas opções e os seus formatadores', () => {
  const view = render(page()); const previous = new Map(state.options);
  state.tableLoading = false; view.rerender(page());
  expect(state.options.size).toBe(2);
  previous.forEach((option, title) => expect(state.options.get(title)).toBe(option));
});

it('dados novos atualizam a série e a legenda sem manter uma closure antiga', () => {
  const view = render(page()); const previousBar = state.options.get('Valor por Região de Destino');
  state.data = { ...state.data!, graficos: { ...state.data!.graficos,
    statusDistribuicao: [{ status: 'Em entrega', total: 80, valorFrete: 40000 }] } };
  view.rerender(page());
  const option = state.options.get('Distribuição de Status')!;
  expect(option.series).toEqual([expect.objectContaining({ data: [expect.objectContaining({ value: 80 })] })]);
  const legend = option.legend as { formatter: (name: string) => string };
  expect(legend.formatter('Em entrega')).toBe('Em entrega (80)');
  expect(state.options.get('Valor por Região de Destino')).toBe(previousBar);
});

it('a troca de tema atualiza as duas opções e preserva os valores', () => {
  const view = render(page()); const previous = new Map(state.options);
  state.dark = true; view.rerender(page());
  previous.forEach((option, title) => expect(state.options.get(title)).not.toBe(option));
  expect(state.options.get('Distribuição de Status')!.series).toEqual([expect.objectContaining({
    data: [expect.objectContaining({ name: 'Em entrega', value: 30 })],
  })]);
});
