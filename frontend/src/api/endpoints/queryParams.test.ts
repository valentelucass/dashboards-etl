import { describe, expect, it } from 'vitest';
import { montarQueryParams } from './queryParams';

describe('parâmetros de filtros enviados à API', () => {
  const dates = { dataInicio: '2026-09-01', dataFim: '2026-09-10' };
  it('preserva multisseleção, acentos e caracteres reservados em um único valor', () => {
    const params = montarQueryParams({ ...dates, clientes: ['João & Filhos', 'A=B?f.filiais=SPO'], filiais: ['CWB', 'SPO'] });
    const decoded = new URLSearchParams(params.toString());
    expect(decoded.getAll('f.clientes')).toEqual(['João & Filhos', 'A=B?f.filiais=SPO']);
    expect(decoded.getAll('f.filiais')).toEqual(['CWB', 'SPO']);
    expect(decoded.get('dataInicio')).toBe(dates.dataInicio);
  });
  it('ignora campos ausentes e arrays vazios sem enviar undefined ou null', () => {
    expect(montarQueryParams({ ...dates, filiais: [], clientes: undefined, status: null, busca: ' ' }).toString())
      .toBe('dataInicio=2026-09-01&dataFim=2026-09-10');
  });
  it('preserva zero e falso em filtros escalares', () => {
    const params = montarQueryParams({ ...dates, quantidade: 0, ativo: false });
    expect(params.get('f.quantidade')).toBe('0');
    expect(params.get('f.ativo')).toBe('false');
  });
});
