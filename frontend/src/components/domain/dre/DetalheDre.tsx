import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { fretesDre, type FiltroDre } from '../../../api/endpoints/dreServico';
import { formatarData, formatarMoeda } from '../../../utils/formatadores';
import { origemConta, type ContaDre } from './contasDre';

interface Props {
  conta: ContaDre; filtro: FiltroDre; mesDisponivel: boolean; anoDisponivel: boolean; fechar: () => void;
}

function Lancamentos({conta, filtro, anoDisponivel}: Pick<Props, 'conta' | 'filtro' | 'anoDisponivel'>) {
  const [acumulado, setAcumulado] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [classe, tipo] = conta.id === 'D6' ? [] : conta.id.split('.');
  const consulta = useQuery({
    queryKey: ['dre', 'fretes', filtro, conta.id, acumulado, pagina],
    queryFn: ({signal}) => fretesDre({...filtro, classe, tipo, acumulado, pagina}, signal),
    placeholderData: undefined,
  });
  return <>
    <div className="dre-detail-toolbar">
      <div className="dre-segment" aria-label="Período dos lançamentos">
        <button type="button" aria-pressed={!acumulado} onClick={() => {setAcumulado(false); setPagina(0);}}>Mês</button>
        <button type="button" aria-pressed={acumulado} disabled={!anoDisponivel} onClick={() => {setAcumulado(true); setPagina(0);}}>Acumulado do ano</button>
      </div>
      <span>Fretes que compõem a receita</span>
    </div>
    {consulta.isPending && <p role="status">Carregando lançamentos…</p>}
    {consulta.isError && <p role="alert">Falha ao consultar os fretes. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && (consulta.data.itens.length ? <>
      <table className="dre-fretes" aria-label="Lançamentos de fretes"><thead><tr>{['Data', 'Minuta', 'CT-e', 'Filial', 'Classificação', 'Valor'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{consulta.data.itens.map((r, i) => <tr key={i}>
          <td>{formatarData(r.data)}</td><td>{r.minuta ?? '—'}</td><td>{r.cte ?? '—'}</td><td>{r.filial}</td><td>{r.classe ?? '—'}</td><td>{formatarMoeda(r.valor)}</td>
        </tr>)}</tbody>
      </table>
      <div className="dre-pagination"><button type="button" disabled={!pagina} aria-label="Página anterior" onClick={() => setPagina(p => p - 1)}><ChevronLeft size={16}/></button>
        <span>Página {pagina + 1}</span><button type="button" aria-label="Próxima página" disabled={!consulta.data.temProxima} onClick={() => setPagina(p => p + 1)}><ChevronRight size={16}/></button></div>
    </> : <p>Nenhum frete com valor neste período e nestes filtros.</p>)}
  </>;
}

export default function DetalheDre(props: Props) {
  const {conta, filtro, mesDisponivel, anoDisponivel, fechar} = props;
  return <section className="dre-detail" aria-label={'Detalhe de ' + conta.nome}>
    <div className="dre-section-header"><h3>{conta.nome}</h3><button type="button" aria-label="Fechar detalhamento" onClick={fechar}><X size={16}/></button></div>
    <p>{origemConta[conta.fonte]}</p>
    {conta.fonte === 'fretes' && (mesDisponivel ? <Lancamentos conta={conta} filtro={filtro} anoDisponivel={anoDisponivel}/>
      : <p>O histórico disponível ainda não cobre esta competência.</p>)}
    {['agregados', 'terceiros', 'parceiros', 'abastecimento', 'rateio'].includes(conta.fonte) && <p>A apuração desta linha será conciliada com o fechamento de Custos.</p>}
  </section>;
}
