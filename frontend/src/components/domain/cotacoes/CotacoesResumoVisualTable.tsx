import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Coins, Loader2, Search, Trophy } from 'lucide-react';
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

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'cotacoes', label: 'Mais cotações' },
  { key: 'conversao', label: 'Maior conversão' },
  { key: 'frete', label: 'Maior frete ganho' },
];

const COLUMN_BODY_TINT = 'color-mix(in srgb, var(--color-primary) 4%, transparent)';
const COLUMN_HEADER_TINT = 'color-mix(in srgb, var(--color-primary) 7%, var(--color-bg))';
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

function getColumnBodyBackground(index: number): string | undefined {
  return index % 2 === 1 ? COLUMN_BODY_TINT : undefined;
}

function getColumnHeaderBackground(index: number): string | undefined {
  return index % 2 === 1 ? COLUMN_HEADER_TINT : undefined;
}

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

function getConversionTone(conversao: number) {
  if (conversao >= 60) {
    return {
      fill: 'var(--color-positive-fill)',
      badgeBg: 'var(--color-positive-badge-bg)',
      badgeText: 'var(--color-positive-badge-text)',
    };
  }

  if (conversao >= 35) {
    return {
      fill: 'var(--color-warning-fill)',
      badgeBg: 'var(--color-warning-badge-bg)',
      badgeText: 'var(--color-warning-badge-text)',
    };
  }

  return {
    fill: 'var(--color-negative-fill)',
    badgeBg: 'var(--color-negative-badge-bg)',
    badgeText: 'var(--color-negative-badge-text)',
  };
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
  const tone = getConversionTone(value);
  const largura = Math.max(3, Math.min(100, value));

  return (
    <div className="flex min-w-[14rem] items-center justify-end gap-3 lg:max-2xl:min-w-0 lg:max-2xl:gap-1.5">
      <div className="h-2 w-36 overflow-hidden rounded-full lg:max-2xl:min-w-0 lg:max-2xl:flex-1" style={{ backgroundColor: 'var(--color-border)' }} role="presentation">
        <div className="h-full rounded-full" style={{ width: `${largura}%`, backgroundColor: tone.fill }} />
      </div>
      <span
        className="inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
        style={{ backgroundColor: tone.badgeBg, color: tone.badgeText }}
      >
        {formatarTaxaConversao(value)}
      </span>
    </div>
  );
}

function ResumoSortButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border px-4 text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
      style={{
        backgroundColor: active ? 'var(--color-bg)' : 'var(--color-card)',
        borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
        color: active ? 'var(--color-primary)' : 'var(--color-text)',
      }}
    >
      {label}
    </button>
  );
}

function InsightsBar({ insights }: { insights: InsightConfig[] }) {
  return (
    <div
      className="rounded-xl border px-3 py-2.5"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      <div className="grid grid-cols-1 gap-2 text-xs font-semibold sm:grid-cols-2 lg:grid-cols-4">
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
              <strong className="min-w-0 flex-1 truncate font-bold" style={{ color: 'var(--color-text)' }} title={insight.value}>
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
          <div
            key={index}
            className="h-7 w-full animate-pulse rounded-lg border"
            style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
          />
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
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Atualizando...
            </div>
          )}
        </div>

        {isInitialLoading ? <LoadingInsightsBar /> : insights.length > 0 && <InsightsBar insights={insights} />}

        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <label className="relative block h-9 w-full min-w-[13rem] sm:w-64">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--color-text-muted)' }}
              aria-hidden="true"
            />
            <span className="sr-only">Filtrar entidade</span>
            <input
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
          </label>

          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {SORT_OPTIONS.map((option) => (
              <ResumoSortButton
                key={option.key}
                active={sortKey === option.key}
                label={option.label}
                onClick={() => setSortKey(option.key)}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto px-4 pb-4 sm:px-5">
        <table className="cotacoes-resumo-table w-max min-w-[max(100%,1080px)] text-sm">
          <colgroup>
            {RESUMO_COLUMNS.map((column, index) => (
              <col key={column.key} className={`cotacoes-col-${column.key}`} style={{ backgroundColor: getColumnBodyBackground(index) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="h-10 border-b" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              {RESUMO_COLUMNS.map((column, index) => (
                <th
                  key={column.key}
                  className={`h-10 whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wider ${column.align}`}
                  style={{ color: 'var(--color-text-muted)', backgroundColor: getColumnHeaderBackground(index) }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isInitialLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="inline-flex items-center justify-center gap-2 font-semibold" aria-live="polite">
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    {config.loadingMessage}
                  </span>
                </td>
              </tr>
            )}

            {!isInitialLoading && errorMessage && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm font-semibold" style={{ color: 'var(--color-negative-text)' }}>
                  {errorMessage}
                </td>
              </tr>
            )}

            {!isInitialLoading && !errorMessage && rows.map((row, index) => {
              const conversao = taxaConversao(row);

              return (
                <tr
                  key={`${row.id}-${index}`}
                  className="border-b transition-colors hover:bg-[var(--color-bg)]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <td className={`max-w-[26rem] px-3 py-3 align-middle ${RESUMO_COLUMNS[0].align}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black tabular-nums"
                        style={{
                          backgroundColor: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-primary)',
                        }}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate font-semibold" style={{ color: 'var(--color-text)' }} title={row.entidade}>
                        {row.entidade}
                      </span>
                    </div>
                  </td>
                  <td
                    className={`px-3 py-3 font-black tabular-nums ${RESUMO_COLUMNS[1].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.totalCotacoes)}
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[2].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.ganhas)}
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[3].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.emAberto)}
                  </td>
                  <td className={`px-3 py-3 ${RESUMO_COLUMNS[4].align}`}>
                    <ConversionProgress value={conversao} />
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[5].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarMoeda(row.freteCotado)}
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[6].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarMoeda(row.freteGanho)}
                  </td>
                  <td
                    className={`px-3 py-3 tabular-nums ${RESUMO_COLUMNS[7].align}`}
                    style={{ color: 'var(--color-text)' }}
                  >
                    {formatarNumero(row.volumeM3, 2)}
                  </td>
                </tr>
              );
            })}

            {!isInitialLoading && !errorMessage && rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {searchTerm ? 'Nenhum registro encontrado.' : config.emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
