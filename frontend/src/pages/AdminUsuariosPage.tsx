import { useMediaQuery } from '@astryxdesign/core/hooks';
import '../components/admin/admin-directory.css';
import { Grid } from '@astryxdesign/core/Grid';
import PresencePeopleStack from '../components/admin/PresencePeopleStack';
import PeoplePagination from '../components/admin/PeoplePagination';
import { usePresencePage } from '../components/admin/usePresencePage';
import { TableText } from '../components/shared/DashboardTable';
import DashboardLoading from '../components/shared/DashboardLoading';
import { Badge } from '@astryxdesign/core/Badge';
import DashboardButton from "../components/shared/DashboardButton";
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import DashboardAdaptiveDialog from '../components/shared/DashboardAdaptiveDialog';
import { RadioList, RadioListItem } from '@astryxdesign/core/RadioList';
import { Selector } from '@astryxdesign/core/Selector';
import { FormPasswordField, FormTextField } from '../components/shared/FormTextField';
import { CircleHelp, Eye, KeyRound, MoreHorizontal, Pencil, Upload, UserCheck, UserX, Users, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PresenceHistoryContent } from '../components/admin/PresenceHistory';
import TooltipKpi from '../components/shared/TooltipKpi';
import { useAutenticacao } from '../contexts/AutenticacaoContext';
import FiliaisPermitidasSplitSelect from '../components/admin/FiliaisPermitidasSplitSelect';
import PermissionOverrideMatrix from '../components/admin/PermissionOverrideMatrix';
import UsuariosImportacaoModal from '../components/admin/UsuariosImportacaoModal';
import DataTable, { type ColunaTabela } from '../components/shared/DataTable';
import ToastStack from '../components/ui/ToastStack';
import { usePageHeader } from '../contexts/PageHeaderContext';
import {
  useAtualizarUsuario,
  useCatalogoPermissoes,
  useCriarUsuario,
  useExcluirUsuario,
  usePapeisAdmin,
  useRedefinirSenhaUsuario,
  useResumoSessoesUsuariosAdmin,
  useSetoresAdmin,
  useUsuariosAdmin,
} from '../hooks/queries/useAdminAcesso';
import { useFiliais } from '../hooks/queries/useDimensoes';
import { usePermissions } from '../hooks/usePermissions';
import type {
  PapelAdmin,
  PermissionKey,
  PermissionMap,
  PermissionOverrideStateMap,
  UsuarioAdmin,
  UsuarioPayload,
} from '../types/access';
import {
  buildPermissionMapFromCatalog,
  createEmptyPermissionMap,
  createEmptyPermissionOverrideState,
  PAPEL_ADMIN_PLATAFORMA,
  PAPEL_DESENVOLVEDOR,
  permissionSummary,
} from '../utils/accessControl';
import { getApiErrorMessage } from '../utils/apiError';
import { formatarDataHoraMinuto } from '../utils/formatadores';
import { getPasswordPolicyErrors, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy';
import { AlertDialog } from '@astryxdesign/core/AlertDialog';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuDivider, DropdownMenuItem } from '@astryxdesign/core/DropdownMenu';
import { Popover } from '@astryxdesign/core/Popover';

interface UsuarioRow extends UsuarioAdmin {
  presencaAtual: boolean | null;
  propriaConta: boolean;
  acoes: string;
  detalhes: string;
  papelResumo: string;
  permissoesResumo: string;
  negacoesResumo: string;
  concessoesResumo: string;
  filiaisResumo: string;
  senhaResumo: string;
}

const FORM_INICIAL: UsuarioPayload = {
  nome: '',
  email: '',
  senha: '',
  confirmacaoSenha: '',
  setorId: '',
  papel: 'usuario_comum',
  permissoesNegadas: [],
  permissoesConcedidas: [],
  escopoFiliaisTipo: 'HERDAR_SETOR',
  filiaisPermitidasUsuario: [],
  ativo: true,
};

const ESCOPO_FILIAIS_OPTIONS: Array<{
  value: UsuarioPayload['escopoFiliaisTipo'];
  label: string;
  description: string;
}> = [
  { value: 'HERDAR_SETOR', label: 'Herdar do setor', description: 'Usa as filiais configuradas no setor selecionado.' },
  { value: 'TODAS', label: 'Todas as filiais', description: 'Libera dados de todas as filiais.' },
  { value: 'SELECIONADAS', label: 'Somente selecionadas', description: 'Usa uma lista específica para este usuário.' },
];

const SURFACE_STYLE = {
  backgroundColor: 'var(--color-card)',
  borderColor: 'var(--color-border)',
};

const SOFT_PANEL_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
};

const WARNING_PANEL_STYLE = {
  backgroundColor: 'rgba(249, 115, 22, 0.12)',
  borderColor: 'rgba(249, 115, 22, 0.45)',
  color: 'var(--color-text)',
};

const SECONDARY_BUTTON_STYLE = {
  backgroundColor: 'var(--color-bg)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text)',
};

const FOCUS_RING_CLASS = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

const passwordVariant = {
  segura: 'success',
  migrar_no_login: 'warning',
  reset_obrigatorio: 'error',
} as const;

function formatPasswordStatus(status: UsuarioAdmin['statusSenha']): string {
  switch (status) {
    case 'segura':
      return 'Segura';
    case 'migrar_no_login':
      return 'Migrar no login';
    case 'reset_obrigatorio':
      return 'Reset obrigatório';
    default:
      return status;
  }
}

function renderPasswordStatusBadge(status: UsuarioAdmin['statusSenha'], algoritmo: string, passwordResetRequestedAt: string | null) {
  return (
    <div className="flex flex-col gap-1">
      <Badge label={formatPasswordStatus(status)} variant={passwordVariant[status]} />
      <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
        <TableText>Hash: {algoritmo}</TableText>
      </span>
      {passwordResetRequestedAt && (
        <Badge label="Redefinição solicitada" variant="warning" />
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  detail: string;
  value: number;
  accent: string;
  iconSurface: string;
  icon: LucideIcon;
  listTitle: string;
  usuarios: UsuarioAdmin[];
  emptyMessage: string;
  acaoUsuario?: {
    label: string;
    onClick: (usuario: UsuarioAdmin) => void;
  };
}

function SummaryCard({ label, detail, value, accent, iconSurface, icon: Icon, listTitle, usuarios, emptyMessage, acaoUsuario }: SummaryCardProps) {
  const [open, setOpen] = useState(false);
  const pagina = usePresencePage(usuarios);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) pagina.reset();
  }

  function runUserAction(usuario: UsuarioAdmin, button: HTMLButtonElement) {
    if (!acaoUsuario) return;
    const dialog = button.closest('dialog');
    // Aguarda a devolução do foco ao cartão antes de abrir o formulário de senha.
    if (dialog?.open) {
      dialog.addEventListener('close', () => acaoUsuario.onClick(usuario), { once: true });
    } else {
      acaoUsuario.onClick(usuario);
    }
    changeOpen(false);
  }

  return (
    <>
      <div className="grid sm:min-h-[92px] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3.5" style={SURFACE_STYLE}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: iconSurface, color: accent }}>
          <Icon size={19} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold leading-none" style={{ color: accent }}>{value}</span>
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{label}</span>
          </div>
          <div className="mt-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{detail}</div>
        </div>
        <DashboardButton type="button" onClick={() => changeOpen(true)} aria-haspopup="dialog" aria-label={`Ver ${listTitle.toLowerCase()}`} title={`Ver ${listTitle.toLowerCase()}`} className={`self-start rounded-full p-1.5 ${FOCUS_RING_CLASS}`} style={{ color: 'var(--color-primary)' }}>
          <CircleHelp size={16} aria-hidden="true" />
        </DashboardButton>
      </div>
      <DashboardAdaptiveDialog label={listTitle} isOpen={open} onOpenChange={changeOpen}
        purpose="info" sheetHeight="hug" width="min(34rem, calc(100dvw - 2rem))" maxHeight="calc(100dvh - 2rem)" padding={0}>
        <div className="flex items-start justify-between gap-3 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <h2 className="text-base font-bold">{listTitle}</h2>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>{usuarios.length} usuário{usuarios.length === 1 ? '' : 's'}</p>
          </div>
          <Button label={`Fechar ${listTitle.toLowerCase()}`} isIconOnly variant="ghost" size="sm" icon={<X size={18} />} onClick={() => changeOpen(false)} />
        </div>
        <div className="p-3">
          <PeoplePagination label={`Paginação de ${listTitle.toLowerCase()}`} page={pagina.page} totalPages={pagina.totalPages} onChange={pagina.setPage} />
          {usuarios.length ? (
            <ul className="space-y-1.5">
              {pagina.pessoas.map(usuario => (
                <li key={usuario.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--color-bg)' }}>
                  <div className="min-w-0 flex-[1_1_12rem]">
                    <p className="wrap-anywhere text-sm font-semibold">{usuario.nome}</p>
                    <p className="wrap-anywhere text-xs" style={{ color: 'var(--color-text-subtle)' }}>{usuario.email}</p>
                  </div>
                  {acaoUsuario && <Button label={acaoUsuario.label} variant="secondary" size="sm" onClick={event => runUserAction(usuario, event.currentTarget)} />}
                </li>
              ))}
            </ul>
          ) : <p className="px-3 py-5 text-center text-sm" style={{ color: 'var(--color-text-subtle)' }}>{emptyMessage}</p>}
        </div>
      </DashboardAdaptiveDialog>
    </>
  );
}

function timestampAtividade(valor: string | null): number {
  if (!valor) return 0;

  const timestamp = new Date(valor).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function AccessSummaryItem({
  label,
  value,
  expandable = false,
  className = '',
}: {
  label: string;
  value: string;
  expandable?: boolean;
  className?: string;
}) {
  const canExpand = expandable && value.length > 76;

  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2 ${className}`} style={SURFACE_STYLE}>
      <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate text-sm font-medium" title={value} style={{ color: 'var(--color-text)' }}>{value}</span>
        {canExpand && (
          <Popover presentation="adaptive" label={label} alignment="start" width="min(28rem, calc(100vw - 24px))" padding={3}
      content={<div>
              <h4 className="text-sm font-bold">{label}</h4>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-text-subtle)' }}>{value}</p>
        </div>}>
      {trigger => (
        <DashboardButton {...trigger} type="button" className={`shrink-0 rounded-md p-1 ${FOCUS_RING_CLASS}`} aria-label={`Ver todas as ${label.toLowerCase()}`} title={`Ver todas as ${label.toLowerCase()}`} style={{ color: 'var(--color-primary)' }}>
                <MoreHorizontal size={17} aria-hidden="true" />
              </DashboardButton>
      )}
    </Popover>
        )}
      </div>
    </div>
  );
}

function OnlineUsersCard({
  usuarios,
  recentes,
  isLoading,
  isError,
  totalOnline,
  podeVerTrilha,
  atualizadoEm,
}: {
  podeVerTrilha: boolean;
  usuarios: Array<Pick<UsuarioAdmin, 'id' | 'nome' | 'email' | 'ultimaAtividade' | 'ultimaRotaAcessada'>>;
  recentes: Array<Pick<UsuarioAdmin, 'id' | 'nome' | 'email' | 'ultimaAtividade' | 'ultimaRotaAcessada'>>;
  isLoading: boolean;
  isError: boolean;
  totalOnline: number;
  atualizadoEm: number;
}) {
  const [open, setOpen] = useState(false);
  const [folhaAberta, setFolhaAberta] = useState<string | null>();
  const onlinePage = usePresencePage(usuarios);
  const recentesPage = usePresencePage(recentes);
  const folhasVisiveis = [...onlinePage.pessoas, ...recentesPage.pessoas];
  const folhaAtual = folhaAberta === null || folhasVisiveis.some(pessoa => pessoa.id === folhaAberta)
    ? folhaAberta ?? null : folhasVisiveis[0]?.id ?? null;
  const [selecionado, setSelecionado] = useState<{ id: string; nome: string } | null>(null);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      setSelecionado(null);
      setFolhaAberta(undefined);
      onlinePage.reset();
      recentesPage.reset();
    }
  }

  return (
    <>
      <div className="grid sm:min-h-[92px] grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border px-4 py-3.5" style={SURFACE_STYLE}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'rgba(16, 185, 129, 0.14)', color: '#10b981' }}>
          <Users size={19} strokeWidth={2.2} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <TooltipKpi kpiName="administracao.usuariosOnline"><div className="flex items-baseline gap-2">
            {isLoading ? <DashboardLoading label="Consultando presença..." className="max-w-10" /> : <span className="text-2xl font-bold leading-none" style={{ color: '#10b981' }}>{isError ? '—' : totalOnline}</span>}
            <span className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Online agora</span>
          </div></TooltipKpi>
          <div className="mt-1 flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>{isError ? 'Presença indisponível' : isLoading ? null : 'Outras pessoas com a página em foco'}</div>
        </div>
        <DashboardButton type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-label="Ver detalhes de presença" title="Ver detalhes de presença" className={`self-start rounded-full p-1.5 ${FOCUS_RING_CLASS}`} style={{ color: 'var(--color-primary)' }}>
          <CircleHelp size={16} aria-hidden="true" />
        </DashboardButton>
      </div>
      <DashboardAdaptiveDialog label="Presença de usuários" isOpen={open} onOpenChange={changeOpen}
        purpose="info" sheetHeight="hug" width="min(68rem, calc(100dvw - 2rem))" maxHeight="calc(100dvh - 2rem)" padding={0}>
        <div className="admin-presence-panel">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-1">
            <h2 className="flex min-w-0 items-center gap-2 text-base font-bold">
              <Users size={18} className="shrink-0" style={{ color: 'var(--color-primary)' }} aria-hidden="true" />
              Presença de usuários
            </h2>
            <Button label="Fechar presença de usuários" isIconOnly variant="ghost" size="sm" icon={<X size={18} />} onClick={() => changeOpen(false)} />
          </div>
          {selecionado && podeVerTrilha ? <PresenceHistoryContent key={selecionado.id} usuarioId={selecionado.id} nome={selecionado.nome} onClose={() => {
            const pessoaId = selecionado.id;
            setSelecionado(null);
            requestAnimationFrame(() => document.getElementById(`presenca-historico-${pessoaId}`)?.focus({ preventScroll: true }));
          }} /> : <>
          <div className="border-b px-5 pb-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Outras pessoas com a página em foco e sinal nos últimos 75 segundos. Sua conta não entra nesta lista.</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{!isError && atualizadoEm > 0 ? `Consulta realizada às ${new Date(atualizadoEm).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. ` : ''}Atualização a cada 15 segundos.</p>
          </div>
          {isError ? <p role="alert" className="p-5 text-sm">Não foi possível atualizar a presença. Aguardando nova consulta.</p> :
          <Grid className="admin-presence-sections" gap={0} align="start"
            columns={usuarios.length > 0 && recentes.length > 0 ? { minWidth: 384, max: 2 } : 1}
            data-both={usuarios.length > 0 && recentes.length > 0}>
            <section aria-label="Online agora">
              <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Online agora</h3><Badge label={isLoading ? '—' : usuarios.length} variant="success" /></div>
              {isLoading ? <DashboardLoading label="Carregando presença..." /> : usuarios.length > 0 ? <PresencePeopleStack pagina={onlinePage} online aberta={folhaAtual} onOpen={setFolhaAberta} onHistory={podeVerTrilha ? setSelecionado : undefined} /> : <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Nenhuma outra pessoa com presença confirmada agora.</p>}
            </section>
            <section aria-label="Vistos recentemente">
              <div className="mb-3">
                <div className="flex items-center justify-between"><h3 className="text-sm font-bold">Vistos recentemente</h3><Badge label={isLoading ? '—' : recentes.length} variant="neutral" /></div>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-subtle)' }}>Sinais de foco das últimas 24 horas, sem presença confirmada agora.</p>
              </div>
              {isLoading ? <DashboardLoading label="Carregando acessos recentes..." /> : recentes.length > 0 ? <PresencePeopleStack pagina={recentesPage} online={false} aberta={folhaAtual} onOpen={setFolhaAberta} onHistory={podeVerTrilha ? setSelecionado : undefined} /> : <p className="text-sm" style={{ color: 'var(--color-text-subtle)' }}>Ainda não há atividades recentes.</p>}
            </section>
          </Grid>}</>}
        </div>
      </DashboardAdaptiveDialog>
    </>
  );
}

function formatRoleName(nome: string): string {
  return nome
    .split('_')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

function formatFiliaisResumo(filiais: string[], acessoTotal: boolean): string {
  if (acessoTotal) return 'Acesso total';
  return filiais.join(', ') || 'Nenhuma';
}
function mapOverridesToState(permissoesNegadas: string[], permissoesConcedidas: string[]): PermissionOverrideStateMap {
  const proximo = createEmptyPermissionOverrideState();

  for (const permissao of permissoesNegadas) {
    proximo[permissao as keyof PermissionOverrideStateMap] = 'deny';
  }
  for (const permissao of permissoesConcedidas) {
    proximo[permissao as keyof PermissionOverrideStateMap] = 'grant';
  }

  return proximo;
}

function mapStateToNegacoes(state: PermissionOverrideStateMap): UsuarioPayload['permissoesNegadas'] {
  return Object.entries(state)
    .filter(([, valor]) => valor === 'deny')
    .map(([permissaoChave]) => permissaoChave as UsuarioPayload['permissoesNegadas'][number]);
}

function mapStateToConcedidas(state: PermissionOverrideStateMap): UsuarioPayload['permissoesConcedidas'] {
  return Object.entries(state)
    .filter(([, valor]) => valor === 'grant')
    .map(([permissaoChave]) => permissaoChave as UsuarioPayload['permissoesConcedidas'][number]);
}

function buildUsuarioPayload(usuario: UsuarioAdmin, permissoesNegadas: PermissionKey[], permissoesConcedidas: PermissionKey[]): UsuarioPayload {
  return {
    nome: usuario.nome,
    email: usuario.email,
    setorId: usuario.setorId,
    papel: usuario.papel,
    permissoesNegadas,
    permissoesConcedidas,
    escopoFiliaisTipo: usuario.escopoFiliaisTipo,
    filiaisPermitidasUsuario: [...usuario.filiaisPermitidasUsuario],
    ativo: usuario.ativo,
  };
}

function renderStatusBadge(ativo: boolean) {
  return (
    <Badge label={ativo ? 'Ativo' : 'Inativo'} variant={ativo ? 'success' : 'error'} />
  );
}

function renderOnlineBadge(isOnline: boolean | null, propriaConta: boolean) {
  if (propriaConta) return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Sua conta</span>;
  if (isOnline === null) return <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Presença indisponível</span>;
  return (
    <Badge label={isOnline ? 'Online' : 'Offline'} variant={isOnline ? 'success' : 'neutral'} />
  );
}

function formatUltimaAtividade(valor: string | null): string {
  return valor ? formatarDataHoraMinuto(valor) : 'Sem atividade registrada';
}

function renderMobileAccessCell(row: UsuarioRow) {
  return (
    <div className="min-w-0 space-y-2 text-xs leading-relaxed">
      <div className="flex flex-wrap items-center gap-2">
        {renderStatusBadge(row.ativo)}
        <span className="min-w-0 font-medium" style={{ color: 'var(--color-text)' }}>
          <TableText>{row.setorNome}</TableText>
        </span>
      </div>

      <div className="space-y-1 break-words">
        <p style={{ color: 'var(--color-text)' }}><TableText>{row.papelResumo || 'Sem papel'}</TableText></p>
        <p style={{ color: 'var(--color-text-muted)' }}><TableText>{row.senhaResumo}</TableText></p>
        <p style={{ color: 'var(--color-text-muted)' }}>
          <TableText>Última tela: {row.ultimaRotaAcessada ?? 'Sem registro'}</TableText>
        </p>
      </div>
    </div>
  );
}

function formatEscopoFiliaisTipo(value: UsuarioAdmin['escopoFiliaisTipo']) {
  switch (value) {
    case 'HERDAR_SETOR':
      return 'Herdar do setor';
    case 'TODAS':
      return 'Todas as filiais';
    case 'SELECIONADAS':
      return 'Somente selecionadas';
    default:
      return value;
  }
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={SOFT_PANEL_STYLE}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-subtle)' }}>
        {label}
      </div>
      <div className="mt-1 break-words text-sm font-medium" style={{ color: 'var(--color-text)' }}>
        {value || 'Nenhuma'}
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

function renderUsuarioIdentityCell(row: UsuarioRow) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text)' }}>
        <TableText>{row.nome}</TableText>
      </p>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        <TableText>{row.email}</TableText>
      </p>
    </div>
  );
}

function renderPapelCell(row: UsuarioRow) {
  return (
    <div className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
      <TableText>{row.papelResumo || 'Sem papel'}</TableText>
    </div>
  );
}

function renderUltimaTelaCell(row: UsuarioRow) {
  const atividade = formatUltimaAtividade(row.ultimaAtividade);

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {renderOnlineBadge(row.presencaAtual, row.propriaConta)}
        <span className="min-w-0 text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          <TableText>{row.ultimaRotaAcessada ?? 'Sem registro'}</TableText>
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <TableText>{atividade}</TableText>
      </p>
    </div>
  );
}

function renderUsuarioDetailsPopover(row: UsuarioRow) {
  return (
    <Popover presentation="adaptive" label={"Detalhes de " + row.nome} alignment="end" width="min(30rem, calc(100vw - 24px))" padding={3}
      content={<div className="max-h-[min(34rem,70dvh)] overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                {row.nome}
              </h3>
              <p className="break-all text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {row.email}
              </p>
            </div>
            {renderStatusBadge(row.ativo)}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DetailItem label="Setor" value={row.setorNome} />
            <DetailItem label="Papel" value={row.papelResumo || 'Sem papel'} />
            <DetailItem label="Escopo" value={formatEscopoFiliaisTipo(row.escopoFiliaisTipo)} />
            <DetailItem label="Senha" value={row.senhaResumo} />
            <DetailItem label="Última tela" value={row.ultimaRotaAcessada ?? 'Sem registro'} />
            <DetailItem label="Última atividade" value={formatUltimaAtividade(row.ultimaAtividade)} />
          </div>

          <DetailTextBlock label="Filiais efetivas" value={row.filiaisResumo} fallback="Acesso total" />
          <DetailTextBlock
            label="Filiais próprias"
            value={formatFiliaisResumo(row.filiaisPermitidasUsuario, row.escopoFiliaisTipo === 'TODAS')}
            fallback="Nenhuma"
          />
          <DetailTextBlock label="Permissões efetivas" value={row.permissoesResumo} fallback="Sem permissões" />
          <DetailTextBlock label="Concessões individuais" value={row.concessoesResumo} fallback="Nenhuma" />
          <DetailTextBlock label="Negações individuais" value={row.negacoesResumo} fallback="Nenhuma" />
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

export default function AdminUsuariosPage() {
  const { usuario: operador } = useAutenticacao();
  const { isAdminPlataforma, isDesenvolvedor } = usePermissions();
  const catalogo = useCatalogoPermissoes();
  const papeis = usePapeisAdmin();
  const setores = useSetoresAdmin();
  const filiais = useFiliais();
  const usuarios = useUsuariosAdmin();
  const resumoSessoes = useResumoSessoesUsuariosAdmin();
  const criarUsuario = useCriarUsuario();
  const atualizarUsuario = useAtualizarUsuario();
  const excluirUsuario = useExcluirUsuario();
  const redefinirSenhaUsuario = useRedefinirSenhaUsuario();
  const [editing, setEditing] = useState<UsuarioAdmin | null>(null);
  const [form, setForm] = useState<UsuarioPayload>(FORM_INICIAL);
  const [erro, setErro] = useState('');
  const [inativacao, setInativacao] = useState<UsuarioAdmin | null>(null);
  const [sucesso, setSucesso] = useState('');
  const [usuarioParaRedefinirSenha, setUsuarioParaRedefinirSenha] = useState<UsuarioAdmin | null>(null);
  const [senhaTemporaria, setSenhaTemporaria] = useState('');
  const [confirmacaoSenhaTemporaria, setConfirmacaoSenhaTemporaria] = useState('');
  const [mostrarSenhaFormulario, setMostrarSenhaFormulario] = useState(false);
  const [mostrarSenhaTemporaria, setMostrarSenhaTemporaria] = useState(false);
  const [erroRedefinicaoSenha, setErroRedefinicaoSenha] = useState('');
  const [overrideState, setOverrideState] = useState<PermissionOverrideStateMap>(createEmptyPermissionOverrideState());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const isMobileUsersTable = useMediaQuery('(max-width: 860px)');
  const podeOperarPapelElevado = isAdminPlataforma || isDesenvolvedor;
  const filiaisDisponiveis = filiais.data ?? [];
  const senhaEmEdicao = form.senha ?? '';
  const senhaPolicyErrors = useMemo(
    () => (senhaEmEdicao.trim() ? getPasswordPolicyErrors(senhaEmEdicao) : []),
    [senhaEmEdicao],
  );

  const setorSelecionado = useMemo(
    () => (setores.data ?? []).find((setor) => setor.id === form.setorId) ?? null,
    [form.setorId, setores.data],
  );

  const baseline = setorSelecionado?.templatePermissoes ?? createEmptyPermissionMap();
  const papelComAcessoTotal = form.papel === PAPEL_ADMIN_PLATAFORMA
    || (Boolean(PAPEL_DESENVOLVEDOR) && form.papel === PAPEL_DESENVOLVEDOR);
  const escopoComAcessoTotal = papelComAcessoTotal || form.escopoFiliaisTipo === 'TODAS';
  const filiaisEfetivasPreview = useMemo(() => {
    if (escopoComAcessoTotal) {
      return [];
    }

    if (form.escopoFiliaisTipo === 'SELECIONADAS') {
      return [...form.filiaisPermitidasUsuario].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    }

    return setorSelecionado?.filiaisPermitidas ?? [];
  }, [escopoComAcessoTotal, form.escopoFiliaisTipo, form.filiaisPermitidasUsuario, setorSelecionado?.filiaisPermitidas]);

  useEffect(() => {
    if (!sucesso) return undefined;

    const timeoutId = window.setTimeout(() => setSucesso(''), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [sucesso]);

  usePageHeader({
    title: 'Gestão de usuários',
    description: 'Herança por setor, escopo de filiais e exceções individuais de acesso.',
  });

  const permissoesEfetivasPreview = useMemo<PermissionMap>(() => {
    if (form.papel === PAPEL_ADMIN_PLATAFORMA) {
      const completo = buildPermissionMapFromCatalog(catalogo.data ?? []);
      return Object.keys(completo).reduce((acc, key) => {
        acc[key as keyof PermissionMap] = true;
        return acc;
      }, { ...completo });
    }

    const proximo = { ...baseline };
    for (const [permissaoChave, modo] of Object.entries(overrideState)) {
      if (modo === 'deny') {
        proximo[permissaoChave as keyof PermissionMap] = false;
      } else if (modo === 'grant') {
        proximo[permissaoChave as keyof PermissionMap] = true;
      }
    }
    return proximo;
  }, [baseline, catalogo.data, form.papel, overrideState]);

  const negacoesPreview = useMemo(
    () => mapStateToNegacoes(overrideState)
      .map((chave) => catalogo.data?.find((item) => item.chave === chave)?.nome ?? chave)
      .join(', ') || 'Nenhuma',
    [catalogo.data, overrideState],
  );

  const concessoesPreview = useMemo(
    () => mapStateToConcedidas(overrideState)
      .map((chave) => catalogo.data?.find((item) => item.chave === chave)?.nome ?? chave)
      .join(', ') || 'Nenhuma',
    [catalogo.data, overrideState],
  );

  const linhas = useMemo<UsuarioRow[]>(
    () =>
      (usuarios.data ?? []).map((usuario) => ({
        ...usuario,
        propriaConta: usuario.id === operador?.id,
        presencaAtual: resumoSessoes.isError || !resumoSessoes.data ? null :
          resumoSessoes.data.usuariosOnlineDetalhes.some(item => item.id === usuario.id),
        ultimaAtividade: resumoSessoes.data?.usuariosOnlineDetalhes.find(item => item.id === usuario.id)?.ultimaAtividade ?? usuario.ultimaAtividade,
        ultimaRotaAcessada: resumoSessoes.data?.usuariosOnlineDetalhes.find(item => item.id === usuario.id)?.ultimaRotaAcessada ?? usuario.ultimaRotaAcessada,
        detalhes: usuario.id,
        papelResumo: papeis.data?.find((papel) => papel.nome === usuario.papel)?.descricao ?? formatRoleName(usuario.papel),
        permissoesResumo: permissionSummary(usuario.permissoesEfetivas, catalogo.data ?? []),
        negacoesResumo: usuario.permissoesNegadas
          .map((chave) => catalogo.data?.find((item) => item.chave === chave)?.nome ?? chave)
          .join(', '),
        concessoesResumo: usuario.permissoesConcedidas
          .map((chave) => catalogo.data?.find((item) => item.chave === chave)?.nome ?? chave)
          .join(', '),
        filiaisResumo: formatFiliaisResumo(usuario.filiaisPermitidasEfetivas, usuario.filiaisPermitidasEfetivas.length === 0),
        senhaResumo: `${formatPasswordStatus(usuario.statusSenha)} • ${usuario.algoritmoSenha}${usuario.passwordResetRequestedAt ? ' • Redefinição solicitada' : ''}`,
        acoes: usuario.id,
      })),
    [catalogo.data, papeis.data, usuarios.data, resumoSessoes.data, resumoSessoes.isError, operador?.id],
  );

  const resumoUsuarios = resumoSessoes.data ?? {
    totalUsuarios: 0,
    usuariosAtivos: 0,
    usuariosInativos: 0,
    usuariosOnline: 0,
    usuariosOnlineDetalhes: [],
  };
  const usuariosOnlineAgora = useMemo(
    () =>
      resumoUsuarios.usuariosOnlineDetalhes.filter(usuario => usuario.id !== operador?.id)
        .sort((a, b) => timestampAtividade(b.ultimaAtividade) - timestampAtividade(a.ultimaAtividade)),
    [resumoUsuarios.usuariosOnlineDetalhes, operador?.id],
  );
  const usuariosVistosRecentemente = useMemo(
    () => {
      const idsOnline = new Set(usuariosOnlineAgora.map(usuario => usuario.id));
      return (resumoSessoes.data?.usuariosRecentes ?? [])
        .filter(usuario => usuario.id !== operador?.id && !idsOnline.has(usuario.id))
        .map(usuario => ({ ...usuario, ultimaRotaAcessada: usuario.ultimaRotaAcessada ?? null }));
    },
    [resumoSessoes.data?.usuariosRecentes, operador?.id, usuariosOnlineAgora],
  );
  const usuariosOnlineComDetalhes = useMemo(
    () => usuariosOnlineAgora.map((usuario) => ({
      ...usuario,
      ultimaRotaAcessada: usuario.ultimaRotaAcessada ?? null,
    })),
    [usuariosOnlineAgora],
  );
  const usuariosOrdenadosPorNome = useMemo(
    () => [...(usuarios.data ?? [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [usuarios.data],
  );
  const usuariosAtivos = useMemo(
    () => usuariosOrdenadosPorNome.filter((usuario) => usuario.ativo),
    [usuariosOrdenadosPorNome],
  );
  const usuariosComSolicitacaoRedefinicao = useMemo(
    () => usuariosOrdenadosPorNome
      .filter((usuario) => Boolean(usuario.passwordResetRequestedAt))
      .sort((a, b) => Date.parse(b.passwordResetRequestedAt ?? '') - Date.parse(a.passwordResetRequestedAt ?? '')),
    [usuariosOrdenadosPorNome],
  );

  function resetForm() {
    setEditing(null);
    setForm(FORM_INICIAL);
    setErro('');
    setSucesso('');
    setOverrideState(createEmptyPermissionOverrideState());
  }

  function startEdit(usuario: UsuarioAdmin) {
    setEditing(usuario);
    setForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      confirmacaoSenha: '',
      setorId: usuario.setorId,
      papel: usuario.papel,
      permissoesNegadas: [...usuario.permissoesNegadas],
      permissoesConcedidas: [...usuario.permissoesConcedidas],
      escopoFiliaisTipo: usuario.escopoFiliaisTipo,
      filiaisPermitidasUsuario: [...usuario.filiaisPermitidasUsuario],
      ativo: usuario.ativo,
    });
    setOverrideState(mapOverridesToState(usuario.permissoesNegadas, usuario.permissoesConcedidas));
    setErro('');
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro('');

    if (!form.setorId) {
      setErro('Selecione o setor do usuário.');
      return;
    }

    if (form.senha?.trim()) {
      const errors = getPasswordPolicyErrors(form.senha);
      if (errors.length > 0) {
        setErro(errors[0]);
        return;
      }
    }

    if (form.escopoFiliaisTipo === 'SELECIONADAS' && form.filiaisPermitidasUsuario.length === 0) {
      setErro('Selecione ao menos uma filial para o usuário.');
      return;
    }

    const payload: UsuarioPayload = {
      ...form,
      senha: form.senha?.trim() ? form.senha : undefined,
      confirmacaoSenha: form.confirmacaoSenha?.trim() ? form.confirmacaoSenha : undefined,
      permissoesNegadas: mapStateToNegacoes(overrideState),
      permissoesConcedidas: mapStateToConcedidas(overrideState),
      filiaisPermitidasUsuario: form.escopoFiliaisTipo === 'SELECIONADAS' ? form.filiaisPermitidasUsuario : [],
    };

    try {
      if (editing) {
        await atualizarUsuario.mutateAsync({ id: editing.id, payload });
      } else {
        await criarUsuario.mutateAsync(payload);
      }

      resetForm();
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  async function handleInativar(usuario: UsuarioAdmin) {

    try {
      await excluirUsuario.mutateAsync(usuario.id);
      if (editing?.id === usuario.id) resetForm();
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  function abrirRedefinicaoSenha(usuario: UsuarioAdmin) {
    setUsuarioParaRedefinirSenha(usuario);
    setSenhaTemporaria('');
    setConfirmacaoSenhaTemporaria('');
    setErroRedefinicaoSenha('');
  }

  function fecharRedefinicaoSenha() {
    if (redefinirSenhaUsuario.isPending) return;
    setUsuarioParaRedefinirSenha(null);
    setSenhaTemporaria('');
    setConfirmacaoSenhaTemporaria('');
    setErroRedefinicaoSenha('');
  }

  async function handleRedefinirSenha(event: FormEvent) {
    event.preventDefault();
    if (!usuarioParaRedefinirSenha) return;

    setErroRedefinicaoSenha('');
    if (senhaTemporaria !== confirmacaoSenhaTemporaria) {
      setErroRedefinicaoSenha('A confirmação da senha temporária não confere.');
      return;
    }

    const passwordErrors = getPasswordPolicyErrors(senhaTemporaria);
    if (passwordErrors.length > 0) {
      setErroRedefinicaoSenha(passwordErrors[0]);
      return;
    }

    setErro('');
    setSucesso('');
    try {
      await redefinirSenhaUsuario.mutateAsync({
        id: usuarioParaRedefinirSenha.id,
        payload: { senhaTemporaria },
      });
      setSucesso('Senha redefinida. Informe a senha temporária ao usuário por um canal seguro.');
      fecharRedefinicaoSenha();
    } catch (error) {
      setErroRedefinicaoSenha(getApiErrorMessage(error));
    }
  }

  async function handleTogglePermissaoRapida(usuario: UsuarioAdmin, permissoes: PermissionKey | PermissionKey[], permitir: boolean) {
    const negadas = new Set(usuario.permissoesNegadas);
    const concedidas = new Set(usuario.permissoesConcedidas);
    const permissoesAlvo = Array.isArray(permissoes) ? permissoes : [permissoes];

    for (const permissao of permissoesAlvo) {
      if (permitir) {
        negadas.delete(permissao);
        concedidas.add(permissao);
      } else {
        concedidas.delete(permissao);
        negadas.add(permissao);
      }
    }

    const payload = buildUsuarioPayload(
      usuario,
      Array.from(negadas).sort(),
      Array.from(concedidas).sort(),
    );

    try {
      const atualizado = await atualizarUsuario.mutateAsync({ id: usuario.id, payload });
      if (editing?.id === usuario.id) {
        startEdit(atualizado);
      }
    } catch (error) {
      setErro(getApiErrorMessage(error));
    }
  }

  const salvando =
    criarUsuario.isPending
    || atualizarUsuario.isPending
    || redefinirSenhaUsuario.isPending
    || papeis.isLoading
    || setores.isLoading
    || (form.escopoFiliaisTipo === 'SELECIONADAS' && filiais.isLoading);

  function renderActionMenu(row: UsuarioRow) {
    const usuarioSupremo = row.papel === PAPEL_DESENVOLVEDOR;
    const bloqueado = usuarioSupremo || (!podeOperarPapelElevado && row.papel !== 'usuario_comum');
    const podeGerenciarMetas = Boolean(row.permissoesEfetivas.can_manage_kpi_goals);
    const podeGerenciarComunicacoes = Boolean(row.permissoesEfetivas.can_manage_communications || row.permissoesEfetivas.homeComunicados);
    const operacaoRapidaBloqueada = bloqueado || atualizarUsuario.isPending || redefinirSenhaUsuario.isPending;

    return (
      <DropdownMenu alignment="end" menuWidth={288} hasChevron={false}
        button={{ label: 'Abrir ações de ' + row.nome, isIconOnly: true, icon: <MoreHorizontal size={17} /> }}>
        <DropdownMenuItem label="Editar" icon={<Pencil size={14} />} isDisabled={bloqueado} onClick={() => startEdit(row)} />
        <DropdownMenuItem label="Inativar" icon={<UserX size={14} />} variant="destructive"
          isDisabled={bloqueado} onClick={() => setInativacao(row)} />
        <DropdownMenuItem label="Redefinir senha" icon={<KeyRound size={14} />}
          isDisabled={bloqueado || redefinirSenhaUsuario.isPending} onClick={() => abrirRedefinicaoSenha(row)} />
        <DropdownMenuDivider />
        <DropdownMenuCheckboxItem label="Permitir gerenciar metas de indicadores" value={podeGerenciarMetas}
          isDisabled={operacaoRapidaBloqueada} onChange={allowed => void handleTogglePermissaoRapida(row, 'can_manage_kpi_goals', allowed)} />
        <DropdownMenuCheckboxItem label="Permitir alterar comunicações" value={podeGerenciarComunicacoes}
          isDisabled={operacaoRapidaBloqueada} onChange={allowed => void handleTogglePermissaoRapida(row, ['can_manage_communications', 'homeComunicados'], allowed)} />
      </DropdownMenu>
    );
  }

  const colunasUsuariosDesktop: ColunaTabela<UsuarioRow>[] = [
    {
      chave: 'nome',
      label: 'Usuário',
      fixo: true,
      largura: '220px',
      formato: (_, row) => renderUsuarioIdentityCell(row),
    },
    { chave: 'setorNome', label: 'Setor', largura: '130px' },
    {
      chave: 'ativo',
      label: 'Status',
      largura: '84px',
      alinhamento: 'center',
      formato: (_, row) => renderStatusBadge(row.ativo),
    },
    {
      chave: 'papelResumo',
      label: 'Papel',
      largura: '190px',
      formato: (_, row) => renderPapelCell(row),
    },
    {
      chave: 'ultimaRotaAcessada',
      label: 'Última tela',
      largura: '190px',
      formato: (_, row) => renderUltimaTelaCell(row),
    },
    {
      chave: 'senhaResumo',
      label: 'Senha',
      largura: '120px',
      ordenavel: false,
      formato: (_, row) => renderPasswordStatusBadge(row.statusSenha, row.algoritmoSenha, row.passwordResetRequestedAt),
    },
    {
      chave: 'detalhes',
      label: 'Detalhes',
      largura: '100px',
      ordenavel: false,
      formato: (_, row) => renderUsuarioDetailsPopover(row),
    },
    {
      chave: 'acoes',
      label: 'Ações',
      largura: '64px',
      ordenavel: false,
      formato: (_, row) => renderActionMenu(row),
    },
  ];

  const colunasUsuariosMobile: ColunaTabela<UsuarioRow>[] = [
    {
      chave: 'nome',
      label: 'Usuário',
      formato: (_, row) => (
        <div className="grid min-w-0 gap-2 whitespace-normal py-1">
          {renderUsuarioIdentityCell(row)}
          {renderMobileAccessCell(row)}
          <div className="flex flex-wrap items-center gap-2">
            {renderOnlineBadge(row.presencaAtual, row.propriaConta)}
            {renderUsuarioDetailsPopover(row)}
            {renderActionMenu(row)}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="dashboard-admin admin-directory-page space-y-5">
      {sucesso && <ToastStack items={[{ id: 'redefinicao-senha', message: sucesso, tone: 'success' }]} />}
      {usuarioParaRedefinirSenha && (
        <DashboardAdaptiveDialog label="Redefinir senha" isOpen purpose="form" aria-labelledby="redefinir-senha-titulo"
          onOpenChange={open => { if (!open && !redefinirSenhaUsuario.isPending) fecharRedefinicaoSenha(); }}
          width="min(92vw, 30rem)" className="dashboard-admin">
          <form onSubmit={handleRedefinirSenha} className="space-y-4">
            <div className="space-y-1">
              <h2 id="redefinir-senha-titulo" className="text-lg font-bold">Redefinir senha</h2>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Defina a senha temporária para {usuarioParaRedefinirSenha.email}. Informe-a por um canal seguro.
              </p>
            </div>
            {erroRedefinicaoSenha && <Banner status="error" title={erroRedefinicaoSenha} role="alert" />}
            <FormPasswordField label="Senha temporária" autoComplete="new-password" required minLength={12}
              value={senhaTemporaria} onChange={setSenhaTemporaria} hint={PASSWORD_POLICY_HINT}
              visible={mostrarSenhaTemporaria} onToggle={() => setMostrarSenhaTemporaria(value => !value)} />
            <FormPasswordField label="Confirmar senha temporária" autoComplete="new-password" required minLength={12}
              value={confirmacaoSenhaTemporaria} onChange={setConfirmacaoSenhaTemporaria} visible={mostrarSenhaTemporaria} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button label="Cancelar" variant="secondary" className="dashboard-form-secondary"
                isDisabled={redefinirSenhaUsuario.isPending} onClick={fecharRedefinicaoSenha} />
              <Button label="Redefinir senha" type="submit" variant="primary" className="dashboard-form-submit"
                isLoading={redefinirSenhaUsuario.isPending} />
            </div>
          </form>
        </DashboardAdaptiveDialog>
      )}
      <Card padding={0} className="dashboard-admin-card">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4 xl:gap-4">
            <SummaryCard label="Total" detail="usuários cadastrados" value={resumoUsuarios.totalUsuarios} accent="var(--color-primary)" iconSurface="rgba(33, 71, 138, 0.14)" icon={Users} listTitle="Todos os usuários" usuarios={usuariosOrdenadosPorNome} emptyMessage="Nenhum usuário cadastrado." />
            <SummaryCard label="Ativos" detail="com acesso liberado" value={resumoUsuarios.usuariosAtivos} accent="#10b981" iconSurface="rgba(16, 185, 129, 0.14)" icon={UserCheck} listTitle="Usuários ativos" usuarios={usuariosAtivos} emptyMessage="Nenhum usuário ativo." />
            <SummaryCard
              label="Solicitações"
              detail="aguardando redefinição"
              value={usuariosComSolicitacaoRedefinicao.length}
              accent="#f97316"
              iconSurface="rgba(249, 115, 22, 0.14)"
              icon={KeyRound}
              listTitle="Solicitações de redefinição"
              usuarios={usuariosComSolicitacaoRedefinicao}
              emptyMessage="Nenhuma solicitação pendente."
              acaoUsuario={{ label: 'Redefinir', onClick: abrirRedefinicaoSenha }}
            />
            <OnlineUsersCard
              atualizadoEm={resumoSessoes.dataUpdatedAt}
              usuarios={usuariosOnlineComDetalhes}
              recentes={usuariosVistosRecentemente}
              isError={resumoSessoes.isError}
              isLoading={resumoSessoes.isLoading}
              totalOnline={resumoUsuarios.usuariosOnline}
              podeVerTrilha={resumoUsuarios.podeVerTrilha ?? false}
            />
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <h2>{editing ? 'Editar usuário' : 'Cadastro de usuário'}</h2>
          <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
            <FormTextField label="Nome" value={form.nome} required
              onChange={nome => setForm(atual => ({ ...atual, nome }))} />
            <FormTextField label="E-mail" type="email" value={form.email} required
              onChange={email => setForm(atual => ({ ...atual, email }))} />
            <FormPasswordField label="Senha" value={form.senha ?? ''} required={!editing} isOptional={Boolean(editing)}
              autoComplete="new-password" minLength={12} hint={PASSWORD_POLICY_HINT}
              visible={mostrarSenhaFormulario} onToggle={() => setMostrarSenhaFormulario(value => !value)}
              onChange={senha => setForm(atual => ({ ...atual, senha }))} />
            <FormPasswordField label="Confirmar senha" value={form.confirmacaoSenha ?? ''} required={!editing} isOptional={Boolean(editing)}
              autoComplete="new-password" minLength={12} visible={mostrarSenhaFormulario}
              onChange={confirmacaoSenha => setForm(atual => ({ ...atual, confirmacaoSenha }))} />
            <Selector presentation="adaptive" label="Setor" placeholder="Selecione" value={form.setorId || undefined} isRequired
              options={(setores.data ?? []).map(setor => ({ value: setor.id, label: setor.nome }))}
              onChange={setorId => setForm(atual => ({ ...atual, setorId }))} width="100%" controlClassName="dashboard-admin-selector" />
            <fieldset className="dashboard-admin-status">
              <legend>Status da conta</legend>
              <CheckboxInput label="Usuário ativo" value={form.ativo}
                onChange={ativo => setForm(atual => ({ ...atual, ativo }))} />
            </fieldset>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Escopo de filiais do usuário</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                Defina se este usuário herda o setor ou usa uma regra própria de filiais.
              </p>
            </div>

            <RadioList label="Escopo de filiais do usuário" isLabelHidden value={form.escopoFiliaisTipo}
              controlClassName="dashboard-admin-radio-list" onChange={value => {
                const option = ESCOPO_FILIAIS_OPTIONS.find(item => item.value === value);
                if (!option) return;
                setForm(atual => ({
                  ...atual,
                  escopoFiliaisTipo: option.value,
                  filiaisPermitidasUsuario: option.value === 'SELECIONADAS' ? atual.filiaisPermitidasUsuario : [],
                }));
              }}>
              {ESCOPO_FILIAIS_OPTIONS.map(opcao => (
                <RadioListItem key={opcao.value} value={opcao.value} label={opcao.label} description={opcao.description} />
              ))}
            </RadioList>

            {form.escopoFiliaisTipo === 'SELECIONADAS' && (
              <FiliaisPermitidasSplitSelect
                opcoes={filiaisDisponiveis}
                selecionadas={form.filiaisPermitidasUsuario}
                onChange={(filiaisPermitidasUsuario) => setForm((atual) => ({ ...atual, filiaisPermitidasUsuario }))}
                isLoading={filiais.isLoading}
              />
            )}
          </div>

          {senhaPolicyErrors.length > 0 && (
            <div
              className="rounded-2xl border px-4 py-3 text-sm"
              style={WARNING_PANEL_STYLE}
            >
              {senhaPolicyErrors[0]}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Papel administrativo</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                Escolha exatamente um papel para definir o alcance administrativo do usuário.
              </p>
            </div>

            <RadioList label="Papel administrativo" isLabelHidden value={form.papel}
              controlClassName="dashboard-admin-radio-list" onChange={papel => setForm(atual => ({ ...atual, papel }))}>
              {(papeis.data ?? []).map((papel: PapelAdmin) => (
                <RadioListItem key={papel.id} value={papel.nome} label={formatRoleName(papel.nome)}
                  description={papel.descricao ?? 'Sem descrição'} />
              ))}
            </RadioList>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Permissões individuais</h2>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                Ajuste exceções de dashboards sobre o baseline herdado do setor.
              </p>
            </div>

            <div className="rounded-2xl border p-3" style={SOFT_PANEL_STYLE}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text)' }}>
                  Resumo do acesso
                </h3>
                <span className="text-[11px]" style={{ color: 'var(--color-text-subtle)' }}>
                  Prévia do acesso final
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <AccessSummaryItem label="Setor" value={setorSelecionado?.nome ?? 'Selecione um setor'} />
                <AccessSummaryItem label="Papel" value={formatRoleName(form.papel)} />
                <AccessSummaryItem label="Filiais efetivas" value={formatFiliaisResumo(filiaisEfetivasPreview, escopoComAcessoTotal)} />
                <AccessSummaryItem label="Baseline herdado" value={permissionSummary(baseline, catalogo.data ?? []) || 'Sem permissões'} />
                <AccessSummaryItem label="Negações" value={negacoesPreview} />
                <AccessSummaryItem label="Concessões individuais" value={concessoesPreview} />
                <AccessSummaryItem label="Permissões efetivas" value={permissionSummary(permissoesEfetivasPreview, catalogo.data ?? []) || 'Sem permissões'} expandable className="sm:col-span-2" />
              </div>
            </div>

            <PermissionOverrideMatrix
              catalogo={catalogo.data ?? []}
              baseline={baseline}
              papel={form.papel}
              valor={overrideState}
              onChange={setOverrideState}
              disabled={catalogo.isLoading || !form.setorId || form.papel === PAPEL_ADMIN_PLATAFORMA}
            />
          </div>

          {erro && <Banner status="error" title={erro} role="alert" />}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" label={editing ? 'Salvar alterações' : 'Criar usuário'} variant="primary"
              className="dashboard-form-submit" isLoading={salvando} />
            <Button label="Importar usuários (Excel)" icon={<Upload size={16} />} variant="secondary"
              className="dashboard-form-secondary" onClick={() => setIsImportModalOpen(true)} />
            {editing && <Button label="Cancelar edição" variant="ghost" className="dashboard-form-secondary" onClick={resetForm} />}
          </div>
        </form>
      </Card>

      <DataTable
        titulo="Usuários cadastrados"
        dados={linhas}
        chaveLinha="id"
        isLoading={usuarios.isLoading}
        error={usuarios.error}
        errorFallbackMessage="Não foi possível carregar a lista de usuários."
        colunas={isMobileUsersTable ? colunasUsuariosMobile : colunasUsuariosDesktop}
      />
      <UsuariosImportacaoModal open={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
      {inativacao && (
        <AlertDialog isOpen title="Inativar usuário?" description={inativacao.email + ' perderá o acesso ao portal.'}
          actionLabel="Inativar" onOpenChange={open => { if (!open) setInativacao(null); }}
          onAction={() => { setInativacao(null); void handleInativar(inativacao); }} />
      )}
    </div>
  );
}
