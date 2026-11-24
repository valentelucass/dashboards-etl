import { beforeEach, describe, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import {
  atualizarKpiGoalsFilial,
  atualizarKpiGoalsGlobais,
  buscarKpiGoalOverrides,
  buscarKpiGoalsEfetivos,
  buscarKpiGoalsHistorico,
  buscarKpiGoalsHistoricoPaginado,
  buscarHorariosCorteTabelaPaginada,
  buscarPerformanceEntregaSerie,
  buscarUtilizacaoColetoresRanking,
  excluirJustificativaHorarioCorte,
  removerKpiGoalsOverride,
  salvarJustificativaHorarioCorte,
} from './indicadoresGestaoAVistaServico';
import type { KpiGoalsMap } from '../../types/indicadoresGestaoAVista';

vi.mock('../clienteAxios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const clienteMock = clienteAxios as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const goals: KpiGoalsMap = {
  delivery_performance: 95,
  collector_usage: 90,
  cargo_cubage: 85,
  cargo_indemnity: 2,
  cutoff_time: 98,
};
const competencia = '2026-05-01';

describe('indicadoresGestaoAVistaServico kpi goals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clienteMock.get.mockResolvedValue({ data: {} });
    clienteMock.post.mockResolvedValue({ data: {} });
    clienteMock.put.mockResolvedValue({ data: {} });
    clienteMock.delete.mockResolvedValue({ data: {} });
  });

  it('busca metas efetivas pelo endpoint /effective', async () => {
    await buscarKpiGoalsEfetivos('GLOBAL', competencia);

    expect(clienteMock.get).toHaveBeenCalledWith('/api/kpi-goals/effective', {
      params: { branchId: 'GLOBAL', competencia },
    });
  });

  it('envia update global sem sobrescrever metas especificas', async () => {
    await atualizarKpiGoalsGlobais({ goals, competencia });

    expect(clienteMock.put).toHaveBeenCalledWith('/api/kpi-goals/global', { goals, competencia }, {
      params: { competencia },
    });
  });

  it('envia update de filial por path', async () => {
    await atualizarKpiGoalsFilial('SPO', { goals, competencia });

    expect(clienteMock.put).toHaveBeenCalledWith('/api/kpi-goals/branch/SPO', { goals, competencia }, {
      params: { competencia },
    });
  });

  it('remove override de filial por DELETE', async () => {
    await removerKpiGoalsOverride('SPO', competencia);

    expect(clienteMock.delete).toHaveBeenCalledWith('/api/kpi-goals/branch/SPO', {
      params: { competencia },
    });
  });

  it('busca historico limitado por filial', async () => {
    await buscarKpiGoalsHistorico('SPO', 10);

    expect(clienteMock.get).toHaveBeenCalledWith('/api/kpi-goals/history', {
      params: { branchId: 'SPO', limit: 10 },
    });
  });

  it('busca historico paginado por filial', async () => {
    await buscarKpiGoalsHistoricoPaginado('SPO', 2, 10);

    expect(clienteMock.get).toHaveBeenCalledWith('/api/kpi-goals/history/page', {
      params: { branchId: 'SPO', pagina: 2, tamanhoPagina: 10 },
    });
  });

  it('busca overrides por indicador', async () => {
    clienteMock.get.mockResolvedValueOnce({ data: { overrides: [] } });
    await buscarKpiGoalOverrides('collector_usage', competencia);

    expect(clienteMock.get).toHaveBeenCalledWith('/api/kpi-goals/overrides', {
      params: { indicatorKey: 'collector_usage', competencia },
    });
  });

  it('busca ranking de utilizacao dos coletores', async () => {
    clienteMock.get.mockResolvedValueOnce({ data: [] });
    await buscarUtilizacaoColetoresRanking({ dataInicio: '2026-05-01', dataFim: '2026-05-12', filiais: ['SPO'] });

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/indicadores-gestao-a-vista/utilizacao-coletores/ranking', {
      params: expect.any(URLSearchParams),
    });
  });

  it('busca serie de performance com visao e filtros de drill-down', async () => {
    clienteMock.get.mockResolvedValueOnce({ data: [] });
    await buscarPerformanceEntregaSerie(
      { dataInicio: '2026-05-01', dataFim: '2026-05-12', filiais: ['SPO'] },
      { visao: 'CIDADE', responsavelFiltro: 'Responsavel A', regiaoFiltro: 'SP' },
    );

    const [, config] = clienteMock.get.mock.calls.at(-1) ?? [];
    const params = config?.params as URLSearchParams;

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/indicadores-gestao-a-vista/performance-entrega/serie', {
      params: expect.any(URLSearchParams),
    });
    expect(params.get('visao')).toBe('CIDADE');
    expect(params.get('responsavelFiltro')).toBe('Responsavel A');
    expect(params.get('regiaoFiltro')).toBe('SP');
  });

  it('envia filtros analiticos para a tabela paginada de horarios de corte', async () => {
    await buscarHorariosCorteTabelaPaginada(
      { dataInicio: '2026-05-01', dataFim: '2026-05-12', filiais: ['SPO'] },
      2,
      20,
      {
        tabelaBusca: 'Raster',
        tabelaColuna: {
          filial: 'CWB',
          linhaOuOperacao: 'CWB',
          saiuNoHorario: ['NO PRAZO'],
        },
      },
    );

    const [, config] = clienteMock.get.mock.calls.at(-1) ?? [];
    const params = config?.params as URLSearchParams;

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/indicadores-gestao-a-vista/horarios-corte/tabela/paginada', {
      params: expect.any(URLSearchParams),
    });
    expect(params.get('pagina')).toBe('2');
    expect(params.get('tamanhoPagina')).toBe('20');
    expect(params.getAll('f.filiais')).toEqual(['SPO']);
    expect(params.get('f.tabelaBusca')).toBe('Raster');
    expect(params.get('f.tabelaColuna.filial')).toBe('CWB');
    expect(params.get('f.tabelaColuna.linhaOuOperacao')).toBe('CWB');
    expect(params.getAll('f.tabelaColuna.saiuNoHorario')).toEqual(['NO PRAZO']);
  });

  it('salva justificativa de horario de corte', async () => {
    const payload = { codSolicitacao: 123, justificativa: 'Saida autorizada pela operacao.' };

    await salvarJustificativaHorarioCorte(payload);

    expect(clienteMock.post).toHaveBeenCalledWith('/api/painel/indicadores-gestao-a-vista/horarios-corte/justificativas', payload);
  });

  it('exclui justificativa de horario de corte por SM', async () => {
    await excluirJustificativaHorarioCorte(123);

    expect(clienteMock.delete).toHaveBeenCalledWith('/api/painel/indicadores-gestao-a-vista/horarios-corte/justificativas/123');
  });
});
