import './auth-mobile.css';
import type { ReactNode } from 'react';
import { Button } from '@astryxdesign/core/Button';
import { Card } from '@astryxdesign/core/Card';
import { Heading } from '@astryxdesign/core/Heading';
import { Text } from '@astryxdesign/core/Text';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export default function DashboardAuthLayout({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const dark = (resolvedTheme ?? theme) === 'dark';
  return (
    <main className="dashboard-auth dashboard-auth-responsive">
      <div className="dashboard-auth-toolbar">
        <Button label={dark ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
          className="dashboard-auth-theme" variant="secondary" isIconOnly size="sm"
          icon={dark ? <Sun size={16} /> : <Moon size={16} />}
          onClick={() => setTheme(dark ? 'light' : 'dark')} />
      </div>

      <section className="dashboard-auth-body" aria-labelledby="dashboard-auth-title">
        <div className="dashboard-auth-stack">
          <span className="dashboard-brand-wordmark dashboard-auth-brand">
            <img src="/logo.png" alt="Rodogarcia" width={231} height={43} />
          </span>
          <Card padding={0} className="dashboard-auth-card">
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
