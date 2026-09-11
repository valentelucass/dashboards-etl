import { beforeEach, expect, it, vi } from 'vitest';
import clienteAxios from '../clienteAxios';
import { buscarIndicadoresEtapas, type IndicadoresEtapas } from './integracoesEtapas';
vi.mock('../clienteAxios', () => ({ default: { get: vi.fn() } }));

const resposta: IndicadoresEtapas = { versao: 1, dataInicial: '2026-09-01', dataFinal: '2026-09-10',
  etapas: [{ sistemaDestino: 'VEDACIT', etapa: 'DADOS', sucessosPeriodo: 0, falhasPeriodo: 0,
    pendentesAtuais: 0, bloqueadosAtuais: 775, semConfirmacaoDatada: 52 }], evolucao: [] };
beforeEach(() => vi.resetAllMocks());

it('preserva zero XML e bloqueios, encaminhando período, destino e cancelamento', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: resposta });
  const signal = new AbortController().signal;
  expect(await buscarIndicadoresEtapas('2026-09-01', '2026-09-10', ['VEDACIT'], signal)).toEqual(resposta);
  const [url, config] = vi.mocked(clienteAxios.get).mock.calls[0];
  expect(url).toBe('/api/painel/integracoes/indicadores-etapas');
  expect(config?.signal).toBe(signal);
  const params = config?.params as URLSearchParams;
  expect(params.getAll('destino')).toEqual(['VEDACIT']);
  expect(params.get('dataInicial')).toBe('2026-09-01');
});

it.each([
  { totalRegistros: 273, percentualXmlSucesso: 100 },
  { ...resposta, dataInicial: '2026-08-01' },
  { ...resposta, etapas: [{ ...resposta.etapas[0], sistemaDestino: 'PPG' }] },
  { ...resposta, etapas: [{ ...resposta.etapas[0], sucessosPeriodo: undefined }] },
  { ...resposta, etapas: [{ ...resposta.etapas[0], bloqueadosAtuais: -1 }] },
  { ...resposta, evolucao: [{ data: '2026-08-01', etapa: 'DADOS', sucessos: 273, falhas: 0 }] },
])('rejeita contrato antigo, período incorreto ou contagens incompatíveis: %#', async data => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data });
  await expect(buscarIndicadoresEtapas('2026-09-01', '2026-09-10', ['VEDACIT'])).rejects.toThrow('incompatíveis');
});

it('404 não retorna números estimados a partir do contrato antigo', async () => {
  vi.mocked(clienteAxios.get).mockRejectedValue(new Error('404'));
  await expect(buscarIndicadoresEtapas('2026-09-01', '2026-09-10', [])).rejects.toThrow('404');
  expect(clienteAxios.get).toHaveBeenCalledTimes(1);
});
