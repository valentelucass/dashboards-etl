import { Spinner } from '@astryxdesign/core/Spinner';
import DashboardLoading from '../../shared/DashboardLoading';
import { Badge } from '@astryxdesign/core/Badge';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { DashboardInput } from "../../shared/DashboardTextEntry";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, TableText } from '../../shared/DashboardTable';
import DashboardSegments from '../../shared/DashboardSegments';
import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Coins, Search, Trophy } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { CotacoesResumoAgregado } from '../../../types/cotacoes';
import { formatarMoeda, formatarNumero, formatarPorcentagem } from '../../../utils/formatadores';

export type CotacoesResumoVisualView = 'usuario' | 'filial' | 'clientes';

type SortKey = 'cotacoes' | 'conversao' | 'frete';
type InsightTone = 'accent' | 'success' | 'warning' | 'danger' | 'info';
type TableAlignClass = 'text-left' | 'text-right';
type ResumoColumnKey = 'entidade' | 'total' | 'ganhas' | 'emAberto' | 'conversao' | 'freteCotado' | 'freteGanho' | 'volumeM3';

interface InsightConfig {
  label: string;
  value: string;
  tone: InsightTone;
  icon: LucideIcon;
}

interface ViewConfig {
  titlePrefix: string;
  titleHighlight: string;
  searchPlaceholder: string;
  emptyMessage: string;
  loadingMessage: string;
}

interface CotacoesResumoVisualTableProps {
  view: CotacoesResumoVisualView;
  rows: CotacoesResumoAgregado[];
  isLoading?: boolean;
  errorMessage?: string | null;
}

const VIEW_CONFIGS: Record<CotacoesResumoVisualView, ViewConfig> = {
  usuario: {
    titlePrefix: 'Performance por',
    titleHighlight: 'Usuário',
    searchPlaceholder: 'Filtrar por nome...',
    emptyMessage: 'Nenhum usuário encontrado.',
    loadingMessage: 'Carregando resumo por usuário...',
  },
  filial: {
    titlePrefix: 'Performance por',
    titleHighlight: 'Filial',
    searchPlaceholder: 'Filtrar filial...',
    emptyMessage: 'Nenhuma filial encontrada.',
    loadingMessage: 'Carregando resumo por filial...',
  },
  clientes: {
    titlePrefix: 'Top 40',
    titleHighlight: 'Clientes Pagadores',
    searchPlaceholder: 'Filtrar cliente...',
    emptyMessage: 'Nenhum cliente encontrado.',
    loadingMessage: 'Carregando resumo por cliente...',
  },
};

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: 'cotacoes', label: 'Mais cotações' },
  { value: 'conversao', label: 'Maior conversão' },
  { value: 'frete', label: 'Maior frete ganho' },
];

const RESUMO_COLUMNS: Array<{ key: ResumoColumnKey; label: string; align: TableAlignClass }> = [
  { key: 'entidade', label: 'Entidade', align: 'text-left' },
  { key: 'total', label: 'Total Cot.', align: 'text-right' },
  { key: 'ganhas', label: 'Ganhas', align: 'text-right' },
  { key: 'emAberto', label: 'Em Aberto', align: 'text-right' },
  { key: 'conversao', label: 'Conversão', align: 'text-right' },
  { key: 'freteCotado', label: 'Frete Cotado', align: 'text-right' },
  { key: 'freteGanho', label: 'Frete Ganho', align: 'text-right' },
  { key: 'volumeM3', label: 'Volume (m³)', align: 'text-right' },
];

function taxaConversao(row: CotacoesResumoAgregado): number {
  if (Number.isFinite(row.taxaConversao)) return row.taxaConversao;
  return row.totalCotacoes > 0 ? (row.ganhas / row.totalCotacoes) * 100 : 0;
}

function formatarTaxaConversao(value: number): string {
  return formatarPorcentagem(value, Number.isInteger(value) ? 0 : 1);
}

function formatarMoedaCompacta(valor: number): string {
  const absoluto = Math.abs(valor);
  if (absoluto >= 1000000) {
    return `R$ ${(valor / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  }
  if (absoluto >= 1000) {
    return `R$ ${(valor / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}k`;
  }
  return formatarMoeda(valor);
}

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function getInsightToneColor(tone: InsightTone): string {
  if (tone === 'success') return 'var(--color-positive-text)';
  if (tone === 'warning') return 'var(--color-warning-text)';
  if (tone === 'danger') return 'var(--color-negative-text)';
  return 'var(--color-primary)';
}

function escolherMaior(
  rows: CotacoesResumoAgregado[],
  score: (row: CotacoesResumoAgregado) => number,
): CotacoesResumoAgregado | null {
  return rows.reduce<CotacoesResumoAgregado | null>((best, row) => {
    if (!best) return row;
    const diff = score(row) - score(best);
    if (diff > 0) return row;
    if (diff === 0 && row.totalCotacoes > best.totalCotacoes) return row;
    return best;
  }, null);
}

function escolherMenor(
  rows: CotacoesResumoAgregado[],
  score: (row: CotacoesResumoAgregado) => number,
): CotacoesResumoAgregado | null {
  return rows.reduce<CotacoesResumoAgregado | null>((worst, row) => {
    if (!worst) return row;
    const diff = score(row) - score(worst);
    if (diff < 0) return row;
    if (diff === 0 && row.totalCotacoes > worst.totalCotacoes) return row;
    return worst;
  }, null);
}

function insightNome(row: CotacoesResumoAgregado): string {
  return row.entidade;
}

function montarInsights(rows: CotacoesResumoAgregado[]): InsightConfig[] {
  if (rows.length === 0) return [];

  const topConversor = escolherMaior(rows, taxaConversao);
  const maiorQuantidade = escolherMaior(rows, (row) => row.totalCotacoes);
  const maiorFrete = escolherMaior(rows, (row) => row.freteGanho);
  const menorConversao = escolherMenor(
    rows.filter((row) => row.totalCotacoes > 0),
    taxaConversao,
  );

  return [
    topConversor && {
      label: 'Top conversor',
      value: `${insightNome(topConversor)} - ${formatarTaxaConversao(taxaConversao(topConversor))}`,
      tone: 'success' as const,
      icon: Trophy,
    },
    maiorQuantidade && {
      label: 'Mais cotações',
      value: `${insightNome(maiorQuantidade)} - ${formatarNumero(maiorQuantidade.totalCotacoes)} cot.`,
      tone: 'info' as const,
      icon: BarChart3,
    },
    menorConversao && {
      label: 'Atenção',
      value: `${insightNome(menorConversao)} - ${formatarTaxaConversao(taxaConversao(menorConversao))}`,
      tone: 'danger' as const,
      icon: AlertTriangle,
    },
    maiorFrete && {
      label: 'Maior frete ganho',
      value: `${insightNome(maiorFrete)} - ${formatarMoedaCompacta(maiorFrete.freteGanho)}`,
      tone: 'accent' as const,
      icon: Coins,
    },
  ].filter(Boolean) as InsightConfig[];
}

function ConversionProgress({ value }: { value: number }) {
  const variant = value >= 60 ? 'success' : value >= 35 ? 'warning' : 'error';
  return (
    <div className="flex min-w-0 items-center justify-end gap-2">
      <div className="min-w-0 max-w-32 flex-1">
        <ProgressBar value={value} label="Conversão" isLabelHidden variant={variant} />
      </div>
      <Badge label={formatarTaxaConversao(value)} variant={variant} />
    </div>
  );
}

function InsightsBar({ insights }: { insights: InsightConfig[] }) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      <div className="grid grid-cols-1 gap-2 text-xs font-semibold sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,auto))]">
        {insights.map((insight) => {
          const Icon = insight.icon;
          const color = getInsightToneColor(insight.tone);

          return (
            <div
              key={`${insight.label}-${insight.value}`}
              className="flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
              style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
            >
              <Icon size={14} className="shrink-0" style={{ color }} aria-hidden="true" />
              <span className="shrink-0" style={{ color: 'var(--color-text-muted)' }}>{insight.label}:</span>
              <strong className="min-w-0 truncate font-bold" style={{ color: 'var(--color-text)' }} title={insight.value}>
                {insight.value}
              </strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadingInsightsBar() {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
      aria-hidden="true"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <DashboardLoading key={index} label="" />
        ))}
      </div>
    </div>
  );
}

function ordenarLinhas(rows: CotacoesResumoAgregado[], sortKey: SortKey): CotacoesResumoAgregado[] {
  return [...rows].sort((a, b) => {
    if (sortKey === 'conversao') return taxaConversao(b) - taxaConversao(a);
    if (sortKey === 'frete') return b.freteGanho - a.freteGanho;
    return b.totalCotacoes - a.totalCotacoes;
  });
}

export default function CotacoesResumoVisualTable({
  view,
  rows: sourceRows,
  isLoading = false,
  errorMessage = null,
}: CotacoesResumoVisualTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cotacoes');
  const config = VIEW_CONFIGS[view];
  const isInitialLoading = isLoading && sourceRows.length === 0;
  const insights = useMemo(() => montarInsights(sourceRows), [sourceRows]);

  const rows = useMemo(() => {
    const termo = normalizarBusca(searchTerm);
    const filtradas = termo
      ? sourceRows.filter((row) => normalizarBusca(row.entidade).includes(termo))
      : sourceRows;

    return ordenarLinhas(filtradas, sortKey);
  }, [sourceRows, searchTerm, sortKey]);

  return (
    <section
      className="overflow-hidden rounded-[20px] border shadow-sm"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-black leading-tight" style={{ color: 'var(--color-text)' }}>
              {config.titlePrefix} <span style={{ color: 'var(--color-primary)' }}>{config.titleHighlight}</span>
            </h2>
          </div>
          {isLoading && sourceRows.length > 0 && (
            <div className="inline-flex items-center gap-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }} aria-live="polite">
              <Spinner size="sm" aria-hidden="true" />
              Atualizando...
            </div>
          )}
        </div>

        {isInitialLoading ? <LoadingInsightsBar /> : insights.length > 0 && <InsightsBar insights={insights} />}

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative block h-9 w-full min-w-[13rem] sm:w-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            />
            <span className="sr-only">Filtrar entidade</span>
            <DashboardInput label="Filtrar entidade"
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={config.searchPlaceholder}
              disabled={isInitialLoading}
              className="h-full w-full rounded-lg border pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: 'var(--color-card)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
          </div>

          <DashboardSegments label="Ordenar ranking" options={SORT_OPTIONS} value={sortKey} onChange={setSortKey} />
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-4 sm:px-5">
        <Table density="compact" hasHover isStriped aria-label={config.titlePrefix + ' ' + config.titleHighlight} className="cotacoes-resumo-table text-sm">
          <colgroup>
            {RESUMO_COLUMNS.map((column) => (
              <col key={column.key} className={`cotacoes-col-${column.key}`} />
            ))}
          </colgroup>
          <TableHeader>
            <TableRow isHeaderRow className="h-10 border-b" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              {RESUMO_COLUMNS.map((column) => (
                <TableHeaderCell
                  key={column.key}
                  className={`h-10 whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wider ${column.align}`}
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {column.key === 'entidade' ? { usuario: 'Usuário', filial: 'Filial', clientes: 'Cliente' }[view] : column.label}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isInitialLoading && (
              <TableRow>
                <TableCell colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <DashboardLoading variant="section" label={config.loadingMessage} />
                </TableCell>
              </TableRow>
            )}

            {!isInitialLoading && errorMessage && (
              <TableRow>
                <TableCell colSpan={8} className="px-3 py-8 text-center text-sm font-semibold" style={{ color: 'var(--color-negative-text)' }}>
                  {errorMessage}
                </TableCell>
              </TableRow>
            )}

            {!isInitialLoading && !errorMessage && rows.map((row, index) => {
              const conversao = taxaConversao(row);

              return (
                <TableRow
                  key={`${row.id}-${index}`}
                  className="border-b transition-colors hover:bg-[var(--color-bg)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <TableCell className={`px-3 py-3 align-middle ${RESUMO_COLUMNS[0].align}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge label={index + 1} variant="neutral" />
                      <span className="min-w-0 font-semibold" style={{ color: 'var(--color-text)' }}>
                        <TableText>{row.entidade}</TableText>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 font-black tabular-nums ${RESUMO_COLUMNS[1].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.totalCotacoes)}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[2].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.ganhas)}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[3].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.emAberto)}
                  </TableCell>
                  <TableCell className={`px-3 py-3 ${RESUMO_COLUMNS[4].align}`}>
                    <ConversionProgress value={conversao} />
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[5].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarMoeda(row.freteCotado)}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[6].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarMoeda(row.freteGanho)}
                  </TableCell>
                  <TableCell
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[7].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.volumeM3, 2)}
                  </TableCell>
                </TableRow>
              );
            })}

            {!isInitialLoading && !errorMessage && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {searchTerm ? 'Nenhum registro encontrado.' : config.emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
