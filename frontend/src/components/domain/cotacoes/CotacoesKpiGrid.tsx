import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { CotacoesOverview } from '../../../types/cotacoes';
import { formatarMoeda, formatarNumero } from '../../../utils/formatadores';
import { formatarPercentualKpi } from '../formatarPercentualKpi';
import { conversaoQuantidadeTone, FAIXAS_CONVERSAO_QUANTIDADE } from './conversaoQuantidadeTone';

interface CotacoesKpiGridProps {
  overview: CotacoesOverview;
}

export default function CotacoesKpiGrid({ overview }: CotacoesKpiGridProps) {
  const cards = [
    { definition: KpiDictionary.cotacoes.totalCotacoes, label: 'Total Cotações', valor: formatarNumero(overview.totalCotacoes) },
    { definition: KpiDictionary.cotacoes.valorPotencial, label: 'Potencial (R$)', valor: formatarMoeda(overview.valorPotencial) },
    { definition: KpiDictionary.cotacoes.valorConvertido, label: 'Convertido (R$)', valor: formatarMoeda(overview.valorConvertido),
      valorTone: overview.valorConvertido > 0 ? 'positive' : 'neutral' },
    { definition: KpiDictionary.cotacoes.freteMedio, label: 'Frete Médio', valor: formatarMoeda(overview.freteMedio) },
    { definition: KpiDictionary.cotacoes.fretePorKg, label: 'Frete/KG', valor: formatarMoeda(overview.freteKgMedio) },
    { definition: KpiDictionary.cotacoes.conversaoValor, label: 'Conversão Valor', valor: formatarPercentualKpi(overview.conversaoValor, 100),
      valorTone: overview.valorPotencial > 0 && overview.valorConvertido === overview.valorPotencial ? 'positive' : 'neutral' },
    { definition: KpiDictionary.cotacoes.conversaoQuantidade, label: 'Conversão Quantidade',
      valor: formatarPercentualKpi(overview.conversaoQuantidade, FAIXAS_CONVERSAO_QUANTIDADE.atencao, FAIXAS_CONVERSAO_QUANTIDADE.positiva),
      valorTone: overview.totalCotacoes > 0 && Number.isFinite(overview.conversaoQuantidade)
        ? conversaoQuantidadeTone(overview.conversaoQuantidade) : 'neutral' },
    { definition: KpiDictionary.cotacoes.reprovacao, label: 'Reprovação %', valor: formatarPercentualKpi(overview.reprovacaoPercentual),
      valorTone: overview.totalCotacoes > 0 && overview.reprovacaoPercentual > 0 ? 'negative' : 'neutral' },
  ] as const;

  return (
    <KpiGrid count={8}>
      {cards.map(({ definition, ...card }) => (
        <TooltipKpi key={card.label} definition={definition}>
          <KpiCard {...card} />
        </TooltipKpi>
      ))}
    </KpiGrid>
  );
}
