import { Spinner } from '@astryxdesign/core/Spinner';
import DashboardLoading from '../shared/DashboardLoading';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { Card } from '@astryxdesign/core/Card';
import DashboardButton from "../shared/DashboardButton";
import { useMemo, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, RefreshCw, Trash2, UploadCloud } from 'lucide-react';
import DataTable, { type ColunaTabela } from '../shared/DataTable';
import {
  useClientesExcecaoCubagem,
  useExcluirClienteExcecaoCubagem,
} from '../../hooks/queries/useIndicadoresGestaoAVista';
import type { ClienteExcecaoCubagem } from '../../types/indicadoresGestaoAVista';
import { getApiErrorMessage } from '../../utils/apiError';
import { formatarDataHoraMinuto } from '../../utils/formatadores';

interface CubagemClientesExcecaoPanelProps {
  onImportClick: () => void;
}

interface ClienteExcecaoCubagemRow extends ClienteExcecaoCubagem {
  clienteCnpjLabel: string;
  razaoSocialLabel: string;
  ultimaAtualizacaoLabel: string;
  acao: string;
}

const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

function formatarCnpj(cnpj: string | null | undefined) {
  const digits = (cnpj ?? '').replace(/\D/g, '');
  if (digits.length !== 14) {
    return digits || '-';
  }
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarUltimaAtualizacao(row: ClienteExcecaoCubagem) {
  const data = row.dataAtualizacao
    ? formatarDataHoraMinuto(row.dataAtualizacao).replace(/^(\d{2}\/\d{2}\/\d{4}) /, '$1, ')
    : '-';
  const usuario = row.atualizadoPor?.trim() || 'Usuário não identificado';
  return `${data} · ${usuario}`;
}

function compararDataAtualizacao(left: ClienteExcecaoCubagem, right: ClienteExcecaoCubagem) {
  const leftTime = left.dataAtualizacao ? new Date(left.dataAtualizacao).getTime() : 0;
  const rightTime = right.dataAtualizacao ? new Date(right.dataAtualizacao).getTime() : 0;
  return rightTime - leftTime;
}

export default function CubagemClientesExcecaoPanel({ onImportClick }: CubagemClientesExcecaoPanelProps) {
  const clientes = useClientesExcecaoCubagem();
  const exclusao = useExcluirClienteExcecaoCubagem();
  const [clienteParaRemover, setClienteParaRemover] = useState<ClienteExcecaoCubagemRow | null>(null);
  const [cnpjExcluindo, setCnpjExcluindo] = useState<string | null>(null);
  const [erroExclusao, setErroExclusao] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const rows = useMemo<ClienteExcecaoCubagemRow[]>(
    () => (clientes.data ?? []).map((cliente) => ({
      ...cliente,
      clienteCnpjLabel: formatarCnpj(cliente.clienteCnpj),
      razaoSocialLabel: cliente.razaoSocial?.trim() || cliente.nomeFantasia?.trim() || '-',
      ultimaAtualizacaoLabel: formatarUltimaAtualizacao(cliente),
      acao: 'excluir',
    })),
    [clientes.data],
  );

  const resumo = useMemo(() => {
    const total = rows.length;
    const ultimoRegistro = [...rows].sort(compararDataAtualizacao)[0] ?? null;
    const exemplos = rows.slice(0, 3).map((row) => row.razaoSocialLabel).filter((label) => label !== '-');

    return {
      total,
      ultimaAtualizacao: ultimoRegistro ? formatarUltimaAtualizacao(ultimoRegistro) : 'Sem atualização registrada',
      exemplos: exemplos.length > 0 ? exemplos.join(', ') : 'Nenhum cliente ativo cadastrado',
    };
  }, [rows]);

  async function handleExcluir(row: ClienteExcecaoCubagemRow) {
    setErroExclusao('');
    setCnpjExcluindo(row.clienteCnpj);
    try {
      await exclusao.mutateAsync(row.clienteCnpj);
    } catch (error) {
      setErroExclusao(getApiErrorMessage(error, 'Não foi possível remover o cliente da whitelist.'));
    } finally {
      setCnpjExcluindo(null);
    }
  }

  const columns: ColunaTabela<ClienteExcecaoCubagemRow>[] = [
    { chave: 'clienteCnpjLabel', label: 'CNPJ', largura: '170px', fixo: true },
    { chave: 'razaoSocialLabel', label: 'Razão Social', largura: '360px' },
    { chave: 'ultimaAtualizacaoLabel', label: 'Última Atualização', largura: '320px' },
    {
      chave: 'acao',
      label: 'Ações',
      largura: '96px',
      alinhamento: 'center',
      ordenavel: false,
      formato: (_valor, row) => {
        const isDeleting = exclusao.isPending && cnpjExcluindo === row.clienteCnpj;
        return (
          <DashboardButton
            type="button"
            onClick={() => setClienteParaRemover(row)}
            disabled={exclusao.isPending}
            className={`inline-flex items-center justify-center rounded-lg border p-2 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
            style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'var(--color-card)' }}
            title="Remover cliente da whitelist"
            aria-label={`Remover ${row.clienteCnpjLabel} da whitelist de cubagem`}
          >
            {isDeleting ? (
              <Spinner size="sm" aria-hidden="true" />
            ) : (
              <Trash2 size={15} aria-hidden="true" />
            )}
          </DashboardButton>
        );
      },
    },
  ];

  return (
    <Card padding={0}
      className="mb-5 rounded-[20px] border p-4"
      style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
      aria-label="Clientes sem cubagem cadastrados"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Clientes sem cubagem
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-text-subtle)' }}>
            Whitelist ativa por CNPJ do pagador, com auditoria do último upload.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <DashboardButton
            type="button"
            onClick={() => void clientes.refetch()}
            disabled={clientes.isFetching}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING_CLASS}`}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', backgroundColor: 'var(--color-card)' }}
          >
            {clientes.isFetching ? <Spinner size="sm" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
            Atualizar
          </DashboardButton>
          <DashboardButton
            type="button"
            onClick={onImportClick}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 ${FOCUS_RING_CLASS}`}
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            <UploadCloud size={14} aria-hidden="true" />
            Importar clientes sem cubagem
          </DashboardButton>
          <DashboardButton
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 ${FOCUS_RING_CLASS}`}
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', backgroundColor: 'var(--color-card)' }}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
            {isExpanded ? 'Minimizar' : 'Mostrar tabela'}
          </DashboardButton>
        </div>
      </div>

      {!isExpanded ? (
        <div className="grid gap-3 text-xs md:grid-cols-3" aria-label="Resumo da whitelist de cubagem">
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <div className="block font-semibold" style={{ color: 'var(--color-text)' }}>{clientes.isLoading ? <DashboardLoading label="Carregando clientes" /> : `${resumo.total} cliente${resumo.total === 1 ? '' : 's'} ativo${resumo.total === 1 ? '' : 's'}`}</div>
            <span style={{ color: 'var(--color-text-subtle)' }}>CNPJs dispensados do indicador.</span>
          </div>
          <div className="rounded-xl border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <span className="block font-semibold" style={{ color: 'var(--color-text)' }}>
              Última atualização
            </span>
            <div style={{ color: 'var(--color-text-subtle)' }}>{clientes.isLoading ? <DashboardLoading label="Carregando clientes" /> : resumo.ultimaAtualizacao}</div>
          </div>
          <div className="min-w-0 rounded-xl border px-3 py-2" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
            <span className="block font-semibold" style={{ color: 'var(--color-text)' }}>
              Dentro da lista
            </span>
            <div className="block max-w-full truncate" style={{ color: 'var(--color-text-subtle)' }} title={clientes.isLoading ? undefined : resumo.exemplos}>{clientes.isLoading ? <DashboardLoading label="Carregando clientes" /> : resumo.exemplos}</div>
          </div>
        </div>
      ) : null}

      {!isExpanded && clientes.error ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{getApiErrorMessage(clientes.error, 'Não foi possível carregar a whitelist de cubagem.')}</span>
        </div>
      ) : null}

      {erroExclusao ? (
        <div className="mt-3 mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm" style={{ borderColor: '#dc2626', color: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.08)' }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{erroExclusao}</span>
        </div>
      ) : null}

      {isExpanded ? (
        <DataTable
          titulo="Whitelist de cubagem"
          dados={rows}
          chaveLinha="clienteCnpj"
          colunas={columns}
          isLoading={clientes.isLoading}
          error={clientes.error}
          errorFallbackMessage="Não foi possível carregar a whitelist de cubagem."
          tamanhoPaginaInicial={10}
        />
      ) : null}
      {clienteParaRemover && (
        <AlertDialog isOpen title="Remover cliente da whitelist?"
          description={'O CNPJ ' + clienteParaRemover.clienteCnpjLabel + ' deixará de constar nas exceções de cubagem.'}
          actionLabel="Remover" onOpenChange={open => { if (!open) setClienteParaRemover(null); }}
          onAction={() => { setClienteParaRemover(null); void handleExcluir(clienteParaRemover); }} />
      )}
    </Card>
  );
}
