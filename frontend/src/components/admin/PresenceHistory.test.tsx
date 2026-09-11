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
}
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
it('consulta sob demanda no clique, mostra duração e pagina no servidor', async () => {
  get.mockResolvedValue({ data: { dia: hoje(), total: 11, visitas: [{ ordem: 10, rota: '/cotacoes', inicio: '2026-09-10T12:00:00Z', fim: '2026-09-10T12:02:00Z', segundos: 120 }] } });
  setup(); expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  expect(await screen.findByText('2min 0s')).toBeTruthy();
  expect(screen.getByText('Cotações')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/admin/acesso/usuarios/7/navegacao-dia', expect.objectContaining({ params: { pagina: 1 } })));
});
it('não apresenta visitas de outro dia nem transforma erro em lista vazia', async () => {
  get.mockResolvedValueOnce({ data: { dia: '2000-01-01', total: 1, visitas: [{ ordem: 0, rota: '/coletas', inicio: '2000-01-01T12:00:00Z', fim: '2000-01-01T12:01:00Z', segundos: 60 }] } });
  setup(); fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByText('Nenhum acesso registrado hoje.')).toBeTruthy();
  expect(screen.queryByText('Coletas')).toBeNull();
  cleanup(); get.mockRejectedValue(new Error('indisponível')); setup();
  fireEvent.click(screen.getByRole('button'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Nenhum acesso registrado hoje.')).toBeNull();
});

it('não abre no hover ou foco, permanece ao mover o mouse e fecha sem reabrir no foco', async () => {
  get.mockResolvedValue({ data: { dia: hoje(), total: 0, visitas: [] } });
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
