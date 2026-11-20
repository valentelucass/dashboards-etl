import { LoadingKpiGrid } from '../components/shared/DashboardLoading';
import { DashboardInput } from '../components/shared/DashboardTextEntry';
import TrackingMatriz from '../components/domain/tracking/TrackingMatriz';
import { useEffect, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import TrackingKpiGrid from '../components/domain/tracking/TrackingKpiGrid';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarTrackingCsv } from '../api/endpoints/trackingServico';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais } from '../hooks/queries/useDimensoes';
import { useTrackingClassificacoes, useTrackingDashboard, useTrackingDetalhesPaginada } from '../hooks/queries/useTracking';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type { TrackingFiltro, TrackingRawRow } from '../types/tracking';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { buildBaseBarOption, buildBaseDonutOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda, formatarPeso } from '../utils/formatadores';

const STATUS_BASE = ['No Armazém', 'Em Transferência', 'Manifestada', 'Em Entrega', 'Finalizadas'];
const FILIAL_ATUAL_PADRAO = 'AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA';
function numeroCurto(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function rotuloCurtoRegiao(valor: string): string {
  const texto = valor.trim();
  const primeiraParte = texto.split(/\s*-\s*/)[0]?.trim() || texto;

  if (/^[A-Za-z0-9_/-]{2,8}$/.test(primeiraParte)) {
    return primeiraParte.toUpperCase();
  }

  return texto.length > 14 ? `${texto.slice(0, 12)}...` : texto;
}

function corStatusRosca(status: string, index: number, isDark: boolean): string {
  const tokens = getEchartsThemeTokens(isDark);
  const statusColors: Record<string, string> = {
    'no armazém': 'var(--color-data-categorical-teal)',
    manifestada: 'var(--color-data-categorical-blue)',
    'em transferência': 'var(--color-data-categorical-purple)',
    'em entrega': 'var(--color-data-categorical-orange)',
    finalizadas: 'var(--color-data-categorical-green)',
  };

  return statusColors[status.toLowerCase()] ?? tokens.palette[index % tokens.palette.length];
}

function codigoFilialAtual(valor: string): string {
  const texto = valor.trim();
  const prefixo = texto.split(/\s*[-–—]\s*/)[0]?.trim() || texto;
  return prefixo.slice(0, 3).toUpperCase();
}

function normalizarTexto(valor: string): string {
  return valor.trim().toLowerCase();
}

export default function TrackingPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const filiais = useFiliais();

  const filiaisDisponiveis = useMemo(() => filiais.data ?? [], [filiais.data]);
  const filiaisAtuaisSelecionadas = filtros.filialAtual ?? [];
  const filialAtualContexto = filiaisAtuaisSelecionadas.at(-1)?.trim() ?? '';
  const filialAtualPadrao = useMemo(
    () => filiaisDisponiveis.find((filial) => filial.toUpperCase().startsWith('AGU -')) ?? filiaisDisponiveis[0] ?? FILIAL_ATUAL_PADRAO,
    [filiaisDisponiveis],
  );
  const filiaisCarregadas = filiaisDisponiveis.length > 0;
  const filialAtualExiste = filiaisCarregadas
    ? filiaisDisponiveis.some((filial) => normalizarTexto(filial) === normalizarTexto(filialAtualContexto))
    : filialAtualContexto.includes(' - ');
  const deveInjetarFilialPadrao = !filialAtualExiste;
  const filialAtualFiltro = deveInjetarFilialPadrao ? [filialAtualPadrao] : [filialAtualContexto];
  const filialAtualSelecionada = filialAtualFiltro[0] ?? FILIAL_ATUAL_PADRAO;

  useEffect(() => {
    if (deveInjetarFilialPadrao) {
      setFiltro('filialAtual', [filialAtualPadrao]);
    }
  }, [deveInjetarFilialPadrao, filialAtualPadrao, setFiltro]);

  const numeroMinuta = filtros.numeroMinuta?.[0] ?? '';
  const contextoClassificacao: TrackingFiltro = {
    dataInicio,
    dataFim,
    filialAtual: filialAtualFiltro,
    statusCarga: filtros.statusCarga,
    numeroMinuta: numeroMinuta || undefined,
  };

  const filtro = { ...contextoClassificacao, classificacoes: filtros.classificacoes };
  const classificacoes = useTrackingClassificacoes(contextoClassificacao);

  const activeFilters: ActiveFilter[] = [
    {
      label: 'Filial Atual',
      count: filialAtualFiltro.length,
      valueLabel: codigoFilialAtual(filialAtualSelecionada),
      onRemove: normalizarTexto(filialAtualSelecionada) === normalizarTexto(filialAtualPadrao)
        ? undefined : () => setFiltro('filialAtual', []),
    },
    { label: 'Minuta', count: numeroMinuta ? 1 : 0, valueLabel: numeroMinuta, onRemove: () => setFiltro('numeroMinuta', []) },
    { label: 'Classificação do frete', count: filtros.classificacoes?.length ?? 0, valueLabel: filtros.classificacoes?.length === 1 ? filtros.classificacoes[0] : undefined, onRemove: () => setFiltro('classificacoes', []) },
    { label: 'Status', count: filtros.statusCarga?.length ?? 0, onRemove: () => setFiltro('statusCarga', []) },
  ];

  const dashboard = useTrackingDashboard(filtro);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useTrackingDetalhesPaginada(
    filtro,
    paginacaoTabela.pagina,
    paginacaoTabela.tamanhoPagina,
    filtrosTabela.apiFilters,
  );

  usePageHeader({
    title: 'Localização de Cargas',
    description: 'Acompanhe as cargas por responsável e região até a minuta e suas notas fiscais.',
    updatedAt: dashboard.data?.overview.updatedAt ?? null,
  });

  const statusData = useMemo(() => dashboard.data?.graficos.statusDistribuicao ?? [], [dashboard.data?.graficos.statusDistribuicao]);
  const valorRegiao = useMemo(() => dashboard.data?.graficos.valorPorRegiaoDestino ?? [], [dashboard.data?.graficos.valorPorRegiaoDestino]);
  const matriz = dashboard.data?.matrizRegiaoDestino ?? [];

  const valorChartData = useMemo(() => valorRegiao, [valorRegiao]);
  const statusTotal = useMemo(() => statusData.reduce((total, item) => total + item.total, 0), [statusData]);

  const statusOption: EChartsOption = useMemo(() => buildBaseDonutOption(isDark, {
    tooltip: { trigger: 'item', formatter: '{b}<br/>{c} cargas ({d}%)' },
    title: {
      text: numeroCurto(statusTotal),
      subtext: 'Cargas',
      left: 'center',
      top: '36%',
      textStyle: {
        fontSize: 22,
        fontWeight: 800,
      },
      subtextStyle: {
        fontSize: 11,
        fontWeight: 600,
      },
    },
    legend: {
      type: 'scroll',
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      formatter: (name: string) => {
        const item = statusData.find((status) => status.status === name);
        return item ? `${name} (${numeroCurto(item.total)})` : name;
      },
    },
    series: [{
      name: 'Cargas',
      type: 'pie',
      minAngle: 4,
      avoidLabelOverlap: true,
      data: statusData.map((item, index) => ({
        name: item.status,
        value: item.total,
        itemStyle: { color: corStatusRosca(item.status, index, isDark) },
      })),
      emphasis: {
        label: {
          show: true,
          formatter: '{b}\n{c} cargas\n{d}%',
          fontSize: 12,
          fontWeight: 700,
        },
      },
    }],
  }), [isDark, statusData, statusTotal]);

  const valorRegiaoOption: EChartsOption = useMemo(() => buildBaseBarOption(isDark, {
    tooltip: { trigger: 'axis' },
    grid: { left: 66, right: 12, top: 10, bottom: 38 },
    xAxis: {
      type: 'category',
      data: valorChartData.map((item) => item.regiaoDestino),
      axisLabel: {
        rotate: 0,
        interval: 0,
        width: 52,
        overflow: 'truncate',
        margin: 10,
        formatter: (value: string) => rotuloCurtoRegiao(value),
      },
    },
    yAxis: { type: 'value' },
    series: [{
      name: 'Valor Frete',
      type: 'bar',
      barWidth: 18,
      barCategoryGap: '32%',
      data: valorChartData.map((item) => item.valorFrete),
      itemStyle: { color: getEchartsThemeTokens(isDark).palette[1] },
    }],
  }), [isDark, valorChartData]);

  const colunas: ColunaTabelaAnalitica<TrackingRawRow>[] = [
    { chave: 'numeroMinuta', label: 'Minuta', fixo: true, filtroTabela: 'codigo' },
    { chave: 'dataFrete', label: 'Data' },
    { chave: 'statusCarga', label: 'Status', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
    { chave: 'filialAtual', label: 'Filial Atual' },
    { chave: 'filialDestino', label: 'Filial Destino' },
    { chave: 'regiaoDestino', label: 'Região Destino', filtroTabela: 'destino' },
    { chave: 'pesoTaxadoRaw', label: 'Peso', formato: (valor) => formatarPeso(Number(valor ?? 0)) },
    { chave: 'valorFrete', label: 'Valor Frete', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'previsaoEntrega', label: 'Previsão' },
  ];

  function alternarStatus(status: string) {
    const atuais = filtros.statusCarga ?? [];
    setFiltro('statusCarga', atuais.includes(status) ? atuais.filter((item) => item !== status) : [...atuais, status]);
  }

  return (
    <div className="w-full">
      <FilterBar
        period={(
          <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
        )}
        onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
        <AsyncMultiSelect
          label="Filial Atual"
          opcoes={filiaisDisponiveis}
          selecionados={filialAtualFiltro}
          onChange={(valores) => setFiltro('filialAtual', valores.slice(-1))}
          placeholder="Selecione"
          isLoading={filiais.isLoading}
        />
        <div className="dashboard-filter-select">
          <label htmlFor="tracking-numero-minuta" className="dashboard-filter-select-label">Número da minuta</label>
          <DashboardInput id="tracking-numero-minuta" type="text" inputMode="numeric" aria-label="Número da minuta" placeholder="Nº da minuta"
            value={numeroMinuta} maxLength={19}
            onChange={(event) => {
              const valor = event.target.value.trim();
              if (/^\d*$/.test(valor)) setFiltro('numeroMinuta', valor ? [valor] : []);
            }}
            className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-3 text-sm" />
        </div>
        <AsyncMultiSelect
          label="Status"
          opcoes={STATUS_BASE}
          selecionados={filtros.statusCarga ?? []}
          onChange={(valores) => setFiltro('statusCarga', valores)}
        />
        <AsyncMultiSelect
          label="Classificação do frete"
          opcoes={classificacoes.data ?? []}
          selecionados={filtros.classificacoes ?? []}
          onChange={(valores) => setFiltro('classificacoes', valores)}
          isLoading={classificacoes.isLoading}
          erro={classificacoes.isError ? getApiErrorMessage(classificacoes.error, 'Erro ao carregar classificações.') : null}
        />
      </FilterBar>

      {dashboard.isError && <MensagemErro mensagem={getApiErrorMessage(dashboard.error, 'Erro ao carregar localização de cargas.')} tipo={getTipoErro(dashboard.error)} />}
      {dashboard.isLoading && !dashboard.data && <LoadingKpiGrid count={6} className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" />}
      {dashboard.data && <TrackingKpiGrid overview={dashboard.data.overview} />}

      <div className="mb-6">
        <TrackingMatriz key={JSON.stringify(filtro)} linhas={matriz} filtro={filtro} status={STATUS_BASE} alternarStatus={alternarStatus}
          carregando={dashboard.isLoading} erro={dashboard.error} tentar={() => void dashboard.refetch()} />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper titulo="Distribuição de Status" chartKey="trackingStatus" option={statusOption} isLoading={dashboard.isLoading} isEmpty={statusData.length === 0} altura={350} erro={dashboard.isError ? getApiErrorMessage(dashboard.error) : null} />
        <ChartWrapper titulo="Valor por Região de Destino" chartKey="trackingValorRegiao" option={valorRegiaoOption} isLoading={dashboard.isLoading} isEmpty={valorRegiao.length === 0} altura={350} erro={dashboard.isError ? getApiErrorMessage(dashboard.error) : null} />
      </div>

      <AnalyticalDataTable
        acoesCabecalho={<ExportButton nomeArquivo="localizacao-cargas" onExport={() => exportarTrackingCsv(filtro, filtrosTabela.apiFilters)} />}
        titulo="Detalhamento de Cargas"
        dados={tabela.data?.conteudo ?? []}
        colunas={colunas}
        chaveLinha="numeroMinuta"
        filtros={filtrosTabela.filters}
        hiddenActiveCount={filtrosTabela.hiddenActiveCount}
        hasAnyFilter={filtrosTabela.hasAnyFilter}
        onTextFilterChange={filtrosTabela.setTextFilter}
        onMultiFilterChange={filtrosTabela.setMultiFilter}
        onColumnFilterChange={filtrosTabela.setColumnFilter}
        onClearFilters={filtrosTabela.clearTableFilters}
        statusOptions={STATUS_BASE}
        statusOptionsLoading={dashboard.isLoading}
        isLoading={tabela.isLoading}
        error={tabela.error}
        errorFallbackMessage="Erro ao carregar detalhamento de cargas."
        totalRegistros={tabela.data?.totalElementos}
        paginaAtual={paginacaoTabela.pagina}
        tamanhoPagina={paginacaoTabela.tamanhoPagina}
        onPaginaChange={paginacaoTabela.setPagina}
        onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
      />
    </div>
  );
}
