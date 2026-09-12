import clienteAxios from '../clienteAxios';
import type {
  PapelAdmin,
  PermissionCatalogItem,
  SetorAdmin,
  SetorPayload,
  UsuarioAdmin,
  UsuarioOnlineResumo,
  UsuarioPayload,
  RedefinirSenhaUsuarioPayload,
  UsuariosSessaoResumo,
} from '../../types/access';

const POSSIBLE_MOJIBAKE_PATTERN = /[\u00C2\u00C3\uFFFD]/;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });

interface NormalizationRepairLog {
  endpoint: string;
  entity: string;
  index: number;
  field: string;
  before: string;
  after: string;
}

function repairPossibleMojibake(value: string): string {
  if (!POSSIBLE_MOJIBAKE_PATTERN.test(value)) {
    return value;
  }

  const bytes = new Uint8Array(value.length);

  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.charCodeAt(index);
    if (codePoint > 0xff) {
      return value;
    }
    bytes[index] = codePoint;
  }

  try {
    const repaired = UTF8_DECODER.decode(bytes);
    return repaired === value ? value : repaired;
  } catch {
    return value;
  }
}

function normalizeAdminAccessItems<T extends object>(
  endpoint: string,
  entity: string,
  items: T[],
  fields: Array<keyof T>,
): T[] {
  const repairs: NormalizationRepairLog[] = [];

  const normalizedItems = items.map((item, index) => {
    let nextItem: T | null = null;

    for (const field of fields) {
      const currentValue = item[field];
      if (typeof currentValue !== 'string') {
        continue;
      }

      const repairedValue = repairPossibleMojibake(currentValue);
      if (repairedValue === currentValue) {
        continue;
      }

      if (!nextItem) {
        nextItem = { ...item };
      }

      nextItem[field] = repairedValue as T[keyof T];
      repairs.push({
        endpoint,
        entity,
        index,
        field: String(field),
        before: currentValue,
        after: repairedValue,
      });
    }

    return nextItem ?? item;
  });

  if (import.meta.env.DEV && repairs.length > 0) {
    console.warn(
      `[admin-acesso] ${endpoint} corrigiu ${repairs.length} campo(s) com possível mojibake.`,
      repairs.slice(0, 5),
    );
  }

  return normalizedItems;
}

export async function buscarCatalogoPermissoes(): Promise<PermissionCatalogItem[]> {
  const { data } = await clienteAxios.get<PermissionCatalogItem[]>('/api/admin/acesso/catalogo-permissoes');
  return data;
}

export async function buscarSetores(): Promise<SetorAdmin[]> {
  const { data } = await clienteAxios.get<SetorAdmin[]>('/api/admin/acesso/setores');
  return normalizeAdminAccessItems('buscarSetores', 'setor', data, ['nome', 'descricao']);
}

export async function criarSetor(payload: SetorPayload): Promise<SetorAdmin> {
  const { data } = await clienteAxios.post<SetorAdmin>('/api/admin/acesso/setores', payload);
  return data;
}

export async function atualizarSetor(id: string, payload: SetorPayload): Promise<SetorAdmin> {
  const { data } = await clienteAxios.put<SetorAdmin>(`/api/admin/acesso/setores/${id}`, payload);
  return data;
}

export async function excluirSetor(id: string): Promise<void> {
  await clienteAxios.delete(`/api/admin/acesso/setores/${id}`);
}

export async function buscarPapeis(): Promise<PapelAdmin[]> {
  const { data } = await clienteAxios.get<PapelAdmin[]>('/api/admin/acesso/papeis');
  return normalizeAdminAccessItems('buscarPapeis', 'papel', data, ['nome', 'descricao']);
}

export async function buscarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const { data } = await clienteAxios.get<UsuarioAdmin[]>('/api/admin/acesso/usuarios');
  return normalizeAdminAccessItems('buscarUsuariosAdmin', 'usuario', data, ['nome', 'setorNome', 'papel', 'ultimaRotaAcessada']);
}

export async function buscarResumoSessoesUsuariosAdmin(signal?: AbortSignal): Promise<UsuariosSessaoResumo> {
  const { data } = await clienteAxios.get<UsuariosSessaoResumo>('/api/admin/acesso/usuarios/resumo-sessoes', { signal, timeout: 10000 });
  const usuariosOnlineDetalhes = normalizeAdminAccessItems<UsuarioOnlineResumo>(
    'buscarResumoSessoesUsuariosAdmin',
    'usuario-online',
    data.usuariosOnlineDetalhes ?? [],
    ['nome', 'email', 'ultimaRotaAcessada'],
  );
  const usuariosRecentes = normalizeAdminAccessItems<UsuarioOnlineResumo>(
    'buscarResumoSessoesUsuariosAdmin', 'usuario-recente', data.usuariosRecentes ?? [],
    ['nome', 'email', 'ultimaRotaAcessada'],
  );

  return {
    ...data,
    usuariosOnlineDetalhes,
    usuariosRecentes,
  };
}

export async function criarUsuario(payload: UsuarioPayload): Promise<UsuarioAdmin> {
  const { data } = await clienteAxios.post<UsuarioAdmin>('/api/admin/acesso/usuarios', payload);
  return data;
}

export async function atualizarUsuario(id: string, payload: UsuarioPayload): Promise<UsuarioAdmin> {
  const { data } = await clienteAxios.put<UsuarioAdmin>(`/api/admin/acesso/usuarios/${id}`, payload);
  return data;
}

export async function excluirUsuario(id: string): Promise<void> {
  await clienteAxios.delete(`/api/admin/acesso/usuarios/${id}`);
}

export async function redefinirSenhaUsuario(
  id: string,
  payload: RedefinirSenhaUsuarioPayload,
): Promise<void> {
  await clienteAxios.post(`/api/usuarios/${id}/reset-senha`, payload);
}
