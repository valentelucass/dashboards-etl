import { useMemo } from 'react';
import { Banknote, FileText, Package, Scale, Timer, Truck } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import type { OperacaoCliente } from '../../../api/endpoints/customerService';
import { KpiDictionary } from '../../../constants/kpiDictionary';
import { buildBaseLineOption } from '../../../utils/echartsBuilders';
import { formatarDataCurta, formatarMoeda, formatarNumero, formatarPeso, formatarPorcentagem } from '../../../utils/formatadores';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import ChartCard from '../../shared/ChartCard';
import KpiCard from '../../shared/KpiCard';
import TooltipKpi from '../../shared/TooltipKpi';
import { exibirTaxa, taxa } from './percentuais';

function curva(dados: OperacaoCliente['evolucao'], inicio: string, fim: string) {
  const duracao = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000;
  const granularidade = duracao > 730 ? 'ano' : duracao > 62 ? 'mes' : 'dia';
  const tamanhoChave = { ano: 4, mes: 7, dia: 10 }[granularidade];
  const totais = new Map<string, { avaliadas: number; noPrazo: number }>();
  for (const ponto of dados) {
    const chave = ponto.dia.slice(0, tamanhoChave);
    const acumulado = totais.get(chave) ?? { avaliadas: 0, noPrazo: 0 };
    acumulado.avaliadas += ponto.finalizadas;
    acumulado.noPrazo += ponto.noPrazo;
    totais.set(chave, acumulado);
  }
  return [...totais].sort(([a], [b]) => a.localeCompare(b)).map(([chave, n]) => ({
    rotulo: granularidade === 'dia' ? formatarDataCurta(chave) : chave.split('-').reverse().join('/'),
    otif: taxa(n.noPrazo, n.avaliadas),
  }));
}

const definicoes = KpiDictionary.customerService;
export default function OperacaoConta({ dados, inicio, fim }: { dados: OperacaoCliente; inicio: string; fim: string }) {
  const { isDark } = useEchartsTheme();
  const serie = useMemo(() => curva(dados.evolucao, inicio, fim), [dados.evolucao, inicio, fim]);
  const grafico = useMemo<EChartsOption>(() => buildBaseLineOption(isDark, {
    grid: { top: 30, bottom: 18, left: 12, right: 22, containLabel: true },
    tooltip: { trigger: 'axis', renderMode: 'richText', valueFormatter: (v) => formatarPorcentagem(Number(v), 2) },
    xAxis: { type: 'category', data: serie.map(p => p.rotulo), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{ name: 'OTIF', type: 'line', showSymbol: true, symbolSize: 5, data: serie.map(p => p.otif),
      label: { show: serie.length <= 12, position: 'top', formatter: (p: {value: unknown}) => typeof p.value === 'number' ? formatarPorcentagem(p.value, 1) : '' },
    }],
  }), [isDark, serie]);
  const kpis = [
    { key: 'entregas', valor: formatarNumero(dados.totalEntregas), icon: Package, detalhe: formatarNumero(dados.finalizadas) + ' finalizadas · Pela previsão de entrega' },
    { key: 'otif', valor: exibirTaxa(dados.noPrazo, dados.finalizadas), icon: Timer, detalhe: dados.finalizadas ? formatarNumero(dados.noPrazo) + ' no prazo' : 'Sem entregas finalizadas' },
    { key: 'coleta', valor: exibirTaxa(dados.coletasNoPrazo, dados.coletasFinalizadas), icon: Truck, detalhe: dados.coletasFinalizadas ? formatarNumero(dados.coletasNoPrazo) + ' de ' + formatarNumero(dados.coletasFinalizadas) + ' no prazo' : 'Sem coletas finalizadas' },
    { key: 'peso', valor: dados.pesoRealKg === null ? '—' : formatarPeso(dados.pesoRealKg), icon: Scale },
    { key: 'notaFiscal', valor: dados.valorNf === null ? '—' : formatarMoeda(dados.valorNf), icon: FileText },
    { key: 'frete', valor: dados.valorFrete === null ? '—' : formatarMoeda(dados.valorFrete), icon: Banknote, detalhe: 'Pela previsão de entrega' },
  ] as const;
  return <section className="cs-operacao" aria-label="Entregas e coletas">
    <div className="cs-kpis">
      {kpis.map(({ key, valor, icon: Icon, ...rest }) => <TooltipKpi key={key} definition={definicoes[key]} className="h-full">
        <KpiCard className="h-full" label={definicoes[key].titulo} valor={valor} helperText={'detalhe' in rest ? rest.detalhe : undefined} icone={<Icon size={16} />} />
      </TooltipKpi>)}
    </div>
    <div className="cs-operacao-graficos">
      <ChartWrapper titulo="Evolução do OTIF" chartKey="csEvolucao" option={grafico} isEmpty={!serie.some(p => p.otif !== null)}
        emptyMessage="Sem entregas finalizadas no período." />
      <ChartCard titulo="Entregas por status" chartKey="csStatus" isEmpty={dados.porStatus.length === 0} emptyMessage="Sem entregas no período.">
        <ul className="cs-status">
          {dados.porStatus.map(status => <li key={status.status}>
            <div className="cs-medida"><span>{status.status}</span><strong>{formatarNumero(status.quantidade)}</strong></div>
            <div className="cs-trilho" aria-hidden="true"><span style={{width: (taxa(status.quantidade, dados.totalEntregas) ?? 0) + '%'}} /></div>
            <small>{exibirTaxa(status.quantidade, dados.totalEntregas)}</small>
          </li>)}
        </ul>
      </ChartCard>
    </div>
  </section>;
}
