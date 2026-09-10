export const PASSWORD_POLICY_HINT = 'Use pelo menos 12 caracteres com maiúscula, minúscula, número e caractere especial.';

export function getPasswordPolicyErrors(password: string): string[] {
  const senha = password ?? '';
  const errors: string[] = [];

  if (senha.length < 12) {
    errors.push('Use pelo menos 12 caracteres.');
  }
  if (!/\p{Lu}/u.test(senha)) {
    errors.push('Inclua ao menos uma letra maiúscula.');
  }
  if (!/\p{Ll}/u.test(senha)) {
    errors.push('Inclua ao menos uma letra minúscula.');
  }
  if (!/\p{Nd}/u.test(senha)) {
    errors.push('Inclua ao menos um número.');
  }
  if (!/[^\p{L}\p{Nd}\s]/u.test(senha)) {
    errors.push('Inclua ao menos um caractere especial.');
  }

  return errors;
}

export function isPasswordPolicySatisfied(password: string): boolean {
  return getPasswordPolicyErrors(password).length === 0;
}
