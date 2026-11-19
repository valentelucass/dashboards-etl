import DashboardLoading from '../../shared/DashboardLoading';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary, type KpiDefinition } from '../../../constants/kpiDictionary';
import type { KPIsManifestos } from '../../../types/manifestos';
import { formatarMoeda, formatarNumero } from '../../../utils/formatadores';

interface ManifestosKpiGridProps {
  kpis?: KPIsManifestos;
  isLoading?: boolean;
}

interface ManifestosKpiCardConfig {
  definition: KpiDefinition;
  label: string;
  valor: string;
  size?: 'wide' | 'compact' | 'default';
  layoutClassName?: string;
}

export default function ManifestosKpiGrid({ kpis, isLoading }: ManifestosKpiGridProps) {
  const cards: ManifestosKpiCardConfig[] = kpis
    ? [
        { definition: KpiDictionary.manifestos.totalManifestos, label: 'Total Manifestos', valor: formatarNumero(kpis.totalManifestos), size: 'compact' },
        { definition: KpiDictionary.manifestos.emTransito, label: 'Em Trânsito', valor: formatarNumero(kpis.emTransito), size: 'compact' },
        { definition: KpiDictionary.manifestos.pendentes, label: 'Pendentes', valor: formatarNumero(kpis.pendentes), size: 'compact' },
        { definition: KpiDictionary.manifestos.encerrados, label: 'Encerrados', valor: formatarNumero(kpis.encerrados), size: 'compact' },
        { definition: KpiDictionary.manifestos.kmTotal, label: 'KM Total', valor: formatarNumero(kpis.kmTotal, 0), size: 'compact', layoutClassName: 'col-span-2 lg:col-span-2' },
        { definition: KpiDictionary.manifestos.custoTotal, label: 'Custo Total', valor: formatarMoeda(kpis.custoTotal), size: 'wide' },
        { definition: KpiDictionary.manifestos.custoPorKg, label: 'Custo/KG', valor: formatarMoeda(kpis.custoPorKg), size: 'compact' },
        { definition: KpiDictionary.manifestos.custoPorKm, label: 'Custo/KM', valor: formatarMoeda(kpis.custoPorKm), size: 'compact' },
        { definition: KpiDictionary.manifestos.receitaPorKg, label: 'Receita/KG', valor: formatarMoeda(kpis.receitaPorKg ?? 0), size: 'compact' },
        { definition: KpiDictionary.manifestos.receitaPorKm, label: 'Receita/KM', valor: formatarMoeda(kpis.receitaPorKm), size: 'compact' },
      ]
    : [];

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12" aria-busy={isLoading}>
      {isLoading
        ? Array.from({ length: 10 }, (_, index) => <DashboardLoading key={index} label="" variant="card" />)
        : cards.map((card) => {
          const compact = card.size === 'compact';
          const className = card.size === 'wide'
            ? 'col-span-2 md:col-span-2 lg:col-span-2'
            : compact
              ? `col-span-1 lg:col-span-1 ${card.layoutClassName ?? ''}`
              : 'col-span-1 md:col-span-2 lg:col-span-1';

          return (
            <TooltipKpi key={card.label} definition={card.definition} className={className}>
              <KpiCard
                label={card.label}
                valor={card.valor}
              />
            </TooltipKpi>
          );
        })}
    </div>
  );
}
