import { LoadingKpiGrid } from '../../shared/DashboardLoading';
import TableLoading from '../../shared/TableLoading';
import { camposSinistros } from './camposSinistros';
import ChartLoading, { ChartPlaceholder } from '../../shared/ChartLoading';
import './sinistros.css';

export default function CarregamentoSinistros() {
  return (
    <div className="os-painel" role="status" aria-label="Carregando ocorrências e sinistros">
      <LoadingKpiGrid count={5} className="os-kpis os-kpis-principais" />
      <div className="os-composicao">
        <ChartPlaceholder>
          <div className="h-[210px]">
            <ChartLoading round legend={false} />
          </div>
        </ChartPlaceholder>
        <ChartPlaceholder>
          <div className="h-[210px]">
            <ChartLoading bars />
          </div>
        </ChartPlaceholder>
        <div className="os-lateral" aria-hidden="true">
          <h2>Tratativas e resolução</h2>
          <LoadingKpiGrid count={4} className="os-kpis os-kpis-operacionais" />
        </div>
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
      <TableLoading title="Relação de sinistros" columns={camposSinistros} pageSize={10} filters />
    </div>
  );
}
