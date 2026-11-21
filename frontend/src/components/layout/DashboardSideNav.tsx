import { useState } from 'react';
import { ChevronDown, ChevronUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { SideNav } from '@astryxdesign/core/SideNav';
import { Link } from 'react-router-dom';
import { useAutenticacao } from '../../contexts/AutenticacaoContext';
import { useFiltro } from '../../contexts/FiltroContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getDashboardNavSections, type DashboardNavSection } from './dashboardNavItems';

import { DashboardNavGroups } from './DashboardNavGroups';
import { useNavScroll } from './useNavScroll';

const collapseKey = 'dashboard-sidebar-collapsed';

function storedCollapsed(): boolean {
  try {
    return localStorage.getItem(collapseKey) !== 'false';
  } catch {
    return true;
  }
}

interface DashboardSideNavViewProps {
  sections: DashboardNavSection[];
  nome?: string;
  setor?: string;
}

export function DashboardSideNavView({ sections, nome, setor }: DashboardSideNavViewProps) {
  const { obterLinkPainel } = useFiltro();
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const { listRef, arrowUpRef, arrowDownRef, scrollState, scrollMenu } = useNavScroll();

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
          <Button label={collapsed ? 'Expandir menu' : 'Recolher menu'} variant="ghost" isIconOnly={collapsed} className="dashboard-side-toggle"
            width={collapsed ? undefined : '100%'}
            icon={collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
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
          <DashboardNavGroups sections={sections} />
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

