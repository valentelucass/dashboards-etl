import type { ReactNode } from 'react';
import DashboardLoading from '../../shared/DashboardLoading';
import './financeiro-kpis.css';

export default function FinanceiroKpiLayout({ cards }: { cards?: ReactNode[] }) {
  const items = cards ?? Array.from({ length: 9 }, (_, index) =>
    <DashboardLoading key={index} variant="card" label="" detail={index === 0 || index === 4} />);
  return <div className="financeiro-kpis mb-4" role={cards ? undefined : 'status'}
    aria-label={cards ? undefined : 'Carregando indicadores'}>
    <div className="financeiro-kpi-grid">
      <div className="financeiro-kpi-group">{items.slice(0, 5)}</div>
      <div className="financeiro-kpi-group">{items.slice(5)}</div>
    </div>
  </div>;
}
