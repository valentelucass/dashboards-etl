import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import ChartWrapper from '../../charts/ChartWrapper';
import { useEchartsTheme } from '../../charts/useEchartsTheme';
import ChartCard from '../../shared/ChartCard';
import DashboardButton from '../../shared/DashboardButton';
import DashboardSelector from '../../shared/DashboardSelector';
import {
  useClientesEmAtraso, useEvolucaoFretes, useFaturasPorClienteAging, useFaturasPorClienteAgingDrilldown,
  useFaturasPorClienteTopClientes, useFaturasPorClienteTopClientesDrilldown,
} from '../../../hooks/queries/useFaturasPorCliente';
import type {
  FaturasPorClienteAgingEscopo, FaturasPorClienteFiltro, FaturasPorClienteGranularidade,
  FaturasPorClienteReferenciaTemporal, FaturasPorClienteTopCliente,
} from '../../../types/faturasPorCliente';
import { getApiErrorMessage } from '../../../utils/apiError';
import { CORES } from '../../../utils/chartColors';
import { buildBaseBarOption } from '../../../utils/echartsBuilders';
import { formatarDataCurta, formatarMoeda, formatarNumero } from '../../../utils/formatadores';

interface Props {
  filtro: FaturasPorClienteFiltro;
}

const moedaTooltip = (value: unknown) => formatarMoeda(Number(value));
const coresVencimento: Record<string, string> = {
  'A vencer': CORES.primaria, '1-15 dias': 'var(--color-data-yellow-4)', '16-30 dias': CORES.aviso,
  '31-60 dias': CORES.perigo, '61+ dias': CORES.perigo, 'Sem vencimento': CORES.cinza,
};
const controles = 'flex max-w-full flex-wrap items-center gap-2';

function Voltar({ onClick }: { onClick: () => void }) {
  return <DashboardButton aria-label="Voltar um nível" title="Voltar um nível" onClick={onClick}><ChevronUp size={15} /></DashboardButton>;
}

function ContasPorVencimento({ filtro }: Props) {
  const { isDark } = useEchartsTheme();
  const [escopo, setEscopo] = useState<FaturasPorClienteAgingEscopo>('todos');
  const [metrica, setMetrica] = useState('valor');
  const [faixa, setFaixa] = useState<string | null>(null);
  const [cliente, setCliente] = useState<string | null>(null);
  const aging = useFaturasPorClienteAging(filtro, escopo);
  const detalhe = useFaturasPorClienteAgingDrilldown(filtro, faixa, cliente ? 'fatura' : 'cliente', cliente);
  const consulta = faixa ? detalhe : aging;
  const linhas = faixa
    ? (detalhe.data ?? []).map(d => ({ nome: d.label, valor: d.valor, titulos: d.registros }))
    : (aging.data ?? []).filter(d => {
      if (d.faixa === 'Sem vencimento') return escopo === 'todos' && d.titulos > 0;
      return escopo === 'todos' || (escopo === 'a_vencer' ? d.faixa === 'A vencer' : d.faixa !== 'A vencer');
    }).map(d => ({ nome: d.faixa, valor: d.valor, titulos: d.titulos }));
  const valor = metrica === 'valor';
  const opcoes = buildBaseBarOption(isDark, {
    xAxis: faixa ? { type: 'value' } : { type: 'category', data: linhas.map(d => d.nome) },
    yAxis: faixa ? { type: 'category', inverse: true, data: linhas.map(d => d.nome), axisLabel: { width: 145 } } : { type: 'value' },
    tooltip: { trigger: 'axis', valueFormatter: valor ? moedaTooltip : v => formatarNumero(Number(v)) },
    series: [{ name: valor ? 'Contas a receber' : 'Títulos', type: 'bar',
      data: linhas.map(d => ({ value: valor ? d.valor : d.titulos, itemStyle: { color: coresVencimento[faixa ?? d.nome] ?? CORES.primaria } })) }],
  });
  const selecionar = ({ dataIndex }: { dataIndex: number }) => {
    const selecionada = linhas[dataIndex];
    if (!selecionada?.titulos) return;
    if (faixa) setCliente(selecionada.nome);
    else setFaixa(selecionada.nome);
  };
  return <ChartWrapper chartKey="faturasAging"
    titulo={['Contas a receber por faixa de vencimento', faixa, cliente].filter(Boolean).join(' · ')}
    option={opcoes} isLoading={consulta.isLoading} isEmpty={!linhas.some(d => d.titulos > 0)}
    emptyMessage="Nenhum título em aberto para os filtros selecionados."
    erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar as contas por vencimento.') : null}
    onEvents={cliente ? undefined : { click: e => selecionar(e as { dataIndex: number }) }}
    actions={<div className={controles}>
      <DashboardSelector aria-label="Faixas de vencimento" value={escopo} onValueChange={v => {
        setEscopo(v as FaturasPorClienteAgingEscopo); setFaixa(null); setCliente(null);
      }}>
        <option value="todos">Todas as faixas</option><option value="a_vencer">A vencer</option><option value="em_atraso">Em atraso</option>
      </DashboardSelector>
      <DashboardSelector aria-label="Métrica de vencimento" value={metrica} onValueChange={setMetrica}>
        <option value="valor">Valor</option><option value="titulos">Títulos</option>
      </DashboardSelector>
      {faixa && <Voltar onClick={() => cliente ? setCliente(null) : setFaixa(null)} />}
    </div>} />;
}

function ClientesEmAtraso({ filtro }: Props) {
  const consulta = useClientesEmAtraso(filtro);
  return <ChartCard chartKey="faturasClientesEmAtraso" titulo="Clientes com títulos em atraso"
    isLoading={consulta.isLoading} isEmpty={!consulta.data?.length}
    emptyMessage="Nenhum cliente com título vencido em aberto para os filtros selecionados."
    erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar os clientes com títulos em atraso.') : null}>
    <div className="max-w-full overflow-x-auto">
      <table aria-label="Dez clientes com mais títulos em atraso" className="w-full text-sm" style={{ color: 'var(--color-text)' }}>
        <thead className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <tr>{['Cliente', 'Títulos', 'Maior atraso', 'R$ em atraso'].map((coluna, i) =>
            <th key={coluna} scope="col" className={'px-2 py-2 ' + (i ? 'text-right' : 'text-left')}>{coluna}</th>)}</tr>
        </thead>
        <tbody>{consulta.data?.map(d => <tr key={d.clienteCnpj ?? d.cliente} className="border-t align-top" style={{ borderColor: 'var(--color-border)' }}>
          <th scope="row" className="break-words px-2 py-2 text-left font-medium [overflow-wrap:anywhere]">
            {d.cliente}
            {d.clienteCnpj && <span className="block text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>{d.clienteCnpj}</span>}
          </th>
          <td className="px-2 py-2 text-right tabular-nums">{formatarNumero(d.titulos)}</td>
          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarNumero(d.maiorAtrasoDias)} {d.maiorAtrasoDias === 1 ? 'dia' : 'dias'}</td>
          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatarMoeda(d.valorEmAtraso)}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </ChartCard>;
}

function RankingClientes({ filtro }: Props) {
  const { isDark } = useEchartsTheme();
  const [limite, setLimite] = useState<5 | 10 | 15>(10);
  const [cliente, setCliente] = useState<FaturasPorClienteTopCliente | null>(null);
  const ranking = useFaturasPorClienteTopClientes(filtro, limite);
  const detalhe = useFaturasPorClienteTopClientesDrilldown(filtro, limite, 'valor_faturado', 'fatura',
    cliente?.cliente ?? null, cliente ? cliente.clienteCnpj || 'Sem CNPJ' : null, Boolean(cliente));
  const consulta = cliente ? detalhe : ranking;
  const nomes = cliente ? (detalhe.data ?? []).map(d => d.label)
    : (ranking.data ?? []).map(d => d.clienteCnpj ? d.cliente + ' · ' + d.clienteCnpj : d.cliente);
  const faturado = cliente ? (detalhe.data ?? []).map(d => d.valor) : (ranking.data ?? []).map(d => d.valorFaturado);
  const opcoes = buildBaseBarOption(isDark, {
    xAxis: { type: 'value' },
    yAxis: { type: 'category', inverse: true, data: nomes, axisLabel: { width: 145 } },
    tooltip: { trigger: 'axis', valueFormatter: moedaTooltip },
    series: [
      { name: 'Faturado', type: 'bar', stack: 'fretes', data: faturado, itemStyle: { color: CORES.primaria } },
      ...(!cliente ? [{ name: 'A faturar', type: 'bar' as const, stack: 'fretes', data: (ranking.data ?? []).map(d => d.valorAFaturar), itemStyle: { color: CORES.aviso } }] : []),
    ],
  });
  return <ChartWrapper chartKey="faturasTopClientes" titulo={cliente
    ? ['Faturas emitidas', cliente.cliente, cliente.clienteCnpj].filter(Boolean).join(' · ')
    : 'Faturado × a faturar por cliente'}
    option={opcoes} isLoading={consulta.isLoading} isEmpty={nomes.length === 0}
    erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar o faturamento por cliente.') : null}
    onEvents={cliente ? undefined : { click: e => {
      const linha = ranking.data?.[(e as { dataIndex: number }).dataIndex];
      if (linha) setCliente(linha);
    } }}
    actions={<div className={controles}>
      <DashboardSelector aria-label={cliente ? 'Quantidade de faturas' : 'Quantidade de clientes'} value={limite}
        onValueChange={v => setLimite(Number(v) as 5 | 10 | 15)}>
        {[5, 10, 15].map(n => <option key={n} value={n}>Top {n}</option>)}
      </DashboardSelector>
      {cliente && <Voltar onClick={() => setCliente(null)} />}
    </div>} />;
}

function EvolucaoDosFretes({ filtro }: Props) {
  const { isDark } = useEchartsTheme();
  const [granularidade, setGranularidade] = useState<FaturasPorClienteGranularidade>('dia');
  const [referencia, setReferencia] = useState<FaturasPorClienteReferenciaTemporal>('emissao');
  const consulta = useEvolucaoFretes(filtro, granularidade, referencia);
  const linhas = consulta.data ?? [];
  const opcoes = buildBaseBarOption(isDark, {
    xAxis: { type: 'category', data: linhas.map(({ periodo }) => {
      if (granularidade === 'dia' || granularidade === 'semana') return formatarDataCurta(periodo);
      if (granularidade === 'mes') return periodo.slice(5, 7) + '/' + periodo.slice(0, 4);
      return periodo;
    }) },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', valueFormatter: moedaTooltip },
    series: [
      { name: 'Total dos fretes', type: 'bar', data: linhas.map(d => d.valorTotalFretes), itemStyle: { color: CORES.primaria } },
      { name: 'Total faturado', type: 'bar', data: linhas.map(d => d.valorFaturado), itemStyle: { color: CORES.cinza } },
    ],
  });
  return <ChartWrapper chartKey="faturasMensal" titulo="Evolução dos fretes e do faturamento" option={opcoes}
    isLoading={consulta.isLoading} isEmpty={!linhas.length}
    erro={consulta.isError ? getApiErrorMessage(consulta.error, 'Erro ao carregar a evolução dos fretes.') : null}
    actions={<div className={controles}>
      <DashboardSelector aria-label="Granularidade" value={granularidade} onValueChange={v => setGranularidade(v as FaturasPorClienteGranularidade)}>
        <option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option><option value="ano">Ano</option>
      </DashboardSelector>
      <DashboardSelector aria-label="Referência temporal" value={referencia} onValueChange={v => setReferencia(v as FaturasPorClienteReferenciaTemporal)}>
        <option value="emissao">Emissão</option><option value="vencimento">Vencimento</option><option value="baixa">Recebimento</option>
      </DashboardSelector>
    </div>} />;
}

export default function FinanceiroGraficos({ filtro }: Props) {
  return <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
    <ContasPorVencimento filtro={filtro} />
    <ClientesEmAtraso filtro={filtro} />
    <RankingClientes filtro={filtro} />
    <EvolucaoDosFretes filtro={filtro} />
  </div>;
}
