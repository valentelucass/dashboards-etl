import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salvarBlobComoArquivo } from '../api/downloadArquivo';
import { dimensoesDre, resumoDre } from '../api/endpoints/dreServico';
import CarregamentoDre from '../components/domain/dre/CarregamentoDre';
import { contasDre } from '../components/domain/dre/contasDre';
import { apresentacaoDre, dinheiro, exportacaoDre, montarLinhas, selecionarContas } from '../components/domain/dre/modeloDre';
import TabelaDre from '../components/domain/dre/TabelaDre';
import DashboardSelector from '../components/shared/DashboardSelector';
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
const contaBruta = contasDre[0];
const mesValido = /^(?:19|[2-9]\d)\d{2}-(?:0[1-9]|1[0-2])$/;

function mesAtual() {
  const partes = new Intl.DateTimeFormat('pt-BR', {year:'numeric', month:'2-digit', timeZone:'America/Sao_Paulo'}).formatToParts(new Date());
  return partes.find(p => p.type === 'year')!.value + '-' + partes.find(p => p.type === 'month')!.value;
}

function escolha(label: string, valores: Array<string | null>, valor: string, alterar: (v: string) => void, todos: string, vazio = todos) {
  const opcoes = [...new Set([...valores, valor].filter((v): v is string => Boolean(v)))].sort((a,b) => a.localeCompare(b,'pt-BR'));
  return <div className="dre-control"><span aria-hidden="true">{label}</span>
    <DashboardSelector label={label} value={valor} onValueChange={alterar} disabled={opcoes.length === 0}><option value="">{opcoes.length ? todos : vazio}</option>
      {opcoes.map(v => <option key={v} value={v}>{v}</option>)}</DashboardSelector>
  </div>;
}

export default function DrePage() {
  const {filtros, setFiltros} = useFiltro();
  const atual = mesAtual();
  const informado = filtros.competenciaDre?.[0] ?? '';
  const competencia = mesValido.test(informado) && informado <= atual ? informado : atual;
  const empresa = filtros.empresaDre?.[0] ?? '';
  const filial = filtros.filialDre?.[0] ?? '';
  const centro = filtros.centroDre?.[0] ?? '';
  const [busca, buscar] = useState('');
  const filtro = {competencia, empresa: empresa || undefined, filial: filial || undefined, centro: centro || undefined};
  const dims = useQuery({queryKey:['dre', 'dimensoes', competencia], queryFn: ({signal}) => dimensoesDre(competencia, signal), placeholderData: undefined});
  const resumo = useQuery({queryKey:['dre', 'resumo', filtro], queryFn: ({signal}) => resumoDre(filtro, signal), placeholderData: undefined});
  const dados = resumo.data;
  const disponivel = apresentacaoDre(dados, competencia);
  usePageHeader({title:'DRE', description:'Demonstrativo do Resultado do Exercício', updatedAt:dados?.historico.atualizadoEm});
  const dimensoes = dims.data ?? [];
  const filiais = dimensoes.filter(d => !empresa || d.empresa === empresa);
  const centros = filiais.filter(d => !filial || d.filial === filial);
  const ativos = [{label:'Empresa', key:'empresaDre', value:empresa}, {label:'Filial', key:'filialDre', value:filial}, {label:'Centro de custo', key:'centroDre', value:centro}]
    .filter(f => f.value).map(f => ({label:f.label, count:1, valueLabel:f.value, onRemove:() => setFiltros({[f.key]:[]})}));
  function exportar() {
    const linhas = selecionarContas(montarLinhas(dados), busca);
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
      onClear={() => {setFiltros({empresaDre:[],filialDre:[],centroDre:[]}); buscar('');}}
      actions={<ExportButton label="Exportar" nomeArquivo={'DRE-'+competencia} onExport={resumo.isSuccess ? exportar : undefined}/>}>
      {escolha('Empresa (CNPJ base)', dimensoes.map(d => d.empresa), empresa, v => setFiltros({empresaDre:v?[v]:[],filialDre:[],centroDre:[]}), 'Todas as empresas')}
      {escolha('Filial', filiais.map(d => d.filial), filial, v => setFiltros({filialDre:v?[v]:[],centroDre:[]}), 'Todas as filiais')}
      {escolha('Centro de custo', centros.map(d => d.centro), centro, v => setFiltros({centroDre:v?[v]:[]}), 'Todos os centros',
        dims.isSuccess ? 'Sem centro informado nos fretes' : 'Centros indisponíveis')}
      <label className="dre-control"><span>Conta do DRE</span><input value={busca} onChange={e => buscar(e.target.value)} placeholder="Nome da conta"/></label>
      <label className="dre-control"><span>Projeto</span><input disabled value="Aguarda origem dos projetos" readOnly/></label>
      <label className="dre-control"><span>Fornecedor</span><input disabled value="Aguarda vínculo com as despesas" readOnly/></label>
    </FilterBar>
    {dims.isError && <p role="alert" className="dre-note">Falha ao carregar opções dos filtros. <button onClick={() => void dims.refetch()}>Tentar novamente</button></p>}
    {resumo.isPending ? <CarregamentoDre/> : resumo.isError ? <div className="dre-note" role="alert">Falha ao carregar o DRE. <button onClick={() => void resumo.refetch()}>Tentar novamente</button></div> : <>
      <KpiGrid count={5} singleRowDesktop>{Object.values(kpis).map((def, i) => <TooltipKpi definition={def} key={def.titulo}><KpiCard label={def.titulo}
        valor={i === 0 ? dinheiro(disponivel.valor(contaBruta,'mes')) : '—'} helperText={i === 0 ? 'Fretes da competência' : 'Aguardando conciliação'}/></TooltipKpi>)}</KpiGrid>
      {!disponivel.anoDisponivel && <p className="dre-note" role="status">{dados?.historico.primeiroFrete
        ? 'Primeiro frete disponível em ' + formatarData(dados.historico.primeiroFrete) + '. Períodos com histórico incompleto aparecem com traço.'
        : 'Sem histórico de fretes disponível para este acesso.'}</p>}
      <TabelaDre key={JSON.stringify(filtro)} filtro={filtro} resumo={dados} busca={busca} buscar={buscar}/>
    </>}
  </div>;
}
