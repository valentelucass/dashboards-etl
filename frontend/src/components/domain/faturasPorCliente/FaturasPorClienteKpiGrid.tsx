import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { FaturasPorClienteOverview } from '../../../types/faturasPorCliente';
import { formatarMoeda, formatarNumero } from '../../../utils/formatadores';

interface FaturasPorClienteKpiGridProps {
  overview: FaturasPorClienteOverview;
}

export default function FaturasPorClienteKpiGrid({ overview }: FaturasPorClienteKpiGridProps) {
  const temFaturas = overview.registrosFaturados > 0;
  const aguardandoTone = overview.aguardandoFaturamento > 0 ? 'warning'
    : overview.aguardandoFaturamento === 0 && temFaturas ? 'positive' : 'neutral';
  const atrasoTone = overview.titulosEmAtraso > 0 ? 'negative'
    : overview.titulosEmAtraso === 0 && temFaturas ? 'positive' : 'neutral';
  const cards = [
    { definition: KpiDictionary.faturasPorCliente.valorFaturado, label: 'Valor Faturado', valor: formatarMoeda(overview.valorFaturado), valorTone: 'neutral' },
    { definition: KpiDictionary.faturasPorCliente.registrosFaturados, label: 'Reg. Faturados', valor: formatarNumero(overview.registrosFaturados), valorTone: 'neutral' },
    { definition: KpiDictionary.faturasPorCliente.aguardandoFaturamento, label: 'Ag. Faturamento', valor: formatarNumero(overview.aguardandoFaturamento), valorTone: aguardandoTone },
    { definition: KpiDictionary.faturasPorCliente.titulosEmAtraso, label: 'Tít. Atraso', valor: formatarNumero(overview.titulosEmAtraso), valorTone: atrasoTone },
    { definition: KpiDictionary.faturasPorCliente.prazoMedio, label: 'Prazo Médio', valor: `${formatarNumero(overview.prazoMedioDias, 1)} dias`, valorTone: 'neutral' },
    { definition: KpiDictionary.faturasPorCliente.clientesAtivos, label: 'Clientes Ativos', valor: formatarNumero(overview.clientesAtivos), valorTone: 'neutral' },
  ] as const;

  return (
    <KpiGrid count={6}>
      {cards.map((card) => (
        <TooltipKpi key={card.label} definition={card.definition}>
          <KpiCard label={card.label} valor={card.valor} valorTone={card.valorTone} />
        </TooltipKpi>
      ))}
    </KpiGrid>
  );
}
