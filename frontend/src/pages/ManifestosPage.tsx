import { escapeHtml } from '../utils/escapeHtml';
import { useCallback, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import ManifestosCustoEvolutionCard from '../components/domain/manifestos/ManifestosCustoEvolutionCard';
import ManifestosCostGoalsPanel from '../components/domain/manifestos/ManifestosCostGoalsPanel';
import ManifestosGaugeCard from '../components/domain/manifestos/ManifestosGaugeCard';
import ManifestosKpiGrid from '../components/domain/manifestos/ManifestosKpiGrid';
import ManifestosTrend from '../components/domain/manifestos/ManifestosTrend';
import AsyncMultiSelect from '../components/shared/AsyncMultiSelect';
import AnalyticalDataTable, {
  type ColunaTabelaAnalitica,
  type SortDirection,
} from '../components/shared/AnalyticalDataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import { KpiDictionary } from '../constants/kpiDictionary';
import { exportarManifestosCsv } from '../api/endpoints/manifestosServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais, useManifestosClassificacoes, useMotoristas, useVeiculos } from '../hooks/queries/useDimensoes';
import { useManifestosPerformance, useManifestosTabelaPaginada } from '../hooks/queries/useManifestos';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { usePermissions } from '../hooks/usePermissions';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type { ManifestoResumoRow, ManifestosFiltro, ManifestosTempoNivel } from '../types/manifestos';
import { buildBaseBarOption, buildBaseDonutOption } from '../utils/echartsBuilders';
import { formatarMoeda, formatarNumero, formatarPeso } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const NIVEL_PARAM = 'manifestosNivel';
const ANO_PARAM = 'manifestosAno';
const MES_PARAM = 'manifestosMes';
const CORES_GAUGE_MANIFESTOS = {
  remuneracao: 'var(--color-primary)',
  aproveitamento: 'var(--color-positive-fill)',
  efetividade: 'var(--color-warning-fill)',
} as const;
const EMPTY_ARRAY: never[] = [];
const KPI_BADGE_BASE_CLASS = 'inline-flex min-w-[68px] items-center justify-center rounded-md px-2 py-1 text-xs font-semibold tabular-nums';
const TIPOS_CONTRATO_OPTIONS = ['Agregado', 'Terceiro', 'Frota', 'Frota + PX'];

type ManifestoTabelaRow = ManifestoResumoRow & {
  percentualRemuneracao: number | null;
  percentualAproveitamento: number | null;
  percentualEfetividade: number | null;
};

interface ManifestosTableSort {
  field: keyof ManifestoTabelaRow & string;
  direction: SortDirection;
}

type TipoVeiculoTooltipData = {
  tipo: string;
  quantidade: number;
  aproveitamentoMedio: number | null;
  mediaEventos: number | null;
  value: number;
};

function formatarTooltipTipoVeiculo(params: unknown): string {
  const entry = Array.isArray(params) ? params[0] as { data?: TipoVeiculoTooltipData; name?: string; value?: number } : null;
  const data = entry?.data;
  const tipo = data?.tipo ?? entry?.name ?? '';
  const quantidade = data?.quantidade ?? Number(entry?.value ?? 0);
  const aproveitamentoMedio = data?.aproveitamentoMedio ?? 0;
  const mediaEventos = data?.mediaEventos ?? 0;

  return `
    <section role="tooltip" style="min-width: 210px;">
      <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 700;">${escapeHtml(tipo)}</h3>
      <dl style="margin: 0; display: grid; gap: 6px;">
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <dt>Quantidade de Manifestos</dt>
          <dd style="margin: 0; font-weight: 700;">${formatarNumero(quantidade)}</dd>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <dt>Aproveitamento Médio</dt>
          <dd style="margin: 0; font-weight: 700;">${formatarNumero(aproveitamentoMedio, 1)}%</dd>
        </div>
        <div style="display: flex; justify-content: space-between; gap: 16px;">
          <dt>Eventos Médios</dt>
          <dd style="margin: 0; font-weight: 700;">${formatarNumero(mediaEventos, 1)}</dd>
        </div>
      </dl>
    </section>
  `;
}

function calcularPercentual(
  numerador: number | null | undefined,
  denominador: number | null | undefined,
): number | null {
  if (
    numerador == null
    || denominador == null
    || !Number.isFinite(numerador)
    || !Number.isFinite(denominador)
    || denominador <= 0
  ) {
    return null;
  }

  return (numerador / denominador) * 100;
}

function calcularPercentualRemuneracao(
  custo: number | null | undefined,
  receita: number | null | undefined,
): number | null {
  if (
    custo == null
    || receita == null
    || !Number.isFinite(custo)
    || !Number.isFinite(receita)
  ) {
    return null;
  }

  if (receita === 0) {
    return custo > 0 ? 100 : null;
  }

  if (receita < 0) {
    return null;
  }

  if (receita >= 0.01 && receita <= 5) {
    return 100;
  }

  return (custo / receita) * 100;
}

function renderPercentualBadge(percentual: number | null, classeCor: string) {
  if (percentual == null) {
    return '—';
  }

  return (
    <span className={`${KPI_BADGE_BASE_CLASS} ${classeCor}`}>
      {formatarNumero(percentual, 1)}%
    </span>
  );
}

function classeRemuneracao(percentual: number): string {
  if (percentual <= 20) return 'bg-green-500/10 text-green-500';
  if (percentual <= 30) return 'bg-yellow-500/10 text-yellow-600';
  return 'bg-red-500/10 text-red-500';
}

function classeAproveitamento(percentual: number): string {
  if (percentual > 80) return 'bg-green-500/10 text-green-500';
  if (percentual >= 40) return 'bg-yellow-500/10 text-yellow-600';
  return 'bg-red-500/10 text-red-500';
}

function classeEfetividade(percentual: number): string {
  if (percentual > 70) return 'bg-green-500/10 text-green-500';
  if (percentual >= 60) return 'bg-yellow-500/10 text-yellow-600';
  return 'bg-red-500/10 text-red-500';
}

function normalizarNivel(valor: string | null): ManifestosTempoNivel {
  return valor === 'ano' || valor === 'mes' || valor === 'dia' ? valor : 'dia';
}

function numeroParam(valor: string | null): number | null {
  if (!valor) return null;
  const parsed = Number.parseInt(valor, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizarNumeroManifestoInput(valor: string): string {
  return valor.replace(/\D/g, '');
}

export default function ManifestosPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const [isMetasPanelOpen, setIsMetasPanelOpen] = useState(false);
  const [tableSort, setTableSort] = useState<ManifestosTableSort | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDark } = useEchartsTheme();
  const { canAccess } = usePermissions();
  const filiais = useFiliais();
  const motoristas = useMotoristas();
  const veiculos = useVeiculos();
  const nivelTemporal = normalizarNivel(searchParams.get(NIVEL_PARAM));
  const anoTemporal = numeroParam(searchParams.get(ANO_PARAM));
  const mesTemporal = numeroParam(searchParams.get(MES_PARAM));
  const numeroManifestoFiltro = filtros.numeroManifesto?.[0] ?? '';

  const filtro: ManifestosFiltro = useMemo(() => ({
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
    status: filtros.status,
    motoristas: filtros.motoristas,
    veiculos: filtros.veiculos,
    numeroManifesto: numeroManifestoFiltro || undefined,
    classificacoes: filtros.classificacoes,
    tiposCarga: filtros.tiposCarga,
    tiposContrato: filtros.tiposContrato,
    tipoMotorista: filtros.tipoMotorista,
  }), [
    dataFim,
    dataInicio,
    filtros.classificacoes,
    filtros.filiais,
    filtros.motoristas,
    filtros.parceirosLogisticos,
    filtros.status,
    filtros.tipoMotorista,
    filtros.tiposCarga,
    filtros.tiposContrato,
    filtros.veiculos,
    numeroManifestoFiltro,
  ]);

  const activeFilters: ActiveFilter[] = useMemo(() => [
    { label: 'Manifesto', count: numeroManifestoFiltro ? 1 : 0, onRemove: () => setFiltro('numeroManifesto', []) },
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
    { label: 'Classificação', count: filtros.classificacoes?.length ?? 0, onRemove: () => setFiltro('classificacoes', []) },
    { label: 'Motoristas', count: filtros.motoristas?.length ?? 0, onRemove: () => setFiltro('motoristas', []) },
    { label: 'Veículos', count: filtros.veiculos?.length ?? 0, onRemove: () => setFiltro('veiculos', []) },
    { label: 'Tipos de contrato', count: filtros.tiposContrato?.length ?? 0, onRemove: () => setFiltro('tiposContrato', []) },
  ], [filtros.classificacoes, filtros.filiais, filtros.motoristas, filtros.parceirosLogisticos, filtros.tiposContrato, filtros.veiculos, numeroManifestoFiltro, setFiltro]);

  const classificacoes = useManifestosClassificacoes(filtro);
  const performance = useManifestosPerformance(filtro, nivelTemporal, anoTemporal, mesTemporal);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoResetKey = useMemo(() => JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }), [filtro, filtrosTabela.resetKey]);
  const paginacaoTabela = useTabelaPaginadaState(paginacaoResetKey);
  const tabela = useManifestosTabelaPaginada(
    filtro,
    paginacaoTabela.pagina,
    paginacaoTabela.tamanhoPagina,
    filtrosTabela.apiFilters,
    tableSort?.field,
    tableSort?.direction,
  );

  usePageHeader({
    title: 'Manifestos - Performance de Veículos',
    description: 'Custos, ocupação de carga e performance por motorista.',
    updatedAt: performance.data?.updatedAt ?? null,
  });

  const canManageManifestosGoals = canAccess('can_manage_kpi_goals');
  const dadosPerformance = performance.data;
  const statusSazonal = useMemo(() => dadosPerformance?.statusSazonal ?? EMPTY_ARRAY, [dadosPerformance?.statusSazonal]);
  const custosContrato = useMemo(() => dadosPerformance?.custosContrato ?? EMPTY_ARRAY, [dadosPerformance?.custosContrato]);
  const tiposVeiculo = useMemo(() => dadosPerformance?.tiposVeiculo ?? EMPTY_ARRAY, [dadosPerformance?.tiposVeiculo]);
  const tabelaConteudo = useMemo<ManifestoTabelaRow[]>(
    () => (tabela.data?.conteudo ?? EMPTY_ARRAY).map((row) => ({
      ...row,
      percentualRemuneracao: calcularPercentualRemuneracao(row.custoTotal, row.receitaTotalTransportada),
      percentualAproveitamento: calcularPercentual(row.totalPesoTaxado, row.capacidadeKg),
      percentualEfetividade: calcularPercentual(row.itensFinalizados, row.itensTotal),
    })),
    [tabela.data?.conteudo],
  );
  const veiculoPlacas = useMemo(() => (veiculos.data ?? EMPTY_ARRAY).map((item) => item.placa), [veiculos.data]);
  const statusTabelaOptions = useMemo(() => combinarStatusOptions(
    ['encerrado', 'em trânsito', 'pendente'],
    tabelaConteudo.map((item) => item.status),
    filtros.status,
  ), [filtros.status, tabelaConteudo]);

  const alterarNivelTemporal = useCallback((nivel: ManifestosTempoNivel) => {
    const next = new URLSearchParams(searchParams);
    next.set(NIVEL_PARAM, nivel);
    next.delete(ANO_PARAM);
    next.delete(MES_PARAM);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const drillTemporal = useCallback((data: string) => {
    const [ano, mes] = data.split('-');
    const next = new URLSearchParams(searchParams);
    if (nivelTemporal === 'ano') {
      next.set(NIVEL_PARAM, 'mes');
      next.set(ANO_PARAM, ano);
      next.delete(MES_PARAM);
    } else if (nivelTemporal === 'mes') {
      next.set(NIVEL_PARAM, 'dia');
      next.set(ANO_PARAM, ano);
      next.set(MES_PARAM, mes);
    }
    setSearchParams(next, { replace: true });
  }, [nivelTemporal, searchParams, setSearchParams]);

  const statusTrend = useMemo(() => statusSazonal.map((item) => ({
    date: item.data,
    encerrado: item.encerrado,
    emTransito: item.emTransito,
    pendente: item.pendente,
  })), [statusSazonal]);

  const custosContratoOption: EChartsOption = useMemo(() => buildBaseDonutOption(isDark, {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const item = params as { name?: string; value?: number; percent?: number };
        return `${escapeHtml(item.name ?? '')}<br/>${formatarMoeda(Number(item.value ?? 0))}<br/>${formatarNumero(Number(item.percent ?? 0), 1)}%`;
      },
    },
    legend: {
      bottom: 0,
      type: 'scroll',
    },
    series: [
      {
        name: 'Custos',
        type: 'pie',
        data: custosContrato.map((item) => ({ name: item.tipoContrato, value: item.custoTotal })),
      },
    ],
  }), [custosContrato, isDark]);

  const tiposVeiculoOption: EChartsOption = useMemo(() => buildBaseBarOption(isDark, {
    tooltip: {
      trigger: 'axis',
      formatter: formatarTooltipTipoVeiculo,
    },
    legend: { show: false },
    grid: { top: 34, right: 10, bottom: 4, left: 44, containLabel: true },
    xAxis: {
      type: 'category',
      data: tiposVeiculo.map((item) => item.tipo),
      axisLabel: {
        interval: 0,
        rotate: tiposVeiculo.length > 5 ? 35 : 0,
        formatter: (value: string) => value.length > 16 ? `${value.slice(0, 16)}...` : value,
      },
    },
    yAxis: { type: 'value', name: 'Qtd' },
    series: [
      {
        name: 'Veículos',
        type: 'bar',
        data: tiposVeiculo.map((item) => ({
          tipo: item.tipo,
          quantidade: item.quantidade,
          aproveitamentoMedio: item.aproveitamentoMedio,
          mediaEventos: item.mediaEventos,
          value: item.quantidade,
        })),
      },
    ],
  }), [isDark, tiposVeiculo]);

  const colunas: ColunaTabelaAnalitica<ManifestoTabelaRow>[] = useMemo(() => [
    { chave: 'numero', label: 'Manifesto', fixo: true, filtroTabela: 'codigo' },
    { chave: 'status', label: 'Status', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
    { chave: 'filial', label: 'Filial' },
    { chave: 'motorista', label: 'Motorista' },
    { chave: 'veiculoPlaca', label: 'Veículo', filtroTabela: 'placa' },
    { chave: 'dataCriacao', label: 'Competência' },
    { chave: 'totalPesoTaxado', label: 'Peso', formato: (valor) => formatarPeso(Number(valor ?? 0)) },
    { chave: 'totalM3', label: 'M3', formato: (valor) => formatarNumero(Number(valor ?? 0), 2) },
    { chave: 'custoTotal', label: 'Custo', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'receitaTotalTransportada', label: 'Receita Total', formato: (valor) => formatarMoeda(Number(valor ?? 0)) },
    { chave: 'kmTotal', label: 'KM', formato: (valor) => formatarNumero(Number(valor ?? 0), 0) },
    {
      chave: 'percentualRemuneracao',
      label: '% Remuneração',
      tooltip: KpiDictionary.manifestos.remuneracao.tabela.calculo,
      formato: (_, row) => {
        const percentual = calcularPercentualRemuneracao(row.custoTotal, row.receitaTotalTransportada);
        return renderPercentualBadge(percentual, percentual == null ? '' : classeRemuneracao(percentual));
      },
    },
    {
      chave: 'percentualAproveitamento',
      label: '% Aproveitamento',
      tooltip: KpiDictionary.manifestos.aproveitamento.geral.calculo,
      formato: (_, row) => {
        const percentual = calcularPercentual(row.totalPesoTaxado, row.capacidadeKg);
        return renderPercentualBadge(percentual, percentual == null ? '' : classeAproveitamento(percentual));
      },
    },
    {
      chave: 'percentualEfetividade',
      label: '% Efetividade',
      tooltip: KpiDictionary.manifestos.efetividade.geral.calculo,
      formato: (_, row) => {
        const percentual = calcularPercentual(row.itensFinalizados, row.itensTotal);
        return renderPercentualBadge(percentual, percentual == null ? '' : classeEfetividade(percentual));
      },
    },
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
        onClear={limparFiltros}
        activeFilters={activeFilters}
        dataInicio={dataInicio}
        dataFim={dataFim}
        dateAccessory={dadosPerformance ? (
          <span className="font-medium tabular-nums" style={{ color: 'var(--color-text)' }}>
            {dadosPerformance.totalDiasUteis} Dias Úteis
          </span>
        ) : null}
        actions={canManageManifestosGoals ? (
          <button
            type="button"
            onClick={() => setIsMetasPanelOpen((current) => !current)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all duration-150 hover:bg-[var(--color-bg)] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{ color: 'var(--color-text)' }}
          >
            <Settings size={14} aria-hidden="true" />
            Gerenciar Metas
          </button>
        ) : null}
      >
        <div className="flex w-full min-w-[148px] flex-col gap-1 self-end justify-self-start md:w-auto">
          <label
            htmlFor="manifestos-numero"
            className="flex min-h-4 items-center gap-1.5 text-xs font-medium leading-4"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Manifesto
          </label>
          <input
            id="manifestos-numero"
            type="text"
            inputMode="numeric"
            placeholder="Nº Manifesto"
            value={numeroManifestoFiltro}
            onChange={(e) => {
              const numero = normalizarNumeroManifestoInput(e.target.value);
              setFiltro('numeroManifesto', numero ? [numero] : []);
            }}
            className="h-10 w-full rounded-lg border px-3 text-sm font-medium shadow-sm transition-all duration-150 hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] md:w-[148px]"
            style={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          />
        </div>
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? EMPTY_ARRAY}
          filiaisSelecionadas={filtros.filiais ?? EMPTY_ARRAY}
          parceirosSelecionados={filtros.parceirosLogisticos ?? EMPTY_ARRAY}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
        <AsyncMultiSelect
          label="Classificação"
          opcoes={classificacoes.data ?? EMPTY_ARRAY}
          selecionados={filtros.classificacoes ?? []}
          onChange={(valores) => setFiltro('classificacoes', valores)}
          isLoading={classificacoes.isLoading}
        />
        <AsyncMultiSelect
          label="Motoristas"
          opcoes={motoristas.data ?? EMPTY_ARRAY}
          selecionados={filtros.motoristas ?? []}
          onChange={(valores) => setFiltro('motoristas', valores)}
          isLoading={motoristas.isLoading}
        />
        <AsyncMultiSelect
          label="Veículos"
          opcoes={veiculoPlacas}
          selecionados={filtros.veiculos ?? []}
          onChange={(valores) => setFiltro('veiculos', valores)}
          isLoading={veiculos.isLoading}
        />
        <AsyncMultiSelect
          label="Tipos de Contrato"
          opcoes={TIPOS_CONTRATO_OPTIONS}
          selecionados={filtros.tiposContrato ?? []}
          onChange={(valores) => setFiltro('tiposContrato', valores)}
        />
      </FilterBar>

      {canManageManifestosGoals ? (
        <ManifestosCostGoalsPanel open={isMetasPanelOpen} />
      ) : null}

      {performance.isError && <MensagemErro mensagem={getApiErrorMessage(performance.error, 'Erro ao carregar indicadores de manifestos.')} tipo={getTipoErro(performance.error)} />}
      <ManifestosKpiGrid kpis={dadosPerformance?.kpis} isLoading={performance.isLoading} />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <div className="col-span-full min-h-[43rem] lg:min-h-[34rem] xl:h-[28rem] xl:min-h-0">
          <ManifestosCustoEvolutionCard
            dados={dadosPerformance?.custosEvolucao}
            isLoading={performance.isLoading}
          />
        </div>
        <ManifestosGaugeCard
          titulo="Remuneração (Custo x Receita Transportada)"
          metric={dadosPerformance?.remuneracao}
          isLoading={performance.isLoading}
          corDestaque={CORES_GAUGE_MANIFESTOS.remuneracao}
          definitions={KpiDictionary.manifestos.remuneracao}
        />
        <ManifestosGaugeCard
          titulo="Aproveitamento (Peso Transportado x Capacidade do Veículo)"
          metric={dadosPerformance?.aproveitamento}
          isLoading={performance.isLoading}
          corDestaque={CORES_GAUGE_MANIFESTOS.aproveitamento}
          definitions={KpiDictionary.manifestos.aproveitamento}
        />
        <ManifestosGaugeCard
          titulo="Efetividade (quantidade de serviços x quantidade de serviços finalizados)"
          metric={dadosPerformance?.efetividade}
          isLoading={performance.isLoading}
          corDestaque={CORES_GAUGE_MANIFESTOS.efetividade}
          definitions={KpiDictionary.manifestos.efetividade}
        />
        <ManifestosTrend
          dados={statusTrend}
          nivel={nivelTemporal}
          onNivelChange={alterarNivelTemporal}
          onPointClick={drillTemporal}
          isLoading={performance.isLoading}
        />
        <ChartWrapper
          titulo={KpiDictionary.manifestos.custosPorContrato.titulo}
          chartKey="manifestosCustosContrato"
          option={custosContratoOption}
          isLoading={performance.isLoading}
          isEmpty={custosContrato.length === 0}
        />
        <ChartWrapper
          titulo="Tipo de Veículos Utilizados"
          chartKey="manifestosTiposVeiculo"
          option={tiposVeiculoOption}
          isLoading={performance.isLoading}
          isEmpty={tiposVeiculo.length === 0}
        />
      </div>

      <AnalyticalDataTable
        acoesCabecalho={<ExportButton nomeArquivo="manifestos" onExport={() => exportarManifestosCsv(filtro, filtrosTabela.apiFilters)} />}
        titulo="Manifestos Analíticos"
        dados={tabelaConteudo}
        colunas={colunas}
        chaveLinha="identificadorUnico"
        filtros={filtrosTabela.filters}
        hiddenActiveCount={filtrosTabela.hiddenActiveCount}
        hasAnyFilter={filtrosTabela.hasAnyFilter}
        onTextFilterChange={filtrosTabela.setTextFilter}
        onMultiFilterChange={filtrosTabela.setMultiFilter}
        onColumnFilterChange={filtrosTabela.setColumnFilter}
        onClearFilters={filtrosTabela.clearTableFilters}
        statusOptions={statusTabelaOptions}
        isLoading={tabela.isLoading}
        isFetching={tabela.isFetching}
        error={tabela.error}
        errorFallbackMessage="Erro ao carregar manifestos analíticos."
        totalRegistros={tabela.data?.totalElementos}
        paginaAtual={paginacaoTabela.pagina}
        tamanhoPagina={paginacaoTabela.tamanhoPagina}
        onPaginaChange={paginacaoTabela.setPagina}
        onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
        sortField={tableSort?.field}
        sortDirection={tableSort?.direction}
        onSortChange={(field, direction) => setTableSort({ field, direction })}
      />
    </div>
  );
}
