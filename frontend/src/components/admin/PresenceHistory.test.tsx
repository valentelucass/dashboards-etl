// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import PresenceHistory from './PresenceHistory';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../api/clienteAxios', () => ({ default: { get } }));
afterEach(() => { cleanup(); get.mockReset(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><PresenceHistory usuarioId="7" nome="Pessoa de teste"><span>Pessoa</span></PresenceHistory></QueryClientProvider>);
  return client;
}
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
it('consulta sob demanda no clique, mostra páginas consolidadas e pagina no servidor', async () => {
  get.mockResolvedValue({ data: { agrupamento: 'PAGINA', segundosTotal: 600, atualizadoEm: null, dia: hoje(), total: 11, visitas: [{ ordem: 10, rota: '/cotacoes', inicio: '2026-09-10T12:00:00Z', fim: '2026-09-10T12:02:00Z', segundos: 120 }] } });
  setup(); expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  expect(await screen.findByText('2min 0s')).toBeTruthy();
  expect(screen.getByText('Cotações')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/admin/acesso/usuarios/7/navegacao-dia', expect.objectContaining({ params: { pagina: 1 } })));
});
it('não apresenta visitas de outro dia nem transforma erro em lista vazia', async () => {
  get.mockResolvedValueOnce({ data: { agrupamento: 'PAGINA', segundosTotal: 600, atualizadoEm: null, dia: '2000-01-01', total: 1, visitas: [{ ordem: 0, rota: '/coletas', inicio: '2000-01-01T12:00:00Z', fim: '2000-01-01T12:01:00Z', segundos: 60 }] } });
  setup(); fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('Nenhum acesso registrado hoje.')).toBeTruthy();
  expect(screen.queryByText('Coletas')).toBeNull();
  cleanup(); get.mockRejectedValue(new Error('indisponível')); setup();
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Nenhum acesso registrado hoje.')).toBeNull();
});

it('não abre no hover ou foco, permanece ao mover o mouse e fecha sem reabrir no foco', async () => {
  get.mockResolvedValue({ data: { agrupamento: 'PAGINA', segundosTotal: 600, atualizadoEm: null, dia: hoje(), total: 0, visitas: [] } });
  setup();
  const trigger = screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' });
  fireEvent.mouseEnter(trigger); fireEvent.focus(trigger);
  expect(screen.queryByText('Acessos de hoje')).toBeNull();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(trigger);
  expect(await screen.findByText('Nenhum acesso registrado hoje.')).toBeTruthy();
  fireEvent.mouseLeave(trigger);
  expect(screen.getByText('Acessos de hoje')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Fechar acessos de hoje' }));
  await waitFor(() => expect(screen.queryByText('Acessos de hoje')).toBeNull());
  fireEvent.focus(trigger);
  expect(screen.queryByText('Acessos de hoje')).toBeNull();
  fireEvent.click(trigger);
  expect(await screen.findByText('Acessos de hoje')).toBeTruthy();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Fechar acessos de hoje' }), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByText('Acessos de hoje')).toBeNull());
});

it('não apresenta trechos legados como páginas consolidadas', async () => {
  get.mockResolvedValue({ data: { dia: hoje(), total: 36, visitas: [{ ordem: 1, rota: '/coletas', segundos: 2 }] } });
  setup(); fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByText(/O resumo por página ainda não está disponível/)).toBeTruthy();
  expect(screen.queryByText('Coletas')).toBeNull();
  expect(screen.queryByText('Nenhum acesso registrado hoje.')).toBeNull();
});

it('oculta a lista antiga se a atualização falhar e recupera pela ação de tentar novamente', async () => {
  get.mockResolvedValue({ data: { agrupamento: 'PAGINA', segundosTotal: 49, atualizadoEm: null, dia: hoje(), total: 1, visitas: [{ ordem: 2, rota: '/indicadores-gestao-a-vista', inicio: hoje()+'T19:53:00-03:00', fim: hoje()+'T19:54:00-03:00', segundos: 49, trechos: 2 }] } });
  const client = setup(); fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('Indicadores de Gestão à Vista')).toBeTruthy();
  expect(screen.getByText('Primeiro sinal: 19:53:00')).toBeTruthy();
  expect(screen.getByText('Último sinal: 19:54:00')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Próxima' })).toBeNull();
  get.mockRejectedValueOnce(new Error('rede'));
  await client.invalidateQueries({ queryKey: ['admin', 'acesso', 'navegacao-dia'] });
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Indicadores de Gestão à Vista')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Indicadores de Gestão à Vista')).toBeTruthy();
});
