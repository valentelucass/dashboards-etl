import { TableText } from '../components/shared/DashboardTable';
import { LoadingKpiGrid } from '../components/shared/DashboardLoading';
import { ToggleButton } from '@astryxdesign/core/ToggleButton';
import { Card } from '@astryxdesign/core/Card';
import DashboardButton from "../components/shared/DashboardButton";
import { useEffect, useMemo, useState } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
import { useTrackingDashboard, useTrackingDetalhesPaginada } from '../hooks/queries/useTracking';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type { TrackingFiltro, TrackingMatrizRegiao, TrackingRawRow } from '../types/tracking';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { buildBaseBarOption, buildBaseDonutOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarMoeda, formatarPeso } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const STATUS_RAPIDOS = ['NO ARMAZÉM', 'Em transferência', 'Em entrega'] as const;
const STATUS_BASE = ['NO ARMAZÉM', 'Manifestado', 'Em transferência', 'Em entrega', 'Entregue', 'Cancelado'];
const FILIAL_ATUAL_PADRAO = 'AGU - RODOGARCIA TRANSPORTES RODOVIARIOS LTDA';
const REGIOES_POR_PAGINA = 9;
function numeroCurto(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}

function codigoRegiaoDestino(linha: TrackingMatrizRegiao): string {
  const bruto = linha.siglaRegiaoDestino?.trim() || 'SEM_MAP';
  const primeiraParte = bruto.split(/\s*-\s*/)[0]?.trim() || bruto;

  if (/^[A-Za-z0-9_/-]{2,8}$/.test(primeiraParte)) {
    return primeiraParte.toUpperCase();
  }

  return bruto.length <= 8 ? bruto.toUpperCase() : bruto.slice(0, 6).toUpperCase();
}

function removerPrefixoCodigoRegiao(texto: string, codigo: string): string {
  if (!texto.toUpperCase().startsWith(codigo.toUpperCase())) {
    return texto;
  }

  const restante = texto.slice(codigo.length).trimStart();
  return restante.startsWith('-') ? restante.slice(1).trimStart() : texto;
}

function descricaoRegiaoDestino(linha: TrackingMatrizRegiao, codigo: string): string {
  let descricao = linha.siglaRegiaoDestino?.trim() || '';

  for (let i = 0; i < 2; i += 1) {
    descricao = removerPrefixoCodigoRegiao(descricao, codigo);
  }

  if (descricao && descricao.toUpperCase() !== codigo.toUpperCase()) {
    return descricao;
  }

  return linha.responsavelRegiaoDestino?.trim() || 'Sem responsável';
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
    manifestado: 'var(--color-data-categorical-blue)',
    'em transferência': 'var(--color-data-categorical-purple)',
    'em entrega': 'var(--color-data-categorical-orange)',
    entregue: 'var(--color-data-categorical-green)',
    cancelado: 'var(--color-data-categorical-red)',
    canceled: 'var(--color-data-categorical-red)',
    cancelled: 'var(--color-data-categorical-red)',
    'sem status': 'var(--color-data-neutral)',
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

function MatrizRegiaoDestino({
  linhas,
  statusSelecionados,
  onToggleStatus,
}: {
  linhas: TrackingMatrizRegiao[];
  statusSelecionados: string[];
  onToggleStatus: (status: string) => void;
}) {
  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / REGIOES_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * REGIOES_POR_PAGINA;
  const linhasVisiveis = linhas.slice(inicio, inicio + REGIOES_POR_PAGINA);
  const linhasReserva = linhas.length > 0 ? Math.max(0, REGIOES_POR_PAGINA - linhasVisiveis.length) : 0;

  return (
    <Card padding={4} className="tracking-region-matrix @container/regioes mb-6 flex h-full min-h-0 min-w-0 flex-col">
      <div className="mb-3 flex shrink-0 flex-col flex-wrap gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--color-border)' }}>
        <div className="min-w-0">
          <h2 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            <TableText>Responsável pela Região de Destino</TableText>
          </h2>
          <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
            {linhas.length} regiões
          </span>
        </div>
        <div className="flex max-w-full flex-wrap gap-1.5" role="group" aria-label="Filtro rápido de status">
          {STATUS_RAPIDOS.map(status => (
            <ToggleButton key={status} label={status === 'NO ARMAZÉM' ? 'No armazém' : status}
              size="sm" isPressed={statusSelecionados.includes(status)} onPressedChange={() => onToggleStatus(status)} />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <div className="hidden grid-cols-[5.75rem_minmax(5.8rem,1fr)_minmax(6.1rem,1fr)_minmax(6.1rem,1fr)_minmax(4.25rem,0.74fr)_minmax(4.75rem,0.74fr)] gap-2 px-3 pb-2 text-[10px] font-semibold uppercase @min-[38rem]/regioes:grid" style={{ color: 'var(--color-text-subtle)' }}>
          <span>Região</span>
          <span className="text-right">Peso Taxado</span>
          <span className="text-right">Valor Frete</span>
          <span className="text-right">Valor NF</span>
          <span className="text-right">Volumes</span>
          <span className="text-right">Fora Prazo</span>
        </div>

        <div className="space-y-1">
          {linhasVisiveis.map((linha, index) => {
            const codigo = codigoRegiaoDestino(linha);
            const descricao = descricaoRegiaoDestino(linha, codigo);

            return (
              <div
                key={`${linha.siglaRegiaoDestino}-${linha.responsavelRegiaoDestino}`}
                className="rounded-lg border px-3 py-2.5"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: index % 2 === 0 ? 'var(--color-bg)' : 'transparent',
                }}
              >
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 @min-[38rem]/regioes:grid-cols-[5.75rem_minmax(5.8rem,1fr)_minmax(6.1rem,1fr)_minmax(6.1rem,1fr)_minmax(4.25rem,0.74fr)_minmax(4.75rem,0.74fr)] @min-[38rem]/regioes:items-center @min-[38rem]/regioes:gap-2">
                  <div className="col-span-2 min-w-0 @min-[38rem]/regioes:col-span-1">
                    <div className="text-2xl font-extrabold leading-none @min-[38rem]/regioes:text-[23px]" style={{ color: 'var(--color-text)' }}>
                      <TableText>{codigo}</TableText>
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
                      <TableText>{descricao}</TableText>
                    </div>
                  </div>
                  <MetricCell label="Peso Taxado" value={formatarPeso(linha.pesoTaxado)} />
                  <MetricCell label="Valor Frete" value={formatarMoeda(linha.valorFrete)} />
                  <MetricCell label="Valor NF" value={formatarMoeda(linha.valorNota)} />
                  <MetricCell label="Volumes" value={numeroCurto(linha.volumes)} />
                  <MetricCell label="Fora do Prazo" value={numeroCurto(linha.foraDoPrazo)} danger={linha.foraDoPrazo > 0} className="col-span-2 text-center @min-[38rem]/regioes:col-span-1 @min-[38rem]/regioes:text-right" />
                </div>
              </div>
            );
          })}
          {Array.from({ length: linhasReserva }, (_, index) => (
            <div
              key={`reserva-matriz-${index}`}
              aria-hidden="true"
              className="pointer-events-none invisible hidden rounded-lg border px-3 py-2.5 @min-[38rem]/regioes:block"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="grid grid-cols-[5.75rem_minmax(5.8rem,1fr)_minmax(6.1rem,1fr)_minmax(6.1rem,1fr)_minmax(4.25rem,0.74fr)_minmax(4.75rem,0.74fr)] items-center gap-2">
                <div className="min-w-0">
                  <div className="text-[23px] font-extrabold leading-none">---</div>
                  <div className="mt-0.5 text-[11px] font-medium">Reserva</div>
                </div>
                <MetricCell label="Peso Taxado" value="0 kg" />
                <MetricCell label="Valor Frete" value="R$ 0,00" />
                <MetricCell label="Valor NF" value="R$ 0,00" />
                <MetricCell label="Volumes" value="0" />
                <MetricCell label="Fora do Prazo" value="0" />
              </div>
            </div>
          ))}
          {linhas.length === 0 && (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              Nenhuma carga encontrada.
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
          {linhas.length === 0 ? '0 regiões' : `${inicio + 1}-${Math.min(inicio + REGIOES_POR_PAGINA, linhas.length)} de ${linhas.length}`}
        </span>
        <div className="flex items-center gap-1">
          <DashboardButton
            type="button"
            aria-label="Página anterior"
            disabled={paginaAtual === 0}
            onClick={() => setPagina(Math.max(0, paginaAtual - 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <ChevronLeft size={14} />
          </DashboardButton>
          <span className="min-w-10 text-center text-[11px] font-semibold" style={{ color: 'var(--color-text)' }}>
            {paginaAtual + 1}/{totalPaginas}
          </span>
          <DashboardButton
            type="button"
            aria-label="Próxima página"
            disabled={paginaAtual >= totalPaginas - 1}
            onClick={() => setPagina(Math.min(totalPaginas - 1, paginaAtual + 1))}
            className="flex h-7 w-7 items-center justify-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-40"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <ChevronRight size={14} />
          </DashboardButton>
        </div>
      </div>
    </Card>
  );
}

function MetricCell({ label, value, danger = false, className = '' }: { label: string; value: string; danger?: boolean; className?: string }) {
  return (
    <div className={`min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-2 text-center @min-[38rem]/regioes:rounded-none @min-[38rem]/regioes:border-0 @min-[38rem]/regioes:bg-transparent @min-[38rem]/regioes:px-0 @min-[38rem]/regioes:py-0 @min-[38rem]/regioes:text-right ${className}`}>
      <div className="text-[17px] font-bold leading-tight tabular-nums @min-[38rem]/regioes:text-lg" style={{ color: danger ? 'var(--color-negative-text)' : 'var(--color-text)' }}>
        <TableText>{value}</TableText>
      </div>
      <div className="mt-0.5 text-[11px] font-medium" style={{ color: 'var(--color-text-subtle)' }}>
        <TableText>{label}</TableText>
      </div>
    </div>
  );
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

  const filtro: TrackingFiltro = {
    dataInicio,
    dataFim,
    filialAtual: filialAtualFiltro,
    statusCarga: filtros.statusCarga,
  };

  const activeFilters: ActiveFilter[] = [
    {
      label: 'Filial Atual',
      count: filialAtualFiltro.length,
      valueLabel: codigoFilialAtual(filialAtualSelecionada),
      onRemove: () => setFiltro('filialAtual', []),
    },
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
    description: 'Status da carga, previsões vencidas e carteira em trânsito.',
    updatedAt: dashboard.data?.overview.updatedAt ?? null,
  });

  const statusData = useMemo(() => dashboard.data?.graficos.statusDistribuicao ?? [], [dashboard.data?.graficos.statusDistribuicao]);
  const valorRegiao = useMemo(() => dashboard.data?.graficos.valorPorRegiaoDestino ?? [], [dashboard.data?.graficos.valorPorRegiaoDestino]);
  const matriz = dashboard.data?.matrizRegiaoDestino ?? [];

  const statusTabelaOptions = combinarStatusOptions(
    STATUS_BASE,
    statusData.map((item) => item.status),
    (tabela.data?.conteudo ?? []).map((item) => item.statusCarga),
    filtros.statusCarga,
  );

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
        <AsyncMultiSelect
          label="Status"
          opcoes={STATUS_BASE}
          selecionados={filtros.statusCarga ?? []}
          onChange={(valores) => setFiltro('statusCarga', valores)}
        />
      </FilterBar>

      {dashboard.isError && <MensagemErro mensagem={getApiErrorMessage(dashboard.error, 'Erro ao carregar localização de cargas.')} tipo={getTipoErro(dashboard.error)} />}
      {dashboard.isLoading && !dashboard.data && <LoadingKpiGrid count={6} className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6" />}
      {dashboard.data && <TrackingKpiGrid overview={dashboard.data.overview} />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
        <MatrizRegiaoDestino linhas={matriz} statusSelecionados={filtros.statusCarga ?? []} onToggleStatus={alternarStatus} />
        <div className="grid grid-cols-1 gap-6">
          <ChartWrapper titulo="Distribuição de Status" chartKey="trackingStatus" option={statusOption} isLoading={dashboard.isLoading} isEmpty={statusData.length === 0} altura={350} />
          <ChartWrapper titulo="Valor por Região de Destino" chartKey="trackingValorRegiao" option={valorRegiaoOption} isLoading={dashboard.isLoading} isEmpty={valorRegiao.length === 0} altura={350} />
        </div>
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
        statusOptions={statusTabelaOptions}
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
