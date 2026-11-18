// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import clienteAxios from '../api/clienteAxios';
import IntegracoesPage from './IntegracoesPage';

vi.mock('../api/clienteAxios', () => ({ default: { get: vi.fn() } }));
vi.mock('../contexts/FiltroContext', () => ({ useFiltro: () => ({ dataInicio: '2026-10-01', dataFim: '2026-10-05' }) }));
vi.mock('../contexts/PageHeaderContext', () => ({ usePageHeader: vi.fn() }));
vi.mock('../components/shared/DateRangePicker', () => ({ default: () => null }));
vi.mock('../components/charts/useEchartsTheme', () => ({ useEchartsTheme: () => ({ isDark: false }) }));
vi.mock('../components/charts/ChartWrapper', () => ({ default: ({ titulo }: { titulo: string }) => <section aria-label={titulo} /> }));

let client: QueryClient;
const auditoria = (destino: string) => ({ geradoEm: '2026-10-05T14:00:00', metricasConsolidadas: [],
  pendencias: { itens: [{ id: 1, sistemaDestino: destino, numeroNf: 987654, statusDados: 'ERRO_DESTINO' }],
    paginacao: { pagina: 0, tamanho: 10, totalElementos: 21, totalPaginas: 3, primeiraPagina: true, ultimaPagina: false } },
});
function preparar(respostaAuditoria = auditoria) {
  vi.mocked(clienteAxios.get).mockImplementation(async (url, config) => {
    const params = config?.params as URLSearchParams | undefined;
    if (url === '/api/painel/integracoes') return { data: respostaAuditoria(params?.get('destino') || 'VEDACIT') };
    if (url.endsWith('/clientes')) return { data: [] };
    if (url.endsWith('/execucoes')) return { data: { itens: [], paginacao: { totalElementos: 0 } } };
    return { data: { versao: 3, dataInicial: '2026-10-01', dataFinal: '2026-10-05', escopoTransmissoes: 'VEDACIT',
      historicoDesde: null, etapas: [], evolucao: [], atividade: [] } };
  });
}
function abrir() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><QueryClientProvider client={client}><IntegracoesPage /></QueryClientProvider></MemoryRouter>);
}
afterEach(() => { cleanup(); client?.clear(); vi.resetAllMocks(); });

it('o filtro global SELIA alcança os ciclos, indicadores e documentos e reinicia a paginação', async () => {
  preparar(); abrir();
  await screen.findByRole('cell', { name: 'VEDACIT' });
  fireEvent.click(screen.getByRole('button', { name: 'Proxima' }));
  await waitFor(() => expect(vi.mocked(clienteAxios.get).mock.calls.some(([url, config]) =>
    url === '/api/painel/integracoes' && (config?.params as URLSearchParams).get('pagina') === '1')).toBe(true));
  fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar por integração' })).getByRole('button', { name: 'SELIA' }));
  await screen.findByRole('cell', { name: 'SELIA' });
  expect(screen.queryByRole('cell', { name: 'VEDACIT' })).toBeNull();
  expect(screen.getAllByRole('columnheader', { name: /Data AddEvents/ }).length).toBeGreaterThan(0);
  expect(screen.getByText('Eventos AddEvents confirmados')).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Ciclos de integração · SELIA' })).toBeTruthy();
  const chamadas = vi.mocked(clienteAxios.get).mock.calls;
  for (const rota of ['/api/painel/integracoes', '/api/painel/integracoes/indicadores-operacionais']) {
    const params = chamadas.filter(([url]) => url === rota).at(-1)?.[1]?.params as URLSearchParams;
    expect(params.get('destino')).toBe('SELIA');
    if (rota === '/api/painel/integracoes') expect(params.get('pagina')).toBe('0');
  }
  const ciclos = chamadas.filter(([url]) => url.endsWith('/execucoes')).at(-1)?.[1]?.params as URLSearchParams;
  expect(ciclos.get('cliente')).toBe('SELIA');
});

it('não mantém documentos Vedacit enquanto carrega SELIA', async () => {
  preparar(); abrir();
  await screen.findByRole('cell', { name: 'VEDACIT' });
  vi.mocked(clienteAxios.get).mockImplementation(() => new Promise(() => {}));
  fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar por integração' })).getByRole('button', { name: 'SELIA' }));
  expect(screen.queryByRole('cell', { name: 'VEDACIT' })).toBeNull();
  expect(screen.queryByText(/O Satélite retornou destinos/)).toBeNull();
});

it('oculta documentos de outro cliente mesmo quando as métricas da resposta estão vazias', async () => {
  preparar(() => auditoria('VEDACIT')); abrir();
  await screen.findByRole('cell', { name: 'VEDACIT' });
  fireEvent.click(within(screen.getByRole('group', { name: 'Filtrar por integração' })).getByRole('button', { name: 'SELIA' }));
  await screen.findByText(/O Satélite retornou destinos/);
  expect(screen.queryByRole('cell', { name: 'VEDACIT' })).toBeNull();
});
