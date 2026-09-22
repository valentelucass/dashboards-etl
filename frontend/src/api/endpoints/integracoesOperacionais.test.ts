import { afterEach, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import { buscarIndicadoresOperacionais, buscarPendenciasEtapas } from './integracoesOperacionais';
vi.mock('../clienteAxios', () => ({ default: { get: vi.fn() } }));
afterEach(() => vi.resetAllMocks());
const dados = { versao: 3, dataInicial: '2026-09-01', dataFinal: '2026-09-21', historicoDesde: null,
  escopoTransmissoes: 'VEDACIT', etapas: [], evolucao: [], atividade: [] };
it('encaminha datas e destinos e preserva ausência de histórico', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: dados });
  expect((await buscarIndicadoresOperacionais('2026-09-01','2026-09-21',['VEDACIT','SELIA'])).historicoDesde).toBeNull();
  const params=vi.mocked(clienteAxios.get).mock.calls[0][1]?.params as URLSearchParams;
  expect(params.getAll('destino')).toEqual(['VEDACIT','SELIA']); expect(params.get('dataFinal')).toBe('2026-09-21');
});
it.each([
  { versao: 2 }, { historicoDesde: 'ontem' }, { dataFinal: '2026-09-20' },
  { atividade: [{ data: '2026-09-21', etapa: 'DADOS', avaliacoes: 1, retencoes: 2, confirmacoesAvaliadas: 0, enviosIniciados: 1, reenviosIniciados: 2, consultasOrigem: 0 }] },
  { etapas: [{ sistemaDestino: 'PPG', etapa: 'DADOS' }] },
])('recusa contrato incompatível em vez de inventar números: %j', async (mudanca) => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...dados, ...mudanca } });
  await expect(buscarIndicadoresOperacionais('2026-09-01','2026-09-21',['VEDACIT'])).rejects.toThrow('incompatíveis');
});
it('recusa documentos de outra categoria mesmo que o total seja válido', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { pagina: 0, tamanho: 25, totalElementos: 1, itens: [{
    id: 1, sistemaDestino: 'VEDACIT', etapa: 'DADOS', acao: 'INTERVENCAO', documento: 'CT-e 1', motivo: 'INTERVENCAO',
    pendenteDesde: null, ultimaAvaliacao: null, proximaAvaliacao: null,
  }] } });
  await expect(buscarPendenciasEtapas('VEDACIT','DADOS','AGUARDANDO_ORIGEM',0)).rejects.toThrow('não correspondem');
});

