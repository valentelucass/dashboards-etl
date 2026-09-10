import { useEffect, useMemo, useState } from 'react';
import { Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';

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

const SURFACE_STYLE = {
  backgroundColor: 'var(--color-card)',
  borderColor: 'var(--color-border)',
};

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

const SOFT_PANEL_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
};

const ACTIVE_BADGE_STYLE = {
  backgroundColor: 'rgba(33, 71, 138, 0.14)',
  color: 'var(--color-primary)',
};

const INACTIVE_BADGE_STYLE = {
  backgroundColor: 'rgba(71, 85, 105, 0.12)',
  color: 'var(--color-text-subtle)',
};

const DANGER_BUTTON_STYLE = {
  borderColor: '#dc2626',
  color: '#dc2626',
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
    <span
      className="inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-medium"
      style={sistema ? ACTIVE_BADGE_STYLE : INACTIVE_BADGE_STYLE}
    >
      {sistema ? 'Sistema' : 'Manual'}
    </span>
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
    <div className="min-w-[14rem] whitespace-normal">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
          {row.nome}
        </p>
        {renderSistemaBadge(row.sistema)}
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {row.descricao || 'Sem descrição'}
      </p>
    </div>
  );
}

function renderSetorAccessCell(row: SetorRow) {
  return (
    <div className="min-w-[13rem] whitespace-normal text-xs leading-relaxed">
      <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
        {row.totalUsuarios} usuário(s)
      </p>
      <p className="mt-1 line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
        {row.filiaisPermitidas.length > 0
          ? `${row.filiaisPermitidas.length} filial(is)`
          : 'Nenhuma filial'}
      </p>
      <p className="line-clamp-1" style={{ color: 'var(--color-text-muted)' }}>
        {row.permissoesResumo || 'Sem permissões'}
      </p>
    </div>
  );
}

function renderSetorDetailsPopover(row: SetorRow) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150 hover:-translate-y-px hover:bg-[var(--color-bg)] ${FOCUS_RING_CLASS}`}
          style={SECONDARY_BUTTON_STYLE}
          aria-label={`Ver detalhes de ${row.nome}`}
        >
          <Eye size={14} />
          Ver mais
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="max-h-[min(34rem,calc(100vh-5rem))] overflow-y-auto p-4"
        style={{ width: 'min(30rem, calc(100vw - 24px))' }}
      >
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
      </PopoverContent>
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
    if (!window.confirm(`Excluir o setor "${setor.nome}"?`)) return;

    try {
      await excluirSetor.mutateAsync(setor.id);
      if (editing?.id === setor.id) resetForm();
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  function renderActionMenu(row: SetorRow) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-150 hover:-translate-y-px hover:bg-[var(--color-bg)] ${FOCUS_RING_CLASS}`}
            style={SECONDARY_BUTTON_STYLE}
            aria-label={`Abrir ações de ${row.nome}`}
          >
            <MoreHorizontal size={17} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuItem
            onSelect={() => startEdit(row)}
            className="gap-2"
          >
            <Pencil size={14} />
            Editar
          </DropdownMenuItem>
          <DropdownMenuSeparator
            className="mx-2 my-1 h-px"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <DropdownMenuItem
            disabled={row.sistema}
            onSelect={() => void handleDelete(row)}
            className="gap-2 font-semibold"
            style={DANGER_BUTTON_STYLE}
          >
            <Trash2 size={14} />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
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
    <div className="space-y-5">
      <section className="rounded-[20px] border p-4 shadow-sm sm:p-5" style={SURFACE_STYLE}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid min-w-0 items-start gap-4 border-b pb-4 lg:grid-cols-2 [&>*]:min-w-0" style={{ borderColor: 'var(--color-border)' }}>
            <label className="space-y-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-subtle)' }}>Nome do setor</span>
              <input
                value={form.nome}
                onChange={(e) => setForm((atual) => ({ ...atual, nome: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5"
                style={FIELD_STYLE}
                placeholder="Ex: Financeiro"
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium" style={{ color: 'var(--color-text-subtle)' }}>Descrição</span>
              <input
                value={form.descricao ?? ''}
                onChange={(e) => setForm((atual) => ({ ...atual, descricao: e.target.value }))}
                className="w-full rounded-xl border px-3 py-2.5"
                style={FIELD_STYLE}
                placeholder="Resumo do setor"
              />
            </label>

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

          {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">{erro}</p>}
          {!erro && form.filiaisPermitidas.length === 0 && (
            <p className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300">
              Selecione pelo menos uma filial para salvar o setor.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={criarSetor.isPending || atualizarSetor.isPending || form.filiaisPermitidas.length === 0}
              className="rounded-xl bg-[#21478A] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {editing ? 'Salvar alterações' : 'Criar setor'}
            </button>
            {editing && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={SECONDARY_BUTTON_STYLE}
              >
                Cancelar edição
              </button>
            )}
          </div>
        </form>
      </section>

      <DataTable
        titulo="Setores cadastrados"
        dados={linhas}
        chaveLinha="id"
        isLoading={setores.isLoading}
        colunas={isMobileSetoresTable ? colunasSetoresMobile : colunasSetoresDesktop}
      />
    </div>
  );
}
