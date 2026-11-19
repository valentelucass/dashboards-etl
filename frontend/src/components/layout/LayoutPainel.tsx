import { Link } from '@astryxdesign/core/Link';
import DashboardRouteLoading from './DashboardRouteLoading';
import DashboardSideNav from './DashboardSideNav';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Code2, Mail } from 'lucide-react';
import { Outlet } from 'react-router-dom';
import TopNav from './TopNav';
import usePresencaNavegacao from '../../hooks/usePresencaNavegacao';

type BuildInfo = {
  buildId?: string;
  builtAt?: string;
  deployedAt?: string;
};

const BUILD_ID_FALLBACK = import.meta.env.VITE_DASHBOARD_BUILD_ID ?? 'dev';

function formatarDataHoraBuild(valor?: string): string | null {
  if (!valor) return null;

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

function useBuildInfo(): BuildInfo {
  const [buildInfo, setBuildInfo] = useState<BuildInfo>({ buildId: BUILD_ID_FALLBACK });

  useEffect(() => {
    const controller = new AbortController();

    async function carregarBuildInfo() {
      try {
        const resposta = await fetch('/build-info.json', {
          cache: 'no-store',
          signal: controller.signal,
        });

        if (!resposta.ok) return;

        const dados = (await resposta.json()) as BuildInfo;
        setBuildInfo({
          buildId: dados.buildId || BUILD_ID_FALLBACK,
          builtAt: dados.builtAt,
          deployedAt: dados.deployedAt,
        });
      } catch {
        if (!controller.signal.aborted) {
          setBuildInfo({ buildId: BUILD_ID_FALLBACK });
        }
      }
    }

    void carregarBuildInfo();

    return () => controller.abort();
  }, []);

  return buildInfo;
}

function BuildInfoFooter() {
  const buildInfo = useBuildInfo();
  const buildId = (buildInfo.buildId?.trim() || BUILD_ID_FALLBACK).trim();
  const isDevBuild = buildId.toLowerCase() === 'dev';
  const dataDeploy = useMemo(
    () => formatarDataHoraBuild(buildInfo.deployedAt),
    [buildInfo.deployedAt],
  );
  const dataBuild = useMemo(
    () => formatarDataHoraBuild(buildInfo.builtAt),
    [buildInfo.builtAt],
  );
  const dataPrincipal = dataDeploy ?? dataBuild;
  const rotuloPrincipal = dataDeploy ? 'Portal atualizado em' : 'Versão gerada em';

  if (!dataPrincipal && isDevBuild) {
    return null;
  }

  return (
    <div
      className="dashboard-footer-build flex min-w-0 items-center gap-2 text-xs"
      style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
      title={!isDevBuild ? `Versão ${buildId}` : undefined}
    >
      <CalendarClock size={16} className="shrink-0" aria-hidden="true" />
      <div className="dashboard-footer-build-time">
        <p className="text-xs">{dataPrincipal ? rotuloPrincipal : 'Versão publicada'}</p>
        {dataPrincipal && (
          <time
            dateTime={dataDeploy ? buildInfo.deployedAt : buildInfo.builtAt}
            className="block font-medium tabular-nums"
            style={{ color: 'var(--color-text-subtle)' }}
            title="Horário de Brasília"
          >
            {dataPrincipal}
          </time>
        )}
      </div>
    </div>
  );
}

export default function LayoutPainel() {
  usePresencaNavegacao();
  return (
    <div className="dashboard-shell dashboard-shell-with-sidebar flex min-h-dvh" style={{ backgroundColor: 'var(--color-bg)' }}>
      <DashboardSideNav />
      <div className="dashboard-main-column flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 w-full overflow-auto px-3 py-3 sm:px-5 sm:py-4">
          <Suspense fallback={<DashboardRouteLoading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="dashboard-footer mt-auto border-t" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
          <div className="dashboard-footer-content">
            <div className="dashboard-footer-about">
              <div>
                <p className="dashboard-footer-title">Rodogarcia <span aria-hidden="true">·</span> Dashboards</p>
                <p className="dashboard-footer-copyright">© {new Date().getFullYear()} Rodogarcia. Todos os direitos reservados.</p>
              </div>
              <BuildInfoFooter />
            </div>
            <div className="dashboard-footer-contact">
              <Link type="inherit" href="https://www.linkedin.com/in/dev-lucasandrade/" target="_blank" rel="noopener noreferrer">
                <span className="dashboard-footer-link"><Code2 size={16} aria-hidden="true" /><span>Desenvolvedor</span><strong>Lucas Andrade</strong></span>
              </Link>
              <Link type="inherit" href="mailto:lucasmac.dev@gmail.com">
                <span className="dashboard-footer-link"><Mail size={16} aria-hidden="true" /><span>Suporte</span><strong>lucasmac.dev@gmail.com</strong></span>
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
