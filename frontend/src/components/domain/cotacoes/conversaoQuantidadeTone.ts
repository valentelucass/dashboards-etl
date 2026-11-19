export const FAIXAS_CONVERSAO_QUANTIDADE = { atencao: 35, positiva: 60 } as const;

export function conversaoQuantidadeTone(percentual: number) {
  if (percentual >= FAIXAS_CONVERSAO_QUANTIDADE.positiva) return 'positive';
  return percentual >= FAIXAS_CONVERSAO_QUANTIDADE.atencao ? 'warning' : 'negative';
}
