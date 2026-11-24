import { Skeleton } from '@astryxdesign/core/Skeleton';
import { LoadingKpiGrid } from '../../shared/DashboardLoading';

export default function CarregamentoDre() {
  return <div role="status" aria-label="Carregando DRE" className="flex flex-col gap-4">
    <LoadingKpiGrid count={5} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"/>
    <div className="grid gap-2 rounded-lg border p-4" style={{borderColor:'var(--color-border)'}}>
      <Skeleton width="26%" height={24}/>{Array.from({length:9}, (_, i) => <Skeleton key={i} width="100%" height={29}/>)}
    </div>
  </div>;
}
