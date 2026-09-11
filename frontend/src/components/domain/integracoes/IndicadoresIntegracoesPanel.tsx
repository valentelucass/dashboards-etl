import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { buscarIndicadoresEtapas, type EtapaIntegracao, type IndicadorEtapa } from '../../../api/endpoints/integracoesEtapas';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../../../utils/echartsBuilders';
import { formatarNumero } from '../../../utils/formatadores';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../../../utils/pollingUtils';
import { completarDiasEtapas, rotuloEtapa } from '../../../utils/integracoesEtapas';

const ETAPAS_VAZIAS: IndicadorEtapa[] = [];

export default function IndicadoresIntegracoesPanel({ inicio, fim, destinos }: {
  inicio: string; fim: string; destinos: string[];
}) {
  const { isDark } = useEchartsTheme();
  const query = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: ['integracoes', 'indicadores-etapas', inicio, fim, destinos],
    queryFn: ({ signal }) => buscarIndicadoresEtapas(inicio, fim, destinos, signal),
    staleTime: 60_000,
    retry: 1,
  });
  const etapas = query.data?.etapas ?? ETAPAS_VAZIAS;
  const totais = useMemo(() => etapas.reduce((acc, item) => ({
    dados: acc.dados + (item.etapa === 'DADOS' ? item.sucessosPeriodo : 0),
    comprovantes: acc.comprovantes + (item.etapa === 'COMPROVANTE' ? item.sucessosPeriodo : 0),
    pendentes: acc.pendentes + item.pendentesAtuais,
    bloqueados: acc.bloqueados + item.bloqueadosAtuais,
    semConfirmacao: acc.semConfirmacao + item.semConfirmacaoDatada,
  }), { dados: 0, comprovantes: 0, pendentes: 0, bloqueados: 0, semConfirmacao: 0 }), [etapas]);

  const options = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);
    const cores = [tokens.palette[2], tokens.palette[3]];
    const diaria = (etapa: EtapaIntegracao): EChartsOption => {
      const dias = completarDiasEtapas(inicio, fim, query.data?.evolucao ?? [], etapa);
      return buildBaseLineOption(isDark, {
        color: cores,
        legend: { top: 0, right: 8, data: ['Confirmados', 'Com falha'] },
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dias.map(d => `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`) },
        yAxis: { type: 'value', minInterval: 1, name: 'Etapas' },
        series: [
          { name: 'Confirmados', type: 'line', smooth: false, data: dias.map(d => d.sucessos) },
          { name: 'Com falha', type: 'line', smooth: false, data: dias.map(d => d.falhas) },
        ],
      });
    };
    const resumo = buildBaseBarOption(isDark, {
      color: cores,
      legend: { top: 0, right: 8, data: ['Confirmados', 'Com falha'] },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 32, top: 45, bottom: 30, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, name: 'Etapas' },
      yAxis: { type: 'category', inverse: true, data: etapas.map(item => `${item.sistemaDestino} · ${rotuloEtapa(item)}`) },
      series: [
        { name: 'Confirmados', type: 'bar', stack: 'resultado', data: etapas.map(item => item.sucessosPeriodo) },
        { name: 'Com falha', type: 'bar', stack: 'resultado', data: etapas.map(item => item.falhasPeriodo) },
      ],
    });
    return { dados: diaria('DADOS'), comprovantes: diaria('COMPROVANTE'), resumo };
  }, [isDark, etapas, inicio, fim, query.data?.evolucao]);

  const disponivel = query.data !== undefined && !query.isError;
  const valor = (numero: number) => disponivel ? formatarNumero(numero) : '—';
  const erro = query.isError
    ? 'Não foi possível carregar os indicadores separados. Confira se o Satélite e a API do Dashboard foram atualizados.'
    : null;
  const periodos = [
    { key: 'dados', label: 'XML / dados confirmados', valor: totais.dados, kpi: 'integracoes.dadosConfirmados', base: 'No período' },
    { key: 'pod', label: 'Comprovantes confirmados', valor: totais.comprovantes, kpi: 'integracoes.comprovantesConfirmados', base: 'No período' },
    { key: 'pendentes', label: 'Etapas pendentes', valor: totais.pendentes, kpi: 'integracoes.etapasPendentes', base: 'Saldo atual · todas as datas' },
    { key: 'bloqueados', label: 'Etapas bloqueadas', valor: totais.bloqueados, kpi: 'integracoes.etapasBloqueadas', base: 'Saldo atual · todas as datas' },
  ];
  return (
    <section aria-label="Indicadores separados por etapa" className="mb-6">
      {erro && <p role="alert" className="mb-4 rounded-lg border p-3 text-sm text-negative">{erro}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {periodos.map(item => (
          <TooltipKpi key={item.key} kpiName={item.kpi}>
            <KpiCard label={item.label} valor={valor(item.valor)} metaLabel="Referência" metaValue={item.base} />
          </TooltipKpi>
        ))}
      </div>
      <p className="my-3 text-sm text-[var(--color-text-muted)]">
        XML e comprovantes usam suas próprias datas de confirmação. Os resultados abaixo são os últimos
        registros disponíveis de cada etapa; não representam todas as tentativas de envio.
      </p>
      {disponivel && totais.semConfirmacao > 0 && (
        <p className="mb-4 rounded-lg border p-3 text-sm" role="status">
          {formatarNumero(totais.semConfirmacao)} etapas sem confirmação datada ou sem classificação.
          Elas precisam de conferência e ficam fora dos envios confirmados.
        </p>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper titulo="XML / dados por dia" option={options.dados} altura={350}
          chartKey="integracoesDadosPorDia" isLoading={query.isPending} erro={erro} isEmpty={!disponivel} />
        <ChartWrapper titulo="Comprovantes por dia" option={options.comprovantes} altura={350}
          chartKey="integracoesComprovantesPorDia" isLoading={query.isPending} erro={erro} isEmpty={!disponivel} />
        <ChartWrapper titulo="Resultados por etapa no período" option={options.resumo} altura={350}
          chartKey="integracoesResultadosEtapas" className="lg:col-span-2" isLoading={query.isPending}
          erro={erro} isEmpty={!disponivel || etapas.length === 0} />
      </div>
      <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
        <TooltipKpi kpiName="integracoes.saldoPorEtapa">
          <h2 className="mb-1 text-sm font-semibold">Pendências atuais por etapa</h2>
        </TooltipKpi>
        <p className="mb-3 text-xs text-[var(--color-text-muted)]">
          Todas as datas, respeitando a integração selecionada. Uma nota pode ter pendência nas duas etapas.
        </p>
        {!disponivel ? <p className="text-sm">{query.isPending ? 'Carregando…' : 'Indicadores indisponíveis.'}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-[var(--color-border)] text-left">
                <th className="p-2">Integração / etapa</th><th className="p-2 text-right">Pendentes</th>
                <th className="p-2 text-right">Bloqueados</th><th className="p-2 text-right">Sem confirmação datada</th>
              </tr></thead>
              <tbody>{etapas.map(item => (
                <tr key={`${item.sistemaDestino}-${item.etapa}`} className="border-b border-[var(--color-border)] last:border-0">
                  <th scope="row" className="p-2 text-left font-medium">{item.sistemaDestino} · {rotuloEtapa(item)}</th>
                  <td className="p-2 text-right">{formatarNumero(item.pendentesAtuais)}</td>
                  <td className="p-2 text-right">{formatarNumero(item.bloqueadosAtuais)}</td>
                  <td className="p-2 text-right">{formatarNumero(item.semConfirmacaoDatada)}</td>
                </tr>
              ))}</tbody>
            </table>
            {etapas.length === 0 && <p className="p-2 text-sm">Nenhuma etapa registrada para a seleção.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
