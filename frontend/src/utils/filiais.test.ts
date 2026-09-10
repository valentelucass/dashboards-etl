import { describe, expect, it } from 'vitest';
import { combinarFiliaisParceiros, isParceiroLogistico, separarFiliaisParceiros } from './filiais';

describe('dimensão de filiais e parceiros', () => {
  it.each(['ABC | parceiro', 'ABC | PARCEIRO', 'ABC | Parceiro logístico'])(
    'reconhece marcador sem depender de maiúsculas: %s', (name) => expect(isParceiroLogistico(name)).toBe(true),
  );
  it.each(['CWB - Curitiba', 'Parceiro Comercial', ''])(
    'não infere parceiro sem marcador: %s', (name) => expect(isParceiroLogistico(name)).toBe(false),
  );
  it('separa preservando ordem e sem alterar o catálogo original', () => {
    const names = Object.freeze(['CWB', 'ABC | parceiro', 'SPO', 'XYZ | PARCEIRO']);
    expect(separarFiliaisParceiros(names)).toEqual({ filiaisProprias: ['CWB', 'SPO'], parceirosLogisticos: ['ABC | parceiro', 'XYZ | PARCEIRO'] });
    expect(names).toHaveLength(4);
  });
  it('combina seleção sem duplicar nem perder valores de nenhum grupo', () => {
    expect(combinarFiliaisParceiros(['CWB', 'CWB'], ['ABC | parceiro', 'CWB'])).toEqual(['CWB', 'ABC | parceiro']);
    expect(combinarFiliaisParceiros([], [])).toEqual([]);
  });
});
