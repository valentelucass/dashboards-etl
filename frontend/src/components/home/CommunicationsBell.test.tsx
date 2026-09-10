// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CommunicationsBell from './CommunicationsBell';
import type { HomeNotice } from '../../types/home';
import { buscarHomeComunicados, registrarLeituraHomeComunicado } from '../../api/endpoints/homeComunicadosServico';

vi.mock('../../config/api', () => ({ HOME_COMUNICADOS_API_ENABLED: true }));
vi.mock('../../api/endpoints/homeComunicadosServico', () => ({
  buscarHomeComunicados: vi.fn(), registrarLeituraHomeComunicado: vi.fn(),
}));

let notices: HomeNotice[];
const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><CommunicationsBell /></QueryClientProvider>);
}
beforeEach(() => {
  vi.resetAllMocks();
  notices = [{ id: '7', title: 'Atualização do portal', body: 'Conteúdo completo do aviso.', tag: 'NOVO', audience: 'Todos',
    date: '10 set. 2026', publishedAt: '2026-09-10T12:00:00Z', unread: true,
    likeCount: 0, commentCount: 0, likedBy: [], likedByCurrentUser: false }];
  vi.mocked(buscarHomeComunicados).mockImplementation(async () => structuredClone(notices));
  vi.mocked(registrarLeituraHomeComunicado).mockImplementation(async () => { notices[0] = { ...notices[0], unread: false }; });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe('Comunicações na navegação', () => {
  it('mantém o alerta ao abrir e fechar somente o popup', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comunicações: 1 não lida' }));
    await screen.findByText('Atualização do portal');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar comunicações' }));
    expect(registrarLeituraHomeComunicado).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Comunicações: 1 não lida' })).toBeTruthy();
  });

  it('registra a versão aberta e sincroniza o sino após a leitura', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comunicações: 1 não lida' }));
    fireEvent.click(await screen.findByRole('button', { name: /Atualização do portal/ }));
    expect(await screen.findByText('Conteúdo completo do aviso.')).toBeTruthy();
    await waitFor(() => expect(registrarLeituraHomeComunicado).toHaveBeenCalledWith(expect.objectContaining({ id: '7', publishedAt: '2026-09-10T12:00:00Z' }), expect.anything()));
    await screen.findByText('Você está em dia');
  });

  it('preserva o alerta quando uma edição chega durante a leitura', async () => {
    vi.mocked(registrarLeituraHomeComunicado).mockImplementation(async () => {
      notices[0] = { ...notices[0], updatedAt: '2026-09-10T13:00:00Z', body: 'Conteúdo revisado.', unread: true };
    });
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comunicações: 1 não lida' }));
    fireEvent.click(await screen.findByRole('button', { name: /Atualização do portal/ }));
    await screen.findByText('Conteúdo revisado.');
    expect(screen.getByRole('button', { name: 'Comunicações: 1 não lida' })).toBeTruthy();
  });

  it('não apaga o alerta se o registro da leitura falhar', async () => {
    vi.mocked(registrarLeituraHomeComunicado).mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Comunicações: 1 não lida' }));
    fireEvent.click(await screen.findByRole('button', { name: /Atualização do portal/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível registrar');
    expect(screen.getByRole('button', { name: 'Comunicações: 1 não lida' })).toBeTruthy();
  });

  it('exibe falha da consulta sem inventar comunicados', async () => {
    vi.mocked(buscarHomeComunicados).mockRejectedValue(new Error('offline'));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Comunicações' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível atualizar');
    expect(screen.queryByText('Atualização do portal')).toBeNull();
  });
});
