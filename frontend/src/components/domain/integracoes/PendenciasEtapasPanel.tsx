import { Badge } from '@astryxdesign/core/Badge';
import DashboardLoading from '../../shared/DashboardLoading';
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from '../../shared/DashboardTable';
import DashboardButton from "../../shared/DashboardButton";
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ACOES_ETAPA, buscarPendenciasEtapas, type AcaoEtapa, type EtapaOperacional } from '../../../api/endpoints/integracoesOperacionais';
import type { EtapaIntegracao } from '../../../api/endpoints/integracoesEtapas';
import { formatarNumero } from '../../../utils/formatadores';
import { rotuloEtapa } from '../../../utils/integracoesEtapas';
import { INTEGRATION_QUERY_POLLING_OPTIONS } from '../../../utils/pollingUtils';
import TooltipKpi from '../../shared/TooltipKpi';

const campos: Record<AcaoEtapa, keyof Pick<EtapaOperacional, 'aguardandoProcessamento' | 'novaTentativa' | 'aguardandoOrigem' | 'aguardandoConfirmacao' | 'intervencao' | 'semConfirmacaoDatada'>> = {
  AGUARDANDO_PROCESSAMENTO: 'aguardandoProcessamento', NOVA_TENTATIVA: 'novaTentativa', AGUARDANDO_ORIGEM: 'aguardandoOrigem',
  AGUARDANDO_CONFIRMACAO: 'aguardandoConfirmacao', INTERVENCAO: 'intervencao', A_CONFERIR: 'semConfirmacaoDatada',
};
const tonsAcao = {
  AGUARDANDO_PROCESSAMENTO: 'info', NOVA_TENTATIVA: 'info', AGUARDANDO_ORIGEM: 'warning',
  AGUARDANDO_CONFIRMACAO: 'warning', INTERVENCAO: 'error', A_CONFERIR: 'info',
} as const satisfies Record<AcaoEtapa, string>;
const motivos: Record<string, string> = { ACESSO_ORIGEM_RECUSADO: 'A origem recusou o acesso ao XML', ESPERA_ACESSO_ORIGEM: 'Aguardando liberação do acesso',
  METADADO_ENTREGA: 'Aguardando data de entrega válida', DOCUMENTO_AUSENTE: 'Documento ausente na origem', ...ACOES_ETAPA };
const dataHora = (v: string | null) => v ? `${v.slice(0, 10).split('-').reverse().join('/')} ${v.slice(11, 16)}` : 'Não registrada';
type Selecao = { destino: string; etapa: EtapaIntegracao; acao: AcaoEtapa; pagina: number };

export default function PendenciasEtapasPanel({ etapas, estado }: { etapas: EtapaOperacional[]; estado: 'carregando' | 'indisponivel' | 'disponivel' }) {
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const grupos = useMemo(() => {
    const mapa = new Map<string, EtapaOperacional[]>();
    for (const e of etapas) mapa.set(e.sistemaDestino, [...(mapa.get(e.sistemaDestino) ?? []), e]);
    return [...mapa].map(([nome, itens]) => ({ nome, itens: itens.sort((a,b) => a.etapa === b.etapa ? 0 : a.etapa === 'DADOS' ? -1 : 1) }))
      .sort((a,b) => Number(b.itens.some(e => e.intervencao > 0)) - Number(a.itens.some(e => e.intervencao > 0)) || a.nome.localeCompare(b.nome));
  }, [etapas]);
  const selecaoVisivel = selecao && estado === 'disponivel' && etapas.some(e => e.sistemaDestino === selecao.destino && e.etapa === selecao.etapa) ? selecao : null;
  const detalhes = useQuery({ ...INTEGRATION_QUERY_POLLING_OPTIONS, queryKey: ['integracoes', 'pendencias-etapas', selecaoVisivel],
    queryFn: ({ signal }) => buscarPendenciasEtapas(selecaoVisivel!.destino, selecaoVisivel!.etapa, selecaoVisivel!.acao, selecaoVisivel!.pagina, signal),
    enabled: !!selecaoVisivel, retry: 1, staleTime: 60_000 });
  return <section aria-label="Pendências atuais por etapa" className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
    <TooltipKpi kpiName="integracoes.saldoPorEtapa"><h2 className="text-sm font-semibold">Pendências atuais por etapa</h2></TooltipKpi>
    <p className="mb-3 mt-1 text-xs text-[var(--color-text-muted)]">Todas as datas, respeitando a integração selecionada. Selecione uma quantidade para consultar os documentos.</p>
    {estado === 'carregando' ? <DashboardLoading label="Carregando pendências" /> : estado === 'indisponivel' ? <p className="text-sm text-[var(--color-text-muted)]">Indicadores indisponíveis.</p>
      : grupos.length === 0 ? <p className="text-sm text-[var(--color-text-muted)]">Nenhuma etapa registrada para a seleção.</p>
        : <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {grupos.map(g => <div key={g.nome} className="min-w-0 rounded-xl border border-[var(--color-border)] p-3">
            <h3 className="mb-2 text-sm font-semibold">{g.nome}</h3>
            <Table className="w-full text-xs"><caption className="sr-only">Pendências de {g.nome}</caption>
              <TableHeader><TableRow isHeaderRow className="border-b border-[var(--color-border)]"><TableHeaderCell scope="col" className="py-2 text-left">Próxima ação</TableHeaderCell>
                {g.itens.map(e => <TableHeaderCell key={e.etapa} scope="col" className="px-1 text-center">{rotuloEtapa(e)}</TableHeaderCell>)}
              </TableRow></TableHeader>
              <TableBody>{(Object.keys(ACOES_ETAPA) as AcaoEtapa[]).map(acao => <TableRow key={acao} className="border-b border-[var(--color-border)] last:border-0">
                <TableHeaderCell scope="row" className="py-2 text-left font-normal">{ACOES_ETAPA[acao]}</TableHeaderCell>
                {g.itens.map(e => <TableCell key={e.etapa} className="px-1 text-center"><DashboardButton type="button" disabled={e[campos[acao]] === 0}
                  aria-label={`Ver ${ACOES_ETAPA[acao]} de ${g.nome} · ${rotuloEtapa(e)}`}
                  onClick={() => setSelecao({ destino: g.nome, etapa: e.etapa, acao, pagina: 0 })}
                  className="tabular-nums">
                  <Badge label={formatarNumero(e[campos[acao]])} variant={e[campos[acao]] === 0 ? 'neutral' : tonsAcao[acao]} />
                </DashboardButton></TableCell>)}
              </TableRow>)}</TableBody>
            </Table>
          </div>)}
        </div>}
    <p className="mt-3 text-xs text-[var(--color-text-muted)]">Uma nota pode aparecer nas duas etapas. A conferir inclui histórico sem confirmação datada ou sem classificação. Timeout exige conferência antes de novo envio.</p>
    {selecaoVisivel && <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">{selecaoVisivel.destino} · {ACOES_ETAPA[selecaoVisivel.acao]}</h3>
        <DashboardButton type="button" onClick={() => setSelecao(null)} className="text-xs underline">Fechar documentos</DashboardButton></div>
      {detalhes.isError ? <p role="alert" className="mt-3 text-sm text-negative">Não foi possível carregar os documentos desta seleção.</p>
        : detalhes.isPending ? <DashboardLoading label="Carregando documentos…" />
          : <><div className="mt-3 overflow-x-auto"><Table className="w-full min-w-[650px] text-left text-xs"><caption className="sr-only">Documentos da pendência selecionada</caption>
            <TableHeader><TableRow isHeaderRow>{['Documento', 'Motivo', 'Acompanhada desde', 'Última avaliação', 'Nova avaliação a partir de'].map(h => <TableHeaderCell key={h} scope="col" className="p-2">{h}</TableHeaderCell>)}</TableRow></TableHeader>
            <TableBody>{detalhes.data.itens.map(i => <TableRow key={`${i.id}:${i.etapa}`} className="border-t border-[var(--color-border)]">
              <TableCell className="p-2">{i.documento}</TableCell><TableCell className="p-2">{motivos[i.motivo] ?? ACOES_ETAPA[i.acao]}</TableCell>
              <TableCell className="p-2">{dataHora(i.pendenteDesde)}</TableCell><TableCell className="p-2">{dataHora(i.ultimaAvaliacao)}</TableCell>
              <TableCell className="p-2">{i.proximaAvaliacao ? dataHora(i.proximaAvaliacao) : 'Sem programação registrada'}</TableCell>
            </TableRow>)}</TableBody>
          </Table></div>{detalhes.data.itens.length === 0 && <p className="text-sm">Nenhum documento nesta seleção.</p>}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-3 text-xs">
            <span>{formatarNumero(detalhes.data.totalElementos)} documentos · página {selecaoVisivel.pagina + 1}</span>
            <DashboardButton type="button" disabled={selecaoVisivel.pagina === 0} onClick={() => setSelecao({ ...selecaoVisivel, pagina: selecaoVisivel.pagina - 1 })} className="disabled:opacity-40">Anterior</DashboardButton>
            <DashboardButton type="button" disabled={(selecaoVisivel.pagina + 1) * 25 >= detalhes.data.totalElementos} onClick={() => setSelecao({ ...selecaoVisivel, pagina: selecaoVisivel.pagina + 1 })} className="disabled:opacity-40">Próxima</DashboardButton>
          </div><p className="mt-2 text-xs text-[var(--color-text-muted)]">Horários de Brasília. A programação indica quando a reavaliação pode ocorrer; não garante envio. A idade anterior ao início do acompanhamento não é inferida.</p></>}
    </div>}
  </section>;
}
