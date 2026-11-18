import DashboardButton from "../shared/DashboardButton";
import { SlidersHorizontal, X } from 'lucide-react';
import type {
  KpiGoalIndicatorKey,
  KpiGoalIndicatorOverride,
} from '../../types/indicadoresGestaoAVista';

interface BranchGoalOverridesBannerProps {
  indicatorKey: KpiGoalIndicatorKey;
  globalGoal: number;
  overrides?: KpiGoalIndicatorOverride[];
  selectedBranch?: string | null;
  onSelectBranch: (branchId: string) => void;
  onClearFilter: () => void;
}

const LABELS: Record<KpiGoalIndicatorKey, string> = {
  delivery_performance: 'Meta',
  collector_usage: 'Meta',
  cargo_cubage: 'Meta',
  cargo_indemnity: 'Limite',
  cutoff_time: 'Meta',
};

function formatGoal(value: number) {
  return value.toLocaleString('pt-BR', {
    maximumFractionDigits: 3,
  });
}

function shortBranchName(value: string) {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(' - ');
  return separator > 0 ? trimmed.slice(0, separator) : trimmed;
}

export default function BranchGoalOverridesBanner({
  indicatorKey,
  globalGoal,
  overrides,
  selectedBranch,
  onSelectBranch,
  onClearFilter,
}: BranchGoalOverridesBannerProps) {
  const branchOverrides = overrides ?? [];

  if (branchOverrides.length === 0) {
    return null;
  }

  const label = LABELS[indicatorKey];

  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ backgroundColor: 'rgba(33, 71, 138, 0.08)', borderColor: 'rgba(33, 71, 138, 0.22)' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
        >
          <SlidersHorizontal size={12} />
          Metas específicas cadastradas
        </span>
        <span className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
          {branchOverrides.length} filiais possuem meta específica para este indicador
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {branchOverrides.map((override) => {
          const active = selectedBranch === override.branchId || selectedBranch === override.branchName;
          const differsFromGlobal = Number(override.goalValue) !== Number(globalGoal);
          return (
            <DashboardButton
              key={`${override.branchId}-${override.goalValue}`}
              type="button"
              onClick={() => onSelectBranch(override.branchId)}
              className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              style={{
                borderColor: active ? 'var(--color-primary)' : 'var(--color-border)',
                backgroundColor: active ? 'rgba(33, 71, 138, 0.14)' : 'var(--color-bg)',
                color: active ? 'var(--color-primary)' : 'var(--color-text)',
              }}
            >
              {shortBranchName(override.branchName || override.branchId)} · {label} {formatGoal(override.goalValue)}%
              {differsFromGlobal ? '' : ' · igual à global atual'}
            </DashboardButton>
          );
        })}
        {selectedBranch ? (
          <DashboardButton
            type="button"
            onClick={onClearFilter}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--color-card)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <X size={12} />
            Limpar filtro
          </DashboardButton>
        ) : null}
      </div>
    </div>
  );
}
