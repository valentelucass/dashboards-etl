import { Button } from '@astryxdesign/core/Button';
import DashboardAuthLayout from '../components/layout/DashboardAuthLayout';
import DashboardRouteLoading from '../components/layout/DashboardRouteLoading';
import { useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../contexts/AutenticacaoContext';
import { firstAccessibleRoute } from '../utils/accessControl';

export default function AcessoNegadoPage() {
  const { usuario, logout, carregandoSessao } = useAutenticacao();
  const navigate = useNavigate();
  const destinoPadrao = firstAccessibleRoute(usuario);

  function handleSair() {
    logout();
    navigate('/login', { replace: true });
  }

  function handleIrParaDashboard() {
    navigate(destinoPadrao, { replace: true });
  }

  if (carregandoSessao) return <DashboardRouteLoading />;

  return (
    <DashboardAuthLayout title="Acesso negado" description="Seu perfil não tem permissão para acessar esta área.">
      <div className="flex flex-wrap gap-2">
        {usuario && destinoPadrao !== '/acesso-negado' && (
          <Button label="Ir para meu dashboard" variant="primary" className="dashboard-form-submit" onClick={handleIrParaDashboard} />
        )}
        {usuario ? (
          <Button label="Trocar usuário" variant="secondary" className="dashboard-form-secondary" onClick={handleSair} />
        ) : (
          <Button label="Ir para login" variant="primary" className="dashboard-form-submit"
            onClick={() => navigate('/login', { replace: true })} />
        )}
      </div>
    </DashboardAuthLayout>
  );
}
