import { Skeleton } from '@astryxdesign/core/Skeleton';
import './tracking-matriz.css';

export default function TrackingMatrixLoading({ minutas = false }: { minutas?: boolean }) {
  const Row = minutas ? 'article' : 'div';
  return <div role="status" aria-label={minutas ? 'Carregando minutas' : 'Carregando regiões'}>
    {Array.from({ length: 3 }, (_, row) => (
      <Row key={row} className="tracking-linha" aria-hidden="true">
        <div className="tracking-resumo">
          <div className={'tracking-identificador' + (minutas ? ' tracking-minuta' : '')}>
            <Skeleton width="60%" height={14} />{minutas && <Skeleton width="85%" height={10} />}
          </div>
          {Array.from({ length: 6 }, (_, col) => <div className="tracking-loading-metric" key={col}>
            <Skeleton width="58%" height={10} /><Skeleton width="38%" height={14} />
          </div>)}
        </div>
        {minutas && <div className="tracking-subnivel"><Skeleton width={96} height={16} /></div>}
      </Row>
    ))}
  </div>;
}
