import { expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import { buscarTrackingDashboard, buscarTrackingDetalhesPaginada, buscarTrackingFretes, buscarTrackingRegioes } from './trackingServico';

vi.mock('../clienteAxios', () => ({ default: { get: vi.fn() } }));

it('leva a minuta e a filial às quatro consultas e solicita a segunda página nos três detalhamentos', async () => {
  const get = vi.mocked(clienteAxios.get);
  get.mockResolvedValue({ data: { conteudo: [], totalElementos: 20, totalPaginas: 2, paginaAtual: 2, tamanhoPagina: 10 } });
  const filtro = { dataInicio: '2026-11-01', dataFim: '2026-11-19', filialAtual: ['AGU'], numeroMinuta: '491699', classificacoes: ['Fracionado', 'Lotação'] };
  await buscarTrackingDashboard(filtro);
  await buscarTrackingRegioes(filtro, 'AGU', 2, 10);
  await buscarTrackingFretes(filtro, 'AGU', 'BAURU', 2, 10);
  await buscarTrackingDetalhesPaginada(filtro, 2, 10);
  const parametros = get.mock.calls.map(([, config]) => config?.params as URLSearchParams);
  for (const params of parametros) {
    expect(params.get('f.numeroMinuta')).toBe('491699');
    expect(params.get('f.filialAtual')).toBe('AGU');
    expect(params.getAll('f.classificacoes')).toEqual(['Fracionado', 'Lotação']);
  }
  expect(parametros.slice(1).map(params => params.get('page'))).toEqual(['2', '2', '2']);
  expect(parametros[2].get('f.siglaResponsavel')).toBe('AGU');
  expect(parametros[2].get('f.regiaoDestino')).toBe('BAURU');
});
