import { LoadingKpiGrid } from '../../shared/DashboardLoading';
import { LoadingTableRows } from '../../shared/TableLoading';
import ChartLoading, { ChartPlaceholder } from '../../shared/ChartLoading';
import './sinistros.css';

export default function CarregamentoSinistros() {
  return (
    <div className="os-painel" role="status" aria-label="Carregando ocorrências e sinistros">
      <LoadingKpiGrid count={5} className="os-kpis os-kpis-principais" />
      <div className="os-composicao">
        <ChartPlaceholder>
          <div className="h-[194px]">
            <ChartLoading round legend={false} />
          </div>
        </ChartPlaceholder>
        <ChartPlaceholder>
          <div className="h-[210px]">
            <ChartLoading bars />
          </div>
        </ChartPlaceholder>
        <LoadingKpiGrid
          count={4}
          containerClassName="os-skeleton-lateral"
          className="os-kpis os-kpis-operacionais"
        />
      </div>
      <div className="os-graficos">
        {[0, 1].map((i) => (
          <ChartPlaceholder key={i}>
            <div className="h-[210px]">
              <ChartLoading />
            </div>
          </ChartPlaceholder>
        ))}
      </div>
      <ChartPlaceholder>
        <table className="w-full">
          <tbody>
            <LoadingTableRows columns={7} />
          </tbody>
        </table>
      </ChartPlaceholder>
    </div>
  );
}
