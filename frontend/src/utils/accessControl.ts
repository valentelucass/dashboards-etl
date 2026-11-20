import type { IUsuarioSessao } from '../types/auth';
import type {
  PermissionCatalogItem,
  PermissionKey,
  PermissionMap,
  PermissionOverrideStateMap,
} from '../types/access';

export const PAPEL_ADMIN_PLATAFORMA = 'admin_plataforma';
export const PAPEL_ADMIN_ACESSO = 'admin_acesso';
export const PAPEL_DESENVOLVEDOR = String(import.meta.env.VITE_ACESSO_USUARIO_SUPREMO_PAPEL ?? 'desenvolvedor');
export const EMAIL_USUARIO_SUPREMO = 'desenvolvedor@rodogarcia.com.br';
export const PAPEL_USUARIO_COMUM = 'usuario_comum';

type UsuarioPapel = Pick<IUsuarioSessao, 'papel'> & Partial<Pick<IUsuarioSessao, 'email'>>;

export interface NavItem {
  label: string;
  path: string;
  permission?: PermissionKey;
  adminOnly?: boolean;
  description?: string;
}

const ADMINISTRATIVE_DASHBOARD_PATHS = new Set(['/executivo', '/etl-saude']);

export function isAdministrativeDashboardNavItem(item: NavItem): boolean {
  return ADMINISTRATIVE_DASHBOARD_PATHS.has(item.path);
}

export const DASHBOARD_NAV_ITEMS: NavItem[] = [
  { label: 'Coletas', path: '/coletas', permission: 'coletas' },
  { label: 'Manifestos - Performan. Veículos', path: '/manifestos', permission: 'manifestos' },
  { label: 'Faturamento', path: '/faturamento', permission: 'fretes' },
  { label: 'Performance', path: '/performance', permission: 'performance' },
  { label: 'Localização de Cargas', path: '/tracking', permission: 'tracking' },
  { label: 'Financeiro e Recebíveis', path: '/faturas-por-cliente', permission: 'faturasPorCliente' },
  { label: 'Contas a Pagar', path: '/contas-a-pagar', permission: 'contasAPagar' },
  { label: 'Cotações', path: '/cotacoes', permission: 'cotacoes' },
  { label: 'Indicadores de Gestão à Vista', path: '/indicadores-gestao-a-vista', permission: 'indicadoresGestaoAVista' },
  { label: 'Executivo', path: '/executivo', permission: 'executivo' },
  { label: 'ETL Saúde', path: '/etl-saude', permission: 'etlSaude' },
  { label: 'Integrações', path: '/painel/integracoes', permission: 'integracoes' },
];

export const ADMIN_NAV_ITEMS: NavItem[] = [
  { label: 'Setores', path: '/admin/setores', adminOnly: true, description: 'Setor define o baseline de acesso' },
  { label: 'Usuários', path: '/admin/usuarios', adminOnly: true, description: 'Herança do setor com negações individuais' },
];

export function createEmptyPermissionMap(): PermissionMap {
  return {
    coletas: false,
    manifestos: false,
    fretes: false,
    performance: false,
    tracking: false,
    faturasPorCliente: false,
    contasAPagar: false,
    cotacoes: false,
    indicadoresGestaoAVista: false,
    executivo: false,
    etlSaude: false,
    integracoes: false,
    dimensoes: false,
    homeComunicados: false,
    can_manage_kpi_goals: false,
    can_manage_communications: false,
  };
}

export function normalizePermissionMap(raw?: Partial<Record<PermissionKey, boolean>>): PermissionMap {
  return {
    ...createEmptyPermissionMap(),
    ...(raw ?? {}),
  };
}

export function createEmptyPermissionOverrideState(): PermissionOverrideStateMap {
  return {
    coletas: 'inherit',
    manifestos: 'inherit',
    fretes: 'inherit',
    performance: 'inherit',
    tracking: 'inherit',
    faturasPorCliente: 'inherit',
    contasAPagar: 'inherit',
    cotacoes: 'inherit',
    indicadoresGestaoAVista: 'inherit',
    executivo: 'inherit',
    etlSaude: 'inherit',
    integracoes: 'inherit',
    dimensoes: 'inherit',
    homeComunicados: 'inherit',
    can_manage_kpi_goals: 'inherit',
    can_manage_communications: 'inherit',
  };
}

export function hasRole(user: UsuarioPapel | null, role: string): boolean {
  return user?.papel === role;
}

export function isAdminPlataforma(user: UsuarioPapel | null): boolean {
  return hasRole(user, PAPEL_ADMIN_PLATAFORMA);
}

export function isDesenvolvedor(user: UsuarioPapel | null): boolean {
  return hasRole(user, PAPEL_DESENVOLVEDOR) || user?.email?.toLowerCase() === EMAIL_USUARIO_SUPREMO;
}

export function isAdminAcesso(user: UsuarioPapel | null): boolean {
  return isDesenvolvedor(user) || isAdminPlataforma(user) || hasRole(user, PAPEL_ADMIN_ACESSO);
}

export function canAccess(user: IUsuarioSessao | null, permission?: PermissionKey): boolean {
  if (!user) return false;
  if (isDesenvolvedor(user) || isAdminPlataforma(user)) return true;
  if (!permission) return true;
  return Boolean(user.permissoesEfetivas[permission]);
}

export function canManageCommunications(user: IUsuarioSessao | null): boolean {
  return canAccess(user, 'can_manage_communications') || canAccess(user, 'homeComunicados');
}

export function firstAccessibleRoute(
  user: Pick<IUsuarioSessao, 'papel' | 'permissoesEfetivas' | 'exigeTrocaSenha'> | null,
): string {
  if (!user) return '/login';
  if (user.exigeTrocaSenha) return '/alterar-senha';

  return '/';
}

export function buildPermissionMapFromCatalog(catalog: PermissionCatalogItem[]): PermissionMap {
  return catalog.reduce((acc, item) => {
    acc[item.chave] = false;
    return acc;
  }, createEmptyPermissionMap());
}

export function permissionSummary(map: PermissionMap, catalog: PermissionCatalogItem[]): string {
  return catalog
    .filter((item) => map[item.chave])
    .map((item) => item.nome)
    .join(', ');
}
