import type { LucideIcon } from 'lucide-react';
import {
  Activity, BarChart3, Building2, ClipboardList, CreditCard, HeartPulse, House,
  LayoutDashboard, MapPinned, Truck, UserCog, Users,
} from 'lucide-react';
import { ADMIN_NAV_ITEMS, DASHBOARD_NAV_ITEMS, isAdministrativeDashboardNavItem } from '../../utils/accessControl';
import type { NavItem } from '../../utils/accessControl';
import type { PermissionKey } from '../../types/access';

const icons: Record<string, LucideIcon> = {
  '/': House,
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

export interface DashboardNavSection {
  title: string;
  items: NavItem[];
}

export function getNavIcon(item: NavItem): LucideIcon {
  return icons[item.path] ?? LayoutDashboard;
}

export function getDashboardNavSections(
  canAccess: (permission: PermissionKey) => boolean,
  isAdminAcesso: boolean,
): DashboardNavSection[] {
  const byLabel = (left: NavItem, right: NavItem) => left.label.localeCompare(right.label, 'pt-BR');
  const allowed = DASHBOARD_NAV_ITEMS.filter(item => !item.permission || canAccess(item.permission));
  return [
    { title: 'Principal', items: [{ label: 'Início', path: '/', description: 'Central de dashboards e comunicados' }] },
    { title: 'Dashboards', items: allowed.filter(item => !isAdministrativeDashboardNavItem(item)).sort(byLabel) },
    { title: 'Administração', items: [
      ...allowed.filter(isAdministrativeDashboardNavItem),
      ...(isAdminAcesso ? ADMIN_NAV_ITEMS : []),
    ].sort(byLabel) },
  ].filter(section => section.items.length > 0);
}

