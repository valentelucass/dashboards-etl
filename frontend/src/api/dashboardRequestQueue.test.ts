// @vitest-environment jsdom
import axios, { AxiosHeaders, CanceledError } from 'axios';
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDashboardRequestAdapter } from './dashboardRequestQueue';

const config = (url: string, signal?: AbortSignal): InternalAxiosRequestConfig => ({ url, method: 'get', signal, headers: new AxiosHeaders() });
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function region(key: string, top: number) {
  const element = document.createElement('div');
  if (key === 'table') element.dataset.dashboardTable = 'true';
  else element.dataset.dashboardChart = key;
  const position = { top, bottom: top + 350, height: 350, width: 500 };
  vi.spyOn(element, 'getBoundingClientRect').mockImplementation(() => position as DOMRect);
  document.body.append(element);
  return position;
}
function controlled() {
  const running: Array<{ config: InternalAxiosRequestConfig; resolve: (r: AxiosResponse) => void; reject: (e: Error) => void }> = [];
  const transport: AxiosAdapter = vi.fn((c) => new Promise<AxiosResponse>((resolve, reject) => { running.push({ config: c, resolve, reject }); }));
  return { running, transport, adapter: createDashboardRequestAdapter(transport), finish: (index: number) => {
    const entry = running[index]; entry.resolve({ config: entry.config, data: index, status: 200, statusText: 'OK', headers: {} });
  } };
}

describe('fila HTTP dos dashboards', () => {
  it('distingue séries da primeira e segunda linha que compartilham o endpoint de Cotações', async () => {
    region('cotacoesSerie', 200); region('cotacoesFunil', 200); region('cotacoesTaxasConversao', 900);
    const c = controlled();
    const requests = [
      c.adapter({ ...config('/api/painel/cotacoes/serie'), dashboardChartKey: 'cotacoesTaxasConversao' }),
      c.adapter(config('/api/painel/cotacoes')),
      c.adapter({ ...config('/api/painel/cotacoes/serie'), dashboardChartKey: 'cotacoesSerie' }),
      c.adapter(config('/api/painel/cotacoes/graficos')),
    ];
    await flush();
    expect(c.running.map(r => r.config.dashboardChartKey ?? r.config.url)).toEqual([
      '/api/painel/cotacoes', 'cotacoesSerie', '/api/painel/cotacoes/graficos',
    ]);
    for (let i = 0; i < 4; i++) { c.finish(i); await flush(); }
    await Promise.all(requests);
  });
  it('envia a primeira linha de Coletas antes da operação, dimensões e tabela sem esperar o KPI terminar', async () => {
    region('coletasSerie', 200); region('coletasStatus', 200);
    region('coletasHistoricoPerformance', 200); region('coletasOrigem', 700); region('table', 1200);
    const c = controlled();
    const urls = ['/api/painel/coletas/graficos/operacao', '/api/painel/coletas/serie', '/api/dimensoes/filiais',
      '/api/painel/coletas/graficos/status', '/api/painel/coletas/graficos/historico-performance', '/api/painel/coletas/tabela/paginada', '/api/painel/coletas'];
    const requests = urls.map(url => c.adapter(config(url)));
    await flush();
    expect(c.running.map(r => r.config.url)).toEqual([urls[6], urls[1], urls[3]]);
    c.finish(1); await flush(); // KPI continua em voo; a próxima consulta já ocupa a vaga.
    expect(c.running[3].config.url).toBe(urls[4]);
    c.finish(0); c.finish(2); c.finish(3); await flush();
    for (let i = 4; i < urls.length; i++) { c.finish(i); await flush(); }
    await Promise.all(requests);
  });

  it('recalcula a prioridade ao rolar até a tabela e usa a ordem vertical no celular', async () => {
    region('coletasSerie', 200); region('coletasStatus', 700);
    const lower = region('coletasOrigem', 1700); const table = region('table', 2200);
    const c = controlled();
    const occupied = [1, 2, 3].map(() => c.adapter(config('/api/painel/coletas')));
    await flush();
    const requests = ['/api/painel/coletas/graficos/operacao', '/api/painel/coletas/tabela/paginada', '/api/painel/coletas/graficos/status']
      .map(url => c.adapter(config(url)));
    c.finish(0); await flush();
    expect(c.running[3].config.url).toBe('/api/painel/coletas/graficos/status');
    table.top = 30; table.bottom = 380; lower.top = -500; lower.bottom = -150;
    c.finish(1); await flush();
    expect(c.running[4].config.url).toBe('/api/painel/coletas/tabela/paginada');
    c.finish(2); await flush();
    for (let i = 3; i < 6; i++) c.finish(i);
    await Promise.all([...occupied, ...requests]);
  });
  it('limita o transporte a três consultas e esvazia toda a fila sem perder respostas', async () => {
    const c = controlled();
    const requests = Array.from({ length: 9 }, (_, i) => c.adapter(config(`/api/painel/performance/serie-${i}`)));
    await flush();
    expect(c.transport).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 9; i++) { c.finish(i); await flush(); expect(c.running.length - i - 1).toBeLessThanOrEqual(3); }
    expect((await Promise.all(requests)).map((r) => r.data)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('prioriza overview, gráficos e tabela antes das listas de filtros fechados no mesmo lote', async () => {
    const urls = ['/api/painel/performance/tabela', '/api/dimensoes/performance/cidades-destino', '/api/painel/performance/aging', '/api/painel/performance/overview'];
    const transport = vi.fn<AxiosAdapter>(async (c) => ({ data: c.url, status: 200, statusText: 'OK', headers: {}, config: c }));
    const adapter = createDashboardRequestAdapter(transport);
    await Promise.all(urls.map((url) => adapter(config(url))));
    expect(transport.mock.calls.map(([c]) => c.url)).toEqual([urls[3], urls[2], urls[0], urls[1]]);
  });

  it.each(['/api/auth/refresh', '/api/painel/home/comunicados', '/api/painel/performance/exportacao', '/api/painel/fretes/exportacao', '/api/painel/manifestos/metas/importacao/template'])('não enfileira %s', async (url) => {
    const c = controlled();
    const occupied = [1, 2, 3].map(() => c.adapter(config('/api/painel/performance/status')));
    await flush();
    const bypass = c.adapter(config(url));
    expect(c.transport).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 4; i++) c.finish(i);
    await Promise.all([...occupied, bypass]);
  });

  it('compartilha o limite entre páginas e mantém escritas fora da fila', async () => {
    const c = controlled();
    const urls = ['/api/painel/fretes', '/api/painel/manifestos/performance', '/api/painel/performance/overview', '/api/painel/executivo'];
    const requests = urls.map(url => c.adapter(config(url)));
    await flush();
    expect(c.transport).toHaveBeenCalledTimes(3);
    const write = c.adapter({ ...config('/api/painel/fretes/metas/configuracoes'), method: 'put', data: { ano: 2026, mes: 8 } });
    expect(c.transport).toHaveBeenCalledTimes(4);
    c.finish(0);
    await flush();
    expect(c.running[4].config.url).toBe('/api/painel/executivo');
    for (let i = 1; i < 5; i++) c.finish(i);
    await Promise.all([...requests, write]);
  });

  it('cancela requisição em espera sem enviá-la ao servidor', async () => {
    const c = controlled();
    const occupied = [1, 2, 3].map(() => c.adapter(config('/api/painel/performance/status')));
    await flush();
    const controller = new AbortController();
    const canceled = c.adapter(config('/api/painel/performance/aging', controller.signal)).catch((e: unknown) => e);
    controller.abort();
    expect(axios.isCancel(await canceled)).toBe(true);
    for (let i = 0; i < 3; i++) c.finish(i);
    await Promise.all(occupied); await flush();
    expect(c.transport).toHaveBeenCalledTimes(3);
  });

  it('recusa signal já cancelado antes de ocupar vaga', async () => {
    const c = controlled();
    await expect(c.adapter(config('/api/painel/performance/aging', AbortSignal.abort()))).rejects.toBeInstanceOf(CanceledError);
    expect(c.transport).not.toHaveBeenCalled();
  });

  it('libera vagas após erro HTTP, cancelamento e falha síncrona do transporte', async () => {
    const transport = vi.fn<AxiosAdapter>()
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new CanceledError())
      .mockImplementationOnce(() => { throw new Error('sync'); })
      .mockImplementation(async (c) => ({ config: c, data: 'ok', status: 200, statusText: 'OK', headers: {} }));
    const adapter = createDashboardRequestAdapter(transport);
    const settled = await Promise.allSettled([1, 2, 3, 4].map(() => adapter(config('/api/painel/performance/status'))));
    expect(settled.map((r) => r.status)).toEqual(['rejected', 'rejected', 'rejected', 'fulfilled']);
  });
});
