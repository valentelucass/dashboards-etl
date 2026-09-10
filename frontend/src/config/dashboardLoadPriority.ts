import type { InternalAxiosRequestConfig } from 'axios';
import type { ChartDictionaryKey } from '../constants/chartDictionary';
import { DASHBOARD_DOMAINS } from './dashboardCache';

declare module 'axios' {
  interface AxiosRequestConfig {
    dashboardChartKey?: ChartDictionaryKey;
  }
}

// Um endpoint pode abastecer vários cartões; vale a primeira região na tela.
// As coordenadas são lidas ao liberar uma vaga, respeitando scroll e breakpoints.
const charts: Record<string, ChartDictionaryKey[]> = {
  'coletas/serie': ['coletasSerie'],
  'coletas/graficos/status': ['coletasStatus'],
  'coletas/graficos': ['coletasStatus', 'coletasOrigem', 'coletasAging'],
  'coletas/graficos/operacao': ['coletasOrigem', 'coletasAging'],
  'coletas/graficos/historico-performance': ['coletasHistoricoPerformance'],
  'coletas/graficos/cidades': ['coletasOrigem'],
  'performance/serie-temporal': ['performanceSerieTemporal'],
  'performance/status': ['performanceStatus'],
  'performance/historico': ['performanceHistorico'],
  'performance/drilldown': ['performanceDrilldown'],
  'performance/aging': ['performanceAging'],
  'fretes/serie': ['evolucaoFaturamento'],
  'fretes/graficos': ['faturamentoClassificacao', 'faturamentoResponsavel', 'faturamentoRota'],
  'fretes/top-clientes': ['faturamentoParticipacaoClientes'],
  'manifestos/graficos': ['manifestosCustosContrato', 'manifestosTiposVeiculo'],
  'manifestos/serie': ['manifestosStatusTemporal'],
  'executivo/serie': ['executivoTendenciaFinanceira', 'executivoFaturamentoBacklog'],
  'cotacoes/serie': ['cotacoesSerie', 'cotacoesTaxasConversao'],
  'cotacoes/graficos': ['cotacoesFunil', 'cotacoesTrechos', 'cotacoesMotivosPerda'],
  'contas-a-pagar/serie': ['contasPagarSerie'],
  'contas-a-pagar/graficos/fornecedores': ['contasPagarTopFornecedores'],
  'contas-a-pagar/graficos/centros-custo': ['contasPagarCentroCusto'],
  'contas-a-pagar/graficos': ['contasPagarConciliacao'],
  'faturas-por-cliente/serie': ['faturasMensal'],
  'faturas-por-cliente/aging': ['faturasAging'],
  'faturas-por-cliente/aging/drilldown': ['faturasAging'],
  'faturas-por-cliente/top-clientes/drilldown': ['faturasTopClientes'],
  'faturas-por-cliente/top-clientes': ['faturasTopClientes'],
  'faturas-por-cliente/status-processo': ['faturasStatusProcesso'],
  'faturas-por-cliente/status-processo/evolucao': ['faturasStatusProcesso'],
  'etl-saude/serie': ['etlTaxasDiarias'],
  'etl-saude/evolucao-insercoes-atualizacoes': ['etlInsercoesAtualizacoes'],
  'etl-saude/tabelas/resumo': ['etlTabelasResumo'],
  'integracoes/evolucao-diaria': ['integracoesSazonalidade'],
  'indicadores-gestao-a-vista/performance-entrega/serie': ['gestaoPerformanceRanking'],
  'indicadores-gestao-a-vista/utilizacao-coletores/ranking': ['gestaoColetoresRanking'],
  'indicadores-gestao-a-vista/cubagem-mercadorias/serie': ['gestaoCubagemRanking'],
  'indicadores-gestao-a-vista/indenizacao-mercadorias/serie': ['gestaoIndenizacaoRanking'],
  'indicadores-gestao-a-vista/horarios-corte/serie': ['gestaoHorariosRanking'],
};

const indicatorSections: Record<string, ChartDictionaryKey> = {
  'performance-entrega': 'gestaoPerformanceRanking',
  'utilizacao-coletores': 'gestaoColetoresRanking',
  'cubagem-mercadorias': 'gestaoCubagemRanking',
  'indenizacao-mercadorias': 'gestaoIndenizacaoRanking',
  'horarios-corte': 'gestaoHorariosRanking',
};

export function dashboardRequestPath(config: InternalAxiosRequestConfig): string | null {
  if ((config.method ?? 'get').toLowerCase() !== 'get'
    || config.responseType === 'blob' || config.responseType === 'arraybuffer') return null;
  const path = new URL(config.url ?? '', 'http://dashboard.invalid').pathname;
  if (/\/(exportacao|importacao|template)(\/|$)/.test(path)) return null;
  if (path.startsWith('/api/dimensoes/')) return path;
  const domain = path.match(/^\/api\/painel\/([^/]+)/)?.[1];
  return domain && DASHBOARD_DOMAINS.has(domain) ? path : null;
}

export function dashboardRequestPriority(path: string, chartKey?: ChartDictionaryKey): number {
  const endpoint = path.replace('/api/painel/', '');
  if (path.startsWith('/api/dimensoes/')) {
    return typeof document !== 'undefined' && document.querySelector('[data-dashboard-filters-open="true"]')
      ? -0.5 : 5_000_000;
  }
  const section = endpoint.startsWith('indicadores-gestao-a-vista/') ? indicatorSections[endpoint.split('/')[1]] : undefined;
  if (!endpoint.includes('/') || (endpoint.endsWith('/overview') && !section) || endpoint === 'tracking/dashboard'
    || endpoint === 'manifestos/performance' || endpoint === 'fretes/metas') return -1;

  const table = /\/(tabela|detalhes|resumo-financeiro)(\/|$)/.test(endpoint);
  const keys = chartKey ? [chartKey] : charts[endpoint];
  if (typeof document !== 'undefined' && (keys || table || section)) {
    const selector = section && !table ? `[data-dashboard-section="${section}"]`
      : table ? '[data-dashboard-table]' : keys!.map(key => `[data-dashboard-chart="${key}"]`).join(',');
    let best = Infinity;
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.height <= 0 || rect.width <= 0) continue;
      // Visível primeiro; depois as próximas linhas e, por último, o que ficou acima.
      const band = rect.bottom <= 0 ? 2_000_000 : rect.top < window.innerHeight ? 0 : 1_000_000;
      best = Math.min(best, band + Math.max(0, rect.top));
    }
    if (best !== Infinity) return best + (section && !endpoint.endsWith('/overview') ? 1 : 0);
  }
  if (table) return 4_000_000;
  return 1_500_000;
}
