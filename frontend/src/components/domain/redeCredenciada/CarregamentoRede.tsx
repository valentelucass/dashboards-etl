import ChartLoading, { ChartPlaceholder } from '../../shared/ChartLoading';
import { LoadingKpiGrid } from '../../shared/DashboardLoading';
import { LoadingTableRows } from '../../shared/TableLoading';
import './rede-credenciada.css';

export default function CarregamentoRede() {
  return <div role="status" aria-label="Carregando Rede Credenciada" aria-busy="true">
    <div className="rede-painel" aria-hidden="true">
      <LoadingKpiGrid className="rede-kpis" count={9} details={[0, 1, 2, 3, 4, 5, 6, 7, 8]} />
      <ChartPlaceholder><table className="w-full table-fixed"><tbody><LoadingTableRows columns={4} rows={3} /></tbody></table></ChartPlaceholder>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <ChartPlaceholder><div className="h-[350px]"><ChartLoading bars legend={false} option={{yAxis: {type: 'category'}}} /></div></ChartPlaceholder>
        <ChartPlaceholder><div className="h-[350px]"><ChartLoading bars /></div></ChartPlaceholder>
      </div>
      <ChartPlaceholder><table className="w-full table-fixed"><tbody><LoadingTableRows columns={8} /></tbody></table></ChartPlaceholder>
    </div>
  </div>;
}
