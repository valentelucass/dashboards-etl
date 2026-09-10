import { escapeHtml } from '../utils/escapeHtml';
import { useCallback, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import FaturasPorClienteKpiGrid from '../components/domain/faturasPorCliente/FaturasPorClienteKpiGrid';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarFaturasPorClienteCsv } from '../api/endpoints/faturasPorClienteServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useClientes, useFaturasPorClienteClientesCnpj, useFiliais } from '../hooks/queries/useDimensoes';
import {
  useFaturasPorClienteAging,
  useFaturasPorClienteAgingDrilldown,
  useFaturasPorClienteOverview,
  useFaturasPorClienteSerie,
  useFaturasPorClienteStatusEvolucao,
  useFaturasPorClienteStatusProcesso,
  useFaturasPorClienteTabelaPaginada,
  useFaturasPorClienteTopClientesDrilldown,
} from '../hooks/queries/useFaturasPorCliente';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type {
  FaturaPorClienteResumoRow,
  FaturasPorClienteAgingEscopo,
  FaturasPorClienteDrilldownNivel,
  FaturasPorClienteFiltro,
  FaturasPorClienteGranularidade,
  FaturasPorClienteMetrica,
  FaturasPorClienteReferenciaTemporal,
} from '../types/faturasPorCliente';
import { buildBaseBarOption, buildBaseDonutOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const LIMITES = [5, 10, 15] as const;
const METRICAS_SERIE: Array<{ value: FaturasPorClienteMetrica; label: string }> = [
  { value: 'valor_faturado', label: 'Valor faturado' },
  { value: 'registros_faturados', label: 'Nº de faturas' },
  { value: 'ticket_medio', label: 'Ticket médio' },
];
const METRICAS_CLIENTE: Array<{ value: FaturasPorClienteMetrica; label: string }> = [
  ...METRICAS_SERIE,
  { value: 'valor_em_atraso', label: 'Valor em atraso' },
];

function formatarMetrica(valor: number, metrica: FaturasPorClienteMetrica) {
  return metrica === 'registros_faturados' ? valor.toLocaleString('pt-BR') : formatarMoeda(valor);
}

function nivelLabel(nivel: FaturasPorClienteDrilldownNivel) {
  if (nivel === 'cnpj') return 'CNPJs';
  if (nivel === 'fatura') return 'Faturas';
  return 'Visão geral';
}

function abreviar(label: string) {
  return label.length > 26 ? `${label.slice(0, 25).trimEnd()}…` : label;
}

export default function FaturasPorClientePage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const [serieGranularidade, setSerieGranularidade] = useState<FaturasPorClienteGranularidade>('dia');
  const [serieReferencia, setSerieReferencia] = useState<FaturasPorClienteReferenciaTemporal>('emissao');
  const [serieMetrica, setSerieMetrica] = useState<FaturasPorClienteMetrica>('valor_faturado');
  const [agingEscopo, setAgingEscopo] = useState<FaturasPorClienteAgingEscopo>('todos');
  const [agingMetrica, setAgingMetrica] = useState<'valor' | 'titulos'>('valor');
  const [agingFaixa, setAgingFaixa] = useState<string | null>(null);
  const [agingNivel, setAgingNivel] = useState<FaturasPorClienteDrilldownNivel>('cliente');
  const [agingCliente, setAgingCliente] = useState<string | null>(null);
  const [clienteLimite, setClienteLimite] = useState<(typeof LIMITES)[number]>(10);
  const [clienteMetrica, setClienteMetrica] = useState<FaturasPorClienteMetrica>('valor_faturado');
  const [clienteNivel, setClienteNivel] = useState<FaturasPorClienteDrilldownNivel>('cliente');
  const [clienteSelecionado, setClienteSelecionado] = useState<string | null>(null);
  const [cnpjSelecionado, setCnpjSelecionado] = useState<string | null>(null);
  const [statusVisao, setStatusVisao] = useState<'distribuicao' | 'evolucao'>('distribuicao');
  const [statusGranularidade, setStatusGranularidade] = useState<FaturasPorClienteGranularidade>('dia');
  const filiais = useFiliais();
  const clientes = useClientes();
  const clientesCnpj = useFaturasPorClienteClientesCnpj();

  const filtro: FaturasPorClienteFiltro = useMemo(() => ({
    dataInicio, dataFim, filiais: filtros.filiais, parceirosLogisticos: filtros.parceirosLogisticos,
    pagadores: filtros.pagadores, clientesCnpj: filtros.clientesCnpj, statusProcesso: filtros.statusProcesso,
  }), [dataFim, dataInicio, filtros.clientesCnpj, filtros.filiais, filtros.pagadores, filtros.parceirosLogisticos, filtros.statusProcesso]);
  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Pagadores', count: filtros.pagadores?.length ?? 0, onRemove: () => setFiltro('pagadores', []) },
    { label: 'CNPJs', count: filtros.clientesCnpj?.length ?? 0, onRemove: () => setFiltro('clientesCnpj', []) },
    { label: 'Status Processo', count: filtros.statusProcesso?.length ?? 0, onRemove: () => setFiltro('statusProcesso', []) },
  ];

  const overview = useFaturasPorClienteOverview(filtro);
  const serie = useFaturasPorClienteSerie(filtro, serieGranularidade, serieReferencia, serieMetrica);
  const aging = useFaturasPorClienteAging(filtro, agingEscopo);
  const agingDrilldown = useFaturasPorClienteAgingDrilldown(filtro, agingFaixa, agingNivel, agingCliente);
  const topClientes = useFaturasPorClienteTopClientesDrilldown(filtro, clienteLimite, clienteMetrica, clienteNivel, clienteSelecionado, cnpjSelecionado);
  const statusProcesso = useFaturasPorClienteStatusProcesso(filtro);
  const statusEvolucao = useFaturasPorClienteStatusEvolucao(filtro, statusGranularidade);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useFaturasPorClienteTabelaPaginada(filtro, paginacaoTabela.pagina, paginacaoTabela.tamanhoPagina, filtrosTabela.apiFilters);
  const tokens = getEchartsThemeTokens(isDark);

  usePageHeader({ title: 'Faturas por Cliente', description: 'Visão operacional de faturamento por cliente baseada em `ID Único`.', updatedAt: overview.data?.updatedAt ?? null });

  const serieOption = useMemo<EChartsOption>(() => buildBaseBarOption(isDark, {
    xAxis: { type: 'category', data: (serie.data ?? []).map((item) => item.periodo), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value' },
    tooltip: { trigger: 'axis', formatter: (items: unknown) => {
      const item = (items as Array<{ name: string; value: number }>)[0];
      return `${escapeHtml(item?.name ?? '')}<br/>${formatarMetrica(Number(item?.value ?? 0), serieMetrica)}`;
    } },
    series: [{ name: METRICAS_SERIE.find((item) => item.value === serieMetrica)?.label, type: 'bar', data: (serie.data ?? []).map((item) => item.valor), itemStyle: { color: tokens.palette[0] } }],
  }), [isDark, serie.data, serieMetrica, tokens.palette]);

  const dadosAging = useMemo(() => agingFaixa ? agingDrilldown.data ?? [] : aging.data ?? [], [aging.data, agingDrilldown.data, agingFaixa]);
  const labelsAging = useMemo(() => agingFaixa
    ? (agingDrilldown.data ?? []).map((item) => item.label)
    : (aging.data ?? []).map((item) => item.faixa), [aging.data, agingDrilldown.data, agingFaixa]);
  const agingOption = useMemo<EChartsOption>(() => buildBaseBarOption(isDark, {
    grid: { left: 12, right: 24, top: 24, bottom: 36, containLabel: true },
    xAxis: { type: agingFaixa ? 'value' : 'category', data: agingFaixa ? undefined : labelsAging },
    yAxis: agingFaixa ? { type: 'category', data: [...labelsAging].reverse(), axisLabel: { formatter: abreviar } } : { type: 'value' },
    tooltip: { trigger: agingFaixa ? 'axis' : 'item', formatter: (item: unknown) => {
      const point = Array.isArray(item) ? item[0] : item as { name?: string; value?: number };
      return `${escapeHtml(point?.name ?? '')}<br/>${agingMetrica === 'valor' ? formatarMoeda(Number(point?.value ?? 0)) : Number(point?.value ?? 0).toLocaleString('pt-BR')}`;
    } },
    series: [{ type: 'bar', data: dadosAging.map((item) => agingMetrica === 'valor' ? item.valor : ('registros' in item ? item.registros : item.titulos)).reverse(), itemStyle: { color: tokens.palette[1] } }],
  }), [agingFaixa, agingMetrica, dadosAging, isDark, labelsAging, tokens.palette]);

  const topOption = useMemo<EChartsOption>(() => buildBaseBarOption(isDark, {
    grid: { left: 16, right: 20, top: 15, bottom: 0, containLabel: true },
    xAxis: {
      type: 'category',
      data: (topClientes.data ?? []).map((item) => item.label),
      axisLabel: { formatter: abreviar, rotate: 28, interval: 0, hideOverlap: true },
    },
    yAxis: [
      { type: 'value' },
      { type: 'value', min: 0, max: 100, position: 'right', axisLabel: { formatter: '{value}%' } },
    ],
    tooltip: { trigger: 'axis', formatter: (items: unknown) => {
      const item = (items as Array<{ name: string; value: number }>)[0];
      const point = (topClientes.data ?? []).find((dado) => dado.label === item?.name);
      return `${escapeHtml(item?.name ?? '')}<br/>${formatarMetrica(Number(item?.value ?? 0), clienteMetrica)}<br/>Participação acumulada: ${point?.percentualAcumulado.toFixed(1) ?? '0'}%`;
    } },
    series: [
      { type: 'bar', data: (topClientes.data ?? []).map((item) => item.valor), itemStyle: { color: tokens.palette[2] } },
      { type: 'line', yAxisIndex: 1, data: (topClientes.data ?? []).map((item) => item.percentualAcumulado), itemStyle: { color: tokens.palette[1] } },
    ],
  }), [clienteMetrica, isDark, tokens.palette, topClientes.data]);

  const statusOption = useMemo<EChartsOption>(() => statusVisao === 'distribuicao'
    ? buildBaseDonutOption(isDark, { series: [{ name: 'Status do Processo', type: 'pie', data: (statusProcesso.data ?? []).map((item) => ({ name: item.statusProcesso, value: item.total })) }] })
    : buildBaseBarOption(isDark, {
      legend: { bottom: 0 },
      xAxis: { type: 'category', data: (statusEvolucao.data ?? []).map((item) => item.periodo), axisLabel: { hideOverlap: true } },
      yAxis: { type: 'value' },
      series: [
        { name: 'Faturado', type: 'bar', stack: 'status', data: (statusEvolucao.data ?? []).map((item) => item.faturado), itemStyle: { color: tokens.palette[0] } },
        { name: 'Aguardando faturamento', type: 'bar', stack: 'status', data: (statusEvolucao.data ?? []).map((item) => item.aguardandoFaturamento), itemStyle: { color: tokens.palette[1] } },
      ],
    }), [isDark, statusEvolucao.data, statusProcesso.data, statusVisao, tokens.palette]);

  const topEvents = useMemo(() => ({ click: (event: unknown) => {
    const label = (event as { name?: string }).name;
    if (!label || clienteNivel === 'fatura') return;
    if (clienteNivel === 'cliente') { setClienteSelecionado(label); setClienteNivel('cnpj'); return; }
    setCnpjSelecionado(label); setClienteNivel('fatura');
  } }), [clienteNivel]);
  const agingEvents = useMemo(() => ({ click: (event: unknown) => {
    const label = (event as { name?: string }).name;
    if (!label) return;
    if (!agingFaixa) { setAgingFaixa(label); setAgingNivel('cliente'); return; }
    if (agingNivel === 'cliente') { setAgingCliente(label); setAgingNivel('fatura'); }
  } }), [agingFaixa, agingNivel]);
  const voltarTop = useCallback(() => {
    if (clienteNivel === 'fatura') { setCnpjSelecionado(null); setClienteNivel('cnpj'); return; }
    setClienteSelecionado(null); setClienteNivel('cliente');
  }, [clienteNivel]);
  const voltarAging = useCallback(() => {
    if (agingNivel === 'fatura') { setAgingCliente(null); setAgingNivel('cliente'); return; }
    setAgingFaixa(null);
  }, [agingNivel]);
  const controls = 'h-8 rounded-md border bg-transparent px-2 text-[11px] font-semibold outline-none';
  const controlStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' };
  const drillUp = (disabled: boolean, onClick: () => void) => <button type="button" aria-label="Drill up" title="Drill up" disabled={disabled} onClick={onClick} className="flex h-8 w-8 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-35" style={controlStyle}><ChevronUp size={14} /></button>;

  const statusTabelaOptions = combinarStatusOptions(['Faturado', 'Aguardando Faturamento'], (statusProcesso.data ?? []).map((item) => item.statusProcesso), (tabela.data?.conteudo ?? []).map((item) => item.statusProcesso), filtros.statusProcesso);
  const colunasResumo: ColunaTabelaAnalitica<FaturaPorClienteResumoRow>[] = [
    { chave: 'idUnico', label: 'ID Único', fixo: true, largura: '180px', filtroTabela: 'codigo' }, { chave: 'documentoFatura', label: 'Documento', largura: '140px' }, { chave: 'emissao', label: 'Emissão' }, { chave: 'vencimento', label: 'Vencimento' }, { chave: 'baixa', label: 'Baixa' }, { chave: 'filial', label: 'Filial' }, { chave: 'clientePagador', label: 'Cliente', largura: '220px', filtroTabela: 'razaoSocial' }, { chave: 'clienteCnpj', label: 'CNPJ', largura: '160px' }, { chave: 'numeroCte', label: 'CT-e' }, { chave: 'valorFaturado', label: 'Valor Faturado', formato: (valor) => formatarMoeda(Number(valor ?? 0)) }, { chave: 'statusProcesso', label: 'Status Processo', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
  ];

  return <div className="w-full">
    <FilterBar onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
      <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
      <FiliaisParceirosFilter opcoes={filiais.data ?? []} filiaisSelecionadas={filtros.filiais ?? []} parceirosSelecionados={filtros.parceirosLogisticos ?? []} onFiliaisChange={(valores) => setFiltro('filiais', valores)} onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)} isLoading={filiais.isLoading} />
      <AsyncMultiSelect label="Pagadores" opcoes={clientes.data ?? []} selecionados={filtros.pagadores ?? []} onChange={(valores) => setFiltro('pagadores', valores)} isLoading={clientes.isLoading} />
      <AsyncMultiSelect label="CNPJs" opcoes={clientesCnpj.data ?? []} selecionados={filtros.clientesCnpj ?? []} onChange={(valores) => setFiltro('clientesCnpj', valores)} isLoading={clientesCnpj.isLoading} />
      <AsyncMultiSelect label="Status Processo" opcoes={['Faturado', 'Aguardando Faturamento']} selecionados={filtros.statusProcesso ?? []} onChange={(valores) => setFiltro('statusProcesso', valores)} />
    </FilterBar>
    {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de faturas por cliente.')} tipo={getTipoErro(overview.error)} />}
    {overview.data && <FaturasPorClienteKpiGrid overview={overview.data} />}
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartWrapper titulo="Faturamento · Evolução" chartKey="faturasMensal" option={serieOption} actions={<div className="flex gap-2"><select aria-label="Granularidade" value={serieGranularidade} onChange={(event) => setSerieGranularidade(event.target.value as FaturasPorClienteGranularidade)} className={controls} style={controlStyle}><option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option></select><select aria-label="Referência temporal" value={serieReferencia} onChange={(event) => setSerieReferencia(event.target.value as FaturasPorClienteReferenciaTemporal)} className={controls} style={controlStyle}><option value="emissao">Emissão</option><option value="vencimento">Vencimento</option><option value="baixa">Baixa</option></select><select aria-label="Métrica" value={serieMetrica} onChange={(event) => setSerieMetrica(event.target.value as FaturasPorClienteMetrica)} className={controls} style={controlStyle}>{METRICAS_SERIE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>} isLoading={serie.isLoading} isEmpty={(serie.data ?? []).length === 0} />
      <ChartWrapper titulo={`Aging Operacional${agingFaixa ? ` · ${agingNivel === 'fatura' ? 'Faturas' : 'Clientes'}` : ''}`} chartKey="faturasAging" option={agingOption} onEvents={agingEvents} actions={<div className="flex items-center gap-2"><select aria-label="Escopo aging" value={agingEscopo} onChange={(event) => { setAgingEscopo(event.target.value as FaturasPorClienteAgingEscopo); setAgingFaixa(null); }} className={controls} style={controlStyle}><option value="todos">Todos</option><option value="a_vencer">A vencer</option><option value="em_atraso">Em atraso</option></select><select aria-label="Métrica aging" value={agingMetrica} onChange={(event) => setAgingMetrica(event.target.value as 'valor' | 'titulos')} className={controls} style={controlStyle}><option value="valor">Valor</option><option value="titulos">Títulos</option></select>{drillUp(!agingFaixa, voltarAging)}{agingFaixa ? <ChevronDown size={14} style={{ color: 'var(--color-primary)' }} /> : null}</div>} isLoading={agingFaixa ? agingDrilldown.isLoading : aging.isLoading} isEmpty={dadosAging.length === 0} />
    </div>
    <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartWrapper titulo={`Top Clientes · ${nivelLabel(clienteNivel)}`} chartKey="faturasTopClientes" option={topOption} onEvents={topEvents} actions={<div className="flex items-center gap-2"><select aria-label="Quantidade exibida" value={clienteLimite} onChange={(event) => setClienteLimite(Number(event.target.value) as (typeof LIMITES)[number])} className={controls} style={controlStyle}>{LIMITES.map((item) => <option key={item} value={item}>Top {item}</option>)}</select><select aria-label="Métrica de clientes" value={clienteMetrica} onChange={(event) => setClienteMetrica(event.target.value as FaturasPorClienteMetrica)} className={controls} style={controlStyle}>{METRICAS_CLIENTE.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{drillUp(clienteNivel === 'cliente', voltarTop)}{clienteNivel !== 'cliente' ? <ChevronDown size={14} style={{ color: 'var(--color-primary)' }} /> : null}</div>} isLoading={topClientes.isLoading} isEmpty={(topClientes.data ?? []).length === 0} />
      <ChartWrapper titulo={statusVisao === 'distribuicao' ? 'Status do Processo · Distribuição' : 'Status do Processo · Evolução'} chartKey="faturasStatusProcesso" option={statusOption} actions={<div className="flex gap-2"><select aria-label="Visão do status" value={statusVisao} onChange={(event) => setStatusVisao(event.target.value as 'distribuicao' | 'evolucao')} className={controls} style={controlStyle}><option value="distribuicao">Distribuição</option><option value="evolucao">Evolução</option></select>{statusVisao === 'evolucao' ? <select aria-label="Granularidade do status" value={statusGranularidade} onChange={(event) => setStatusGranularidade(event.target.value as FaturasPorClienteGranularidade)} className={controls} style={controlStyle}><option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option></select> : null}</div>} isLoading={statusVisao === 'distribuicao' ? statusProcesso.isLoading : statusEvolucao.isLoading} isEmpty={statusVisao === 'distribuicao' ? (statusProcesso.data ?? []).length <= 1 : (statusEvolucao.data ?? []).length === 0} emptyMessage={(statusProcesso.data ?? []).length === 1 ? `${statusProcesso.data?.[0].total.toLocaleString('pt-BR')} registros em ${statusProcesso.data?.[0].statusProcesso}. Selecione Evolução para acompanhar o período.` : undefined} />
    </div>
    <div className="mb-3 flex justify-end"><ExportButton nomeArquivo="faturas-por-cliente" onExport={() => exportarFaturasPorClienteCsv(filtro, filtrosTabela.apiFilters)} /></div>
    <AnalyticalDataTable titulo="Faturas por Cliente" dados={tabela.data?.conteudo ?? []} colunas={colunasResumo} chaveLinha="idUnico" filtros={filtrosTabela.filters} hiddenActiveCount={filtrosTabela.hiddenActiveCount} hasAnyFilter={filtrosTabela.hasAnyFilter} onTextFilterChange={filtrosTabela.setTextFilter} onMultiFilterChange={filtrosTabela.setMultiFilter} onColumnFilterChange={filtrosTabela.setColumnFilter} onClearFilters={filtrosTabela.clearTableFilters} statusOptions={statusTabelaOptions} statusOptionsLoading={statusProcesso.isLoading} isLoading={tabela.isLoading} error={tabela.error} errorFallbackMessage="Erro ao carregar faturas por cliente." totalRegistros={tabela.data?.totalElementos} paginaAtual={paginacaoTabela.pagina} tamanhoPagina={paginacaoTabela.tamanhoPagina} onPaginaChange={paginacaoTabela.setPagina} onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina} />
  </div>;
}
