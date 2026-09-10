import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ChevronLeft, ChevronRight, Edit3, RotateCcw, Save, Trash2 } from 'lucide-react';
import {
  KPI_GOAL_INDICATOR_KEYS,
  type KpiGoalBranchOverride,
  type KpiGoalConflictResponse,
  type KpiGoalHistoryAction,
  type KpiGoalHistoryItem,
  type KpiGoalIndicatorKey,
  type KpiGoalsFullResponse,
  type KpiGoalsMap,
} from '../../types/indicadoresGestaoAVista';
import type { PaginacaoResponse } from '../../types/common';
import { GLOBAL_KPI_GOAL_BRANCH_ID } from '../../api/endpoints/indicadoresGestaoAVistaServico';
import { getApiErrorMessage } from '../../utils/apiError';
import { competenciaParaMonthInput, formatarCompetenciaMeta, normalizarCompetenciaApi } from '../../utils/competencia';
import { formatarDataHora } from '../../utils/formatadores';
import './KpiGoalsManagerPanel.css';

interface KpiGoalsManagerPanelProps {
  open: boolean;
  branchId: string;
  competencia: string;
  branchOptions: string[];
  data?: KpiGoalsFullResponse;
  history?: PaginacaoResponse<KpiGoalHistoryItem>;
  historyPage: number;
  isLoading: boolean;
  isHistoryLoading: boolean;
  isSaving: boolean;
  error: unknown;
  saveError: unknown;
  onBranchChange: (branchId: string) => void;
  onCompetenciaChange: (competencia: string) => void;
  onApplyGlobal: (goals: KpiGoalsMap) => Promise<void>;
  onSaveBranch: (branchId: string, goals: KpiGoalsMap) => Promise<void>;
  onRemoveOverride: (branchId: string) => Promise<void>;
  onHistoryPageChange: (page: number) => void;
}

const GOAL_LABELS: Record<KpiGoalIndicatorKey, string> = {
  delivery_performance: 'Performance de Entrega',
  collector_usage: 'Utilização dos Coletores',
  cargo_cubage: 'Cubagem de Mercadorias',
  cargo_indemnity: 'Indenização de Mercadorias',
  cutoff_time: 'Horários de Corte',
};

const GOAL_SHORT_LABELS: Record<KpiGoalIndicatorKey, string> = {
  delivery_performance: 'Entrega',
  collector_usage: 'Coletores',
  cargo_cubage: 'Cubagem',
  cargo_indemnity: 'Indenização',
  cutoff_time: 'Corte',
};

const ACTION_LABELS: Record<KpiGoalHistoryAction, string> = {
  GLOBAL_UPDATE: 'GLOBAL',
  BRANCH_UPDATE: 'FILIAL',
  BRANCH_OVERRIDE_REMOVED: 'FILIAL',
};

const DEFAULT_GOALS: KpiGoalsMap = {
  delivery_performance: 95,
  collector_usage: 90,
  cargo_cubage: 85,
  cargo_indemnity: 2,
  cutoff_time: 98,
};

const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

function cloneGoals(goals?: KpiGoalsMap): KpiGoalsMap {
  return { ...(goals ?? DEFAULT_GOALS) };
}

function normalizeNumber(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(3)) : 0;
}

function formatGoal(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) {
    return '—';
  }
  return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`;
}

function sameGoal(left: number | null | undefined, right: number | null | undefined) {
  return normalizeNumber(Number(left ?? 0)) === normalizeNumber(Number(right ?? 0));
}

function hasDifferences(goals: KpiGoalsMap, globalGoals: KpiGoalsMap) {
  return KPI_GOAL_INDICATOR_KEYS.some((indicatorKey) => !sameGoal(goals[indicatorKey], globalGoals[indicatorKey]));
}

function branchLabel(branchId: string) {
  return branchId === GLOBAL_KPI_GOAL_BRANCH_ID ? 'GLOBAL' : branchId;
}

function goalItems(branch: KpiGoalBranchOverride, globalGoals: KpiGoalsMap) {
  return KPI_GOAL_INDICATOR_KEYS.map((indicatorKey) => ({
    indicatorKey,
    label: `${GOAL_SHORT_LABELS[indicatorKey]} ${formatGoal(branch.goals[indicatorKey])}`,
    isDifferent: !sameGoal(branch.goals[indicatorKey], globalGoals[indicatorKey]),
  }));
}

function conflictBranchesFromError(error: unknown): KpiGoalBranchOverride[] {
  const responseData = (error as { response?: { data?: KpiGoalConflictResponse } } | null)?.response?.data;
  return Array.isArray(responseData?.branches) ? responseData.branches : [];
}

function GoalInputs({
  value,
  globalGoals,
  inheritedMode,
  disabled,
  onChange,
}: {
  value: KpiGoalsMap;
  globalGoals?: KpiGoalsMap;
  inheritedMode?: boolean;
  disabled?: boolean;
  onChange: (goals: KpiGoalsMap) => void;
}) {
  return (
    <div className="kpi-goals-fields">
      {KPI_GOAL_INDICATOR_KEYS.map((indicatorKey) => {
        const isInherited = inheritedMode && globalGoals && sameGoal(value[indicatorKey], globalGoals[indicatorKey]);
        return (
          <label
            key={indicatorKey}
            className="kpi-goals-field"
          >
            <span className="kpi-goals-field-label" style={{ color: 'var(--color-text)' }}>
              {GOAL_LABELS[indicatorKey]}
            </span>
            <div className="kpi-goals-input">
              <input
                type="number"
                min="0"
                max="100"
                step={indicatorKey === 'cargo_indemnity' ? '0.01' : '0.1'}
                value={value[indicatorKey]}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  onChange({
                    ...value,
                    [indicatorKey]: Number.isFinite(nextValue) ? nextValue : 0,
                  });
                }}
                className={`h-10 w-full min-w-0 flex-1 rounded-lg px-3 text-sm tabular-nums ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'transparent', color: 'var(--color-text)' }}
                aria-label={GOAL_LABELS[indicatorKey]}
                disabled={disabled}
              />
              <span aria-hidden="true" className="pr-3 text-sm font-semibold" style={{ color: 'var(--color-text-muted)' }}>%</span>
            </div>
            {globalGoals ? (
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {isInherited ? 'Valor herdado' : 'Meta global'}: {formatGoal(globalGoals[indicatorKey])}
              </span>
            ) : null}
          </label>
        );
      })}
    </div>
  );
}

export default function KpiGoalsManagerPanel({
  open,
  branchId,
  competencia,
  branchOptions,
  data,
  history,
  historyPage,
  isLoading,
  isHistoryLoading,
  isSaving,
  error,
  saveError,
  onBranchChange,
  onCompetenciaChange,
  onApplyGlobal,
  onSaveBranch,
  onRemoveOverride,
  onHistoryPageChange,
}: KpiGoalsManagerPanelProps) {
  const globalGoals = data?.global ?? DEFAULT_GOALS;
  const [globalForm, setGlobalForm] = useState<KpiGoalsMap>(cloneGoals(globalGoals));
  const [branchForm, setBranchForm] = useState<KpiGoalsMap>(cloneGoals(globalGoals));
  const conflictBranches = useMemo(() => conflictBranchesFromError(saveError), [saveError]);
  const branchSpecificBranches = useMemo(() => {
    const byBranch = new Map<string, KpiGoalBranchOverride>();
    for (const branch of data?.branches ?? []) {
      byBranch.set(branch.branchId, branch);
    }
    for (const branch of conflictBranches) {
      if (!byBranch.has(branch.branchId)) {
        byBranch.set(branch.branchId, branch);
      }
    }
    return Array.from(byBranch.values()).sort((left, right) => left.branchId.localeCompare(right.branchId, 'pt-BR'));
  }, [conflictBranches, data?.branches]);

  const branchOverride = useMemo(
    () => branchSpecificBranches.find((branch) => branch.branchId === branchId) ?? null,
    [branchId, branchSpecificBranches],
  );
  const branchEffectiveGoals = branchOverride?.goals ?? globalGoals;
  const selectableBranches = useMemo(() => {
    const options = [
      ...branchOptions,
      ...branchSpecificBranches.map((branch) => branch.branchId),
    ].filter((option) => option && option !== GLOBAL_KPI_GOAL_BRANCH_ID);
    return Array.from(new Set(options)).sort((left, right) => left.localeCompare(right, 'pt-BR'));
  }, [branchOptions, branchSpecificBranches]);
  const historyItems = history?.conteudo ?? [];
  const historyCurrentPage = history?.paginaAtual ?? historyPage;
  const historyTotalPages = history?.totalPaginas ?? 0;
  const historyTotalElements = history?.totalElementos ?? 0;
  const competenciaLabel = formatarCompetenciaMeta(competencia);
  const canEdit = Boolean(data) && !isLoading && !isSaving && !error;

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setGlobalForm(cloneGoals(globalGoals));
  }, [globalGoals, competencia, open]);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBranchForm(cloneGoals(branchEffectiveGoals));
  }, [branchEffectiveGoals, branchId, competencia, open]);

  useEffect(() => {
    if (!open || branchId || selectableBranches.length === 0) return;
    onBranchChange(selectableBranches[0]);
  }, [branchId, onBranchChange, open, selectableBranches]);

  if (!open) {
    return null;
  }

  async function handleGlobalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || branchSpecificBranches.length > 0) {
      return;
    }
    try {
      await onApplyGlobal(globalForm);
    } catch {
      // A mutation already exposes the error through saveError; avoid an unhandled promise in the browser console.
    }
  }

  async function handleBranchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || !branchId) return;
    try {
      await onSaveBranch(branchId, branchForm);
    } catch {
      // A mutation already exposes the error through saveError; avoid an unhandled promise in the browser console.
    }
  }

  async function handleRemoveOverride(selectedBranchId: string) {
    if (!canEdit) return;
    try {
      await onRemoveOverride(selectedBranchId);
    } catch {
      // A mutation already exposes the error through saveError; avoid an unhandled promise in the browser console.
    }
  }

  return (
    <section
      className="kpi-goals-manager mb-5 rounded-[20px] border p-4 sm:p-5 shadow-sm"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
      aria-label="Gerenciamento de metas dos indicadores"
    >
      <div className="kpi-goals-manager-heading">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Gerenciar Metas
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
            Metas globais, exceções por filial e histórico de alterações.
          </p>
        </div>
        <label className="kpi-goals-competencia block space-y-1">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
            Competência
          </span>
          <input
            type="month"
            min="2000-01"
            max="2100-12"
            required
            aria-label="Competência das metas"
            value={competenciaParaMonthInput(competencia)}
            onChange={(event) => onCompetenciaChange(normalizarCompetenciaApi(event.target.value))}
            className={`h-11 w-full rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            disabled={isSaving}
          />
        </label>
        {isLoading ? (
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}>
            Carregando metas
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          {getApiErrorMessage(error, 'Não foi possível carregar as metas.')}
        </p>
      ) : null}

      {saveError ? (
        <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          {getApiErrorMessage(saveError, 'Não foi possível salvar as metas.')}
        </p>
      ) : null}

      <div className="kpi-goals-manager-sections">
        <form onSubmit={handleGlobalSubmit} aria-label="Meta Global" className="kpi-goals-section rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="kpi-goals-section-heading">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Meta Global (aplica em todas as filiais)
              </h3>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(33, 71, 138, 0.12)', color: 'var(--color-primary)' }}>
                {competenciaLabel}
              </span>
            </div>
            <button
              type="submit"
              disabled={!canEdit || branchSpecificBranches.length > 0}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Save size={15} />
              {isSaving ? 'Salvando...' : branchSpecificBranches.length > 0 ? 'Remova metas específicas' : 'Aplicar Meta Global'}
            </button>
          </div>

          <GoalInputs value={globalForm} disabled={!canEdit || branchSpecificBranches.length > 0} onChange={setGlobalForm} />

          {branchSpecificBranches.length > 0 ? (
            <div className="mt-3 rounded-xl border px-3 py-2.5" style={{ borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.10)' }}>
              <p className="text-sm font-semibold" style={{ color: '#92400e' }}>
                Existem {branchSpecificBranches.length} filiais com metas específicas. Para alterar a meta global, remova primeiro todas as metas isoladas por filial na lista abaixo.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {branchSpecificBranches.map((branch) => (
                  <span key={branch.branchId} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: '#f59e0b', color: '#92400e' }}>
                    {branch.branchId}
                    <strong>Meta específica</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </form>

        <form onSubmit={handleBranchSubmit} aria-label="Meta Específica por Filial" className="kpi-goals-section rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="kpi-goals-section-heading">
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Meta Específica por Filial
              </h3>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(33, 71, 138, 0.12)', color: 'var(--color-primary)' }}>
                {competenciaLabel}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
                style={{
                  backgroundColor: branchOverride ? 'rgba(37, 99, 235, 0.12)' : 'rgba(22, 163, 74, 0.12)',
                  color: branchOverride ? '#1d4ed8' : '#15803d',
                }}
              >
                {branchOverride ? 'Meta Específica' : 'Herdando Global'}
              </span>
            </div>
            <div className="kpi-goals-branch-selector">
              <label className="block space-y-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
                  Filial
                </span>
                <select
                  value={branchId}
                  aria-label="Filial das metas"
                  title={branchLabel(branchId)}
                  onChange={(event) => onBranchChange(event.target.value)}
                  className={`h-10 w-full min-w-0 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                  style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  disabled={isSaving}
                >
                  {selectableBranches.length === 0 ? (
                    <option value="">Nenhuma filial disponível</option>
                  ) : null}
                  {selectableBranches.map((option) => (
                    <option key={option} value={option}>
                      {branchLabel(option)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {branchOverride ? (
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() => void handleRemoveOverride(branchId)}
                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                  style={{ borderColor: '#dc2626', color: '#dc2626' }}
                >
                  <Trash2 size={15} />
                  Remover Override
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!canEdit || !branchId}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Save size={15} />
                {isSaving ? 'Salvando...' : 'Salvar Meta para esta Filial'}
              </button>
            </div>
          </div>



          <GoalInputs
            value={branchForm}
            globalGoals={globalGoals}
            inheritedMode
            disabled={!canEdit || !branchId}
            onChange={setBranchForm}
          />

          <div className="kpi-goals-history" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                Histórico de Alterações
                <span className="ml-2 text-xs font-normal" style={{ color: 'var(--color-text-muted)' }}>Todas as competências</span>
              </h4>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {historyTotalElements} registro{historyTotalElements === 1 ? '' : 's'}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-3">
              {isHistoryLoading ? (
                <p className="text-sm lg:col-span-2 2xl:col-span-3" style={{ color: 'var(--color-text-muted)' }}>Carregando histórico...</p>
              ) : historyItems.length === 0 ? (
                <p className="text-sm lg:col-span-2 2xl:col-span-3" style={{ color: 'var(--color-text-muted)' }}>Sem histórico para esta filial.</p>
              ) : (
                historyItems.map((item, index) => (
                  <div
                    key={`${item.updatedAt}-${item.indicatorKey}-${item.competencia}-${index}`}
                    className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-subtle)' }}
                  >
                    <span className="shrink-0 font-semibold" style={{ color: 'var(--color-text)' }}>
                      {item.updatedAt ? formatarDataHora(item.updatedAt) : '—'}
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'rgba(33, 71, 138, 0.10)', color: 'var(--color-primary)' }}>
                      {formatarCompetenciaMeta(item.competencia)}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={`${item.updatedBy?.name ?? 'Usuário não identificado'} · ${GOAL_LABELS[item.indicatorKey]} · ${formatarCompetenciaMeta(item.competencia)}`}>
                      {item.updatedBy?.name ?? 'Usuário não identificado'} · {GOAL_LABELS[item.indicatorKey]}
                    </span>
                    <span className="shrink-0 font-semibold" style={{ color: 'var(--color-text)' }}>
                      {formatGoal(item.oldValue)} → {formatGoal(item.newValue)}
                    </span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: 'rgba(33, 71, 138, 0.12)', color: 'var(--color-primary)' }}>
                      {ACTION_LABELS[item.action]}
                    </span>
                  </div>
                ))
              )}
            </div>
            {historyTotalPages > 1 ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Página {historyCurrentPage} de {historyTotalPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isHistoryLoading || historyCurrentPage <= 1}
                    onClick={() => onHistoryPageChange(Math.max(1, historyCurrentPage - 1))}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    <ChevronLeft size={14} />
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={isHistoryLoading || historyCurrentPage >= historyTotalPages}
                    onClick={() => onHistoryPageChange(Math.min(historyTotalPages, historyCurrentPage + 1))}
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                    style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                  >
                    Próxima
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Filiais com Meta Específica
            </h3>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(33, 71, 138, 0.12)', color: 'var(--color-primary)' }}>
              {competenciaLabel}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {branchSpecificBranches.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nenhuma filial com meta específica cadastrada.
              </p>
            ) : (
              branchSpecificBranches.map((branch) => (
                <div
                  key={branch.branchId}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3"
                  style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold" style={{ color: 'var(--color-text)' }}>
                        {branch.branchId}
                      </span>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}>
                        Meta específica
                      </span>
                      {hasDifferences(branch.goals, globalGoals) ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase" style={{ backgroundColor: 'rgba(245, 158, 11, 0.14)', color: '#92400e' }}>
                          Diverge da global
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {goalItems(branch, globalGoals).map((item) => (
                        <span
                          key={item.indicatorKey}
                          className="rounded-full border px-2 py-1 text-[11px] font-semibold"
                          style={{
                            borderColor: item.isDifferent ? '#f59e0b' : 'var(--color-border)',
                            backgroundColor: item.isDifferent ? 'rgba(245, 158, 11, 0.10)' : 'var(--color-card)',
                            color: item.isDifferent ? '#92400e' : 'var(--color-text-muted)',
                          }}
                        >
                          {item.label}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                      {formatarCompetenciaMeta(branch.competencia)} · Última atualização: {branch.updatedAt ? formatarDataHora(branch.updatedAt) : '—'} · {branch.updatedBy?.name ?? 'Usuário não identificado'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => onBranchChange(branch.branchId)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${FOCUS_RING_CLASS}`}
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <Edit3 size={13} />
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={!canEdit}
                      onClick={() => void handleRemoveOverride(branch.branchId)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                      style={{ borderColor: '#dc2626', color: '#dc2626' }}
                    >
                      <RotateCcw size={13} />
                      Remover Override
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
