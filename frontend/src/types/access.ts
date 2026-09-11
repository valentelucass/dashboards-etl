export const PERMISSION_KEYS = [
  'coletas',
  'manifestos',
  'fretes',
  'performance',
  'tracking',
  'faturasPorCliente',
  'contasAPagar',
  'cotacoes',
  'indicadoresGestaoAVista',
  'executivo',
  'etlSaude',
  'integracoes',
  'dimensoes',
  'homeComunicados',
  'can_manage_kpi_goals',
  'can_manage_communications',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export type PermissionMap = Record<PermissionKey, boolean>;
export type OverrideTipo = 'DENY' | 'GRANT';
export type PermissionOverrideMode = 'inherit' | 'deny' | 'grant';
export type PermissionOverrideStateMap = Record<PermissionKey, PermissionOverrideMode>;
export type EscopoFiliaisTipo = 'HERDAR_SETOR' | 'TODAS' | 'SELECIONADAS';

export interface PermissionCatalogItem {
  chave: PermissionKey;
  nome: string;
  descricao: string;
  rota: string | null;
}

export interface SetorAdmin {
  id: string;
  nome: string;
  descricao: string | null;
  sistema: boolean;
  ativo: boolean;
  totalUsuarios: number;
  templatePermissoes: PermissionMap;
  filiaisPermitidas: string[];
}

export interface SetorPayload {
  nome: string;
  descricao: string | null;
  permissoes: PermissionMap;
  filiaisPermitidas: string[];
}

export interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  setorId: string;
  setorNome: string;
  papel: string;
  permissoesEfetivas: PermissionMap;
  escopoFiliaisTipo: EscopoFiliaisTipo;
  filiaisPermitidasUsuario: string[];
  filiaisPermitidasEfetivas: string[];
  permissoesNegadas: PermissionKey[];
  permissoesConcedidas: PermissionKey[];
  statusSenha: 'segura' | 'migrar_no_login' | 'reset_obrigatorio';
  algoritmoSenha: string;
  passwordResetRequestedAt: string | null;
  isOnline: boolean;
  ultimaAtividade: string | null;
  ultimaRotaAcessada: string | null;
}

export interface UsuarioOnlineResumo {
  id: string;
  nome: string;
  email: string;
  ultimaAtividade: string | null;
  ultimaRotaAcessada?: string | null;
}

export interface UsuarioPayload {
  nome: string;
  email: string;
  senha?: string;
  confirmacaoSenha?: string;
  setorId: string;
  papel: string;
  permissoesNegadas: PermissionKey[];
  permissoesConcedidas: PermissionKey[];
  escopoFiliaisTipo: EscopoFiliaisTipo;
  filiaisPermitidasUsuario: string[];
  ativo: boolean;
}

export interface RedefinirSenhaUsuarioPayload {
  senhaTemporaria: string;
}

export interface PapelAdmin {
  id: number;
  nome: string;
  descricao: string | null;
  nivel: number;
}

export interface UsuariosSessaoResumo {
  podeVerTrilha?: boolean;
  totalUsuarios: number;
  usuariosAtivos: number;
  usuariosInativos: number;
  usuariosOnline: number;
  usuariosOnlineDetalhes: UsuarioOnlineResumo[];
  usuariosRecentes?: UsuarioOnlineResumo[];
}

export interface PermissaoOverride {
  permissaoChave: PermissionKey;
  tipo: OverrideTipo;
}

export interface AuditLogEntry {
  id: number;
  timestamp: string;
  usuarioLogin: string | null;
  acao: string;
  recurso: string | null;
  detalhesJson: string | null;
  ipAddress: string | null;
}

export interface AuditLogPage {
  content: AuditLogEntry[];
  totalPages: number;
  totalElements: number;
}
