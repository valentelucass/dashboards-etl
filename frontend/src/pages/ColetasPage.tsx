import DashboardSelector from "../components/shared/DashboardSelector";
import DashboardButton from "../components/shared/DashboardButton";
import ColetasBars from '../components/domain/coletas/ColetasBars';
import { ColetasRegionChart, ColetasStatusChart } from '../components/domain/coletas/ColetasOperationalCharts';
import { escapeHtml } from '../utils/escapeHtml';
import { useCallback, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import ColetasKpiGrid from '../components/domain/coletas/ColetasKpiGrid';
import ColetasTrend from '../components/domain/coletas/ColetasTrend';
import ChartWrapper from '../components/charts/ChartWrapper';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarColetasCsv } from '../api/endpoints/coletasServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useClientes, useFiliais, useUsuarios } from '../hooks/queries/useDimensoes';
import { useColetasCidadesOrigem, useColetasOperacao, useColetasStatus, useColetasHistoricoPerformance, useColetasOverview, useColetasSerie, useColetasTabelaPaginada } from '../hooks/queries/useColetas';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type { ColetaResumoRow, ColetasFiltro, ColetasHistoricoPerformance, ColetasHistoricoPeriodo } from '../types/coletas';
import { CORES } from '../utils/chartColors';
import { formatarMoeda, formatarPeso, formatarPorcentagem } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const AGING_BUCKETS = ['0-2 dias', '3-5 dias', '6-10 dias', '11+ dias'] as const;
const ORIGEM_LIMITES = [5, 10, 15] as const;
const HISTORICO_PERIODOS: Array<{ valor: ColetasHistoricoPeriodo; label: string }> = [
  { valor: 'dias', label: 'Dias' },
  { valor: '3meses', label: '3 meses' },
  { valor: '6meses', label: '6 meses' },
  { valor: '1ano', label: '1 ano' },
];
const EMPTY_ARRAY: never[] = [];

function formatarDiaMesLabel(value: string): string {
  const [, month, day] = value.split('-');
  if (!month || !day) {
    return value;
  }
  return `${day}/${month}`;
}

function formatarMesAnoLabel(value: string): string {
  const [year, month] = value.split('-');
  if (!year || !month) {
    return value;
  }
  const data = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(data.getTime())) {
    return value;
  }
  const mes = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(data).replace('.', '');
  return `${mes}/${year.slice(-2)}`;
}

function normalizeHistoricoPeriodo(value: string): ColetasHistoricoPeriodo {
  if (value === '3meses' || value === '6meses' || value === '1ano') {
    return value;
  }
  return 'dias';
}

function formatarHistoricoLabel(value: string, periodo: ColetasHistoricoPeriodo): string {
  return periodo === 'dias' ? formatarDiaMesLabel(value) : formatarMesAnoLabel(value);
}

function HistoricoPeriodoActions({
  periodo,
  onPeriodoChange,
}: {
  periodo: ColetasHistoricoPeriodo;
  onPeriodoChange: (periodo: ColetasHistoricoPeriodo) => void;
}) {
  return (
    <div className="block">
      <span className="sr-only">Período do histórico de coletas</span>
      <DashboardSelector
        aria-label="Período do histórico de coletas"
        value={periodo}
        onValueChange={selectedValue => onPeriodoChange(normalizeHistoricoPeriodo(selectedValue))}
        className="h-8 rounded-md border px-2 text-xs font-semibold outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]"
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        {HISTORICO_PERIODOS.map((item) => (
          <option key={item.valor} value={item.valor}>
            {item.label}
          </option>
        ))}
      </DashboardSelector>
    </div>
  );
}

export default function ColetasPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const [regiaoLogisticaSelecionada, setRegiaoLogisticaSelecionada] = useState<string | null>(null);
  const [regiaoLogisticaEmFoco, setRegiaoLogisticaEmFoco] = useState<string | null>(null);
  const [origemLimite, setOrigemLimite] = useState<(typeof ORIGEM_LIMITES)[number]>(10);
  const [historicoPeriodo, setHistoricoPeriodo] = useState<ColetasHistoricoPeriodo>('dias');
  const filiais = useFiliais();
  const clientes = useClientes();
  const usuarios = useUsuarios();

  const filtro: ColetasFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    clientes: filtros.clientes,
    status: filtros.status,
    regioes: filtros.regioes,
    usuarios: filtros.usuarios,
  }), [dataFim, dataInicio, filtros.clientes, filtros.filiais, filtros.parceirosLogisticos, filtros.regioes, filtros.status, filtros.usuarios]);

  const activeFilters: ActiveFilter[] = useMemo(() => [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Clientes', count: filtros.clientes?.length ?? 0, onRemove: () => setFiltro('clientes', []) },
    { label: 'Usuários', count: filtros.usuarios?.length ?? 0, onRemove: () => setFiltro('usuarios', []) },
  ], [filtros.clientes, filtros.filiais, filtros.parceirosLogisticos, filtros.usuarios, setFiltro]);

  const overview = useColetasOverview(filtro);
  const serie = useColetasSerie(filtro);
  const statusQuery = useColetasStatus(filtro);
  const graficos = useColetasOperacao(filtro);
  const historicoPerformanceQuery = useColetasHistoricoPerformance(filtro, historicoPeriodo);
  const cidadesOrigem = useColetasCidadesOrigem(filtro, regiaoLogisticaSelecionada);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoResetKey = useMemo(() => JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }), [filtro, filtrosTabela.resetKey]);
  const paginacaoTabela = useTabelaPaginadaState(paginacaoResetKey);
  const tabela = useColetasTabelaPaginada(filtro, paginacaoTabela.pagina, paginacaoTabela.tamanhoPagina, filtrosTabela.apiFilters);

  usePageHeader({
    title: 'Coletas',
    description: 'SLA operacional, distribuição por status e coletas em aberto.',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const statusData = statusQuery.data ?? EMPTY_ARRAY;
  const historicoPerformanceResponse = historicoPerformanceQuery.data;
  const historicoPerformance = useMemo<ColetasHistoricoPerformance[]>(() => (
    (historicoPerformanceResponse ?? EMPTY_ARRAY).map((item) => ({
      date: item.date,
      performancePercentual: item.performancePercentual,
      metaPercentual: item.metaPercentual,
      finalizadas: item.finalizadas,
      noPrazo: item.noPrazo,
      foraDoPrazo: item.foraDoPrazo,
    }))
  ), [historicoPerformanceResponse]);
  const regioesOrigem = graficos.data?.regioesOrigem ?? EMPTY_ARRAY;
  const cidadesOrigemData = cidadesOrigem.data ?? EMPTY_ARRAY;
  const serieData = serie.data ?? EMPTY_ARRAY;
  const tabelaConteudo = tabela.data?.conteudo ?? EMPTY_ARRAY;
  const usuariosNomes = useMemo(() => (usuarios.data ?? EMPTY_ARRAY).map((item) => item.nome), [usuarios.data]);
  const regioesOrigemOrdenadas = useMemo(() => regioesOrigem
    .map((item) => ({ nome: item.regiaoLogistica, totalColetas: item.totalColetas, pesoTaxado: item.pesoTaxado }))
    .sort((a, b) => b.totalColetas - a.totalColetas), [regioesOrigem]);
  const cidadesOrigemOrdenadas = useMemo(() => cidadesOrigemData
    .map((item) => ({ nome: item.cidade, totalColetas: item.totalColetas, pesoTaxado: item.pesoTaxado }))
    .sort((a, b) => b.totalColetas - a.totalColetas), [cidadesOrigemData]);
  const origemData = useMemo(() => {
    const origemDataCompleta = regiaoLogisticaSelecionada ? cidadesOrigemOrdenadas : regioesOrigemOrdenadas;
    return origemDataCompleta.slice(0, origemLimite);
  }, [cidadesOrigemOrdenadas, origemLimite, regiaoLogisticaSelecionada, regioesOrigemOrdenadas]);
  const regiaoLogisticaDrilldown = useMemo(() => {
    const regiaoEmFocoValida = regiaoLogisticaEmFoco && regioesOrigemOrdenadas.some((item) => item.nome === regiaoLogisticaEmFoco);
    return regiaoLogisticaSelecionada ?? (regiaoEmFocoValida ? regiaoLogisticaEmFoco : regioesOrigemOrdenadas[0]?.nome ?? null);
  }, [regiaoLogisticaEmFoco, regiaoLogisticaSelecionada, regioesOrigemOrdenadas]);
  const podeDrillDownOrigem = !regiaoLogisticaSelecionada && Boolean(regiaoLogisticaDrilldown);
  const agingMap = useMemo(() => new Map((graficos.data?.agingAbertas ?? EMPTY_ARRAY).map((item) => [item.faixa, item.total])), [graficos.data?.agingAbertas]);
  const aging = useMemo(() => AGING_BUCKETS.map((faixa) => ({ faixa, total: agingMap.get(faixa) ?? 0 })), [agingMap]);
  const statusTabelaOptions = useMemo(() => combinarStatusOptions(
    statusData.map((item) => item.status),
    tabelaConteudo.map((item) => item.status),
    filtros.status,
  ), [filtros.status, statusData, tabelaConteudo]);

  const historicoPerformanceOption: EChartsOption = useMemo(() => {
    const percentuais = historicoPerformance.flatMap((item) => [item.performancePercentual, item.metaPercentual]);
    const menor = percentuais.length > 0 ? Math.min(...percentuais) : 0;
    const maior = percentuais.length > 0 ? Math.max(...percentuais) : 100;
    const yMin = Math.max(0, Math.floor(menor - 3));
    const yMax = Math.min(100, Math.ceil(maior + 3));

    return {
      title: {
        text: 'Histórico da Performance de Coletas',
        left: 8,
        top: 8,
        textStyle: {
          fontSize: 12,
          fontWeight: 500,
        },
      },
      grid: { top: 52, right: '4%', bottom: '10%', left: '3%', containLabel: true },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const entries = params as { marker?: string; seriesName: string; value: number; name: string; dataIndex?: number }[];
          const name = entries[0]?.name ?? '';
          const ponto = historicoPerformance[entries[0]?.dataIndex ?? -1];
          const metricas = ponto
            ? [
                `Finalizadas: ${ponto.finalizadas.toLocaleString('pt-BR')}`,
                `No prazo: ${ponto.noPrazo.toLocaleString('pt-BR')}`,
                `Fora do prazo: ${ponto.foraDoPrazo.toLocaleString('pt-BR')}`,
              ]
            : [];

          return [
            `<strong>${escapeHtml(formatarHistoricoLabel(name, historicoPeriodo))}</strong>`,
            ...entries.map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName)}: ${formatarPorcentagem(Number(item.value ?? 0), 2)}`),
            ...metricas,
          ].join('<br/>');
        },
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: historicoPerformance.map((item) => item.date),
        axisLabel: {
          formatter: (value: string) => formatarHistoricoLabel(value, historicoPeriodo),
          fontWeight: 600,
          interval: 0,
          hideOverlap: true,
        },
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax <= yMin ? yMin + 10 : yMax,
        splitLine: {
          lineStyle: { type: 'dashed' },
        },
        axisLabel: {
          formatter: (value: number) => `${value}%`,
        },
      },
      series: [
        {
          name: 'Performance',
          type: 'line',
          smooth: false,
          data: historicoPerformance.map((item) => item.performancePercentual),
          symbol: 'none',
          lineStyle: { width: 2, color: 'var(--coletas-chart-volume)' },
        },
        {
          name: 'Meta',
          type: 'line',
          data: historicoPerformance.map((item) => item.metaPercentual),
          symbol: 'none',
          lineStyle: { width: 2, type: 'dashed', color: 'var(--color-text-muted)' },
          itemStyle: { color: 'var(--color-text-muted)' },
        },
      ],
    };
  }, [historicoPerformance, historicoPeriodo]);

  const handleOrigemClick = useCallback((params: unknown) => {
    if (regiaoLogisticaSelecionada) {
      return;
    }
    const nome = (params as { name?: string }).name;
    if (nome) {
      setRegiaoLogisticaEmFoco(nome);
      setRegiaoLogisticaSelecionada(nome);
    }
  }, [regiaoLogisticaSelecionada]);

  const handleOrigemMouseOver = useCallback((params: unknown) => {
    if (regiaoLogisticaSelecionada) {
      return;
    }
    const nome = (params as { name?: string }).name;
    if (nome) {
      setRegiaoLogisticaEmFoco(nome);
    }
  }, [regiaoLogisticaSelecionada]);

  const origemEvents = useMemo(() => ({
    click: handleOrigemClick,
    mouseover: handleOrigemMouseOver,
  }), [handleOrigemClick, handleOrigemMouseOver]);

  const fazerDrillUpOrigem = useCallback(() => {
    if (!regiaoLogisticaSelecionada) {
      return;
    }
    setRegiaoLogisticaEmFoco(regiaoLogisticaSelecionada);
    setRegiaoLogisticaSelecionada(null);
  }, [regiaoLogisticaSelecionada]);

  const fazerDrillDownOrigem = useCallback(() => {
    if (!podeDrillDownOrigem || !regiaoLogisticaDrilldown) {
      return;
    }
    setRegiaoLogisticaEmFoco(regiaoLogisticaDrilldown);
    setRegiaoLogisticaSelecionada(regiaoLogisticaDrilldown);
  }, [podeDrillDownOrigem, regiaoLogisticaDrilldown]);

  const origemActions = useMemo(() => (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DashboardSelector
        aria-label="Quantidade exibida"
        value={origemLimite}
        onValueChange={selectedValue => setOrigemLimite(Number(selectedValue) as (typeof ORIGEM_LIMITES)[number])}
        className="h-8 rounded-md border bg-transparent px-2 text-[11px] font-semibold outline-none"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
      >
        {ORIGEM_LIMITES.map((limite) => (
          <option key={limite} value={limite}>
            Top {limite}
          </option>
        ))}
      </DashboardSelector>
      <div className="flex min-w-0 items-center gap-1 rounded-lg border px-1 py-0.5" style={{ borderColor: 'var(--color-border)' }}>
        <DashboardButton
          type="button"
          title="Drill up"
          aria-label="Drill up para regiões"
          disabled={!regiaoLogisticaSelecionada}
          onClick={fazerDrillUpOrigem}
          className="flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35"
          style={{ color: regiaoLogisticaSelecionada ? CORES.primaria : 'var(--color-text-muted)' }}
        >
          <ChevronUp size={14} />
        </DashboardButton>
        <DashboardButton
          type="button"
          onClick={fazerDrillUpOrigem}
          className="rounded-md px-2 py-1 text-[11px] font-semibold transition"
          style={{
            backgroundColor: !regiaoLogisticaSelecionada ? `${CORES.primaria}1F` : 'transparent',
            color: !regiaoLogisticaSelecionada ? CORES.primaria : 'var(--color-text-muted)',
          }}
        >
          Regiões logísticas
        </DashboardButton>
        <ChevronRight size={12} style={{ color: 'var(--color-text-subtle)' }} />
        <DashboardButton
          type="button"
          title={regiaoLogisticaSelecionada ? `Cidades de ${regiaoLogisticaSelecionada}` : regiaoLogisticaDrilldown ? `Drill down para ${regiaoLogisticaDrilldown}` : 'Sem regiões para drill down'}
          disabled={!podeDrillDownOrigem && !regiaoLogisticaSelecionada}
          onClick={() => {
            if (!regiaoLogisticaSelecionada) {
              fazerDrillDownOrigem();
            }
          }}
          className="max-w-36 truncate rounded-md px-2 py-1 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-55"
          style={{
            backgroundColor: regiaoLogisticaSelecionada ? `${CORES.sucesso}1F` : 'transparent',
            color: regiaoLogisticaSelecionada || podeDrillDownOrigem ? CORES.sucesso : 'var(--color-text-muted)',
          }}
        >
          Cidades
        </DashboardButton>
        <DashboardButton
          type="button"
          title={regiaoLogisticaDrilldown ? `Drill down para ${regiaoLogisticaDrilldown}` : 'Sem regiões para drill down'}
          aria-label="Drill down para cidades"
          disabled={!podeDrillDownOrigem}
          onClick={fazerDrillDownOrigem}
          className="flex h-7 w-7 items-center justify-center rounded-md transition disabled:cursor-not-allowed disabled:opacity-35"
          style={{ color: podeDrillDownOrigem ? CORES.sucesso : 'var(--color-text-muted)' }}
        >
          <ChevronDown size={14} />
        </DashboardButton>
      </div>
    </div>
  ), [fazerDrillDownOrigem, fazerDrillUpOrigem, origemLimite, podeDrillDownOrigem, regiaoLogisticaDrilldown, regiaoLogisticaSelecionada]);

  const agingChart = useMemo(() => aging.map((item) => ({ nome: item.faixa, total: item.total })), [aging]);

  const colunas: ColunaTabelaAnalitica<ColetaResumoRow>[] = useMemo(() => [
    { chave: 'coleta', label: 'Coleta', fixo: true, filtroTabela: 'codigo' },
    { chave: 'solicitacao', label: 'Solicitação' },
    { chave: 'diasEmAberto', label: 'Dias em Aberto', formato: (valor) => (valor == null ? '—' : Number(valor).toLocaleString('pt-BR')) },
    { chave: 'status', label: 'Status', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
    { chave: 'filial', label: 'Filial' },
    { chave: 'cliente', label: 'Cliente', largura: '220px', filtroTabela: 'razaoSocial' },
    { chave: 'regiaoLogistica', label: 'Região Logística', filtroTabela: 'origem' },
    { chave: 'volumes', label: 'Volumes' },
    { chave: 'pesoTaxado', label: 'Peso', formato: (valor) => formatarPeso(Number(valor ?? 0)) },
    { chave: 'valorNf', label: 'Valor NF', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'numeroTentativas', label: 'Tentativas' },
  ], []);

  return (
    <div className="w-full">
      <FilterBar
        period={(
          <DateRangePicker
            dataInicio={dataInicio}
            dataFim={dataFim}
            onDataInicioChange={setDataInicio}
            onDataFimChange={setDataFim}
            onRangeChange={setDataRange}
          />
        )}
        onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? EMPTY_ARRAY}
          filiaisSelecionadas={filtros.filiais ?? EMPTY_ARRAY}
          parceirosSelecionados={filtros.parceirosLogisticos ?? EMPTY_ARRAY}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
        <AsyncMultiSelect
          label="Clientes"
          opcoes={clientes.data ?? EMPTY_ARRAY}
          selecionados={filtros.clientes ?? []}
          onChange={(valores) => setFiltro('clientes', valores)}
          isLoading={clientes.isLoading}
        />
        <AsyncMultiSelect
          label="Usuários"
          opcoes={usuariosNomes}
          selecionados={filtros.usuarios ?? []}
          onChange={(valores) => setFiltro('usuarios', valores)}
          isLoading={usuarios.isLoading}
        />
      </FilterBar>

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores de coletas.')} tipo={getTipoErro(overview.error)} />}
      {overview.data && <ColetasKpiGrid overview={overview.data} />}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2 2xl:grid-cols-6">
        <div className="col-span-full 2xl:col-span-2">
          <ColetasTrend dados={serieData} isLoading={serie.isLoading} />
        </div>
        <ColetasStatusChart data={statusData} isLoading={statusQuery.isLoading}
          erro={statusQuery.isError ? getApiErrorMessage(statusQuery.error, 'Erro ao carregar distribuição por status.') : null} />
        <ChartWrapper
          titulo="Histórico da Performance"
          chartKey="coletasHistoricoPerformance"
          altura="100%"
          option={historicoPerformanceOption}
          actions={<HistoricoPeriodoActions periodo={historicoPeriodo} onPeriodoChange={setHistoricoPeriodo} />}
          isLoading={historicoPerformanceQuery.isLoading}
          isEmpty={historicoPerformance.length === 0}
          erro={historicoPerformanceQuery.isError ? getApiErrorMessage(historicoPerformanceQuery.error, 'Erro ao carregar histórico de performance de coletas.') : null}
          className="2xl:col-span-2"
        />
        <ColetasRegionChart data={origemData} cityView={Boolean(regiaoLogisticaSelecionada)} actions={origemActions}
          onEvents={origemEvents} isLoading={regiaoLogisticaSelecionada ? cidadesOrigem.isLoading : graficos.isLoading} />
        <ColetasBars titulo="Coletas em aberto" chartKey="coletasAging" data={agingChart} isLoading={graficos.isLoading} className="2xl:col-span-3" />
      </div>

      <AnalyticalDataTable
        titulo="Coletas Analíticas"
        acoesCabecalho={<ExportButton nomeArquivo="coletas" onExport={() => exportarColetasCsv(filtro, filtrosTabela.apiFilters)} />}
        dados={tabelaConteudo}
        colunas={colunas}
        chaveLinha="id"
        filtros={filtrosTabela.filters}
        hiddenActiveCount={filtrosTabela.hiddenActiveCount}
        hasAnyFilter={filtrosTabela.hasAnyFilter}
        onTextFilterChange={filtrosTabela.setTextFilter}
        onMultiFilterChange={filtrosTabela.setMultiFilter}
        onColumnFilterChange={filtrosTabela.setColumnFilter}
        onClearFilters={filtrosTabela.clearTableFilters}
        statusOptions={statusTabelaOptions}
        statusOptionsLoading={statusQuery.isLoading}
        isLoading={tabela.isLoading}
        error={tabela.error}
        errorFallbackMessage="Erro ao carregar coletas analíticas."
        totalRegistros={tabela.data?.totalElementos}
        paginaAtual={paginacaoTabela.pagina}
        tamanhoPagina={paginacaoTabela.tamanhoPagina}
        onPaginaChange={paginacaoTabela.setPagina}
        onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
      />
    </div>
  );
}
