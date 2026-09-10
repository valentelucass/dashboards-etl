import { describe, expect, it } from 'vitest';
import { performanceHistoricoQueryKey } from './usePerformance';

describe('performanceHistoricoQueryKey', () => {
  it('isola o histórico quando muda o parceiro logístico', () => {
    const filtro = { dataInicio: '2026-08-01', dataFim: '2026-08-31' };
    expect(performanceHistoricoQueryKey({ ...filtro, parceirosLogisticos: ['A'] }, 3))
      .not.toEqual(performanceHistoricoQueryKey({ ...filtro, parceirosLogisticos: ['B'] }, 3));
  });
  it('inclui periodo e datas para invalidar cache ao trocar dropdown', () => {
    const key3Meses = performanceHistoricoQueryKey({
      dataInicio: '2026-03-01',
      dataFim: '2026-05-25',
      filiais: ['SPO'],
      pagadores: ['Cliente A'],
    }, 3);

    const key6Meses = performanceHistoricoQueryKey({
      dataInicio: '2025-12-01',
      dataFim: '2026-05-25',
      filiais: ['SPO'],
      pagadores: ['Cliente B'],
    }, 6);

    expect(key3Meses).not.toEqual(key6Meses);
    expect(key3Meses).toEqual(expect.arrayContaining(['historico', 3, '2026-03-01', '2026-05-25']));
    expect(key6Meses).toEqual(expect.arrayContaining(['historico', 6, '2025-12-01', '2026-05-25']));
    expect(key3Meses).toContainEqual(['Cliente A']);
    expect(key6Meses).toContainEqual(['Cliente B']);
  });
});
