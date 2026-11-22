import './auth-mobile.css';
import './login-dock.css';
import LoginDockScene from './LoginDockScene';
import { useState, type ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Moon, Pause, Play, Sun, Truck } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function DashboardAuthLayout({ title = 'Entrar no painel', description = 'Use sua conta corporativa.', children, dock = false }: {
  title?: string;
  description?: string;
  children: ReactNode;
  dock?: boolean;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [playing, setPlaying] = useState(true);
  const dark = (resolvedTheme ?? theme) === 'dark';
  const brand = <span className="dashboard-brand-wordmark dashboard-auth-brand">
    <img src="/logo.png" alt="Rodogarcia" width={231} height={43} />
  </span>;
  return (
    <main className={`dashboard-auth dashboard-auth-responsive${dock ? ' login-dock' : ''}`} data-dock-paused={dock && !playing || undefined}>
      <div className="dashboard-auth-toolbar">
        {dock && <div className="login-dock-brand">{brand}<span>Dashboards</span></div>}
        <Button label={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          className="dashboard-auth-theme" variant="secondary" isIconOnly size="sm"
          icon={dark ? <Sun size={16} /> : <Moon size={16} />}
          onClick={() => setTheme(dark ? 'light' : 'dark')} />
      </div>

      <section className="dashboard-auth-body" aria-labelledby="dashboard-auth-title">
        {dock && <LoginDockScene />}
        <div className="dashboard-auth-stack">
          {!dock && brand}
          <Card padding={0} className="dashboard-auth-card">
            {dock && <div className="login-dock-display">
              <div className="login-dock-display-face">
                <div className="login-dock-bay"><span>Doca</span><strong>04</strong></div>
                <div className="login-dock-telemetry" aria-hidden="true">
                  <div className="login-dock-rail"><span><Truck size={19} /></span></div>
                  <div className="login-dock-stages"><span>Chegada</span><span>Carga</span><span>Saída</span></div>
                </div>
              </div>
              <Button label={playing ? 'Pausar animação da doca' : 'Retomar animação da doca'} tooltip={playing ? 'Pausar animação da doca' : 'Animar terminal'} variant="ghost" isIconOnly size="sm"
                className="login-dock-pause" icon={playing ? <Pause size={16} /> : <Play size={16} />}
                onClick={() => setPlaying(value => !value)} />
            </div>}
            <div className="dashboard-auth-heading">
              <Heading level={1} id="dashboard-auth-title">{title}</Heading>
              <Text as="p" color="secondary">{description}</Text>
            </div>
            {children}
          </Card>
        </div>
      </section>

      <footer className="dashboard-auth-footer">
        <span>Desenvolvido por <a href="https://www.linkedin.com/in/dev-lucasandrade/" target="_blank" rel="noopener noreferrer">@valentelucass</a></span>
        <span>Suporte <a href="mailto:lucasmac.dev@gmail.com">lucasmac.dev@gmail.com</a></span>
      </footer>
    </main>
  );
}
