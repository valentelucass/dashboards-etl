import { Card } from '@astryxdesign/core/Card';
import { ProgressBar } from '@astryxdesign/core/ProgressBar';
import { createElement, type CSSProperties, type ReactNode } from 'react';
import { resolveKpiIcon } from './kpiIconResolver';
import { getKpiFlexBasis } from './kpiCardLayout';
import { getGoalToneStyle, goalProgressVariant, type GoalTone } from '../../utils/indicadoresGestaoVistaUi';

interface KpiCardProps {
  label: string;
  valor: string;
  valorClassName?: string;
  valorStyle?: CSSProperties;
  icone?: ReactNode;
  tone?: GoalTone;
  metaLabel?: string;
  metaValue?: string | null;
  helperText?: string | null;
  helperTone?: GoalTone;
  progressPct?: number | null;
  trend?: {
    valor: number;
    direcao: 'up' | 'down' | 'neutral';
  };
  className?: string;
  compact?: boolean;
}

export default function KpiCard({
  label,
  valor,
  valorClassName,
  valorStyle,
  icone,
  tone = 'neutral',
  metaLabel,
  metaValue,
  helperText,
  helperTone,
  progressPct,
  trend,
  className = '',
  compact = false,
}: KpiCardProps) {
  const flexBasis = getKpiFlexBasis(valor);
  const style = getGoalToneStyle(tone);
  const helperStyle = getGoalToneStyle(helperTone ?? tone);
  const secondaryColor = tone === 'neutral' ? 'var(--color-text-subtle)' : style.text;
  const iconNode = icone ?? createElement(resolveKpiIcon(label), { size: 16, 'aria-hidden': 'true' });
  const widthPct = Math.max(0, Math.min(progressPct ?? 0, 100));
  const cardClassName = `dashboard-kpi-card flex min-w-0 flex-col border cursor-default ${compact ? 'gap-0 p-2' : 'gap-1 p-3'} ${className}`;
  const labelClassName = 'text-xs font-medium truncate';
  const defaultValueClassName = 'dashboard-kpi-value font-bold';

  return (
    <Card padding={0}
      className={cardClassName}
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: tone === 'neutral' ? 'var(--color-border)' : style.border,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: `${flexBasis}px`,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span
          className={labelClassName}
          title={label}
          style={{ color: secondaryColor }}
        >
          {label}
        </span>
        {iconNode && (
          <span className="shrink-0" style={{ color: secondaryColor }}>{iconNode}</span>
        )}
      </div>

      <span
        className={valorClassName ?? defaultValueClassName}
        style={valorStyle ?? (valorClassName ? undefined : { color: 'var(--color-text)' })}
        data-long-value={valor.length > 13 || undefined}
      >
        {valor}
      </span>

      {metaLabel && (
        <span className={compact ? 'text-[10px] font-medium leading-none' : 'text-xs font-medium'} style={{ color: 'var(--color-text-subtle)' }}>
          {metaLabel}: <strong style={{ color: secondaryColor }}>{metaValue?.trim() ? metaValue : '—'}</strong>
        </span>
      )}

      {compact && (helperText || progressPct != null) ? (
        <div className="mt-auto flex min-w-0 items-center gap-2 pt-0.5">
          {helperText && (
            <span className="min-w-0 shrink truncate text-[10px] font-medium leading-none" style={{ color: helperStyle.text }}>
              {helperText}
            </span>
          )}
          {progressPct != null && (
            <div className="min-w-10 flex-1">
              <ProgressBar label={`${label}: cobertura da meta`} value={widthPct} variant={goalProgressVariant[tone]} isLabelHidden />
            </div>
          )}
        </div>
      ) : (
        <>
          {helperText && (
            <span className="text-xs font-medium leading-tight" style={{ color: helperStyle.text }}>
              {helperText}
            </span>
          )}

          {progressPct != null && (
            <div className="mt-1">
              <ProgressBar label={`${label}: cobertura da meta`} value={widthPct} variant={goalProgressVariant[tone]} isLabelHidden />
            </div>
          )}
        </>
      )}

      {trend && (
        <span
          className="text-xs font-medium"
          style={{
            color:
              trend.direcao === 'up'
                ? '#16a34a'
                : trend.direcao === 'down'
                  ? '#dc2626'
                  : secondaryColor,
          }}
        >
          {trend.direcao === 'up' ? '▲' : trend.direcao === 'down' ? '▼' : '—'}{' '}
          {Math.abs(trend.valor).toFixed(1)}%
        </span>
      )}
    </Card>
  );
}
