// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import ptBR from '@astryxdesign/core/locales/pt-BR.generated.js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import PresenceHistory from './PresenceHistory';
const get = vi.hoisted(() => vi.fn());
vi.mock('../../api/clienteAxios', () => ({ default: { get } }));
afterEach(() => { cleanup(); get.mockReset(); });
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<InternationalizationProvider locale="pt-BR" messages={{ 'pt-BR': ptBR }}>
    <QueryClientProvider client={client}><PresenceHistory usuarioId="7" nome="Pessoa de teste"><span>Pessoa</span></PresenceHistory></QueryClientProvider>
  </InternationalizationProvider>);
  return client;
}
const hoje = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
it('mostra os 14 acessos em grupos de cinco e busca o próximo lote ao passar do décimo', async () => {
  const visitas = Array.from({ length: 14 }, (_, i) => ({ ordem: 14 - i, rota: '/pagina-' + i,
    inicio: hoje() + 'T12:00:00Z', fim: hoje() + 'T12:02:00Z', segundos: 1 + i }));
  get.mockImplementation((_url, { params: { pagina } }) => Promise.resolve({ data: {
    agrupamento: 'PAGINA', segundosTotal: 105, atualizadoEm: null, dia: hoje(), total: 14,
    visitas: visitas.slice(pagina * 10, (pagina + 1) * 10),
  } }));
  setup(); expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  const nav = within(await screen.findByRole('navigation', { name: 'Paginação dos acessos de hoje' }));
  for (let i = 0; i < 3; i++) {
    if (i) fireEvent.click(nav.getByRole('button', { name: 'Ir para a próxima página' }));
    const lista = within(await screen.findByRole('list', { name: 'Páginas acessadas hoje' }));
    expect(lista.getAllByRole('listitem').map(li => li.querySelector('strong')?.textContent))
      .toEqual(visitas.slice(i * 5, (i + 1) * 5).map(v => v.segundos + 's'));
    expect(nav.getByText(`Página ${i + 1} de 3`)).toBeTruthy();
    expect(screen.getByText('1min 45s')).toBeTruthy();
    expect(get).toHaveBeenCalledTimes(i === 2 ? 2 : 1);
  }
  await waitFor(() => expect(get).toHaveBeenLastCalledWith('/api/admin/acesso/usuarios/7/navegacao-dia', expect.objectContaining({ params: { pagina: 1 } })));
  fireEvent.click(nav.getByRole('button', { name: 'Ir para a primeira página' }));
  expect(await screen.findByText('1s')).toBeTruthy();
  fireEvent.click(nav.getByRole('button', { name: 'Ir para a última página' }));
  expect(await screen.findByText('14s')).toBeTruthy();
});
it('não apresenta visitas de outro dia nem transforma erro em lista vazia', async () => {
  get.mockResolvedValueOnce({ data: { agrupamento: 'PAGINA', segundosTotal: 600, atualizadoEm: null, dia: '2000-01-01', total: 1, visitas: [{ ordem: 0, rota: '/coletas', inicio: '2000-01-01T12:00:00Z', fim: '2000-01-01T12:01:00Z', segundos: 60 }] } });
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  expect(await screen.findByText('Nenhum acesso registrado hoje.')).toBeTruthy();
  expect(screen.queryByText('Coletas')).toBeNull();
  cleanup(); get.mockRejectedValue(new Error('indisponível')); setup();
  fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
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
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  expect(await screen.findByText(/O resumo por página ainda não está disponível/)).toBeTruthy();
  expect(screen.queryByText('Coletas')).toBeNull();
  expect(screen.queryByText('Nenhum acesso registrado hoje.')).toBeNull();
});

it('oculta a lista antiga se a atualização falhar e recupera pela ação de tentar novamente', async () => {
  get.mockResolvedValue({ data: { agrupamento: 'PAGINA', segundosTotal: 49, atualizadoEm: null, dia: hoje(), total: 1, visitas: [{ ordem: 2, rota: '/indicadores-gestao-a-vista', inicio: hoje()+'T19:53:00-03:00', fim: hoje()+'T19:54:00-03:00', segundos: 49, trechos: 2 }] } });
  const client = setup(); fireEvent.click(screen.getByRole('button', { name: 'Ver acessos de hoje de Pessoa de teste' }));
  expect(await screen.findByText('Indicadores de Gestão à Vista')).toBeTruthy();
  expect(screen.getByText('Primeiro sinal: 19:53:00')).toBeTruthy();
  expect(screen.getByText('Último sinal: 19:54:00')).toBeTruthy();
  expect(screen.queryByRole('navigation', { name: 'Paginação dos acessos de hoje' })).toBeNull();
  get.mockRejectedValueOnce(new Error('rede'));
  await client.invalidateQueries({ queryKey: ['admin', 'acesso', 'navegacao-dia'] });
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.queryByText('Indicadores de Gestão à Vista')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByText('Indicadores de Gestão à Vista')).toBeTruthy();
});
