import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { documentosTransporteDre, fretesDre, type FiltroDre } from '../../../api/endpoints/dreServico';
import { formatarData } from '../../../utils/formatadores';
import { composicaoConta, dinheiro, formatarConta, type apresentacaoDre } from './modeloDre';
import { origemConta, type ContaDre } from './contasDre';
import LancamentosPagarDre from './LancamentosPagarDre';

interface Props {
  conta: ContaDre; filtro: FiltroDre; dados: ReturnType<typeof apresentacaoDre>;
  linhas: ContaDre[]; fechar: () => void;
}

function Lancamentos({conta, filtro, anoDisponivel}: Pick<Props, 'conta' | 'filtro'> & {anoDisponivel: boolean}) {
  const [acumulado, setAcumulado] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [classe, tipo] = conta.id === 'D6' ? [] : conta.id.split('.');
  const operacional = conta.fonte !== 'fretes';
  const parceiro = conta.fonte === 'parceiros';
  const colunas = operacional ? ['Data',parceiro ? 'Consolidação' : 'Manifesto','Filial',parceiro ? 'Parceiro' : 'Motorista','Valor'] : ['Data','Minuta','CT-e','Filial','Classificação','Valor'];
  const consulta = useQuery({
    queryKey: ['dre', 'documentos', filtro, conta.id, acumulado, pagina],
    queryFn: async ({signal}) => {
      if (operacional) {
        const dados = await documentosTransporteDre({...filtro,linha:conta.id,acumulado,pagina},signal);
        return {temProxima:dados.temProxima, linhas:dados.itens.map(l => [formatarData(l.data),l.documento,l.filial,l.responsavel,dinheiro(l.valor)])};
      }
      const dados = await fretesDre({...filtro,classe,tipo,acumulado,pagina},signal);
      return {temProxima:dados.temProxima, linhas:dados.itens.map(l => [formatarData(l.data),l.minuta,l.cte,l.filial,l.classe,dinheiro(l.valor)])};
    },
    placeholderData: undefined,
  });
  return <>
    <div className="dre-detail-toolbar">
      <div className="dre-segment" aria-label="Período dos lançamentos">
        <button type="button" aria-pressed={!acumulado} onClick={() => {setAcumulado(false); setPagina(0);}}>Mês</button>
        <button type="button" aria-pressed={acumulado} disabled={!anoDisponivel} onClick={() => {setAcumulado(true); setPagina(0);}}>Acumulado do ano</button>
      </div>
      <span>{operacional ? 'Documentos que compõem o custo' : 'Fretes que compõem a receita'}</span>
    </div>
    {consulta.isPending && <p role="status">Carregando lançamentos…</p>}
    {consulta.isError && <p role="alert">Falha ao consultar os documentos. <button type="button" onClick={() => void consulta.refetch()}>Tentar novamente</button></p>}
    {consulta.data && (consulta.data.linhas.length ? <>
      <table className="dre-fretes" aria-label={operacional ? 'Documentos de transporte' : 'Lançamentos de fretes'}><thead><tr>{colunas.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{consulta.data.linhas.map((r, i) => <tr key={i}>{r.map((v,j) => <td key={colunas[j]}>{v ?? '—'}</td>)}</tr>)}</tbody>
      </table>
      <div className="dre-pagination"><button type="button" disabled={!pagina} aria-label="Página anterior" onClick={() => setPagina(p => p - 1)}><ChevronLeft size={16}/></button>
        <span>Página {pagina + 1}</span><button type="button" aria-label="Próxima página" disabled={!consulta.data.temProxima} onClick={() => setPagina(p => p + 1)}><ChevronRight size={16}/></button></div>
    </> : <p>Nenhum documento encontrado neste período e nestes filtros.</p>)}
  </>;
}

function RelatorioDeOrigem({conta, filtro}: Pick<Props,'conta' | 'filtro'>) {
  const manifesto = conta.fonte === 'agregados' || conta.fonte === 'terceiros';
  if (!manifesto && conta.fonte !== 'parceiros') return null;
  if (filtro.empresa || filtro.centro || filtro.fornecedor || filtro.conta || (!manifesto && filtro.filial)) return null;
  const [ano,mes] = filtro.competencia.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano,mes,0)).getUTCDate();
  const periodo = new URLSearchParams({dataInicio:filtro.competencia+'-01',dataFim:filtro.competencia+'-'+ultimoDia});
  if (manifesto) {
    periodo.set('f.tiposContrato',conta.fonte === 'agregados' ? 'agregado' : 'terceiro');
    if (filtro.filial) periodo.set('f.filiais',filtro.filial);
  }
  const texto = manifesto ? 'Conferir manifestos da competência' : 'Conferir consolidações da competência';
  return <p><Link className="dre-origin-link" to={(manifesto ? '/manifestos' : '/rede-credenciada')+'?'+periodo}>{texto}</Link></p>;
}

export default function DetalheDre({conta: inicial, filtro, dados, linhas, fechar}: Props) {
  const [caminho, setCaminho] = useState([inicial]);
  const conta = caminho[caminho.length - 1];
  const anterior = caminho[caminho.length - 2];
  const vinculo = dados.contaPagar(conta);
  const partes = composicaoConta(conta).filter(parte => linhas.some(l => l.id === parte.id));
  return <section className="dre-detail" aria-label={'Detalhe de ' + conta.nome}>
    <div className="dre-section-header"><h3>{conta.nome}</h3><button type="button" aria-label="Fechar detalhamento" onClick={fechar}><X size={16}/></button></div>
    {anterior && <button type="button" className="dre-back" onClick={() => setCaminho(c => c.slice(0,-1))}>Voltar para {anterior.nome}</button>}
    <p>{conta.fonte === 'abastecimento' ? origemConta.abastecimento : vinculo ? 'Lançamentos do Contas a Pagar que compõem esta linha, pelos filtros selecionados.' : origemConta[conta.fonte]}</p>
    {partes.length > 0 && <ul className="dre-composicao" aria-label="Contas que compõem esta linha">{partes.map(parte => {
      const nome = parte.nome;
      return <li key={parte.id}><button type="button" aria-label={'Detalhar ' + nome} onClick={() => setCaminho(c => [...c,parte])}>
        <span>{nome}</span><span>{formatarConta(parte,dados.valor(parte,'mes'))}</span>
      </button></li>;
    })}</ul>}
    {vinculo && <LancamentosPagarDre key={conta.id} filtro={{...filtro, conta:filtro.conta || vinculo.conta}} linha={vinculo.linha}/>}
    {conta.fonte === 'fretes' && (!dados.aplicaFretes ? <p>Os fretes não têm vínculo com os filtros contábeis selecionados.</p> : dados.anoDisponivel ? <Lancamentos key={conta.id} conta={conta} filtro={filtro} anoDisponivel={dados.anoDisponivel}/>
      : <p>O histórico disponível ainda não cobre esta competência.</p>)}
    {['agregados','terceiros','parceiros'].includes(conta.fonte) && (filtro.centro || filtro.conta || filtro.fornecedor
      ? <p>A origem operacional não informa o vínculo com este recorte contábil.</p>
      : <Lancamentos key={conta.id} conta={conta} filtro={filtro} anoDisponivel={dados.valor(conta,'ano') != null}/>)}
    {conta.fonte === 'rateio' && <p>A apuração desta linha será conciliada com o fechamento de Custos.</p>}
    <RelatorioDeOrigem conta={conta} filtro={filtro}/>
  </section>;
}
