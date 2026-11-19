import KpiCard, { type KpiValorTone } from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { TrackingOverview } from '../../../types/tracking';
import { formatarMoeda, formatarNumero, formatarPeso } from '../../../utils/formatadores';

interface TrackingKpiGridProps {
  overview: TrackingOverview;
}

function tomPrevisaoVencida({ totalCargas, previsaoVencida }: TrackingOverview): KpiValorTone {
  if (totalCargas <= 0) return 'neutral';
  if (previsaoVencida === 0) return 'positive';
  return previsaoVencida <= 10 ? 'warning' : 'negative';
}

export default function TrackingKpiGrid({ overview }: TrackingKpiGridProps) {
  const cards = [
    { definition: KpiDictionary.tracking.totalCargas, label: 'Total de Cargas', valor: formatarNumero(overview.totalCargas), className: 'col-span-1 md:col-span-1 xl:col-span-1' },
    { definition: KpiDictionary.tracking.emTransito, label: 'Em Trânsito', valor: formatarNumero(overview.emTransito), className: 'col-span-1 md:col-span-1 xl:col-span-1' },
    {
      definition: KpiDictionary.tracking.previsaoVencida,
      label: 'Previsão Vencida',
      valor: formatarNumero(overview.previsaoVencida),
      valorTone: tomPrevisaoVencida(overview),
      className: 'col-span-1 md:col-span-1 xl:col-span-1',
    },
    { definition: KpiDictionary.tracking.pesoTaxado, label: 'Peso Taxado', valor: formatarPeso(overview.pesoTaxadoTotal), className: 'col-span-1 md:col-span-1 xl:col-span-1' },
    { definition: KpiDictionary.tracking.valorCarteira, label: 'Val. Carteira', valor: formatarMoeda(overview.valorFreteEmCarteira), className: 'col-span-2 md:col-span-2 xl:col-span-2' },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card) => (
        <TooltipKpi key={card.label} definition={card.definition} className={card.className}>
          <KpiCard label={card.label} valor={card.valor} valorTone={card.valorTone} />
        </TooltipKpi>
      ))}
    </div>
  );
}
