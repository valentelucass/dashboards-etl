import { useEffect, useRef, useState, type ComponentPropsWithRef } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Link, useLocation } from 'react-router-dom';
import { useAutenticacao } from '../../contexts/AutenticacaoContext';
import { useFiltro } from '../../contexts/FiltroContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDashboardNavSections, getNavIcon, type DashboardNavSection } from './dashboardNavItems';

const collapseKey = 'dashboard-sidebar-collapsed';

function storedCollapsed(): boolean {
  try {
    return localStorage.getItem(collapseKey) !== 'false';
  } catch {
    return true;
  }
}

function DashboardNavLink({ href, ...props }: ComponentPropsWithRef<'a'>) {
  return <Link {...props} to={href ?? '/'} />;
}

interface DashboardSideNavViewProps {
  sections: DashboardNavSection[];
  nome?: string;
  setor?: string;
}

export function DashboardSideNavView({ sections, nome, setor }: DashboardSideNavViewProps) {
  const { pathname } = useLocation();
  const { obterLinkPainel } = useFiltro();
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const listRef = useRef<HTMLDivElement>(null);
  const arrowUpRef = useRef<HTMLDivElement>(null);
  const arrowDownRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ overflow: false, up: false, down: false });

  useEffect(() => {
    const list = listRef.current;
    const viewport = list?.parentElement;
    if (!list || !viewport) return;

    function measure() {
      if (!viewport || !list) return;
      const arrowHeight = (arrowUpRef.current?.offsetHeight ?? 0) + (arrowDownRef.current?.offsetHeight ?? 0);
      const overflow = list.scrollHeight > viewport.clientHeight + arrowHeight + 1;
      const up = overflow && viewport.scrollTop > 1;
      const down = overflow && viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1;
      setScrollState(current => current.overflow === overflow && current.up === up && current.down === down
        ? current : { overflow, up, down });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(viewport);
    viewport.addEventListener('scroll', measure, { passive: true });
    const frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener('scroll', measure);
    };
  }, [collapsed]);

  function scrollMenu(direction: -1 | 1) {
    const viewport = listRef.current?.parentElement;
    if (!viewport) return;
    viewport.scrollBy({
      top: direction * Math.max(76, Math.round(viewport.clientHeight * .56)),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }

  function onCollapsedChange(next: boolean) {
    setCollapsed(next);
    try {
      localStorage.setItem(collapseKey, String(next));
    } catch {
      // O menu continua funcionando sem armazenamento persistente.
    }
  }

  return (
    <aside className="dashboard-side-rail" data-collapsed={collapsed} aria-label="Menu lateral do dashboard">
      <SideNav
        className="dashboard-side-nav"
        aria-label="Navegação dos dashboards"
        style={{ width: collapsed ? 62 : 248 }}
        collapsible={{ isCollapsed: collapsed, onCollapsedChange, hasButton: false }}
        header={<Link to={obterLinkPainel('/')} className="dashboard-side-brand" data-collapsed={collapsed} aria-label="Rodogarcia, página inicial">
          {collapsed ? <img src="/favicon.svg" alt="" /> : (
            <span className="dashboard-brand-wordmark">
              <img src="/logo.png" alt="" className="dark:brightness-0 dark:invert" />
            </span>
          )}
        </Link>}
        topContent={scrollState.up && <div className="dashboard-side-scroll" ref={arrowUpRef}>
          <Button label="Subir menu lateral" size="sm" variant="ghost" isIconOnly
            icon={<ChevronUp size={16} aria-hidden="true" />} onClick={() => scrollMenu(-1)} />
        </div>}
        footer={<div className="dashboard-side-footer" data-collapsed={collapsed}>
          {scrollState.overflow && <div className="dashboard-side-scroll" ref={arrowDownRef} data-visible={scrollState.down}>
            <Button label="Descer menu lateral" size="sm" variant="ghost" isIconOnly isDisabled={!scrollState.down}
              icon={<ChevronDown size={16} aria-hidden="true" />} onClick={() => scrollMenu(1)} />
          </div>}
          <Button label={collapsed ? 'Expandir menu' : 'Minimizar menu'} variant="ghost" isIconOnly={collapsed} className="dashboard-side-toggle"
            width={collapsed ? undefined : '100%'}
            icon={collapsed ? <ChevronRight size={16} aria-hidden="true" /> : <ChevronLeft size={16} aria-hidden="true" />}
            aria-expanded={!collapsed} onClick={() => onCollapsedChange(!collapsed)} />
          {nome && <div className="dashboard-side-profile" data-collapsed={collapsed} title={collapsed ? nome : undefined}>
            <Avatar name={nome} size="sm" />
            {!collapsed && <div className="min-w-0">
              <strong className="block truncate text-sm">{nome}</strong>
              {setor && <span className="block truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{setor}</span>}
            </div>}
          </div>}
        </div>}
      >
        <div className="dashboard-side-list" ref={listRef}>
          {sections.map(({ title, items }) => (
            <SideNavSection key={title} title={title === 'Principal' ? 'Navegação' : title}>
              {items.map(item => {
                const Icon = getNavIcon(item);
                return <SideNavItem
                  key={item.path}
                  label={item.label}
                  icon={<Icon size={17} aria-hidden="true" />}
                  as={DashboardNavLink}
                  href={obterLinkPainel(item.path)}
                  isSelected={pathname === item.path}
                />;
              })}
            </SideNavSection>
          ))}
        </div>
      </SideNav>
    </aside>
  );
}

export default function DashboardSideNav() {
  const { canAccess, isAdminAcesso } = usePermissions();
  const { usuario } = useAutenticacao();
  return <DashboardSideNavView
    sections={getDashboardNavSections(canAccess, isAdminAcesso)}
    nome={usuario?.nome}
    setor={usuario?.setor.nome}
  />;
}

