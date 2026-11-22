import { LoadingKpiGrid } from '../../shared/DashboardLoading';
import { ChartPlaceholder, StatusBarsLoading } from '../../shared/ChartLoading';
import './customer-service.css';

export default function CarregamentoConta() {
  return <div role="status" aria-label="Carregando relatório do cliente" aria-busy="true">
    <div className="cs-paineis" aria-hidden="true">
      <LoadingKpiGrid className="cs-kpis" count={6} details={[0, 1, 2, 5]} />
      <div className="cs-operacao-graficos">
        <ChartPlaceholder /><ChartPlaceholder><StatusBarsLoading count={4} /></ChartPlaceholder>
      </div>
      <div className="cs-dupla">
        <ChartPlaceholder><StatusBarsLoading count={2} /></ChartPlaceholder>
        <ChartPlaceholder><StatusBarsLoading count={3} /></ChartPlaceholder>
      </div>
      <div className="cs-dupla">
        <ChartPlaceholder><StatusBarsLoading count={2} /></ChartPlaceholder>
        <ChartPlaceholder><StatusBarsLoading count={3} /></ChartPlaceholder>
      </div>
    </div>
  </div>;
}
