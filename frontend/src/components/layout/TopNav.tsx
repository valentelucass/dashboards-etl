import DashboardMobileNav from './DashboardMobileNav';
import './dashboard-mobile-nav.css';
import { Button } from '@astryxdesign/core/Button';
import { getDashboardNavSections } from './dashboardNavItems';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  Moon,
  Presentation,
  Settings2,
  Sun,
  X,
} from 'lucide-react';
import { useAutenticacao } from '../../contexts/AutenticacaoContext';
import { usePageHeader } from '../../contexts/PageHeaderContext';
import { usePermissions } from '../../hooks/usePermissions';
import type { NavItem } from '../../utils/accessControl';
import { filterPresentationPages, type PresentationPage } from '../../utils/presentationSequence';
import PresentationSequencesModal from '../presentation/PresentationSequencesModal';
import CommunicationsBell from '../home/CommunicationsBell';

interface TopNavProps {
  toolbarRef: React.RefCallback<HTMLDivElement>;
  panelRef: React.RefCallback<HTMLDivElement>;
}

export default function TopNav({ toolbarRef, panelRef }: TopNavProps) {
  const { usuario, logout } = useAutenticacao();
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const { theme, setTheme } = useTheme();
  const { canAccess, isAdminAcesso } = usePermissions();
  const pageHeader = usePageHeader();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apresentacao, setApresentacao] = useState<{ paginas: NavItem[]; indice: number } | null>(null);
  const [isPresentationManagerOpen, setIsPresentationManagerOpen] = useState(false);
  const previousPathnameRef = useRef(currentLocation.pathname);
  const panelId = useId();

  const navSections = getDashboardNavSections(canAccess, isAdminAcesso);

  const isDarkTheme = theme === 'dark';
  const themeToggleLabel = isDarkTheme ? 'Alternar para modo claro' : 'Alternar para modo escuro';
  const hamburgerLabel = isMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação';

  const paginasApresentacao = filterPresentationPages(canAccess);

  const iniciarApresentacao = useCallback(async (paginas = paginasApresentacao) => {
    if (paginas.length === 0) return;
    setIsMenuOpen(false);
    setApresentacao({ paginas, indice: 0 });
    navigate(paginas[0].path);
    try { await document.documentElement.requestFullscreen(); } catch { /* O modo continua funcional sem fullscreen. */ }
  }, [navigate, paginasApresentacao]);

  const sairApresentacao = useCallback(async () => {
    setApresentacao(null);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // A apresentação já foi encerrada no React; falha nativa não deve quebrar a navegação.
      }
    }
  }, []);

  const navegarApresentacao = useCallback((direcao: -1 | 1) => {
    if (!apresentacao) return;
    const indice = apresentacao.indice + direcao;
    if (indice < 0 || indice >= apresentacao.paginas.length) return;
    setApresentacao({ ...apresentacao, indice });
    navigate(apresentacao.paginas[indice].path);
  }, [apresentacao, navigate]);

  useEffect(() => {
    document.body.dataset.presentationMode = apresentacao ? 'true' : 'false';
    window.dispatchEvent(new Event('dashboard:presentation-mode-change'));
    return () => {
      delete document.body.dataset.presentationMode;
      window.dispatchEvent(new Event('dashboard:presentation-mode-change'));
    };
  }, [apresentacao]);

  useEffect(() => {
    if (!apresentacao) return;

    const handlePresentationKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        void sairApresentacao();
      }
    };

    window.addEventListener('keydown', handlePresentationKeyDown, true);
    return () => window.removeEventListener('keydown', handlePresentationKeyDown, true);
  }, [apresentacao, sairApresentacao]);

  useEffect(() => {
    if (!apresentacao) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setApresentacao(null);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [apresentacao]);

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = currentLocation.pathname;

    if (!isMenuOpen || previousPathname === currentLocation.pathname) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setIsMenuOpen(false);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [currentLocation.pathname, isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen || apresentacao) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setIsMenuOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [isMenuOpen, apresentacao]);

  async function handleLogout() {
    setIsMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function toggleTheme() {
    setTheme(isDarkTheme ? 'light' : 'dark');
  }

  return (
    <>
      <header
        className={`top-nav sticky top-0 z-50 border-b px-4 shadow-sm sm:px-5 ${apresentacao ? 'py-2' : 'py-3'}`}
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className={`top-nav__bar flex w-full items-center justify-between ${apresentacao ? 'gap-0' : 'gap-4'}`}>
          <div className={`top-nav__identity flex min-w-0 items-center ${apresentacao ? 'max-w-[16rem] shrink gap-2' : 'flex-1 gap-4'}`}>
            <Button label={hamburgerLabel} variant="ghost" isIconOnly
              icon={<span className="dashboard-menu-mark"><img src="/favicon.svg" alt="" /><Menu size={12} aria-hidden="true" /></span>}
              onClick={() => setIsMenuOpen(true)} aria-expanded={isMenuOpen}
              aria-haspopup="dialog" aria-controls={panelId} className="top-nav__menu-button" />
            <div className={`top-nav__page-copy min-w-0 ${apresentacao ? 'border-r pr-3' : ''}`} style={apresentacao ? { borderColor: 'var(--color-border)' } : undefined}>
              <h1 title={pageHeader.title === 'Home' ? 'Início' : pageHeader.title} className={`truncate font-bold leading-tight ${apresentacao ? 'text-sm' : 'text-lg sm:text-xl'}`} style={{ color: 'var(--color-text)' }}>
                {pageHeader.title === 'Home' ? 'Início' : pageHeader.title}
              </h1>
              {!apresentacao && pageHeader.description && (
                <p className="dashboard-nav-description mt-0.5 line-clamp-2 text-xs leading-relaxed sm:text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {pageHeader.description}
                </p>
              )}
            </div>
          </div>

          {apresentacao && <div id="presentation-filter-slot" className="min-w-0 flex-1 border-r px-3" style={{ borderColor: 'var(--color-border)' }} />}
          {!apresentacao && <div ref={toolbarRef} className="top-nav__filters" />}

          <div className={`top-nav__right flex shrink-0 items-center ${apresentacao ? 'gap-1.5 pl-3' : 'gap-2'}`}>
            {apresentacao && (
              <div role="group" aria-label="Controles da apresentação" className="flex items-center gap-1 border-l pl-3" style={{ borderColor: 'var(--color-border)' }}>
                <span className="hidden pr-1 text-[10px] font-semibold lg:inline" style={{ color: 'var(--color-text-muted)' }}>
                  {apresentacao.indice + 1}/{apresentacao.paginas.length}
                </span>
                <Button label="Página anterior" tooltip="Página anterior" variant="ghost" size="sm" isIconOnly
                  icon={<ChevronLeft size={17} aria-hidden="true" />} isDisabled={apresentacao.indice === 0}
                  onClick={() => navegarApresentacao(-1)} />
                <Button label="Próxima página" tooltip="Próxima página" variant="ghost" size="sm" isIconOnly
                  icon={<ChevronRight size={17} aria-hidden="true" />} isDisabled={apresentacao.indice === apresentacao.paginas.length - 1}
                  onClick={() => navegarApresentacao(1)} />
                <Button label="Sair da apresentação" tooltip="Sair da apresentação (Esc)" variant="ghost" size="sm" isIconOnly
                  icon={<X size={17} aria-hidden="true" className="text-red-500" />} onClick={() => void sairApresentacao()} />
              </div>
            )}

            <Button
              label="Iniciar apresentação em tela cheia"
              tooltip="Iniciar apresentação"
              variant="ghost"
              isIconOnly
              icon={<Presentation size={17} aria-hidden="true" />}
              onClick={() => void iniciarApresentacao()}
              isDisabled={paginasApresentacao.length === 0}
              className="top-nav__presentation-action top-nav__theme-button"
            />

            <Button
              label="Gerenciar apresentações"
              variant="ghost"
              isIconOnly
              icon={<Settings2 size={17} aria-hidden="true" />}
              onClick={() => setIsPresentationManagerOpen(true)}
              className="top-nav__presentation-action top-nav__theme-button"
            />

            <CommunicationsBell />
            <Button
              label={themeToggleLabel}
              tooltip={themeToggleLabel}
              variant="ghost"
              isIconOnly
              icon={isDarkTheme ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
              onClick={toggleTheme}
              className="top-nav__theme-button"
            />

            {!apresentacao && usuario && <div className="dashboard-top-account">
              <Button label="Sair" variant="ghost" icon={<LogOut size={16} aria-hidden="true" />} onClick={() => void handleLogout()} />
            </div>}

          </div>
        </div>
        {!apresentacao && <div ref={panelRef} className="top-nav__filter-panel" />}
      </header>

      <DashboardMobileNav id={panelId} open={isMenuOpen} onOpenChange={setIsMenuOpen} sections={navSections}
        nome={usuario?.nome} setor={usuario?.setor.nome} email={usuario?.email} canPresent={paginasApresentacao.length > 0}
        onStart={() => void iniciarApresentacao()} onManage={() => setIsPresentationManagerOpen(true)}
        onLogout={() => void handleLogout()} />
      <PresentationSequencesModal
        open={isPresentationManagerOpen}
        paginasDisponiveis={paginasApresentacao.map((pagina) => ({ id: pagina.path.slice(1), label: pagina.label }))}
        onClose={() => setIsPresentationManagerOpen(false)}
        onStart={(ids) => {
          const paginas = ids
            .map((id) => paginasApresentacao.find((pagina) => pagina.path === `/${id}`))
            .filter((pagina): pagina is PresentationPage => Boolean(pagina));
          void iniciarApresentacao(paginas);
        }}
      />
    </>
  );
}
