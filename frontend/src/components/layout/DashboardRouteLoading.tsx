import { Spinner } from '@astryxdesign/core/Spinner';

export default function DashboardRouteLoading() {
  return (
    <div className="dashboard-route-loading" role="status">
      <Spinner size="xl" aria-hidden="true" />
      <span className="sr-only">Carregando</span>
    </div>
  );
}
