import type { ComponentPropsWithRef } from 'react';
import { SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav';
import { Link, useLocation } from 'react-router-dom';
import { useFiltro } from '../../contexts/FiltroContext';
import { getNavIcon, type DashboardNavSection } from './dashboardNavItems';

function DashboardNavLink({ href, ...props }: ComponentPropsWithRef<'a'>) {
  return <Link {...props} to={href ?? '/'} />;
}

export function DashboardNavGroups({ sections, onNavigate }: { sections: DashboardNavSection[]; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const { obterLinkPainel } = useFiltro();
  return (
    <>
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
              onClick={onNavigate}
              isSelected={pathname === item.path}
            />;
          })}
        </SideNavSection>
      ))}
    </>
  );
}
