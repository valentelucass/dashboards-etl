import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { formatarDataHoraMinuto } from '../../../utils/formatadores';
import type { FiltroDre, ResumoDre } from '../../../api/endpoints/dreServico';
import DetalheDre from './DetalheDre';
import type { ContaDre } from './contasDre';
import { apresentacaoDre, colunasPeriodoDre, selecionarContas } from './modeloDre';

const abertasAoEntrar = ['D93', 'D99', 'D206'];
const periodos = ['mes', 'ano'] as const;
const totalColunas = 1 + periodos.length * colunasPeriodoDre.length;

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
        <thead><tr><th scope="col" rowSpan={2}>Conta</th><th scope="colgroup" colSpan={colunasPeriodoDre.length}>Mês atual · {mesLegivel}</th>
          <th scope="colgroup" colSpan={colunasPeriodoDre.length}>Acumulado do ano · jan a {mesLegivel}{dados.anoParcial && ' (histórico parcial)'}</th></tr>
          <tr>{periodos.map(p => <Fragment key={p}>{colunasPeriodoDre.map((titulo,i) => {
            const contexto = titulo === '% ROL' ? '% ROL ' + (i === 1 ? 'realizado' : 'orçado') + (p === 'mes' ? ' do mês' : ' do acumulado') : undefined;
            return <th key={i} scope="col" aria-label={contexto} title={contexto}>{titulo}</th>;
          })}</Fragment>)}</tr>
        </thead>
        <tbody>{contas.map(conta => {
          const nivel = conta.pai ? (niveis.get(conta.pai) ?? 0) + 1 : 0;
          niveis.set(conta.id, nivel);
          if (conta.pai && !pesquisando && (!visiveis.has(conta.pai) || !abertas.has(conta.pai))) return null;
          visiveis.add(conta.id);
          const temFilhos = pais.has(conta.id);
          const expandida = pesquisando || abertas.has(conta.id);
          const selecionada = detalhe === conta.id;
          return <Fragment key={conta.id}>
            <tr data-grupo={!conta.pai || undefined} data-total={conta.fonte === 'resultado' || undefined} data-resultado={conta.id === 'D217' || undefined}>
              <th scope="row"><div className="dre-conta" style={{paddingInlineStart: 12 + 16 * nivel}}>
                {temFilhos ? <button type="button" className="dre-expand" disabled={pesquisando} aria-expanded={expandida}
                  aria-label={(expandida ? 'Recolher ' : 'Expandir ') + conta.nome} onClick={() => alternar(conta.id)}>
                  {expandida ? <ChevronDown size={15}/> : <ChevronRight size={15}/>}
                </button> : <span className="dre-spacer"/>}
                <button type="button" className="dre-name" aria-expanded={selecionada}
                  onClick={() => setDetalhe(selecionada ? null : conta.id)}>{conta.nome}</button>
              </div></th>
              {periodos.map(p => <Fragment key={p}>{dados.celulasPeriodo(conta,p).map((texto,i) => <td key={i}>{texto}</td>)}</Fragment>)}
            </tr>
            {selecionada && <tr><td colSpan={totalColunas} className="dre-detail-cell"><DetalheDre key={conta.id}
              conta={conta} filtro={filtro} dados={dados} linhas={linhas} fechar={() => setDetalhe(null)}/></td></tr>}
          </Fragment>;
        })}
        {contas.length === 0 && <tr><td colSpan={totalColunas}>{!busca && (filtro.conta || filtro.fornecedor)
          ? 'Nenhuma linha do modelo vinculada neste recorte. Consulte os lançamentos de Contas a Pagar abaixo.' : 'Nenhuma conta encontrada.'}</td></tr>}
        </tbody>
      </table>
    </div>
    <p className="dre-footnote">Grupos e resultados somam os lançamentos disponíveis. Contas em conciliação podem alterar o resultado. O % ROL divide o valor em reais pela receita líquida da mesma coluna. O traço indica valor indisponível ou percentual sem base.{!dados.temOrcamento && ' O orçamento aguarda o fechamento de Custos.'}</p>
  </section>;
}
