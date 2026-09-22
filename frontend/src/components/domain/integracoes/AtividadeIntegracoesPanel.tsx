import type { IndicadoresOperacionais } from '../../../api/endpoints/integracoesOperacionais';
import { formatarNumero } from '../../../utils/formatadores';
import TooltipKpi from '../../shared/TooltipKpi';

export default function AtividadeIntegracoesPanel({ dados }: { dados?: IndicadoresOperacionais }) {
  if (!dados) return null;
  return <details className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
    <summary className="cursor-pointer text-sm font-semibold">Avaliações e tentativas no período</summary>
    <TooltipKpi kpiName="integracoes.atividadeEtapas">
      <p className="my-3 text-xs text-[var(--color-text-muted)]">
        {dados.historicoDesde ? `Registros disponíveis a partir de ${dados.historicoDesde.slice(0, 10).split('-').reverse().join('/')}.` : 'O histórico detalhado ainda não possui registros.'}
        {' '}Avaliações podem se repetir para o mesmo documento. Envios iniciados e consultas à origem abrangem Vedacit.
      </p>
    </TooltipKpi>
    {dados.atividade.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Nenhuma atividade registrada neste período. Datas anteriores ao início da medição não representam zero tentativas.</p>
      : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs tabular-nums">
        <caption className="sr-only">Histórico de avaliações e tentativas</caption>
        <thead><tr className="border-b border-[var(--color-border)]">
          {['Dia', 'Etapa', 'Avaliações', 'Envios iniciados', 'Repetições de envio¹', 'Consultas à origem', 'Sem conclusão'].map(t => <th key={t} scope="col" className="p-2">{t}</th>)}
        </tr></thead>
        <tbody>{dados.atividade.map(a => <tr key={`${a.data}:${a.etapa}`} className="border-b border-[var(--color-border)] last:border-0">
          <td className="p-2">{a.data.split('-').reverse().join('/')}</td><td className="p-2">{a.etapa === 'DADOS' ? 'XML/Dados' : 'Comprovante'}</td>
          {[a.avaliacoes, a.enviosIniciados, a.reenviosIniciados, a.consultasOrigem, a.retencoes].map((v, i) => <td key={i} className="p-2">{formatarNumero(v)}</td>)}
        </tr>)}</tbody>
      </table><p className="mt-2 text-xs text-[var(--color-text-muted)]">¹ Incluídas nos envios iniciados: tentativas posteriores à primeira registrada para o mesmo documento. Início de envio não confirma recebimento.</p></div>}
  </details>;
}
