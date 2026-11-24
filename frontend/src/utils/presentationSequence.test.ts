import { describe, expect, it } from 'vitest';
import { destinoApresentacao, filterPresentationPages } from './presentationSequence';

describe('destinoApresentacao', () => {
  it('leva o período atual e mantém as seleções próprias do relatório de destino', () => {
    const href = destinoApresentacao('/coletas?dataInicio=2026-11-01&f.cidades=Agudos&f.cidades=Bauru', '2026-10-01', '2026-10-31');
    const url = new URL(href, 'https://example.test');
    expect(url.pathname).toBe('/coletas');
    expect(url.searchParams.getAll('dataInicio')).toEqual(['2026-10-01']);
    expect(url.searchParams.get('dataFim')).toBe('2026-10-31');
    expect(url.searchParams.getAll('f.cidades')).toEqual(['Agudos', 'Bauru']);
  });
});

describe('filterPresentationPages', () => {
  it('mantém a ordem padrão para um usuário com todas as permissões', () => {
    expect(filterPresentationPages(() => true).map((page) => page.id)).toEqual([
      'faturamento', 'cotacoes', 'coletas', 'performance', 'manifestos', 'indicadores-gestao-a-vista',
    ]);
  });

  it('remove Cotações sem criar lacuna quando a permissão é negada', () => {
    expect(filterPresentationPages((permission) => permission !== 'cotacoes').map((page) => page.id)).toEqual([
      'faturamento', 'coletas', 'performance', 'manifestos', 'indicadores-gestao-a-vista',
    ]);
  });
});
