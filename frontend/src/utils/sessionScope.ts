import type { IUsuarioSessao } from '../types/auth';

// Token/validade não alteram o escopo dos dados. Identidade e autorização alteram.
export function sessionScope(usuario: IUsuarioSessao | null): string {
  if (!usuario) return 'anonymous';
  return JSON.stringify([
    usuario.id, usuario.papel, usuario.setor?.id, usuario.exigeTrocaSenha,
    Object.entries(usuario.permissoesEfetivas ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    [...(usuario.filiaisPermitidasEfetivas ?? [])].sort(),
  ]);
}
