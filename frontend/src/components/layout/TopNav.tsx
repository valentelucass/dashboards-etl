import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Activity,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Moon,
  Presentation,
  Settings2,
  Sun,
  Truck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAutenticacao } from '../../contexts/AutenticacaoContext';
import { usePageHeader } from '../../contexts/PageHeaderContext';
import { usePermissions } from '../../hooks/usePermissions';
import { ADMIN_NAV_ITEMS, DASHBOARD_NAV_ITEMS, isAdministrativeDashboardNavItem } from '../../utils/accessControl';
import type { NavItem } from '../../utils/accessControl';
import { formatarDataHoraMinuto } from '../../utils/formatadores';
import { filterPresentationPages, type PresentationPage } from '../../utils/presentationSequence';
import PresentationSequencesModal from '../presentation/PresentationSequencesModal';

const focusRingClass = 'outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-card)]';

const NAV_ICON_BY_PATH: Record<string, ComponentType<{ size?: number; className?: string }>> = {
  '/': LayoutDashboard,
  '/coletas': ClipboardList,
  '/manifestos': LayoutDashboard,
  '/faturamento': Truck,
  '/performance': BarChart3,
  '/tracking': MapPinned,
  '/faturas-por-cliente': Users,
  '/contas-a-pagar': CreditCard,
  '/cotacoes': ClipboardList,
  '/indicadores-gestao-a-vista': BarChart3,
  '/executivo': Activity,
  '/etl-saude': HeartPulse,
  '/painel/integracoes': Activity,
  '/admin/setores': Building2,
  '/admin/usuarios': UserCog,
};

const HOME_NAV_ITEM: NavItem = {
  label: 'Home',
  path: '/',
  description: 'Central de dashboards e comunicados',
};

function getNavIcon(item: NavItem) {
  return NAV_ICON_BY_PATH[item.path] ?? LayoutDashboard;
}

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
              to={item.path}
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
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
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
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold leading-none"
                          style={{ backgroundColor: 'rgba(33, 71, 138, 0.14)', color: 'var(--color-primary)' }}
                        >
                          Atual
                        </span>
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
  const { canAccess, isAdminAcesso, isAdminPlataforma } = usePermissions();
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

  const dashboardsVisiveis = DASHBOARD_NAV_ITEMS
    .filter((item) => !isAdministrativeDashboardNavItem(item))
    .filter((item) => item.permission ? canAccess(item.permission) : true)
    .sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  const adminItems = [
    ...DASHBOARD_NAV_ITEMS.filter((item) => (
      isAdministrativeDashboardNavItem(item)
      && (item.permission ? canAccess(item.permission) : true)
    )),
    ...(isAdminAcesso ? ADMIN_NAV_ITEMS : []),
  ].sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'));
  const navSections = [
    { title: 'Principal', items: [HOME_NAV_ITEM] },
    { title: 'Dashboards', items: dashboardsVisiveis },
    ...(adminItems.length > 0 ? [{ title: 'Administração', items: adminItems }] : []),
  ].filter((section) => section.items.length > 0);

  const adminBadge = isAdminPlataforma
    ? 'Admin Plataforma'
    : isAdminAcesso
      ? 'Admin Acesso'
      : null;
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
    if (!isMenuOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

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

  const drawer = typeof document !== 'undefined'
    ? createPortal(
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                className="top-nav__drawer-backdrop fixed inset-0 z-[55]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.24, ease: 'easeOut' }}
                onClick={() => setIsMenuOpen(false)}
                aria-hidden="true"
              />

              <motion.aside
                id={panelId}
                role="dialog"
                aria-modal="true"
                aria-labelledby={drawerTitleId}
                className="top-nav__drawer-panel fixed inset-y-0 right-0 z-[60] flex flex-col overflow-hidden border-l shadow-2xl"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}
                style={{
                  backgroundColor: 'var(--color-card)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div
                  className="border-b px-5 py-4"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <NavLink
                        to="/"
                        onClick={() => {
                          setIsMenuOpen(false);
                          void sairApresentacao();
                        }}
                        className={`top-nav__drawer-logo-mark flex h-10 shrink-0 items-center justify-center ${focusRingClass}`}
                        aria-label="Ir para Home"
                        title="Ir para Home"
                      >
                        <img
                          src="/logo.png"
                          alt="Logo da empresa"
                          className="h-7 max-w-[7.5rem] object-contain transition-all duration-200 dark:brightness-0 dark:invert"
                        />
                      </NavLink>
                      <div className="min-w-0">
                        <p id={drawerTitleId} className="truncate text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                          Menu do painel
                        </p>
                        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          {usuario?.nome ?? 'Dashboards ETL'}
                        </p>
                      </div>
                    </div>

                    <button
                      ref={closeButtonRef}
                      type="button"
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-[var(--color-bg)] ${focusRingClass}`}
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label="Fechar menu de navegação"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div
                    className="mt-4 rounded-xl border px-3 py-2.5"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
                          {usuario?.setor.nome ?? 'Perfil ativo'}
                        </p>
                        <p className="truncate text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                          {usuario?.email ?? 'Sessão ativa'}
                        </p>
                      </div>
                      {adminBadge && (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ backgroundColor: 'rgba(249, 115, 22, 0.16)', color: '#ea580c' }}
                        >
                          {adminBadge}
                        </span>
                      )}
                    </div>
                  </div>
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
                        <button
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
                        </button>
                      </section>
                    </div>
                  </nav>

                  <button
                    type="button"
                    onClick={() => scrollDrawerNavigation('up')}
                    disabled={!drawerScrollState.canScrollUp}
                    aria-label="Subir a navegação do menu"
                    className={`absolute inset-x-0 top-0 z-10 flex justify-center pb-8 pt-3 top-nav__drawer-scroll-indicator top-nav__drawer-scroll-indicator--top ${focusRingClass}`}
                    style={{
                      opacity: drawerScrollState.canScrollUp ? 1 : 0,
                      transform: drawerScrollState.canScrollUp ? 'translateY(0)' : 'translateY(-8px)',
                    }}
                  >
                    <ChevronUp size={18} />
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollDrawerNavigation('down')}
                    disabled={!drawerScrollState.canScrollDown}
                    aria-label="Descer a navegação do menu"
                    className={`absolute inset-x-0 bottom-0 z-10 flex justify-center pb-3 pt-8 top-nav__drawer-scroll-indicator top-nav__drawer-scroll-indicator--bottom ${focusRingClass}`}
                    style={{
                      opacity: drawerScrollState.canScrollDown ? 1 : 0,
                      transform: drawerScrollState.canScrollDown ? 'translateY(0)' : 'translateY(8px)',
                    }}
                  >
                    <ChevronDown size={18} />
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )
    : null;

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
            <NavLink
              to="/"
              onClick={() => void sairApresentacao()}
              className={`top-nav__logo-wrap flex shrink-0 items-center border-r ${apresentacao ? 'pr-2' : 'pr-4'} ${focusRingClass}`}
              style={{ borderColor: 'var(--color-border)' }}
              aria-label="Ir para Home"
              title="Ir para Home"
            >
              <img
                src="/logo.png"
                alt="Logo da empresa"
                className={`top-nav__logo w-auto object-contain transition-all duration-200 dark:brightness-0 dark:invert ${apresentacao ? 'h-5' : 'h-8'}`}
              />
            </NavLink>

            <div className={`top-nav__page-copy min-w-0 ${apresentacao ? 'border-r pr-3' : ''}`} style={apresentacao ? { borderColor: 'var(--color-border)' } : undefined}>
              <h1 className={`truncate font-bold leading-tight ${apresentacao ? 'text-sm' : 'text-lg sm:text-xl'}`} style={{ color: 'var(--color-text)' }}>
                {pageHeader.title}
              </h1>
              {!apresentacao && pageHeader.description && (
                <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed sm:text-sm" style={{ color: 'var(--color-text-muted)' }}>
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
                <button type="button" onClick={() => navegarApresentacao(-1)} disabled={apresentacao.indice === 0} title="Página anterior" aria-label="Página anterior" className={`flex h-6 w-6 items-center justify-center rounded disabled:opacity-40 ${focusRingClass}`}>
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => navegarApresentacao(1)} disabled={apresentacao.indice === apresentacao.paginas.length - 1} title="Próxima página" aria-label="Próxima página" className={`flex h-6 w-6 items-center justify-center rounded disabled:opacity-40 ${focusRingClass}`}>
                  <ChevronRight size={14} />
                </button>
                <button type="button" onClick={() => void sairApresentacao()} title="Sair da apresentação (Esc)" aria-label="Sair da apresentação" className={`flex h-6 w-6 items-center justify-center rounded text-red-500 ${focusRingClass}`}>
                  <X size={14} />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => void iniciarApresentacao()}
              title="Iniciar apresentação"
              aria-label="Iniciar apresentação em tela cheia"
              disabled={paginasApresentacao.length === 0}
              className={`top-nav__theme-button flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-[var(--color-bg)] disabled:opacity-40 ${focusRingClass}`}
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Presentation size={17} />
            </button>

            <button
              type="button"
              onClick={() => setIsPresentationManagerOpen(true)}
              title="Gerenciar apresentações"
              aria-label="Gerenciar apresentações"
              className={`top-nav__theme-button flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-[var(--color-bg)] ${focusRingClass}`}
              style={{ color: 'var(--color-text-muted)' }}
            >
              <Settings2 size={17} />
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              title={themeToggleLabel}
              aria-label={themeToggleLabel}
              className={`top-nav__theme-button flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-[var(--color-bg)] ${focusRingClass}`}
              style={{ color: 'var(--color-text-muted)' }}
            >
              {isDarkTheme ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <button
              ref={hamburgerButtonRef}
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              aria-label={hamburgerLabel}
              aria-expanded={isMenuOpen}
              aria-controls={panelId}
              className={`top-nav__menu-button flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150 hover:bg-[var(--color-bg)] ${focusRingClass}`}
              style={{ color: 'var(--color-text-muted)' }}
            >
              {isMenuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
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
