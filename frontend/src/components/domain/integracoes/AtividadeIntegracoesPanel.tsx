import { Card } from '@astryxdesign/core/Card';
import { Collapsible } from '@astryxdesign/core/Collapsible';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '@astryxdesign/core/Table';
import type { IndicadoresOperacionais } from '../../../api/endpoints/integracoesOperacionais';
import { formatarNumero } from '../../../utils/formatadores';
import TooltipKpi from '../../shared/TooltipKpi';
import { rotuloEtapa } from '../../../utils/integracoesEtapas';

export default function AtividadeIntegracoesPanel({ dados, destinos }: { dados?: IndicadoresOperacionais; destinos: string[] }) {
  if (!dados) return null;
  const transmissoesDisponiveis = destinos.length === 0 || destinos.includes(dados.escopoTransmissoes);
  return <Card padding={4} className="mt-6">
    <Collapsible trigger="Avaliações e tentativas no período">
    <TooltipKpi kpiName="integracoes.atividadeEtapas">
      <p className="my-3 text-xs text-[var(--color-text-muted)]">
        {dados.historicoDesde ? `Registros disponíveis a partir de ${dados.historicoDesde.slice(0, 10).split('-').reverse().join('/')}.` : 'O histórico detalhado ainda não possui registros.'}
        {' '}Avaliações podem se repetir para o mesmo documento. {transmissoesDisponiveis
          ? 'Envios iniciados e consultas à origem abrangem Vedacit.'
          : 'Envios iniciados e consultas à origem ainda não são medidos para esta integração.'}
      </p>
    </TooltipKpi>
    {dados.atividade.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Nenhuma atividade registrada neste período. Datas anteriores ao início da medição não representam zero tentativas.</p>
      : <div className="overflow-x-auto"><Table className="w-full min-w-[680px] text-left text-xs tabular-nums">
        <caption className="sr-only">Histórico de avaliações e tentativas</caption>
        <TableHeader><TableRow isHeaderRow className="border-b border-[var(--color-border)]">
          {['Dia', 'Etapa', 'Avaliações', 'Envios iniciados', 'Repetições de envio¹', 'Consultas à origem', 'Sem conclusão'].map(t => <TableHeaderCell key={t} scope="col" className="p-2">{t}</TableHeaderCell>)}
        </TableRow></TableHeader>
        <TableBody>{dados.atividade.map(a => <TableRow key={`${a.data}:${a.etapa}`} className="border-b border-[var(--color-border)] last:border-0">
          <TableCell className="p-2">{a.data.split('-').reverse().join('/')}</TableCell><TableCell className="p-2">{rotuloEtapa({ sistemaDestino: destinos.length === 1 ? destinos[0] : '', etapa: a.etapa })}</TableCell>
          {[a.avaliacoes, transmissoesDisponiveis ? a.enviosIniciados : null, transmissoesDisponiveis ? a.reenviosIniciados : null,
            transmissoesDisponiveis ? a.consultasOrigem : null, a.retencoes].map((v, i) => <TableCell key={i} className="p-2">{v === null ? 'Não medido' : formatarNumero(v)}</TableCell>)}
        </TableRow>)}</TableBody>
      </Table><p className="mt-2 text-xs text-[var(--color-text-muted)]">¹ Incluídas nos envios iniciados: tentativas posteriores à primeira registrada para o mesmo documento. Início de envio não confirma recebimento.</p></div>}
    </Collapsible>
  </Card>;
}
