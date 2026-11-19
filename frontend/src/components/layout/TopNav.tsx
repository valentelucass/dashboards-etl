import { Badge } from '@astryxdesign/core/Badge';
import DashboardButton from "../shared/DashboardButton";
import { Button } from '@astryxdesign/core/Button';
import { getDashboardNavSections, getNavIcon } from './dashboardNavItems';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Dialog } from '@astryxdesign/core/Dialog';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useFiltro } from '../../contexts/FiltroContext';
import { useTheme } from 'next-themes';
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { formatarDataHoraMinuto } from '../../utils/formatadores';
import { filterPresentationPages, type PresentationPage } from '../../utils/presentationSequence';
import PresentationSequencesModal from '../presentation/PresentationSequencesModal';
import CommunicationsBell from '../home/CommunicationsBell';

const focusRingClass = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

function DrawerNavSection({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavItem[];
  onNavigate: () => void;
}) {
  const headingId = `${title.toLowerCase().replace(/\s+/g, '-')}-heading`;
  const { obterLinkPainel } = useFiltro();

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {title}
      </h2>

      <div className="space-y-1.5">
        {items.map((item) => {
          const Icon = getNavIcon(item);

          return (
            <NavLink
              key={item.path}
              to={obterLinkPainel(item.path)}
              onClick={onNavigate}
              className={({ isActive }) =>
                `group flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150 ${focusRingClass} ${
                  isActive ? 'shadow-sm' : 'hover:-translate-y-px hover:bg-[var(--color-bg)]'
                }`
              }
              style={({ isActive }) => ({
                backgroundColor: isActive
                  ? 'var(--color-bg)'
                  : 'transparent',
                borderColor: isActive
                  ? 'var(--color-primary)'
                  : 'transparent',
                color: isActive ? 'var(--color-primary)' : 'var(--color-text)',
              })}
            >
              {({ isActive }) => (
                <>
                  <span
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors duration-150"
                    style={{
                      backgroundColor: isActive ? 'var(--color-primary)' : 'var(--color-bg)',
                      color: isActive ? '#FFFFFF' : 'var(--color-text-muted)',
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{item.label}</span>
                      {isActive && (
                        <Badge label="Atual" variant="info" />
                      )}
                    </span>
                    {item.description && (
                      <span className="mt-0.5 block text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                        {item.description}
                      </span>
                    )}
                  </span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </section>
  );
}

export default function TopNav() {
  const { usuario, logout } = useAutenticacao();
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const { theme, setTheme } = useTheme();
  const { canAccess, isAdminAcesso } = usePermissions();
  const pageHeader = usePageHeader();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [apresentacao, setApresentacao] = useState<{ paginas: NavItem[]; indice: number } | null>(null);
  const [isPresentationManagerOpen, setIsPresentationManagerOpen] = useState(false);
  const [drawerScrollState, setDrawerScrollState] = useState({ canScrollUp: false, canScrollDown: false });
  const hamburgerButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerNavRef = useRef<HTMLElement>(null);
  const wasMenuOpenRef = useRef(false);
  const previousPathnameRef = useRef(currentLocation.pathname);
  const panelId = useId();
  const drawerTitleId = `${panelId}-title`;

  const navSections = getDashboardNavSections(canAccess, isAdminAcesso);

  const isDarkTheme = theme === 'dark';
  const themeToggleLabel = isDarkTheme ? 'Alternar para modo claro' : 'Alternar para modo escuro';
  const hamburgerLabel = isMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação';
  const updatedAtLabel = pageHeader.updatedAt ? `Atualizado em ${formatarDataHoraMinuto(pageHeader.updatedAt)}` : null;

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

  const updateDrawerScrollState = useCallback(() => {
    const element = drawerNavRef.current;
    if (!element) {
      setDrawerScrollState({ canScrollUp: false, canScrollDown: false });
      return;
    }

    const maxScroll = element.scrollHeight - element.clientHeight;
    setDrawerScrollState({
      canScrollUp: element.scrollTop > 4,
      canScrollDown: maxScroll > 4 && element.scrollTop < maxScroll - 4,
    });
  }, []);

  const scrollDrawerNavigation = useCallback((direction: 'up' | 'down') => {
    const element = drawerNavRef.current;
    if (!element) return;

    const distance = Math.max(180, Math.floor(element.clientHeight * 0.65));
    element.scrollBy({
      top: direction === 'up' ? -distance : distance,
      behavior: 'smooth',
    });
  }, []);

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
    if (!isMenuOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMenuOpen, updateDrawerScrollState]);

  useEffect(() => {
    if (isMenuOpen) {
      wasMenuOpenRef.current = true;
      const frame = window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
        updateDrawerScrollState();
      });

      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    if (wasMenuOpenRef.current) {
      hamburgerButtonRef.current?.focus();
      wasMenuOpenRef.current = false;
    }
  }, [isMenuOpen, updateDrawerScrollState]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const element = drawerNavRef.current;
    if (!element) return;

    let frame = 0;
    const scheduleUpdate = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updateDrawerScrollState);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(element);
    if (element.firstElementChild) {
      observer.observe(element.firstElementChild);
    }
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [isMenuOpen, navSections.length, updateDrawerScrollState]);

  async function handleLogout() {
    setIsMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  }

  function toggleTheme() {
    setTheme(isDarkTheme ? 'light' : 'dark');
  }

  const drawer = isMenuOpen ? (
    <Dialog id={panelId} purpose="info" isOpen aria-labelledby={drawerTitleId} padding={0}
      position={{ start: 0, top: 0, bottom: 0 }} width="min(22rem, calc(100vw - 8px))" maxHeight="100dvh"
      onOpenChange={open => { if (!open) setIsMenuOpen(false); }}>
      <aside className="top-nav__drawer-panel flex min-w-0 flex-col overflow-hidden">
                <div
                  className="flex shrink-0 items-center gap-3 border-b px-5 py-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <h2 id={drawerTitleId} className="sr-only">Navegação</h2>
                  <div className="min-w-0 flex-1">
                    <NavLink to="/" onClick={() => setIsMenuOpen(false)} aria-label="Rodogarcia, página inicial" className="mb-3 inline-flex">
                      <span className="dashboard-brand-wordmark w-full max-w-[220px]">
                        <img src="/logo.png" alt="" className="dark:brightness-0 dark:invert" />
                      </span>
                    </NavLink>
                    <p className="truncate text-sm font-semibold" style={{ color: 'var(--color-text)' }} title={usuario?.nome}>
                      {usuario?.nome}
                    </p>
                    <p className="mt-1 truncate text-xs" style={{ color: 'var(--color-text-muted)' }} title={usuario?.email}>
                      {usuario?.email}
                    </p>
                  </div>
                  <DashboardButton
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-[var(--color-bg)] ${focusRingClass}`}
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label="Fechar menu de navegação"
                  >
                    <X size={18} />
                  </DashboardButton>
                </div>

                <div className="relative flex flex-1 overflow-hidden">
                  <nav
                    ref={drawerNavRef}
                    className="top-nav__drawer-nav flex-1 px-5 py-5"
                    aria-label="Navegação principal do painel"
                    onScroll={updateDrawerScrollState}
                  >
                    <div className="space-y-6 pr-1">
                      {navSections.map((section) => (
                        <DrawerNavSection
                          key={section.title}
                          title={section.title}
                          items={section.items}
                          onNavigate={() => setIsMenuOpen(false)}
                        />
                      ))}

                      <section aria-labelledby={`${panelId}-account-heading`}>
                        <h2
                          id={`${panelId}-account-heading`}
                          className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: 'var(--color-text-muted)' }}
                        >
                          Conta
                        </h2>
                        <DashboardButton
                          type="button"
                          onClick={() => void handleLogout()}
                          className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold text-red-500 transition-all duration-150 hover:-translate-y-px hover:bg-red-500 hover:text-white ${focusRingClass}`}
                          style={{
                            borderColor: '#dc2626',
                          }}
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-600 bg-red-50 text-red-600">
                            <LogOut size={16} />
                          </span>
                          Sair
                        </DashboardButton>
                      </section>
                    </div>
                  </nav>

                  {drawerScrollState.canScrollUp && (
                    <Button label="Subir a navegação do menu" variant="ghost" isIconOnly
                      icon={<ChevronUp size={18} />} onClick={() => scrollDrawerNavigation('up')}
                      className="top-nav__drawer-scroll-indicator top-nav__drawer-scroll-indicator--top absolute top-2 end-4 z-10" />
                  )}

                  {drawerScrollState.canScrollDown && (
                    <Button label="Descer a navegação do menu" variant="ghost" isIconOnly
                      icon={<ChevronDown size={18} />} onClick={() => scrollDrawerNavigation('down')}
                      className="top-nav__drawer-scroll-indicator top-nav__drawer-scroll-indicator--bottom absolute bottom-2 end-4 z-10" />
                  )}
                </div>
      </aside>
    </Dialog>
  ) : null;

  return (
    <>
      <header
        className={`top-nav sticky top-0 z-50 border-b px-4 shadow-sm sm:px-5 ${apresentacao ? 'py-2' : 'py-3'}`}
        style={{
          backgroundColor: 'var(--color-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className={`flex w-full items-center justify-between ${apresentacao ? 'gap-0' : 'gap-4'}`}>
          <div className={`flex min-w-0 items-center ${apresentacao ? 'max-w-[16rem] shrink gap-2' : 'flex-1 gap-4'}`}>
            <div className={`top-nav__page-copy min-w-0 ${apresentacao ? 'border-r pr-3' : ''}`} style={apresentacao ? { borderColor: 'var(--color-border)' } : undefined}>
              {!apresentacao && <span className="dashboard-nav-kicker">Dashboards Rodogarcia</span>}
              <h1 className={`truncate font-bold leading-tight ${apresentacao ? 'text-sm' : 'text-lg sm:text-xl'}`} style={{ color: 'var(--color-text)' }}>
                {pageHeader.title === 'Home' ? 'Início' : pageHeader.title}
              </h1>
              {!apresentacao && pageHeader.description && (
                <p className="dashboard-nav-description mt-0.5 line-clamp-2 text-xs leading-relaxed sm:text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {pageHeader.description}
                </p>
              )}
              {!apresentacao && updatedAtLabel && (
                <p className="mt-1 text-[11px] sm:hidden" style={{ color: 'var(--color-text-subtle)' }}>
                  {updatedAtLabel}
                </p>
              )}
            </div>
          </div>

          {apresentacao && <div id="presentation-filter-slot" className="min-w-0 flex-1 border-r px-3" style={{ borderColor: 'var(--color-border)' }} />}

          <div className={`top-nav__right flex shrink-0 items-center ${apresentacao ? 'gap-1.5 pl-3' : 'gap-2'}`}>
            {updatedAtLabel && (
              <span className={`top-nav__updated hidden max-w-[12rem] text-right leading-relaxed md:block ${apresentacao ? 'text-[10px]' : 'text-xs'}`} style={{ color: 'var(--color-text-subtle)' }}>
                {updatedAtLabel}
              </span>
            )}

            {apresentacao && (
              <div className="flex items-center gap-1 border-l pl-3" style={{ borderColor: 'var(--color-border)' }}>
                <span className="hidden pr-1 text-[10px] font-semibold lg:inline" style={{ color: 'var(--color-text-muted)' }}>
                  {apresentacao.indice + 1}/{apresentacao.paginas.length}
                </span>
                <DashboardButton type="button" onClick={() => navegarApresentacao(-1)} disabled={apresentacao.indice === 0} title="Página anterior" aria-label="Página anterior" className={`flex h-6 w-6 items-center justify-center rounded disabled:opacity-40 ${focusRingClass}`}>
                  <ChevronLeft size={14} />
                </DashboardButton>
                <DashboardButton type="button" onClick={() => navegarApresentacao(1)} disabled={apresentacao.indice === apresentacao.paginas.length - 1} title="Próxima página" aria-label="Próxima página" className={`flex h-6 w-6 items-center justify-center rounded disabled:opacity-40 ${focusRingClass}`}>
                  <ChevronRight size={14} />
                </DashboardButton>
                <DashboardButton type="button" onClick={() => void sairApresentacao()} title="Sair da apresentação (Esc)" aria-label="Sair da apresentação" className={`flex h-6 w-6 items-center justify-center rounded text-red-500 ${focusRingClass}`}>
                  <X size={14} />
                </DashboardButton>
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
              className="top-nav__theme-button"
            />

            <Button
              label="Gerenciar apresentações"
              variant="ghost"
              isIconOnly
              icon={<Settings2 size={17} aria-hidden="true" />}
              onClick={() => setIsPresentationManagerOpen(true)}
              className="top-nav__theme-button"
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
            <Button
              ref={hamburgerButtonRef}
              label={hamburgerLabel}
              variant="ghost"
              isIconOnly
              icon={isMenuOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
              onClick={() => setIsMenuOpen((current) => !current)}
              aria-expanded={isMenuOpen}
              aria-controls={panelId}
              className="top-nav__menu-button"
            />
          </div>
        </div>
      </header>

      {drawer}
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
