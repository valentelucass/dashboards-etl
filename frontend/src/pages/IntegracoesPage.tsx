import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { EChartsOption } from 'echarts';
import { Eye } from 'lucide-react';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import AnalyticalDataTable, {
  type ColunaTabelaAnalitica,
  type SortDirection,
} from '../components/shared/AnalyticalDataTable';
import ExportButton from '../components/shared/ExportButton';
import CanhotoImagemModal from '../components/domain/integracoes/CanhotoImagemModal';
import KpiCard from '../components/shared/KpiCard';
import TooltipKpi from '../components/shared/TooltipKpi';
import DateRangePicker from '../components/shared/DateRangePicker';
import FilterBar from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import {
  buscarIntegracoesAuditoria,
  buscarIntegracoesEvolucaoDiaria,
  buscarExecucoesWorkSftpClientes,
  buscarStatusWorkSftpClientes,
  exportarIntegracoesCsv,
  type IntegracoesEscopo,
  type IntegracaoEvolucaoDiaria,
  type IntegracaoMetricaConsolidada,
  type IntegracaoPendencia,
  type ResumoTabelaIntegracao,
  type WorkSftpClienteStatus,
} from '../api/endpoints/integracoesServico';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarDataHora, formatarNumero, formatarPorcentagem } from '../utils/formatadores';
import {
  filtrarPorDestinosSelecionados,
  respostaContemDestinoForaDaSelecao,
} from '../utils/integracoesDestinoFilter';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../utils/pollingUtils';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const QUERY_KEY = ['integracoes'];
const STATUS_PADRAO = ['SUCESSO', 'ERRO_DESTINO', 'PENDENTE_FOTO'];
const EMPTY_METRICAS: IntegracaoMetricaConsolidada[] = [];
const EMPTY_PENDENCIAS: IntegracaoPendencia[] = [];
const EMPTY_EVOLUCAO_DIARIA: IntegracaoEvolucaoDiaria[] = [];
const EMPTY_SFTP_CLIENTES: WorkSftpClienteStatus[] = [];
const TODOS_DESTINOS_INTEGRACAO: string[] = [];
const OPCOES_DESTINO_INTEGRACAO = ['PPG', 'VEDACIT', 'SELIA'];
const DESTINOS_GRAFICOS_INTEGRACOES: IntegracaoMetricaConsolidada[] = [
  { sistemaDestino: 'PPG', totalRegistros: 0, percentualXmlSucesso: 0, percentualCanhotoSucesso: 0 },
  { sistemaDestino: 'VEDACIT', totalRegistros: 0, percentualXmlSucesso: 0, percentualCanhotoSucesso: 0 },
  {
    sistemaDestino: 'SELIA',
    totalRegistros: 0,
    percentualXmlSucesso: 0,
    percentualCanhotoSucesso: 0,
    rotuloDados: 'AddEvents',
    rotuloComprovante: 'POD/Comprovante',
  },
];
type IntegracoesAba = IntegracoesEscopo;
type IntegracoesValorTone = 'text-positive' | 'text-warning' | 'text-negative';
type TooltipParam = {
  axisValue?: string | number;
  axisValueLabel?: string;
  dataIndex?: number;
  marker?: string;
  seriesName?: string;
  value?: number | string | Array<number | string | null> | null;
};

const KPI_VALOR_CLASS = 'text-2xl font-bold truncate';
const ABAS_STATUS_INTEGRACOES: { valor: IntegracoesEscopo; label: string }[] = [
  { valor: 'PENDENCIAS', label: 'Pendências Operacionais' },
  { valor: 'SUCESSO', label: 'Integrados com Sucesso' },
];

interface IntegracoesTableSort {
  field: keyof IntegracaoPendencia & string;
  direction: SortDirection;
}

function formatarPercentual(valor: number | null | undefined) {
  return typeof valor === 'number' && Number.isFinite(valor) ? formatarPorcentagem(valor, 2) : '-';
}

function valorClass(tone: IntegracoesValorTone) {
  return `${KPI_VALOR_CLASS} ${tone}`;
}

function tomPercentual(valor: number | null | undefined): IntegracoesValorTone {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 'text-negative';
  if (valor >= 95) return 'text-positive';
  if (valor >= 80) return 'text-warning';
  return 'text-negative';
}

function formatarInteiro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? formatarNumero(numero) : '-';
}

function formatarData(valor: unknown) {
  return typeof valor === 'string' && valor.trim() ? formatarDataHora(valor) : '-';
}

function renderStatus(valor: unknown) {
  return valor ? <StatusBadge status={String(valor)} /> : '-';
}

function formatarDuracaoMs(valor: number) {
  if (!Number.isFinite(valor) || valor < 0) return '-';
  if (valor < 1_000) return `${valor} ms`;
  return `${(valor / 1_000).toFixed(valor >= 10_000 ? 0 : 1)} s`;
}

function ResumoSftpMetrica({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="min-w-0 border-l pl-3 first:border-l-0 first:pl-0" style={{ borderColor: 'var(--color-border)' }}>
      <p className="truncate text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function numeroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function completarDestinosGraficos(metricas: IntegracaoMetricaConsolidada[], destinosSelecionados: string[]) {
  const metricasSelecionadas = filtrarPorDestinosSelecionados(metricas, destinosSelecionados);
  const destinosRetornados = new Set(
    metricasSelecionadas.map((item) => item.sistemaDestino.trim().toUpperCase()),
  );

  return [
    ...metricasSelecionadas,
    ...DESTINOS_GRAFICOS_INTEGRACOES.filter((item) =>
      (destinosSelecionados.length === 0 || destinosSelecionados.includes(item.sistemaDestino))
      && !destinosRetornados.has(item.sistemaDestino),
    ),
  ];
}

function normalizarTooltipParams(params: unknown): TooltipParam[] {
  return Array.isArray(params) ? params as TooltipParam[] : [params as TooltipParam];
}

function calcularVolumeTotal(metricas: IntegracaoMetricaConsolidada[]) {
  return metricas.reduce((total, item) => total + numeroSeguro(item.totalRegistros), 0);
}

function calcularTaxaPonderada(
  metricas: IntegracaoMetricaConsolidada[],
  campo: 'percentualXmlSucesso' | 'percentualCanhotoSucesso',
) {
  const volumeTotal = calcularVolumeTotal(metricas);
  if (volumeTotal <= 0) {
    return 0;
  }

  const sucessoPonderado = metricas.reduce(
    (total, item) => total + numeroSeguro(item.totalRegistros) * numeroSeguro(item[campo]),
    0,
  );
  return sucessoPonderado / volumeTotal;
}

function calcularTotalErros(evolucaoDiaria: IntegracaoEvolucaoDiaria[]) {
  return evolucaoDiaria.reduce((total, item) => total + numeroSeguro(item.erros), 0);
}

function percentualSeguro(parte: number, total: number) {
  if (!Number.isFinite(parte) || !Number.isFinite(total) || total <= 0) {
    return 0;
  }

  return (parte * 100) / total;
}

function formatarDataEixo(valor: string) {
  const [data] = valor.split('T');
  const partes = data.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}`;
  }

  return valor;
}

function calcularSucessosPorPercentual(totalRegistros: number, percentual: number) {
  return Math.round(totalRegistros * Math.max(0, Math.min(percentual, 100)) / 100);
}

function rotuloEtapaDados(item: IntegracaoMetricaConsolidada) {
  const rotulo = item.rotuloDados?.trim();
  if (rotulo) return rotulo;
  return item.sistemaDestino.trim().toUpperCase() === 'SELIA' ? 'AddEvents' : 'XML/Dados';
}

function rotuloEtapaComprovante(item: IntegracaoMetricaConsolidada) {
  const rotulo = item.rotuloComprovante?.trim();
  if (rotulo) return rotulo;
  return item.sistemaDestino.trim().toUpperCase() === 'SELIA' ? 'POD/Comprovante' : 'Canhoto';
}

function buildResumoIntegracoesDados(metricas: IntegracaoMetricaConsolidada[]): ResumoTabelaIntegracao[] {
  return metricas
    .flatMap((item) => {
      const totalRegistros = numeroSeguro(item.totalRegistros);
      const sucessoXml = calcularSucessosPorPercentual(totalRegistros, numeroSeguro(item.percentualXmlSucesso));
      const sucessoCanhoto = calcularSucessosPorPercentual(totalRegistros, numeroSeguro(item.percentualCanhotoSucesso));

      return [
        {
          entidadeTabela: `${item.sistemaDestino} - ${rotuloEtapaDados(item)}`,
          totalProcessado: totalRegistros,
          totalSucesso: sucessoXml,
          totalErro: Math.max(totalRegistros - sucessoXml, 0),
          totalQuarentena: 0,
        },
        {
          entidadeTabela: `${item.sistemaDestino} - ${rotuloEtapaComprovante(item)}`,
          totalProcessado: totalRegistros,
          totalSucesso: sucessoCanhoto,
          totalErro: Math.max(totalRegistros - sucessoCanhoto, 0),
          totalQuarentena: 0,
        },
      ];
    })
    .sort((a, b) => {
      const errosA = numeroSeguro(a.totalErro) + numeroSeguro(a.totalQuarentena);
      const errosB = numeroSeguro(b.totalErro) + numeroSeguro(b.totalQuarentena);
      if (errosA !== errosB) return errosB - errosA;

      const totalA = numeroSeguro(a.totalProcessado);
      const totalB = numeroSeguro(b.totalProcessado);
      if (totalA !== totalB) return totalB - totalA;

      return a.entidadeTabela.localeCompare(b.entidadeTabela);
    });
}

function calcularMetricasResumoIntegracoes(dados: ResumoTabelaIntegracao[]) {
  const totais = dados.reduce(
    (acc, item) => {
      acc.totalProcessado += numeroSeguro(item.totalProcessado);
      acc.totalSucesso += numeroSeguro(item.totalSucesso);
      acc.totalErro += numeroSeguro(item.totalErro);
      acc.totalQuarentena += numeroSeguro(item.totalQuarentena);

      return acc;
    },
    {
      totalProcessado: 0,
      totalSucesso: 0,
      totalErro: 0,
      totalQuarentena: 0,
    },
  );
  const etapaMaiorVolume = dados.reduce<ResumoTabelaIntegracao | null>((maior, item) => {
    if (!maior) return item;

    return numeroSeguro(item.totalProcessado) > numeroSeguro(maior.totalProcessado) ? item : maior;
  }, null);
  const etapaCritica = dados.reduce<ResumoTabelaIntegracao | null>((critica, item) => {
    if (!critica) return item;

    const errosItem = numeroSeguro(item.totalErro) + numeroSeguro(item.totalQuarentena);
    const errosCritica = numeroSeguro(critica.totalErro) + numeroSeguro(critica.totalQuarentena);
    if (errosItem !== errosCritica) {
      return errosItem > errosCritica ? item : critica;
    }

    const taxaItem = percentualSeguro(errosItem, numeroSeguro(item.totalProcessado));
    const taxaCritica = percentualSeguro(errosCritica, numeroSeguro(critica.totalProcessado));
    return taxaItem > taxaCritica ? item : critica;
  }, null);
  const totalErroPendencia = totais.totalErro + totais.totalQuarentena;
  const etapasComErro = dados.filter((item) => numeroSeguro(item.totalErro) + numeroSeguro(item.totalQuarentena) > 0);

  return {
    etapasMonitoradas: dados.length,
    totalProcessado: totais.totalProcessado,
    totalSucesso: totais.totalSucesso,
    totalErroPendencia,
    taxaSucesso: percentualSeguro(totais.totalSucesso, totais.totalProcessado),
    etapasComErroQuantidade: etapasComErro.length,
    etapaMaiorVolume,
    etapaCritica,
    etapaCriticaErros: etapaCritica ? numeroSeguro(etapaCritica.totalErro) + numeroSeguro(etapaCritica.totalQuarentena) : 0,
  };
}

function ResumoIntegracoesKpi({
  label,
  value,
  color = 'var(--color-text)',
  detail,
  title,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  detail?: ReactNode;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>
      <p className="mt-1 truncate text-xl font-bold leading-tight" title={title} style={{ color }}>
        {value}
      </p>
      {detail ? (
        <p className="mt-1 truncate text-xs font-semibold" title={title} style={{ color: 'var(--color-text-muted)' }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function buildSazonalidadeOption(dados: IntegracaoEvolucaoDiaria[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const datas = dados.map((item) => formatarDataEixo(item.data));

  return buildBaseLineOption(isDark, {
    color: [tokens.palette[2], tokens.palette[3]],
    legend: {
      top: 0,
      right: 8,
      bottom: undefined,
    },
    grid: {
      top: 54,
      right: 24,
      bottom: 28,
      left: 48,
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: datas,
    },
    yAxis: {
      type: 'value',
      name: 'Registros',
    },
    series: [
      {
        name: 'Sucessos',
        type: 'line',
        data: dados.map((item) => numeroSeguro(item.sucessos)),
        areaStyle: {},
        itemStyle: { color: tokens.palette[2] },
        lineStyle: { color: tokens.palette[2] },
      },
      {
        name: 'Erros',
        type: 'line',
        data: dados.map((item) => numeroSeguro(item.erros)),
        areaStyle: {},
        itemStyle: { color: tokens.palette[3] },
        lineStyle: { color: tokens.palette[3], type: 'dashed' },
      },
    ],
  });
}

function buildSaudePorDestinoOption(metricas: IntegracaoMetricaConsolidada[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const dados = metricas
    .map((item) => {
      const totalRegistros = numeroSeguro(item.totalRegistros);
      const sucessos = calcularSucessosPorPercentual(totalRegistros, numeroSeguro(item.percentualXmlSucesso));

      return {
        destino: item.sistemaDestino,
        sucessos,
        erros: Math.max(totalRegistros - sucessos, 0),
      };
    })
    .sort((a, b) => (b.sucessos + b.erros) - (a.sucessos + a.erros));

  return buildBaseBarOption(isDark, {
    color: [tokens.palette[2], tokens.palette[3]],
    legend: {
      top: 0,
      right: 8,
      bottom: undefined,
    },
    grid: {
      top: 54,
      right: 24,
      bottom: 24,
      left: 76,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'Registros',
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: dados.map((item) => item.destino),
    },
    series: [
      {
        name: 'Sucessos',
        type: 'bar',
        stack: 'integracoes',
        data: dados.map((item) => item.sucessos),
        itemStyle: { color: tokens.palette[2] },
      },
      {
        name: 'Erros',
        type: 'bar',
        stack: 'integracoes',
        data: dados.map((item) => item.erros),
        itemStyle: { color: tokens.palette[3] },
      },
    ],
  });
}

function buildResumoIntegracoesOption(dados: ResumoTabelaIntegracao[], isDark: boolean): EChartsOption {
  const tokens = getEchartsThemeTokens(isDark);
  const categorias = dados.map((item) => item.entidadeTabela);
  const zoomEnd = dados.length > 12
    ? Math.min(100, (12 / dados.length) * 100)
    : 100;

  return buildBaseBarOption(isDark, {
    legend: {
      show: false,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: unknown) => {
        const itens = normalizarTooltipParams(params);
        const indice = Number(itens[0]?.dataIndex ?? -1);
        const item = Number.isInteger(indice) && indice >= 0 ? dados[indice] : null;
        const entidade = item?.entidadeTabela ?? String(itens[0]?.axisValueLabel ?? itens[0]?.axisValue ?? '');
        const erros = numeroSeguro(item?.totalErro);
        const quarentena = numeroSeguro(item?.totalQuarentena);
        const totalProcessado = numeroSeguro(item?.totalProcessado);
        const linhas = [
          entidade,
          `Total processado: ${formatarNumero(totalProcessado)}`,
          `Sucesso: ${formatarNumero(numeroSeguro(item?.totalSucesso))}`,
          `Erros/Pendências: ${formatarNumero(erros + quarentena)}`,
          `Taxa de sucesso: ${formatarPorcentagem(percentualSeguro(numeroSeguro(item?.totalSucesso), totalProcessado), 1)}`,
        ];

        if (quarentena > 0) {
          linhas.push(`Quarentena: ${formatarNumero(quarentena)}`);
        }

        return linhas.join('<br/>');
      },
    },
    grid: {
      top: 54,
      right: 36,
      bottom: 42,
      left: 8,
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'Registros',
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: categorias,
      axisLabel: {
        width: 220,
        overflow: 'truncate',
        fontSize: 12,
        fontWeight: 700,
        color: 'var(--color-text)',
        margin: 12,
      },
    },
    dataZoom: dados.length > 12 ? [
      {
        type: 'slider',
        yAxisIndex: 0,
        right: 8,
        start: 0,
        end: zoomEnd,
        width: 14,
        filterMode: 'none',
      },
      {
        type: 'inside',
        yAxisIndex: 0,
        filterMode: 'none',
      },
    ] : undefined,
    series: [
      {
        name: 'Total processado',
        type: 'bar',
        data: dados.map((item) => numeroSeguro(item.totalProcessado)),
        itemStyle: { color: tokens.palette[0] },
        label: {
          show: true,
          position: 'right',
          formatter: (params: { value?: unknown }) => formatarNumero(numeroSeguro(params.value)),
        },
        emphasis: { focus: 'series' },
      },
    ],
  });
}

function temIndicadorImagem(item: IntegracaoPendencia) {
  return Boolean(
    item.canhotoReferencia?.trim()
      || item.possuiImagem
      || item.possuiImagemCanhoto
      || item.possuiImagemPayload
      || item.imagemDisponivel,
  );
}

function podeVisualizarCanhoto(item: IntegracaoPendencia) {
  return temIndicadorImagem(item) && Boolean(item.canhotoReferencia?.trim());
}

function criarColunas(
  onVerCanhoto: (item: IntegracaoPendencia) => void,
): ColunaTabelaAnalitica<IntegracaoPendencia>[] {
  return [
    { chave: 'sistemaDestino', label: 'Sistema Destino', fixo: true, largura: '160px' },
    { chave: 'numeroNf', label: 'NF', largura: '120px', formato: formatarInteiro, filtroTabela: 'codigo' },
    { chave: 'serieNf', label: 'Série', largura: '100px' },
    {
      chave: 'chaveNfe',
      label: 'Chave NF-e',
      largura: '360px',
      formato: (valor) => (
        <span className="block max-w-[360px] truncate" title={typeof valor === 'string' ? valor : undefined}>
          {typeof valor === 'string' && valor.trim() ? valor : '-'}
        </span>
      ),
    },
    { chave: 'statusDados', label: 'Status Dados/Evento', largura: '160px', filtroTabela: 'status', formato: renderStatus },
    { chave: 'statusCanhoto', label: 'Status Comprovante/POD', largura: '190px', filtroTabela: 'status', formato: renderStatus },
    { chave: 'dataProcessamento', label: 'Data de Processamento', largura: '210px', formato: formatarData },
    {
      chave: 'id',
      label: 'Canhoto',
      largura: '112px',
      ordenavel: false,
      filtravel: false,
      formato: (_valor, row) => {
        const habilitado = podeVisualizarCanhoto(row);

        return (
          <button
            type="button"
            onClick={() => {
              if (habilitado) {
                onVerCanhoto(row);
              }
            }}
            disabled={!habilitado}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-45 hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
            aria-label={habilitado ? 'Ver canhoto' : 'Canhoto indisponivel'}
            title={habilitado ? 'Ver canhoto' : 'Canhoto indisponivel'}
          >
            <Eye size={15} aria-hidden="true" />
          </button>
        );
      },
    },
  ];
}

interface SegmentedTabsProps<TValor extends string> {
  ariaLabel: string;
  options: { valor: TValor; label: string }[];
  selected: TValor;
  onChange: (valor: TValor) => void;
}

function SegmentedTabs<TValor extends string>({
  ariaLabel,
  options,
  selected,
  onChange,
}: SegmentedTabsProps<TValor>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex min-w-0 max-w-full items-center gap-1 overflow-x-auto rounded-lg border p-0.5"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {options.map((aba) => {
        const ativa = selected === aba.valor;
        return (
          <button
            key={aba.valor}
            type="button"
            role="tab"
            data-state={ativa ? 'active' : 'inactive'}
            aria-selected={ativa}
            onClick={() => onChange(aba.valor)}
            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-3 text-xs font-semibold transition-colors hover:bg-[var(--color-card)] data-[state=active]:shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{
              backgroundColor: ativa ? 'var(--color-card)' : 'transparent',
              color: ativa ? 'var(--color-text)' : 'var(--color-text-muted)',
            }}
          >
            {aba.label}
          </button>
        );
      })}
    </div>
  );
}

export default function IntegracoesPage() {
  const [pendenciaCanhoto, setPendenciaCanhoto] = useState<IntegracaoPendencia | null>(null);
  const [abaSelecionada, setAbaSelecionada] = useState<IntegracoesAba>('PENDENCIAS');
  const [tableSort, setTableSort] = useState<IntegracoesTableSort | null>(null);
  const [sftpCliente, setSftpCliente] = useState('');
  const [sftpStatus, setSftpStatus] = useState('');
  const [destinoSelecionado, setDestinoSelecionado] = useState('');
  const { dataInicio, dataFim, setDataInicio, setDataFim, setDataRange } = useFiltro();
  const destinosSelecionados = destinoSelecionado ? [destinoSelecionado] : TODOS_DESTINOS_INTEGRACAO;
  const { isDark } = useEchartsTheme();
  const filtrosTabela = useAnalyticalTableFilters();
  const escopoTabelaSelecionado = abaSelecionada;
  const paginacaoTabela = useTabelaPaginadaState(`${filtrosTabela.resetKey}:${escopoTabelaSelecionado}:${dataInicio}:${dataFim}`);
  const paginacaoSftp = useTabelaPaginadaState(`work-sftp-clientes:${dataInicio}:${dataFim}`);

  const integracoes = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [
      ...QUERY_KEY,
      dataInicio,
      dataFim,
      paginacaoTabela.pagina,
      paginacaoTabela.tamanhoPagina,
      filtrosTabela.apiFilters,
      tableSort,
      escopoTabelaSelecionado,
      destinosSelecionados,
    ],
    queryFn: () => buscarIntegracoesAuditoria(
      paginacaoTabela.pagina,
      paginacaoTabela.tamanhoPagina,
      dataInicio,
      dataFim,
      filtrosTabela.apiFilters,
      tableSort?.field,
      tableSort?.direction,
      escopoTabelaSelecionado,
      destinosSelecionados,
    ),
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const evolucaoDiariaQuery = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'evolucao-diaria', dataInicio, dataFim, destinosSelecionados],
    queryFn: () => buscarIntegracoesEvolucaoDiaria(dataInicio, dataFim, undefined, destinosSelecionados),
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const statusSftpClientes = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'vedacit-sftp', 'clientes'],
    queryFn: buscarStatusWorkSftpClientes,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const execucoesSftp = useQuery({
    ...OPERATIONAL_QUERY_POLLING_OPTIONS,
    queryKey: [...QUERY_KEY, 'vedacit-sftp', 'execucoes', dataInicio, dataFim, sftpCliente, sftpStatus, paginacaoSftp.pagina, paginacaoSftp.tamanhoPagina],
    queryFn: () => buscarExecucoesWorkSftpClientes(
      paginacaoSftp.pagina, paginacaoSftp.tamanhoPagina, dataInicio, dataFim, sftpCliente || undefined, sftpStatus || undefined,
    ),
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
    retry: 1,
  });

  const abrirCanhoto = useCallback((item: IntegracaoPendencia) => {
    if (!podeVisualizarCanhoto(item)) {
      return;
    }

    setPendenciaCanhoto(item);
  }, []);

  const fecharCanhoto = useCallback(() => {
    setPendenciaCanhoto(null);
  }, []);

  const colunas = useMemo(() => criarColunas(abrirCanhoto), [abrirCanhoto]);

  usePageHeader({
    title: 'Integrações',
    description: 'Auditoria operacional de XML e comprovantes enviados para clientes.',
    updatedAt: integracoes.data?.geradoEm ?? null,
  });

  const metricas = useMemo(
    () => completarDestinosGraficos(integracoes.data?.metricasConsolidadas ?? EMPTY_METRICAS, destinosSelecionados),
    [destinosSelecionados, integracoes.data?.metricasConsolidadas],
  );
  const sateliteIgnorouFiltroDestino = useMemo(
    () => respostaContemDestinoForaDaSelecao(
      integracoes.data?.metricasConsolidadas ?? EMPTY_METRICAS,
      destinosSelecionados,
      (metrica) => numeroSeguro(metrica.totalRegistros) > 0,
    ),
    [destinosSelecionados, integracoes.data?.metricasConsolidadas],
  );
  const evolucaoDiaria = sateliteIgnorouFiltroDestino
    ? EMPTY_EVOLUCAO_DIARIA
    : evolucaoDiariaQuery.data ?? EMPTY_EVOLUCAO_DIARIA;
  const resumoTabelasIntegracoes = useMemo(
    () => buildResumoIntegracoesDados(metricas),
    [metricas],
  );
  const metricasResumoIntegracoes = useMemo(
    () => calcularMetricasResumoIntegracoes(resumoTabelasIntegracoes),
    [resumoTabelasIntegracoes],
  );
  const volumeTotal = calcularVolumeTotal(metricas);
  const taxaSucessoGlobal = calcularTaxaPonderada(metricas, 'percentualXmlSucesso');
  const taxaSucessoCanhotos = calcularTaxaPonderada(metricas, 'percentualCanhotoSucesso');
  const totalPendencias = calcularTotalErros(evolucaoDiaria);
  const pendencias = sateliteIgnorouFiltroDestino
    ? EMPTY_PENDENCIAS
    : integracoes.data?.pendencias.itens ?? EMPTY_PENDENCIAS;
  const totalRegistrosTabela = sateliteIgnorouFiltroDestino
    ? 0
    : integracoes.data?.pendencias.paginacao.totalElementos;
  const ciclosSftp = execucoesSftp.data?.itens ?? EMPTY_SFTP_CLIENTES;
  const historicoSftpVazio = !execucoesSftp.isLoading && ciclosSftp.length === 0;
  const tituloTabela = escopoTabelaSelecionado === 'PENDENCIAS'
    ? 'Pendências operacionais'
    : 'Integrados com sucesso';
  const sazonalidadeOption = useMemo(
    () => buildSazonalidadeOption(evolucaoDiaria, isDark),
    [evolucaoDiaria, isDark],
  );
  const saudePorDestinoOption = useMemo(
    () => buildSaudePorDestinoOption(metricas, isDark),
    [isDark, metricas],
  );
  const resumoIntegracoesOption = useMemo(
    () => buildResumoIntegracoesOption(resumoTabelasIntegracoes, isDark),
    [isDark, resumoTabelasIntegracoes],
  );

  const statusOptions = useMemo(
    () => combinarStatusOptions(
      STATUS_PADRAO,
      pendencias.map((item) => item.statusDados),
      pendencias.map((item) => item.statusCanhoto),
      filtrosTabela.filters.status,
    ),
    [filtrosTabela.filters.status, pendencias],
  );

  const selecionarStatusTabela = useCallback((escopo: IntegracoesEscopo) => {
    setAbaSelecionada(escopo);
    setPendenciaCanhoto(null);
  }, []);

  return (
    <div className="w-full">
      <FilterBar
        dataInicio={dataInicio}
        dataFim={dataFim}
        activeFilters={destinoSelecionado
          ? [{ label: 'Integração', count: 1, valueLabel: destinoSelecionado, onRemove: () => setDestinoSelecionado('') }]
          : []}
        onClear={() => setDestinoSelecionado('')}
        actions={(
          <div className="flex items-center gap-1" role="group" aria-label="Filtrar por integração">
            {[{ valor: '', label: 'Todos' }, ...OPCOES_DESTINO_INTEGRACAO.map((destino) => ({
              valor: destino,
              label: destino === 'VEDACIT' ? 'Vedacit' : destino,
            }))].map((opcao) => {
              const ativo = destinoSelecionado === opcao.valor;
              return (
                <button
                  key={opcao.label}
                  type="button"
                  aria-pressed={ativo}
                  onClick={() => setDestinoSelecionado(opcao.valor)}
                  className="h-8 cursor-pointer border-b-2 px-2 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                  style={{
                    color: ativo ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    borderBottomColor: ativo ? 'var(--color-primary)' : 'transparent',
                  }}
                >
                  {opcao.label}
                </button>
              );
            })}
          </div>
        )}
      >
        <DateRangePicker
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicioChange={setDataInicio}
          onDataFimChange={setDataFim}
          onRangeChange={setDataRange}
        />
      </FilterBar>

      {integracoes.isError && (
        <MensagemErro
          mensagem={getApiErrorMessage(integracoes.error, 'Erro ao carregar auditoria de integrações.')}
          tipo={getTipoErro(integracoes.error)}
        />
      )}

      {sateliteIgnorouFiltroDestino && (
        <section
          role="alert"
          className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.10)',
            borderColor: 'rgba(245, 158, 11, 0.35)',
            color: 'var(--color-text)',
          }}
        >
          O Satélite retornou destinos fora da seleção de Integração. Os dados foram ocultados para evitar
          indicadores incorretos; atualize o processo do Satélite com o contrato de filtro por destino.
        </section>
      )}

      <div className="contents">
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <TooltipKpi kpiName="integracoes.volumeOperacional">
              <KpiCard
                label="Volume Operacional"
                valor={formatarInteiro(volumeTotal)}
                metaLabel="Origem"
                metaValue="Satélite"
              />
            </TooltipKpi>
            <TooltipKpi kpiName="integracoes.taxaSucessoGlobal">
              <KpiCard
                label="Sucesso Dados/Eventos"
                valor={formatarPercentual(taxaSucessoGlobal)}
                valorClassName={valorClass(tomPercentual(taxaSucessoGlobal))}
                metaLabel="Base"
                metaValue="Dados/Eventos"
              />
            </TooltipKpi>
            <TooltipKpi kpiName="integracoes.taxaSucessoCanhotos">
              <KpiCard
                label="Sucesso Comprovantes/POD"
                valor={formatarPercentual(taxaSucessoCanhotos)}
                valorClassName={valorClass(tomPercentual(taxaSucessoCanhotos))}
                metaLabel="Base"
                metaValue="Comprovantes/POD"
              />
            </TooltipKpi>
            <TooltipKpi kpiName="integracoes.pendenciasErros">
              <KpiCard
                label="Pendências"
                valor={formatarInteiro(totalPendencias)}
                valorClassName={valorClass(numeroSeguro(totalPendencias) > 0 ? 'text-warning' : 'text-positive')}
                metaLabel="Base"
                metaValue="Erros"
              />
            </TooltipKpi>
          </div>

          <div className="mb-6 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ChartWrapper
              titulo="Sazonalidade de Integrações"
              option={sazonalidadeOption}
              isLoading={evolucaoDiariaQuery.isLoading}
              isEmpty={evolucaoDiaria.length === 0}
              erro={evolucaoDiariaQuery.isError
                ? getApiErrorMessage(evolucaoDiariaQuery.error, 'Erro ao carregar evolução diária.')
                : null}
              altura={350}
              chartKey="integracoesSazonalidade"
            />

            <ChartWrapper
              titulo="Saúde por Sistema Destino"
              option={saudePorDestinoOption}
              isLoading={integracoes.isLoading}
              isEmpty={volumeTotal <= 0}
              erro={integracoes.isError
                ? getApiErrorMessage(integracoes.error, 'Erro ao carregar saúde por destino.')
                : null}
              altura={350}
              chartKey="integracoesSaudeDestino"
            />
            <ChartWrapper
              titulo="Resumo por Entidade de Integração"
              option={resumoIntegracoesOption}
              isLoading={integracoes.isLoading}
              isEmpty={resumoTabelasIntegracoes.length === 0}
              erro={integracoes.isError
                ? getApiErrorMessage(integracoes.error, 'Erro ao carregar resumo por entidade de integração.')
                : null}
              altura={400}
              className="lg:col-span-2"
              chartKey="integracoesResumoEntidade"
              sideContentLayoutClassName="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6"
              sideContentChartClassName="xl:col-span-2"
              sideContentAsideClassName="xl:col-span-1"
              sideContent={(
                <div
                  className="flex h-full min-h-0 flex-col justify-start gap-3 border-t pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                    <ResumoIntegracoesKpi
                      label="Etapas"
                      value={formatarNumero(metricasResumoIntegracoes.etapasMonitoradas)}
                    />
                    <ResumoIntegracoesKpi
                      label="Processado"
                      value={formatarNumero(metricasResumoIntegracoes.totalProcessado)}
                      color="var(--color-primary)"
                    />
                    <ResumoIntegracoesKpi
                      label="Sucessos"
                      value={formatarNumero(metricasResumoIntegracoes.totalSucesso)}
                      color="var(--color-positive-text)"
                    />
                    <ResumoIntegracoesKpi
                      label="Erros/Pend."
                      value={formatarNumero(metricasResumoIntegracoes.totalErroPendencia)}
                      color={metricasResumoIntegracoes.totalErroPendencia > 0 ? 'var(--color-negative-fill)' : 'var(--color-positive-text)'}
                    />
                    <ResumoIntegracoesKpi
                      label="Taxa Sucesso"
                      value={formatarPorcentagem(metricasResumoIntegracoes.taxaSucesso, 1)}
                      color={metricasResumoIntegracoes.taxaSucesso >= 95 ? 'var(--color-positive-text)' : 'var(--color-warning-fill)'}
                    />
                    <ResumoIntegracoesKpi
                      label="Com Erro"
                      value={formatarNumero(metricasResumoIntegracoes.etapasComErroQuantidade)}
                      color={metricasResumoIntegracoes.etapasComErroQuantidade > 0 ? 'var(--color-negative-fill)' : 'var(--color-positive-text)'}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                    <ResumoIntegracoesKpi
                      label="Maior Volume"
                      value={formatarNumero(numeroSeguro(metricasResumoIntegracoes.etapaMaiorVolume?.totalProcessado))}
                      color="var(--color-primary)"
                      detail={metricasResumoIntegracoes.etapaMaiorVolume?.entidadeTabela ?? '-'}
                      title={metricasResumoIntegracoes.etapaMaiorVolume?.entidadeTabela ?? undefined}
                    />
                    <ResumoIntegracoesKpi
                      label="Etapa Crítica"
                      value={formatarNumero(metricasResumoIntegracoes.etapaCriticaErros)}
                      color={metricasResumoIntegracoes.etapaCriticaErros > 0 ? 'var(--color-negative-fill)' : 'var(--color-positive-text)'}
                      detail={metricasResumoIntegracoes.etapaCritica?.entidadeTabela ?? '-'}
                      title={metricasResumoIntegracoes.etapaCritica?.entidadeTabela ?? undefined}
                    />
                  </div>
                </div>
              )}
            />
          </div>

          <section className="mb-6 space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--color-text)' }}>Ciclos SFTP Vedacit</h2>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  A próxima execução é estimada 30 minutos após o término de cada ciclo.
                </p>
              </div>
              {statusSftpClientes.isError && (
                <span className="text-sm text-negative">{getApiErrorMessage(statusSftpClientes.error, 'Satélite indisponível.')}</span>
              )}
            </div>

            {(statusSftpClientes.data ?? EMPTY_SFTP_CLIENTES).map((cliente) => (
              <article key={cliente.cliente} className="rounded-xl border" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
                <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1.3fr)_repeat(5,minmax(0,1fr))]">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="truncate" style={{ color: 'var(--color-text)' }}>{cliente.cliente}</strong>
                      {renderStatus(cliente.statusCiclo)}
                    </div>
                    <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Conexão {cliente.conexao} · {formatarDuracaoMs(cliente.duracaoMs)}
                    </p>
                  </div>
                  <ResumoSftpMetrica label="Última execução" value={formatarData(cliente.fimUltimoCiclo)} />
                  <ResumoSftpMetrica label="Próximo ciclo" value={formatarData(cliente.proximaExecucaoEstimada)} />
                  <ResumoSftpMetrica label="Inventário" value={`${formatarInteiro(cliente.arquivosValidos)} válidos`} detail={`${formatarInteiro(cliente.arquivosRejeitados)} rejeitados`} />
                  <ResumoSftpMetrica label="Processamento" value={`${formatarInteiro(cliente.selecionados)} selecionados`} detail={`${formatarInteiro(cliente.enviados)} enviados · ${formatarInteiro(cliente.pendentes)} pendentes`} />
                  <ResumoSftpMetrica label="Fila" value={`Saldo ${formatarInteiro(cliente.saldo)}`} detail={`${formatarInteiro(cliente.bloqueios)} bloqueios · ${formatarInteiro(cliente.timeoutsAmbiguos)} timeouts`} />
                </div>
              </article>
            ))}
            {!statusSftpClientes.isLoading && (statusSftpClientes.data?.length ?? 0) === 0 && (
              <div className="rounded-xl border border-dashed px-4 py-5 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                Nenhum ciclo SFTP auditado no momento.
              </div>
            )}

            <div className="rounded-xl border" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              <div className="flex flex-wrap items-end justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Histórico de execuções</h3>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>Use os filtros para encontrar ciclos concluídos ou com falha.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    Cliente
                    <select className="h-9 min-w-28 rounded-lg border px-2 text-sm" value={sftpCliente} onChange={(event) => { setSftpCliente(event.target.value); paginacaoSftp.setPagina(1); }} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                      <option value="">Todos</option>
                      {(statusSftpClientes.data ?? EMPTY_SFTP_CLIENTES).map((cliente) => <option key={cliente.cliente} value={cliente.cliente}>{cliente.cliente}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                    Resultado
                    <select className="h-9 min-w-28 rounded-lg border px-2 text-sm" value={sftpStatus} onChange={(event) => { setSftpStatus(event.target.value); paginacaoSftp.setPagina(1); }} style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'var(--color-surface)' }}>
                      <option value="">Todos</option>
                      <option value="CONCLUIDO">Concluído</option>
                      <option value="FALHA">Falha</option>
                    </select>
                  </label>
                </div>
              </div>

              {historicoSftpVazio ? (
                <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Nenhuma execução encontrada para o período e filtros selecionados.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-left text-sm">
                      <thead className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                        <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                          <th className="px-4 py-3 font-semibold">Cliente</th><th className="px-3 py-3 font-semibold">Finalizado</th><th className="px-3 py-3 font-semibold">Execução</th><th className="px-3 py-3 font-semibold">Inventário</th><th className="px-3 py-3 font-semibold">Processamento</th><th className="px-4 py-3 font-semibold">Fila</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ciclosSftp.map((ciclo) => (
                          <tr key={`${ciclo.cliente}:${ciclo.fimUltimoCiclo}:${ciclo.inicioUltimoCiclo}`} className="border-b last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                            <td className="px-4 py-3 font-semibold" style={{ color: 'var(--color-text)' }}>{ciclo.cliente}</td>
                            <td className="px-3 py-3 whitespace-nowrap">{formatarData(ciclo.fimUltimoCiclo)}</td>
                            <td className="px-3 py-3"><div>{renderStatus(ciclo.statusCiclo)}</div><span className="mt-1 block text-xs" style={{ color: 'var(--color-text-muted)' }}>{ciclo.conexao} · {formatarDuracaoMs(ciclo.duracaoMs)}</span></td>
                            <td className="px-3 py-3"><strong>{formatarInteiro(ciclo.arquivosValidos)}</strong><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}> válidos · {formatarInteiro(ciclo.arquivosRejeitados)} rejeitados</span></td>
                            <td className="px-3 py-3"><strong>{formatarInteiro(ciclo.selecionados)}</strong><span className="text-xs" style={{ color: 'var(--color-text-muted)' }}> selecionados · {formatarInteiro(ciclo.enviados)} enviados · {formatarInteiro(ciclo.pendentes)} pendentes</span></td>
                            <td className="px-4 py-3"><strong>Saldo {formatarInteiro(ciclo.saldo)}</strong><span className="mt-1 block text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatarInteiro(ciclo.bloqueios)} bloqueios · {formatarInteiro(ciclo.timeoutsAmbiguos)} timeouts</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>
                      {formatarNumero(execucoesSftp.data?.paginacao.totalElementos ?? 0)} execuções · {paginacaoSftp.tamanhoPagina} por página
                    </span>
                    <div className="flex items-center gap-3">
                      <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }} disabled={paginacaoSftp.pagina <= 1} onClick={() => paginacaoSftp.setPagina(paginacaoSftp.pagina - 1)}>Anterior</button>
                      <span style={{ color: 'var(--color-text-muted)' }}>Página {paginacaoSftp.pagina} de {execucoesSftp.data?.paginacao.totalPaginas}</span>
                      <button type="button" className="rounded-lg border px-3 py-1.5 disabled:opacity-50" style={{ borderColor: 'var(--color-border)' }} disabled={execucoesSftp.data?.paginacao.ultimaPagina ?? true} onClick={() => paginacaoSftp.setPagina(paginacaoSftp.pagina + 1)}>Próxima</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          <AnalyticalDataTable
            titulo={tituloTabela}
            dados={pendencias}
            colunas={colunas}
            chaveLinha="id"
            filtros={filtrosTabela.filters}
            hiddenActiveCount={filtrosTabela.hiddenActiveCount}
            hasAnyFilter={filtrosTabela.hasAnyFilter}
            onTextFilterChange={filtrosTabela.setTextFilter}
            onMultiFilterChange={filtrosTabela.setMultiFilter}
            onColumnFilterChange={filtrosTabela.setColumnFilter}
            onClearFilters={filtrosTabela.clearTableFilters}
            statusOptions={statusOptions}
            isLoading={integracoes.isLoading}
            isFetching={integracoes.isFetching}
            error={integracoes.error}
            errorFallbackMessage={`Erro ao carregar ${tituloTabela.toLowerCase()}.`}
            totalRegistros={totalRegistrosTabela}
            paginaAtual={paginacaoTabela.pagina}
            tamanhoPagina={paginacaoTabela.tamanhoPagina}
            onPaginaChange={paginacaoTabela.setPagina}
            onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina}
            sortField={tableSort?.field}
            sortDirection={tableSort?.direction}
            onSortChange={(field, direction) => setTableSort({ field, direction })}
            acoesCabecalho={(
              <>
                <SegmentedTabs
                  ariaLabel="Filtro de status dos registros de integração"
                  options={ABAS_STATUS_INTEGRACOES}
                  selected={escopoTabelaSelecionado}
                  onChange={selecionarStatusTabela}
                />
                <ExportButton
                  nomeArquivo={escopoTabelaSelecionado === 'SUCESSO' ? 'integracoes-sucesso' : 'integracoes-pendencias'}
                  onExport={() => exportarIntegracoesCsv(
                    dataInicio,
                    dataFim,
                    filtrosTabela.apiFilters,
                    tableSort?.field,
                    tableSort?.direction,
                    escopoTabelaSelecionado,
                    destinosSelecionados,
                  )}
                />
              </>
            )}
          />

          <CanhotoImagemModal
            pendencia={pendenciaCanhoto}
            onClose={fecharCanhoto}
          />
      </div>
    </div>
  );
}
