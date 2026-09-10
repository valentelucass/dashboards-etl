import type { Query, QueryClient, QueryKey } from '@tanstack/react-query';

export const DASHBOARD_CACHE_TIME_MS = 30 * 60 * 1000;
export const DASHBOARD_CACHE_PAGE_LIMIT = 5;
export const DASHBOARD_CACHE_QUERIES_PER_PAGE = 24;
export const DIMENSION_CACHE_QUERY_LIMIT = 40;

export const DASHBOARD_DOMAINS = new Set([
  'coletas', 'faturamento', 'fretes', 'manifestos', 'performance', 'tracking',
  'faturas-por-cliente', 'contas-a-pagar', 'cotacoes', 'indicadores-gestao-a-vista',
  'executivo', 'etl-saude', 'integracoes',
]);

export function dashboardDomain(key: QueryKey): string | null {
  const value = key[0] === 'dim' ? key[1] : key[0];
  return typeof value === 'string' && DASHBOARD_DOMAINS.has(value)
    ? value === 'fretes' ? 'faturamento' : value
    : null;
}

// Somente dados: páginas desmontadas não mantêm canvas, observers ou polling.
// A sessão continua sendo limpa pelo AutenticacaoProvider quando muda o escopo ACL.
export function installDashboardCacheLimits(client: QueryClient) {
  const cache = client.getQueryCache();
  const pageAccess = new Map<string, number>();
  const queryAccess = new Map<string, number>();
  let sequence = 0;
  let scheduled = false;

  const recency = (query: Query) => queryAccess.get(query.queryHash) ?? 0;
  const unobserved = (query: Query) => query.getObserversCount() === 0;

  function trim() {
    scheduled = false;
    const queries = cache.getAll();
    const groups = new Map<string, Query[]>();
    for (const query of queries) {
      const domain = dashboardDomain(query.queryKey);
      if (domain) {
        const group = groups.get(domain) ?? [];
        group.push(query);
        groups.set(domain, group);
      }
    }
    for (const domain of pageAccess.keys()) if (!groups.has(domain)) pageAccess.delete(domain);
    const pages = [...groups].sort(([a, aq], [b, bq]) =>
      Number(bq.some(q => !unobserved(q))) - Number(aq.some(q => !unobserved(q)))
      || (pageAccess.get(b) ?? 0) - (pageAccess.get(a) ?? 0));
    for (const [, pageQueries] of pages.slice(DASHBOARD_CACHE_PAGE_LIMIT)) {
      pageQueries.filter(unobserved).forEach(query => cache.remove(query));
    }
    for (const [, pageQueries] of pages.slice(0, DASHBOARD_CACHE_PAGE_LIMIT)) {
      pageQueries.filter(unobserved).sort((a, b) => recency(b) - recency(a))
        .slice(DASHBOARD_CACHE_QUERIES_PER_PAGE).forEach(query => cache.remove(query));
    }
    queries.filter(q => q.queryKey[0] === 'dim' && unobserved(q))
      .sort((a, b) => recency(b) - recency(a)).slice(DIMENSION_CACHE_QUERY_LIMIT)
      .forEach(query => cache.remove(query));
  }

  return cache.subscribe(event => {
    const query = event.query;
    if (event.type === 'removed') queryAccess.delete(query.queryHash);
    if (event.type === 'added' || event.type === 'observerAdded') {
      queryAccess.set(query.queryHash, ++sequence);
      const domain = dashboardDomain(query.queryKey);
      if (domain) pageAccess.set(domain, sequence);
    }
    if (event.type === 'observerResultsUpdated' || event.type === 'observerOptionsUpdated') return;
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(trim);
    }
  });
}
