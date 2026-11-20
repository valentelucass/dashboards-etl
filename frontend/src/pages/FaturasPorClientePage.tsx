import { LoadingKpiGrid } from '../components/shared/DashboardLoading';
import { useMemo } from 'react';
import FinanceiroGraficos from '../components/domain/faturasPorCliente/FinanceiroGraficos';
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
import { useFaturasPorClienteClientesCnpj, useFaturasPorClientePagadores, useFiliais } from '../hooks/queries/useDimensoes';
import {
  useFaturasPorClienteOverview,
  useFaturasPorClienteStatusProcesso,
  useFaturasPorClienteTabelaPaginada,
} from '../hooks/queries/useFaturasPorCliente';
import { useAnalyticalTableFilters } from '../hooks/useAnalyticalTableFilters';
import { useTabelaPaginadaState } from '../hooks/useTabelaPaginadaState';
import type { FaturaPorClienteResumoRow, FaturasPorClienteFiltro } from '../types/faturasPorCliente';
import { formatarMoeda } from '../utils/formatadores';
import { combinarStatusOptions } from '../utils/tableStatusOptions';

function FiltroPagadores({ selecionados, onChange }: { selecionados: string[]; onChange: (valores: string[]) => void }) {
  const clientes = useFaturasPorClientePagadores();
  return <AsyncMultiSelect label="Pagadores" opcoes={clientes.data ?? []} selecionados={selecionados}
    onChange={onChange} isLoading={clientes.isLoading}
    erro={clientes.isError ? getApiErrorMessage(clientes.error, 'Erro ao carregar pagadores.') : null} />;
}

function FiltroCnpjs({ selecionados, onChange }: { selecionados: string[]; onChange: (valores: string[]) => void }) {
  const clientesCnpj = useFaturasPorClienteClientesCnpj();
  return <AsyncMultiSelect label="CNPJs" opcoes={clientesCnpj.data ?? []} selecionados={selecionados}
    onChange={onChange} isLoading={clientesCnpj.isLoading}
    erro={clientesCnpj.isError ? getApiErrorMessage(clientesCnpj.error, 'Erro ao carregar CNPJs.') : null} />;
}

export default function FaturasPorClientePage() {
  const { dataInicio, dataFim, filtros, setDataInicio, setDataFim, setDataRange, setFiltro, limparFiltros } = useFiltro();
  const filiais = useFiliais();

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
  const statusProcesso = useFaturasPorClienteStatusProcesso(filtro);
  const filtrosTabela = useAnalyticalTableFilters();
  const paginacaoTabela = useTabelaPaginadaState(JSON.stringify({ filtro, tabela: filtrosTabela.resetKey }));
  const tabela = useFaturasPorClienteTabelaPaginada(filtro, paginacaoTabela.pagina, paginacaoTabela.tamanhoPagina, filtrosTabela.apiFilters);
  usePageHeader({ title: 'Financeiro e Recebíveis', description: 'Faturamento, fretes a faturar e títulos em aberto.', updatedAt: overview.data?.updatedAt ?? null });

  const statusTabelaOptions = combinarStatusOptions(['Faturado', 'Aguardando Faturamento'], (statusProcesso.data ?? []).map((item) => item.statusProcesso), (tabela.data?.conteudo ?? []).map((item) => item.statusProcesso), filtros.statusProcesso);
  const colunasResumo: ColunaTabelaAnalitica<FaturaPorClienteResumoRow>[] = [
    { chave: 'idUnico', label: 'ID Único', fixo: true, largura: '180px', filtroTabela: 'codigo' }, { chave: 'documentoFatura', label: 'Documento', largura: '140px' }, { chave: 'emissao', label: 'Emissão' }, { chave: 'vencimento', label: 'Vencimento' }, { chave: 'baixa', label: 'Baixa' }, { chave: 'filial', label: 'Filial' }, { chave: 'clientePagador', label: 'Cliente', largura: '220px', filtroTabela: 'razaoSocial' }, { chave: 'clienteCnpj', label: 'CNPJ', largura: '160px' }, { chave: 'numeroCte', label: 'CT-e' }, { chave: 'valorFaturado', label: 'Valor Faturado', formato: (valor) => formatarMoeda(Number(valor ?? 0)) }, { chave: 'statusProcesso', label: 'Status Processo', filtroTabela: 'status', formato: (valor) => <StatusBadge status={String(valor)} /> },
  ];

  return <div className="w-full">
    <FilterBar
      period={(
        <DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio} onDataFimChange={setDataFim} onRangeChange={setDataRange} />
      )}
      onClear={limparFiltros} activeFilters={activeFilters} dataInicio={dataInicio} dataFim={dataFim}>
      <FiliaisParceirosFilter opcoes={filiais.data ?? []} filiaisSelecionadas={filtros.filiais ?? []} parceirosSelecionados={filtros.parceirosLogisticos ?? []} onFiliaisChange={(valores) => setFiltro('filiais', valores)} onParceirosChange={(valores) => setFiltro('parceirosLogisticos', valores)} isLoading={filiais.isLoading} />
      <FiltroPagadores selecionados={filtros.pagadores ?? []} onChange={(valores) => setFiltro('pagadores', valores)} />
      <FiltroCnpjs selecionados={filtros.clientesCnpj ?? []} onChange={(valores) => setFiltro('clientesCnpj', valores)} />
      <AsyncMultiSelect label="Status Processo" opcoes={['Faturado', 'Aguardando Faturamento']} selecionados={filtros.statusProcesso ?? []} onChange={(valores) => setFiltro('statusProcesso', valores)} />
    </FilterBar>
    {overview.isError && <MensagemErro mensagem={getApiErrorMessage(overview.error, 'Erro ao carregar os indicadores financeiros.')} tipo={getTipoErro(overview.error)} />}
    {overview.isLoading && !overview.data && <LoadingKpiGrid count={9} />}
    {overview.data && <FaturasPorClienteKpiGrid overview={overview.data} />}
    <FinanceiroGraficos key={JSON.stringify(filtro)} filtro={filtro} />

    <AnalyticalDataTable acoesCabecalho={<ExportButton nomeArquivo="faturas-por-cliente" onExport={() => exportarFaturasPorClienteCsv(filtro, filtrosTabela.apiFilters)} />} titulo="Detalhamento dos recebíveis" dados={tabela.data?.conteudo ?? []} colunas={colunasResumo} chaveLinha="idUnico" filtros={filtrosTabela.filters} hiddenActiveCount={filtrosTabela.hiddenActiveCount} hasAnyFilter={filtrosTabela.hasAnyFilter} onTextFilterChange={filtrosTabela.setTextFilter} onMultiFilterChange={filtrosTabela.setMultiFilter} onColumnFilterChange={filtrosTabela.setColumnFilter} onClearFilters={filtrosTabela.clearTableFilters} statusOptions={statusTabelaOptions} statusOptionsLoading={statusProcesso.isLoading} isLoading={tabela.isLoading} error={tabela.error} errorFallbackMessage="Erro ao carregar o detalhamento dos recebíveis." totalRegistros={tabela.data?.totalElementos} paginaAtual={paginacaoTabela.pagina} tamanhoPagina={paginacaoTabela.tamanhoPagina} onPaginaChange={paginacaoTabela.setPagina} onTamanhoPaginaChange={paginacaoTabela.setTamanhoPagina} />
  </div>;
}
