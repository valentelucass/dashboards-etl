import { Dialog } from '@astryxdesign/core/Dialog';
import { FileInput } from '@astryxdesign/core/FileInput';
import { Text } from '@astryxdesign/core/Text';
import DashboardButton from "../../shared/DashboardButton";
import { useMemo, useState } from 'react';
import { AlertCircle, FileSpreadsheet, X } from 'lucide-react';
import DataTable, { type ColunaTabela } from '../../shared/DataTable';
import {
  useBaixarTemplateManifestosMetas,
  useImportarManifestosMetas,
  usePreValidarManifestosMetasImportacao,
} from '../../../hooks/queries/useManifestos';
import type {
  ManifestosMetasImportacaoErro,
  ManifestosMetasImportacaoPreviewLinha,
  ManifestosMetasImportacaoPreviewResponse,
  ManifestosMetasImportacaoResultado,
  ManifestosMetasImportacaoStatus,
} from '../../../types/manifestos';
import { getApiErrorMessage } from '../../../utils/apiError';
import { formatarMoeda } from '../../../utils/formatadores';

const SURFACE_STYLE = {
  backgroundColor: 'var(--color-card)',
  borderColor: 'var(--color-border)',
};

const SOFT_PANEL_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
};

const PRIMARY_BUTTON_STYLE = {
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
};

const SECONDARY_BUTTON_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

const ERROR_PANEL_STYLE = {
  backgroundColor: 'rgba(220, 38, 38, 0.12)',
  borderColor: 'rgba(220, 38, 38, 0.45)',
  color: 'var(--color-text)',
};

interface ManifestosMetasImportacaoModalProps {
  open: boolean;
  onClose: () => void;
}

interface PreviewRowTable extends ManifestosMetasImportacaoPreviewLinha {
  previewKey: string;
  competencia: string;
  classificationLabel: string;
  costGoalLabel: string;
  mensagensResumo: string;
}

interface ErroRowTable extends ManifestosMetasImportacaoErro {
  erroKey: string;
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={SURFACE_STYLE}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function formatStatus(status: ManifestosMetasImportacaoStatus) {
  return status === 'PRONTA' ? 'Pronta' : 'Erro de validação';
}

function statusStyle(status: ManifestosMetasImportacaoStatus) {
  if (status === 'PRONTA') {
    return {
      backgroundColor: 'rgba(22, 163, 74, 0.14)',
      color: '#15803d',
    };
  }

  return {
    backgroundColor: 'rgba(220, 38, 38, 0.14)',
    color: '#dc2626',
  };
}

export default function ManifestosMetasImportacaoModal({ open, onClose }: ManifestosMetasImportacaoModalProps) {
  if (!open) {
    return null;
  }

  return <ManifestosMetasImportacaoModalAberto onClose={onClose} />;
}

function ManifestosMetasImportacaoModalAberto({ onClose }: Pick<ManifestosMetasImportacaoModalProps, 'onClose'>) {
  const baixarTemplate = useBaixarTemplateManifestosMetas();
  const preValidacao = usePreValidarManifestosMetasImportacao();
  const importacao = useImportarManifestosMetas();
  const [arquivoSelecionado, setArquivoSelecionado] = useState<File | null>(null);
  const [preview, setPreview] = useState<ManifestosMetasImportacaoPreviewResponse | null>(null);
  const [resultado, setResultado] = useState<ManifestosMetasImportacaoResultado | null>(null);
  const [erroLocal, setErroLocal] = useState('');

  async function processarArquivo(arquivo: File) {
    const nome = arquivo.name.toLowerCase();
    if (!nome.endsWith('.xlsx') && !nome.endsWith('.xls') && !nome.endsWith('.csv')) {
      setErroLocal('Formato inválido. Envie somente arquivos .xlsx, .xls ou .csv.');
      return;
    }

    setErroLocal('');
    setResultado(null);
    setArquivoSelecionado(arquivo);

    try {
      const response = await preValidacao.mutateAsync(arquivo);
      setPreview(response);
    } catch (error) {
      setPreview(null);
      setErroLocal(getApiErrorMessage(error, 'Não foi possível pré-validar a planilha de metas.'));
    }
  }

  async function handleBaixarTemplate() {
    try {
      await baixarTemplate.mutateAsync();
    } catch (error) {
      setErroLocal(getApiErrorMessage(error, 'Não foi possível baixar a planilha modelo.'));
    }
  }

  async function handleImportar() {
    if (!arquivoSelecionado) {
      return;
    }

    try {
      const response = await importacao.mutateAsync(arquivoSelecionado);
      setResultado(response);
      if (response.totalErros > 0) {
        setErroLocal('Importação concluída com linhas rejeitadas. Confira o resultado final.');
      } else {
        setErroLocal('');
      }
    } catch (error) {
      setErroLocal(getApiErrorMessage(error, 'Não foi possível importar a planilha de metas.'));
    }
  }

  const previewRows = useMemo<PreviewRowTable[]>(
    () =>
      (preview?.linhasPreview ?? []).map((row, index) => ({
        ...row,
        previewKey: `preview-row-${index}-${row.linha || 'sem-linha'}-${row.branchId || 'sem-filial'}`,
        competencia: row.ano && row.mes ? `${String(row.mes).padStart(2, '0')}/${row.ano}` : '—',
        classificationLabel: row.classificationKey ?? 'GERAL',
        costGoalLabel: row.costGoal == null ? '—' : formatarMoeda(row.costGoal),
        mensagensResumo: row.mensagens.join(' '),
      })),
    [preview],
  );

  const erroRows = useMemo<ErroRowTable[]>(
    () =>
      (resultado?.listaErros ?? []).map((row, index) => ({
        ...row,
        erroKey: `import-error-row-${index}-${row.linha || 'sem-linha'}-${row.tipoErro || 'sem-tipo'}`,
      })),
    [resultado],
  );

  const colunasPreview: ColunaTabela<PreviewRowTable>[] = [
    { chave: 'linha', label: 'Linha', fixo: true },
    { chave: 'competencia', label: 'Mês/Ano', largura: '110px' },
    { chave: 'branchId', label: 'Filial', largura: '140px' },
    { chave: 'contractType', label: 'Contrato', largura: '160px' },
    { chave: 'classificationLabel', label: 'Classificação', largura: '180px' },
    { chave: 'costGoalLabel', label: 'Meta', largura: '140px', alinhamento: 'right' },
    {
      chave: 'status',
      label: 'Status',
      largura: '160px',
      formato: (valor) => (
        <span
          className="inline-flex rounded-full px-2 py-1 text-xs font-semibold"
          style={statusStyle(valor as ManifestosMetasImportacaoStatus)}
        >
          {formatStatus(valor as ManifestosMetasImportacaoStatus)}
        </span>
      ),
    },
    {
      chave: 'mensagensResumo',
      label: 'Mensagens',
      largura: '360px',
      formato: (valor) => <span className="whitespace-normal">{String(valor || '—')}</span>,
    },
  ];

  const colunasErros: ColunaTabela<ErroRowTable>[] = [
    { chave: 'linha', label: 'Linha', fixo: true },
    { chave: 'tipoErro', label: 'Tipo', largura: '160px' },
    {
      chave: 'motivo',
      label: 'Motivo',
      largura: '520px',
      formato: (valor) => <span className="whitespace-normal">{String(valor)}</span>,
    },
  ];

  return (
    <Dialog isOpen purpose="info" aria-labelledby="manifestos-import-title" width="min(80rem, calc(100vw - 1.5rem))" maxHeight="calc(100dvh - 1.5rem)" padding={0}
      onOpenChange={open => { if (!open) onClose(); }}>
        <div className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              <FileSpreadsheet size={18} />
              Importação de metas de manifestos
            </div>
            <h2 id="manifestos-import-title" className="mt-1 text-2xl font-bold" style={{ color: 'var(--color-text)' }}>
              Planilha com preview por filial, contrato e classificação
            </h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
              Formato obrigatório: <strong>Mês/Ano</strong>, <strong>Filial</strong>, <strong>Tipo de Contrato</strong>, <strong>Classificação</strong> e <strong>Valor da Meta</strong>.
            </p>
          </div>

          <DashboardButton
            type="button"
            onClick={onClose}
            className="rounded-xl border p-2 transition-opacity hover:opacity-80"
            style={SECONDARY_BUTTON_STYLE}
            aria-label="Fechar importação"
          >
            <X size={18} />
          </DashboardButton>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <section className="rounded-3xl border p-5" style={SOFT_PANEL_STYLE}>
              <div className="grid gap-4 lg:grid-cols-[1.6fr_auto]">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
                    Arquivo de entrada
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
                    Selecione ou arraste a planilha. A pré-validação acontece antes da gravação no banco.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <DashboardButton
                    type="button"
                    onClick={() => void handleBaixarTemplate()}
                    disabled={baixarTemplate.isPending}
                    className="rounded-xl border px-4 py-2.5 text-sm font-medium disabled:opacity-50"
                    style={SECONDARY_BUTTON_STYLE}
                  >
                    {baixarTemplate.isPending ? 'Baixando...' : 'Baixar planilha modelo'}
                  </DashboardButton>
                </div>
              </div>

              <div className="mt-4 space-y-2 min-w-0">
                <FileInput mode="dropzone" label="Selecionar planilha" accept=".xlsx,.xls,.csv" value={null}
                  width="100%" placeholder="Selecione ou arraste a planilha" description="Filial em branco ou GLOBAL vira meta global. Classificação em branco, GERAL ou GLOBAL vira meta geral."
                  onChange={file => { if (file instanceof File) void processarArquivo(file); }} />
                {arquivoSelecionado && <Text as="p" size="sm" color="secondary" className="break-all">Arquivo atual: {arquivoSelecionado.name}</Text>}
              </div>

              {erroLocal && (
                <div className="mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm" style={ERROR_PANEL_STYLE}>
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>{erroLocal}</span>
                </div>
              )}
            </section>

            {preview && (
              <>
                <section className="grid gap-4 md:grid-cols-3">
                  <SummaryCard label="Total de linhas" value={preview.totais.totalLinhas} accent="var(--color-text)" />
                  <SummaryCard label="Válidas para importação" value={preview.totais.validas} accent="#10b981" />
                  <SummaryCard label="Com problemas" value={preview.totais.invalidas} accent="#ef4444" />
                </section>

                <DataTable
                  titulo="Preview da importação"
                  dados={previewRows}
                  chaveLinha="previewKey"
                  colunas={colunasPreview}
                  isLoading={preValidacao.isPending}
                />

                <div className="flex flex-wrap gap-3">
                  <DashboardButton
                    type="button"
                    onClick={() => void handleImportar()}
                    disabled={!preview.podeImportar || importacao.isPending || !arquivoSelecionado}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                    style={PRIMARY_BUTTON_STYLE}
                  >
                    {importacao.isPending ? 'Importando agora...' : 'Importar agora'}
                  </DashboardButton>
                  <DashboardButton
                    type="button"
                    onClick={() => void handleBaixarTemplate()}
                    className="rounded-xl border px-4 py-2.5 text-sm font-medium"
                    style={SECONDARY_BUTTON_STYLE}
                  >
                    Baixar modelo novamente
                  </DashboardButton>
                </div>
              </>
            )}

            {resultado && (
              <section className="space-y-5 rounded-3xl border p-5" style={SOFT_PANEL_STYLE}>
                <div>
                  <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                    Resultado final da importação
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--color-text-subtle)' }}>
                    As linhas válidas foram gravadas usando a mesma regra do cadastro manual.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <SummaryCard label="Processadas" value={resultado.totalProcessados} accent="var(--color-text)" />
                  <SummaryCard label="Importadas" value={resultado.totalImportados} accent="#10b981" />
                  <SummaryCard label="Rejeitadas" value={resultado.totalErros} accent="#ef4444" />
                </div>

                <DataTable
                  titulo="Erros e motivos"
                  dados={erroRows}
                  chaveLinha="erroKey"
                  colunas={colunasErros}
                  semPaginacao={erroRows.length <= 10}
                />
              </section>
            )}
          </div>
        </div>
    </Dialog>
  );
}
