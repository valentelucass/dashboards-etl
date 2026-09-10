import { escapeHtml } from '../utils/escapeHtml';
import { useCallback, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import ContasAPagarKpiGrid from '../components/domain/contasAPagar/ContasAPagarKpiGrid';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarContasAPagarCsv } from '../api/endpoints/contasAPagarServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais, usePlanoContas } from '../hooks/queries/useDimensoes';
import {
  useContasAPagarDrilldownCentroCusto,
  useContasAPagarDrilldownFornecedores,
  useContasAPagarGraficos,
  useContasAPagarOverview,
  useContasAPagarSerie,
  useContasAPagarTabelaPaginada,
} from '../hooks/queries/useContasAPagar';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type {
  ContaPagarResumoRow,
  ContasAPagarDrilldownNivel,
  ContasAPagarFiltro,
  ContasAPagarGranularidade,
  ContasAPagarMetrica,
  ContasAPagarReferenciaTemporal,
} from '../types/contasAPagar';
import { buildBaseBarOption, buildBaseDonutOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const LIMITES = [5, 10, 15] as const;
const METRICAS: Array<{ value: ContasAPagarMetrica; label: string }> = [
  { value: 'valorAPagar', label: 'Valor a pagar' },
  { value: 'saldoAberto', label: 'Saldo aberto' },
  { value: 'valorPago', label: 'Valor pago' },
  { value: 'titulos', label: 'Nº títulos' },
];

function formatarValorMetrica(valor: number, metrica: ContasAPagarMetrica) {
  return metrica === 'titulos' ? valor.toLocaleString('pt-BR') : formatarMoeda(valor);
}

function labelNivel(nivel: ContasAPagarDrilldownNivel) {
  if (nivel === 'classificacao') return 'Classificações';
  if (nivel === 'despesa') return 'Despesas';
  return 'Visão geral';
}

export default function ContasAPagarPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const [granularidade, setGranularidade] = useState<ContasAPagarGranularidade>('dia');
  const [referencia, setReferencia] = useState<ContasAPagarReferenciaTemporal>('emissao');
  const [fornecedorLimite, setFornecedorLimite] = useState<(typeof LIMITES)[number]>(10);
  const [fornecedorMetrica, setFornecedorMetrica] = useState<ContasAPagarMetrica>('valorAPagar');
  const [fornecedorNivel, setFornecedorNivel] = useState<ContasAPagarDrilldownNivel>('raiz');
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<string | null>(null);
  const [fornecedorClassificacao, setFornecedorClassificacao] = useState<string | null>(null);
  const [centroLimite, setCentroLimite] = useState<(typeof LIMITES)[number]>(10);
  const [centroMetrica, setCentroMetrica] = useState<ContasAPagarMetrica>('valorAPagar');
  const [centroNivel, setCentroNivel] = useState<ContasAPagarDrilldownNivel>('raiz');
  const [centroSelecionado, setCentroSelecionado] = useState<string | null>(null);
  const [centroClassificacao, setCentroClassificacao] = useState<string | null>(null);
  const filiais = useFiliais();
  const planoContas = usePlanoContas();

  const filtro: ContasAPagarFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    classificacoes: filtros.classificacoes,
    pago: filtros.pago,
    conciliado: filtros.conciliado,
  }), [dataFim, dataInicio, filtros.classificacoes, filtros.conciliado, filtros.filiais, filtros.pago, filtros.parceirosLogisticos]);

  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Plano Contas', count: filtros.classificacoes?.length ?? 0, onRemove: () => setFiltro('classificacoes', []) },
    { label: 'Pago', count: filtros.pago?.length ?? 0, onRemove: () => setFiltro('pago', []) },
  ];

  const overview = useContasAPagarOverview(filtro);
  const serie = useContasAPagarSerie(filtro, granularidade, referencia);
  const graficos = useContasAPagarGraficos(filtro);
  const fornecedores = useContasAPagarDrilldownFornecedores(filtro, {
    limite: fornecedorLimite,
    metrica: fornecedorMetrica,
    nivel: fornecedorNivel,
    fornecedor: fornecedorSelecionado,
    classificacao: fornecedorClassificacao,
  });
  const centrosCusto = useContasAPagarDrilldownCentroCusto(filtro, {
    limite: centroLimite,
    metrica: centroMetrica,
    nivel: centroNivel,
    centroCusto: centroSelecionado,
    classificacao: centroClassificacao,
  });
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useContasAPagarTabelaPaginada(filtro, paginacaoTabela.pagina, paginacaoTabela.tamanhoPagina, filtrosTabela.apiFilters);

  usePageHeader({
    title: 'Contas a Pagar',
    description: 'Fluxo financeiro, concentração de despesas e conciliação.',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const conciliacao = useMemo(() => graficos.data?.conciliacao ?? [], [graficos.data?.conciliacao]);
  const dadosFornecedor = useMemo(() => fornecedores.data ?? [], [fornecedores.data]);
  const dadosCentro = useMemo(() => centrosCusto.data ?? [], [centrosCusto.data]);
  const tokens = useMemo(() => getEchartsThemeTokens(isDark), [isDark]);
  const statusTabelaOptions = combinarStatusOptions(
    ['Sim', 'Não'],
    (tabela.data?.conteudo ?? []).map((item) => item.statusPagamento),
    filtros.pago,
  );

  const serieOption: EChartsOption = useMemo(() => buildBaseBarOption(isDark, {
    legend: { bottom: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const itens = params as { marker?: string; seriesName: string; value: number; name: string }[];
        return [escapeHtml(itens[0]?.name), ...itens.map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName)}: ${formatarMoeda(Number(item.value ?? 0))}`)].join('<br/>');
      },
    },
    xAxis: { type: 'category', data: (serie.data ?? []).map((item) => item.month), axisLabel: { hideOverlap: true } },
    yAxis: { type: 'value', axisLabel: { formatter: (value: number) => formatarMoeda(value).replace('R$', 'R$ ') } },
    series: [
      { name: 'Pago', type: 'bar', data: (serie.data ?? []).map((item) => item.pago), itemStyle: { color: tokens.palette[2] } },
      { name: 'Aberto', type: 'bar', data: (serie.data ?? []).map((item) => item.aberto), itemStyle: { color: tokens.palette[1] } },
    ],
  }), [isDark, serie.data, tokens.palette]);

  const criarOptionRanking = useCallback((dados: typeof dadosFornecedor, metrica: ContasAPagarMetrica): EChartsOption => buildBaseBarOption(isDark, {
    grid: { left: 10, containLabel: true },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: dados.map((item) => item.label).reverse(),
      axisLabel: { formatter: (value: string) => value.length > 24 ? `${value.slice(0, 24)}…` : value },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const item = (params as { name: string; value: number }[])[0];
        const ponto = dados.find((dado) => dado.label === item?.name);
        return `${escapeHtml(item?.name ?? '')}<br/>${formatarValorMetrica(Number(item?.value ?? 0), metrica)}<br/>Títulos: ${ponto?.titulos.toLocaleString('pt-BR') ?? '0'}`;
      },
    },
    series: [{ type: 'bar', data: dados.map((item) => item.valor).reverse(), itemStyle: { color: tokens.palette[0] } }],
  }), [isDark, tokens.palette]);

  const fornecedorOption = useMemo(() => criarOptionRanking(dadosFornecedor, fornecedorMetrica), [criarOptionRanking, dadosFornecedor, fornecedorMetrica]);
  const centroOption = useMemo(() => criarOptionRanking(dadosCentro, centroMetrica), [criarOptionRanking, dadosCentro, centroMetrica]);
  const conciliacaoOption: EChartsOption = useMemo(() => buildBaseDonutOption(isDark, {
    series: [{ name: 'Conciliação', type: 'pie', data: conciliacao.map((item) => ({ name: item.status, value: item.valor })) }],
  }), [isDark, conciliacao]);

  const fornecedorEvents = useMemo(() => ({ click: (params: unknown) => {
    const label = (params as { name?: string }).name;
    if (!label || label === 'Outros' || fornecedorNivel === 'despesa') return;
    if (fornecedorNivel === 'raiz') {
      setFornecedorSelecionado(label);
      setFornecedorNivel('classificacao');
      return;
    }
    setFornecedorClassificacao(label);
    setFornecedorNivel('despesa');
  } }), [fornecedorNivel]);
  const centroEvents = useMemo(() => ({ click: (params: unknown) => {
    const label = (params as { name?: string }).name;
    if (!label || label === 'Outros' || centroNivel === 'despesa') return;
    if (centroNivel === 'raiz') {
      setCentroSelecionado(label);
      setCentroNivel('classificacao');
      return;
    }
    setCentroClassificacao(label);
    setCentroNivel('despesa');
  } }), [centroNivel]);

  const voltarFornecedor = useCallback(() => {
    if (fornecedorNivel === 'despesa') {
      setFornecedorClassificacao(null);
      setFornecedorNivel('classificacao');
      return;
    }
    setFornecedorSelecionado(null);
    setFornecedorNivel('raiz');
  }, [fornecedorNivel]);
  const voltarCentro = useCallback(() => {
    if (centroNivel === 'despesa') {
      setCentroClassificacao(null);
      setCentroNivel('classificacao');
      return;
    }
    setCentroSelecionado(null);
    setCentroNivel('raiz');
  }, [centroNivel]);

  const controlesBase = 'h-8 rounded-md border bg-transparent px-2 text-[11px] font-semibold outline-none';
  const controlesStyle = { borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' };
  const serieActions = (
    <div className="flex gap-2">
      <select aria-label="Granularidade temporal" value={granularidade} onChange={(event) => setGranularidade(event.target.value as ContasAPagarGranularidade)} className={controlesBase} style={controlesStyle}>
        <option value="dia">Dia</option><option value="semana">Semana</option><option value="mes">Mês</option>
      </select>
      <select aria-label="Data de referência" value={referencia} onChange={(event) => setReferencia(event.target.value as ContasAPagarReferenciaTemporal)} className={controlesBase} style={controlesStyle}>
        <option value="emissao">Emissão</option><option value="competencia">Competência</option><option value="liquidacao">Liquidação</option>
      </select>
    </div>
  );
  const criarAcoesDrilldown = (
    limite: (typeof LIMITES)[number],
    setLimite: (valor: (typeof LIMITES)[number]) => void,
    metrica: ContasAPagarMetrica,
    setMetrica: (valor: ContasAPagarMetrica) => void,
    nivel: ContasAPagarDrilldownNivel,
    onVoltar: () => void,
  ) => (
    <div className="flex items-center gap-2">
      <select aria-label="Quantidade exibida" value={limite} onChange={(event) => setLimite(Number(event.target.value) as (typeof LIMITES)[number])} className={controlesBase} style={controlesStyle}>
        {LIMITES.map((item) => <option key={item} value={item}>Top {item}</option>)}
      </select>
      <select aria-label="Métrica exibida" value={metrica} onChange={(event) => setMetrica(event.target.value as ContasAPagarMetrica)} className={controlesBase} style={controlesStyle}>
        {METRICAS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
      <button type="button" title={`Drill up para ${labelNivel(nivel === 'despesa' ? 'classificacao' : 'raiz')}`} aria-label="Drill up" disabled={nivel === 'raiz'} onClick={onVoltar} className="flex h-8 w-8 items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-35" style={controlesStyle}>
        <ChevronUp size={14} />
      </button>
      {nivel !== 'raiz' ? <ChevronDown size={14} aria-label={`Nível atual: ${labelNivel(nivel)}`} style={{ color: 'var(--color-primary)' }} /> : null}
    </div>
  );

  const colunas: ColunaTabelaAnalitica<ContaPagarResumoRow>[] = [
    { chave: 'lancamentoNumero', label: 'Lancamento', fixo: true, filtroTabela: 'codigo' },
    { chave: 'emissao', label: 'Emissao' },
    { chave: 'filial', label: 'Filial' },
    { chave: 'fornecedor', label: 'Fornecedor', largura: '220px', filtroTabela: 'razaoSocial' },
    { chave: 'classificacao', label: 'Classificacao' },
    { chave: 'centroCusto', label: 'Centro Custo' },
    { chave: 'valorAPagar', label: 'Valor a Pagar', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'valorPago', label: 'Valor Pago', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'statusPagamento', label: 'Pagamento', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
  ];

  return (
    <div className="w-full">
      <FilterBar onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
        <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
        <FiliaisParceirosFilter opcoes={filiais.data ?? []} filiaisSelecionadas={filtros.filiais ?? []} parceirosSelecionados={filtros.parceirosLogisticos ?? []} onFiliaisChange={(valores) => setFiltro('filiais', valores)} onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)} isLoading={filiais.isLoading} />
        <AsyncMultiSelect label="Plano Contas" opcoes={(planoContas.data ?? []).map((item) => item.classificacao)} selecionados={filtros.classificacoes ?? []} onChange={(valores) => setFiltro('classificacoes', valores)} isLoading={planoContas.isLoading} />
        <AsyncMultiSelect label="Pago" opcoes={['PAGO', 'Sim', 'Nao']} selecionados={filtros.pago ?? []} onChange={(valores) => setFiltro('pago', valores)} />
      </FilterBar>

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de contas a pagar.')} tipo={getTipoErro(overview.error)} />}
      {overview.data && <ContasAPagarKpiGrid overview={overview.data} />}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper titulo="Pagos x Abertos" chartKey="contasPagarSerie" option={serieOption} actions={serieActions} isLoading={serie.isLoading} isEmpty={(serie.data ?? []).length === 0} />
        <ChartWrapper titulo={`Top Fornecedores · ${labelNivel(fornecedorNivel)}`} chartKey="contasPagarTopFornecedores" option={fornecedorOption} actions={criarAcoesDrilldown(fornecedorLimite, setFornecedorLimite, fornecedorMetrica, setFornecedorMetrica, fornecedorNivel, voltarFornecedor)} onEvents={fornecedorEvents} isLoading={fornecedores.isLoading} isEmpty={dadosFornecedor.length === 0} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper titulo={`Centro de Custo · ${labelNivel(centroNivel)}`} chartKey="contasPagarCentroCusto" option={centroOption} actions={criarAcoesDrilldown(centroLimite, setCentroLimite, centroMetrica, setCentroMetrica, centroNivel, voltarCentro)} onEvents={centroEvents} isLoading={centrosCusto.isLoading} isEmpty={dadosCentro.length === 0} />
        <ChartWrapper titulo="Conciliação" chartKey="contasPagarConciliacao" option={conciliacaoOption} isLoading={graficos.isLoading} isEmpty={conciliacao.length === 0} />
      </div>

      <div className="mb-3 flex justify-end"><ExportButton nomeArquivo="contas-a-pagar" onExport={() => exportarContasAPagarCsv(filtro, filtrosTabela.apiFilters)} /></div>
      <AnalyticalDataTable titulo="Lançamentos Analiticos" dados={tabela.data?.conteudo ?? []} colunas={colunas} chaveLinha="lancamentoNumero" filtros={filtrosTabela.filters} hiddenActiveCount={filtrosTabela.hiddenActiveCount} hasAnyFilter={filtrosTabela.hasAnyFilter} onTextFilterChange={filtrosTabela.setTextFilter} onMultiFilterChange={filtrosTabela.setMultiFilter} onColumnFilterChange={filtrosTabela.setColumnFilter} onClearFilters={filtrosTabela.clearTableFilters} statusOptions={statusTabelaOptions} isLoading={tabela.isLoading} error={tabela.error} errorFallbackMessage="Erro ao carregar lançamentos analíticos." totalRegistros={tabela.data?.totalElementos} paginaAtual={paginacaoTabela.pagina} tamanhoPagina={paginacaoTabela.tamanhoPagina} onPaginaChange={paginacaoTabela.setPagina} onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina} />
    </div>
  );
}
