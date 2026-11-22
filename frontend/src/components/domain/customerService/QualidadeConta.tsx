import type { OperacaoCliente } from '../../../api/endpoints/customerService';
import { formatarNumero } from '../../../utils/formatadores';
import ChartCard from '../../shared/ChartCard';
import { exibirTaxa, taxa } from './percentuais';

export default function QualidadeConta({ dados }: { dados: OperacaoCliente }) {
  return <section aria-label="Comprovantes e ocorrências" className="cs-dupla">
    <ChartCard titulo="Comprovantes de entrega" chartKey="csComprovantes">
      <div className="cs-comprovantes">
        {([['Anexados', dados.anexadas], ['Arquivados', dados.arquivadas]] as const).map(([titulo, quantidade]) => <div key={titulo}>
          <div className="cs-medida"><span>{titulo}</span><strong className="cs-valor">{exibirTaxa(quantidade, dados.finalizadas)}</strong></div>
          <div className="cs-trilho" aria-hidden="true"><span style={{width: (taxa(quantidade, dados.finalizadas) ?? 0) + '%'}} /></div>
          <small>{quantidade === null ? 'Dados de arquivamento indisponíveis' : formatarNumero(quantidade) + ' de ' + formatarNumero(dados.finalizadas) + ' entregas finalizadas'}</small>
        </div>)}
      </div>
      <p className="cs-nota">A situação é a de hoje, inclusive quando o comprovante foi anexado ou arquivado depois do período.</p>
    </ChartCard>
    <ChartCard titulo="Ocorrências por tipo" chartKey="csOcorrencias">
      {dados.ocorrenciasPorTipo === null ? <p className="cs-aux">A base de ocorrências ainda não cobre todos os dias do período selecionado.</p> : <>
        <div className="cs-sinistros">
          <div><span>Fretes com avaria ou extravio</span><strong className="cs-valor">{dados.fretesComAvariaOuExtravio === null ? '—' : formatarNumero(dados.fretesComAvariaOuExtravio)}</strong></div>
          <div><span>Avarias</span><strong className="cs-valor">{dados.avarias === null ? '—' : formatarNumero(dados.avarias)}</strong></div>
          <div><span>Extravios</span><strong className="cs-valor">{dados.extravios === null ? '—' : formatarNumero(dados.extravios)}</strong></div>
        </div>
        <p className="cs-nota">Cada minuta conta uma vez no total de avarias e extravios confirmados. A tabela mostra as baixas de entrega ou coleta, finalizações do transporte e aberturas de tratativa lançadas no período.</p>
        {!dados.ocorrenciasPorTipo.length ? <p className="cs-aux">Nenhuma ocorrência no período.</p>
          : <div role="region" tabIndex={0} aria-label="Tipos de ocorrência" className="cs-lista-ocorrencias"><table>
            <thead><tr><th scope="col">Tipo</th><th scope="col">Registros</th></tr></thead>
            <tbody>{dados.ocorrenciasPorTipo.map(item => <tr key={item.tipo}><th scope="row">{item.tipo}</th><td>{formatarNumero(item.quantidade)}</td></tr>)}</tbody>
          </table></div>}
      </>}
    </ChartCard>
  </section>;
}
