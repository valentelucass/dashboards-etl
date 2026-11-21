import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import KpiGrid from './KpiGrid';

interface DashboardLoadingProps {
  label?: string;
  variant?: 'field' | 'section' | 'card';
  className?: string;
  detail?: boolean;
}

export default function DashboardLoading({ label = 'Carregando', variant = 'field', className = '', detail = false }: DashboardLoadingProps) {
  const content = (
    <div role={label ? 'status' : undefined} aria-hidden={label ? undefined : true}
      className={`dashboard-loading dashboard-loading--${variant} ${variant === 'card' ? '' : className}`}>
      {label && <span className="sr-only">{label}</span>}
      {variant === 'card' ? <div className="flex w-full items-center justify-between gap-2">
        <Skeleton width="55%" height={12} /><Skeleton width={14} height={14} />
      </div> : <Skeleton height={12} width={variant === 'field' ? '100%' : '62%'} />}
      {variant !== 'field' && <Skeleton height={variant === 'card' ? 22 : 12} width="85%" />}
      {(variant === 'section' || detail) && <Skeleton height={12} width="47%" />}
    </div>
  );
  return variant === 'card' ? <Card padding={3} className={`dashboard-loading-card ${className}`}>{content}</Card> : content;
}

interface LoadingKpiGridProps {
  containerClassName?: string;
  count: number;
  gridCount?: number;
  className?: string;
  singleRowDesktop?: boolean;
  intermediateRows?: number[];
  spans?: Readonly<Record<number, string>>;
  details?: readonly number[];
}

export function LoadingKpiGrid({ count, gridCount = count, containerClassName, className, spans, details, ...gridProps }: LoadingKpiGridProps) {
  const cards = Array.from({ length: count }, (_, index) => <DashboardLoading key={index} variant="card" label="" className={spans?.[index]} detail={details?.includes(index)} />);
  return (
    <div className={containerClassName} role="status" aria-label="Carregando indicadores">
      {className ? <div className={className}>{cards}</div> : <KpiGrid count={gridCount} {...gridProps}>{cards}</KpiGrid>}
    </div>
  );
}
