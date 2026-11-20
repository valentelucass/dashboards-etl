import HeaderPanelContent from '../../shared/HeaderPanelContent';
import DashboardLoading from '../../shared/DashboardLoading';
import { DashboardInput } from "../../shared/DashboardTextEntry";
import DashboardSelector from "../../shared/DashboardSelector";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, TableText } from '../../shared/DashboardTable';
import DashboardButton from "../../shared/DashboardButton";
import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AxiosError } from 'axios';
import { Copy, Download, FileSpreadsheet, Save, Trash2 } from 'lucide-react';
import { useFiliais, useManifestosClassificacoes } from '../../../hooks/queries/useDimensoes';
import {
  useBaixarTemplateManifestosMetas,
  useDeleteManifestosMeta,
  useManifestosMetas,
  useReplicarManifestosMetasConfiguracoes,
  useSaveManifestosMeta,
} from '../../../hooks/queries/useManifestos';
import ToastStack from '../../ui/ToastStack';
import type { ToastItem, ToastTone } from '../../ui/ToastStack';
import type { ManifestosCostGoalConfig } from '../../../types/manifestos';
import { getApiErrorMessage } from '../../../utils/apiError';
import { isParceiroLogistico } from '../../../utils/filiais';
import { formatarDataHora, formatarMoeda } from '../../../utils/formatadores';
import ManifestosMetasImportacaoModal from './ManifestosMetasImportacaoModal';

interface ManifestosCostGoalsPanelProps {
  open: boolean;
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
const CONTRACT_TYPE_OPTIONS = [
  { value: 'GERAL', label: 'GERAL' },
  { value: 'FROTA', label: 'FROTA' },
  { value: 'AGREGADO', label: 'AGREGADO' },
  { value: 'TERCEIRO', label: 'TERCEIRO' },
  { value: 'FROTA + PX', label: 'FROTA + PX' },
];
const GENERAL_CLASSIFICATION_KEY = '__geral__';
const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';
const BRANCH_CODE_PATTERN = /^[A-Z0-9]{3}$/;

interface BranchOption {
  value: string;
  label: string;
}

function normalizeCurrency(value: string) {
  const normalized = value
    .trim()
    .replace(/[^\d,.]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getMetasErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && (!error.response || error.response.status >= 500)) {
    return 'Metas indisponíveis (API offline)';
  }

  return getApiErrorMessage(error, 'Não foi possível carregar as metas de custo operacional.');
}

function getCurrentPeriod() {
  const now = new Date();
  return {
    ano: now.getFullYear(),
    mes: now.getMonth() + 1,
  };
}

function normalizeKey(value: string | null | undefined, fallback = '') {
  const normalized = value?.trim().toUpperCase() ?? '';
  return normalized || fallback;
}

function extractBranchCode(value: string | null | undefined) {
  const normalized = normalizeKey(value);
  if (!normalized || normalized === GLOBAL_BRANCH_ID || isParceiroLogistico(normalized)) {
    return normalized === GLOBAL_BRANCH_ID ? GLOBAL_BRANCH_ID : null;
  }

  const segments = normalized.split(/\s*[-|]\s*/).filter(Boolean);
  const words = normalized.split(/\s+/).filter(Boolean);
  const candidates = [
    normalized,
    segments[0],
    segments.at(-1),
    words[0],
    words.at(-1),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return candidates.find((candidate) => BRANCH_CODE_PATTERN.test(candidate)) ?? null;
}

function branchLabel(value: string, label?: string | null) {
  const normalizedLabel = normalizeKey(label);
  if (!normalizedLabel || normalizedLabel === value) {
    return value;
  }
  return normalizedLabel;
}

function getConfigBranchKey(config: ManifestosCostGoalConfig) {
  const code = extractBranchCode(config.branchId);
  return code ?? normalizeKey(config.branchId, GLOBAL_BRANCH_ID);
}

function formatGoalCurrency(value: number) {
  return formatarMoeda(Math.round(Number(value ?? 0) * 100) / 100);
}

function getConfigContractTypeKey(config: ManifestosCostGoalConfig) {
  return normalizeKey(config.contractTypeKey ?? config.contractType, 'GERAL');
}

function getConfigContractTypeLabel(config: ManifestosCostGoalConfig) {
  return normalizeKey(
    config.contractType,
    CONTRACT_TYPE_OPTIONS.find((option) => option.value === getConfigContractTypeKey(config))?.label ?? 'GERAL',
  );
}

function getConfigClassificationKey(config: ManifestosCostGoalConfig) {
  return normalizeKey(config.classificationKey) || GENERAL_CLASSIFICATION_KEY;
}

function getConfigClassificationLabel(config: ManifestosCostGoalConfig) {
  return normalizeKey(config.classificationKey, 'GERAL');
}

function getConfigRowKey(config: ManifestosCostGoalConfig) {
  if (config.id != null) {
    return `meta-${config.id}`;
  }

  return [
    'meta-fallback',
    getConfigBranchKey(config),
    config.ano,
    config.mes,
    getConfigContractTypeKey(config),
    getConfigClassificationKey(config),
  ].join('-');
}

function getClassificationPayload(value: string) {
  return value === GENERAL_CLASSIFICATION_KEY ? null : normalizeKey(value);
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function ManifestosCostGoalsPanel({ open }: ManifestosCostGoalsPanelProps) {
  const periodoAtual = useMemo(() => getCurrentPeriod(), []);
  const [ano, setAno] = useState(periodoAtual.ano);
  const [mes, setMes] = useState(periodoAtual.mes);
  const [branchId, setBranchId] = useState('');
  const [contractTypeKey, setContractTypeKey] = useState('GERAL');
  const [classificationKey, setClassificationKey] = useState(GENERAL_CLASSIFICATION_KEY);
  const [costGoalDraft, setCostGoalDraft] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastIdRef = useRef(0);

  const filiais = useFiliais();
  const branchOptions = useMemo<BranchOption[]>(() => {
    const options = new Map<string, BranchOption>();

    function upsert(value: string, label?: string | null) {
      if (!value || value === GLOBAL_BRANCH_ID) {
        return;
      }
      const next = { value, label: branchLabel(value, label) };
      const current = options.get(value);
      if (!current || current.label === value) {
        options.set(value, next);
      }
    }

    (filiais.data ?? []).forEach((filial) => {
      if (isParceiroLogistico(filial)) {
        return;
      }
      const code = extractBranchCode(filial);
      if (code) {
        upsert(code, filial);
      }
    });

    return Array.from(options.values())
      .filter((option) => option.value)
      .sort((left, right) => left.value.localeCompare(right.value, 'pt-BR'));
  }, [filiais.data]);
  const selectedBranchId = branchId || (branchOptions[0]?.value ?? '');
  const metas = useManifestosMetas(selectedBranchId, ano, mes, open && Boolean(selectedBranchId));
  const isLoading = metas.isLoading;
  const error = metas.error;
  const filtroClassificacoes = useMemo(() => ({
    dataInicio: formatDate(ano, mes, 1),
    dataFim: formatDate(ano, mes, new Date(ano, mes, 0).getDate()),
  }), [ano, mes]);
  const classificacoes = useManifestosClassificacoes(filtroClassificacoes);
  const salvarMeta = useSaveManifestosMeta();
  const removerMeta = useDeleteManifestosMeta();
  const baixarTemplate = useBaixarTemplateManifestosMetas();
  const replicarMetas = useReplicarManifestosMetasConfiguracoes();
  const isSaving = salvarMeta.isPending || removerMeta.isPending || baixarTemplate.isPending || replicarMetas.isPending;
  const saveError = salvarMeta.error ?? removerMeta.error ?? baixarTemplate.error;
  const configs = useMemo(() => metas.data ?? [], [metas.data]);
  const configsCadastradas = useMemo(
    () => configs.filter((item) => item.configurado !== false),
    [configs],
  );
  const statusMensagem = useMemo(
    () => configs.find((item) => item.configurado === false)?.mensagem ?? null,
    [configs],
  );
  const contractTypeOptions = useMemo(() => {
    const options = new Map(CONTRACT_TYPE_OPTIONS.map((option) => [option.value, option]));
    configsCadastradas.forEach((config) => {
      const key = getConfigContractTypeKey(config);
      if (!options.has(key)) {
        options.set(key, { value: key, label: getConfigContractTypeLabel(config) });
      }
    });
    return Array.from(options.values());
  }, [configsCadastradas]);
  const classificationOptions = useMemo(() => {
    const options = new Map<string, { value: string; label: string }>();
    options.set(GENERAL_CLASSIFICATION_KEY, { value: GENERAL_CLASSIFICATION_KEY, label: 'GERAL' });

    (classificacoes.data ?? []).forEach((classificacao) => {
      const value = normalizeKey(classificacao);
      if (value && !options.has(value)) {
        options.set(value, { value, label: value });
      }
    });

    configsCadastradas.forEach((config) => {
      const value = getConfigClassificationKey(config);
      if (!options.has(value)) {
        options.set(value, { value, label: getConfigClassificationLabel(config) });
      }
    });

    return Array.from(options.values());
  }, [classificacoes.data, configsCadastradas]);
  const configAtual = useMemo(
    () => configsCadastradas.find((item) =>
      getConfigBranchKey(item) === selectedBranchId
      && getConfigContractTypeKey(item) === contractTypeKey
      && getConfigClassificationKey(item) === classificationKey
    ) ?? null,
    [selectedBranchId, classificationKey, contractTypeKey, configsCadastradas],
  );
  const anos = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, index) => current - 2 + index);
  }, []);
  const selectedContractType = contractTypeOptions.find((option) => option.value === contractTypeKey) ?? CONTRACT_TYPE_OPTIONS[0];
  const selectedClassification = classificationOptions.find((option) => option.value === classificationKey)
    ?? classificationOptions[0]
    ?? { value: GENERAL_CLASSIFICATION_KEY, label: 'GERAL' };
  const costGoalValue = costGoalDraft ?? String(configAtual?.costGoal ?? 0);
  const podeReplicarMetas = configsCadastradas.length === 0 && !isLoading && !error;
  const actionError = saveError ?? replicarMetas.error;
  const configsDaFilialSelecionada = useMemo(
    () => configsCadastradas
      .filter((config) => getConfigBranchKey(config) === selectedBranchId)
      .sort((left, right) => {
        const contrato = getConfigContractTypeLabel(left).localeCompare(getConfigContractTypeLabel(right), 'pt-BR');
        if (contrato !== 0) {
          return contrato;
        }
        return getConfigClassificationLabel(left).localeCompare(getConfigClassificationLabel(right), 'pt-BR');
      }),
    [selectedBranchId, configsCadastradas],
  );
  const selectedBranchLabel = branchOptions.find((option) => option.value === selectedBranchId)?.label ?? selectedBranchId;
  const selectedBranchInOptions = branchOptions.some((option) => option.value === selectedBranchId);

  function pushToast(message: string, tone: ToastTone) {
    toastIdRef.current += 1;
    const id = `manifestos-cost-goal-${toastIdRef.current}`;
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
    if (!selectedBranchId) {
      return;
    }

    try {
      await salvarMeta.mutateAsync({
        branchId: selectedBranchId,
        contractType: selectedContractType.label,
        contractTypeKey: selectedContractType.value,
        classificationKey: getClassificationPayload(selectedClassification.value),
        ano,
        mes,
        costGoal: normalizeCurrency(costGoalValue),
      });
      setCostGoalDraft(null);
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Não foi possível salvar a meta.'), 'error');
    }
  }

  async function handleRemove(config: ManifestosCostGoalConfig) {
    if (removerMeta.isPending) {
      return;
    }

    try {
      await removerMeta.mutateAsync({
        branchId: getConfigBranchKey(config),
        contractTypeKey: getConfigContractTypeKey(config),
        classificationKey: getClassificationPayload(getConfigClassificationKey(config)),
        ano: config.ano,
        mes: config.mes,
      });
      if (
        getConfigBranchKey(config) === selectedBranchId
        && getConfigContractTypeKey(config) === contractTypeKey
        && getConfigClassificationKey(config) === classificationKey
      ) {
        setCostGoalDraft(null);
      }
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Não foi possível remover a meta.'), 'error');
    }
  }

  async function handleBaixarTemplate() {
    try {
      await baixarTemplate.mutateAsync();
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Não foi possível baixar o modelo de importação.'), 'error');
    }
  }

  async function handleReplicarMetas() {
    if (!podeReplicarMetas) {
      return;
    }

    try {
      const response = await replicarMetas.mutateAsync({ ano, mes });
      setCostGoalDraft(null);
      const total = response.filter((item) => item.configurado !== false).length;
      pushToast(`${total} meta${total === 1 ? '' : 's'} copiada${total === 1 ? '' : 's'} do mês anterior.`, 'success');
    } catch (err) {
      pushToast(getApiErrorMessage(err, 'Não foi possível copiar as metas do mês anterior.'), 'error');
    }
  }

  return (
    <HeaderPanelContent>
      <section
        className="mb-4 rounded-[20px] border p-5 shadow-sm"
        style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
        aria-label="Gerenciamento de orçamento de custo operacional"
      >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
            Gerenciar Orçamento de Custo Operacional
          </h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
            Metas mensais de custo operacional por filial, tipo de contrato e classificação.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex min-w-max flex-shrink-0 items-end">
            <DashboardButton
              type="button"
              onClick={() => void handleReplicarMetas()}
              disabled={!podeReplicarMetas || replicarMetas.isPending}
              title={configsCadastradas.length > 0 ? 'Disponível apenas quando o mês selecionado ainda não possui metas.' : undefined}
              className={`inline-flex h-11 min-w-max flex-shrink-0 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
              style={{
                backgroundColor: podeReplicarMetas ? 'rgba(37, 99, 235, 0.10)' : 'var(--color-bg)',
                borderColor: podeReplicarMetas ? 'var(--color-primary)' : 'var(--color-border)',
                color: podeReplicarMetas ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              <Copy size={15} />
              {replicarMetas.isPending ? 'Copiando...' : 'Copiar Metas do Mês Anterior'}
            </DashboardButton>
          </div>
          <DashboardButton
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <FileSpreadsheet size={15} />
            Importar Planilha de Metas
          </DashboardButton>
          <DashboardButton
            type="button"
            onClick={() => void handleBaixarTemplate()}
            disabled={baixarTemplate.isPending}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            <Download size={15} />
            {baixarTemplate.isPending ? 'Baixando...' : 'Baixar Planilha Modelo'}
          </DashboardButton>
          {isLoading ? (
            <DashboardLoading label="Carregando metas" />
          ) : null}
        </div>
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

          <div className="grid gap-4 rounded-2xl border p-4 md:grid-cols-[1fr_0.8fr_1.6fr]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Mês
              <DashboardSelector label="Mês"
                value={mes}
                onValueChange={selectedValue => {
                  setCostGoalDraft(null);
                  setMes(Number(selectedValue));
                }}
                className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {MONTHS.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
              </DashboardSelector>
            </div>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Ano
              <DashboardSelector label="Ano"
                value={ano}
                onValueChange={selectedValue => {
                  setCostGoalDraft(null);
                  setAno(Number(selectedValue));
                }}
                className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {anos.map((year) => <option key={year} value={year}>{year}</option>)}
              </DashboardSelector>
            </div>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Filial
              <DashboardSelector label="Filial"
                value={selectedBranchId}
                onValueChange={selectedValue => {
                  setBranchId(selectedValue);
                  setCostGoalDraft(null);
                }}
                className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {!selectedBranchId ? (
                  <option key="branch-placeholder" value="">
                    Selecione uma filial
                  </option>
                ) : null}
                {selectedBranchId && !selectedBranchInOptions ? (
                  <option key={`branch-selected-${selectedBranchId}`} value={selectedBranchId}>
                    {selectedBranchLabel}
                  </option>
                ) : null}
                {branchOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </DashboardSelector>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 rounded-2xl border p-4 lg:grid-cols-[1.2fr_1.2fr_1fr_auto]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Tipo de Contrato
              <DashboardSelector label="Tipo de Contrato"
                value={contractTypeKey}
                onValueChange={selectedValue => {
                  setContractTypeKey(selectedValue);
                  setCostGoalDraft(null);
                }}
                className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {contractTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </DashboardSelector>
            </div>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Classificação
              <DashboardSelector label="Classificação"
                value={classificationKey}
                onValueChange={selectedValue => {
                  setClassificationKey(selectedValue);
                  setCostGoalDraft(null);
                }}
                className={`h-11 rounded-xl border px-3 text-sm ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                {classificationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </DashboardSelector>
            </div>
            <div className="grid gap-1 text-sm font-semibold" style={{ color: 'var(--color-text-subtle)' }}>
              Meta Mensal
              <DashboardInput
                type="text"
                inputMode="decimal"
                value={costGoalValue}
                onChange={(event) => setCostGoalDraft(event.target.value)}
                placeholder="299.000,00"
                autoComplete="off"
                className={`h-11 rounded-xl border px-3 text-sm tabular-nums ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
            </div>
            <div className="flex items-end">
              <DashboardButton
                type="submit"
                disabled={isSaving || !selectedBranchId}
                className={`inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                <Save size={15} />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </DashboardButton>
            </div>
          </form>

          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              Orçamentos cadastrados para {selectedBranchLabel || 'filial'} em {MONTHS.find((item) => item.value === mes)?.label}/{ano}
            </h3>
            <div className="mt-3 overflow-x-auto">
              {configsDaFilialSelecionada.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {statusMensagem ?? 'Nenhuma meta cadastrada para a filial selecionada neste mês.'}
                </p>
              ) : (
                <Table className="min-w-[720px] w-full border-collapse text-sm">
                  <TableHeader>
                    <TableRow isHeaderRow style={{ color: 'var(--color-text-subtle)', borderBottom: '1px solid var(--color-border)' }}>
                      <TableHeaderCell className="px-3 py-2 text-left font-semibold">Tipo de Contrato</TableHeaderCell>
                      <TableHeaderCell className="px-3 py-2 text-left font-semibold">Classificação</TableHeaderCell>
                      <TableHeaderCell className="px-3 py-2 text-right font-semibold">Meta Mensal Cadastrada</TableHeaderCell>
                      <TableHeaderCell className="px-3 py-2 text-left font-semibold">Última Atualização</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {configsDaFilialSelecionada.map((config) => (
                      <TableRow
                        key={getConfigRowKey(config)}
                        style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                      >
                        <TableCell className="px-3 py-3 font-medium">{getConfigContractTypeLabel(config)}</TableCell>
                        <TableCell className="px-3 py-3">{getConfigClassificationLabel(config)}</TableCell>
                        <TableCell className="px-3 py-3 text-right font-semibold tabular-nums">{formatGoalCurrency(config.costGoal)}</TableCell>
                        <TableCell className="px-3 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <TableText>
                              {config.updatedAt ? formatarDataHora(config.updatedAt) : '—'} · {config.updatedByName ?? 'Usuário não identificado'}
                            </TableText>
                            <DashboardButton
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleRemove(config)}
                              aria-label={`Remover meta ${getConfigContractTypeLabel(config)} ${getConfigClassificationLabel(config)}`}
                              title="Remover meta"
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
                              style={{ borderColor: '#dc2626', color: '#dc2626' }}
                            >
                              <Trash2 size={14} />
                            </DashboardButton>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>
      </section>
      <ManifestosMetasImportacaoModal open={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      <ToastStack items={toasts} />
    </HeaderPanelContent>
  );
}
