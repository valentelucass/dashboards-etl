import type { ComponentProps, ReactNode } from 'react';
import { TableCell as AstryxCell, TableHeaderCell as AstryxHeaderCell } from '@astryxdesign/core/Table';
import { Text } from '@astryxdesign/core/Text';

export { Table, TableBody, TableHeader, TableRow } from '@astryxdesign/core/Table';

export function TableText({ children, maxLines = 1 }: { children: ReactNode; maxLines?: number }) {
  return <Text maxLines={maxLines} color="inherit" className="dashboard-cell-text">{children}</Text>;
}

function cellContent(children: ReactNode, colSpan = 1) {
  if (colSpan === 1 && (typeof children === 'string' || typeof children === 'number')) {
    return <TableText>{children}</TableText>;
  }
  return children;
}

export function TableCell({ children, ...props }: ComponentProps<typeof AstryxCell>) {
  return <AstryxCell {...props}>{cellContent(children, props.colSpan)}</AstryxCell>;
}

export function TableHeaderCell({ children, ...props }: ComponentProps<typeof AstryxHeaderCell>) {
  return <AstryxHeaderCell {...props}>{cellContent(children)}</AstryxHeaderCell>;
}
