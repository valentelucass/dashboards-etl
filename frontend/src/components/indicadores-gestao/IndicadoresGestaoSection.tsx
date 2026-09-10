import { useId, type ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ChartWrapper from '../charts/ChartWrapper';
import DataTable, { type ColunaTabela } from '../shared/DataTable';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from '../shared/AnalyticalDataTable';
import ExportButton from '../shared/ExportButton';
import KpiCard from '../shared/KpiCard';
import KpiGrid from '../shared/KpiGrid';
import TooltipKpi from '../shared/TooltipKpi';
import MensagemErro from '../ui/MensagemErro';
import type { ChartDictionaryKey } from '../../constants/chartDictionary';
import type { KpiDefinition } from '../../constants/kpiDictionary';
import type { TableFilters } from '../../types/tableFilters';
import { getApiErrorMessage, getTipoErro } from '../../utils/apiError';
import { getGoalToneStyle, type GoalTone } from '../../utils/indicadoresGestaoVistaUi';

interface GoalBadgeProps {
  label: string;
  tone?: GoalTone;
}

function GoalBadge({ label, tone = 'neutral' }: GoalBadgeProps) {
  const style = getGoalToneStyle(tone);

  return (
    <span
      className="inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ backgroundColor: style.badgeBg, color: style.badgeText }}
    >
      {label}
    </span>
  );
}

interface IndicadoresGestaoSectionProps<T> {
  title: string;
  description: string;
  goalLabel: string;
  goalTone?: GoalTone;
  error?: unknown;
  goalOverridesNotice?: ReactNode;
  alert?: ReactNode;
  extra?: ReactNode;
  kpis: Array<{
    definition: KpiDefinition;
    label: string;
    value: string;
    icon?: ReactNode;
    tone?: GoalTone;
    progressPct?: number | null;
  }>;
  chartTitle: string;
  chartOption: EChartsOption;
  chartKey?: ChartDictionaryKey;
  chartActions?: ReactNode;
  chartEvents?: Record<string, (params: unknown) => void>;
  chartLoading: boolean;
  chartEmpty: boolean;
  chartError?: string | null;
  exportName: string;
  onExport?: () => Promise<void> | void;
  tableTitle: string;
  tableData: T[];
  tableColumns: ColunaTabelaAnalitica<T>[];
  rowKey: keyof T & string;
  tableLoading: boolean;
  tableFetching?: boolean;
  tableError?: unknown;
  tableTotal?: number;
  tablePage?: number;
  tablePageSize?: number;
  onTablePageChange?: (pagina: number) => void;
  onTablePageSizeChange?: (tamanhoPagina: number) => void;
  tableFilters?: TableFilters;
  tableHiddenActiveCount?: number;
  tableHasAnyFilter?: boolean;
  onTableTextFilterChange?: (campo: Exclude<keyof TableFilters, 'status' | 'columnFilters'>, valor: string) => void;
  onTableMultiFilterChange?: (campo: Extract<keyof TableFilters, 'status'>, valores: string[]) => void;
  onTableColumnFilterChange?: (chaveColuna: string, valor: string | string[]) => void;
  onTableClearFilters?: () => void;
  tableStatusOptions?: string[];
  tableStatusOptionsLoading?: boolean;
  isExpanded: boolean;
  onToggleTable: () => void;
}

export default function IndicadoresGestaoSection<T>({
  title,
  description,
  goalLabel,
  goalTone = 'neutral',
  error,
  goalOverridesNotice,
  alert,
  extra,
  kpis,
  chartTitle,
  chartOption,
  chartKey,
  chartActions,
  chartEvents,
  chartLoading,
  chartEmpty,
  chartError,
  exportName,
  onExport,
  tableTitle,
  tableData,
  tableColumns,
  rowKey,
  tableLoading,
  tableFetching,
  tableError,
  tableTotal,
  tablePage,
  tablePageSize,
  onTablePageChange,
  onTablePageSizeChange,
  tableFilters,
  tableHiddenActiveCount = 0,
  tableHasAnyFilter = false,
  onTableTextFilterChange,
  onTableMultiFilterChange,
  onTableColumnFilterChange,
  onTableClearFilters,
  tableStatusOptions,
  tableStatusOptionsLoading,
  isExpanded,
  onToggleTable,
}: IndicadoresGestaoSectionProps<T>) {
  const hasTableError = Boolean(tableError);
  const tableRegionId = useId();
  const totalTabela = tableTotal ?? tableData.length;
  const resumoTabela = hasTableError
    ? 'Falha ao carregar registros'
    : tableTotal == null
    ? `${tableData.length} registros carregados`
    : `${totalTabela} registros encontrados`;

  return (
    <section
      className="mb-8 rounded-[24px] border p-5 shadow-sm"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
              {title}
            </h2>
            <GoalBadge label={goalLabel} tone={goalTone} />
          </div>
          <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>
            {description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportButton dados={tableData as unknown as Record<string, unknown>[]} nomeArquivo={exportName} onExport={onExport} />
          <button
            type="button"
            onClick={onToggleTable}
            aria-expanded={isExpanded}
            aria-controls={tableRegionId}
            className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors lg:max-2xl:hidden"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {isExpanded ? 'Ocultar tabela' : 'Mostrar tabela'}
          </button>
        </div>
      </div>

      {Boolean(error) && (
        <MensagemErro mensagem={getApiErrorMessage(error, `Erro ao carregar ${title}.`)} tipo={getTipoErro(error)} />
      )}
      {goalOverridesNotice ? <div className="mb-4">{goalOverridesNotice}</div> : null}
      {alert}
      {extra}

      <div className="mb-5">
        <KpiGrid count={4}>
          {kpis.map((kpi) => (
            <TooltipKpi key={kpi.label} definition={kpi.definition}>
              <KpiCard
                label={kpi.label}
                valor={kpi.value}
                icone={kpi.icon}
                tone={kpi.tone ?? goalTone}
                progressPct={kpi.progressPct}
              />
            </TooltipKpi>
          ))}
        </KpiGrid>
      </div>

      <div className="mb-4">
        <ChartWrapper
          titulo={chartTitle}
          option={chartOption}
          chartKey={chartKey}
          actions={chartActions}
          onEvents={chartEvents}
          isLoading={chartLoading}
          isEmpty={chartEmpty}
          erro={chartError}
          emptyMessage="Sem dados para o período selecionado."
          altura={350}
        />
      </div>

      <div
        className="overflow-hidden rounded-[20px] border"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none' }}
        >
          <div>
            <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {tableTitle}
            </div>
            <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {resumoTabela}
            </div>
          </div>
          <div className="text-xs lg:max-2xl:hidden" style={{ color: 'var(--color-text-subtle)' }}>
            {isExpanded ? 'Tabela expandida' : 'Tabela recolhida por padrão'}
          </div>
          <button type="button" onClick={onToggleTable} aria-expanded={isExpanded} aria-controls={tableRegionId}
            className="hidden items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] lg:max-2xl:inline-flex"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}>
            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            {isExpanded ? 'Ocultar tabela' : 'Mostrar tabela'}
          </button>
        </div>

        <div id={tableRegionId} hidden={!isExpanded}>
        {isExpanded ? (
          <div className="p-3">
            {tableFilters && onTableTextFilterChange && onTableMultiFilterChange && onTableColumnFilterChange && onTableClearFilters ? (
              <AnalyticalDataTable
                titulo={tableTitle}
                dados={tableData}
                colunas={tableColumns}
                chaveLinha={rowKey}
                filtros={tableFilters}
                hiddenActiveCount={tableHiddenActiveCount}
                hasAnyFilter={tableHasAnyFilter}
                onTextFilterChange={onTableTextFilterChange}
                onMultiFilterChange={onTableMultiFilterChange}
                onColumnFilterChange={onTableColumnFilterChange}
                onClearFilters={onTableClearFilters}
                statusOptions={tableStatusOptions}
                statusOptionsLoading={tableStatusOptionsLoading}
                isLoading={tableLoading}
                isFetching={tableFetching}
                error={tableError}
                errorFallbackMessage={`Erro ao carregar ${tableTitle}.`}
                totalRegistros={tableTotal}
                paginaAtual={tablePage ?? 1}
                tamanhoPagina={tablePageSize ?? 10}
                onPaginaChange={onTablePageChange ?? (() => undefined)}
                onTamanhoPaginaChange={onTablePageSizeChange ?? (() => undefined)}
              />
            ) : (
              <DataTable
                titulo={tableTitle}
                dados={tableData}
                colunas={tableColumns as ColunaTabela<T>[]}
                chaveLinha={rowKey}
                isLoading={tableLoading}
                error={tableError}
                errorFallbackMessage={`Erro ao carregar ${tableTitle}.`}
                mostrarCabecalho={false}
                totalRegistros={tableTotal}
                paginaAtual={tablePage}
                tamanhoPagina={tablePageSize}
                onPaginaChange={onTablePageChange}
                onTamanhoPaginaChange={onTablePageSizeChange}
              />
            )}
          </div>
        ) : null}
        </div>
      </div>
    </section>
  );
}
