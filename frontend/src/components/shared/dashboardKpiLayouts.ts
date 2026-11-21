// Grades usadas tanto nos indicadores quanto durante o carregamento.
export const trackingKpis = 'mb-4 grid grid-cols-2 items-stretch gap-4 md:grid-cols-3 lg:grid-cols-6';
export const trackingCarteiraSpan = 'col-span-2 md:col-span-2 xl:col-span-2';
export const faturamentoKpis = 'mb-4 grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[0.8fr_2fr_2fr_1fr_1.1fr_1fr_2fr_1.25fr]';
export const etlKpis = 'mb-4 grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2 lg:grid-cols-5';
export const etlSucessoSpan = 'sm:col-span-2 lg:col-span-1';
export const manifestosKpis = 'mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-12';

export const kpiLoadingLayouts = {
  tracking: { count: 5, className: trackingKpis, spans: { 4: trackingCarteiraSpan } },
  faturamento: { count: 8, className: faturamentoKpis, details: [6, 7] },
  etl: { count: 5, className: etlKpis, spans: { 4: etlSucessoSpan } },
  coletas: { count: 9, intermediateRows: [5, 4] },
  contas: { count: 6 },
  cotacoes: { count: 8 },
  executivo: { count: 7, singleRowDesktop: true, intermediateRows: [3, 4],
    spans: { 5: 'lg:col-span-2 xl:col-span-1', 6: 'sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-1' } },
  integracoes: { count: 4, className: 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4', details: [0, 1, 2, 3] },
  manifestos: { count: 10, className: manifestosKpis, spans: { 4: 'col-span-2 lg:col-span-2', 5: 'col-span-2 md:col-span-2 lg:col-span-2' } },
  performance: { count: 9, containerClassName: 'performance-kpi-strip mb-4', className: 'performance-kpi-grid' },
};
