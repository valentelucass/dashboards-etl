import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { ColetasOverview } from '../../../types/coletas';
import { formatarMoeda, formatarNumero, formatarPeso } from '../../../utils/formatadores';
import { formatarPercentualKpi } from '../formatarPercentualKpi';

interface ColetasKpiGridProps {
  overview: ColetasOverview;
  metaAgendamento?: number;
}

function tomAgendamento({ finalizadas, slaNoAgendamento }: ColetasOverview, meta = 0) {
  if (!(finalizadas > 0) || !Number.isFinite(meta) || meta <= 0 || !Number.isFinite(slaNoAgendamento)) return 'neutral';
  if (slaNoAgendamento >= meta) return 'positive';
  return slaNoAgendamento > 0 ? 'warning' : 'negative';
}

export default function ColetasKpiGrid({ overview, metaAgendamento }: ColetasKpiGridProps) {
  const temColetas = overview.totalColetas > 0;
  const cards = [
    { definition: KpiDictionary.coletas.totalColetas, label: 'Total Coletas', valor: formatarNumero(overview.totalColetas) },
    { definition: KpiDictionary.coletas.finalizadas, label: 'Finalizadas', valor: formatarNumero(overview.finalizadas),
      valorTone: overview.finalizadas > 0 ? 'positive' : 'neutral' },
    { definition: KpiDictionary.coletas.taxaSucesso, label: 'Taxa Sucesso', valor: formatarPercentualKpi(overview.taxaSucesso, 100),
      valorTone: temColetas && overview.finalizadas === overview.totalColetas ? 'positive' : 'neutral' },
    { definition: KpiDictionary.coletas.cancelamento, label: 'Cancelamento %', valor: formatarPercentualKpi(overview.taxaCancelamento),
      valorTone: temColetas && overview.taxaCancelamento > 0 ? 'negative' : 'neutral' },
    { definition: KpiDictionary.coletas.slaAgendamento, label: 'SLA Agendamento', valor: formatarPercentualKpi(overview.slaNoAgendamento, metaAgendamento),
      valorTone: tomAgendamento(overview, metaAgendamento) },
    { definition: KpiDictionary.coletas.leadTimeMedio, label: 'Lead Time Médio', valor: `${formatarNumero(overview.leadTimeMedioDias, 1)} dias` },
    { definition: KpiDictionary.coletas.tentativasMedias, label: 'Tentativas Méd.', valor: formatarNumero(overview.tentativasMedias, 1) },
    { definition: KpiDictionary.coletas.pesoTaxado, label: 'Peso Taxado', valor: formatarPeso(overview.pesoTaxadoTotal) },
    { definition: KpiDictionary.coletas.valorNotaFiscal, label: 'Valor NF', valor: formatarMoeda(overview.valorNfTotal) },
  ] as const;

  return (
    <KpiGrid count={9} intermediateRows={[5, 4]}>
      {cards.map(({ definition, ...card }) => (
        <TooltipKpi key={card.label} definition={definition}>
          <KpiCard {...card} />
        </TooltipKpi>
      ))}
    </KpiGrid>
  );
}
