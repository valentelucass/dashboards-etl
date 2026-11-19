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
