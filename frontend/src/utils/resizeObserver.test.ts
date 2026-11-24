// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

it('mantém o observador nativo quando o navegador o oferece', async () => {
  const nativo = vi.fn();
  vi.stubGlobal('ResizeObserver', nativo);
  await import('./resizeObserver');
  expect(window.ResizeObserver).toBe(nativo);
});

it('permite montar e desmontar um gráfico quando o navegador não oferece o observador', async () => {
  vi.stubGlobal('ResizeObserver', undefined);
  await import('./resizeObserver');
  const alvo = document.createElement('div');
  const observador = new ResizeObserver(() => {});
  observador.observe(alvo);
  observador.unobserve(alvo);
  observador.disconnect();
});
