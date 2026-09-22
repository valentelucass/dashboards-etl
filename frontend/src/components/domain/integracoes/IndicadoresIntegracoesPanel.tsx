import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import type { EtapaIntegracao } from '../../../api/endpoints/integracoesEtapas';
import { buscarIndicadoresOperacionais, type EtapaOperacional } from '../../../api/endpoints/integracoesOperacionais';
import AtividadeIntegracoesPanel from './AtividadeIntegracoesPanel';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../../../utils/echartsBuilders';
import { formatarNumero } from '../../../utils/formatadores';
import { INTEGRATION_QUERY_POLLING_OPTIONS } from '../../../utils/pollingUtils';
import { completarDiasConfirmacoes, rotuloEtapa } from '../../../utils/integracoesEtapas';
import { getGoalToneStyle } from '../../../utils/indicadoresGestaoVistaUi';
import PendenciasEtapasPanel from './PendenciasEtapasPanel';

const ETAPAS_VAZIAS: EtapaOperacional[] = [];

export default function IndicadoresIntegracoesPanel({ inicio, fim, destinos }: {
  inicio: string; fim: string; destinos: string[];
}) {
  const { isDark } = useEchartsTheme();
  const query = useQuery({
    ...INTEGRATION_QUERY_POLLING_OPTIONS,
    queryKey: ['integracoes', 'indicadores-operacionais', inicio, fim, destinos],
    queryFn: ({ signal }) => buscarIndicadoresOperacionais(inicio, fim, destinos, signal),
    staleTime: 60_000,
    retry: 1,
  });
  const etapas = query.data?.etapas ?? ETAPAS_VAZIAS;
  const totais = useMemo(() => etapas.reduce((acc, item) => ({
    dados: acc.dados + (item.etapa === 'DADOS' ? item.sucessosPeriodo : 0),
    comprovantes: acc.comprovantes + (item.etapa === 'COMPROVANTE' ? item.sucessosPeriodo : 0),
    pendentes: acc.pendentes + (item.aguardandoProcessamento + item.novaTentativa + item.aguardandoOrigem + item.aguardandoConfirmacao),
    bloqueados: acc.bloqueados + item.intervencao,
    semDataConfiavel: acc.semDataConfiavel + item.confirmadosSemDataConfiavel,
  }), { dados: 0, comprovantes: 0, pendentes: 0, bloqueados: 0, semDataConfiavel: 0 }), [etapas]);

  const options = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);
    const cores = [tokens.palette[2]];
    const diaria = (etapa: EtapaIntegracao): EChartsOption => {
      const dias = completarDiasConfirmacoes(inicio, fim, query.data?.evolucao ?? [], etapa);
      return buildBaseLineOption(isDark, {
        color: cores,
        legend: { top: 0, right: 8, data: ['Confirmados'] },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dias.map(d => `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`) },
        yAxis: { type: 'value', minInterval: 1, name: 'Etapas' },
        series: [
          { name: 'Confirmados', type: 'line', smooth: false, itemStyle: { color: cores[0] }, data: dias.map(d => d.sucessos) },
        ],
      });
    };
    const resumo = buildBaseBarOption(isDark, {
      color: cores,
      legend: { top: 0, right: 8, data: ['Confirmados'] },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 32, top: 45, bottom: 30, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, name: 'Etapas' },
      yAxis: { type: 'category', inverse: true, data: etapas.map(item => `${item.sistemaDestino} · ${rotuloEtapa(item)}`) },
      series: [
        { name: 'Confirmados', type: 'bar', stack: 'resultado', itemStyle: { color: cores[0] }, data: etapas.map(item => item.sucessosPeriodo) },
      ],
    });
    return { dados: diaria('DADOS'), comprovantes: diaria('COMPROVANTE'), resumo };
  }, [isDark, etapas, inicio, fim, query.data?.evolucao]);

  const disponivel = query.data !== undefined && !query.isError;
  const comprovantesDefinition = KpiDictionary.integracoes.comprovantesConfirmados;
  const detalhesComprovantes = disponivel && totais.semDataConfiavel > 0 ? {
    ...comprovantesDefinition,
    observacao: `${formatarNumero(totais.semDataConfiavel)} comprovantes confirmados com data a conferir, considerando todo o histórico das integrações selecionadas. ${comprovantesDefinition.observacao}`,
  } : comprovantesDefinition;
  const valor = (numero: number) => disponivel ? formatarNumero(numero) : '—';
  const erro = query.isError
    ? 'Não foi possível carregar os indicadores separados. Confira se o Satélite e a API do Dashboard foram atualizados.'
    : null;
  const periodos = [
    { key: 'dados', label: 'XML / dados confirmados', valor: totais.dados, kpi: 'integracoes.dadosConfirmados', base: 'No período', tone: 'positive' },
    { key: 'pod', label: 'Comprovantes confirmados', valor: totais.comprovantes, kpi: 'integracoes.comprovantesConfirmados', base: 'No período', tone: 'positive' },
    { key: 'pendentes', label: 'Etapas em acompanhamento', valor: totais.pendentes, kpi: 'integracoes.etapasPendentes', base: 'Saldo atual · todas as datas', tone: 'warning' },
    { key: 'bloqueados', label: 'Exigem intervenção', valor: totais.bloqueados, kpi: 'integracoes.etapasBloqueadas', base: 'Saldo atual · todas as datas', tone: 'negative' },
  ] as const;
  return (
    <section aria-label="Indicadores separados por etapa" className="mb-6">
      {erro && <p role="alert" className="mb-4 rounded-lg border p-3 text-sm text-negative">{erro}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {periodos.map(item => (
          <TooltipKpi key={item.key} kpiName={item.kpi}
            definition={item.key === 'pod' ? detalhesComprovantes : undefined}>
            <KpiCard label={item.label} valor={valor(item.valor)} metaLabel="Referência" metaValue={item.base}
              valorStyle={disponivel ? { color: getGoalToneStyle(item.tone).text } : undefined} />
          </TooltipKpi>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper titulo="XML / dados por dia" option={options.dados} altura={350}
          chartKey="integracoesDadosPorDia" isLoading={query.isPending} erro={erro} isEmpty={!disponivel} />
        <ChartWrapper titulo="Comprovantes por dia" option={options.comprovantes} altura={350}
          chartKey="integracoesComprovantesPorDia" isLoading={query.isPending} erro={erro} isEmpty={!disponivel} />
        <ChartWrapper titulo="Confirmações por etapa no período" option={options.resumo} altura={350}
          chartKey="integracoesResultadosEtapas" className="lg:col-span-2" isLoading={query.isPending}
          erro={erro} isEmpty={!disponivel || etapas.length === 0} />
      </div>
      <AtividadeIntegracoesPanel dados={disponivel ? query.data : undefined} />
      <PendenciasEtapasPanel etapas={etapas}
        estado={disponivel ? 'disponivel' : query.isPending ? 'carregando' : 'indisponivel'} />
    </section>
  );
}
