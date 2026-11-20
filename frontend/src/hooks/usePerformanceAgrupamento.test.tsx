// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { usePerformanceAgrupamento } from './usePerformanceAgrupamento';

const filtro = { dataInicio: '2026-11-01', dataFim: '2026-11-19', filiais: ['SPO'] };
afterEach(cleanup);

function montar(url = '/performance?f.filiais=SPO&tabelaCodigo=490001') {
  const wrapper = ({ children }: { children: ReactNode }) =>
    <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{children}</MemoryRouter>;
  return renderHook(() => ({ ...usePerformanceAgrupamento(filtro), busca: useLocation().search }), { wrapper });
}

describe('agrupamento da Performance', () => {
  it('abre qualquer dimensão diretamente sem exigir seleção anterior', () => {
    const { result } = montar();
    act(() => result.current.selecionarNivel('cidade'));
    expect(result.current.parametros).toEqual({ nivel: 'cidade', responsavel: null, regiaoDestino: null });
    expect(result.current.filtroDetalhamento).toEqual({ ...filtro, drillResponsavel: null, drillRegiao: null });
    act(() => result.current.selecionarNivel('regiao'));
    act(() => result.current.abrirGrupo('Zona Norte'));
    expect(result.current.parametros).toEqual({ nivel: 'cidade', responsavel: null, regiaoDestino: 'Zona Norte' });
    expect(result.current.filtroDetalhamento.drillRegiao).toBe('Zona Norte');
    act(() => result.current.voltar());
    expect(result.current.parametros).toEqual({ nivel: 'regiao', responsavel: null, regiaoDestino: null });
  });

  it('compartilha a seleção exata da barra com tabela e exportação e permite voltar ou limpar sem apagar filtros', () => {
    const { result } = montar();
    act(() => result.current.abrirGrupo('chave-responsavel'));
    act(() => result.current.abrirGrupo('Zona Norte'));
    expect(result.current.filtroDetalhamento).toEqual({ ...filtro, drillResponsavel: 'chave-responsavel', drillRegiao: 'Zona Norte' });
    act(() => result.current.voltar());
    expect(result.current.parametros).toEqual({ nivel: 'regiao', responsavel: 'chave-responsavel', regiaoDestino: null });
    act(() => result.current.selecionarNivel('regiao'));
    expect(result.current.filtroDetalhamento).toEqual({ ...filtro, drillResponsavel: null, drillRegiao: null });
    const restantes = new URLSearchParams(result.current.busca);
    expect(restantes.get('f.filiais')).toBe('SPO');
    expect(restantes.get('tabelaCodigo')).toBe('490001');
    expect(restantes.has('drillResponsavel')).toBe(false);
  });

  it('respeita links existentes e descarta seleções que não pertencem ao nível ativo', () => {
    const { result } = montar('/performance?drillNivel=regiao&drillResponsavel=AGU&drillRegiao=antiga');
    expect(result.current.parametros).toEqual({ nivel: 'regiao', responsavel: 'AGU', regiaoDestino: null });
    act(() => result.current.selecionarNivel('cidade'));
    expect(result.current.parametros).toEqual({ nivel: 'cidade', responsavel: null, regiaoDestino: null });
  });
});
