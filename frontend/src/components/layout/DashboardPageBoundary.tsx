import { Component, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Banner } from '@astryxdesign/core/Banner';
import { Button } from '@astryxdesign/core/Button';
import { recarregarAposPublicacao } from '../../utils/recarregarAposPublicacao';

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  private recuperacao?: AbortController;

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    this.recuperacao = new AbortController();
    void recarregarAposPublicacao(error, this.recuperacao.signal);
  }

  componentWillUnmount() {
    this.recuperacao?.abort();
  }

  render() {
    if (this.state.failed) {
      return <Banner role="alert" status="error" title="Não foi possível exibir esta página."
        endContent={<Button label="Recarregar página" variant="secondary" onClick={() => window.location.reload()} />} />;
    }
    return this.props.children;
  }
}

export default function DashboardPageBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <PageBoundary key={pathname}>{children}</PageBoundary>;
}
