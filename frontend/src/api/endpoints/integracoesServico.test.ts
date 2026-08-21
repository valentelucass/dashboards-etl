import { beforeEach, describe, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import {
  buscarIntegracoesAuditoria,
  buscarIntegracoesEvolucaoDiaria,
  buscarExecucoesWorkSftpClientes,
  buscarStatusWorkSftpClientes,
  exportarIntegracoesCsv,
} from './integracoesServico';
import { baixarCsvComParametros } from '../downloadCsv';

vi.mock('../clienteAxios', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../downloadCsv', () => ({
  baixarCsvComParametros: vi.fn(),
}));

const clienteMock = clienteAxios as unknown as {
  get: ReturnType<typeof vi.fn>;
};

describe('integracoesServico', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clienteMock.get.mockResolvedValue({
      data: {
        geradoEm: '2026-06-24T00:00:00',
        metricasConsolidadas: [],
        pendencias: {
          itens: [],
          paginacao: {
            pagina: 0,
            tamanho: 20,
            totalElementos: 0,
            totalPaginas: 0,
            primeiraPagina: true,
            ultimaPagina: true,
          },
        },
      },
    });
  });

  it('envia filtros analiticos para a auditoria de integracoes', async () => {
    await buscarIntegracoesAuditoria(
      2,
      20,
      '2026-06-01',
      '2026-06-24',
      {
        tabelaBusca: 'PPG',
        tabelaCodigo: '123',
        tabelaStatus: ['ERRO_DESTINO', 'PENDENTE_FOTO'],
        tabelaColuna: {
          numeroNf: '456',
          statusCanhoto: ['PENDENTE_FOTO'],
        },
      },
      'numeroNf',
      'desc',
      'SUCESSO',
      ['PPG'],
    );

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/integracoes', {
      params: expect.any(URLSearchParams),
    });

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('pagina')).toBe('1');
    expect(params.get('tamanho')).toBe('20');
    expect(params.get('escopo')).toBe('SUCESSO');
    expect(params.get('dataInicial')).toBe('2026-06-01');
    expect(params.get('dataFinal')).toBe('2026-06-24');
    expect(params.get('sortField')).toBe('numeroNf');
    expect(params.get('sortDirection')).toBe('desc');
    expect(params.get('f.tabelaBusca')).toBe('PPG');
    expect(params.get('f.tabelaCodigo')).toBe('123');
    expect(params.getAll('f.tabelaStatus')).toEqual(['ERRO_DESTINO', 'PENDENTE_FOTO']);
    expect(params.get('f.tabelaColuna.numeroNf')).toBe('456');
    expect(params.getAll('f.tabelaColuna.statusCanhoto')).toEqual(['PENDENTE_FOTO']);
    expect(params.getAll('destino')).toEqual(['PPG']);
  });

  it('usa pendencias como escopo padrao', async () => {
    await buscarIntegracoesAuditoria(1, 10, '2026-06-01', '2026-06-24');

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('escopo')).toBe('PENDENCIAS');
    expect(params.getAll('destino')).toEqual([]);
  });

  it('preserva SELIA e os rótulos de AddEvents e POD retornados pelo Satélite', async () => {
    clienteMock.get.mockResolvedValueOnce({
      data: {
        geradoEm: '2026-08-05T16:00:00',
        metricasConsolidadas: [
          {
            sistemaDestino: 'SELIA',
            totalRegistros: 2,
            percentualXmlSucesso: 100,
            percentualCanhotoSucesso: 100,
            rotuloDados: 'AddEvents',
            rotuloComprovante: 'POD/Comprovante',
          },
        ],
        pendencias: {
          itens: [{
            id: 10,
            sistemaDestino: 'SELIA',
            occurrenceId: 20,
            freightId: 30,
            chaveNfe: '35260800000000000000550010000000011000000010',
            numeroNf: 1,
            serieNf: '001',
            statusDados: 'SUCESSO',
            statusCanhoto: 'SUCESSO',
            mensagemErroDados: null,
            mensagemErroCanhoto: null,
            canhotoReferencia: 'https://comprovante.exemplo/selia.jpg',
            canhotoMimeType: 'image/jpeg',
            dataProcessamento: '2026-08-05T16:00:00',
            dataProcessamentoDados: '2026-08-05T16:00:00',
            dataProcessamentoCanhoto: '2026-08-05T16:00:00',
          }],
          paginacao: {
            pagina: 0,
            tamanho: 20,
            totalElementos: 1,
            totalPaginas: 1,
            primeiraPagina: true,
            ultimaPagina: true,
          },
        },
      },
    });

    const resposta = await buscarIntegracoesAuditoria(1, 20, '2026-08-01', '2026-08-05');

    expect(resposta.metricasConsolidadas[0]).toMatchObject({
      sistemaDestino: 'SELIA',
      rotuloDados: 'AddEvents',
      rotuloComprovante: 'POD/Comprovante',
    });
    expect(resposta.pendencias.itens[0]).toMatchObject({
      sistemaDestino: 'SELIA',
      canhotoReferencia: 'https://comprovante.exemplo/selia.jpg',
    });
  });

  it('consulta evolucao diaria com periodo global', async () => {
    await buscarIntegracoesEvolucaoDiaria('2026-06-01', '2026-06-24', 'SUCESSO', ['PPG', 'SELIA']);

    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/integracoes/evolucao-diaria', {
      params: expect.any(URLSearchParams),
    });

    const params = clienteMock.get.mock.calls[0][1].params as URLSearchParams;
    expect(params.get('dataInicial')).toBe('2026-06-01');
    expect(params.get('dataFinal')).toBe('2026-06-24');
    expect(params.get('escopo')).toBe('SUCESSO');
    expect(params.getAll('destino')).toEqual(['PPG', 'SELIA']);
  });

  it('consulta resumo e historico SFTP com paginacao e filtros server-side', async () => {
    await buscarStatusWorkSftpClientes();
    expect(clienteMock.get).toHaveBeenCalledWith('/api/painel/integracoes/vedacit-sftp/clientes');

    await buscarExecucoesWorkSftpClientes(2, 25, '2026-08-01', '2026-08-20', 'VEDACIT', 'CONCLUIDO');
    expect(clienteMock.get).toHaveBeenLastCalledWith('/api/painel/integracoes/vedacit-sftp/execucoes', {
      params: expect.any(URLSearchParams),
    });
    const params = clienteMock.get.mock.calls[1][1].params as URLSearchParams;
    expect(params.get('pagina')).toBe('1');
    expect(params.get('tamanho')).toBe('25');
    expect(params.get('cliente')).toBe('VEDACIT');
    expect(params.get('status')).toBe('CONCLUIDO');
  });

  it('exporta a tabela completa preservando escopo, filtros e ordenacao', async () => {
    await exportarIntegracoesCsv(
      '2026-06-01',
      '2026-06-24',
      { tabelaBusca: 'VEDACIT', tabelaColuna: { statusDados: ['SUCESSO'] } },
      'dataProcessamento',
      'desc',
      'SUCESSO',
      ['VEDACIT'],
    );

    expect(baixarCsvComParametros).toHaveBeenCalledWith(
      '/api/painel/integracoes/exportacao',
      expect.any(URLSearchParams),
      'integracoes-sucesso',
    );
    const params = vi.mocked(baixarCsvComParametros).mock.calls[0][1];
    expect(params.get('escopo')).toBe('SUCESSO');
    expect(params.get('sortField')).toBe('dataProcessamento');
    expect(params.get('sortDirection')).toBe('desc');
    expect(params.get('f.tabelaBusca')).toBe('VEDACIT');
    expect(params.getAll('f.tabelaColuna.statusDados')).toEqual(['SUCESSO']);
    expect(params.getAll('destino')).toEqual(['VEDACIT']);
  });

});
