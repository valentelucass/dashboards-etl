import { describe, expect, it } from 'vitest';
import { rememberedDashboardHref, rememberDashboardSearch } from './dashboardNavigation';

describe('retorno pelo menu', () => {
  it('lembra período e filtros sem transportar filtros para outra página', () => {
    const entries = rememberDashboardSearch([], '/coletas', '?dataInicio=2026-08-01&f.filiais=CWB');
    expect(rememberedDashboardHref(entries, '/coletas')).toBe('/coletas?dataInicio=2026-08-01&f.filiais=CWB');
    expect(rememberedDashboardHref(entries, '/cotacoes')).toBe('/cotacoes');
    expect(rememberedDashboardHref(rememberDashboardSearch(entries, '/coletas', ''), '/coletas')).toBe('/coletas');
  });
  it('mantém somente cinco páginas e não guarda navegação de autenticação ou administração', () => {
    let entries = rememberDashboardSearch([], '/coletas', '?f.filiais=CWB');
    for (const route of ['tracking', 'cotacoes', 'performance', 'manifestos', 'executivo']) {
      entries = rememberDashboardSearch(entries, `/${route}`, '');
    }
    expect(entries).toHaveLength(5);
    expect(entries.some(entry => entry.path === '/coletas')).toBe(false);
    expect(rememberDashboardSearch(entries, '/login', '?token=x')).toBe(entries);
    expect(rememberDashboardSearch(entries, '/admin/usuarios', '?busca=x')).toBe(entries);
  });
});
