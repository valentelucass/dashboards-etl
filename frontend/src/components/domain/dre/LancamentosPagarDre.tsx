import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { lancamentosPagarDre, type FiltroDre } from '../../../api/endpoints/dreServico';
import { dinheiro } from './modeloDre';

export default function LancamentosPagarDre({filtro,linha}: {filtro: FiltroDre; linha?: string}) {
  const [acumulado, setAcumulado] = useState(false);
  const [pagina, setPagina] = useState(0);
  const consulta = useQuery({
    queryKey:['dre', 'lancamentos-pagar', filtro, linha, acumulado, pagina],
    queryFn:({signal}) => lancamentosPagarDre({...filtro, linha, acumulado, pagina}, signal),
    placeholderData:undefined,
  });
  return <div className="dre-detail">
    <div className="dre-detail-toolbar"><div className="dre-segment" aria-label="Competência dos lançamentos">
      <button type="button" aria-pressed={!acumulado} onClick={() => {setAcumulado(false); setPagina(0);}}>Mês</button>
      <button type="button" aria-pressed={acumulado} onClick={() => {setAcumulado(true); setPagina(0);}}>Acumulado do ano</button>
    </div></div>
    {consulta.isPending && <p role="status">Carregando lançamentos…</p>}
    {consulta.isError && <p role="alert">Falha ao consultar Contas a Pagar. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && (consulta.data.itens.length ? <>
      <div className="dre-scroll" tabIndex={0} aria-label="Lançamentos por competência"><table className="dre-fretes" aria-label="Lançamentos de Contas a Pagar">
        <thead><tr>{['Competência','Lançamento','Documento','Filial','Centro de custo','Conta contábil','Fornecedor','Valor do lançamento'].map(c => <th scope="col" key={c}>{c}</th>)}</tr></thead>
        <tbody>{consulta.data.itens.map(l => <tr key={l.numero+'-'+(l.ordem ?? 0)}>
          <td>{String(l.mes).padStart(2,'0')}/{l.ano}</td><td>{l.numero}</td><td>{l.documento || '—'}</td>
          <td>{l.filial}</td><td>{l.centro || '—'}</td><td>{l.conta || '—'}</td><td>{l.fornecedor || '—'}</td><td>{dinheiro(l.valor)}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="dre-pagination"><button type="button" aria-label="Página anterior" disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}><ChevronLeft size={16}/></button>
        <span>Página {pagina + 1}</span><button type="button" aria-label="Próxima página" disabled={!consulta.data.temProxima} onClick={() => setPagina(p => p + 1)}><ChevronRight size={16}/></button></div>
    </> : <p>Nenhum lançamento nesta competência para os filtros selecionados.</p>)}
  </div>;
}
