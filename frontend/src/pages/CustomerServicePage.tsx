import { useRef, useState, type ReactNode } from 'react';
import { skipToken, useQuery } from '@tanstack/react-query';
import { Presentation } from 'lucide-react';
import { buscarContasCS, buscarFinanceiroCS, buscarOperacaoCS, type ContaCustomerService } from '../api/endpoints/customerService';
import { useFiltro } from '../contexts/FiltroContext';
import { usePageHeader } from '../contexts/PageHeaderContext';
import FilterBar from '../components/shared/FilterBar';
import DateRangePicker from '../components/shared/DateRangePicker';
import DashboardSelector from '../components/shared/DashboardSelector';
import ApresentacaoConta from '../components/domain/customerService/ApresentacaoConta';
import OperacaoConta from '../components/domain/customerService/OperacaoConta';
import QualidadeConta from '../components/domain/customerService/QualidadeConta';
import FinanceiroConta from '../components/domain/customerService/FinanceiroConta';
import { formatarData } from '../utils/formatadores';
import '../components/domain/customerService/customer-service.css';

function Fonte({ assunto, erro, tentar, children }: { assunto: string; erro: boolean; tentar: () => void; children?: ReactNode }) {
  if (erro) return <div className="cs-mensagem" role="alert">
    <span>Não foi possível carregar {assunto} desta conta.</span>
    <button type="button" className="cs-botao" onClick={tentar}>Tentar novamente</button>
  </div>;
  if (!children) return <div className="cs-mensagem" role="status">Carregando {assunto}…</div>;
  return children;
}

function RelatorioConta({ conta, seletor, pendencia }: { conta?: ContaCustomerService; seletor: ReactNode; pendencia: ReactNode }) {
  const {dataInicio, dataFim, setDataInicio, setDataFim, setDataRange} = useFiltro();
  const consulta = conta ? {clienteId: conta.id, dataInicio, dataFim} : undefined;
  const [apresentando, setApresentando] = useState(false);
  const abrir = useRef<HTMLButtonElement>(null);
  const chave = ['customer-service', conta?.id, dataInicio, dataFim];
  const op = useQuery({ queryKey: [...chave, 'operacional'], queryFn: consulta ? ({signal}) => buscarOperacaoCS(consulta, signal) : skipToken,
    placeholderData: undefined, retry: false });
  const fin = useQuery({ queryKey: [...chave, 'financeiro'], queryFn: consulta ? ({signal}) => buscarFinanceiroCS(consulta, signal) : skipToken,
    placeholderData: undefined, retry: false });
  const slides = [
    { titulo: 'Entregas e coletas', conteudo: <Fonte assunto="os dados de entregas e coletas" erro={op.isError} tentar={() => void op.refetch()}>
      {op.data && <OperacaoConta dados={op.data} inicio={dataInicio} fim={dataFim} />}
    </Fonte> },
    { titulo: 'Comprovantes e ocorrências', conteudo: <Fonte assunto="os comprovantes e ocorrências" erro={op.isError} tentar={() => void op.refetch()}>
      {op.data && <QualidadeConta dados={op.data} />}
    </Fonte> },
    { titulo: 'Financeiro', conteudo: <Fonte assunto="os dados financeiros" erro={fin.isError} tentar={() => void fin.refetch()}>
      {fin.data && <FinanceiroConta dados={fin.data} />}
    </Fonte> },
  ];
  function sair() {
    setApresentando(false);
    requestAnimationFrame(() => abrir.current?.focus());
  }
  return <div className="cs-pagina">
    <FilterBar dataInicio={dataInicio} dataFim={dataFim}
      period={<DateRangePicker dataInicio={dataInicio} dataFim={dataFim} onDataInicioChange={setDataInicio}
        onDataFimChange={setDataFim} onRangeChange={setDataRange} />}
      actions={<div className="cs-acoes-cabecalho">
        {seletor}
        <button type="button" ref={abrir} className="cs-botao cs-botao-principal" aria-label="Apresentar cliente" title="Apresentar cliente"
          disabled={!conta || !(op.data || fin.data)} onClick={() => setApresentando(true)}>
          <Presentation size={17} aria-hidden="true" /><span>Apresentar cliente</span>
        </button>
      </div>} />
    <div className="cs-conteudo">
      {!conta ? pendencia : apresentando ? <ApresentacaoConta key={dataInicio + '/' + dataFim} conta={conta.nome}
        periodo={formatarData(dataInicio) + ' a ' + formatarData(dataFim)} slides={slides} fechar={sair} />
        : <div className="cs-paineis">{slides.map(slide => <div key={slide.titulo}>{slide.conteudo}</div>)}</div>}
    </div>
  </div>;
}

export default function CustomerServicePage() {
  usePageHeader({title: 'Customer Service', description: 'Atendimento, entregas e financeiro do cliente.'});
  const { filtros, setFiltro } = useFiltro();
  const catalogo = useQuery({queryKey: ['customer-service', 'clientes'], queryFn: ({signal}) => buscarContasCS(signal), retry: false});
  const contas = catalogo.isSuccess ? catalogo.data : [];
  const quantidadePorNome = new Map<string, number>();
  for (const conta of contas) {
    quantidadePorNome.set(conta.nome, (quantidadePorNome.get(conta.nome) ?? 0) + 1);
  }
  const solicitados = filtros.clienteCS ?? [];
  const selecionada = solicitados.length === 1 ? contas.find(item => String(item.id) === solicitados[0]) : undefined;
  const seletor = <div className="cs-conta"><label className="sr-only" htmlFor="cs-cliente">Cliente Key Account</label>
    <DashboardSelector id="cs-cliente" label="Cliente Key Account" value={selecionada?.id ?? ''}
      onValueChange={id => setFiltro('clienteCS', [id])} disabled={!contas.length} required>
      <option value="" disabled>Selecione um cliente</option>
      {contas.map(conta => <option key={conta.id} value={conta.id}>
        {conta.nome}{(quantidadePorNome.get(conta.nome) ?? 0) > 1 ? ' · Conta ' + conta.id : ''}
      </option>)}
    </DashboardSelector>
  </div>;
  return <RelatorioConta key={selecionada?.id ?? 'vazio'} conta={selecionada} seletor={seletor}
    pendencia={<div className="cs-mensagem cs-vazio" role={catalogo.isError ? 'alert' : 'status'}>
          {catalogo.isPending ? 'Carregando clientes…' : catalogo.isError ? 'Não foi possível carregar a lista de clientes.'
            : contas.length ? 'Selecione um cliente para consultar os indicadores.' : 'Nenhum cliente Key Account disponível para a sua conta.'}
          {catalogo.isError && <button type="button" className="cs-botao" onClick={() => void catalogo.refetch()}>Tentar novamente</button>}
    </div>} />;
}
