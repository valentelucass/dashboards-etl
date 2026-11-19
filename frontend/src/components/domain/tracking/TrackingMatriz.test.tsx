// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TrackingMatriz from './TrackingMatriz';
import type { TrackingFiltro } from '../../../types/tracking';

const { regioes, fretes } = vi.hoisted(() => ({ regioes: vi.fn(), fretes: vi.fn() }));
vi.mock('../../../hooks/queries/useTracking', () => ({ useTrackingRegioes: regioes, useTrackingFretes: fretes }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('abre a região e mostra suas NFs sem outro clique; as páginas preservam sigla, região e filtros', () => {
  const filtro: TrackingFiltro = { dataInicio: '2026-11-01', dataFim: '2026-11-19', filialAtual: ['Matriz'], numeroMinuta: '491699' };
  const totais = { totalCargas: 1, pesoTaxado: 1, valorFrete: 1, valorNota: 2, volumes: 3, foraDoPrazo: 0 };
  regioes.mockReturnValue({ data: { conteudo: [{ ...totais, regiaoDestino: 'BAURU' }], totalPaginas: 1 } });
  fretes.mockImplementation((_filtro: TrackingFiltro, _sigla: string, _regiao: string, pagina: number) => ({ data: {
    conteudo: [{ numeroMinuta: pagina === 1 ? 491699 : 492000, numerosNf: pagina === 1 ? ['001', '002', '003'] : [], statusCarga: 'Manifestada', ...totais }],
    totalPaginas: 2,
  } }));

  render(<TrackingMatriz linhas={[{ ...totais, siglaRegiaoDestino: 'AGU', responsavelRegiaoDestino: 'AGU' }]}
    filtro={filtro} status={['No Armazém', 'Finalizadas']} alternarStatus={vi.fn()} carregando={false} erro={null} tentar={vi.fn()} />);
  expect(regioes).not.toHaveBeenCalled();
  const sigla = screen.getByRole('button', { name: 'Responsável AGU' });
  fireEvent.click(sigla);
  expect(sigla.getAttribute('aria-expanded')).toBe('true');
  expect(regioes).toHaveBeenCalledWith(filtro, 'AGU', 1, 10);
  expect(fretes).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Região de destino BAURU' }));
  expect(fretes).toHaveBeenCalledWith(filtro, 'AGU', 'BAURU', 1, 10);
  const notas = screen.getByRole('list', { name: 'Notas fiscais da minuta 491699' });
  expect(within(notas).getAllByRole('listitem').map(nf => nf.textContent)).toEqual(['001', '002', '003']);
  fireEvent.click(screen.getByRole('button', { name: 'Próxima página de fretes de BAURU' }));
  expect(fretes).toHaveBeenLastCalledWith(filtro, 'AGU', 'BAURU', 2, 10);
  expect(screen.getByText('Sem nota fiscal informada.')).toBeTruthy();
  fireEvent.click(sigla);
  expect(screen.queryByRole('article', { name: 'Minuta 492000' })).toBeNull();
});

it('mantém as famílias aprovadas e preserva os tons da região e minuta ao filtrar e trocar de página', () => {
  const totais = { totalCargas: 3, pesoTaxado: 200, valorFrete: 100, valorNota: 500, volumes: 6, foraDoPrazo: 1 };
  const siglas = ['AGU', 'SPO', 'CPQ', 'REC', 'TUP'];
  const grupos = siglas.map(sigla => ({ ...totais, siglaRegiaoDestino: sigla, responsavelRegiaoDestino: sigla }));
  const bauru = 'BAU - AGU - BAURU - POLO';
  const entrada = { linhas: grupos, filtro: { dataInicio: '2026-11-01', dataFim: '2026-11-19' },
    status: [], alternarStatus: vi.fn(), carregando: false, erro: null, tentar: vi.fn() };
  const mostrarRegioes = (ordem: string[]) => regioes.mockReturnValue({ data: {
    conteudo: ordem.map(regiaoDestino => ({ ...totais, regiaoDestino })), totalPaginas: 1,
  } });
  const jau = 'JAU - AGU - PEDERNEIRAS - REGIÃO';
  mostrarRegioes([bauru, jau]);
  fretes.mockImplementation((f: TrackingFiltro, _sigla: string, _regiao: string, pagina: number) => ({ data: {
    conteudo: [{ ...totais, numeroMinuta: f.numeroMinuta || pagina === 2 ? 702 : 701, numerosNf: [], statusCarga: 'Manifestada' }],
    totalPaginas: f.numeroMinuta ? 1 : 2,
  } }));
  const button = (name: string) => screen.getByRole('button', { name });
  const fundo = (elemento: HTMLElement, tipo = 'fechado') => elemento.closest<HTMLElement>('.tracking-linha')!.style.getPropertyValue('--tracking-' + tipo);
  const view = render(<TrackingMatriz {...entrada} />);
  expect(siglas.map(s => fundo(button('Responsável ' + s)))).toEqual([
    'light-dark(#d1e2f3, #314860)', 'light-dark(#c2e2db, #2c504b)', 'light-dark(#ede3f3, #4a4055)',
    'light-dark(#f0e1cf, #564837)', 'light-dark(#f1dfe4, #544048)',
  ]);
  fireEvent.click(button('Responsável AGU'));
  expect(fundo(button('Região de destino ' + bauru), 'aberto')).toBe('light-dark(#dce0f2, #40465e)');
  const porTema = (regiao: string) => fundo(button('Região de destino ' + regiao)).match(/#[0-9a-f]{6}/g)!;
  expect(porTema(jau)[0]).not.toBe(porTema(bauru)[0]);
  expect(porTema(jau)[1]).not.toBe(porTema(bauru)[1]);
  fireEvent.click(button('Região de destino ' + bauru));
  const primeira = fundo(screen.getByRole('article', { name: 'Minuta 701' }));
  fireEvent.click(button('Próxima página de fretes de ' + bauru));
  const segunda = fundo(screen.getByRole('article', { name: 'Minuta 702' }));
  expect(segunda).not.toBe(primeira);
  mostrarRegioes([jau, bauru]);
  view.rerender(<TrackingMatriz {...entrada} key="filtrado" linhas={grupos.slice().reverse()} filtro={{ ...entrada.filtro, numeroMinuta: '702' }} />);
  expect(fundo(button('Responsável AGU'))).toBe('light-dark(#d1e2f3, #314860)');
  fireEvent.click(button('Responsável AGU'));
  expect(fundo(button('Região de destino ' + bauru), 'aberto')).toBe('light-dark(#dce0f2, #40465e)');
  fireEvent.click(button('Região de destino ' + bauru));
  expect(fundo(screen.getByRole('article', { name: 'Minuta 702' }))).toBe(segunda);
});
