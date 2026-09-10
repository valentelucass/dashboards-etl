import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { AxiosError } from 'axios';
import { Copy, Eye, Save, Trash2 } from 'lucide-react';
import ToastStack from '../../ui/ToastStack';
import type { ToastItem, ToastTone } from '../../ui/ToastStack';
import type { FretesGoalConfig, FretesGoalConfigPayload } from '../../../types/fretes';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatarDataHora, formatarMoeda } from '../../../utils/formatadores';

interface FretesGoalsManagerPanelProps {
  open: boolean;
  branchOptions: string[];
  data?: FretesGoalConfig[];
  ano: number;
  mes: number;
  isLoading: boolean;
  isSaving: boolean;
  error: unknown;
  saveError: unknown;
  replicateError?: unknown;
  isReplicating?: boolean;
  onPeriodChange: (ano: number, mes: number) => void;
  onSave: (payload: FretesGoalConfigPayload) => Promise<void>;
  onRemove: (branchId: string, ano: number, mes: number) => Promise<void>;
  onReplicatePreviousMonth?: (ano: number, mes: number) => Promise<FretesGoalConfig[]>;
  onViewScope?: (branchId: string) => void;
}

const GLOBAL_BRANCH_ID = 'GLOBAL';
const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

function normalizeCurrency(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMetasErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && (!error.response || error.response.status >= 500)) {
    return 'Metas indisponíveis (API offline)';
  }

  return getApiErrorMessage(error, 'Não foi possível carregar as metas de faturamento.');
}

export default function FretesGoalsManagerPanel({
  open,
  branchOptions,
  data,
  ano,
  mes,
  isLoading,
  isSaving,
  error,
  saveError,
  replicateError,
  isReplicating = false,
  onPeriodChange,
  onSave,
  onRemove,
  onReplicatePreviousMonth,
  onViewScope,
}: FretesGoalsManagerPanelProps) {
  const [branchId, setBranchId] = useState(GLOBAL_BRANCH_ID);
  const [metaFaturamentoDraft, setMetaFaturamentoDraft] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const configs = useMemo(() => data ?? [], [data]);
  const configsCadastradas = useMemo(
    () => configs.filter((item) => item.configurado !== false),
    [configs],
  );
  const statusMensagem = useMemo(
    () => configs.find((item) => item.configurado === false)?.mensagem ?? null,
    [configs],
  );
  const configAtual = useMemo(
    () => configsCadastradas.find((item) => item.branchId === branchId) ?? null,
    [branchId, configsCadastradas],
  );
  const selectableBranches = useMemo(
    () => [
      GLOBAL_BRANCH_ID,
      ...Array.from(new Set([...branchOptions, ...configsCadastradas.map((item) => item.branchId)]))
        .filter((item) => item && item !== GLOBAL_BRANCH_ID)
        .sort((left, right) => left.localeCompare(right, 'pt-BR')),
    ],
    [branchOptions, configsCadastradas],
  );
  const anos = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => current - 2 + index);
  }, []);
  const metaFaturamentoValue = metaFaturamentoDraft ?? String(configAtual?.metaFaturamento ?? 0);
  const podeReplicarMetas = configsCadastradas.length === 0 && !isLoading && !error;
  const actionError = saveError ?? replicateError;

  function pushToast(message: string, tone: ToastTone) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 4500);
  }

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave({
      branchId,
      ano,
      mes,
      metaFaturamento: normalizeCurrency(metaFaturamentoValue),
    });
  }

  async function handleReplicarMetas() {
    if (!onReplicatePreviousMonth || !podeReplicarMetas) {
      return;
    }

    try {
      const anoDestino = ano;
      const mesDestino = mes;
      const response = await onReplicatePreviousMonth(anoDestino, mesDestino);
      setMetaFaturamentoDraft(null);
      const total = response.filter((item) => item.configurado !== false).length;
      pushToast(`${total} meta${total === 1 ? '' : 's'} copiada${total === 1 ? '' : 's'} do mês anterior.`, 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Não foi possível copiar as metas do mês anterior.'), 'error');
    }
  }

  return (
    <>
      <section
        className="mb-4 rounded-[20px] border p-5 shadow-sm"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        aria-label="Gerenciamento de metas de faturamento"
      >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Gerenciar Metas
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
            Metas mensais de faturamento por filial.
          </p>
        </div>
        {isLoading ? (
          <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: 'rgba(37, 99, 235, 0.12)', color: '#1d4ed8' }}>
            Carregando metas
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          {getMetasErrorMessage(error)}
        </p>
      ) : null}

      {!error && statusMensagem ? (
        <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg)' }}>
          {statusMensagem}
        </p>
      ) : null}

      {actionError ? (
        <p className="mb-4 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          {getApiErrorMessage(actionError, 'Não foi possível salvar a meta.')}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="fretes-goals-form grid gap-4 rounded-2xl border p-4 lg:grid-cols-[1fr_1fr_minmax(15rem,auto)_1fr_1fr_auto]" style={{ borderColor: 'var(--color-border)' }}>
        <label className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
          Ano
          <select
            value={ano}
            onChange={(event) => {
              setMetaFaturamentoDraft(null);
              onPeriodChange(Number(event.target.value), mes);
            }}
            className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {anos.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
          Mês
          <select
            value={mes}
            onChange={(event) => {
              setMetaFaturamentoDraft(null);
              onPeriodChange(ano, Number(event.target.value));
            }}
            className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
          </select>
        </label>
        {onReplicatePreviousMonth ? (
          <div className="flex min-w-max flex-shrink-0 items-end lg:max-2xl:col-span-2">
            <button
              type="button"
              onClick={() => void handleReplicarMetas()}
              disabled={!podeReplicarMetas || isReplicating}
              title={configsCadastradas.length > 0 ? 'Disponível apenas quando o mês selecionado ainda não possui metas.' : undefined}
              className={`inline-flex h-11 min-w-max flex-shrink-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
              style={{
                backgroundColor: podeReplicarMetas ? 'rgba(37, 99, 235, 0.10)' : 'var(--color-bg)',
                borderColor: podeReplicarMetas ? 'var(--color-primary)' : 'var(--color-border)',
                color: podeReplicarMetas ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <Copy size={15} />
              {isReplicating ? 'Copiando...' : 'Copiar Metas do Mês Anterior'}
            </button>
          </div>
        ) : null}
        <label className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
          Filial
          <select
            value={branchId}
            onChange={(event) => {
              setBranchId(event.target.value);
              setMetaFaturamentoDraft(null);
            }}
            className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {selectableBranches.map((option) => (
              <option key={option} value={option}>{option === GLOBAL_BRANCH_ID ? 'GLOBAL' : option}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
          Meta Faturamento
          <input
            type="number"
            min="0"
            step="0.01"
            value={metaFaturamentoValue}
            onChange={(event) => setMetaFaturamentoDraft(event.target.value)}
            className={`h-11 rounded-xl border px-3 text-sm tabular-nums ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
        </label>
        <div className="flex items-end">
          <div className="flex gap-2">
            {onViewScope ? (
              <button
                type="button"
                onClick={() => onViewScope(branchId)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${FOCUS_RING_CLASS}`}
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                <Eye size={15} />
                Ver dados
              </button>
            ) : null}
            <button
              type="submit"
              disabled={isSaving}
              className={`inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              <Save size={15} />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </form>

      <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Metas cadastradas para {MONTHS.find((item) => item.value === mes)?.label}/{ano}
        </h3>
        <div className="mt-3 grid gap-2">
          {configsCadastradas.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {statusMensagem ?? 'Nenhuma meta cadastrada para este mês.'}
            </p>
          ) : (
            configsCadastradas.map((config) => (
              <div key={`${config.branchId}-${config.ano}-${config.mes}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3 py-3" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{config.branchId}</span>
                    <span className="rounded-full border px-2 py-0.5 text-[11px] font-semibold" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      Fat. {formatarMoeda(config.metaFaturamento)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                    Última atualização: {config.updatedAt ? formatarDataHora(config.updatedAt) : '—'} · {config.updatedByName ?? 'Usuário não identificado'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {onViewScope ? (
                    <button
                      type="button"
                      onClick={() => onViewScope(config.branchId)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold ${FOCUS_RING_CLASS}`}
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                    >
                      <Eye size={13} />
                      Ver dados
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void onRemove(config.branchId, config.ano, config.mes)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                    style={{ borderColor: '#dc2626', color: '#dc2626' }}
                  >
                    <Trash2 size={13} />
                    Remover
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      </section>
      <ToastStack items={toasts} />
    </>
  );
}
