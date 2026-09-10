import type { ReactNode } from 'react';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../../shared/AnalyticalDataTable';
import StatusBadge from '../../shared/StatusBadge';
import type { PaginacaoResponse } from '../../../types/common';
import type { PerformanceTabelaRow } from '../../../types/performance';
import type { TableFilters } from '../../../types/tableFilters';
import { formatarMoeda, formatarNumero } from '../../../utils/formatadores';

interface PerformanceTabelaProps {
  acoesCabecalho?: ReactNode;
  pagina?: PaginacaoResponse<PerformanceTabelaRow>;
  filtros: TableFilters;
  hiddenActiveCount: number;
  hasAnyFilter: boolean;
  statusOptions: string[];
  statusOptionsLoading?: boolean;
  isLoading?: boolean;
  error?: unknown;
  paginaAtual: number;
  tamanhoPagina: number;
  onTextFilterChange: (campo: Exclude<keyof TableFilters, 'status' | 'columnFilters'>, valor: string) => void;
  onMultiFilterChange: (campo: Extract<keyof TableFilters, 'status'>, valores: string[]) => void;
  onColumnFilterChange: (chaveColuna: string, valor: string | string[]) => void;
  onClearFilters: () => void;
  onPaginaChange: (pagina: number) => void;
  onTamanhoPaginaChange: (tamanhoPagina: number) => void;
}

function formatarDataTabela(valor: unknown): string {
  if (typeof valor !== 'string' || !valor) {
    return '-';
  }

  const [ano, mes, dia] = valor.split('-');
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : valor;
}

function formatarDiferencaDias(valor: unknown): string {
  if (valor == null || valor === '') {
    return '-';
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? formatarNumero(numero) : '-';
}

function renderStatus(valor: unknown) {
  return valor ? <StatusBadge status={String(valor)} /> : '-';
}

const colunas: ColunaTabelaAnalitica<PerformanceTabelaRow>[] = [
  { chave: 'numeroMinuta', label: 'Minuta', fixo: true, ordenavel: false, filtroTabela: 'codigo' },
  { chave: 'status', label: 'Status', formato: renderStatus, ordenavel: false, filtroTabela: 'status' },
  { chave: 'performanceStatus', label: 'Prazo', formato: renderStatus, ordenavel: false },
  { chave: 'performanceStatusDias', label: 'Status Dias', ordenavel: false },
  { chave: 'performanceDiferencaDias', label: 'Dif. Dias', formato: formatarDiferencaDias, ordenavel: false },
  { chave: 'dataPrevisaoEntrega', label: 'Previsao', formato: formatarDataTabela, ordenavel: false },
  { chave: 'dataFinalizacao', label: 'Finalizacao', formato: formatarDataTabela, ordenavel: false },
  { chave: 'responsavelRegiaoDestino', label: 'Responsavel', largura: '220px', ordenavel: false },
  { chave: 'filialEmissora', label: 'Filial', ordenavel: false },
  { chave: 'regiaoDestino', label: 'Regiao', ordenavel: false, filtroTabela: 'destino' },
  { chave: 'cidadeDestino', label: 'Cidade', largura: '180px', ordenavel: false, filtroTabela: 'destino' },
  { chave: 'pesoTaxado', label: 'Kg Taxado', formato: (valor) => formatarNumero(Number(valor ?? 0), 2), ordenavel: false },
  { chave: 'valorNotaFiscal', label: 'Valor NF', formato: (valor) => formatarMoeda(Number(valor ?? 0)), ordenavel: false },
  { chave: 'comprovanteAnexado', label: 'Comprovante', formato: (valor) => (valor ? 'Sim' : 'Nao'), ordenavel: false },
];

export default function PerformanceTabela({
  acoesCabecalho,
  pagina,
  filtros,
  hiddenActiveCount,
  hasAnyFilter,
  statusOptions,
  statusOptionsLoading,
  isLoading,
  error,
  paginaAtual,
  tamanhoPagina,
  onTextFilterChange,
  onMultiFilterChange,
  onColumnFilterChange,
  onClearFilters,
  onPaginaChange,
  onTamanhoPaginaChange,
}: PerformanceTabelaProps) {
  return (
    <section className="mt-4">
      <AnalyticalDataTable
        acoesCabecalho={acoesCabecalho}
        titulo="Performance Analitica"
        dados={pagina?.conteudo ?? []}
        colunas={colunas}
        chaveLinha="numeroMinuta"
        filtros={filtros}
        hiddenActiveCount={hiddenActiveCount}
        hasAnyFilter={hasAnyFilter}
        onTextFilterChange={onTextFilterChange}
        onMultiFilterChange={onMultiFilterChange}
        onColumnFilterChange={onColumnFilterChange}
        onClearFilters={onClearFilters}
        statusOptions={statusOptions}
        statusOptionsLoading={statusOptionsLoading}
        isLoading={isLoading}
        error={error}
        errorFallbackMessage="Erro ao carregar tabela de performance."
        totalRegistros={pagina?.totalElementos}
        paginaAtual={paginaAtual}
        tamanhoPagina={tamanhoPagina}
        onPaginaChange={onPaginaChange}
        onTamanhoPaginaChange={onTamanhoPaginaChange}
      />
    </section>
  );
}
