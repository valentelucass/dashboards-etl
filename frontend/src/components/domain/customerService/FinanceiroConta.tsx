import type { FinanceiroCliente } from '../../../api/endpoints/customerService';
import { formatarData, formatarMoeda, formatarNumero } from '../../../utils/formatadores';
import ChartCard from '../../shared/ChartCard';

interface ParcelaVisual {
  nome: string;
  valor: number;
  cor: string;
  quantidade?: number;
}

function DistribuicaoValores({ parcelas }: { parcelas: ParcelaVisual[] }) {
  const total = parcelas.reduce((soma, parcela) => soma + parcela.valor, 0);
  return <>
    {total > 0 && parcelas.every(parcela => parcela.valor >= 0) &&
      <div className="cs-composicao" aria-hidden="true">
        {parcelas.map(parcela => <span key={parcela.nome} style={{width: (100 * parcela.valor / total) + '%', background: parcela.cor}} />)}
      </div>}
    <dl className="cs-fin-valores">{parcelas.map(parcela => <div key={parcela.nome}>
      <dt><span className="cs-ponto" aria-hidden="true" style={{background: parcela.cor}} />{parcela.nome}</dt>
      <dd>{formatarMoeda(parcela.valor)}{parcela.quantidade !== undefined && <small>{formatarNumero(parcela.quantidade)} {parcela.quantidade === 1 ? 'frete' : 'fretes'}</small>}</dd>
    </div>)}</dl>
  </>;
}

export default function FinanceiroConta({ dados }: { dados: FinanceiroCliente }) {
  const recebimentos = [
    {nome: 'A vencer', valor: dados.aVencer, cor: '#3b82c4'},
    {nome: 'Em atraso', valor: dados.emAtraso, cor: '#cd7049'},
    {nome: 'Pago', valor: dados.pago, cor: '#238a78'},
  ];
  if (dados.semVencimento > 0) recebimentos.push({nome: 'Sem vencimento', valor: dados.semVencimento, cor: '#85878e'});
  return <section aria-label="Financeiro" className="cs-dupla">
    <ChartCard titulo="Faturamento dos fretes" chartKey="csFaturamento">
      <p className="cs-aux">Pela emissão do CT-e. Fretes a faturar ainda sem CT-e entram pela data do serviço.</p>
      <DistribuicaoValores parcelas={[
        {nome: 'Faturado', valor: dados.faturado, cor: '#238a78', quantidade: dados.fretesFaturados},
        {nome: 'Pendente de faturamento', valor: dados.pendenteFaturamento, cor: '#d39931', quantidade: dados.fretesPendentes},
      ]} />
    </ChartCard>
    <ChartCard titulo="Recebimentos do cliente" chartKey="csRecebimentos">
      <p className="cs-aux">Posição em {formatarData(dados.dataCorte)}</p>
      <DistribuicaoValores parcelas={recebimentos} />
      {dados.fretesFaturadosSemParcela > 0 && <p className="cs-nota" role="status">Os valores consideram as parcelas identificadas. {formatarNumero(dados.fretesFaturadosSemParcela)} {dados.fretesFaturadosSemParcela === 1 ? 'frete faturado está' : 'fretes faturados estão'} sem parcela vinculada.</p>}
    </ChartCard>
  </section>;
}
