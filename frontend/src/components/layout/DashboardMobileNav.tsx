import { useRef } from 'react';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Button } from '@astryxdesign/core/Button';
import { MobileNav } from '@astryxdesign/core/MobileNav';
import { SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { ChevronDown, ChevronUp, LogOut, Presentation, Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFiltro } from '../../contexts/FiltroContext';
import { DashboardNavGroups } from './DashboardNavGroups';
import { useNavScroll } from './useNavScroll';
import type { DashboardNavSection } from './dashboardNavItems';

interface MobileNavProps {
  id: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: DashboardNavSection[];
  nome?: string;
  setor?: string;
  email?: string;
  canPresent: boolean;
  onStart: () => void;
  onManage: () => void;
  onLogout: () => void;
}

export default function DashboardMobileNav({
  id, open, onOpenChange, sections, nome, setor, email, canPresent, onStart, onManage, onLogout,
}: MobileNavProps) {
  const { obterLinkPainel } = useFiltro();
  const { listRef, arrowUpRef, arrowDownRef, scrollState, scrollMenu } = useNavScroll(open);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => onOpenChange(false);

  function managePresentations() {
    // Open the next layer after the drawer releases focus back to the menu button.
    dialogRef.current?.addEventListener('close', onManage, { once: true });
    close();
  }

  return (
    <MobileNav ref={dialogRef} id={id} isOpen={open} onOpenChange={onOpenChange}
      label="Navegação dos dashboards" side="start" width={310} className="dashboard-mobile-nav"
      header={<Link to={obterLinkPainel('/')} aria-label="Rodogarcia, página inicial" onClick={close}
        className="dashboard-brand-wordmark dashboard-mobile-wordmark">
        <img src="/logo.png" alt="" className="dark:brightness-0 dark:invert" />
      </Link>}>
      <div className="dashboard-mobile-body">
        {scrollState.up && <div className="dashboard-mobile-arrow" ref={arrowUpRef}>
          <Button label="Subir menu lateral" isIconOnly variant="ghost" size="sm" icon={<ChevronUp size={18} />}
            onClick={() => scrollMenu(-1)} />
        </div>}
        <div className="dashboard-mobile-scroll">
          <div ref={listRef} className="dashboard-mobile-list">
            <DashboardNavGroups sections={sections} onNavigate={close} />
            <SideNavSection title="Apresentações">
              <SideNavItem label="Iniciar apresentação" icon={<Presentation size={17} />} isDisabled={!canPresent} onClick={onStart} />
              <SideNavItem label="Gerenciar apresentações" icon={<Settings2 size={17} />} onClick={managePresentations} />
            </SideNavSection>
          </div>
        </div>
        {scrollState.down && <div className="dashboard-mobile-arrow" ref={arrowDownRef}>
          <Button label="Descer menu lateral" isIconOnly variant="ghost" size="sm" icon={<ChevronDown size={18} />}
            onClick={() => scrollMenu(1)} />
        </div>}
        <div className="dashboard-mobile-profile">
          {nome && <Avatar name={nome} size="sm" />}
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-sm" title={nome}>{nome}</strong>
            <span className="block truncate text-xs" title={email}>{email ?? setor}</span>
          </div>
          <Button label="Sair" variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onLogout} />
        </div>
      </div>
    </MobileNav>
  );
}
