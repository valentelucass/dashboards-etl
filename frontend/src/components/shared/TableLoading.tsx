import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { calcularLarguraMinimaTabela, getColumnSizingStyle } from './tableLayout';

interface LoadingColumn {
  chave: string;
  label: string;
  largura?: string;
}

export function LoadingTableRows({ columns, rows = 5 }: { columns: number; rows?: number }) {
  return Array.from({ length: rows }, (_, row) => <tr key={row} className="h-10 border-b border-[var(--color-border)]" aria-hidden="true">
    {Array.from({ length: columns }, (_, col) => <td key={col} className="px-3 py-2">
      <Skeleton width={row % 2 === 0 ? '62%' : '75%'} height={12} />
    </td>)}
  </tr>);
}

interface TableLoadingProps {
  title?: string;
  columns: readonly LoadingColumn[];
  pageSize: number;
  header?: boolean;
  controls?: boolean;
  filters?: boolean;
  pager?: boolean;
}

export default function TableLoading({ title, columns, pageSize, header = true, controls = true, filters = false, pager = true }: TableLoadingProps) {
  return <Card padding={0} className="dashboard-table-card overflow-hidden" role="status" aria-label={title ? 'Carregando ' + title : 'Carregando tabela'}>
    <div aria-hidden="true">
      {header && <div className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <div className="grid gap-2"><h3 className="text-sm font-semibold">{title ?? 'Tabela analítica'}</h3><Skeleton width={96} height={10} /></div>
        {controls && <div className="flex max-w-full flex-wrap items-center gap-2">
          {filters && <Skeleton width={160} height={36} />}<Skeleton width={86} height={32} /><Skeleton width={44} height={36} />
        </div>}
      </div>}
      <div className="overflow-hidden">
        <table className="w-full table-fixed text-sm" style={{ minWidth: calcularLarguraMinimaTabela(columns) }}>
          <colgroup>{columns.map(col => <col key={col.chave} style={getColumnSizingStyle(col.largura)} />)}</colgroup>
          <thead><tr className="h-10 border-b border-[var(--color-border)]">
            {columns.map(col => <th key={col.chave} className="px-3 text-start text-xs font-medium">{col.label}</th>)}
          </tr>{filters && <tr className="h-12">{columns.map(col => <td key={col.chave} className="px-3"><Skeleton height={32} width="100%" /></td>)}</tr>}</thead>
          <tbody><LoadingTableRows columns={columns.length} rows={Math.min(10, pageSize)} /></tbody>
        </table>
      </div>
      {pager && <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Skeleton height={12} width={120} /><Skeleton height={28} width={156} />
      </div>}
    </div>
  </Card>;
}
