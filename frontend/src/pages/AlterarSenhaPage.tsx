import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Banner } from '@astryxdesign/core/Banner';
import DashboardAuthLayout from '../components/layout/DashboardAuthLayout';
import { FormPasswordField } from '../components/shared/FormTextField';
import { useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contexts/AutenticacaoContext';
import { firstAccessibleRoute } from '../utils/accessControl';
import { getApiErrorMessage } from '../utils/apiError';
import { getPasswordPolicyErrors, PASSWORD_POLICY_HINT } from '../utils/passwordPolicy';

export default function AlterarSenhaPage() {
  const { usuario, alterarSenha, logout } = useAutenticacao();
  const navigate = useNavigate();

  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErro('');

    if (novaSenha !== confirmacaoSenha) {
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
      await alterarSenha({ senhaAtual, novaSenha });
      if (usuario) {
        navigate(firstAccessibleRoute({ ...usuario, exigeTrocaSenha: false }), { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    } catch (error) {
      setErro(getApiErrorMessage(error, 'Não foi possível alterar a senha.'));
    } finally {
      setCarregando(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <DashboardAuthLayout title="Alterar senha" description={usuario?.exigeTrocaSenha
      ? 'Defina uma nova senha antes de continuar.' : 'Atualize a senha da sua conta.'}>
      <form onSubmit={handleSubmit} className="dashboard-auth-form">
        {erro && <Banner status="error" title={erro} role="alert" />}
        <FormPasswordField label="Senha atual" htmlName="current-password" autoComplete="current-password"
          value={senhaAtual} onChange={setSenhaAtual} visible={mostrarSenha}
          onToggle={() => setMostrarSenha(value => !value)} required />
        <FormPasswordField label="Nova senha" htmlName="new-password" autoComplete="new-password"
          value={novaSenha} onChange={setNovaSenha} visible={mostrarSenha} hint={PASSWORD_POLICY_HINT} minLength={12} required />
        <FormPasswordField label="Confirmar nova senha" htmlName="confirm-new-password" autoComplete="new-password"
          value={confirmacaoSenha} onChange={setConfirmacaoSenha} visible={mostrarSenha} minLength={12} required />
        <Button type="submit" label="Salvar nova senha" variant="primary" width="100%" className="dashboard-form-submit" isLoading={carregando} />
        <Button label="Sair" variant="ghost" className="dashboard-form-secondary" onClick={handleLogout} />
      </form>
    </DashboardAuthLayout>
  );
}
