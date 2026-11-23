import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import ChartCard from '../../shared/ChartCard';
import { buildBaseBarOption } from '../../../utils/echartsBuilders';
import { formatarMoeda, formatarPorcentagem } from '../../../utils/formatadores';
import { escapeHtml } from '../../../utils/escapeHtml';
import type { resumirRede } from './indicadoresRede';
import { exibirMoeda, exibirTaxa, nomeCurto } from './indicadoresRede';

type Resumo = ReturnType<typeof resumirRede>;

function tooltipCompleto(pontos: unknown, formato: (n: number) => string) {
  const itens = (Array.isArray(pontos) ? pontos : [pontos]) as {name?: string; value?: number | null; seriesName?: string}[];
  return [escapeHtml(itens[0]?.name), ...itens.filter(p => typeof p.value === 'number')
    .map(p => `${escapeHtml(p.seriesName)} · ${formato(Number(p.value))}`)].join('<br/>');
}

function siglaENome(valor: string | number) {
  // Astryx mede a margem com os limites numéricos mesmo no eixo de categorias.
  if (typeof valor === 'number') return String(valor);
  const nome = nomeCurto(valor);
  const separador = nome.indexOf(' - ');
  return separador < 0 ? nome : `${nome.slice(0, separador)} · ${nome.slice(separador + 3).split(/\s+/)[0]}`;
}

export default function PaineisRede({ resumo, erroDesempenho, erroCustos, parcialCustos, aguardandoCustos }: {
  resumo: Resumo; erroDesempenho?: string; erroCustos?: string; parcialCustos: string; aguardandoCustos: string;
}) {
  const { isDark } = useEchartsTheme();
  const ranking = useMemo(() => resumo.parceiros
    .filter(p => p.otif !== null)
    .sort((a, b) => (b.otif ?? 0) - (a.otif ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR')).slice(0, 5), [resumo.parceiros]);
  const rankingOption: EChartsOption = useMemo(() => buildBaseBarOption(isDark, {
    grid: { left: 8, right: 46, top: 16, bottom: 20, containLabel: true },
    tooltip: { trigger: 'axis', formatter: (p: unknown) => tooltipCompleto(p, n => formatarPorcentagem(n, 2)) },
    xAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    yAxis: { type: 'category', inverse: true, data: ranking.map(p => p.nome), axisLabel: { width: 130, formatter: siglaENome } },
    series: [{ name: 'OTIF', type: 'bar', barMaxWidth: 25, data: ranking.map(p => p.otif),
      label: { show: true, position: 'right', formatter: (p: { value: unknown }) => formatarPorcentagem(Number(p.value), 1) } }],
  }), [ranking, isDark]);
  const custosOption: EChartsOption = useMemo(() => buildBaseBarOption(isDark, {
    grid: { left: 10, right: 12, bottom: 48, top: 15, containLabel: true },
    legend: { bottom: 0 },
    tooltip: { trigger: 'axis', formatter: (p: unknown) => tooltipCompleto(p, formatarMoeda) },
    xAxis: { type: 'category', data: resumo.dias.map(p => p.dia.split('-').reverse().join('/')),
      axisLabel: { hideOverlap: true, formatter: (data: string | number) => String(data).slice(0, 5) } },
    yAxis: { type: 'value', axisLabel: { formatter: (v: number) => v.toLocaleString('pt-BR', { notation: 'compact' }) } },
    series: [
      { name: 'Cobrado', type: 'bar', barMaxWidth: 25, data: resumo.dias.map(p => p.cobrado) },
      { name: 'Calculado', type: 'bar', barMaxWidth: 25, data: resumo.dias.map(p => p.calculado) },
    ],
  }), [resumo.dias, isDark]);

  return <>
    <div className="grid min-w-0 gap-4 xl:grid-cols-2">
      <ChartWrapper titulo="Top 5 filiais parceiras por OTIF" chartKey="redeRankingOtif" option={rankingOption}
        erro={erroDesempenho} isEmpty={!ranking.length} emptyMessage="Sem entrega finalizada com filial parceira identificada." />
      <ChartWrapper titulo="Custo da rede por dia de emissão" chartKey="redeCustosDiarios" option={custosOption}
        actions={parcialCustos ? <small className="rede-legenda">{parcialCustos}</small> : undefined}
        erro={erroCustos} isEmpty={!resumo.dias.length} emptyMessage={aguardandoCustos || (parcialCustos ? 'Nenhuma consolidação nos dias publicados.' : 'Sem consolidações para os filtros selecionados.')} />
    </div>
    <ChartCard titulo="Indicadores por parceiro" chartKey="redeIndicadoresParceiro" isEmpty={!resumo.parceiros.length}
      emptyMessage="Nenhum parceiro encontrado nas fontes disponíveis para este período.">
      <p className="rede-legenda">OTIF e EFD seguem a data da ocorrência. Coletas usam a solicitação, comprovantes usam a previsão da entrega e custos usam a emissão da consolidação.</p>
      <div className="rede-tabela" role="region" aria-label="Indicadores por parceiro" tabIndex={0}>
        <table>
          <thead><tr>{['Parceiro', 'OTIF', 'EFD', 'Coleta', 'Anexados', 'Arquivados', 'Cobrado', 'Calculado', 'Diferença'].map(titulo => <th key={titulo} scope="col">{titulo}</th>)}</tr></thead>
          <tbody>{resumo.parceiros.map(p => <tr key={p.nome}>
            <th scope="row" title={p.nome}>{nomeCurto(p.nome)}</th>
            <td>{exibirTaxa(p.otif)}</td><td>{exibirTaxa(p.efd)}</td><td>{exibirTaxa(p.coleta)}</td>
            <td>{exibirTaxa(p.anexado)}</td><td>{exibirTaxa(p.arquivado)}</td>
            <td>{exibirMoeda(p.cobrado)}</td><td>{exibirMoeda(p.calculado)}</td><td>{exibirMoeda(p.diferenca)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="rede-legenda mt-3">{parcialCustos && `Custos parciais. ${parcialCustos}. `}O traço indica ausência de medição para o período.</p>
    </ChartCard>
  </>;
}
