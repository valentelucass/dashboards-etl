import { TableText } from '../components/shared/DashboardTable';
import { Badge } from '@astryxdesign/core/Badge';
import DashboardButton from "../components/shared/DashboardButton";
import { useEffect, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { FormTextField } from '../components/shared/FormTextField';
import FiliaisPermitidasSplitSelect from '../components/admin/FiliaisPermitidasSplitSelect';
import PermissionMatrix from '../components/admin/PermissionMatrix';
import DataTable, { type ColunaTabela } from '../components/shared/DataTable';
import {
  useAtualizarSetor,
  useCatalogoPermissoes,
  useCriarSetor,
  useExcluirSetor,
  useSetoresAdmin,
} from '../hooks/queries/useAdminAcesso';
import { usePageHeader } from '../contexts/PageHeaderContext';
import { useFiliais } from '../hooks/queries/useDimensoes';
import type { PermissionMap, SetorAdmin, SetorPayload } from '../types/access';
import { createEmptyPermissionMap, permissionSummary } from '../utils/accessControl';
import { getApiErrorMessage } from '../utils/apiError';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { DropdownMenu, DropdownMenuDivider, DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import { Popover } from '@astryxdesign/core/Popover';

interface SetorRow extends SetorAdmin {
  detalhes: string;
  permissoesResumo: string;
  filiaisResumo: string;
  acoes: string;
}

const FORM_INICIAL: SetorPayload = {
  nome: '',
  descricao: '',
  permissoes: createEmptyPermissionMap(),
  filiaisPermitidas: [],
};

const SECONDARY_BUTTON_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

const SOFT_PANEL_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
};

const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

function useIsMobileSetoresTable() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 860px)').matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 860px)');

    function handleChange(event: MediaQueryListEvent) {
      setIsMobile(event.matches);
    }

    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  return isMobile;
}

function renderSistemaBadge(sistema: boolean) {
  return (
    <Badge label={sistema ? 'Sistema' : 'Manual'} variant={sistema ? 'info' : 'neutral'} />
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={SOFT_PANEL_STYLE}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {value || 'Nenhum'}
      </div>
    </div>
  );
}

function DetailTextBlock({ label, value, fallback }: { label: string; value: string; fallback: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>
        {label}
      </div>
      <div
        className="max-h-24 overflow-y-auto rounded-xl border px-3 py-2 text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--color-bg)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text)',
        }}
      >
        {value || fallback}
      </div>
    </div>
  );
}

function renderSetorIdentityCell(row: SetorRow) {
  return (
    <div className="min-w-0 whitespace-normal">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 text-sm font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
          <TableText>{row.nome}</TableText>
        </p>
        {renderSistemaBadge(row.sistema)}
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        <TableText maxLines={2}>{row.descricao || 'Sem descrição'}</TableText>
      </p>
    </div>
  );
}

function renderSetorAccessCell(row: SetorRow) {
  return (
    <div className="min-w-0 whitespace-normal text-xs leading-relaxed">
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
        <TableText>{row.totalUsuarios} usuário(s)</TableText>
      </p>
      <p className="mt-1" style={{ color: 'var(--color-text-muted)' }}>
        <TableText>{row.filiaisPermitidas.length > 0
          ? `${row.filiaisPermitidas.length} filial(is)`
          : 'Nenhuma filial'}</TableText>
      </p>
      <p style={{ color: 'var(--color-text-muted)' }}>
        <TableText>{row.permissoesResumo || 'Sem permissões'}</TableText>
      </p>
    </div>
  );
}

function renderSetorDetailsPopover(row: SetorRow) {
  return (
    <Popover label={"Detalhes de " + row.nome} alignment="end" width="min(30rem, calc(100vw - 24px))" padding={3}
      content={<div className="max-h-[min(34rem,70dvh)] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                {row.nome}
              </h3>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {row.descricao || 'Sem descrição'}
              </p>
            </div>
            {renderSistemaBadge(row.sistema)}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DetailItem label="Usuários" value={`${row.totalUsuarios} vinculado(s)`} />
            <DetailItem label="Origem" value={row.sistema ? 'Sistema' : 'Manual'} />
          </div>

          <DetailTextBlock label="Descrição" value={row.descricao ?? ''} fallback="Sem descrição" />
          <DetailTextBlock label="Filiais permitidas" value={row.filiaisResumo} fallback="Nenhuma filial" />
          <DetailTextBlock label="Baseline de acesso" value={row.permissoesResumo} fallback="Sem permissões" />
        </div>
        </div>}>
      {trigger => (
        <DashboardButton {...trigger}
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px hover:bg-[var(--color-bg)] ${FOCUS_RING_CLASS}`}
          style={SECONDARY_BUTTON_STYLE}
          aria-label={`Ver detalhes de ${row.nome}`}
        >
          <Eye size={14} />
          Ver mais
        </DashboardButton>
      )}
    </Popover>
  );
}

export default function AdminSetoresPage() {
  const catalogo = useCatalogoPermissoes();
  const setores = useSetoresAdmin();
  const filiais = useFiliais();
  const criarSetor = useCriarSetor();
  const atualizarSetor = useAtualizarSetor();
  const excluirSetor = useExcluirSetor();

  const [editing, setEditing] = useState<SetorAdmin | null>(null);
  const [form, setForm] = useState<SetorPayload>(FORM_INICIAL);
  const [erro, setErro] = useState('');
  const [exclusao, setExclusao] = useState<SetorAdmin | null>(null);
  const isMobileSetoresTable = useIsMobileSetoresTable();
  const filiaisDisponiveis = filiais.data ?? [];

  usePageHeader({
    title: 'Gestão de setores',
    description: 'O setor define o baseline de dashboards e o escopo de filiais que cada usuário herdará.',
  });

  const linhas = useMemo<SetorRow[]>(
    () =>
      (setores.data ?? []).map((setor) => ({
        ...setor,
        detalhes: setor.id,
        permissoesResumo: permissionSummary(setor.templatePermissoes, catalogo.data ?? []),
        filiaisResumo: setor.filiaisPermitidas.join(', '),
        acoes: setor.id,
      })),
    [catalogo.data, setores.data],
  );

  function resetForm() {
    setEditing(null);
    setForm(FORM_INICIAL);
    setErro('');
  }

  function startEdit(setor: SetorAdmin) {
    setEditing(setor);
    setForm({
      nome: setor.nome,
      descricao: setor.descricao,
      permissoes: { ...setor.templatePermissoes } as PermissionMap,
      filiaisPermitidas: [...setor.filiaisPermitidas],
    });
    setErro('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErro('');

    try {
      if (editing) {
        await atualizarSetor.mutateAsync({ id: editing.id, payload: form });
      } else {
        await criarSetor.mutateAsync(form);
      }
      resetForm();
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  async function handleDelete(setor: SetorAdmin) {

    try {
      await excluirSetor.mutateAsync(setor.id);
      if (editing?.id === setor.id) resetForm();
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  function renderActionMenu(row: SetorRow) {
    return (
      <DropdownMenu alignment="end" menuWidth={192} hasChevron={false}
        button={{ label: 'Abrir ações de ' + row.nome, isIconOnly: true, icon: <MoreHorizontal size={17} /> }}>
        <DropdownMenuItem label="Editar" icon={<Pencil size={14} />} onClick={() => startEdit(row)} />
        <DropdownMenuDivider />
        <DropdownMenuItem label="Excluir" icon={<Trash2 size={14} />} variant="destructive"
          isDisabled={row.sistema} onClick={() => setExclusao(row)} />
      </DropdownMenu>
    );
  }

  const colunasSetoresDesktop: ColunaTabela<SetorRow>[] = [
    {
      chave: 'nome',
      label: 'Setor',
      fixo: true,
      largura: '280px',
      formato: (_, row) => renderSetorIdentityCell(row),
    },
    {
      chave: 'totalUsuarios',
      label: 'Acesso',
      largura: '220px',
      formato: (_, row) => renderSetorAccessCell(row),
    },
    {
      chave: 'detalhes',
      label: 'Detalhes',
      largura: '120px',
      ordenavel: false,
      formato: (_, row) => renderSetorDetailsPopover(row),
    },
    {
      chave: 'acoes',
      label: 'Ações',
      largura: '80px',
      ordenavel: false,
      formato: (_, row) => renderActionMenu(row),
    },
  ];

  const colunasSetoresMobile: ColunaTabela<SetorRow>[] = [
    {
      chave: 'nome',
      label: 'Setor',
      largura: '240px',
      formato: (_, row) => renderSetorIdentityCell(row),
    },
    {
      chave: 'totalUsuarios',
      label: 'Acesso',
      largura: '220px',
      ordenavel: false,
      formato: (_, row) => renderSetorAccessCell(row),
    },
    {
      chave: 'acoes',
      label: 'Ações',
      largura: '180px',
      ordenavel: false,
      formato: (_, row) => (
        <div className="flex items-center gap-2">
          {renderSetorDetailsPopover(row)}
          {renderActionMenu(row)}
        </div>
      ),
    },
  ];

  return (
    <div className="dashboard-admin space-y-5">
      <Card padding={0} className="dashboard-admin-card">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h2>{editing ? 'Editar setor' : 'Cadastro de setor'}</h2>
          <div className="grid min-w-0 items-start gap-4 border-b pb-4 lg:grid-cols-2 [&>*]:min-w-0" style={{ borderColor: 'var(--color-border)' }}>
            <FormTextField label="Nome do setor" value={form.nome} placeholder="Ex: Financeiro" required
              onChange={nome => setForm(atual => ({ ...atual, nome }))} />
            <FormTextField label="Descrição" value={form.descricao ?? ''} placeholder="Resumo do setor"
              onChange={descricao => setForm(atual => ({ ...atual, descricao }))} />

            <div className="space-y-3 lg:col-span-2">
              <div className="space-y-1">
                <span className="block text-sm font-medium" style={{ color: 'var(--color-text-subtle)' }}>Escopo de filiais</span>
                <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Dados das filiais selecionadas.</p>
              </div>

              <FiliaisPermitidasSplitSelect
                opcoes={filiaisDisponiveis}
                selecionadas={form.filiaisPermitidas}
                onChange={(filiaisPermitidas) => setForm((atual) => ({ ...atual, filiaisPermitidas }))}
                isLoading={filiais.isLoading}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Template de acesso do setor</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>Cada item habilita o acesso base herdado pelos usuários do setor.</p>
            </div>
            <PermissionMatrix
              catalogo={catalogo.data ?? []}
              valor={form.permissoes}
              onChange={(permissoes) => setForm((atual) => ({ ...atual, permissoes }))}
              disabled={catalogo.isLoading}
            />
          </div>

          {erro && <Banner status="error" title={erro} role="alert" />}
          {!erro && form.filiaisPermitidas.length === 0 && (
            <Banner status="warning" title="Selecione pelo menos uma filial para salvar o setor." />
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" label={editing ? 'Salvar alterações' : 'Criar setor'} variant="primary"
              className="dashboard-form-submit" isLoading={criarSetor.isPending || atualizarSetor.isPending}
              isDisabled={form.filiaisPermitidas.length === 0} />
            {editing && <Button label="Cancelar edição" variant="ghost" className="dashboard-form-secondary" onClick={resetForm} />}
          </div>
        </form>
      </Card>

      <DataTable
        titulo="Setores cadastrados"
        dados={linhas}
        chaveLinha="id"
        isLoading={setores.isLoading}
        colunas={isMobileSetoresTable ? colunasSetoresMobile : colunasSetoresDesktop}
      />
      {exclusao && (
        <AlertDialog isOpen title="Excluir setor?" description={'Confirme a exclusão do setor ' + exclusao.nome + '.'}
          actionLabel="Excluir" onOpenChange={open => { if (!open) setExclusao(null); }}
          onAction={() => { setExclusao(null); void handleDelete(exclusao); }} />
      )}
    </div>
  );
}
