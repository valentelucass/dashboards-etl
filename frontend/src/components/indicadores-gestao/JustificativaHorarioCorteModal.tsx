import { Spinner } from '@astryxdesign/core/Spinner';
import { DashboardTextArea } from "../shared/DashboardTextEntry";
import DashboardButton from "../shared/DashboardButton";
import { useState } from 'react';
import type { FormEvent } from 'react';
import DashboardAdaptiveDialog from '../shared/DashboardAdaptiveDialog';
import { Clock3, Save, Trash2, X } from 'lucide-react';
import type { ViagemJustificativaPayload } from '../../types/indicadoresGestaoAVista';
import { getApiErrorMessage } from '../../utils/apiError';

const FIELD_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

const SECONDARY_BUTTON_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

interface JustificativaHorarioCorteModalProps {
  codSolicitacao: number | null;
  justificativaAtual?: string | null;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ViagemJustificativaPayload) => Promise<void>;
  onDelete?: (codSolicitacao: number) => Promise<void>;
}

interface JustificativaHorarioCorteModalAbertoProps {
  codSolicitacao: number;
  justificativaAtual?: string | null;
  isSubmitting: boolean;
  isDeleting: boolean;
  onClose: () => void;
  onSubmit: (payload: ViagemJustificativaPayload) => Promise<void>;
  onDelete?: (codSolicitacao: number) => Promise<void>;
}

export default function JustificativaHorarioCorteModal({
  codSolicitacao,
  justificativaAtual = null,
  isSubmitting = false,
  isDeleting = false,
  onClose,
  onSubmit,
  onDelete,
}: JustificativaHorarioCorteModalProps) {
  if (codSolicitacao == null) {
    return null;
  }

  return (
    <JustificativaHorarioCorteModalAberto
      key={codSolicitacao}
      codSolicitacao={codSolicitacao}
      justificativaAtual={justificativaAtual}
      isSubmitting={isSubmitting}
      isDeleting={isDeleting}
      onClose={onClose}
      onSubmit={onSubmit}
      onDelete={onDelete}
    />
  );
}

function JustificativaHorarioCorteModalAberto({
  codSolicitacao,
  justificativaAtual,
  isSubmitting,
  isDeleting,
  onClose,
  onSubmit,
  onDelete,
}: JustificativaHorarioCorteModalAbertoProps) {
  const [justificativa, setJustificativa] = useState(justificativaAtual ?? '');
  const [erro, setErro] = useState('');
  const isBusy = isSubmitting || isDeleting;
  const possuiJustificativa = Boolean(justificativaAtual?.trim());

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const texto = justificativa.trim();

    if (!texto) {
      setErro('Informe a justificativa da SM.');
      return;
    }

    try {
      setErro('');
      await onSubmit({ codSolicitacao, justificativa: texto });
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Não foi possível registrar a justificativa.'));
    }
  }

  async function handleDelete() {
    if (!onDelete || !possuiJustificativa) {
      return;
    }

    try {
      setErro('');
      await onDelete(codSolicitacao);
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Não foi possível excluir a justificativa.'));
    }
  }

  return (
    <DashboardAdaptiveDialog label="Justificativa de Horário de Corte" isOpen purpose={isBusy ? 'required' : 'info'}
      width={580} padding={0} onOpenChange={open => { if (!open && !isBusy) onClose(); }}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              <Clock3 size={18} />
              Justificativa de Horário de Corte
            </div>
            <h2 className="mt-1 text-xl font-bold" style={{ color: 'var(--color-text)' }}>
              SM {codSolicitacao}
            </h2>
          </div>

          <DashboardButton
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-xl border p-2 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
            style={SECONDARY_BUTTON_STYLE}
            aria-label="Fechar justificativa"
          >
            <X size={18} />
          </DashboardButton>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
          <div className="block space-y-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Justificativa
            </span>
            <DashboardTextArea label="Justificativa"
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              className="min-h-36 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
              style={FIELD_STYLE}
              maxLength={1000}
              disabled={isBusy}
              required
            />
          </div>

          {erro ? (
            <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
              {erro}
            </p>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            {possuiJustificativa && onDelete ? (
              <DashboardButton
                type="button"
                onClick={() => void handleDelete()}
                disabled={isBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}
              >
                {isDeleting ? <Spinner size="sm" aria-hidden="true" /> : <Trash2 size={16} />}
                Excluir Justificativa
              </DashboardButton>
            ) : <span />}
            <div className="flex flex-wrap justify-end gap-2">
              <DashboardButton
                type="button"
                onClick={onClose}
                disabled={isBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={SECONDARY_BUTTON_STYLE}
              >
                Cancelar
              </DashboardButton>
              <DashboardButton
                type="submit"
                disabled={isBusy}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {isSubmitting ? <Spinner size="sm" aria-hidden="true" /> : <Save size={16} />}
                Salvar
              </DashboardButton>
            </div>
          </div>
        </form>
    </DashboardAdaptiveDialog>
  );
}
