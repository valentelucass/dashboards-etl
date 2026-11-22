import DashboardLoading from '../components/shared/DashboardLoading';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { isAxiosError } from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import { ArrowRight, Mail } from 'lucide-react';
import DashboardAuthLayout from '../components/layout/DashboardAuthLayout';
import { FormPasswordField, FormTextField } from '../components/shared/FormTextField';
import { useAutenticacao } from '../contexts/AutenticacaoContext';
import { firstAccessibleRoute } from '../utils/accessControl';
import { getApiErrorMessage } from '../utils/apiError';
import { getPasswordPolicyErrors, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy';
import { solicitarRedefinicaoSenha } from '../api/endpoints/authServico';

interface TrocaSenhaObrigatoriaPendente {
  email: string;
  senhaTemporaria: string;
}

function isPasswordResetRequiredError(error: unknown): boolean {
  if (!isAxiosError(error) || error.response?.status !== 428) {
    return false;
  }

  const data = error.response.data as { status?: unknown } | undefined;
  return data?.status === 'PASSWORD_RESET_REQUIRED';
}

function obterTrocaSenhaObrigatoriaPendente(state: unknown): TrocaSenhaObrigatoriaPendente | null {
  if (
    !state
    || typeof state !== 'object'
    || !('email' in state)
    || !('senhaTemporaria' in state)
    || typeof state.email !== 'string'
    || typeof state.senhaTemporaria !== 'string'
  ) {
    return null;
  }

  return {
    email: state.email,
    senhaTemporaria: state.senhaTemporaria,
  };
}

export default function LoginPage() {
  const location = useLocation();
  const trocaObrigatoria = obterTrocaSenhaObrigatoriaPendente(location.state);
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [solicitandoRedefinicao, setSolicitandoRedefinicao] = useState(false);
  const [mensagemRedefinicao, setMensagemRedefinicao] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoNovaSenha, setConfirmacaoNovaSenha] = useState('');
  const {
    usuario: sessao,
    carregandoSessao,
    concluirTrocaSenhaObrigatoria,
    login,
  } = useAutenticacao();
  const navigate = useNavigate();

  useEffect(() => {
    if (!carregandoSessao && sessao) {
      navigate(firstAccessibleRoute(sessao), { replace: true });
    }
  }, [carregandoSessao, navigate, sessao]);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      const resposta = await login({ email, senha });
      navigate(firstAccessibleRoute({
        papel: resposta.usuario.papel,
        permissoesEfetivas: resposta.usuario.permissoesEfetivas,
        exigeTrocaSenha: resposta.exigeTrocaSenha ?? resposta.usuario.exigeTrocaSenha,
      }), { replace: true });
    } catch (error) {
      if (isPasswordResetRequiredError(error)) {
        navigate('/auth/trocar-senha', {
          replace: true,
          state: { email: email.trim(), senhaTemporaria: senha } satisfies TrocaSenhaObrigatoriaPendente,
        });
        setErro('');
        return;
      }
      setErro(getApiErrorMessage(error, 'Usuário ou senha inválidos.'));
    } finally {
      setCarregando(false);
    }
  }

  async function handleNovaSenhaObrigatoria(e: FormEvent) {
    e.preventDefault();
    if (!trocaObrigatoria) return;

    setErro('');
    if (novaSenha !== confirmacaoNovaSenha) {
      setErro('A confirmação da nova senha não confere.');
      return;
    }

    const passwordErrors = getPasswordPolicyErrors(novaSenha);
    if (passwordErrors.length > 0) {
      setErro(passwordErrors[0]);
      return;
    }

    setCarregando(true);
    try {
      const resposta = await concluirTrocaSenhaObrigatoria({
        email: trocaObrigatoria.email,
        senhaTemporaria: trocaObrigatoria.senhaTemporaria,
        novaSenha,
      });
      setSenha('');
      setNovaSenha('');
      setConfirmacaoNovaSenha('');
      navigate(firstAccessibleRoute({
        papel: resposta.usuario.papel,
        permissoesEfetivas: resposta.usuario.permissoesEfetivas,
        exigeTrocaSenha: false,
      }), { replace: true });
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Não foi possível definir a nova senha.'));
    } finally {
      setCarregando(false);
    }
  }

  async function handleSolicitarRedefinicao(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setMensagemRedefinicao('');
    setCarregando(true);
    try {
      await solicitarRedefinicaoSenha({ email });
      setMensagemRedefinicao('Se o acesso estiver cadastrado e ativo, a solicitação de redefinição foi registrada.');
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Não foi possível registrar a solicitação.'));
    } finally {
      setCarregando(false);
    }
  }

  const title = trocaObrigatoria ? 'Defina sua nova senha' : solicitandoRedefinicao ? 'Solicitar redefinição de senha' : undefined;
  const description = trocaObrigatoria
    ? 'Crie uma senha privada para concluir seu acesso.'
    : solicitandoRedefinicao ? 'Informe seu e-mail corporativo para avisar o administrador.' : undefined;
  const alternarSenha = () => setMostrarSenha(value => !value);

  return (
    <DashboardAuthLayout title={title} description={description} dock={!trocaObrigatoria}>
      <form onSubmit={trocaObrigatoria ? handleNovaSenhaObrigatoria : solicitandoRedefinicao ? handleSolicitarRedefinicao : handleLogin} className="dashboard-auth-form">
        {carregandoSessao && <DashboardLoading label="Validando sessão salva…" />}
        {erro && <Banner status="error" title={erro} role="alert" />}
        {mensagemRedefinicao && <Banner status="success" title={mensagemRedefinicao} role="status" />}

        {trocaObrigatoria ? (
          <>
            <FormPasswordField label="Nova senha" htmlName="new-password" autoComplete="new-password"
              value={novaSenha} onChange={setNovaSenha} visible={mostrarSenha} onToggle={alternarSenha}
              hint={PASSWORD_POLICY_HINT} minLength={12} required />
            <FormPasswordField label="Confirmar nova senha" htmlName="confirm-new-password" autoComplete="new-password"
              value={confirmacaoNovaSenha} onChange={setConfirmacaoNovaSenha} visible={mostrarSenha} minLength={12} required />
          </>
        ) : (
          <>
            <FormTextField label="E-mail" type="email" htmlName="email" autoComplete="username" startIcon={<Mail size={16} />}
              value={email} onChange={setEmail} placeholder="seu.email@empresa.com" required />
            {!solicitandoRedefinicao && (
              <FormPasswordField label="Senha" htmlName="password" autoComplete="current-password"
                value={senha} onChange={setSenha} visible={mostrarSenha} onToggle={alternarSenha} required />
            )}
          </>
        )}

        <Button type="submit" variant="primary" width="100%" isLoading={carregando}
          endContent={!trocaObrigatoria && <ArrowRight aria-hidden="true" size={17} />}
          className="dashboard-form-submit"
          label={trocaObrigatoria ? 'Salvar nova senha e entrar' : solicitandoRedefinicao ? 'Solicitar redefinição' : 'Acessar plataforma'} />

        {!trocaObrigatoria && (
          <Button variant="ghost" width="100%" className="dashboard-form-secondary"
            label={solicitandoRedefinicao ? 'Voltar ao login' : 'Solicitar redefinição de senha'}
            onClick={() => {
              setSolicitandoRedefinicao(!solicitandoRedefinicao);
              setMensagemRedefinicao('');
              setErro('');
            }} />
        )}
      </form>
    </DashboardAuthLayout>
  );
}
