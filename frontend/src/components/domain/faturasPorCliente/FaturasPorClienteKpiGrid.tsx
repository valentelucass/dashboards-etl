import KpiCard from '../../shared/KpiCard';
import FinanceiroKpiLayout from './FinanceiroKpiLayout';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { FaturasPorClienteOverview } from '../../../types/faturasPorCliente';
import { formatarMoeda, formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';

interface FaturasPorClienteKpiGridProps {
  overview?: FaturasPorClienteOverview;
}

function financialCards(overview: FaturasPorClienteOverview) {
  const definitions = KpiDictionary.faturasPorCliente;
  const temFaturas = overview.registrosFaturados > 0;
  const aguardando = overview.aguardandoFaturamento > 0 ? 'warning' : temFaturas ? 'positive' : 'neutral';
  const atraso = overview.titulosEmAtraso > 0 ? 'negative' : temFaturas ? 'positive' : 'neutral';
  const cards = [
    { definition: definitions.valorFaturado, valor: formatarMoeda(overview.valorFaturado),
      helperText: overview.valorFaturado + overview.valorAFaturar > 0 ? formatarPorcentagem(overview.percentualFaturado, 2) + ' do total' : 'Sem base para o percentual' },
    { definition: definitions.valorAFaturar, valor: formatarMoeda(overview.valorAFaturar), tone: aguardando },
    { definition: definitions.aguardandoFaturamento, valor: formatarNumero(overview.aguardandoFaturamento), tone: aguardando },
    { definition: definitions.contasAReceber, valor: formatarMoeda(overview.contasAReceber) },
    { definition: definitions.valorEmAtraso, valor: formatarMoeda(overview.valorEmAtraso), tone: atraso,
      helperText: overview.contasAReceber > 0 ? formatarPorcentagem(overview.percentualEmAtraso, 2) + ' da carteira em aberto' : 'Sem carteira em aberto' },
    { definition: definitions.prazoCadastral, valor: temFaturas ? formatarNumero(overview.prazoMedioDias, 1) + ' dias' : '—' },
    { definition: definitions.prazoAteFaturar, valor: overview.prazoAteFaturarDias == null ? '—' : formatarNumero(overview.prazoAteFaturarDias, 1) + ' dias' },
    { definition: definitions.prazoMedio, valor: overview.prazoRecebimentoDias == null ? '—' : formatarNumero(overview.prazoRecebimentoDias, 1) + ' dias' },
    { definition: definitions.clientesAtivos, valor: formatarNumero(overview.clientesAtivos) },
  ] as const;

  return cards.map(card => (
    <TooltipKpi key={card.definition.titulo} definition={card.definition} className="financeiro-kpi-item">
      <KpiCard label={card.definition.titulo} valor={card.valor}
        helperText={'helperText' in card ? card.helperText : undefined}
        valorTone={'tone' in card ? card.tone : 'neutral'} />
    </TooltipKpi>
  ));
}

export default function FaturasPorClienteKpiGrid({ overview }: FaturasPorClienteKpiGridProps) {
  return <FinanceiroKpiLayout cards={overview && financialCards(overview)} />;
}
