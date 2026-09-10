import { escapeHtml } from '../utils/escapeHtml';
import { useEffect, useMemo } from 'react';
import type { EChartsOption } from 'echarts';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import ExecutivoKpiGrid from '../components/domain/executivo/ExecutivoKpiGrid';
import DataTable, { type ColunaTabela } from '../components/shared/DataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import { DATE_RANGE_PRESETS } from '../components/shared/dateRangePresets';
import ExportButton from '../components/shared/ExportButton';
import FiliaisParceirosFilter from '../components/shared/FiliaisParceirosFilter';
import FilterBar, { type ActiveFilter } from '../components/shared/FilterBar';
import MensagemErro from '../components/ui/MensagemErro';
import { KpiDictionary } from '../constants/kpiDictionary';
import { salvarBlobComoArquivo } from '../api/downloadArquivo';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais } from '../hooks/queries/useDimensoes';
import { useExecutivoOverview, useExecutivoResumoFinanceiro, useExecutivoSerie } from '../hooks/queries/useExecutivo';
import type { ExecutivoResumoFinanceiro } from '../types/executivo';
import { normalizarPeriodo } from '../utils/dateUtils';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda, formatarNumero, formatarPeso } from '../utils/formatadores';

type TooltipParam = {
  axisValue?: string | number;
  axisValueLabel?: string;
  marker?: string;
  seriesName?: string;
  value?: number | string | Array<number | string | null> | null;
};

function formatarMoedaEixo(valor: number | string) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return '';
  if (Math.abs(numero) >= 1_000_000) return `${formatarMoeda(numero / 1_000_000)} mi`;
  if (Math.abs(numero) >= 1_000) return `${formatarMoeda(numero / 1_000)} mil`;
  return formatarMoeda(numero);
}

function normalizarTooltipParams(params: unknown): TooltipParam[] {
  return Array.isArray(params) ? params as TooltipParam[] : [params as TooltipParam];
}

function valorTooltip(param: TooltipParam): number {
  const valor = Array.isArray(param.value) ? param.value[param.value.length - 1] : param.value;
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarTooltipFinanceiro(params: unknown) {
  const itens = normalizarTooltipParams(params);
  const titulo = itens[0]?.axisValueLabel ?? itens[0]?.axisValue ?? '';
  const linhas = itens.map((item) => `${item.marker ?? ''}${escapeHtml(item.seriesName ?? '')}: ${formatarMoeda(valorTooltip(item))}`);
  return [escapeHtml(titulo), ...linhas].filter(Boolean).join('<br/>');
}

function formatarTooltipExecutivoMisto(params: unknown) {
  const itens = normalizarTooltipParams(params);
  const titulo = itens[0]?.axisValueLabel ?? itens[0]?.axisValue ?? '';
  const linhas = itens.map((item) => {
    const nomeSerie = item.seriesName ?? '';
    const valor = valorTooltip(item);
    const valorFormatado = nomeSerie === 'Backlog Coletas'
      ? formatarNumero(valor)
      : formatarMoeda(valor);

    return `${item.marker ?? ''}${escapeHtml(nomeSerie)}: ${valorFormatado}`;
  });
  return [escapeHtml(titulo), ...linhas].filter(Boolean).join('<br/>');
}

const CSV_SEPARATOR = ';';
const CSV_NEWLINE = '\r\n';
const CSV_UTF8_BOM = '\ufeff';

function protegerFormulaCsv(valor: string) {
  if (!valor) return valor;
  return ['=', '+', '-', '@'].includes(valor.charAt(0)) ? `'${valor}` : valor;
}

function formatarNumeroCsv(valor: number) {
  if (!Number.isFinite(valor)) return '';
  return valor.toLocaleString('pt-BR', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escaparValorCsv(valor: string | number | null | undefined) {
  const texto = typeof valor === 'number'
    ? formatarNumeroCsv(valor)
    : protegerFormulaCsv(valor == null ? '' : String(valor));
  const precisaAspas = texto.includes(CSV_SEPARATOR)
    || texto.includes('"')
    || texto.includes('\r')
    || texto.includes('\n')
    || /^\s|\s$/.test(texto);

  return precisaAspas ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function exportarResumoFinanceiroCsv(rows: ExecutivoResumoFinanceiro[], nomeArquivo: string) {
  const headers = ['Filial', 'Total Faturado', 'Frete Peso', 'Frete Valor', 'Ticket Médio'];
  const linhas = rows.map((row) => [
    row.filial,
    row.totalFaturado,
    row.fretePeso,
    row.freteValor,
    row.ticketMedio,
  ]);
  const conteudo = [headers, ...linhas]
    .map((linha) => linha.map(escaparValorCsv).join(CSV_SEPARATOR))
    .join(CSV_NEWLINE);
  const blob = new Blob([CSV_UTF8_BOM, conteudo, CSV_NEWLINE], { type: 'text/csv;charset=utf-8' });

  salvarBlobComoArquivo(blob, nomeArquivo);
}

function ResumoFinanceiroTable({
  rows,
  isLoading,
  error,
  nomeArquivo,
}: {
  rows: ExecutivoResumoFinanceiro[];
  isLoading?: boolean;
  error?: unknown;
  nomeArquivo: string;
}) {
  const colunas: ColunaTabela<ExecutivoResumoFinanceiro>[] = [
    { chave: 'filial', label: 'Filial', fixo: true, largura: '280px' },
    {
      chave: 'totalFaturado',
      label: 'Total Faturado',
      largura: '160px',
      alinhamento: 'right',
      tooltip: KpiDictionary.executivo.resumoFinanceiro.totalFaturado.calculo,
      formato: (valor) => <span className="block text-right tabular-nums">{formatarMoeda(Number(valor ?? 0))}</span>,
    },
    {
      chave: 'fretePeso',
      label: 'Frete Peso',
      largura: '150px',
      alinhamento: 'right',
      tooltip: KpiDictionary.executivo.resumoFinanceiro.fretePeso.calculo,
      formato: (valor) => <span className="block text-right tabular-nums">{formatarPeso(Number(valor ?? 0))}</span>,
    },
    {
      chave: 'freteValor',
      label: 'Frete Valor',
      largura: '150px',
      alinhamento: 'right',
      tooltip: KpiDictionary.executivo.resumoFinanceiro.freteValor.calculo,
      formato: (valor) => <span className="block text-right tabular-nums">{formatarMoeda(Number(valor ?? 0))}</span>,
    },
    {
      chave: 'ticketMedio',
      label: 'Ticket Médio',
      largura: '150px',
      alinhamento: 'right',
      tooltip: KpiDictionary.executivo.resumoFinanceiro.ticketMedio.calculo,
      formato: (valor) => <span className="block text-right tabular-nums">{formatarMoeda(Number(valor ?? 0))}</span>,
    },
  ];

  return (
    <div className="mb-6">
      <DataTable
        titulo="Resumo financeiro por filial"
        dados={rows}
        colunas={colunas}
        chaveLinha="filial"
        isLoading={isLoading}
        error={error}
        errorFallbackMessage="Erro ao carregar resumo financeiro."
        acoesCabecalho={(
          <ExportButton
            nomeArquivo={nomeArquivo}
            onExport={!isLoading && !error ? () => exportarResumoFinanceiroCsv(rows, nomeArquivo) : undefined}
          />
        )}
      />
    </div>
  );
}

export default function ExecutivoPage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const filiais = useFiliais();

  useEffect(() => {
    const preset180d = DATE_RANGE_PRESETS.find((preset) => preset.label === '180d');
    if (!preset180d) return;

    const range = preset180d.getRange();
    const periodo = normalizarPeriodo(range.dataInicio, range.dataFim);
    setDataRange(periodo.dataInicio, periodo.dataFim);
    // Esta excecao de periodo inicial deve rodar somente na montagem da pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtro = {
    dataInicio,
    dataFim,
    filiais: filtros.filiais,
    parceirosLogisticos: filtros.parceirosLogisticos,
  };

  const activeFilters: ActiveFilter[] = [
    { label: 'Filiais', count: filtros.filiais?.length ?? 0, onRemove: () => setFiltro('filiais', []) },
    { label: 'Parceiros Logísticos', count: filtros.parceirosLogisticos?.length ?? 0, onRemove: () => setFiltro('parceirosLogisticos', []) },
  ];

  const overview = useExecutivoOverview(filtro);
  const serie = useExecutivoSerie(filtro);
  const resumoFinanceiro = useExecutivoResumoFinanceiro(filtro);

  usePageHeader({
    title: 'Executivo',
    description: 'Visão consolidada da operação, financeiro e backlog.',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const serieDados = useMemo(() => serie.data ?? [], [serie.data]);
  const erroSerie = serie.isError ? getApiErrorMessage(serie.error, 'Erro ao carregar série executiva.') : null;
  const resumoFinanceiroDados = resumoFinanceiro.data ?? [];
  const chartColors = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);
    return {
      receitaOperacional: tokens.palette[0],
      valorFaturado: tokens.palette[2],
      saldoAReceber: tokens.palette[8],
      saldoAPagar: tokens.palette[3],
      backlog: tokens.palette[4],
    };
  }, [isDark]);

  const financeiroOption: EChartsOption = useMemo(() => buildBaseLineOption(isDark, {
    color: Object.values(chartColors),
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: formatarTooltipFinanceiro,
    },
    grid: { top: 54, right: '3%', bottom: 30, left: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: serieDados.map((item) => item.month) },
    yAxis: { type: 'value', axisLabel: { formatter: formatarMoedaEixo } },
    series: [
      {
        name: 'Receita Operacional',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: chartColors.receitaOperacional },
        itemStyle: { color: chartColors.receitaOperacional },
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: serieDados.map((item) => item.receitaOperacional),
      },
      {
        name: 'Valor Faturado',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: chartColors.valorFaturado },
        itemStyle: { color: chartColors.valorFaturado },
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: serieDados.map((item) => item.valorFaturado),
      },
      {
        name: 'Saldo a Receber',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: chartColors.saldoAReceber },
        itemStyle: { color: chartColors.saldoAReceber },
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: serieDados.map((item) => item.saldoAReceber),
      },
      {
        name: 'Saldo a Pagar',
        type: 'line',
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: chartColors.saldoAPagar },
        itemStyle: { color: chartColors.saldoAPagar },
        areaStyle: {},
        emphasis: { focus: 'series' },
        data: serieDados.map((item) => item.saldoAPagar),
      },
    ],
  }), [isDark, chartColors, serieDados]);

  const backlogOption: EChartsOption = useMemo(() => buildBaseLineOption(isDark, buildBaseBarOption(isDark, {
    color: [chartColors.valorFaturado, chartColors.backlog],
    legend: { top: 0 },
    tooltip: { trigger: 'axis', formatter: formatarTooltipExecutivoMisto },
    grid: { top: 54, right: '3%', bottom: 32, left: '3%', containLabel: true },
    xAxis: { type: 'category', boundaryGap: false, data: serieDados.map((item) => item.month) },
    yAxis: [
      { type: 'value', name: 'Faturamento', axisLabel: { formatter: formatarMoedaEixo } },
      {
        type: 'value',
        name: 'Backlog',
        alignTicks: true,
        splitLine: { show: false },
        axisLabel: { formatter: (value: number | string) => formatarNumero(Number(value)) },
      },
    ],
    series: [
      {
        name: 'Valor Faturado',
        type: 'bar',
        yAxisIndex: 0,
        itemStyle: { color: chartColors.valorFaturado },
        data: serieDados.map((item) => item.valorFaturado),
      },
      {
        name: 'Backlog Coletas',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbolSize: 7,
        lineStyle: { width: 2.5, color: chartColors.backlog },
        itemStyle: { color: chartColors.backlog },
        emphasis: { focus: 'series' },
        data: serieDados.map((item) => item.backlogColetas),
      },
    ],
  })), [isDark, chartColors, serieDados]);

  return (
    <div className="w-full">
      <FilterBar onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
        <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
        <FiliaisParceirosFilter
          opcoes={filiais.data ?? []}
          filiaisSelecionadas={filtros.filiais ?? []}
          parceirosSelecionados={filtros.parceirosLogisticos ?? []}
          onFiliaisChange={(valores) => setFiltro('filiais', valores)}
          onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)}
          isLoading={filiais.isLoading}
        />
      </FilterBar>

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar visão executiva.')} tipo={getTipoErro(overview.error)} />}
      {overview.isLoading && (
        <div className="mb-6 flex h-24 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
      )}
      {!overview.isLoading && overview.data && <ExecutivoKpiGrid overview={overview.data} />}
      {!overview.isLoading && !overview.data && !overview.isError && (
        <div className="mb-6 flex h-24 items-center justify-center rounded-[20px] border text-sm" style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
          Nenhum dado disponível para o período selecionado.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper
          titulo="Tendência Financeira"
          chartKey="executivoTendenciaFinanceira"
          option={financeiroOption}
          isLoading={serie.isLoading}
          isEmpty={serieDados.length === 0}
          erro={erroSerie}
          altura={360}
        />
        <ChartWrapper
          titulo="Faturamento x Backlog Mensal"
          chartKey="executivoFaturamentoBacklog"
          option={backlogOption}
          isLoading={serie.isLoading}
          isEmpty={serieDados.length === 0}
          erro={erroSerie}
          altura={360}
        />
      </div>

      <ResumoFinanceiroTable
        rows={resumoFinanceiroDados}
        isLoading={resumoFinanceiro.isLoading}
        error={resumoFinanceiro.error}
        nomeArquivo={`executivo-resumo-financeiro-${dataInicio}-${dataFim}.csv`}
      />
    </div>
  );
}
