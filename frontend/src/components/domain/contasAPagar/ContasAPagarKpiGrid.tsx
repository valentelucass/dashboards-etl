import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { ContasAPagarOverview } from '../../../types/contasAPagar';
import { formatarMoeda, formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';

interface ContasAPagarKpiGridProps {
  overview: ContasAPagarOverview;
  temTitulos: boolean;
}

function tomDaConclusao(percentual: number, temTitulos: boolean) {
  if (!temTitulos || !Number.isFinite(percentual) || percentual < 0 || percentual > 100) return 'neutral';
  return percentual === 100 ? 'positive' : 'warning';
}

export default function ContasAPagarKpiGrid({ overview, temTitulos }: ContasAPagarKpiGridProps) {
  const temBase = temTitulos || overview.valorAPagar > 0 || overview.valorPago > 0 || overview.taxaLiquidacao > 0 || overview.pctConciliado > 0;
  const saldoQuitado = overview.saldoAberto === 0 && overview.valorAPagar > 0;
  const saldoTone = overview.saldoAberto > 0 ? 'warning' : saldoQuitado ? 'positive' : 'neutral';
  const cards = [
    { definition: KpiDictionary.contasAPagar.valorAPagar, label: 'Valor a Pagar', valor: formatarMoeda(overview.valorAPagar), valorTone: 'neutral' },
    { definition: KpiDictionary.contasAPagar.valorPago, label: 'Valor Pago', valor: formatarMoeda(overview.valorPago), valorTone: 'neutral' },
    { definition: KpiDictionary.contasAPagar.saldoAberto, label: 'Saldo Aberto', valor: formatarMoeda(overview.saldoAberto), valorTone: saldoTone },
    { definition: KpiDictionary.contasAPagar.taxaLiquidacao, label: 'Taxa Liquidação', valor: formatarPorcentagem(overview.taxaLiquidacao), valorTone: tomDaConclusao(overview.taxaLiquidacao, temBase) },
    { definition: KpiDictionary.contasAPagar.leadTime, label: 'Lead Time', valor: `${formatarNumero(overview.leadTimeLiquidacaoDias, 1)} dias`, valorTone: 'neutral' },
    { definition: KpiDictionary.contasAPagar.percentualConciliado, label: '% Conciliado', valor: formatarPorcentagem(overview.pctConciliado), valorTone: tomDaConclusao(overview.pctConciliado, temBase) },
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
