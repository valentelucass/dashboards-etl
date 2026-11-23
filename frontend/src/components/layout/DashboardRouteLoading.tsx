import { Card } from '@astryxdesign/core/Card';
import { Skeleton } from '@astryxdesign/core/Skeleton';
import { useLocation } from 'react-router-dom';
import DashboardLoading, { LoadingKpiGrid } from '../shared/DashboardLoading';
import ChartLoading, { ChartPlaceholder, MetricLoading, StatusBarsLoading } from '../shared/ChartLoading';
import CarregamentoConta from '../domain/customerService/CarregamentoConta';
import CarregamentoRede from '../domain/redeCredenciada/CarregamentoRede';
import { LoadingTableRows } from '../shared/TableLoading';
import NoticeListLoading from '../home/NoticeListLoading';
import { kpiLoadingLayouts } from '../shared/dashboardKpiLayouts';
import TrackingMatrixLoading from '../domain/tracking/TrackingMatrixLoading';
import ScorecardLoading from '../indicadores-gestao/ScorecardLoading';
import FinanceiroKpiLayout from '../domain/faturasPorCliente/FinanceiroKpiLayout';
import DashboardAuthLayout from './DashboardAuthLayout';
import '../home/home.css';
import './auth-mobile.css';

type DashboardProfile = keyof typeof kpiLoadingLayouts | 'financeiro' | 'gestao';

const dashboards: Record<string, DashboardProfile | undefined> = {
  '/tracking': 'tracking', '/coletas': 'coletas', '/manifestos': 'manifestos', '/faturamento': 'faturamento',
  '/faturas-por-cliente': 'financeiro', '/contas-a-pagar': 'contas', '/cotacoes': 'cotacoes',
  '/performance': 'performance', '/executivo': 'executivo', '/etl-saude': 'etl',
  '/indicadores-gestao-a-vista': 'gestao', '/painel/integracoes': 'integracoes',
};

function PreviewCharts({ profile }: { profile: DashboardProfile }) {
  switch (profile) {
    case 'coletas':
    case 'performance':
      return <div className={'grid lg:grid-cols-2 2xl:grid-cols-3 ' + (profile === 'coletas' ? 'gap-6' : 'gap-4')}>
        <ChartPlaceholder className="lg:col-span-2 2xl:col-span-1" />
        <ChartPlaceholder round>{profile === 'coletas' ? <StatusBarsLoading count={4} /> : undefined}</ChartPlaceholder>
        <ChartPlaceholder />
      </div>;
    case 'faturamento':
      return <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-12">
        <ChartPlaceholder className="lg:col-span-2 2xl:col-span-5"><div className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="grid content-start gap-3">{[0, 1, 2, 3].map(i => <MetricLoading key={i} />)}</div><div className="h-[350px]"><ChartLoading /></div>
        </div></ChartPlaceholder>
        <ChartPlaceholder round className="2xl:col-span-3" /><ChartPlaceholder className="2xl:col-span-4" />
      </div>;
    case 'manifestos':
      return <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <ChartPlaceholder className="col-span-full min-h-[43rem] lg:min-h-[34rem] xl:min-h-[28rem]" />
        <ChartPlaceholder round /><ChartPlaceholder round /><ChartPlaceholder round />
      </div>;
    default:
      return <div className={'grid gap-6 lg:grid-cols-2' + (profile === 'integracoes' ? ' mt-4' : '')}>
        <ChartPlaceholder className={profile === 'cotacoes' ? 'lg:col-span-2 2xl:col-span-1' : ''} round={profile === 'tracking'} />
        <ChartPlaceholder>{profile === 'financeiro' ? <table className="w-full table-fixed"><tbody><LoadingTableRows columns={4} rows={8} /></tbody></table>
          : profile === 'cotacoes' ? <div className="grid gap-4 p-4">{[0, 1, 2].map(i => <div key={i} className="grid items-center gap-3 md:grid-cols-[1fr_190px]"><MetricLoading bar /><MetricLoading /></div>)}</div>
          : undefined}</ChartPlaceholder>
      </div>;
  }
}

function DashboardPreview({ profile }: { profile: DashboardProfile }) {
  if (profile === 'gestao') return <>
    <div className="gestao-scoreboard">{Array.from({ length: 5 }, (_, i) => <ScorecardLoading key={i} />)}</div>
    <div className="gestao-panorama"><Skeleton width={180} height={24} /><div className="gestao-panorama-body mt-4">
      <div className="gestao-comparison"><Skeleton width="40%" height={20} /><div className="gestao-comparison-lanes">{[0, 1, 2, 3, 4].map(i => <div className="gestao-comparison-lane" key={i}><MetricLoading bar /></div>)}</div></div><DashboardLoading variant="section" label="" />
    </div></div>
  </>;

  return <>
    {profile === 'financeiro' ? <FinanceiroKpiLayout /> : <LoadingKpiGrid {...kpiLoadingLayouts[profile]} />}
    {profile === 'tracking' && <Card padding={4} className="tracking-region-matrix mb-6 min-w-0">
      <div className="tracking-cabecalho"><Skeleton width={210} height={18} />
        <div className="flex flex-wrap gap-1.5">{[80, 100, 85, 78, 72].map(width => <Skeleton key={width} width={width} height={28} />)}</div>
      </div>
      <TrackingMatrixLoading />
    </Card>}
    <PreviewCharts profile={profile} />
  </>;
}

function Fields({ count, className = '' }: { count: number; className?: string }) {
  return <div className={'grid gap-4 ' + className}>
    {Array.from({ length: count }, (_, i) => <div key={i} className="grid min-w-0 gap-2">
      <Skeleton width="35%" height={12} /><Skeleton width="100%" height={40} />
    </div>)}
  </div>;
}

function PagePreview({ path }: { path: string }) {
  if (path === '/rede-credenciada') return <CarregamentoRede />;
  if (path === '/customer-service') return <div className="cs-conteudo"><CarregamentoConta /></div>;
  const profile = dashboards[path];
  if (profile) return <DashboardPreview profile={profile} />;
  if (path === '/') return <div className="home-page">
    <Card padding={5} className="home-greeting"><Skeleton width={180} height={18} /></Card>
    <div className="home-layout">
      <Card padding={5} className="grid content-start gap-4"><Skeleton width={150} height={22} /><Fields count={2} className="sm:grid-cols-2" />
        <Skeleton width="100%" height={120} /><Fields count={2} className="sm:grid-cols-2" /><Skeleton height={32} />
      </Card>
      <Card padding={4} className="grid content-start gap-3"><Skeleton width={140} height={22} /><Skeleton height={32} />
        <NoticeListLoading />
      </Card>
    </div>
  </div>;
  if (path === '/admin/usuarios' || path === '/admin/setores') {
    const users = path === '/admin/usuarios';
    return <div className="dashboard-admin"><Card padding={0} className="dashboard-admin-card grid gap-5">
      {users && <LoadingKpiGrid count={4} className="grid gap-3 min-[560px]:grid-cols-2 xl:grid-cols-4" />}
      <Skeleton width={180} height={22} /><Fields count={users ? 6 : 2} className={users ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} />
      <Skeleton height={90} /><Fields count={3} />
    </Card></div>;
  }
  if (path === '/login') return <div inert className="login-dock-skeleton">
    <DashboardAuthLayout dock>
      <div className="dashboard-auth-form">
        {['email', 'senha'].map(field => <div key={field} className="grid gap-1">
          <Skeleton width={100} height={20} /><Skeleton width="100%" height={44} />
        </div>)}
        <Skeleton width="100%" height={44} /><Skeleton width={178} height={40} />
      </div>
    </DashboardAuthLayout>
  </div>;
  if (['/auth/trocar-senha', '/alterar-senha', '/acesso-negado'].includes(path)) return <div className="dashboard-auth dashboard-auth-responsive">
    <div className="dashboard-auth-toolbar"><Skeleton width={32} height={32} /></div>
    <div className="dashboard-auth-body"><div className="dashboard-auth-stack">
      <span className="dashboard-brand-wordmark dashboard-auth-brand"><img src="/logo.png" alt="" width={231} height={43} /></span>
      <Card padding={0} className="dashboard-auth-card">
        <div className="dashboard-auth-heading"><Skeleton width="65%" height={24} /><Skeleton width="85%" height={14} /></div>
        {path === '/acesso-negado' ? <Skeleton width={132} height={36} /> : <div className="dashboard-auth-form">
          <Fields count={path === '/alterar-senha' ? 3 : 2} />
          <Skeleton height={36} />{path !== '/auth/trocar-senha' && <Skeleton height={32} />}
        </div>}
      </Card>
    </div></div>
    <div className="dashboard-auth-footer"><Skeleton width={165} height={14} /><Skeleton width={160} height={14} /></div>
  </div>;
  return <DashboardLoading variant="section" label="" />;
}

export default function DashboardRouteLoading() {
  const { pathname } = useLocation();
  return <div role="status" aria-label="Carregando página"><div aria-hidden="true">
    <PagePreview path={pathname.replace(/\/+$/, '') || '/'} />
  </div></div>;
}
