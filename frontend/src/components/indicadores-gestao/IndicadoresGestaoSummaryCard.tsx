import type { ReactNode } from 'react';
import type { KpiDefinition } from '../../constants/kpiDictionary';
import { getGoalToneStyle, type GoalTone } from '../../utils/indicadoresGestaoVistaUi';
import TooltipKpi from '../shared/TooltipKpi';
import './IndicadoresGestaoOverview.css';

interface IndicadoresGestaoSummaryCardProps {
  definition: KpiDefinition;
  title: string;
  description: string;
  value: string;
  detail: string;
  goalLabel: string;
  statusLabel: string;
  tone: GoalTone;
  progressPct?: number | null;
  icon?: ReactNode;
}

export default function IndicadoresGestaoSummaryCard({
  definition,
  title,
  description,
  value,
  detail,
  goalLabel,
  statusLabel,
  tone,
  progressPct,
  icon,
}: IndicadoresGestaoSummaryCardProps) {
  const style = getGoalToneStyle(tone);
  const widthPct = Math.max(0, Math.min(progressPct ?? 0, 100));

  return (
    <TooltipKpi definition={definition} className="h-full">
      <article
        className="gestao-scorecard"
        data-tone={tone}
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: tone === 'neutral' ? 'var(--color-border)' : style.border,
        }}
      >
        <header className="gestao-scorecard-heading">
          <h3>{title}</h3>
          {icon ? <span className="gestao-scorecard-icon" aria-hidden="true" style={{ backgroundColor: style.badgeBg, color: style.text }}>{icon}</span> : null}
        </header>
        <p className="sr-only">{description}</p>

        <strong className="gestao-scorecard-value">{value}</strong>

        <div className="gestao-scorecard-state">
          <span
            className="gestao-goal-badge"
            style={{ backgroundColor: style.badgeBg, color: style.badgeText }}
          >
            {statusLabel}
          </span>
          <span className="gestao-scorecard-goal">{goalLabel}</span>
        </div>
        <div className="gestao-scorecard-detail">
          {detail}
        </div>
        {progressPct != null ? (
          <div className="gestao-scorecard-coverage">
            <div className="mb-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
              <span>Cobertura da meta</span>
              <span>{widthPct.toLocaleString('pt-BR', { maximumFractionDigits: widthPct % 1 === 0 ? 0 : 1 })}%</span>
            </div>
            <div className="gestao-goal-track" role="progressbar" aria-label={`${title}: cobertura da meta`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={widthPct} style={{ backgroundColor: style.track }}>
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${widthPct}%`, backgroundColor: style.fill }} />
            </div>
          </div>
        ) : null}
      </article>
    </TooltipKpi>
  );
}
