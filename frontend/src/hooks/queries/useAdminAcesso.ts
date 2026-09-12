import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  atualizarSetor,
  atualizarUsuario,
  buscarCatalogoPermissoes,
  buscarPapeis,
  buscarResumoSessoesUsuariosAdmin,
  buscarSetores,
  buscarUsuariosAdmin,
  criarSetor,
  criarUsuario,
  excluirSetor,
  excluirUsuario,
  redefinirSenhaUsuario,
} from '../../api/endpoints/adminAcessoServico';
import type { RedefinirSenhaUsuarioPayload, SetorPayload, UsuarioPayload } from '../../types/access';

const ADMIN_USUARIOS_QUERY_KEY = ['admin', 'acesso', 'usuarios'] as const;
const ADMIN_USUARIOS_RESUMO_QUERY_KEY = ['admin', 'acesso', 'usuarios', 'resumo-sessoes'] as const;

function invalidateUsuariosAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ADMIN_USUARIOS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ADMIN_USUARIOS_RESUMO_QUERY_KEY });
}

export function useCatalogoPermissoes() {
  return useQuery({
    queryKey: ['admin', 'acesso', 'catalogo'],
    queryFn: buscarCatalogoPermissoes,
    staleTime: 60 * 60 * 1000,
  });
}

export function useSetoresAdmin() {
  return useQuery({
    queryKey: ['admin', 'acesso', 'setores'],
    queryFn: buscarSetores,
  });
}

export function usePapeisAdmin() {
  return useQuery({
    queryKey: ['admin', 'acesso', 'papeis'],
    queryFn: buscarPapeis,
    staleTime: 60 * 60 * 1000,
  });
}

export function useUsuariosAdmin() {
  return useQuery({
    queryKey: ADMIN_USUARIOS_QUERY_KEY,
    queryFn: buscarUsuariosAdmin,
  });
}

export function useResumoSessoesUsuariosAdmin() {
  return useQuery({
    queryKey: ADMIN_USUARIOS_RESUMO_QUERY_KEY,
    queryFn: ({ signal }) => buscarResumoSessoesUsuariosAdmin(signal),
    refetchInterval: 15000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: false,
  });
}

export function useCriarSetor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SetorPayload) => criarSetor(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'acesso', 'setores'] });
    },
  });
}

export function useAtualizarSetor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SetorPayload }) => atualizarSetor(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'acesso', 'setores'] });
      invalidateUsuariosAdmin(queryClient);
    },
  });
}

export function useExcluirSetor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => excluirSetor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'acesso', 'setores'] });
      invalidateUsuariosAdmin(queryClient);
    },
  });
}

export function useCriarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UsuarioPayload) => criarUsuario(payload),
    onSuccess: () => {
      invalidateUsuariosAdmin(queryClient);
    },
  });
}

export function useAtualizarUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UsuarioPayload }) => atualizarUsuario(id, payload),
    onSuccess: () => {
      invalidateUsuariosAdmin(queryClient);
    },
  });
}

export function useExcluirUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => excluirUsuario(id),
    onSuccess: () => {
      invalidateUsuariosAdmin(queryClient);
    },
  });
}

export function useRedefinirSenhaUsuario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: RedefinirSenhaUsuarioPayload }) =>
      redefinirSenhaUsuario(id, payload),
    onSuccess: () => {
      invalidateUsuariosAdmin(queryClient);
    },
  });
}
