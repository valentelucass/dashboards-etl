// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { EChartsOption } from 'echarts';
import * as api from '../api/endpoints/redeCredenciadaServico';
import DashboardRouteLoading from '../components/layout/DashboardRouteLoading';
import { formatAxis, readDashboardChart } from '../components/charts/dashboardChartData';
import { FiltroProvider } from '../contexts/FiltroContext';
import { PageHeaderProvider } from '../contexts/PageHeaderContext';
import RedeCredenciadaPage from './RedeCredenciadaPage';

const graficos = vi.hoisted(() => new Map<string, EChartsOption>());
vi.mock('../components/charts/ChartWrapper', async importOriginal => {
  const {default: Chart} = await importOriginal<typeof import('../components/charts/ChartWrapper')>();
  return {default: (props: ComponentProps<typeof Chart>) => {
    if (props.chartKey) graficos.set(props.chartKey, props.option);
    return <Chart {...props} />;
  }};
});
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class {
    private atualiza: ResizeObserverCallback;
    constructor(atualiza: ResizeObserverCallback) { this.atualiza = atualiza; }
    observe(target: Element) {
      this.atualiza([{target, contentRect: {width: 600, height: 350}} as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
    disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function abrir(query: string) {
  const entrada = '/rede-credenciada?dataInicio=2026-11-01&dataFim=2026-11-21' + query;
  return render(<MemoryRouter initialEntries={[entrada]} future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
    <QueryClientProvider client={new QueryClient()}><FiltroProvider><PageHeaderProvider>
      <RedeCredenciadaPage />
    </PageHeaderProvider></FiltroProvider></QueryClientProvider>
  </MemoryRouter>);
}

function cartao(nome: string) {
  return screen.getByText(nome, {exact: true}).closest('.dashboard-kpi-card')?.textContent ?? '';
}

function fontes() {
  const desempenho = vi.spyOn(api, 'buscarDesempenhoRede').mockResolvedValue([
    {filial: 'Parceiro A', otif: 100, efd: 50, otifNoPrazo: 1, otifTotal: 1, efdEficientes: 1, efdTotal: 2},
    {filial: 'Parceiro B', otif: 0, efd: null, otifNoPrazo: 0, otifTotal: 3, efdEficientes: 0, efdTotal: 0},
  ]);
  const operacao = vi.spyOn(api, 'buscarOperacaoRede').mockResolvedValue({
    coberturaArquivos: {completa: false, diasCobertos: 4, diasSolicitados: 21},
    entregas: [{data: '2026-11-14', parceiro: 'Parceiro A', finalizadas: 3, anexadas: 0, arquivadas: null}],
    coletas: [],
  });
  const custos = vi.spyOn(api, 'buscarCustosRede').mockImplementation(async (_, parceiros, situacoes) => {
    const cobradoCentavos = situacoes.length ? 300 : 900;
    const calculadoCentavos = 100;
    const comum = {consolidacoes: 1, cobradoCentavos, calculadoCentavos, semCobrado: 0, semCalculado: 0, calculadoZero: 0};
    return {diasCobertos: 21, diasSolicitados: 21,
      linhas: [{...comum, dia: '2026-11-14', status: 'Liberada', parceiro: parceiros[0] ?? 'Parceiro A'}],
      totais: {...comum, cobradoVinculadoCentavos: cobradoCentavos, freteVinculadoCentavos: 1000, fretesVinculados: 1, consolidacoesSemFrete: 0}};
  });
  return {operacao, desempenho, custos};
}

it('reserva os nove cartões desde a abertura da rota', () => {
  const {container} = render(<MemoryRouter initialEntries={['/rede-credenciada/']} future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
    <DashboardRouteLoading />
  </MemoryRouter>);
  expect(screen.getByRole('status', {name: 'Carregando página'})).toBeTruthy();
  expect(container.querySelectorAll('.rede-kpis > .dashboard-loading-card')).toHaveLength(9);
});

it('mantém o desenho dos nove cartões até receber os custos do filtro selecionado', async () => {
  const {custos} = fontes();
  const lerCustos = custos.getMockImplementation()!;
  let liberar!: () => void;
  const aguardando = new Promise<void>(resolve => { liberar = resolve; });
  custos.mockImplementation(async (...args) => {
    if (args[2].length) await aguardando;
    return lerCustos(...args);
  });
  const {container} = abrir('&f.situacoesConsolidacao=Liberada');
  await waitFor(() => expect(custos).toHaveBeenCalledTimes(2));
  const aviso = {name: 'Carregando Rede Credenciada'};
  expect(screen.getByRole('status', aviso).getAttribute('aria-busy')).toBe('true');
  expect(container.querySelectorAll('.rede-kpis > .dashboard-loading-card')).toHaveLength(9);
  expect(container.querySelector('.rede-kpis .dashboard-kpi-card')).toBeNull();
  await act(async () => { liberar(); });
  await waitFor(() => expect(cartao('Valor cobrado pelo parceiro')).toContain('3,00'));
  expect(cartao('OTIF · Entregas no prazo')).toContain('25,00%');
  expect(screen.queryByRole('status', aviso)).toBeNull();
  expect(container.querySelectorAll('.rede-kpis .dashboard-kpi-card')).toHaveLength(9);
});

it('a situação altera apenas os custos e o denominador financeiro vem da consulta filtrada', async () => {
  const {operacao, desempenho, custos} = fontes();
  abrir('&f.situacoesConsolidacao=Liberada');
  await waitFor(() => expect(cartao('Frete da rede sobre o frete Rodogarcia')).toContain('30,00%'));
  expect(cartao('OTIF · Entregas no prazo')).toContain('25,00%');
  expect(cartao('Comprovantes anexados')).toContain('0,00%');
  expect(cartao('Comprovantes arquivados')).toContain('Parcial de 4 de 21 dias publicados');
  fireEvent.click(screen.getByRole('button', {name: /Filtros/}));
  fireEvent.click(screen.getByRole('button', {name: 'Remover filtro Situação da consolidação'}));
  await waitFor(() => expect(cartao('Frete da rede sobre o frete Rodogarcia')).toContain('90,00%'));
  expect(cartao('OTIF · Entregas no prazo')).toContain('25,00%');
  expect(desempenho).toHaveBeenCalledTimes(1);
  expect(operacao).toHaveBeenCalledTimes(1);
  expect(custos).toHaveBeenCalledTimes(2);
});

it('renderiza valores, gráfico e comprovantes dos dias publicados enquanto o último dia está pendente', async () => {
  const {custos, operacao} = fontes();
  const lerCustos = custos.getMockImplementation()!;
  custos.mockImplementation(async (...args) => ({...await lerCustos(...args), diasCobertos: 20, diasSolicitados: 21}));
  operacao.mockResolvedValue({coberturaArquivos: {diasCobertos: 20, diasSolicitados: 21, completa: false},
    entregas: [{data:'2026-11-14', parceiro:'Parceiro A', finalizadas:4, anexadas:4, arquivadas:3}], coletas: []});
  abrir('');
  await waitFor(() => expect(cartao('Valor cobrado pelo parceiro')).toMatch(/9,00/));
  expect(cartao('Valor cobrado pelo parceiro')).toContain('Parcial de 20 de 21 dias publicados');
  expect(cartao('Comprovantes arquivados')).toContain('75,00%');
  expect(readDashboardChart(graficos.get('redeCustosDiarios')!).rows).toHaveLength(1);
});

it('a seleção de parceiro aplica os pesos e mantém sem medição onde a fonte não incluiu o parceiro', async () => {
  const {custos} = fontes();
  abrir('&f.parceirosRede=Parceiro+B');
  await waitFor(() => expect(cartao('OTIF · Entregas no prazo')).toContain('0,00%'));
  expect(cartao('EFD · Eficiência de destino')).toContain('—');
  expect(cartao('Comprovantes anexados')).toContain('Sem entregas finalizadas');
  expect(custos).toHaveBeenCalledWith(expect.objectContaining({dataInicio: '2026-11-01'}), ['Parceiro B'], [], expect.any(AbortSignal));
});

it('abrevia nomes e datas no eixo e preserva o nome e data completos ao consultar a barra', async () => {
  const {desempenho} = fontes();
  const nome = 'ARA - CARDOSO TRANSPORTES | PARCEIRO ARAÇATUBA';
  desempenho.mockResolvedValue([{filial: nome, otif: 100, efd: 50, otifNoPrazo: 1, otifTotal: 1, efdEficientes: 1, efdTotal: 2}]);
  abrir('');
  await waitFor(() => expect(cartao('Diferença total')).toContain('8,00'));
  const ranking = readDashboardChart(graficos.get('redeRankingOtif')!);
  const dia = readDashboardChart(graficos.get('redeCustosDiarios')!);
  expect(screen.getAllByText('ARA · CARDOSO').length).toBeGreaterThan(0);
  expect(ranking.rows[0].name).toBe(nome);
  expect(formatAxis(ranking.category, 0)).toBe('0');
  expect(formatAxis(ranking.category, 100)).toBe('100');
  expect(formatAxis(ranking.category, nome)).toBe('ARA · CARDOSO');
  expect(dia.rows[0].name).toBe('14/11/2026');
  expect(formatAxis(dia.category, dia.rows[0].name)).toBe('14/11');
  const texto = ranking.config.tooltip?.formatter;
  expect(typeof texto === 'function' && texto([{name: nome, value: 100, seriesName: 'OTIF'}])).toContain(nome);
});
