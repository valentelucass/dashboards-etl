import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';

export default function NoticeListLoading({ compact = false }: { compact?: boolean }) {
  return <div role="status" aria-label="Carregando comunicações" className="home-fields home-notice-list">
    {[0, 1, 2].map(i => <Card key={i} padding={compact ? 2 : 3} className="home-notice-card">
      <div className="home-notice-heading"><Skeleton width="55%" height={15} /><Skeleton width={52} height={22} /></div>
      <Skeleton width="32%" height={10} /><Skeleton width="92%" height={14} />
      {!compact && <div className="home-actions"><Skeleton width={60} height={28} /><Skeleton width={76} height={28} /></div>}
    </Card>)}
  </div>;
}
