// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CiclosIntegracaoPanel from './CiclosIntegracaoPanel';
import type { WorkSftpClienteStatus } from '../../../api/endpoints/integracoesServico';
import clienteAxios from '../../../api/clienteAxios';

vi.mock('../../../api/clienteAxios', () => ({ default: { get: vi.fn() } }));
const ciclo: WorkSftpClienteStatus = {
  cliente: 'VEDACIT', origemComprovantes: 'SFTP', inicioUltimoCiclo: '2026-09-09T22:55:28', fimUltimoCiclo: '2026-09-09T22:56:21',
  conexao: 'OK', statusCiclo: 'CONCLUIDO', arquivosValidos: 3058, arquivosRejeitados: 37, selecionados: 1, enviados: 0,
  pendentes: 1, saldo: 1, bloqueios: 780, timeoutsAmbiguos: 18, duracaoMs: 53000, proximaExecucaoEstimada: '2026-09-09T23:26:21',
};
const pagina = (itens: WorkSftpClienteStatus[]) => ({ itens, paginacao: { pagina: 0, tamanho: 10, totalElementos: itens.length, totalPaginas: itens.length ? 1 : 0, primeiraPagina: true, ultimaPagina: true } });
function responderCom(item: WorkSftpClienteStatus) {
  vi.mocked(clienteAxios.get).mockImplementation(async (url) => ({ data: url.endsWith('/clientes') ? [item] : pagina([item]) }));
}
let queryClient: QueryClient;
function ultimoParametro(chave: string) {
  const params = vi.mocked(clienteAxios.get).mock.lastCall?.[1]?.params;
  expect(params).toBeInstanceOf(URLSearchParams);
  return (params as URLSearchParams).get(chave);
}
function abrir() {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={queryClient}><CiclosIntegracaoPanel dataInicio="2026-09-01" dataFim="2026-09-09" /></QueryClientProvider>);
}
beforeEach(() => {
  responderCom(ciclo);
});
afterEach(() => { cleanup(); queryClient?.clear(); vi.resetAllMocks(); });

describe('CiclosIntegracaoPanel', () => {
  it('explica as unidades e separa arquivos, tratamento do ciclo e pendencias acumuladas', async () => {
    abrir();
    expect((await screen.findAllByText('3.058 arquivos reconhecidos')).length).toBe(2);
    expect(screen.getAllByText('1 NF-e avaliada').length).toBe(2);
    expect(screen.getAllByText('0 comprovantes enviados').length).toBe(2);
    expect(screen.getAllByText('780 registros bloqueados').length).toBe(2);
    expect(screen.getAllByText('18 envios sem confirmação (timeout)').length).toBe(2);
    const trigger = screen.getAllByText('3.058 arquivos reconhecidos')[0].closest('[tabindex="0"]');
    expect(trigger).not.toBeNull();
    fireEvent.focus(trigger!);
    expect((await screen.findByRole('tooltip')).textContent).toContain('Pode incluir comprovantes já enviados');
  });

  it('reinicia a pagina e aplica origem no servidor sem misturar a pagina anterior', async () => {
    vi.mocked(clienteAxios.get).mockImplementation(async (url) => ({ data: url.endsWith('/clientes') ? [ciclo] : { itens: [ciclo], paginacao: { ...pagina([ciclo]).paginacao, totalPaginas: 2, totalElementos: 20, ultimaPagina: false } } }));
    abrir();
    fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
    await waitFor(() => expect(ultimoParametro('pagina')).toBe('1'));
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'SFTP' } });
    await waitFor(() => expect(ultimoParametro('origem')).toBe('SFTP'));
    expect(ultimoParametro('pagina')).toBe('0');
  });

  it('mostra SFTP no cartão e histórico com a resposta antiga e mantém o filtro funcional', async () => {
    const legado = { ...ciclo, origemComprovantes: undefined };
    responderCom(legado);
    abrir();
    await screen.findByRole('table');
    expect(screen.getByRole('article').textContent).toContain('Origem:SFTP');
    expect(screen.getByRole('table').textContent).toContain('SFTP');
    expect(screen.queryByText('Não informada')).toBeNull();
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'SFTP' } });
    await waitFor(() => expect(ultimoParametro('origem')).toBe('SFTP'));
    await screen.findByRole('table');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('3.058 arquivos reconhecidos').length).toBe(2);
  });

  it('oculta resposta antiga que ignora filtro API ESL sem exibir linhas SFTP ou totais falsos', async () => {
    responderCom({ ...ciclo, origemComprovantes: undefined });
    abrir();
    await screen.findByRole('table');
    vi.mocked(clienteAxios.get).mockClear();
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'API_ESL' } });
    expect((await screen.findByRole('alert')).textContent).toContain('não disponibilizou o histórico da API ESL');
    expect(ultimoParametro('origem')).toBe('API_ESL');
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText('3.058 arquivos reconhecidos')).toBeNull();
    expect(screen.queryByText(/execuções ·/)).toBeNull();
  });

  it('exibe API ESL no cartão e na coluna e preserva os registros e totais ao filtrar essa origem', async () => {
    responderCom({ ...ciclo, origemComprovantes: 'API_ESL' });
    abrir();
    await screen.findByRole('table');
    expect(screen.getByRole('article').textContent).toContain('Origem:API ESL');
    expect(screen.getByRole('table').textContent).toContain('API ESL');
    expect(screen.queryByText('Não informada')).toBeNull();
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'API_ESL' } });
    await waitFor(() => expect(ultimoParametro('origem')).toBe('API_ESL'));
    await screen.findByRole('table');
    expect(screen.getByRole('table').textContent).toContain('API ESL');
    expect(screen.getByText('1 execuções · 10 por página')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não transforma uma página com origens diferentes em uma falsa página filtrada', async () => {
    vi.mocked(clienteAxios.get).mockImplementation(async (url) => ({ data: url.endsWith('/clientes') ? [ciclo] : pagina([ciclo, { ...ciclo, origemComprovantes: 'API_ESL', inicioUltimoCiclo: '2026-09-09T21:00:00' }]) }));
    abrir();
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'SFTP' } });
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível aplicar o filtro');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('preserva origem explicitamente desconhecida e recusa página incompatível com o filtro', async () => {
    responderCom({ ...ciclo, origemComprovantes: null });
    abrir();
    expect((await screen.findAllByText('Não informada')).length).toBe(2);
    fireEvent.change(screen.getByLabelText('Origem dos comprovantes'), { target: { value: 'SFTP' } });
    expect((await screen.findByRole('alert')).textContent).toContain('Não foi possível aplicar o filtro');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('nao apresenta zeros de ciclo interrompido como inventario vazio', async () => {
    const falha = { ...ciclo, statusCiclo: 'FALHA', arquivosValidos: 0, arquivosRejeitados: 0, selecionados: 0, enviados: 0, pendentes: 0, saldo: 0, bloqueios: 0, timeoutsAmbiguos: 0 };
    responderCom(falha);
    abrir();
    expect((await screen.findAllByText('Contagens não disponíveis nesta execução.')).length).toBe(6);
    expect(screen.queryByText('0 arquivos reconhecidos')).toBeNull();
  });

  it('preserva contagens registradas quando um ciclo termina com falha de processamento', async () => {
    const falhaComContagens = { ...ciclo, statusCiclo: 'FALHA' };
    responderCom(falhaComContagens);
    abrir();
    expect((await screen.findAllByText('3.058 arquivos reconhecidos')).length).toBe(2);
    expect(screen.queryByText('Contagens não disponíveis nesta execução.')).toBeNull();
  });
});
