import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { aplicarCarteiraCS, baixarModeloCarteiraCS, conferirCarteiraCS, type ResumoCarteiraCS } from '../../../api/endpoints/customerService';
import { getApiErrorMessage } from '../../../utils/apiError';
import { competenciaParaMonthInput } from '../../../utils/competencia';
import { formatarNumero } from '../../../utils/formatadores';
import DashboardAdaptiveDialog from '../../shared/DashboardAdaptiveDialog';

function mesExibido(competencia: string) {
  const [ano, mes] = competencia.split('-');
  return mes + '/' + ano;
}

function Resumo({dados}: {dados: ResumoCarteiraCS}) {
  const mudancas = [
    {nome:'CNPJs que entram', total:dados.adicionados},
    {nome:'CNPJs que saem', total:dados.removidos},
    {nome:'CNPJs que mudam de grupo', total:dados.transferidos},
  ];
  return <section className="cs-previa" aria-label="Resumo da carteira">
    <h3>Carteira de {mesExibido(dados.competencia)}</h3>
    <p>{formatarNumero(dados.grupos)} {dados.grupos === 1 ? 'grupo Key Account' : 'grupos Key Account'} · {formatarNumero(dados.cnpjs)} {dados.cnpjs === 1 ? 'CNPJ' : 'CNPJs'} na planilha</p>
    <dl className="cs-impacto">{mudancas.map(({nome, total}) =>
      <div key={nome}><dt>{nome}</dt><dd>{formatarNumero(total)}</dd></div>)}</dl>
  </section>;
}

export default function ImportarCarteira({fechar, atualizar}: {fechar: () => void; atualizar: () => void}) {
  const [competencia, setCompetencia] = useState(() => competenciaParaMonthInput());
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [confirmado, setConfirmado] = useState(false);
  const [erroFormato, setErroFormato] = useState('');
  const modelo = useMutation({mutationFn: baixarModeloCarteiraCS, retry: false});
  const analise = useMutation({
    mutationFn: ({planilha, mes}: {planilha: File; mes: string}) => conferirCarteiraCS(planilha, mes),
    retry: false,
  });
  const aplicacao = useMutation({
    mutationFn: ({planilha, previa}: {planilha: File; previa: ResumoCarteiraCS}) => aplicarCarteiraCS(planilha, previa),
    retry: false,
    onSuccess: () => atualizar(),
    onError: () => { analise.reset(); setConfirmado(false); },
  });
  const previa = analise.data;
  const resultado = aplicacao.data;
  const ocupado = analise.isPending || aplicacao.isPending;
  const temSaidas = previa && (previa.removidos > 0 || previa.transferidos > 0);
  const erro = erroFormato || (aplicacao.error && getApiErrorMessage(aplicacao.error, 'Não foi possível aplicar a carteira.'))
    || (analise.error && getApiErrorMessage(analise.error, 'Não foi possível conferir a planilha.'))
    || (modelo.error && getApiErrorMessage(modelo.error, 'Não foi possível baixar o modelo.'));

  function reiniciarConferencia() {
    analise.reset();
    aplicacao.reset();
    modelo.reset();
    setConfirmado(false);
    setErroFormato('');
  }

  function escolherArquivo(selecionado: File | null) {
    reiniciarConferencia();
    if (selecionado && !/\.xlsx$/i.test(selecionado.name)) {
      setArquivo(null);
      setErroFormato('Selecione uma planilha Excel no formato .xlsx.');
      return;
    }
    setArquivo(selecionado);
  }

  return <DashboardAdaptiveDialog label="Importar carteira Key Account" isOpen purpose="form" width={620}
    onOpenChange={aberto => { if (!aberto && !aplicacao.isPending) fechar(); }}>
    <div className="cs-importacao">
      <h2>Importar carteira Key Account</h2>
      {resultado ? <>
        <p role="status">Carteira de {mesExibido(resultado.competencia)} confirmada. {resultado.semAlteracao ? 'A composição da carteira foi mantida.' : 'A lista de clientes foi atualizada.'}</p>
        <Resumo dados={resultado} />
      </> : <>
        <p>Envie a lista completa do mês com as colunas KEY ACCOUNT e CNPJ. Os CNPJs ausentes na planilha sairão da carteira.</p>
        <button type="button" className="cs-botao cs-modelo" disabled={modelo.isPending || ocupado} onClick={() => modelo.mutate()}>
          <Download size={15} aria-hidden="true" />{modelo.isPending ? 'Baixando modelo…' : 'Baixar modelo Excel'}
        </button>
        <div className="cs-arquivo-campos">
          <label>Mês da carteira<input type="month" value={competencia} required disabled={ocupado}
            onChange={e => { reiniciarConferencia(); setCompetencia(e.target.value); }} /></label>
          <label>Planilha Excel<input type="file" accept=".xlsx" disabled={ocupado}
            onChange={e => escolherArquivo(e.target.files?.[0] ?? null)} /></label>
        </div>
        {previa && <><Resumo dados={previa} />
          {temSaidas ? <label className="cs-confirmacao"><input type="checkbox" checked={confirmado} disabled={ocupado}
            onChange={e => setConfirmado(e.target.checked)} />Conferi as saídas e mudanças de grupo desta carteira.</label>
            : previa.semAlteracao && <p>A composição da carteira é a mesma da lista vigente.</p>}
        </>}
        {erro && <p role="alert" className="cs-importacao-erro">{erro}{aplicacao.isError && ' Confira novamente antes de aplicar.'}</p>}
      </>}
      <div className="cs-importacao-acoes">
        <button type="button" className="cs-botao" disabled={aplicacao.isPending} onClick={fechar}>{resultado ? 'Fechar' : 'Cancelar'}</button>
        {!resultado && (previa
          ? <button type="button" className="cs-botao cs-botao-principal" disabled={ocupado || (temSaidas && !confirmado)}
              onClick={() => { if (arquivo) aplicacao.mutate({planilha:arquivo, previa}); }}>
              {aplicacao.isPending ? 'Aplicando…' : 'Confirmar carteira'}
            </button>
          : <button type="button" className="cs-botao cs-botao-principal" disabled={!arquivo || !competencia || ocupado}
              onClick={() => { if (arquivo) { aplicacao.reset(); analise.mutate({planilha:arquivo, mes:competencia}); } }}>
              {analise.isPending ? 'Conferindo…' : 'Conferir planilha'}
            </button>)}
      </div>
    </div>
  </DashboardAdaptiveDialog>;
}
