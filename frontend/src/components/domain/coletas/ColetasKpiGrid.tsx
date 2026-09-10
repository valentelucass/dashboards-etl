import KpiCard from '../../shared/KpiCard';
import KpiGrid from '../../shared/KpiGrid';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import type { ColetasOverview } from '../../../types/coletas';
import { formatarMoeda, formatarNumero, formatarPorcentagem, formatarPeso } from '../../../utils/formatadores';

interface ColetasKpiGridProps {
  overview: ColetasOverview;
}

export default function ColetasKpiGrid({ overview }: ColetasKpiGridProps) {
  const cards = [
    { definition: KpiDictionary.coletas.totalColetas, label: 'Total Coletas', valor: formatarNumero(overview.totalColetas) },
    { definition: KpiDictionary.coletas.finalizadas, label: 'Finalizadas', valor: formatarNumero(overview.finalizadas) },
    { definition: KpiDictionary.coletas.taxaSucesso, label: 'Taxa Sucesso', valor: formatarPorcentagem(overview.taxaSucesso) },
    { definition: KpiDictionary.coletas.cancelamento, label: 'Cancelamento %', valor: formatarPorcentagem(overview.taxaCancelamento) },
    { definition: KpiDictionary.coletas.slaAgendamento, label: 'SLA Agendamento', valor: formatarPorcentagem(overview.slaNoAgendamento) },
    { definition: KpiDictionary.coletas.leadTimeMedio, label: 'Lead Time Médio', valor: `${formatarNumero(overview.leadTimeMedioDias, 1)} dias` },
    { definition: KpiDictionary.coletas.tentativasMedias, label: 'Tentativas Méd.', valor: formatarNumero(overview.tentativasMedias, 1) },
    { definition: KpiDictionary.coletas.pesoTaxado, label: 'Peso Taxado', valor: formatarPeso(overview.pesoTaxadoTotal) },
    { definition: KpiDictionary.coletas.valorNotaFiscal, label: 'Valor NF', valor: formatarMoeda(overview.valorNfTotal) },
  ];

  return (
    <KpiGrid count={9} intermediateRows={[5, 4]}>
      {cards.map((card) => (
        <TooltipKpi key={card.label} definition={card.definition}>
          <KpiCard label={card.label} valor={card.valor} />
        </TooltipKpi>
      ))}
    </KpiGrid>
  );
}
