// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../api/endpoints/customerService';
import { FiltroProvider } from '../contexts/FiltroContext';
import { FilterHeaderContext } from '../contexts/FilterHeaderContext';
import { PageHeaderProvider } from '../contexts/PageHeaderContext';
import CustomerServicePage from './CustomerServicePage';

const clientes = [{ id: 1, nome: 'Conta Norte' }, { id: 2, nome: 'Conta Sul' }];
const periodo = { dataInicio: '2026-11-01', dataFim: '2026-11-21' };
const operacao: api.OperacaoCliente = {
  totalEntregas: 11, finalizadas: 10, noPrazo: 9, coletasFinalizadas: 0, coletasNoPrazo: 0,
  anexadas: 0, arquivadas: null, pesoRealKg: 2500, valorNf: 4200, valorFrete: 500,
  porStatus: [{ status: 'Finalizada', quantidade: 10 }, { status: 'Em trânsito', quantidade: 1 }],
  evolucao: [{ dia: '2026-11-04', totalEntregas: 11, finalizadas: 10, noPrazo: 9 }],
  avarias: 1, extravios: 1, fretesComAvariaOuExtravio: 1,
  ocorrenciasPorTipo: [{ tipo: 'Avaria parcial', quantidade: 2 }],
};
const financeiro: api.FinanceiroCliente = {
  faturado: 600, pendenteFaturamento: 200, aVencer: 350, emAtraso: 100, pago: 120, semVencimento: 30,
  fretes: 4, fretesFaturados: 3, fretesPendentes: 1, fretesFaturadosSemParcela: 1, dataCorte: periodo.dataFim,
};
beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} unobserve() {} });
  vi.spyOn(api, 'buscarContasCS').mockResolvedValue(clientes);
  vi.spyOn(api, 'buscarOperacaoCS').mockResolvedValue(operacao);
  vi.spyOn(api, 'buscarFinanceiroCS').mockResolvedValue(financeiro);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function PainelComCabecalho() {
  const [toolbar, setToolbar] = useState<HTMLDivElement | null>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  return <FilterHeaderContext.Provider value={{toolbar, panel}}>
    <header><div ref={setToolbar} /><div ref={setPanel} /></header>
    <main><CustomerServicePage /></main>
  </FilterHeaderContext.Provider>;
}

function abrir(query = '') {
  const url = '/customer-service?dataInicio=' + periodo.dataInicio + '&dataFim=' + periodo.dataFim + query;
  return render(<MemoryRouter initialEntries={[url]} future={{v7_startTransition: true, v7_relativeSplatPath: true}}>
    <QueryClientProvider client={new QueryClient()}><FiltroProvider><PageHeaderProvider>
      <PainelComCabecalho />
    </PageHeaderProvider></FiltroProvider></QueryClientProvider>
  </MemoryRouter>);
}

it.each(['', '&f.clienteCS=999', '&f.clienteCS=1&f.clienteCS=2'])('exige uma única conta cadastrada (%s)', async query => {
  abrir(query);
  expect(await screen.findByText('Selecione um cliente para consultar os indicadores.')).toBeTruthy();
  expect(api.buscarOperacaoCS).not.toHaveBeenCalled();
  expect(api.buscarFinanceiroCS).not.toHaveBeenCalled();
  expect(screen.queryByText('Faturado')).toBeNull();
});

it('distingue cadastro pendente de falha na consulta e permite tentar novamente', async () => {
  vi.mocked(api.buscarContasCS).mockRejectedValueOnce(new Error()).mockResolvedValue([]);
  abrir('&f.clienteCS=1');
  fireEvent.click(await screen.findByRole('button', {name: 'Tentar novamente'}));
  await screen.findByText('Nenhum cliente Key Account disponível para a sua conta.');
  expect(api.buscarOperacaoCS).not.toHaveBeenCalled();
  expect(api.buscarFinanceiroCS).not.toHaveBeenCalled();
});

it('aplica cliente e datas às duas consultas e diferencia falta de cobertura de zero', async () => {
  abrir('&f.clienteCS=2');
  await screen.findByText('Fretes com avaria ou extravio');
  for (const fonte of [api.buscarOperacaoCS, api.buscarFinanceiroCS]) {
    expect(fonte).toHaveBeenCalledWith({...periodo, clienteId: 2}, expect.any(AbortSignal));
  }
  expect(screen.getByText('OTIF de entrega').closest('.dashboard-kpi-card')?.textContent).toContain('90,00%');
  expect(screen.getByText('Performance de coleta').closest('.dashboard-kpi-card')?.textContent).toContain('—');
  expect(screen.getByText('Anexados').parentElement?.textContent).toContain('0,00%');
  expect(screen.getByText('Arquivados').parentElement?.textContent).toContain('—');
  expect(screen.getByText('Fretes com avaria ou extravio').parentElement?.textContent).toContain('1');
  expect(screen.getByText('Avaria parcial').closest('tr')?.textContent).toContain('2');
  expect(screen.getByText('Pago').parentElement?.textContent).toContain('120,00');
  expect(screen.getByText('Sem vencimento').parentElement?.textContent).toContain('30,00');
  expect(screen.getByText(/1 frete faturado está sem parcela vinculada/)).toBeTruthy();
});

it('ao trocar de conta retira os números anteriores e ignora uma resposta financeira atrasada', async () => {
  let terminarFinanceiro!: (resposta: api.FinanceiroCliente) => void;
  let terminarOperacao!: (resposta: api.OperacaoCliente) => void;
  vi.mocked(api.buscarFinanceiroCS).mockImplementation(({clienteId}) => clienteId === 1
    ? new Promise(resolve => { terminarFinanceiro = resolve; })
    : Promise.resolve({...financeiro, pago: 888}));
  vi.mocked(api.buscarOperacaoCS).mockImplementation(({clienteId}) => clienteId === 2
    ? new Promise(resolve => { terminarOperacao = resolve; })
    : Promise.resolve(operacao));
  abrir('&f.clienteCS=1');
  await screen.findByText('90,00%');
  fireEvent.click(screen.getByRole('combobox', {name: /Cliente Key Account/}));
  fireEvent.click(await screen.findByRole('option', {name: /Conta Sul/}));
  await screen.findByText(/888,00/);
  expect(screen.queryByText('90,00%')).toBeNull();
  expect(vi.mocked(api.buscarFinanceiroCS).mock.calls[0][1]?.aborted).toBe(true);
  await act(async () => {
    terminarFinanceiro(financeiro);
    terminarOperacao({...operacao, finalizadas: 2, noPrazo: 1});
  });
  expect(await screen.findByText('50,00%')).toBeTruthy();
  expect(screen.getByText('Pago').parentElement?.textContent).toContain('888,00');
});

it('apresenta os três assuntos identificando sempre o cliente e o período', async () => {
  vi.mocked(api.buscarContasCS).mockResolvedValue([...clientes, {id: 3, nome: 'Conta Norte'}]);
  abrir('&f.clienteCS=1');
  await screen.findByText('Faturado');
  const cabecalho = within(screen.getByRole('banner'));
  expect(cabecalho.getByRole('combobox', {name: /Cliente Key Account/}).textContent).toContain('Conta Norte · Conta 1');
  const iniciar = cabecalho.getByRole('button', {name: 'Apresentar cliente'});
  expect(cabecalho.getByRole('button', {name: 'Filtros'})).toBeTruthy();
  expect(within(screen.getByRole('main')).queryByRole('combobox')).toBeNull();
  fireEvent.click(iniciar);
  const slide = await screen.findByRole('dialog', {name: 'Apresentação de Conta Norte'});
  expect(within(slide).getByRole('heading', {name: 'Entregas e coletas'})).toBeTruthy();
  expect(within(slide).queryByText(/Conta Sul|Conta Norte · Conta/)).toBeNull();
  fireEvent.click(within(slide).getByRole('button', {name: 'Próximo'}));
  expect(within(slide).getByRole('heading', {name: 'Comprovantes e ocorrências'})).toBeTruthy();
  fireEvent.keyDown(slide, {key: 'ArrowRight'});
  expect(within(slide).getByRole('heading', {name: 'Financeiro'})).toBeTruthy();
  expect(within(slide).getByText('Conta Norte')).toBeTruthy();
  expect(within(slide).getByText('01/11/2026 a 21/11/2026')).toBeTruthy();
  expect((within(slide).getByRole('button', {name: 'Próximo'}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(document.body, {key: 'ArrowLeft'});
  expect(within(slide).getByRole('heading', {name: 'Comprovantes e ocorrências'})).toBeTruthy();
  fireEvent.keyDown(document.body, {key: 'Home'});
  expect(within(slide).getByText('1 de 3')).toBeTruthy();
  fireEvent.keyDown(document.body, {key: 'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(iniciar));
});
