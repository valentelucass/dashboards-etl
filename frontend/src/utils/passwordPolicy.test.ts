import { describe, expect, it } from 'vitest';
import { getPasswordPolicyErrors, isPasswordPolicySatisfied } from './passwordPolicy';

describe('política de senha e paridade com o backend', () => {
  it.each(['Abcdefghi1!x', 'Senha Forte@2026', 'Ábçdefghijk1!'])(
    'aceita senha válida: %s', (password) => {
      expect(getPasswordPolicyErrors(password)).toEqual([]);
      expect(isPasswordPolicySatisfied(password)).toBe(true);
    },
  );

  it.each(['', '   ', 'Abcdefgh1!x', 'abcdefghijk1!', 'ABCDEFGHIJK1!', 'Abcdefghijkl!', 'Abcdefghijk12', 'Abcdefghijk1 ', 'Abcdefghijk1é'])(
    'rejeita senha inválida: %s', (password) => {
      expect(getPasswordPolicyErrors(password).length).toBeGreaterThan(0);
      expect(isPasswordPolicySatisfied(password)).toBe(false);
    },
  );

  it('informa todas as categorias ausentes para orientar o preenchimento', () => {
    expect(getPasswordPolicyErrors('')).toHaveLength(5);
    expect(getPasswordPolicyErrors('abcdefghijk1!')).toEqual(['Inclua ao menos uma letra maiúscula.']);
    expect(getPasswordPolicyErrors('Abcdefghijk1é')).toEqual(['Inclua ao menos um caractere especial.']);
  });
});
