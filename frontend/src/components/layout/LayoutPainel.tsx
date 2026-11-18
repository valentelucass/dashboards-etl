import { Link } from '@astryxdesign/core/Link';
import DashboardRouteLoading from './DashboardRouteLoading';
import DashboardSideNav from './DashboardSideNav';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
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
      className="flex min-w-0 items-center gap-2.5 border-l pl-5 text-xs"
      style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}
      title={!isDevBuild ? `Versão ${buildId}` : undefined}
    >
      <CalendarClock size={16} className="shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p>{dataPrincipal ? rotuloPrincipal : 'Versão publicada'}</p>
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
    <div className="dashboard-shell dashboard-shell-with-sidebar flex min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <DashboardSideNav />
      <div className="dashboard-main-column flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main className="flex-1 w-full overflow-auto px-3 py-3 sm:px-5 sm:py-4">
          <Suspense fallback={<DashboardRouteLoading />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="mt-auto border-t px-4 py-4 sm:px-6" style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}>
          <div className="flex w-full flex-wrap items-center justify-between gap-x-8 gap-y-4">
            <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                Rodogarcia <span aria-hidden="true" className="mx-1 opacity-40">·</span> Dashboards
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                © {new Date().getFullYear()} Rodogarcia. Todos os direitos reservados.
              </p>
            </div>
            <BuildInfoFooter />
            </div>
            <div className="flex flex-col gap-1 text-left sm:items-end sm:text-right">
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Desenvolvido por{' '}
                <Link href="https://www.linkedin.com/in/dev-lucasandrade/" target="_blank" rel="noopener noreferrer">Lucas Andrade</Link>
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-subtle)' }}>
                Suporte:{' '}
                <Link href="mailto:lucasmac.dev@gmail.com">lucasmac.dev@gmail.com</Link>
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
