import { useMemo } from 'react';
import type {
  PerformanceAgingPoint,
  PerformanceDrilldownPoint,
  PerformanceHistoricoPoint,
  PerformanceKpiItem,
  PerformanceOverview,
  PerformanceSerieTemporalPoint,
  PerformanceStatusDistribuicao,
} from '../types/performance';
import { KpiDictionary } from '../constants/kpiDictionary';
import { formatarMoeda, formatarNumero, formatarPorcentagem } from '../utils/formatadores';

interface UsePerformanceDataInput {
  overview?: PerformanceOverview;
  serieTemporal?: PerformanceSerieTemporalPoint[];
  status?: PerformanceStatusDistribuicao[];
  historico?: PerformanceHistoricoPoint[];
  drilldown?: PerformanceDrilldownPoint[];
  aging?: PerformanceAgingPoint[];
}

export function buildPerformanceKpis(overview?: PerformanceOverview): PerformanceKpiItem[] {
  const totalEntregas = overview?.totalEntregas ?? 0;
  const finalizadas = overview?.finalizadas ?? 0;
  const performance = overview?.performancePercentual ?? 0;
  const comprovante = overview?.comprovanteAnexadoPercentual ?? 0;
  const emAtraso = overview?.emAtraso ?? 0;

  return [
    { definition: KpiDictionary.performance.totalEntregas, label: 'Total de Entregas', valor: formatarNumero(totalEntregas) },
    { definition: KpiDictionary.performance.finalizadas, label: 'Finalizadas', valor: formatarNumero(finalizadas), tone: finalizadas > 0 ? 'positive' : 'neutral' },
    { definition: KpiDictionary.performance.noPrazo, label: 'No Prazo', valor: formatarNumero(overview?.noPrazo ?? 0), tone: 'positive' },
    { definition: KpiDictionary.performance.foraDoPrazo, label: 'Fora do Prazo', valor: formatarNumero(overview?.foraDoPrazo ?? 0), tone: (overview?.foraDoPrazo ?? 0) > 0 ? 'negative' : 'neutral' },
    {
      definition: KpiDictionary.performance.percentualPerformance,
      label: KpiDictionary.performance.percentualPerformance.titulo,
      valor: formatarPorcentagem(performance, 2),
      tone: performance >= 95 ? 'positive' : performance >= 90 ? 'warning' : 'negative',
    },
    { definition: KpiDictionary.performance.emAtraso, label: 'Em Atraso', valor: formatarNumero(emAtraso), tone: emAtraso > 0 ? 'negative' : 'positive' },
    {
      definition: KpiDictionary.performance.pesoTaxadoToneladas,
      label: 'Peso Taxado (t)',
      valor: `${formatarNumero(overview?.pesoTaxadoToneladas ?? 0, 3)} t`,
    },
    {
      definition: KpiDictionary.performance.comprovanteAnexado,
      label: 'Comprovante Anexado',
      valor: formatarPorcentagem(comprovante, 2),
      tone: comprovante >= 95 ? 'positive' : comprovante > 0 ? 'warning' : 'neutral',
    },
    {
      definition: KpiDictionary.performance.valorNfSemComprovante,
      label: 'Valor NF sem Comprovante',
      valor: formatarMoeda(overview?.valorNfSemComprovante ?? 0),
      tone: (overview?.valorNfSemComprovante ?? 0) > 0 ? 'warning' : 'positive',
    },
  ];
}

export function usePerformanceData({
  overview,
  serieTemporal,
  status,
  historico,
  drilldown,
  aging,
}: UsePerformanceDataInput) {
  const kpis = useMemo(() => buildPerformanceKpis(overview), [overview]);
  const hasData = Boolean(overview && overview.totalEntregas > 0);

  const serieTemporalData = useMemo(() => serieTemporal ?? [], [serieTemporal]);
  const statusData = useMemo(() => status ?? [], [status]);
  const historicoData = useMemo(() => historico ?? [], [historico]);
  const drilldownData = useMemo(() => drilldown ?? [], [drilldown]);
  const agingData = useMemo(() => aging ?? [], [aging]);

  return {
    kpis,
    hasData,
    serieTemporalData,
    statusData,
    historicoData,
    drilldownData,
    agingData,
  };
}
