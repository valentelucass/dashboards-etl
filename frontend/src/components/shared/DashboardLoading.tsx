import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import KpiGrid from './KpiGrid';

interface DashboardLoadingProps {
  label?: string;
  variant?: 'field' | 'section' | 'card';
  className?: string;
}

export default function DashboardLoading({ label = 'Carregando', variant = 'field', className = '' }: DashboardLoadingProps) {
  const content = (
    <div role={label ? 'status' : undefined} aria-hidden={label ? undefined : true}
      className={`dashboard-loading dashboard-loading--${variant} ${className}`}>
      {label && <span className="sr-only">{label}</span>}
      <Skeleton height={12} width={variant === 'field' ? '100%' : '62%'} />
      {variant !== 'field' && <Skeleton height={variant === 'card' ? 22 : 12} width="85%" />}
      {variant === 'section' && <Skeleton height={12} width="47%" />}
    </div>
  );
  return variant === 'card' ? <Card padding={3} className="dashboard-loading-card">{content}</Card> : content;
}

interface LoadingKpiGridProps {
  count: number;
  className?: string;
  singleRowDesktop?: boolean;
  intermediateRows?: number[];
}

export function LoadingKpiGrid({ count, className, ...gridProps }: LoadingKpiGridProps) {
  const cards = Array.from({ length: count }, (_, index) => <DashboardLoading key={index} variant="card" label="" />);
  return (
    <div role="status" aria-label="Carregando indicadores">
      {className ? <div className={className}>{cards}</div> : <KpiGrid count={count} {...gridProps}>{cards}</KpiGrid>}
    </div>
  );
}
