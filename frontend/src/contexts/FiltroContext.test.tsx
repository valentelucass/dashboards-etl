// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FiltroProvider, useFiltro } from './FiltroContext';

afterEach(() => { cleanup(); vi.useRealTimers(); });

function mount(path: string) {
  return renderHook(() => ({ filtro: useFiltro(), navigate: useNavigate(), location: useLocation() }), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><FiltroProvider>{children}</FiltroProvider></MemoryRouter>,
  });
}

describe('período inicial e memória de navegação', () => {
  it.each(['/executivo', '/etl-saude'])('%s respeita datas explícitas desde a primeira renderização e ao retornar', path => {
    const hook = mount(`${path}?dataInicio=2026-08-01&dataFim=2026-08-30&f.filiais=CWB`);
    expect(hook.result.current.filtro).toMatchObject({ dataInicio: '2026-08-01', dataFim: '2026-08-30', filtros: { filiais: ['CWB'] } });
    act(() => hook.result.current.filtro.setDataRange('2026-07-01', '2026-07-31'));
    act(() => hook.result.current.navigate('/coletas'));
    const href = hook.result.current.filtro.obterLinkPainel(path);
    expect(href).toContain('dataInicio=2026-07-01');
    act(() => hook.result.current.navigate(href));
    expect(hook.result.current.location.pathname).toBe(path);
    expect(hook.result.current.filtro).toMatchObject({ dataInicio: '2026-07-01', dataFim: '2026-07-31', filtros: { filiais: ['CWB'] } });
  });

  it.each(['/executivo', '/etl-saude'])('%s resolve o padrão de 180 dias antes de montar consumidores', path => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 10, 12));
    const hook = mount(path);
    expect(hook.result.current.filtro).toMatchObject({ dataInicio: '2026-03-14', dataFim: '2026-09-10' });
    expect(hook.result.current.location.search).toBe('');
  });
});
