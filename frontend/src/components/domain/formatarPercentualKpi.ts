import { formatarPorcentagem } from '../../utils/formatadores';

export function formatarPercentualKpi(valor: number, ...limites: (number | undefined)[]) {
  const umaCasa = Math.round(valor * 10) / 10;
  const ocultaOcorrencia = valor > 0 && umaCasa === 0;
  const aparentaAtingirLimite = limites.some(limite => limite != null && valor < limite && umaCasa >= limite);
  return formatarPorcentagem(valor, ocultaOcorrencia || aparentaAtingirLimite ? 2 : 1);
}
