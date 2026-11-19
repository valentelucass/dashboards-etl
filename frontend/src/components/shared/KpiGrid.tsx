import { Grid } from '@astryxdesign/core/Grid';
import { useMediaQuery } from '@astryxdesign/core/hooks';
import React from 'react';
import type { ReactNode } from 'react';

interface KpiGridProps {
  children: ReactNode;
  count?: number;
  singleRowDesktop?: boolean;
  intermediateRows?: number[];
}

const SINGLE_ROW_DESKTOP_COLUMNS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-4 lg:grid-cols-5',
  6: 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  7: 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7',
  8: 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8',
  9: 'md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-9',
};

function getSingleRowDesktopColumns(count: number) {
  return SINGLE_ROW_DESKTOP_COLUMNS[count] ?? 'xl:grid-cols-6';
}

export default function KpiGrid({ children, count = 4, singleRowDesktop = false, intermediateRows }: KpiGridProps) {
  const narrow = useMediaQuery('(width < 48rem)');
  // Mobile tracks follow the available region. Desktop keeps its configured KPI rows.
  if (narrow || (!singleRowDesktop && count <= 4)) {
    return <Grid columns={{ minWidth: 152, max: count, repeat: 'fit' }} gap={3} className="mb-4">{children}</Grid>;
  }
  if (intermediateRows) {
    const cards = React.Children.toArray(children);
    return <KpiGrid count={count} singleRowDesktop={singleRowDesktop}>
      {intermediateRows.map((rowCount, rowIndex) => {
        const offset = intermediateRows.slice(0, rowIndex).reduce((total, size) => total + size, 0);
        const row = cards.slice(offset, offset + rowCount);
        const weights = row.map((card) => {
          const child = React.isValidElement<{ children?: ReactNode }>(card) ? card.props.children : null;
          const props = React.isValidElement<{ label?: string; valor?: string }>(child) ? child.props : {};
          // Reserva título + ícone e valor monetário na tipografia padrão, sem medir ou alterar o KPI.
          return Math.max(120, (props.label?.length ?? 0) * 6.5 + 48, (props.valor?.length ?? 0) * 14 + 24);
        });
        return <div key={rowIndex} className="contents lg:max-2xl:grid lg:max-2xl:w-full lg:max-2xl:col-span-full lg:max-2xl:gap-3 [&>*]:lg:max-2xl:col-span-1"
          style={{ gridTemplateColumns: weights.map((weight) => `minmax(0, ${weight}fr)`).join(' ') }}>
          {row}
        </div>;
      })}
    </KpiGrid>;
  }
  if (singleRowDesktop) {
    return (
      <div className={`mb-4 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 ${getSingleRowDesktopColumns(count)}`}>
        {children}
      </div>
    );
  }

  // count === 5: two-row layout (3 on top, 2 on bottom with last card featured)
  if (count === 5) {
    const cards = React.Children.toArray(children);
    return (
      <div className="mb-4 grid grid-cols-6 gap-3">
        {cards.map((card, i) => (
          <div key={i} className={i === 4 ? 'col-span-4' : 'col-span-2'}>
            {card}
          </div>
        ))}
      </div>
    );
  }

  return <div className="mb-4 flex flex-wrap gap-3">{children}</div>;
}
