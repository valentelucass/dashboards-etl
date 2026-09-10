import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Funnel, Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import type { ColunaTabela } from './DataTable';
import TableHeaderTooltip from './TableHeaderTooltip';
import { calcularLarguraMinimaTabela, getColumnSizingStyle } from './tableLayout';
import type { TableColumnFilterValue, TableFilterField, TableFilters } from '../../types/tableFilters';
import MensagemErro from '../ui/MensagemErro';
import { getApiErrorMessage, getTipoErro } from '../../utils/apiError';

export type ColunaTabelaAnalitica<T> = ColunaTabela<T> & {
  filtroTabela?: TableFilterField;
  filtravel?: boolean;
};

export type SortDirection = 'asc' | 'desc';

type ItemPaginacao = number | 'ellipsis-start' | 'ellipsis-end';

function formatarInteiro(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

interface AnalyticalDataTableProps<T> {
  dados: T[];
  colunas: ColunaTabelaAnalitica<T>[];
  chaveLinha: keyof T & string;
  filtros: TableFilters;
  hiddenActiveCount: number;
  hasAnyFilter: boolean;
  onTextFilterChange: (campo: Exclude<keyof TableFilters, 'status' | 'columnFilters'>, valor: string) => void;
  onMultiFilterChange: (campo: Extract<keyof TableFilters, 'status'>, valores: string[]) => void;
  onColumnFilterChange: (chaveColuna: string, valor: string | string[]) => void;
  onClearFilters: () => void;
  statusOptions?: string[];
  statusOptionsLoading?: boolean;
  isLoading?: boolean;
  isFetching?: boolean;
  titulo?: string;
  totalRegistros?: number;
  paginaAtual: number;
  tamanhoPagina: number;
  onPaginaChange: (pagina: number) => void;
  onTamanhoPaginaChange: (tamanhoPagina: number) => void;
  sortField?: keyof T & string | null;
  sortDirection?: SortDirection;
  onSortChange?: (sortField: keyof T & string, sortDirection: SortDirection) => void;
  error?: unknown;
  errorFallbackMessage?: string;
  acoesCabecalho?: ReactNode;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);

  return mobile;
}

function toggleValue(valores: string[], valor: string): string[] {
  return valores.includes(valor)
    ? valores.filter((item) => item !== valor)
    : [...valores, valor];
}

function uniqueOptions(opcoes: string[] | undefined): string[] {
  return Array.from(new Set((opcoes ?? []).filter((item) => item && item.trim().length > 0))).sort((a, b) =>
    a.localeCompare(b, 'pt-BR'),
  );
}

function TextFilter({
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  useEffect(() => {
    if (draftValue === value) {
      return undefined;
    }

    const timeout = window.setTimeout(() => onChangeRef.current(draftValue), 350);
    return () => window.clearTimeout(timeout);
  }, [draftValue, value]);

  function applyNow() {
    if (draftValue !== value) {
      onChangeRef.current(draftValue);
    }
  }

  return (
    <div className={compact ? 'relative h-8' : 'relative h-9'}>
      <Search
        size={13}
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--color-text-muted)' }}
        aria-hidden="true"
      />
      <input
        type="search"
        value={draftValue}
        onChange={(event) => setDraftValue(event.target.value)}
        onBlur={applyNow}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            applyNow();
          }
        }}
        placeholder={placeholder}
        className={`w-full rounded-lg border pl-7 pr-2 text-xs outline-none transition-colors focus:border-[var(--color-primary)] ${
          compact ? 'h-8 min-w-0' : 'h-9'
        }`}
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      />
    </div>
  );
}

function MultiSelectFilter({
  label,
  opcoes,
  selecionados,
  onChange,
  compact = false,
  isLoading = false,
}: {
  label: string;
  opcoes: string[];
  selecionados: string[];
  onChange: (valores: string[]) => void;
  compact?: boolean;
  isLoading?: boolean;
}) {
  const labelId = useId();
  const opcoesEfetivas = uniqueOptions([...opcoes, ...selecionados]);
  const temOpcoesDisponiveis = opcoesEfetivas.length > 0;
  const todasOpcoesSelecionadas = temOpcoesDisponiveis
    && opcoesEfetivas.every((opcao) => selecionados.includes(opcao));

  function selecionarTodos() {
    if (!temOpcoesDisponiveis || todasOpcoesSelecionadas) return;
    onChange(Array.from(new Set([...selecionados, ...opcoesEfetivas])));
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={labelId}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2 text-left text-xs transition-colors hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
            compact ? 'h-8 min-w-0' : 'h-9'
          }`}
          style={{
            backgroundColor: 'var(--color-bg)',
            borderColor: 'var(--color-border)',
            color: selecionados.length > 0 ? 'var(--color-text)' : 'var(--color-text-muted)',
          }}
          aria-busy={isLoading}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <Funnel size={12} aria-hidden="true" />
            <span className="truncate">{selecionados.length > 0 ? `${selecionados.length} selecionado(s)` : label}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent aria-labelledby={labelId} style={{ minWidth: 240 }}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
            {label}
          </span>
          {isLoading && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Carregando...
            </span>
          )}
          {!isLoading && selecionados.length > 0 && (
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {selecionados.length} selecionado(s)
            </span>
          )}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={selecionarTodos}
            disabled={!temOpcoesDisponiveis || todasOpcoesSelecionadas}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium
                       transition-all hover:opacity-80 active:scale-95 disabled:cursor-not-allowed
                       disabled:opacity-45 disabled:active:scale-100"
            style={{
              backgroundColor: 'rgba(33, 71, 138, 0.08)',
              borderColor: 'rgba(33, 71, 138, 0.24)',
              color: 'var(--color-primary)',
            }}
          >
            <Check size={13} aria-hidden="true" />
            <span>Selecionar todos</span>
          </button>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={selecionados.length === 0}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium
                       transition-all hover:bg-[var(--color-bg)] hover:opacity-80 active:scale-95
                       disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <X size={13} aria-hidden="true" />
            <span>Desmarcar todos</span>
          </button>
        </div>
        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {opcoesEfetivas.map((opcao) => {
            const selecionado = selecionados.includes(opcao);
            return (
              <label
                key={opcao}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-bg)]"
                style={{ color: selecionado ? 'var(--color-primary)' : 'var(--color-text)' }}
              >
                <input
                  type="checkbox"
                  checked={selecionado}
                  onChange={() => onChange(toggleValue(selecionados, opcao))}
                  className="shrink-0 cursor-pointer rounded"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span className="truncate">{opcao}</span>
              </label>
            );
          })}
          {opcoesEfetivas.length === 0 && isLoading && (
            <p className="py-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Carregando...
            </p>
          )}
          {opcoesEfetivas.length === 0 && !isLoading && (
            <p className="py-3 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Nenhuma opcao disponivel.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnFilterControl({
  chaveColuna,
  label,
  isStatus,
  filtros,
  statusOptions,
  statusOptionsLoading,
  onColumnFilterChange,
}: {
  chaveColuna: string;
  label: string;
  isStatus: boolean;
  filtros: TableFilters;
  statusOptions: string[];
  statusOptionsLoading: boolean;
  onColumnFilterChange: (chaveColuna: string, valor: string | string[]) => void;
}) {
  const valorAtual = filtros.columnFilters?.[chaveColuna];

  if (isStatus) {
    return (
      <MultiSelectFilter
        compact
        label={label}
        opcoes={statusOptions}
        selecionados={normalizarValorMulti(valorAtual)}
        onChange={(valores) => onColumnFilterChange(chaveColuna, valores)}
        isLoading={statusOptionsLoading}
      />
    );
  }

  return (
    <TextFilter
      compact
      value={normalizarValorTexto(valorAtual)}
      onChange={(valor) => onColumnFilterChange(chaveColuna, valor)}
      placeholder={label}
    />
  );
}

function normalizarValorTexto(valor: TableColumnFilterValue | undefined): string {
  if (Array.isArray(valor)) {
    return valor[0] ?? '';
  }
  return valor ?? '';
}

function normalizarValorMulti(valor: TableColumnFilterValue | undefined): string[] {
  if (Array.isArray(valor)) {
    return valor;
  }
  return valor ? [valor] : [];
}

function deveRenderizarFiltroColuna<T>(coluna: ColunaTabelaAnalitica<T>): boolean {
  return coluna.filtravel !== false;
}

function AdvancedFiltersContent({
  campos,
  filtros,
  statusOptions,
  statusOptionsLoading,
  onTextFilterChange,
  onMultiFilterChange,
}: {
  campos: TableFilterField[];
  filtros: TableFilters;
  statusOptions: string[];
  statusOptionsLoading: boolean;
  onTextFilterChange: (campo: Exclude<keyof TableFilters, 'status' | 'columnFilters'>, valor: string) => void;
  onMultiFilterChange: (campo: Extract<keyof TableFilters, 'status'>, valores: string[]) => void;
}) {
  return (
    <div className="grid gap-3">
      {campos.includes('codigo') && (
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Codigo
          <TextFilter value={filtros.codigo ?? ''} onChange={(valor) => onTextFilterChange('codigo', valor)} placeholder="Codigo" />
        </label>
      )}
      {campos.includes('placa') && (
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Placa
          <TextFilter value={filtros.placa ?? ''} onChange={(valor) => onTextFilterChange('placa', valor)} placeholder="Placa" />
        </label>
      )}
      {campos.includes('status') && (
        <div className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Status
          <MultiSelectFilter
            label="Status"
            opcoes={statusOptions}
            selecionados={filtros.status ?? []}
            onChange={(valores) => onMultiFilterChange('status', valores)}
            isLoading={statusOptionsLoading}
          />
        </div>
      )}
      {campos.includes('razaoSocial') && (
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Razao Social
          <TextFilter
            value={filtros.razaoSocial ?? ''}
            onChange={(valor) => onTextFilterChange('razaoSocial', valor)}
            placeholder="Razao social"
          />
        </label>
      )}
      {campos.includes('origem') && (
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Origem
          <TextFilter value={filtros.origem ?? ''} onChange={(valor) => onTextFilterChange('origem', valor)} placeholder="Origem" />
        </label>
      )}
      {campos.includes('destino') && (
        <label className="grid gap-1 text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Destino
          <TextFilter value={filtros.destino ?? ''} onChange={(valor) => onTextFilterChange('destino', valor)} placeholder="Destino" />
        </label>
      )}
    </div>
  );
}

function AdvancedFiltersButton<T>({
  colunas,
  filtros,
  hiddenActiveCount,
  statusOptions,
  statusOptionsLoading,
  onTextFilterChange,
  onMultiFilterChange,
}: Pick<
  AnalyticalDataTableProps<T>,
  'colunas' | 'filtros' | 'hiddenActiveCount' | 'statusOptions' | 'statusOptionsLoading' | 'onTextFilterChange' | 'onMultiFilterChange'
>) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const campos = useMemo(
    () => Array.from(new Set(colunas.map((coluna) => coluna.filtroTabela).filter(Boolean))) as TableFilterField[],
    [colunas],
  );
  const statusOptionsEfetivas = statusOptions ?? [];

  const content = (
    <AdvancedFiltersContent
      campos={campos}
      filtros={filtros}
      statusOptions={statusOptionsEfetivas}
      statusOptionsLoading={Boolean(statusOptionsLoading)}
      onTextFilterChange={onTextFilterChange}
      onMultiFilterChange={onMultiFilterChange}
    />
  );

  const renderButton = (withManualToggle: boolean) => (
    <button
      type="button"
      onClick={withManualToggle ? () => setOpen((atual) => !atual) : undefined}
      className="relative inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      style={{
        backgroundColor: 'var(--color-bg)',
        borderColor: open ? 'var(--color-primary)' : 'var(--color-border)',
        color: 'var(--color-text)',
      }}
      aria-expanded={open}
    >
      <SlidersHorizontal size={14} aria-hidden="true" />
      Filtros
      {hiddenActiveCount > 0 && (
        <span
          className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
          style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
          aria-label={`${hiddenActiveCount} filtros ativos`}
        >
          {hiddenActiveCount}
        </span>
      )}
    </button>
  );

  if (isMobile) {
    return (
      <>
        {renderButton(true)}
        {typeof document !== 'undefined'
          ? createPortal(
              open ? (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Filtros da tabela"
                    className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[24px] border-t p-5 shadow-2xl"
                    style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        Filtros da tabela
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="rounded-full p-1.5 transition-colors hover:bg-[var(--color-bg)]"
                        style={{ color: 'var(--color-text-muted)' }}
                        aria-label="Fechar filtros"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="max-h-[70vh] overflow-y-auto pb-2">{content}</div>
                  </div>
                </>
              ) : null,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{renderButton(false)}</PopoverTrigger>
      <PopoverContent align="end" style={{ width: 340, minWidth: 340 }}>
        {content}
      </PopoverContent>
    </Popover>
  );
}

function buildPaginationItems(paginaSegura: number, totalPaginas: number): ItemPaginacao[] {
  if (totalPaginas <= 7) {
    return Array.from({ length: totalPaginas }, (_, index) => index + 1);
  }

  if (paginaSegura <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPaginas];
  }

  if (paginaSegura >= totalPaginas - 3) {
    return [1, 'ellipsis-start', totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
  }

  return [1, 'ellipsis-start', paginaSegura - 2, paginaSegura - 1, paginaSegura, paginaSegura + 1, paginaSegura + 2, 'ellipsis-end', totalPaginas];
}

export default function AnalyticalDataTable<T>({
  dados,
  colunas,
  chaveLinha,
  filtros,
  hiddenActiveCount,
  hasAnyFilter,
  onTextFilterChange,
  onMultiFilterChange,
  onColumnFilterChange,
  onClearFilters,
  statusOptions,
  statusOptionsLoading,
  isLoading,
  isFetching,
  titulo,
  totalRegistros,
  paginaAtual,
  tamanhoPagina,
  onPaginaChange,
  onTamanhoPaginaChange,
  sortField,
  sortDirection = 'asc',
  onSortChange,
  error,
  errorFallbackMessage = 'Erro ao carregar tabela analítica.',
  acoesCabecalho,
}: AnalyticalDataTableProps<T>) {
  const hasError = Boolean(error);
  const isUpdating = Boolean(isFetching && !isLoading);
  const totalReal = totalRegistros ?? dados.length;
  const totalPaginas = Math.max(1, Math.ceil(totalReal / tamanhoPagina));
  const paginaSegura = Math.min(paginaAtual, totalPaginas);
  const inicio = (paginaSegura - 1) * tamanhoPagina;
  const fimExibido = Math.min(inicio + dados.length, totalReal);
  const resumoRegistros = hasError
    ? 'Falha ao carregar registros'
    : `${formatarInteiro(totalReal)} registros encontrados`;
  const statusOptionsEfetivas = statusOptions ?? [];
  const larguraMinimaTabela = calcularLarguraMinimaTabela(colunas);

  const itensPaginacao = useMemo(() => buildPaginationItems(paginaSegura, totalPaginas), [paginaSegura, totalPaginas]);

  function alterarTamanhoPagina(proximoTamanho: number) {
    const primeiroRegistroAtual = dados.length === 0 ? 1 : inicio + 1;
    const totalPaginasNovo = Math.max(1, Math.ceil(totalReal / proximoTamanho));
    const proximaPagina = Math.min(totalPaginasNovo, Math.max(1, Math.ceil(primeiroRegistroAtual / proximoTamanho)));
    onTamanhoPaginaChange(proximoTamanho);
    onPaginaChange(proximaPagina);
  }

  function handleSort(chave: string, ordenavel = true) {
    if (!ordenavel || !onSortChange) {
      return;
    }

    const proximaDirecao = sortField === chave && sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(chave as keyof T & string, proximaDirecao);
    onPaginaChange(1);
  }

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-[20px] border p-8 shadow-sm"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      >
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-t-transparent"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-[20px] border shadow-sm"
      data-dashboard-table="true"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      aria-busy={isUpdating}
    >
      <div
        className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {titulo ?? 'Tabela analitica'}
          </h3>
          <p className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>{resumoRegistros}</span>
            {isUpdating && (
              <span className="inline-flex items-center gap-1 font-medium" role="status">
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                Atualizando...
              </span>
            )}
          </p>
        </div>

        <div role="group" aria-label={`Controles de ${titulo ?? 'tabela'}`} className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          <div className="min-w-0 basis-full sm:min-w-[180px] sm:flex-1">
            <TextFilter
              value={filtros.busca ?? ''}
              onChange={(valor) => onTextFilterChange('busca', valor)}
              placeholder="Buscar na tabela..."
            />
          </div>
          <AdvancedFiltersButton
            colunas={colunas}
            filtros={filtros}
            hiddenActiveCount={hiddenActiveCount}
            statusOptions={statusOptionsEfetivas}
            statusOptionsLoading={statusOptionsLoading}
            onTextFilterChange={onTextFilterChange}
            onMultiFilterChange={onMultiFilterChange}
          />
          <button
            type="button"
            onClick={onClearFilters}
            disabled={!hasAnyFilter}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{
              backgroundColor: 'var(--color-bg)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            Limpar
          </button>
          {acoesCabecalho}
          <label className="flex shrink-0 items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Linhas
            <select
              value={tamanhoPagina}
              onChange={(event) => alterarTamanhoPagina(Number(event.target.value))}
              disabled={isUpdating}
              className="h-9 rounded-lg border px-2 py-1 text-xs"
              style={{
                backgroundColor: 'var(--color-bg)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              {[10, 20, 50, 100].map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-max text-sm" style={{ minWidth: `max(100%, ${larguraMinimaTabela}px)` }}>
          <thead>
            <tr className="h-10 border-b" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              {colunas.map((col) => {
                const colunaOrdenavel = Boolean(onSortChange) && col.ordenavel !== false;
                return (
                  <th
                    key={col.chave}
                    onClick={() => handleSort(col.chave, colunaOrdenavel)}
                    className={`h-10 px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap select-none ${
                      colunaOrdenavel ? 'cursor-pointer' : 'cursor-default'
                    } ${col.fixo ? 'sticky left-0 z-10' : ''}`}
                    style={{
                      color: 'var(--color-text-muted)',
                      backgroundColor: col.fixo ? 'var(--color-bg)' : undefined,
                      ...getColumnSizingStyle(col.largura),
                    }}
                  >
                    <span className="flex items-center gap-1">
                      <span>{col.label}</span>
                      {col.tooltip ? <TableHeaderTooltip label={col.label} content={col.tooltip} /> : null}
                      {colunaOrdenavel && sortField === col.chave && (
                        <span className="shrink-0">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
            <tr className="h-12 border-b" style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
              {colunas.map((col) => (
                <th
                  key={`${col.chave}-filter`}
                  className={`h-12 px-3 py-2 align-top ${col.fixo ? 'sticky left-0 z-10' : ''}`}
                  style={{
                    backgroundColor: col.fixo ? 'var(--color-card)' : undefined,
                    ...getColumnSizingStyle(col.largura),
                  }}
                >
                  {deveRenderizarFiltroColuna(col) ? (
                    <ColumnFilterControl
                      chaveColuna={col.chave}
                      label={col.label}
                      isStatus={col.filtroTabela === 'status'}
                      filtros={filtros}
                      statusOptions={statusOptionsEfetivas}
                      statusOptionsLoading={Boolean(statusOptionsLoading)}
                      onColumnFilterChange={onColumnFilterChange}
                    />
                  ) : (
                    <span className="block h-8" aria-hidden="true" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasError ? (
              <tr>
                <td colSpan={colunas.length} className="px-3 py-6">
                  <MensagemErro mensagem={getApiErrorMessage(error, errorFallbackMessage)} tipo={getTipoErro(error)} />
                </td>
              </tr>
            ) : dados.length === 0 ? (
              <tr>
                <td
                  colSpan={colunas.length}
                  className="px-3 py-8 text-center"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              dados.map((row, index) => (
                <tr
                  key={`${String(row[chaveLinha])}-${index}`}
                  className="border-b transition-colors"
                  style={{ borderColor: 'var(--color-border)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
                >
                  {colunas.map((col) => {
                    const valor = row[col.chave];
                    const conteudo = col.formato ? col.formato(valor, row) : String(valor ?? '—');

                    return (
                      <td
                        key={col.chave}
                        className={`px-3 py-2 align-middle whitespace-nowrap ${
                          col.fixo ? 'sticky left-0' : ''
                        }`}
                        style={{
                          color: 'var(--color-text)',
                          backgroundColor: col.fixo ? 'var(--color-card)' : undefined,
                          fontWeight: col.fixo ? 500 : undefined,
                          ...getColumnSizingStyle(col.largura),
                        }}
                      >
                        {conteudo}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!hasError && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <span>
            Mostrando {formatarInteiro(dados.length === 0 ? 0 : inicio + 1)} a {formatarInteiro(fimExibido)} de {formatarInteiro(totalReal)}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onPaginaChange(Math.max(1, paginaSegura - 1))}
              disabled={isUpdating || paginaSegura === 1}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Anterior
            </button>
            <div className="flex flex-wrap items-center justify-center gap-1" aria-label="Paginas da tabela">
              {itensPaginacao.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      className="px-1.5 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-hidden="true"
                    >
                      ...
                    </span>
                  );
                }

                const ativo = item === paginaSegura;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => onPaginaChange(item)}
                    disabled={isUpdating}
                    aria-current={ativo ? 'page' : undefined}
                    className="min-w-8 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
                    style={
                      ativo
                        ? {
                            backgroundColor: 'var(--color-primary)',
                            borderColor: 'var(--color-primary)',
                            color: 'white',
                          }
                        : {
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }
                    }
                  >
                    {item}
                  </button>
                );
              })}
            </div>
            <span className="min-w-[92px] text-center">
              Pagina {paginaSegura} de {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => onPaginaChange(Math.min(totalPaginas, paginaSegura + 1))}
              disabled={isUpdating || paginaSegura === totalPaginas}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Proxima
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
