import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { formatarDataHoraMinuto } from '../../../utils/formatadores';
import type { FiltroDre, ResumoDre } from '../../../api/endpoints/dreServico';
import DetalheDre from './DetalheDre';
import type { ContaDre } from './contasDre';
import { apresentacaoDre, formatarConta, selecionarContas } from './modeloDre';

const totais = new Set(['D12', 'D91', 'D96', 'D200', 'D203', 'D214', 'D217']);
const rodapes = new Set(['D91', 'D200', 'D214']);
const abertasAoEntrar = ['D93', 'D99', 'D206'];

interface Props {
  resumo?: ResumoDre; linhas: ContaDre[]; filtro: FiltroDre; busca: string; buscar: (texto: string) => void; dados: ReturnType<typeof apresentacaoDre>;
}

export default function TabelaDre({resumo, linhas, filtro, busca, buscar, dados}: Props) {
  const [abertas, setAbertas] = useState(() => new Set(filtro.conta || filtro.fornecedor ? linhas.map(c => c.id) : abertasAoEntrar));
  const [detalhe, setDetalhe] = useState<string | null>(null);
  const contas = selecionarContas(linhas, busca);
  const pais = new Set(contas.map(c => c.pai));
  const niveis = new Map<string, number>();
  const visiveis = new Set<string>();
  const pesquisando = Boolean(busca.trim());
  function alternar(id: string) {
    setAbertas(anterior => {
      const nova = new Set(anterior);
      if (nova.has(id)) nova.delete(id); else nova.add(id);
      return nova;
    });
  }
  const mesLegivel = new Intl.DateTimeFormat('pt-BR', {month:'short', year:'numeric', timeZone:'UTC'})
    .format(new Date(filtro.competencia + '-01T12:00:00Z')).replace(' de ', '/');
  return <section className="dre-card" aria-label="Tabela do DRE">
    <div className="dre-section-header dre-table-title">
      <div><h2>Demonstrativo do Resultado do Exercício</h2>
        <p>Valores em reais · {mesLegivel}{resumo?.historico.atualizadoEm && ' · Fretes atualizados em ' + formatarDataHoraMinuto(resumo.historico.atualizadoEm)}</p>
      </div>
      <div className="dre-search"><Search size={15}/><input type="search" aria-label="Buscar conta" placeholder="Buscar conta" value={busca} onChange={e => buscar(e.target.value)}/></div>
    </div>
    <div className="dre-scroll" tabIndex={0} aria-label="Contas e valores por período">
      <table className="dre-table">
        <thead><tr><th scope="col" rowSpan={2}>Conta</th><th scope="colgroup" colSpan={3}>Mês atual · {mesLegivel}</th>
          <th scope="colgroup" colSpan={3}>Acumulado do ano · jan a {mesLegivel}</th></tr>
          <tr>{['mes','ano'].map(p => <Fragment key={p}><th scope="col">Realizado</th><th scope="col">Orçado</th><th scope="col">Variação R$ / %</th></Fragment>)}</tr>
        </thead>
        <tbody>{contas.map(conta => {
          const nivel = conta.pai ? (niveis.get(conta.pai) ?? 0) + 1 : 0;
          niveis.set(conta.id, nivel);
          if (conta.pai && !pesquisando && (!visiveis.has(conta.pai) || (!abertas.has(conta.pai) && !rodapes.has(conta.id)))) return null;
          visiveis.add(conta.id);
          const temFilhos = pais.has(conta.id);
          const expandida = pesquisando || abertas.has(conta.id);
          const selecionada = detalhe === conta.id;
          return <Fragment key={conta.id}>
            <tr data-grupo={!conta.pai || undefined} data-total={totais.has(conta.id) || undefined} data-resultado={conta.id === 'D217' || undefined}>
              <th scope="row"><div className="dre-conta" style={{paddingInlineStart: 12 + 16 * nivel}}>
                {temFilhos ? <button type="button" className="dre-expand" disabled={pesquisando} aria-expanded={expandida}
                  aria-label={(expandida ? 'Recolher ' : 'Expandir ') + conta.nome} onClick={() => alternar(conta.id)}>
                  {expandida ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </button> : <span className="dre-spacer"/>}
                <button type="button" className="dre-name" aria-expanded={selecionada}
                  onClick={() => setDetalhe(selecionada ? null : conta.id)}>{conta.nome}</button>
              </div></th>
              <td>{formatarConta(conta,dados.valor(conta,'mes'))}</td><td>—</td><td>—</td>
              <td>{formatarConta(conta,dados.valor(conta,'ano'))}</td><td>—</td><td>—</td>
            </tr>
            {selecionada && <tr><td colSpan={7} className="dre-detail-cell"><DetalheDre key={conta.id}
              conta={conta} filtro={filtro} dados={dados} linhas={linhas} fechar={() => setDetalhe(null)}/></td></tr>}
          </Fragment>;
        })}
        {contas.length === 0 && <tr><td colSpan={7}>{!busca && (filtro.conta || filtro.fornecedor)
          ? 'Nenhuma linha do modelo vinculada neste recorte. Consulte os lançamentos de Contas a Pagar abaixo.' : 'Nenhuma conta encontrada.'}</td></tr>}
        </tbody>
      </table>
    </div>
    <p className="dre-footnote">As despesas aparecem com sinal negativo. O traço indica histórico insuficiente, conta sem vínculo ou valor pendente de conciliação. O orçamento aguarda o fechamento de Custos.</p>
  </section>;
}
