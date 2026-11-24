// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { recarregarAposPublicacao } from './recarregarAposPublicacao';

const falha = new TypeError('Failed to fetch dynamically imported module: /assets/indicadores.js');
const consultar = vi.fn();
const recarregar = vi.fn();

beforeEach(() => {
  document.documentElement.dataset.dashboardBuildId = 'anterior';
  sessionStorage.clear();
  vi.stubGlobal('fetch', consultar);
  consultar.mockResolvedValue({ ok: true, json: async () => ({ buildId: 'nova' }) });
});

afterEach(() => {
  delete document.documentElement.dataset.dashboardBuildId;
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

it('recupera a rota uma única vez quando o navegador encontra uma versão nova', async () => {
  const signal = new AbortController().signal;
  await Promise.all([1, 2].map(() => recarregarAposPublicacao(falha, signal, recarregar)));
  expect(consultar).toHaveBeenCalledWith('/build-info.json', {cache:'no-store', signal});
  expect(recarregar).toHaveBeenCalledTimes(1);
});

it('preserva o aviso quando o arquivo continua indisponível ou a consulta da versão falha', async () => {
  const signal = new AbortController().signal;
  document.documentElement.dataset.dashboardBuildId = 'nova';
  consultar.mockResolvedValueOnce({ ok: true, json: async () => ({ buildId: 'nova' }) });
  consultar.mockResolvedValueOnce(new Response(null, { status: 404 }));
  await recarregarAposPublicacao(falha, signal, recarregar);
  consultar.mockRejectedValueOnce(new Error('offline'));
  await recarregarAposPublicacao(falha, signal, recarregar);
  expect(recarregar).not.toHaveBeenCalled();
});

it.each([
  ['/assets/indicadores.js', 'text/javascript; charset=utf-8', 'Failed to fetch dynamically imported module: '],
  ['/assets/indicadores.css', 'text/css', 'Unable to preload CSS for '],
])('recupera uma única vez se %s voltou na mesma versão', async (arquivo, tipo, prefixo) => {
  document.documentElement.dataset.dashboardBuildId = 'nova';
  const signal = new AbortController().signal;
  consultar.mockImplementation(async (_url, init) => init.method === 'HEAD'
    ? new Response(null, { headers: { 'content-type': tipo } })
    : { ok: true, json: async () => ({ buildId: 'nova' }) });
  const erro = new TypeError(prefixo + arquivo);
  await Promise.all([1, 2].map(() => recarregarAposPublicacao(erro, signal, recarregar)));
  await recarregarAposPublicacao(erro, signal, recarregar);
  expect(consultar).toHaveBeenCalledWith(arquivo, { method: 'HEAD', cache: 'no-store', signal });
  expect(recarregar).toHaveBeenCalledTimes(1);
});

it('ignora HTML recebido no lugar do módulo e endereços externos', async () => {
  document.documentElement.dataset.dashboardBuildId = 'nova';
  const signal = new AbortController().signal;
  consultar.mockImplementation(async (_url, init) => init.method === 'HEAD'
    ? new Response(null, { headers: { 'content-type':'text/html' } })
    : { ok: true, json: async () => ({ buildId:'nova' }) });
  await recarregarAposPublicacao(falha, signal, recarregar);
  await recarregarAposPublicacao(new TypeError('Failed to fetch dynamically imported module: https://outro.example/assets/painel.js'), signal, recarregar);
  expect(consultar.mock.calls.filter(([, init]) => init.method === 'HEAD')).toHaveLength(1);
  expect(recarregar).not.toHaveBeenCalled();
});

it('preserva a navegação quando a pessoa já saiu da tela ou a falha veio dos dados', async () => {
  const controller = new AbortController();
  await recarregarAposPublicacao(new TypeError('Resposta inválida'), controller.signal, recarregar);
  expect(consultar).not.toHaveBeenCalled();
  const pendente = recarregarAposPublicacao(falha, controller.signal, recarregar);
  controller.abort();
  await pendente;
  expect(recarregar).not.toHaveBeenCalled();
});
