import { QueryClient } from '@tanstack/react-query';
import { DASHBOARD_CACHE_TIME_MS, DASHBOARD_DOMAINS, installDashboardCacheLimits } from './dashboardCache';

export const BASE_QUERY_STALE_TIME_MS = 5 * 60 * 1000;

export function createDashboardQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: BASE_QUERY_STALE_TIME_MS,
        refetchOnWindowFocus: false,
      },
    },
  });
  for (const domain of DASHBOARD_DOMAINS) {
    client.setQueryDefaults([domain], { gcTime: DASHBOARD_CACHE_TIME_MS });
  }
  installDashboardCacheLimits(client);
  return client;
}
