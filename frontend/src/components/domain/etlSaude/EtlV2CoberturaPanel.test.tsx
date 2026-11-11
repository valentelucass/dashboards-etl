// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import clienteAxios from '../../../api/clienteAxios';
import EtlV2CoberturaPanel from './EtlV2CoberturaPanel';

vi.mock('../../../api/clienteAxios', () => ({ default: { get: vi.fn() } }));

function abrir() {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><EtlV2CoberturaPanel /></QueryClientProvider>);
  const botao = screen.getByRole('button', { name: 'Dados recebidos no ETL V2' });
  expect(clienteAxios.get).not.toHaveBeenCalled();
  fireEvent.click(botao);
  expect(botao.getAttribute('aria-expanded')).toBe('true');
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it('exibe a cobertura confirmada e distingue ausência de dado de uma carga vazia', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: [
    { entidade: 'COLETAS', template: 6908, campos: 31, diasRecebidos: 1, linhasAtuais: 0,
      primeiraData: '2026-11-02', ultimaData: '2026-11-02', ultimaCaptura: '2026-11-10T01:00:00Z',
      situacao: 'AVAILABLE' },
    { entidade: 'OCORRENCIAS', template: 12072, campos: 20, diasRecebidos: null, linhasAtuais: null,
      primeiraData: null, ultimaData: null, ultimaCaptura: null, situacao: 'MULTIPLE_SOURCES' },
  ] });
  abrir();
  const coleta = await screen.findByRole('row', { name: /Coletas/ });
  expect(within(coleta).getByText('0')).toBeTruthy();
  expect(within(coleta).getByText(/09\/11\/2026/)).toBeTruthy();
  const ocorrencias = screen.getByRole('row', { name: /Ocorrências/ });
  expect(within(ocorrencias).queryByText('0')).toBeNull();
  expect(within(ocorrencias).getByText('Origens a conferir')).toBeTruthy();
  expect(clienteAxios.get).toHaveBeenCalledWith('/api/painel/etl-saude/cobertura-v2',
    expect.objectContaining({ signal: expect.any(AbortSignal) }));
});

it('mantém erro de leitura explícito, sem preencher a tabela com zeros', async () => {
  vi.mocked(clienteAxios.get).mockRejectedValue(new Error('SQL indisponível'));
  abrir();
  expect(await screen.findByText('Não foi possível consultar os dados recebidos no ETL V2.')).toBeTruthy();
  expect(screen.queryByRole('table')).toBeNull();
});
