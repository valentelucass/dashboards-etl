// @vitest-environment jsdom
import { AxiosError } from 'axios';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  solicitarRedefinicaoSenha: vi.fn(),
}));

vi.mock('../api/endpoints/authServico', () => ({
  solicitarRedefinicaoSenha: mocks.solicitarRedefinicaoSenha,
}));

vi.mock('../contexts/AutenticacaoContext', () => ({
  useAutenticacao: () => ({
    usuario: null,
    carregandoSessao: false,
    concluirTrocaSenhaObrigatoria: vi.fn(),
    login: mocks.login,
  }),
}));

vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: vi.fn() }),
}));

describe('LoginPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.login.mockReset();
    mocks.solicitarRedefinicaoSenha.mockReset();
  });

  it('inicia a doca em movimento e permite pausar e retomar sem limpar o formulário', () => {
    render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
    const email = screen.getByLabelText<HTMLInputElement>('E-mail');
    const main = screen.getByRole('main');
    fireEvent.change(email, { target: { value: 'teste@exemplo.test' } });
    expect(main.hasAttribute('data-dock-paused')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Pausar animação da doca' }));
    expect(main.getAttribute('data-dock-paused')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Retomar animação da doca' }));
    expect(main.hasAttribute('data-dock-paused')).toBe(false);
    expect(email.value).toBe('teste@exemplo.test');
  });

  it('permite corrigir a senha após erro e entrar pelo mesmo formulário', async () => {
    mocks.login.mockRejectedValueOnce(new Error('Credenciais inválidas'))
      .mockResolvedValueOnce({ usuario: { papel: 'USUARIO', permissoesEfetivas: {} } });
    render(<MemoryRouter initialEntries={['/login']}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<h1>Início</h1>} />
    </Routes></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@exemplo.test' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'incorreta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar plataforma' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'corrigida' } });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar plataforma' }));
    expect(await screen.findByRole('heading', { name: 'Início' })).toBeTruthy();
    expect(mocks.login).toHaveBeenLastCalledWith({ email: 'qa@exemplo.test', senha: 'corrigida' });
  });

  it('envia a solicitação de redefinição e retorna ao login com o e-mail preenchido', async () => {
    mocks.solicitarRedefinicaoSenha.mockResolvedValue(undefined);
    render(<MemoryRouter><LoginPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'qa@exemplo.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar redefinição de senha' }));
    expect(screen.queryByLabelText('Senha')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar redefinição', exact: true }));
    expect(await screen.findByText(/a solicitação de redefinição foi registrada/i)).toBeTruthy();
    expect(mocks.solicitarRedefinicaoSenha).toHaveBeenCalledWith({ email: 'qa@exemplo.test' });
    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao login' }));
    expect(screen.getByLabelText<HTMLInputElement>('E-mail').value).toBe('qa@exemplo.test');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('exibe a troca de senha obrigatoria ao receber o contrato 428', async () => {
    mocks.login.mockRejectedValue(new AxiosError(
      'Precondition Required',
      undefined,
      undefined,
      undefined,
      { status: 428, data: { status: 'PASSWORD_RESET_REQUIRED', userId: '51' } } as never,
    ));

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/trocar-senha" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('E-mail'), {
      target: { value: 'usuario@rodogarcia.com.br' },
    });
    fireEvent.change(screen.getByLabelText('Senha'), {
      target: { value: 'SenhaTemporaria@12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Acessar plataforma' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Defina sua nova senha' })).toBeTruthy();
    });
  });
});
