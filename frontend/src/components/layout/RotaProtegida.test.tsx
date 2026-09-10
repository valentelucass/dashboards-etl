// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { IUsuarioSessao } from '../../types/auth';
import { createEmptyPermissionMap } from '../../utils/accessControl';
import RotaProtegida from './RotaProtegida';

const session = vi.hoisted(() => ({ usuario: null as IUsuarioSessao | null, carregandoSessao: false }));
vi.mock('../../contexts/AutenticacaoContext', () => ({ useAutenticacao: () => session }));

function user(overrides: Partial<IUsuarioSessao> = {}): IUsuarioSessao {
  return {
    id: 'teste', nome: 'Usuário', email: 'usuario@example.test', papel: 'usuario_comum',
    setor: { id: 'operacao', nome: 'Operação' }, permissoesEfetivas: createEmptyPermissionMap(),
    filiaisPermitidasEfetivas: ['CWB'], exigeTrocaSenha: false,
    sessaoExpiraEm: '2099-01-01T00:00:00Z', ...overrides,
  };
}

function renderRoute(props: Parameters<typeof RotaProtegida>[0] = {}) {
  return render(
    <MemoryRouter initialEntries={['/protegida']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<RotaProtegida {...props} />}>
          <Route path="/protegida" element={<div>Conteúdo protegido</div>} />
        </Route>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/alterar-senha" element={<div>Troca obrigatória</div>} />
        <Route path="/acesso-negado" element={<div>Acesso negado</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RotaProtegida com usePermissions real', () => {
  beforeEach(() => { session.usuario = null; session.carregandoSessao = false; });
  afterEach(cleanup);

  it('não monta conteúdo nem redireciona enquanto restaura a sessão', () => {
    session.carregandoSessao = true;
    renderRoute();
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
    expect(screen.queryByText('Página de login')).toBeNull();
  });

  it('direciona sessão ausente ao login', () => {
    renderRoute();
    expect(screen.getByText('Página de login')).toBeTruthy();
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
  });

  it('prioriza a troca obrigatória mesmo quando a permissão existe', () => {
    session.usuario = user({ exigeTrocaSenha: true, permissoesEfetivas: { ...createEmptyPermissionMap(), coletas: true } });
    renderRoute({ permissao: 'coletas' });
    expect(screen.getByText('Troca obrigatória')).toBeTruthy();
    expect(screen.queryByText('Conteúdo protegido')).toBeNull();
  });

  it('permite abrir a própria troca de senha', () => {
    session.usuario = user({ exigeTrocaSenha: true });
    renderRoute({ allowPasswordChange: true });
    expect(screen.getByText('Conteúdo protegido')).toBeTruthy();
  });

  it.each([false, true])('aplica permissão efetiva coletas=%s', (allowed) => {
    session.usuario = user({ permissoesEfetivas: { ...createEmptyPermissionMap(), coletas: allowed } });
    renderRoute({ permissao: 'coletas' });
    expect(screen.getByText(allowed ? 'Conteúdo protegido' : 'Acesso negado')).toBeTruthy();
  });

  it('usuário com permissão de dashboard não recebe acesso administrativo', () => {
    session.usuario = user({ permissoesEfetivas: { ...createEmptyPermissionMap(), coletas: true } });
    renderRoute({ adminOnly: true });
    expect(screen.getByText('Acesso negado')).toBeTruthy();
  });

  it('nega papel ausente', () => {
    session.usuario = user();
    renderRoute({ role: 'admin_plataforma' });
    expect(screen.getByText('Acesso negado')).toBeTruthy();
  });

  it('permite rota comum à sessão autenticada', () => {
    session.usuario = user();
    renderRoute();
    expect(screen.getByText('Conteúdo protegido')).toBeTruthy();
  });

  it('reavalia a permissão revogada durante a sessão', () => {
    session.usuario = user({ permissoesEfetivas: { ...createEmptyPermissionMap(), coletas: true } });
    const view = renderRoute({ permissao: 'coletas' });
    expect(screen.getByText('Conteúdo protegido')).toBeTruthy();
    view.unmount();
    session.usuario = user();
    renderRoute({ permissao: 'coletas' });
    expect(screen.getByText('Acesso negado')).toBeTruthy();
  });
});
