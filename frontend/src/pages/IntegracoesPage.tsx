import IndicadoresIntegracoesPanel from '../components/domain/integracoes/IndicadoresIntegracoesPanel';
import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AnalyticalDataTable, {
  type ColunaTabelaAnalitica,
  type SortDirection,
} from '../components/shared/AnalyticalDataTable';
import ExportButton from '../components/shared/ExportButton';
import CiclosIntegracaoPanel from '../components/domain/integracoes/CiclosIntegracaoPanel';
import DateRangePicker from '../components/shared/DateRangePicker';
import FilterBar from '../components/shared/FilterBar';
import StatusBadge from '../components/shared/StatusBadge';
import MensagemErro from '../components/ui/MensagemErro';
import {
  buscarIntegracoesAuditoria,
  exportarIntegracoesCsv,
  type IntegracoesEscopo,
  type IntegracaoMetricaConsolidada,
  type IntegracaoPendencia,
} from '../api/endpoints/integracoesServico';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import { getApiErrorMessage, getTipoErro } from '../utils/apiError';
import { formatarDataHora, formatarNumero } from '../utils/formatadores';
import {
  respostaContemDestinoForaDaSelecao,
} from '../utils/integracoesDestinoFilter';
import { OPERATIONAL_QUERY_POLLING_OPTIONS } from '../utils/pollingUtils';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

const QUERY_KEY = ['integracoes'];
const STATUS_PADRAO = ['SUCESSO', 'ERRO_DESTINO', 'PENDENTE_FOTO'];
const EMPTY_METRICAS: IntegracaoMetricaConsolidada[] = [];
const EMPTY_PENDENCIAS: IntegracaoPendencia[] = [];
const TODOS_DESTINOS_INTEGRACAO: string[] = [];
const OPCOES_DESTINO_INTEGRACAO = ['PPG', 'VEDACIT', 'SELIA'];
type IntegracoesAba = IntegracoesEscopo;

const ABAS_STATUS_INTEGRACOES: { valor: IntegracoesEscopo; label: string }[] = [
  { valor: 'PENDENCIAS', label: 'Pendências Operacionais' },
  { valor: 'SUCESSO', label: 'Integrados com Sucesso' },
];

interface IntegracoesTableSort {
  field: keyof IntegracaoPendencia & string;
  direction: SortDirection;
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

function numeroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : 0;
}

function criarColunas(): ColunaTabelaAnalitica<IntegracaoPendencia>[] {
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
    { chave: 'dataProcessamentoDados', label: 'Data XML / dados', largura: '190px', formato: formatarData },
    { chave: 'dataProcessamentoCanhoto', label: 'Data comprovante', largura: '190px', formato: formatarData },
    { chave: 'dataProcessamento', label: 'Última atualização', largura: '210px', formato: formatarData },
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
  const [abaSelecionada, setAbaSelecionada] = useState<IntegracoesAba>('PENDENCIAS');
  const [tableSort, setTableSort] = useState<IntegracoesTableSort | null>(null);
  const [destinoSelecionado, setDestinoSelecionado] = useState('');
  const { dataInicio, dataFim, setDataInicio, setDataFim, setDataRange } = useFiltro();
  const destinosSelecionados = useMemo(
    () => destinoSelecionado ? [destinoSelecionado] : TODOS_DESTINOS_INTEGRACAO,
    [destinoSelecionado],
  );
  const filtrosTabela = useAnalyticalTableFilters();
  const escopoTabelaSelecionado = abaSelecionada;
  const paginacaoTabela = useTabelaPaginadaState(`${filtrosTabela.resetKey}:${escopoTabelaSelecionado}:${dataInicio}:${dataFim}`);

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
    queryFn: ({ signal }) => buscarIntegracoesAuditoria(
      paginacaoTabela.pagina,
      paginacaoTabela.tamanhoPagina,
      dataInicio,
      dataFim,
      filtrosTabela.apiFilters,
      tableSort?.field,
      tableSort?.direction,
      escopoTabelaSelecionado,
      destinosSelecionados,
      signal,
    ),
    placeholderData: (previousData) => previousData,
    staleTime: 60 * 1000,
    retry: 1,
  });


  const colunas = useMemo(() => criarColunas(), []);

  usePageHeader({
    title: 'Integrações',
    description: 'Auditoria operacional de XML e comprovantes enviados para clientes.',
    updatedAt: integracoes.data?.geradoEm ?? null,
  });

  const sateliteIgnorouFiltroDestino = useMemo(
    () => respostaContemDestinoForaDaSelecao(
      integracoes.data?.metricasConsolidadas ?? EMPTY_METRICAS,
      destinosSelecionados,
      (metrica) => numeroSeguro(metrica.totalRegistros) > 0,
    ),
    [destinosSelecionados, integracoes.data?.metricasConsolidadas],
  );
  const pendencias = sateliteIgnorouFiltroDestino
    ? EMPTY_PENDENCIAS
    : integracoes.data?.pendencias.itens ?? EMPTY_PENDENCIAS;
  const totalRegistrosTabela = sateliteIgnorouFiltroDestino
    ? 0
    : integracoes.data?.pendencias.paginacao.totalElementos;
  const tituloTabela = escopoTabelaSelecionado === 'PENDENCIAS'
    ? 'Pendências operacionais'
    : 'Integrados com sucesso';
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
  }, []);

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

      <IndicadoresIntegracoesPanel inicio={dataInicio} fim={dataFim} destinos={destinosSelecionados} />

      <div className="contents">
          <CiclosIntegracaoPanel dataInicio={dataInicio} dataFim={dataFim} />

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

      </div>
    </div>
  );
}
