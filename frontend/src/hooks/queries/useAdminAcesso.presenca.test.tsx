// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useResumoSessoesUsuariosAdmin } from './useAdminAcesso';

const buscar = vi.hoisted(() => vi.fn());
vi.mock('../../api/endpoints/adminAcessoServico', () => ({ buscarResumoSessoesUsuariosAdmin: buscar }));
let client: QueryClient;
beforeEach(() => {
  vi.useFakeTimers(); buscar.mockReset();
  focusManager.setFocused(true);
  client = new QueryClient({ defaultOptions: { queries: { staleTime: 300000, refetchOnWindowFocus: false, retry: false } } });
  buscar.mockResolvedValue({ usuariosOnline: 1, usuariosOnlineDetalhes: [], usuariosRecentes: [] });
});
afterEach(() => { cleanup(); client.clear(); focusManager.setFocused(undefined); vi.useRealTimers(); });
const tick = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const setup = () => renderHook(useResumoSessoesUsuariosAdmin, {
  wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
});

it('atualiza a cada 15 segundos e ao voltar à aba apesar dos padrões globais de cache', async () => {
  setup(); await tick();
  expect(buscar).toHaveBeenCalledTimes(1);
  await tick(15000);
  expect(buscar).toHaveBeenCalledTimes(2);
  act(() => focusManager.setFocused(false));
  await tick(30000);
  expect(buscar).toHaveBeenCalledTimes(2);
  act(() => focusManager.setFocused(true)); await tick();
  expect(buscar).toHaveBeenCalledTimes(3);
});

it('sinaliza erro após falha do pulso de consulta e recupera ao voltar à aba', async () => {
  const { result } = setup(); await tick();
  buscar.mockRejectedValueOnce(new Error('offline'));
  await tick(15000); await tick(1);
  expect(result.current.isError).toBe(true);
  act(() => focusManager.setFocused(false)); act(() => focusManager.setFocused(true)); await tick(1);
  expect(result.current.isError).toBe(false);
  expect(result.current.data?.usuariosOnline).toBe(1);
});
