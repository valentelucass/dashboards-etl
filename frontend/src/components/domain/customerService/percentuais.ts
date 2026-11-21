import { formatarPorcentagem } from '../../../utils/formatadores';

export function taxa(parte: number | null, total: number) {
  return parte !== null && total > 0 ? 100 * parte / total : null;
}

export function exibirTaxa(parte: number | null, total: number) {
  const valor = taxa(parte, total);
  return valor === null ? '—' : formatarPorcentagem(valor, 2);
}
