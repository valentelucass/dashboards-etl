import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salvarBlobComoArquivo } from '../api/downloadArquivo';
import { custosTransporteDre, dimensoesDre, opcoesPagarDre, resumoDre, resumoPagarDre, type FiltroDre, type OpcaoPagarDre } from '../api/endpoints/dreServico';
import CarregamentoDre from '../components/domain/dre/CarregamentoDre';
import { contasDre } from '../components/domain/dre/contasDre';
import { apresentacaoDre, formatarConta, exportacaoDre, linhasContabeis, selecionarContas } from '../components/domain/dre/modeloDre';
import TabelaDre from '../components/domain/dre/TabelaDre';
import LancamentosPagarDre from '../components/domain/dre/LancamentosPagarDre';
import ExportButton from '../components/shared/ExportButton';
import FilterBar from '../components/shared/FilterBar';
import KpiCard from '../components/shared/KpiCard';
import KpiGrid from '../components/shared/KpiGrid';
import TooltipKpi from '../components/shared/TooltipKpi';
import { KpiDictionary } from '../constants/kpiDictionary';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { formatarData } from '../utils/formatadores';
import '../components/domain/dre/dre.css';

const kpis = KpiDictionary.dre;
const cards = [
  ['D6',kpis.bruta], ['D12',kpis.liquida], ['D96',kpis.lucro], ['D97',kpis.margem], ['D217',kpis.resultado],
] as const;
const mesValido = /^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/;

function mesAtual() {
  const partes = new Intl.DateTimeFormat('pt-BR', {year:'numeric', month:'2-digit', timeZone:'America/Sao_Paulo'}).formatToParts(new Date());
  return partes.find(p => p.type === 'year')!.value + '-' + partes.find(p => p.type === 'month')!.value;
}

function escolha(label: string, valores: Array<string | null>, valor: string, alterar: (v: string) => void, todos: string, vazio = todos, carregando = false) {
  const opcoes = [...new Set([...valores, valor].filter((v): v is string => Boolean(v)))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  return <label className="dre-control"><span>{label}</span>
    <select aria-label={label} value={valor} onChange={e => alterar(e.target.value)} disabled={carregando || opcoes.length === 0}>
      <option value="">{carregando ? 'Carregando…' : opcoes.length ? todos : vazio}</option>
      {opcoes.map(v => <option key={v} value={v}>{v}</option>)}
    </select>
  </label>;
}

function ConferenciaPagar({filtro}: {filtro: FiltroDre}) {
  const [aberta, alterar] = useState(Boolean(filtro.conta || filtro.fornecedor));
  return <section className="dre-card" aria-label="Conferência de Contas a Pagar">
    <div className="dre-section-header dre-table-title"><h2>Lançamentos de Contas a Pagar</h2>
      <button className="dre-name" type="button" aria-expanded={aberta} onClick={() => alterar(!aberta)}>{aberta ? 'Recolher lançamentos' : 'Conferir lançamentos'}</button></div>
    {aberta && <LancamentosPagarDre filtro={filtro}/>}
  </section>;
}

export default function DrePage() {
  const {filtros, setFiltros} = useFiltro();
  const atual = mesAtual();
  const informado = filtros.competenciaDre?.[0] ?? '';
  const competencia = mesValido.test(informado) && informado <= atual ? informado : atual;
  const empresa = filtros.empresaDre?.[0] ?? '';
  const filial = filtros.filialDre?.[0] ?? '';
  const centro = filtros.centroDre?.[0] ?? '';
  const fornecedor = filtros.fornecedorDre?.[0] ?? '';
  const conta = filtros.contaContabilDre?.[0] ?? '';
  const [busca, buscar] = useState('');
  const organizacao = {competencia, empresa: empresa || undefined, filial: filial || undefined, centro: centro || undefined};
  const filtro = {...organizacao, fornecedor:fornecedor || undefined, conta:conta || undefined};
  const dims = useQuery({queryKey:['dre', 'dimensoes', competencia], queryFn: ({signal}) => dimensoesDre(competencia, signal), placeholderData: undefined});
  const opcoes = useQuery({queryKey:['dre','opcoes-pagar',organizacao], queryFn:({signal}) => opcoesPagarDre(organizacao,signal), placeholderData:undefined});
  const pagar = useQuery({queryKey:['dre','pagar',filtro], queryFn:({signal}) => resumoPagarDre(filtro,signal), placeholderData:undefined});
  const aplicaTransporte = !fornecedor && !centro && !conta;
  const transporte = useQuery({queryKey:['dre','transporte',organizacao], queryFn:({signal}) => custosTransporteDre(organizacao,signal), enabled:aplicaTransporte, placeholderData:undefined});
  const resumo = useQuery({queryKey:['dre', 'resumo', organizacao], queryFn: ({signal}) => resumoDre(organizacao, signal), placeholderData: undefined});
  const dados = resumo.data;
  usePageHeader({title:'DRE', description:'Demonstrativo do Resultado do Exercício', updatedAt:dados?.historico.atualizadoEm});
  const dimensoes = dims.data ?? [];
  const filiais = dimensoes.filter(d => !empresa || d.empresa === empresa);
  const centros = filiais.filter(d => !filial || d.filial === filial);
  const aplicaFretes = !conta && !fornecedor && (!centro || centros.some(d => d.centro === centro));
  const disponivel = apresentacaoDre(dados, competencia, pagar.data, aplicaFretes, aplicaTransporte ? transporte.data : undefined);
  const linhasDre = linhasContabeis(dados, pagar.data, conta, fornecedor);
  const nomes = (tipo:OpcaoPagarDre['tipo']) => opcoes.data?.filter(d => d.tipo === tipo).map(d => d.nome) ?? [];
  const limparContas = {fornecedorDre:[],contaContabilDre:[]};
  const ativos = [{label:'Empresa', key:'empresaDre', value:empresa}, {label:'Filial', key:'filialDre', value:filial}, {label:'Centro de custo', key:'centroDre', value:centro},
    {label:'Fornecedor',key:'fornecedorDre',value:fornecedor},{label:'Conta contábil',key:'contaContabilDre',value:conta}]
    .filter(f => f.value).map(f => ({label:f.label, count:1, valueLabel:f.value, onRemove:() => setFiltros({[f.key]:[]})}));
  function exportar() {
    const linhas = selecionarContas(linhasDre, busca);
    const csv = exportacaoDre(linhas, disponivel, competencia);
    salvarBlobComoArquivo(new Blob([csv], {type:'text/csv;charset=utf-8'}), 'DRE-' + competencia + '.csv');
  }
  const trocarCompetencia = (mes: string) => {
    if (mesValido.test(mes) && mes <= atual) setFiltros({competenciaDre:[mes]});
  };
  const periodo = <label className="dre-control"><span>Competência</span><input type="month" min="1900-01" max={atual}
    aria-label="Competência" value={competencia} onChange={e => trocarCompetencia(e.target.value)}/></label>;
  return <div className="dre-page">
    <FilterBar activeFilters={ativos} period={periodo} dateAccessory={<span className="dre-currency">BRL</span>}
      dataInicio={competencia+'-01'} dataFim={competencia + '-' + new Date(Date.UTC(Number(competencia.slice(0,4)), Number(competencia.slice(5)), 0)).getUTCDate()}
      onClear={() => {setFiltros({empresaDre:[],filialDre:[],centroDre:[],...limparContas}); buscar('');}}
      actions={<ExportButton label="Exportar" nomeArquivo={'DRE-'+competencia} onExport={resumo.isSuccess && pagar.isSuccess && (!aplicaTransporte || transporte.isSuccess) ? exportar : undefined}/>}>
      {escolha('Empresa (CNPJ base)', dimensoes.map(d => d.empresa), empresa, v => setFiltros({empresaDre:v?[v]:[],filialDre:[],centroDre:[],...limparContas}), 'Todas as empresas')}
      {escolha('Filial', [...filiais.map(d => d.filial),...nomes('filial')], filial, v => setFiltros({filialDre:v?[v]:[],centroDre:[],...limparContas}), 'Todas as filiais')}
      {escolha('Centro de custo', [...centros.map(d => d.centro),...nomes('centro')], centro, v => setFiltros({centroDre:v?[v]:[],...limparContas}), 'Todos os centros','Sem centro informado')}
      {escolha('Conta contábil', nomes('conta'), conta, v => setFiltros({contaContabilDre:v?[v]:[]}), 'Todas as contas', 'Sem contas no período', opcoes.isPending)}
      {escolha('Fornecedor', nomes('fornecedor'), fornecedor, v => setFiltros({fornecedorDre:v?[v]:[]}), 'Todos os fornecedores', 'Sem fornecedores no período', opcoes.isPending)}
      <label className="dre-control"><span>Projeto</span><input disabled value="Aguarda origem dos projetos" readOnly/></label>
    </FilterBar>
    {(dims.isError || opcoes.isError) && <p role="alert" className="dre-note">Falha ao carregar opções dos filtros. <button onClick={() => {void dims.refetch(); void opcoes.refetch();}}>Tentar novamente</button></p>}
    {resumo.isPending || pagar.isPending || (aplicaTransporte && transporte.isPending) ? <CarregamentoDre/> : resumo.isError ? <div className="dre-note" role="alert">Falha ao carregar o DRE. <button onClick={() => void resumo.refetch()}>Tentar novamente</button></div> : <>
      {pagar.isError && <p role="alert" className="dre-note">Contas a Pagar indisponível. <button onClick={() => void pagar.refetch()}>Tentar novamente</button></p>}
      {aplicaTransporte && transporte.isError && <p role="alert" className="dre-note">Custos de transporte indisponíveis. <button onClick={() => void transporte.refetch()}>Tentar novamente</button></p>}
      <KpiGrid count={5} singleRowDesktop>{cards.map(([id, def]) => {
        const linha = contasDre.find(c => c.id === id)!;
        const valor = disponivel.valor(linha,'mes');
        const ajuda = id === 'D6' && !aplicaFretes ? 'Sem vínculo com este filtro' : valor == null ? 'Sem base de cálculo'
          : disponivel.resultadoParcial(linha,'mes') ? 'Parcial · contas em conciliação' : 'Competência selecionada';
        return <TooltipKpi definition={def} key={id}><KpiCard label={def.titulo} valor={formatarConta(linha,valor)} helperText={ajuda}/></TooltipKpi>;
      })}</KpiGrid>
      {disponivel.anoParcial && <p className="dre-note" role="status">O acumulado soma os lançamentos disponíveis de janeiro até a competência selecionada.
        {aplicaFretes && dados?.historico.primeiroFrete && dados.historico.primeiroFrete > competencia.slice(0,4)+'-01-01'
          && <> O histórico de fretes começa em {formatarData(dados.historico.primeiroFrete)}.</>}</p>}
      <TabelaDre key={JSON.stringify(filtro)} filtro={filtro} linhas={linhasDre} resumo={dados} dados={disponivel} busca={busca} buscar={buscar}/>
      <ConferenciaPagar key={'lancamentos'+JSON.stringify(filtro)} filtro={filtro}/>
    </>}
  </div>;
}
