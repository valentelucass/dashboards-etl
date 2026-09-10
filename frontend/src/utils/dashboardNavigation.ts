import { DASHBOARD_CACHE_PAGE_LIMIT, DASHBOARD_DOMAINS } from '../config/dashboardCache';

export type DashboardNavigationEntry = { path: string; search: string };

export function rememberDashboardSearch(entries: DashboardNavigationEntry[], path: string, search: string) {
  const domain = path.replace(/^\/painel\//, '/').slice(1);
  if (!DASHBOARD_DOMAINS.has(domain)) return entries;
  return [...entries.filter(entry => entry.path !== path),
    { path, search }].slice(-DASHBOARD_CACHE_PAGE_LIMIT);
}

export function rememberedDashboardHref(entries: DashboardNavigationEntry[], path: string) {
  const entry = entries.find(item => item.path === path);
  return `${path}${entry?.search ?? ''}`;
}
