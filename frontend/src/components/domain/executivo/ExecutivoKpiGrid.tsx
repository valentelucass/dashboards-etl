import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import type { ExecutivoOverview } from '../../../types/executivo';
import { formatarMoeda, formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';

interface ExecutivoKpiGridProps {
  overview: ExecutivoOverview;
}

type KpiValorTone = 'text-positive' | 'text-warning' | 'text-negative';

interface ExecutivoKpiCardConfig {
  definition: KpiDefinition;
  label: string;
  valor: string;
  valorClassName: string;
  className?: string;
}

const KPI_VALOR_CLASS = 'text-2xl font-bold truncate';

function valorClass(tone: KpiValorTone) {
  return `${KPI_VALOR_CLASS} ${tone}`;
}

function percentual(parte: number, total: number): number {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }
  return (parte * 100) / total;
}

function toneReceita(valor: number): KpiValorTone {
  if (valor > 0) return 'text-positive';
  return 'text-warning';
}

function toneFaturamento(valorFaturado: number, receitaOperacional: number): KpiValorTone {
  if (receitaOperacional <= 0) {
    return valorFaturado > 0 ? 'text-positive' : 'text-warning';
  }

  const atingimento = percentual(valorFaturado, receitaOperacional);
  if (atingimento < 90) return 'text-negative';
  if (atingimento < 98) return 'text-warning';
  return 'text-positive';
}

function toneSaldoRelativo(valor: number, base: number, limitePositivoPct: number, limiteWarningPct: number): KpiValorTone {
  if (valor <= 0) return 'text-positive';

  const proporcao = percentual(valor, base);
  if (proporcao <= limitePositivoPct) return 'text-positive';
  if (proporcao <= limiteWarningPct) return 'text-warning';
  return 'text-negative';
}

function toneQuantidadeMenorMelhor(valor: number, limiteWarning: number): KpiValorTone {
  if (valor <= 0) return 'text-positive';
  if (valor <= limiteWarning) return 'text-warning';
  return 'text-negative';
}

function toneOcupacaoManifestos(ocupacaoPct: number): KpiValorTone {
  if (ocupacaoPct < 70) return 'text-negative';
  if (ocupacaoPct < 85) return 'text-warning';
  return 'text-positive';
}

export default function ExecutivoKpiGrid({ overview }: ExecutivoKpiGridProps) {
  const baseFinanceira = Math.max(overview.valorFaturado, overview.receitaOperacional);
  const cards: ExecutivoKpiCardConfig[] = [
    {
      definition: KpiDictionary.executivo.receitaOperacional,
      label: 'Rec. Operacional',
      valor: formatarMoeda(overview.receitaOperacional),
      valorClassName: valorClass(toneReceita(overview.receitaOperacional)),
    },
    {
      definition: KpiDictionary.executivo.valorFaturado,
      label: 'Valor Faturado',
      valor: formatarMoeda(overview.valorFaturado),
      valorClassName: valorClass(toneFaturamento(overview.valorFaturado, overview.receitaOperacional)),
    },
    {
      definition: KpiDictionary.executivo.saldoAReceber,
      label: 'A Receber',
      valor: formatarMoeda(overview.saldoAReceber),
      valorClassName: valorClass(toneSaldoRelativo(overview.saldoAReceber, baseFinanceira, 10, 25)),
    },
    {
      definition: KpiDictionary.executivo.saldoAPagar,
      label: 'A Pagar',
      valor: formatarMoeda(overview.saldoAPagar),
      valorClassName: valorClass(toneSaldoRelativo(overview.saldoAPagar, baseFinanceira, 20, 50)),
    },
    {
      definition: KpiDictionary.executivo.backlogColetas,
      label: 'Backlog Coletas',
      valor: formatarNumero(overview.backlogColetas),
      valorClassName: valorClass(toneQuantidadeMenorMelhor(overview.backlogColetas, 100)),
    },
    {
      definition: KpiDictionary.executivo.cargasPrevisaoVencida,
      label: 'Previsão Vencida',
      valor: formatarNumero(overview.cargasPrevisaoVencida),
      valorClassName: valorClass(toneQuantidadeMenorMelhor(overview.cargasPrevisaoVencida, 10)),
      className: 'lg:col-span-2 xl:col-span-1',
    },
    {
      definition: KpiDictionary.executivo.ocupacaoMediaManifestos,
      label: 'Ocup. Manifestos',
      valor: formatarPorcentagem(overview.ocupacaoMediaManifestos),
      valorClassName: valorClass(toneOcupacaoManifestos(overview.ocupacaoMediaManifestos)),
      className: 'sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-1',
    },
  ];

  return (
    <KpiGrid count={7} singleRowDesktop intermediateRows={[3, 4]}>
      {cards.map((card) => (
        <TooltipKpi key={card.label} definition={card.definition} className={card.className}>
          <KpiCard
            label={card.label}
            valor={card.valor}
            valorClassName={card.valorClassName}
          />
        </TooltipKpi>
      ))}
    </KpiGrid>
  );
}
