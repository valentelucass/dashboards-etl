import { etlKpis, etlSucessoSpan } from '../../shared/dashboardKpiLayouts';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import type { EtlSaudeOverview } from '../../../types/etlSaude';
import { formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';

interface EtlSaudeKpiGridProps {
  overview: EtlSaudeOverview;
}

type KpiValorTone = 'text-positive' | 'text-warning' | 'text-negative';

interface EtlSaudeKpiCard {
  definition: KpiDefinition;
  label: string;
  valor: string;
  valorClassName?: string;
  className?: string;
}

const KPI_VALOR_CLASS = 'text-2xl font-bold truncate';

function valorClass(tone: KpiValorTone) {
  return `${KPI_VALOR_CLASS} ${tone}`;
}

function toneTaxaSucesso(taxaSucesso: number): KpiValorTone {
  if (taxaSucesso < 90) return 'text-negative';
  if (taxaSucesso < 98) return 'text-warning';
  return 'text-positive';
}

function toneTaxaFalha(execucoesComErro: number, totalExecucoes: number): KpiValorTone {
  if (totalExecucoes <= 0 || execucoesComErro <= 0) return 'text-positive';

  const taxaFalha = (execucoesComErro * 100) / totalExecucoes;
  if (taxaFalha > 10) return 'text-negative';
  if (taxaFalha > 2) return 'text-warning';
  return 'text-warning';
}

function toneTempoMedio(segundos: number): KpiValorTone {
  if (segundos > 300) return 'text-negative';
  if (segundos > 60) return 'text-warning';
  return 'text-positive';
}

export default function EtlSaudeKpiGrid({ overview }: EtlSaudeKpiGridProps) {
  const cards: EtlSaudeKpiCard[] = [
    {
      definition: KpiDictionary.etlSaude.tempoMedioExecucao,
      label: 'Tempo Médio (s)',
      valor: formatarNumero(overview.tempoMedioExecucaoSegundos, 2),
      valorClassName: valorClass(toneTempoMedio(overview.tempoMedioExecucaoSegundos)),
    },
    {
      definition: KpiDictionary.etlSaude.execucoesComErro,
      label: 'Com Erro',
      valor: formatarNumero(overview.execucoesComErro),
      valorClassName: valorClass(toneTaxaFalha(overview.execucoesComErro, overview.totalExecucoes)),
    },
    {
      definition: KpiDictionary.etlSaude.totalExecucoes,
      label: 'Total Execuções',
      valor: formatarNumero(overview.totalExecucoes),
    },
    {
      definition: KpiDictionary.etlSaude.volumeProcessado,
      label: 'Vol. Processado',
      valor: formatarNumero(overview.volumeProcessadoTotal),
    },
    {
      definition: KpiDictionary.etlSaude.taxaSucesso,
      label: 'Taxa Sucesso',
      valor: formatarPorcentagem(overview.taxaSucesso),
      valorClassName: valorClass(toneTaxaSucesso(overview.taxaSucesso)),
      className: etlSucessoSpan,
    },
  ];

  return (
    <div className={etlKpis}>
      {cards.map((card) => (
        <TooltipKpi key={card.label} definition={card.definition} className={card.className}>
          <KpiCard
            label={card.label}
            valor={card.valor}
            valorClassName={card.valorClassName}
          />
        </TooltipKpi>
      ))}
    </div>
  );
}
