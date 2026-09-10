import { escapeHtml } from '../utils/escapeHtml';
import { useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import ChartWrapper from '../components/charts/ChartWrapper';
import { useEchartsTheme } from '../components/charts/useEchartsTheme';
import EtlSaudeKpiGrid from '../components/domain/etlSaude/EtlSaudeKpiGrid';
import DataTable, { type ColunaTabela } from '../components/shared/DataTable';
import DateRangePicker from '../components/shared/DateRangePicker';
import { DATE_RANGE_PRESETS } from '../components/shared/dateRangePresets';
import ExportButton from '../components/shared/ExportButton';
import FilterBar from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import TableHeaderTooltip from '../components/shared/TableHeaderTooltip';
import MensagemErro from '../components/ui/MensagemErro';
import { exportarEtlSaudeCsv } from '../api/endpoints/etlSaudeServico';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import {
  useEtlSaudeEvolucaoInsercoesAtualizacoes,
  useEtlSaudeOverview,
  useEtlSaudeTabela,
  useEtlSaudeTabelasResumo,
  useEtlSaudeTaxasDiarias,
} from '../hooks/queries/useEtlSaude';
import { normalizarPeriodo } from '../utils/dateUtils';
import { buildBaseBarOption, buildBaseLineOption, getEchartsThemeTokens } from '../utils/echartsBuilders';
import { formatarData, formatarDataHora, formatarNumero, formatarPorcentagem } from '../utils/formatadores';
import type { EtlLogExtracaoAuditoriaRow } from '../types/etlSaude';

type TooltipParam = {
  axisValue?: string | number;
  axisValueLabel?: string;
  dataIndex?: number;
  marker?: string;
  seriesName?: string;
  value?: number | string | Array<number | string | null> | null;
};

const EXTRACAO_HISTORICA_TOOLTIP = 'Refere-se ao primeiro/último registro contido na base histórica do período filtrado, não ao momento da execução do ETL.';

function formatarInteiro(valor: unknown) {
  return typeof valor === 'number' && Number.isFinite(valor) ? formatarNumero(valor) : '—';
}

function numeroFinito(valor: unknown): number | null {
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function numeroSeguro(valor: unknown): number {
  return numeroFinito(valor) ?? 0;
}

function textoMensagemAuditoria(valor: unknown): string {
  return typeof valor === 'string' && valor.trim() ? valor.replace(/\s+/g, ' ').trim() : '—';
}

function normalizarTooltipParams(params: unknown): TooltipParam[] {
  return Array.isArray(params) ? params as TooltipParam[] : [params as TooltipParam];
}

function valorTooltip(param: TooltipParam): number {
  const valor = Array.isArray(param.value) ? param.value[param.value.length - 1] : param.value;
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

function formatarTooltipNumero(params: unknown) {
  const itens = normalizarTooltipParams(params);
  const titulo = itens[0]?.axisValueLabel ?? itens[0]?.axisValue ?? '';
  const linhas = itens.map((item) => {
    const nomeSerie = item.seriesName ?? '';
    const valor = valorTooltip(item);

    return `${item.marker ?? ''}${escapeHtml(nomeSerie)}: ${formatarNumero(valor)}`;
  });

  return [escapeHtml(titulo), ...linhas].filter(Boolean).join('<br/>');
}

function formatarIntervaloExtracao(inicio: string | null, fim: string | null) {
  if (!inicio || !fim) return '—';

  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);

  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
    return '—';
  }

  const diferencaMinutos = Math.max(0, Math.round((dataFim.getTime() - dataInicio.getTime()) / 60000));
  const dias = Math.floor(diferencaMinutos / 1440);
  const horas = Math.floor((diferencaMinutos % 1440) / 60);
  const minutos = diferencaMinutos % 60;

  if (dias > 0) {
    return `${dias}d ${horas}h`;
  }

  if (horas > 0) {
    return `${horas}h ${minutos}min`;
  }

  return `${minutos}min`;
}

function ResumoKpi({
  label,
  value,
  color = 'var(--color-text)',
  detail,
  title,
  tooltip,
}: {
  label: string;
  value: ReactNode;
  color?: string;
  detail?: ReactNode;
  title?: string;
  tooltip?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1">
        <p className="truncate text-xs font-semibold uppercase" style={{ color: 'var(--color-text-muted)' }}>
          {label}
        </p>
        {tooltip ? <TableHeaderTooltip label={label} content={tooltip} /> : null}
      </div>
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

export default function EtlSaudePage() {
  const { dataInicio, dataFim, setDataInicio, setDataFim, setDataRange, limparFiltros } = useFiltro();
  const { isDark } = useEchartsTheme();
  const filtro = { dataInicio, dataFim };

  useEffect(() => {
    const preset180d = DATE_RANGE_PRESETS.find((preset) => preset.label === '180d');
    if (!preset180d) return;

    const range = preset180d.getRange();
    const periodo = normalizarPeriodo(range.dataInicio, range.dataFim);
    setDataRange(periodo.dataInicio, periodo.dataFim);
    // Esta excecao de periodo inicial deve rodar somente na montagem da pagina.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overview = useEtlSaudeOverview(filtro);
  const taxasDiariasQuery = useEtlSaudeTaxasDiarias(filtro);
  const evolucao = useEtlSaudeEvolucaoInsercoesAtualizacoes(filtro);
  const tabelasResumo = useEtlSaudeTabelasResumo(filtro);
  const tabela = useEtlSaudeTabela(filtro);

  usePageHeader({
    title: 'Saúde do ETL',
    description: 'Volumetria diária de sucessos/falhas, inserções, atualizações e auditoria crua das extrações.',
    updatedAt: overview.data?.updatedAt ?? null,
  });

  const taxasDiarias = useMemo(
    () => [...(taxasDiariasQuery.data ?? [])].sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia)),
    [taxasDiariasQuery.data],
  );
  const erroTaxasDiarias = taxasDiariasQuery.isError ? getApiErrorMessage(taxasDiariasQuery.error, 'Erro ao carregar sucessos e falhas do ETL.') : null;
  const evolucaoDados = useMemo(() => evolucao.data ?? [], [evolucao.data]);
  const erroEvolucao = evolucao.isError ? getApiErrorMessage(evolucao.error, 'Erro ao carregar evolução do ETL.') : null;
  const resumoTabelasDados = useMemo(
    () => [...(tabelasResumo.data ?? [])].sort((a, b) => {
      const diferencaRegistros = numeroSeguro(a.totalRegistrosGravados) - numeroSeguro(b.totalRegistrosGravados);
      if (diferencaRegistros !== 0) return diferencaRegistros;

      const diferencaExtracoes = numeroSeguro(a.qtdExtracoes) - numeroSeguro(b.qtdExtracoes);
      if (diferencaExtracoes !== 0) return diferencaExtracoes;

      return a.tabelaAlvo.localeCompare(b.tabelaAlvo);
    }),
    [tabelasResumo.data],
  );
  const erroResumoTabelas = tabelasResumo.isError ? getApiErrorMessage(tabelasResumo.error, 'Erro ao carregar resumo por tabela alvo do ETL.') : null;
  const auditoriaDados = tabela.data ?? [];
  const metricasTaxasDiarias = useMemo(() => {
    const totais = taxasDiarias.reduce(
      (acc, item) => {
        acc.sucessos += Math.max(item.qtdSucesso, 0);
        acc.falhas += Math.max(item.qtdFalha, 0);
        return acc;
      },
      { sucessos: 0, falhas: 0 },
    );
    const totalExecucoes = totais.sucessos + totais.falhas;

    return {
      totalExecucoes,
      totalSucessos: totais.sucessos,
      totalFalhas: totais.falhas,
      taxaSucessoGeral: totalExecucoes > 0 ? (totais.sucessos * 100) / totalExecucoes : 0,
    };
  }, [taxasDiarias]);
  const metricasResumoTabelas = useMemo(() => {
    const totais = resumoTabelasDados.reduce(
      (acc, item) => {
        const qtdExtracoes = numeroSeguro(item.qtdExtracoes);
        const qtdSucessos = numeroFinito(item.qtdSucessos);
        const qtdFalhas = numeroFinito(item.qtdFalhas);

        acc.qtdExtracoes += qtdExtracoes;
        acc.qtdSucessos += qtdSucessos ?? (qtdFalhas !== null ? Math.max(qtdExtracoes - qtdFalhas, 0) : 0);
        acc.qtdFalhas += qtdFalhas ?? 0;
        acc.totalRegistrosGravados += numeroSeguro(item.totalRegistrosGravados);
        acc.temDetalheStatus = acc.temDetalheStatus || qtdSucessos !== null || qtdFalhas !== null;

        if (item.primeiraExtracao && (!acc.primeiraExtracao || item.primeiraExtracao < acc.primeiraExtracao)) {
          acc.primeiraExtracao = item.primeiraExtracao;
        }

        if (item.ultimaExtracao && (!acc.ultimaExtracao || item.ultimaExtracao > acc.ultimaExtracao)) {
          acc.ultimaExtracao = item.ultimaExtracao;
        }

        if (item.menorDataNegocio && (!acc.menorDataNegocio || item.menorDataNegocio < acc.menorDataNegocio)) {
          acc.menorDataNegocio = item.menorDataNegocio;
        }

        if (item.maiorDataNegocio && (!acc.maiorDataNegocio || item.maiorDataNegocio > acc.maiorDataNegocio)) {
          acc.maiorDataNegocio = item.maiorDataNegocio;
        }

        return acc;
      },
      {
        qtdExtracoes: 0,
        qtdSucessos: 0,
        qtdFalhas: 0,
        totalRegistrosGravados: 0,
        primeiraExtracao: null as string | null,
        ultimaExtracao: null as string | null,
        menorDataNegocio: null as string | null,
        maiorDataNegocio: null as string | null,
        temDetalheStatus: false,
      },
    );
    const tabelaMaiorVolume = resumoTabelasDados.length > 0 ? resumoTabelasDados[resumoTabelasDados.length - 1] : null;
    const tabelasComFalha = totais.temDetalheStatus
      ? resumoTabelasDados.filter((item) => numeroSeguro(item.qtdFalhas) > 0)
      : [];
    const nomesTabelasComFalha = tabelasComFalha.map((item) => item.tabelaAlvo);
    const qtdSucessos = totais.temDetalheStatus ? totais.qtdSucessos : metricasTaxasDiarias.totalSucessos;
    const qtdFalhas = totais.temDetalheStatus ? totais.qtdFalhas : metricasTaxasDiarias.totalFalhas;

    return {
      tabelasMonitoradas: resumoTabelasDados.length,
      qtdExtracoes: totais.qtdExtracoes,
      qtdSucessos,
      qtdFalhas,
      totalRegistrosGravados: totais.totalRegistrosGravados,
      primeiraExtracao: totais.primeiraExtracao,
      ultimaExtracao: totais.ultimaExtracao,
      menorDataNegocio: totais.menorDataNegocio,
      maiorDataNegocio: totais.maiorDataNegocio,
      intervaloExtracao: formatarIntervaloExtracao(totais.primeiraExtracao, totais.ultimaExtracao),
      tabelaMaiorVolume,
      tabelasComFalha,
      tabelasComFalhaQuantidade: totais.temDetalheStatus ? tabelasComFalha.length : null,
      tabelasComFalhaTexto: !totais.temDetalheStatus
        ? 'Sem detalhe por tabela'
        : nomesTabelasComFalha.length > 0
        ? nomesTabelasComFalha.slice(0, 3).join(', ')
        : 'Nenhuma',
      tabelasComFalhaTitle: nomesTabelasComFalha.join(', '),
    };
  }, [metricasTaxasDiarias.totalFalhas, metricasTaxasDiarias.totalSucessos, resumoTabelasDados]);

  const taxasOption: EChartsOption = useMemo(() => {
    return buildBaseBarOption(isDark, {
      legend: { bottom: 0 },
      tooltip: {
        trigger: 'axis',
        formatter: formatarTooltipNumero,
      },
      grid: { top: 34, right: 36, bottom: 46, left: 42, containLabel: true },
      xAxis: { type: 'category', data: taxasDiarias.map((item) => item.dataReferencia) },
      yAxis: {
        type: 'value',
        name: 'Execuções',
      },
      series: [
        {
          name: 'Sucesso',
          type: 'bar',
          stack: 'total',
          data: taxasDiarias.map((item) => item.qtdSucesso),
          itemStyle: { color: 'var(--color-positive-fill)' },
          emphasis: { focus: 'series' },
        },
        {
          name: 'Falhas',
          type: 'bar',
          stack: 'total',
          data: taxasDiarias.map((item) => item.qtdFalha),
          itemStyle: { color: 'var(--color-negative-fill)' },
          emphasis: { focus: 'series' },
        },
      ],
    });
  }, [isDark, taxasDiarias]);

  const evolucaoOption: EChartsOption = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);

    return buildBaseLineOption(isDark, buildBaseBarOption(isDark, {
      legend: { top: 0 },
      tooltip: {
        trigger: 'axis',
        formatter: formatarTooltipNumero,
      },
      grid: { top: 54, right: 36, bottom: 46, left: 42, containLabel: true },
      xAxis: { type: 'category', data: evolucaoDados.map((item) => item.dataReferencia) },
      yAxis: { type: 'value', name: 'Registros' },
      series: [
        {
          name: 'Inserções',
          type: 'bar',
          data: evolucaoDados.map((item) => item.insercoes),
          itemStyle: { color: tokens.palette[0] },
        },
        {
          name: 'Atualizações',
          type: 'line',
          smooth: true,
          symbolSize: 7,
          data: evolucaoDados.map((item) => item.atualizacoes),
          itemStyle: { color: tokens.palette[8] },
          lineStyle: { color: tokens.palette[8], width: 2.5 },
          emphasis: { focus: 'series' },
        },
      ],
    }));
  }, [evolucaoDados, isDark]);

  const tabelasResumoOption: EChartsOption = useMemo(() => {
    const tokens = getEchartsThemeTokens(isDark);
    const categorias = resumoTabelasDados.map((item) => item.tabelaAlvo);
    const zoomEnd = resumoTabelasDados.length > 12
      ? Math.min(100, (12 / resumoTabelasDados.length) * 100)
      : 100;

    return buildBaseBarOption(isDark, {
      legend: { top: 0 },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const itens = normalizarTooltipParams(params);
          const indice = Number(itens[0]?.dataIndex ?? -1);
          const item = Number.isInteger(indice) && indice >= 0 ? resumoTabelasDados[indice] : null;
          const tabelaAlvo = item?.tabelaAlvo ?? String(itens[0]?.axisValueLabel ?? itens[0]?.axisValue ?? '');
          const linhas = [
            escapeHtml(tabelaAlvo),
            `Registros gravados: ${formatarNumero(numeroSeguro(item?.totalRegistrosGravados))}`,
            `Extrações: ${formatarNumero(numeroSeguro(item?.qtdExtracoes))}`,
            `Sucessos: ${formatarNumero(numeroSeguro(item?.qtdSucessos))}`,
            `Falhas: ${formatarNumero(numeroSeguro(item?.qtdFalhas))}`,
            `Janela: ${item?.primeiraExtracao ? formatarDataHora(item.primeiraExtracao) : '—'} x ${item?.ultimaExtracao ? formatarDataHora(item.ultimaExtracao) : '—'}`,
          ];

          return linhas.join('<br/>');
        },
      },
      grid: { top: 48, right: 28, bottom: 42, left: 8, containLabel: true },
      xAxis: { type: 'value', name: 'Registros gravados' },
      yAxis: {
        type: 'category',
        data: categorias,
        inverse: true,
        axisLabel: {
          width: 210,
          overflow: 'truncate',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-text)',
          margin: 12,
        },
      },
      dataZoom: resumoTabelasDados.length > 12 ? [
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
          name: 'Registros gravados',
          type: 'bar',
          data: resumoTabelasDados.map((item) => numeroSeguro(item.totalRegistrosGravados)),
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
  }, [isDark, resumoTabelasDados]);

  const colunas: ColunaTabela<EtlLogExtracaoAuditoriaRow>[] = [
    {
      chave: 'id',
      label: 'ID',
      fixo: true,
      largura: '96px',
      formato: formatarInteiro,
    },
    { chave: 'entidade', label: 'Entidade', largura: '180px' },
    {
      chave: 'timestampInicio',
      label: 'Início',
      largura: '180px',
      formato: (valor) => (typeof valor === 'string' ? formatarDataHora(valor) : '—'),
    },
    {
      chave: 'timestampFim',
      label: 'Fim',
      largura: '180px',
      formato: (valor) => (typeof valor === 'string' ? formatarDataHora(valor) : '—'),
    },
    {
      chave: 'statusFinal',
      label: 'Status Final',
      largura: '150px',
      formato: (valor) => <StatusBadge status={typeof valor === 'string' ? valor : 'Sem status'} />,
    },
    { chave: 'registrosExtraidos', label: 'Registros Extraídos', largura: '170px', formato: formatarInteiro },
    { chave: 'paginasProcessadas', label: 'Páginas Processadas', largura: '170px', formato: formatarInteiro },
    { chave: 'noopCount', label: 'No-op', largura: '110px', formato: formatarInteiro },
    {
      chave: 'mensagem',
      label: 'Mensagem',
      largura: '520px',
      formato: (valor) => {
        const mensagem = textoMensagemAuditoria(valor);
        const titulo = typeof valor === 'string' && valor.trim() ? valor : undefined;

        return (
          <span className="block max-w-[520px] truncate leading-relaxed" title={titulo}>
            {mensagem}
          </span>
        );
      },
    },
  ];

  return (
    <div className="w-full">
      <FilterBar onClear={limparFiltros} dataInicio={dataInicio} dataFim={dataFim}>
        <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
      </FilterBar>

      {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar indicadores do ETL.')} tipo={getTipoErro(overview.error)} />}
      {overview.data && <EtlSaudeKpiGrid overview={overview.data} />}

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartWrapper
          titulo="Sucessos/Falhas por Dia"
          chartKey="etlTaxasDiarias"
          option={taxasOption}
          isLoading={taxasDiariasQuery.isLoading}
          isEmpty={taxasDiarias.length === 0}
          erro={erroTaxasDiarias}
          altura={350}
          sideContent={(
            <div
              className="grid h-full min-h-[320px] grid-cols-2 content-center gap-x-4 gap-y-5 border-t pt-4 sm:min-h-0 sm:grid-cols-4 sm:gap-x-5 sm:gap-y-0 2xl:grid-cols-1 2xl:border-l 2xl:border-t-0 2xl:pl-5 2xl:pt-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Total de Execuções
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
                  {formatarNumero(metricasTaxasDiarias.totalExecucoes)}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Total de Sucessos
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-positive-text)' }}>
                  {formatarNumero(metricasTaxasDiarias.totalSucessos)}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Total de Falhas
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-negative-fill)' }}>
                  {formatarNumero(metricasTaxasDiarias.totalFalhas)}
                </p>
              </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Taxa de Sucesso Geral
                </p>
                <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-positive-text)' }}>
                  {formatarPorcentagem(metricasTaxasDiarias.taxaSucessoGeral, 1)}
                </p>
              </div>
            </div>
          )}
        />
        <ChartWrapper
          titulo="Evolução de Inserções e Atualizações"
          chartKey="etlInsercoesAtualizacoes"
          option={evolucaoOption}
          isLoading={evolucao.isLoading}
          isEmpty={evolucaoDados.length === 0}
          erro={erroEvolucao}
          altura={350}
        />
        <ChartWrapper
          titulo="Resumo por Tabela Alvo"
          chartKey="etlTabelasResumo"
          option={tabelasResumoOption}
          isLoading={tabelasResumo.isLoading}
          isEmpty={resumoTabelasDados.length === 0}
          erro={erroResumoTabelas}
          altura={400}
          className="lg:col-span-2"
          sideContentLayoutClassName="grid h-full min-h-0 grid-cols-1 gap-4 xl:grid-cols-3 xl:gap-6"
          sideContentChartClassName="xl:col-span-2"
          sideContentAsideClassName="xl:col-span-1"
          sideContent={(
            <div
              className="flex h-full min-h-0 flex-col justify-start gap-3 border-t pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <ResumoKpi
                  label="Dados desde"
                  value={metricasResumoTabelas.menorDataNegocio ? formatarData(metricasResumoTabelas.menorDataNegocio) : '—'}
                  title={metricasResumoTabelas.menorDataNegocio ? formatarDataHora(metricasResumoTabelas.menorDataNegocio) : undefined}
                />
                <ResumoKpi
                  label="Dados até"
                  value={metricasResumoTabelas.maiorDataNegocio ? formatarData(metricasResumoTabelas.maiorDataNegocio) : '—'}
                  title={metricasResumoTabelas.maiorDataNegocio ? formatarDataHora(metricasResumoTabelas.maiorDataNegocio) : undefined}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                <ResumoKpi label="Tabelas" value={formatarNumero(metricasResumoTabelas.tabelasMonitoradas)} />
                <ResumoKpi label="Extrações" value={formatarNumero(metricasResumoTabelas.qtdExtracoes)} />
                <ResumoKpi label="Sucessos" value={formatarNumero(metricasResumoTabelas.qtdSucessos)} color="var(--color-positive-text)" />
                <ResumoKpi label="Falhas" value={formatarNumero(metricasResumoTabelas.qtdFalhas)} color="var(--color-negative-fill)" />
                <ResumoKpi label="Registros" value={formatarNumero(metricasResumoTabelas.totalRegistrosGravados)} color="var(--color-primary)" />
                <ResumoKpi label="Intervalo" value={metricasResumoTabelas.intervaloExtracao} />
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <ResumoKpi
                  label="Primeira"
                  value={metricasResumoTabelas.primeiraExtracao ? formatarDataHora(metricasResumoTabelas.primeiraExtracao) : '—'}
                  title={metricasResumoTabelas.primeiraExtracao ? formatarDataHora(metricasResumoTabelas.primeiraExtracao) : undefined}
                  tooltip={EXTRACAO_HISTORICA_TOOLTIP}
                />
                <ResumoKpi
                  label="Última"
                  value={metricasResumoTabelas.ultimaExtracao ? formatarDataHora(metricasResumoTabelas.ultimaExtracao) : '—'}
                  title={metricasResumoTabelas.ultimaExtracao ? formatarDataHora(metricasResumoTabelas.ultimaExtracao) : undefined}
                  tooltip={EXTRACAO_HISTORICA_TOOLTIP}
                />
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t pt-4" style={{ borderColor: 'var(--color-border)' }}>
                <ResumoKpi
                  label="Maior Volume"
                  value={formatarNumero(numeroSeguro(metricasResumoTabelas.tabelaMaiorVolume?.totalRegistrosGravados))}
                  color="var(--color-primary)"
                  detail={metricasResumoTabelas.tabelaMaiorVolume?.tabelaAlvo ?? '—'}
                  title={metricasResumoTabelas.tabelaMaiorVolume?.tabelaAlvo ?? undefined}
                />
                <ResumoKpi
                  label="Tabelas com Erro"
                  value={metricasResumoTabelas.tabelasComFalhaQuantidade === null ? '—' : formatarNumero(metricasResumoTabelas.tabelasComFalhaQuantidade)}
                  color={metricasResumoTabelas.qtdFalhas > 0 ? 'var(--color-negative-fill)' : 'var(--color-positive-text)'}
                  detail={metricasResumoTabelas.tabelasComFalhaTexto}
                  title={metricasResumoTabelas.tabelasComFalhaTitle || metricasResumoTabelas.tabelasComFalhaTexto}
                />
              </div>
            </div>
          )}
        />
      </div>

      <DataTable
        titulo="Auditoria crua de extrações"
        dados={auditoriaDados}
        colunas={colunas}
        chaveLinha="id"
        isLoading={tabela.isLoading}
        error={tabela.error}
        errorFallbackMessage="Erro ao carregar auditoria crua do ETL."
        acoesCabecalho={(
          <ExportButton
            nomeArquivo="etl-saude"
            onExport={!tabela.isLoading && !tabela.error ? () => exportarEtlSaudeCsv(filtro) : undefined}
          />
        )}
      />
    </div>
  );
}
