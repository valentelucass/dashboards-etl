import { Fragment, useMemo } from 'react';
import { Building2 } from 'lucide-react';
import type { IndicadorEtapa } from '../../../api/endpoints/integracoesEtapas';
import { formatarNumero } from '../../../utils/formatadores';
import { rotuloEtapa } from '../../../utils/integracoesEtapas';
import TooltipKpi from '../../shared/TooltipKpi';
import TableHeaderTooltip from '../../shared/TableHeaderTooltip';
import { COLUNAS_PENDENCIAS_INTEGRACOES } from '../../../constants/kpiDictionary';

const SITUACOES = {
  bloqueado: { label: 'Com bloqueios', classe: 'bg-[var(--color-negative-badge-bg)] text-[var(--color-negative-text)]' },
  pendente: { label: 'Com pendências', classe: 'bg-[var(--color-warning-badge-bg)] text-[var(--color-warning-badge-text)]' },
  conferir: { label: 'A conferir', classe: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  regular: { label: 'Sem pendências', classe: 'bg-[var(--color-positive-badge-bg)] text-[var(--color-positive-text)]' },
} as const;

function prioridade(etapas: IndicadorEtapa[]) {
  if (etapas.some(item => item.bloqueadosAtuais > 0)) return 0;
  if (etapas.some(item => item.pendentesAtuais > 0)) return 1;
  if (etapas.some(item => item.semConfirmacaoDatada > 0)) return 2;
  return 3;
}

function Quantidade({ valor, situacao }: { valor: number; situacao: 'pendente' | 'bloqueado' | 'conferir' }) {
  return (
    <span className={`inline-flex min-w-8 items-center justify-center rounded-md px-1.5 py-1 text-xs tabular-nums ${
      valor > 0 ? `font-semibold ${SITUACOES[situacao].classe}` : 'text-[var(--color-text-muted)]'
    }`}>
      {formatarNumero(valor)}
    </span>
  );
}

export default function PendenciasEtapasPanel({ etapas, estado }: {
  etapas: IndicadorEtapa[];
  estado: 'carregando' | 'indisponivel' | 'disponivel';
}) {
  const grupos = useMemo(() => {
    const porIntegracao = new Map<string, IndicadorEtapa[]>();
    for (const etapa of etapas) {
      const grupo = porIntegracao.get(etapa.sistemaDestino) ?? [];
      grupo.push(etapa);
      porIntegracao.set(etapa.sistemaDestino, grupo);
    }
    return [...porIntegracao].map(([integracao, itens]) => ({
      integracao,
      itens: [...itens].sort((a, b) => a.etapa === b.etapa ? 0 : a.etapa === 'DADOS' ? -1 : 1),
      prioridade: prioridade(itens),
    })).sort((a, b) => a.prioridade - b.prioridade || a.integracao.localeCompare(b.integracao));
  }, [etapas]);

  return (
    <section aria-label="Pendências atuais por etapa"
      className={`mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:p-4 ${
        estado === 'disponivel' && grupos.length === 1 ? 'max-w-3xl' : ''
      }`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <TooltipKpi kpiName="integracoes.saldoPorEtapa">
            <h2 className="text-sm font-semibold">Pendências atuais por etapa</h2>
          </TooltipKpi>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Todas as datas, respeitando a integração selecionada.
          </p>
        </div>
        {estado === 'disponivel' && grupos.length > 1 && (
          <span className="rounded-md bg-[var(--color-bg)] px-2 py-1 text-[11px] text-[var(--color-text-muted)]">
            Bloqueios primeiro
          </span>
        )}
      </div>

      {estado !== 'disponivel' ? (
        <p className="py-3 text-sm text-[var(--color-text-muted)]">
          {estado === 'carregando' ? 'Carregando…' : 'Indicadores indisponíveis.'}
        </p>
      ) : grupos.length === 0 ? (
        <p className="py-3 text-sm text-[var(--color-text-muted)]">Nenhuma etapa registrada para a seleção.</p>
      ) : (
        <div className="grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr))]">
          {grupos.map(grupo => {
            const situacao = [SITUACOES.bloqueado, SITUACOES.pendente, SITUACOES.conferir, SITUACOES.regular][grupo.prioridade];
            return (
              <div key={grupo.integracao} className="min-w-0 overflow-hidden rounded-xl border border-[var(--color-border)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 px-3 py-2.5">
                  <h3 className="flex min-w-0 items-center gap-2 text-xs font-bold tracking-wide">
                    <Building2 size={14} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                    {grupo.integracao}
                  </h3>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${situacao.classe}`}>
                    {situacao.label}
                  </span>
                </div>
                <table className="w-full table-fixed text-xs">
                  <caption className="sr-only">Pendências de {grupo.integracao}</caption>
                  <colgroup><col className="w-[34%]" /><col className="w-[22%]" /><col className="w-[22%]" /><col className="w-[22%]" /></colgroup>
                  <thead className="text-[10px] text-[var(--color-text-muted)]">
                    <tr className="border-b border-[var(--color-border)]">
                      {Object.entries(COLUNAS_PENDENCIAS_INTEGRACOES).map(([chave, coluna]) => (
                        <th key={chave} scope="col"
                          className={`py-1 font-medium ${chave === 'etapa' ? 'px-3 text-left' : 'px-1 text-center'}`}>
                          <TableHeaderTooltip label={coluna.label} content={coluna.descricao} trigger="label" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.itens.map(item => (
                      <tr key={item.etapa} className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg)]/60">
                        <th scope="row" className="break-words px-3 py-2.5 text-left font-medium leading-snug">
                          {rotuloEtapa(item).split('/').map((parte, indice) => (
                            <Fragment key={indice}>{indice > 0 && <>/<wbr /></>}{parte}</Fragment>
                          ))}
                        </th>
                        <td className="px-1 py-1.5 text-center"><Quantidade valor={item.pendentesAtuais} situacao="pendente" /></td>
                        <td className="px-1 py-1.5 text-center"><Quantidade valor={item.bloqueadosAtuais} situacao="bloqueado" /></td>
                        <td className="px-1 py-1.5 text-center"><Quantidade valor={item.semConfirmacaoDatada} situacao="conferir" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
        Uma nota pode ter pendência nas duas etapas. A conferir: registros sem confirmação datada ou sem classificação.
      </p>
    </section>
  );
}
