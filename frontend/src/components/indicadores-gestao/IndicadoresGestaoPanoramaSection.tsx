import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import type { KpiDefinition } from '../../constants/kpiDictionary';
import { getGoalToneStyle, type GoalTone } from '../../utils/indicadoresGestaoVistaUi';
import TooltipKpi from '../shared/TooltipKpi';
import './IndicadoresGestaoOverview.css';

export interface PanoramaOperacionalItem {
  id: string;
  definition: KpiDefinition;
  title: string;
  value: string;
  statusLabel: string;
  tone: GoalTone;
  progressPct?: number | null;
  detail: string;
  alertDetail?: string;
  severityScore?: number;
  icon?: ReactNode;
}

interface IndicadoresGestaoPanoramaSectionProps {
  title?: string;
  description?: string;
  items: PanoramaOperacionalItem[];
}

function formatarProgresso(progressPct?: number | null): string {
  if (progressPct == null) {
    return '—';
  }
  const valor = Math.max(0, Math.min(progressPct, 100));
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: valor % 1 === 0 ? 0 : 1 })}%`;
}

export default function IndicadoresGestaoPanoramaSection({
  title = 'Panorama Operacional',
  description = 'Cobertura das metas e prioridades para direcionar a operação.',
  items,
}: IndicadoresGestaoPanoramaSectionProps) {
  const alertItems = items
    .filter((item) => item.tone === 'warning' || item.tone === 'negative')
    .sort((left, right) => (right.severityScore ?? 0) - (left.severityScore ?? 0)
      || (left.progressPct ?? 100) - (right.progressPct ?? 100)
      || left.title.localeCompare(right.title))
    .slice(0, 3);
  const allGoalsMet = items.length > 0 && items.every((item) => item.tone === 'positive');
  const positiveStyle = getGoalToneStyle('positive');

  return (
    <section aria-label={title} className="gestao-panorama">
      <header className="gestao-panorama-heading">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="gestao-panorama-reference">100% de cobertura = meta atendida</span>
      </header>

      <div className="gestao-panorama-body">
        <div className="gestao-comparison" aria-label="Comparativo de cobertura das metas">
          <div className="gestao-comparison-heading">
            <h3>Cobertura da meta</h3>
            <span>Referência 100%</span>
          </div>
          <div className="gestao-comparison-lanes">
            {items.map((item) => {
              const style = getGoalToneStyle(item.tone);
              const progressPct = Math.max(0, Math.min(item.progressPct ?? 0, 100));

              return (
                <TooltipKpi key={item.id} definition={item.definition} className="w-full" style={{ flex: '0 0 auto' }}>
                  <article className="gestao-comparison-lane" data-tone={item.tone}>
                    <div className="gestao-lane-heading">
                      <h4>
                        {item.icon ? <span aria-hidden="true" style={{ color: style.text }}>{item.icon}</span> : null}
                        {item.title}
                      </h4>
                      <strong style={{ color: style.text }}>{formatarProgresso(item.progressPct)}</strong>
                    </div>
                    {item.progressPct != null ? (
                      <div
                        className="gestao-goal-track gestao-comparison-track"
                        role="progressbar"
                        aria-label={item.title + ': cobertura da meta'}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={progressPct}
                        style={{ backgroundColor: style.track }}
                      >
                        <div className="h-full rounded-full" style={{ width: progressPct + '%', backgroundColor: style.fill }} />
                      </div>
                    ) : null}
                    <div className="gestao-lane-detail">
                      <span>{item.detail}</span>
                      <span className="gestao-lane-status" style={{ color: style.text }}>{item.statusLabel}</span>
                    </div>
                    <span className="sr-only">Resultado atual: {item.value}</span>
                  </article>
                </TooltipKpi>
              );
            })}
          </div>
        </div>

        <aside className="gestao-attention" aria-label="Atenções do Período">
          <header className="gestao-attention-heading">
            <h3>Atenções do Período</h3>
            <p>Prioridade pelos maiores gaps relativos à meta.</p>
          </header>
          {alertItems.length > 0 ? (
            <ol className="gestao-attention-list">
              {alertItems.map((item, index) => {
                const style = getGoalToneStyle(item.tone);
                return (
                  <li key={item.id + '-attention'} className="gestao-attention-item" style={{ borderColor: style.border }}>
                    <div className="gestao-attention-order">
                      <span className="gestao-attention-rank" aria-label={'Prioridade ' + (index + 1)} style={{ color: style.text }}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="gestao-goal-badge" style={{ backgroundColor: style.badgeBg, color: style.badgeText }}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    <p>{item.alertDetail ?? item.detail}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <div className="gestao-attention-empty">
              {allGoalsMet ? (
                <>
                  <CircleCheck size={40} aria-hidden="true" style={{ color: positiveStyle.text }} />
                  <strong style={{ color: positiveStyle.text }}>Todas as metas atendidas</strong>
                </>
              ) : <span aria-hidden="true">—</span>}
              <p>Nenhum alerta crítico no período.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
