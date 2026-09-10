// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutenticacaoProvider } from './AutenticacaoContext';
import { createDashboardQueryClient } from '../config/queryClient';
import { limparSessao, obterSessao, salvarSessao } from '../utils/gerenciadorSessao';
import type { IUsuarioSessao } from '../types/auth';

vi.mock('../api/endpoints/authServico', () => ({
  buscarSessaoAtual: vi.fn(async () => obterSessao()),
  restaurarSessao: vi.fn(), loginUsuario: vi.fn(), logoutUsuario: vi.fn(),
  alterarSenha: vi.fn(), concluirTrocaSenhaObrigatoria: vi.fn(),
}));

const usuario: IUsuarioSessao = {
  id: 'a', nome: 'Usuário A', email: 'a@example.test', papel: 'usuario_comum',
  setor: { id: '1', nome: 'Operação' }, permissoesEfetivas: { coletas: true } as IUsuarioSessao['permissoesEfetivas'],
  filiaisPermitidasEfetivas: ['CWB'], exigeTrocaSenha: false, sessaoExpiraEm: '2099-01-01T00:00:00Z',
};

afterEach(() => { cleanup(); limparSessao(); });

function montar() {
  salvarSessao(usuario, 'synthetic-token');
  const client = createDashboardQueryClient();
  render(<QueryClientProvider client={client}><AutenticacaoProvider><span>Portal</span></AutenticacaoProvider></QueryClientProvider>);
  return client;
}

describe('isolamento do cache da sessão', () => {
  it.each([
    ['logout', null],
    ['outro usuário', { ...usuario, id: 'b' }],
    ['outra filial', { ...usuario, filiaisPermitidasEfetivas: ['SPO'] }],
    ['permissão revogada', { ...usuario, permissoesEfetivas: { coletas: false } }],
    ['papel alterado', { ...usuario, papel: 'admin_acesso' }],
    ['troca de senha exigida', { ...usuario, exigeTrocaSenha: true }],
  ])('remove dados e mutações ao ocorrer %s', async (_nome, proxima) => {
    const client = montar();
    await act(async () => undefined);
    client.setQueryData(['coletas'], { cliente: 'Privado de A' });
    client.getMutationCache().build(client, { mutationKey: ['upload-privado'] });
    act(() => { if (proxima) salvarSessao(proxima as IUsuarioSessao); else limparSessao(); });
    expect(client.getQueryData(['coletas'])).toBeUndefined();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
    client.clear();
  });

  it('não reaproveita uma resposta antiga que termina após a troca de usuário', async () => {
    const client = montar();
    await act(async () => undefined);
    let concluir!: (value: string) => void;
    const antiga = client.fetchQuery({ queryKey: ['coletas'], queryFn: () => new Promise<string>((resolve) => { concluir = resolve; }) }).catch(() => undefined);
    act(() => salvarSessao({ ...usuario, id: 'b' }));
    concluir('Privado de A');
    await antiga;
    const consultarB = vi.fn(async () => 'Privado de B');
    expect(await client.fetchQuery({ queryKey: ['coletas'], queryFn: consultarB })).toBe('Privado de B');
    expect(consultarB).toHaveBeenCalledOnce();
    client.clear();
  });

  it('preserva cache quando somente a validade da sessão é renovada', async () => {
    const client = montar();
    await act(async () => undefined);
    client.setQueryData(['coletas'], 'dados válidos');
    act(() => salvarSessao({ ...usuario, sessaoExpiraEm: '2099-02-01T00:00:00Z' }));
    await waitFor(() => expect(client.getQueryData(['coletas'])).toBe('dados válidos'));
    client.clear();
  });
});
