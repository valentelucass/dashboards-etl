import { beforeEach, describe, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import { buscarPerformanceEficienciaFiliais, buscarPerformanceEntregasAtencao, buscarPerformanceHistorico,
  buscarPerformanceOcorrenciasAtraso, buscarPerformanceTabelaPaginada, exportarPerformanceCsv } from './performanceServico';

vi.mock('../downloadArquivo', () => ({
  extrairNomeArquivo: vi.fn((_contentDisposition: string | undefined, fallback: string) => fallback),
  salvarBlobComoArquivo: vi.fn(),
}));

vi.mock('../clienteAxios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const clienteMock = clienteAxios as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe('performanceServico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clienteMock.get.mockResolvedValue({ data: [], headers: {} });
  });

  it('envia datas dinâmicas no histórico de performance', async () => {
    await buscarPerformanceHistorico({
      dataInicio: '2026-03-01',
      dataFim: '2026-05-25',
      filiais: ['SPO'],
      status: ['Finalizada'],
      pagadores: ['Cliente A'],
    });

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/performance/historico', {
      params: expect.any(URLSearchParams),
    });

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('dataInicio')).toBe('2026-03-01');
    expect(params.get('dataFim')).toBe('2026-05-25');
    expect(params.getAll('f.filiais')).toEqual(['SPO']);
    expect(params.getAll('f.status')).toEqual(['Finalizada']);
    expect(params.getAll('f.pagadores')).toEqual(['Cliente A']);
  });

  it('encaminha filtros, cancelamento e paginação aos três indicadores operacionais', async () => {
    const filtro = { dataInicio: '2026-11-01', dataFim: '2026-11-19', filiais: ['REC'], pagadores: ['Cliente A'] };
    const sinal = new AbortController().signal;
    await buscarPerformanceOcorrenciasAtraso(filtro, sinal);
    await buscarPerformanceEntregasAtencao(filtro, 2, 10, sinal);
    await buscarPerformanceEficienciaFiliais(filtro, sinal);
    expect(clienteMock.get.mock.calls.map(([url]) => url)).toEqual([
      '/api/painel/performance/ocorrencias-atraso', '/api/painel/performance/entregas-atencao', '/api/painel/performance/eficiencia-filiais',
    ]);
    for (const [, config] of clienteMock.get.mock.calls) {
      expect(config.params.get('f.filiais')).toBe('REC');
      expect(config.params.get('f.pagadores')).toBe('Cliente A');
      expect(config.params.get('dataFim')).toBe('2026-11-19');
      expect(config.signal).toBe(sinal);
    }
    expect(clienteMock.get.mock.calls[1][1].params.get('pagina')).toBe('2');
    expect(clienteMock.get.mock.calls[1][1].params.get('tamanhoPagina')).toBe('10');
  });

  it('envia a mesma seleção exata da barra para a tabela e o CSV sem substituir os filtros do usuário', async () => {
    const filtro = { dataInicio: '2026-11-01', dataFim: '2026-11-19', filiais: ['SPO'], drillResponsavel: 'chave', drillRegiao: 'Zona Norte' };
    const tabela = { tabelaRazaoSocial: 'busca manual' };
    await buscarPerformanceTabelaPaginada(filtro, 1, 10, tabela);
    clienteMock.get.mockResolvedValue({ data: new Blob(['minuta'], { type: 'text/csv' }), headers: { 'content-type': 'text/csv' } });
    await exportarPerformanceCsv(filtro, tabela);
    for (const [, config] of clienteMock.get.mock.calls) {
      expect(config.params.get('f.drillResponsavel')).toBe('chave');
      expect(config.params.get('f.drillRegiao')).toBe('Zona Norte');
      expect(config.params.get('f.tabelaRazaoSocial')).toBe('busca manual');
      expect(config.params.get('f.filiais')).toBe('SPO');
    }
  });

  it('envia filtros analíticos para a tabela paginada de performance', async () => {
    await buscarPerformanceTabelaPaginada({
      dataInicio: '2026-05-01',
      dataFim: '2026-05-25',
      responsaveis: ['spo'],
      pagadores: ['Cliente B'],
    }, 3, 50, {
      tabelaBusca: 'atraso',
      tabelaStatus: ['Finalizada'],
      tabelaColuna: {
        numeroMinuta: '123',
        cidadeDestino: 'Campinas',
      },
    });

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/performance/tabela/paginada', {
      params: expect.any(URLSearchParams),
    });

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('pagina')).toBe('3');
    expect(params.get('tamanhoPagina')).toBe('50');
    expect(params.get('page')).toBe('2');
    expect(params.get('size')).toBe('50');
    expect(params.getAll('f.responsaveis')).toEqual(['spo']);
    expect(params.getAll('f.pagadores')).toEqual(['Cliente B']);
    expect(params.get('f.tabelaBusca')).toBe('atraso');
    expect(params.getAll('f.tabelaStatus')).toEqual(['Finalizada']);
    expect(params.get('f.tabelaColuna.numeroMinuta')).toBe('123');
    expect(params.get('f.tabelaColuna.cidadeDestino')).toBe('Campinas');
  });

  it('exporta CSV de performance com filtros globais e filtros analíticos', async () => {
    clienteMock.get.mockResolvedValueOnce({
      data: new Blob(['numeroMinuta\r\n123\r\n'], { type: 'text/csv;charset=UTF-8' }),
      headers: { 'content-type': 'text/csv;charset=UTF-8' },
    });

    await exportarPerformanceCsv({
      dataInicio: '2026-05-01',
      dataFim: '2026-05-25',
      filiais: ['SPO'],
      pagadores: ['Cliente A'],
    }, {
      tabelaBusca: 'Campinas',
      tabelaStatus: ['Finalizada'],
    });

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/performance/exportacao', expect.objectContaining({
      params: expect.any(URLSearchParams),
      responseType: 'blob',
    }));

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.getAll('f.filiais')).toEqual(['SPO']);
    expect(params.getAll('f.pagadores')).toEqual(['Cliente A']);
    expect(params.get('f.tabelaBusca')).toBe('Campinas');
    expect(params.getAll('f.tabelaStatus')).toEqual(['Finalizada']);
  });
});
