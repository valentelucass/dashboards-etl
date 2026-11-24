// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import DashboardPageBoundary from '../components/layout/DashboardPageBoundary';
import { FiltroProvider } from '../contexts/FiltroContext';
import { PageHeaderProvider } from '../contexts/PageHeaderContext';
import IndicadoresGestaoAVistaPage from './IndicadoresGestaoAVistaPage';

const get = vi.hoisted(() => vi.fn());
vi.mock('../api/clienteAxios', () => ({ default: { get } }));
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ canAccess: () => false }) }));

const metas = { delivery_performance: 91, collector_usage: 89, cargo_cubage: 86, cargo_indemnity: 2, cutoff_time: 98 };
const periodo = '/indicadores-gestao-a-vista?dataInicio=2026-11-01&dataFim=2026-11-23&f.filiais=CWB';
const erroDaPagina = 'Não foi possível exibir esta página.';
const mensagemGrafico = 'Não foi possível ler os dados deste indicador.';
let cliente: QueryClient;

beforeEach(() => {
  cliente = new QueryClient({ defaultOptions: { queries: { retryDelay: 1 } } });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
});
afterEach(() => { cleanup(); cliente.clear(); get.mockReset(); vi.unstubAllGlobals(); });

function abrir(metasEfetivas: Promise<unknown>, serie = { status: 200, data: [] as unknown }) {
  get.mockImplementation(async (url: string) => {
    if (url.endsWith('/effective')) return { data: await metasEfetivas, status: 200 };
    if (url.endsWith('/overrides')) return { data: { overrides: [] }, status: 200 };
    if (url.endsWith('/filiais')) return { data: ['CWB'], status: 200 };
    if (url.endsWith('/performance-entrega/overview')) {
      return { data: { totalEntregas: 10, finalizadas: 10, entregasNoPrazo: 9, entregasForaDoPrazo: 1, pctNoPrazo: 90 }, status: 200 };
    }
    if (url.endsWith('/horarios-corte/overview')) return { data: { saidasNoHorario: 3, totalProgramado: 4, pctNoHorario: 75 }, status: 200 };
    if (url.endsWith('/performance-entrega/serie')) return serie;
    return { data: url.endsWith('/overview') ? {} : [], status: 200 };
  });
  render(<MemoryRouter initialEntries={[periodo]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <QueryClientProvider client={cliente}><FiltroProvider><PageHeaderProvider>
      <DashboardPageBoundary><IndicadoresGestaoAVistaPage /></DashboardPageBoundary>
    </PageHeaderProvider></FiltroProvider></QueryClientProvider>
  </MemoryRouter>);
}

function cartao(titulo: string) {
  const placar = screen.getByRole('group', { name: 'Resultados dos indicadores de gestão' });
  return within(placar).getByRole('heading', { name: titulo }).closest('article')!;
}

it.each([
  { nome: 'meta individual ausente', resposta: { goals: { delivery_performance: 91 } }, metaFrete: 'Meta 91%' },
  { nome: 'resposta sem mapa de metas', resposta: {}, metaFrete: 'Meta indisponível' },
])('preserva os cinco cartões quando chega a $nome para uma filial de consulta', async ({ resposta, metaFrete }) => {
  let concluir!: (resposta: unknown) => void;
  abrir(new Promise(resolve => { concluir = resolve; }));
  expect(screen.getByRole('group', { name: 'Resultados dos indicadores de gestão' })).toBeTruthy();
  await waitFor(() => expect(cartao('Performance').textContent).toContain('90,00%'));
  expect(cartao('Horários de Corte').textContent).toContain('75,0%');
  expect(cartao('Performance').textContent).not.toContain('Meta 95%');
  await act(async () => { concluir(resposta); });
  await waitFor(() => expect(cartao('Horários de Corte').textContent).toContain('Meta indisponível'));
  expect(cartao('Horários de Corte').textContent).toContain('75,0%');
  expect(cartao('Horários de Corte').textContent).not.toContain('Meta 98%');
  expect(cartao('Performance').textContent).toContain(metaFrete);
  expect(cartao('Performance').textContent).toContain('90,00%');
  expect(screen.getByRole('group', { name: 'Resultados dos indicadores de gestão' }).querySelectorAll('article')).toHaveLength(5);
  expect(screen.queryByText(erroDaPagina)).toBeNull();
});

it.each([
  { nome: 'sem conteúdo', status: 204, data: '', mensagem: 'Sem dados para o período selecionado.' },
  { nome: 'HTML no lugar de dados', status: 200, data: '<html>Indisponível</html>', mensagem: mensagemGrafico },
  { nome: 'linha inválida', status: 200, data: [null], mensagem: mensagemGrafico },
])('mantém a página quando a série de performance recebe $nome', async ({ status, data, mensagem }) => {
  abrir(Promise.resolve({ goals: metas }), { status, data });
  const performance = screen.getByRole('heading', { level: 2, name: 'Performance' }).closest('section')!;
  await waitFor(() => expect(within(performance).getByText(mensagem)).toBeTruthy());
  expect(cartao('Performance').textContent).toContain('90,00%');
  expect(cartao('Horários de Corte').textContent).toContain('Meta 98%');
  expect(screen.queryByText(erroDaPagina)).toBeNull();
});
