import { Text } from '@astryxdesign/core/Text';
import { Button } from '@astryxdesign/core/Button';
import { Badge } from '@astryxdesign/core/Badge';
import { useNavigate } from 'react-router-dom';
import { useAutenticacao } from '../../contexts/AutenticacaoContext';

export default function Cabecalho() {
  const { usuario, logout } = useAutenticacao();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header
      className="flex h-16 items-center justify-between border-b px-6"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      <div>
        <Text color="secondary" size="xsm">Perfil ativo</Text>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{usuario?.setor.nome}</span>
          {usuario?.papel === 'admin_plataforma' && (
            <Badge label="Admin" variant="warning" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{usuario?.nome}</div>
          <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{usuario?.email}</div>
        </div>
        <Button label="Sair" variant="destructive" onClick={() => void handleLogout()} />
      </div>
    </header>
  );
}
