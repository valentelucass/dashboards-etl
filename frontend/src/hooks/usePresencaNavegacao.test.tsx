// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import usePresencaNavegacao from './usePresencaNavegacao';

const state = vi.hoisted(() => ({ pathname: '/cotacoes', id: '1', put: vi.fn() }));
vi.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: state.pathname }) }));
vi.mock('../contexts/AutenticacaoContext', () => ({ useAutenticacao: () => ({ usuario: state.id ? { id: state.id } : null }) }));
vi.mock('../api/clienteAxios', () => ({ default: { put: state.put } }));
beforeEach(() => {
  vi.useFakeTimers(); state.pathname = '/cotacoes'; state.id = '1'; state.put.mockReset().mockResolvedValue({});
  vi.spyOn(document, 'hasFocus').mockReturnValue(true);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const tick = async (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it('confirma a página em foco a cada 30 segundos sem enviar filtros ou tempo informado pelo cliente', async () => {
  renderHook(usePresencaNavegacao); await tick(); await tick(30000);
  expect(state.put).toHaveBeenCalledTimes(2);
  expect(state.put.mock.calls[0][1]).toEqual({ rota: '/cotacoes', visivel: true, fluxoId: expect.any(String) });
});

it('encerra o trecho ao perder foco, suspende pulsos ocultos e volta ao recuperar foco', async () => {
  renderHook(usePresencaNavegacao); await tick();
  vi.mocked(document.hasFocus).mockReturnValue(false);
  act(() => window.dispatchEvent(new Event('blur'))); await tick(); await tick(90000);
  expect(state.put).toHaveBeenCalledTimes(2);
  expect(state.put.mock.calls[1][1].visivel).toBe(false);
  vi.mocked(document.hasFocus).mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('focus'))); await tick();
  expect(state.put.mock.calls.at(-1)?.[1].visivel).toBe(true);
});

it('cancela chamadas da rota ou identidade anterior e deixa de registrar após logout', async () => {
  const hook = renderHook(usePresencaNavegacao); await tick();
  const primeiroSignal = state.put.mock.calls[0][2].signal;
  state.pathname = '/coletas'; hook.rerender(); await tick();
  expect(primeiroSignal.aborted).toBe(true);
  expect(state.put.mock.calls.at(-1)?.[1].rota).toBe('/coletas');
  state.id = ''; hook.rerender(); await tick(60000);
  expect(state.put).toHaveBeenCalledTimes(2);
});

it('não registra uma aba inicialmente oculta e retoma depois de falha de rede', async () => {
  vi.mocked(document.hasFocus).mockReturnValue(false);
  renderHook(usePresencaNavegacao); await tick(60000); expect(state.put).not.toHaveBeenCalled();
  state.put.mockRejectedValueOnce(new Error('offline'));
  vi.mocked(document.hasFocus).mockReturnValue(true);
  act(() => window.dispatchEvent(new Event('focus'))); await tick(); await tick(30000);
  expect(state.put).toHaveBeenCalledTimes(2);
});
