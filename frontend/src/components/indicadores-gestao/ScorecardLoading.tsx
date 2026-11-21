import { Skeleton } from '@astryxdesign/core/Skeleton';
import './IndicadoresGestaoOverview.css';

export default function ScorecardLoading({ title }: { title?: string }) {
  return <article className="gestao-scorecard border-[var(--color-border)] bg-[var(--color-card)]" role={title ? 'status' : undefined} aria-label={title && 'Carregando ' + title}>
    <div className="gestao-scorecard-heading">{title ? <h3>{title}</h3> : <Skeleton width="60%" height={16} />}</div>
    <div className="gestao-scorecard-value"><Skeleton width={62} height={32} /></div>
    <div className="gestao-scorecard-state"><Skeleton width={75} height={20} /><Skeleton width={52} height={12} /></div>
    <div className="gestao-scorecard-detail"><Skeleton width="82%" height={14} /></div>
    <div className="gestao-scorecard-coverage"><Skeleton width="100%" height={8} /></div>
  </article>;
}
