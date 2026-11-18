import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAutenticacao } from './contexts/AutenticacaoContext';
import RotaProtegida from './components/layout/RotaProtegida';
import LayoutPainel from './components/layout/LayoutPainel';
import DashboardRouteLoading from './components/layout/DashboardRouteLoading';
import ApiStatusToast from './components/ui/ApiStatusToast';
import { firstAccessibleRoute } from './utils/accessControl';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const AcessoNegadoPage = lazy(() => import('./pages/AcessoNegadoPage'));
const AlterarSenhaPage = lazy(() => import('./pages/AlterarSenhaPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const ColetasPage = lazy(() => import('./pages/ColetasPage'));
const ManifestosPage = lazy(() => import('./pages/ManifestosPage'));
const FaturamentoPage = lazy(() => import('./pages/FaturamentoPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));
const TrackingPage = lazy(() => import('./pages/TrackingPage'));
const FaturasPorClientePage = lazy(() => import('./pages/FaturasPorClientePage'));
const ContasAPagarPage = lazy(() => import('./pages/ContasAPagarPage'));
const CotacoesPage = lazy(() => import('./pages/CotacoesPage'));
const IndicadoresGestaoAVistaPage = lazy(() => import('./pages/IndicadoresGestaoAVistaPage'));
const ExecutivoPage = lazy(() => import('./pages/ExecutivoPage'));
const EtlSaudePage = lazy(() => import('./pages/EtlSaudePage'));
const IntegracoesPage = lazy(() => import('./pages/IntegracoesPage'));
const AdminSetoresPage = lazy(() => import('./pages/AdminSetoresPage'));
const AdminUsuariosPage = lazy(() => import('./pages/AdminUsuariosPage'));

function RedirecionamentoInicial() {
  const { usuario, carregandoSessao } = useAutenticacao();

  if (carregandoSessao) {
    return <DashboardRouteLoading />;
  }

  return <Navigate to={usuario ? firstAccessibleRoute(usuario) : '/login'} replace />;
}

function RotaLogin() {
  const { usuario, carregandoSessao } = useAutenticacao();

  if (carregandoSessao) {
    return <DashboardRouteLoading />;
  }

  if (usuario) {
    return <Navigate to={firstAccessibleRoute(usuario)} replace />;
  }

  return <LoginPage />;
}

export default function App() {
  return (
    <>
      <ApiStatusToast />
      <Suspense fallback={<DashboardRouteLoading />}>
        <Routes>
          <Route path="/login" element={<RotaLogin />} />
          <Route path="/auth/trocar-senha" element={<RotaLogin />} />
          <Route path="/acesso-negado" element={<AcessoNegadoPage />} />

          <Route element={<RotaProtegida allowPasswordChange />}>
            <Route path="/alterar-senha" element={<AlterarSenhaPage />} />
          </Route>

          <Route element={<RotaProtegida />}>
            <Route element={<LayoutPainel />}>
              <Route path="/" element={<HomePage />} />

              <Route element={<RotaProtegida permissao="coletas" />}>
                <Route path="/coletas" element={<ColetasPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="manifestos" />}>
                <Route path="/manifestos" element={<ManifestosPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="fretes" />}>
                <Route path="/faturamento" element={<FaturamentoPage />} />
                <Route path="/fretes" element={<Navigate to="/faturamento" replace />} />
              </Route>

              <Route element={<RotaProtegida permissao="performance" />}>
                <Route path="/performance" element={<PerformancePage />} />
              </Route>

              <Route element={<RotaProtegida permissao="tracking" />}>
                <Route path="/tracking" element={<TrackingPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="faturasPorCliente" />}>
                <Route path="/faturas-por-cliente" element={<FaturasPorClientePage />} />
              </Route>

              <Route element={<RotaProtegida permissao="contasAPagar" />}>
                <Route path="/contas-a-pagar" element={<ContasAPagarPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="cotacoes" />}>
                <Route path="/cotacoes" element={<CotacoesPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="indicadoresGestaoAVista" />}>
                <Route path="/indicadores-gestao-a-vista" element={<IndicadoresGestaoAVistaPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="executivo" />}>
                <Route path="/executivo" element={<ExecutivoPage />} />
              </Route>

              <Route element={<RotaProtegida permissao="etlSaude" />}>
                <Route path="/etl-saude" element={<EtlSaudePage />} />
              </Route>

              <Route element={<RotaProtegida permissao="integracoes" />}>
                <Route path="/painel/integracoes" element={<IntegracoesPage />} />
                <Route path="/painel/quarentena" element={<Navigate to="/painel/integracoes" replace />} />
              </Route>

              <Route element={<RotaProtegida adminOnly />}>
                <Route path="/admin" element={<Navigate to="/admin/setores" replace />} />
                <Route path="/admin/setores" element={<AdminSetoresPage />} />
                <Route path="/admin/usuarios" element={<AdminUsuariosPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<RedirecionamentoInicial />} />
        </Routes>
      </Suspense>
    </>
  );
}
