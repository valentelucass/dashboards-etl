// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
afterEach(() => { cleanup(); queryClient?.clear(); vi.useRealTimers(); vi.resetAllMocks(); });

it('atualiza o ciclo aberto em um minuto sem inventar finalizacao ou proximo ciclo', async () => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  const aberto = { ...ciclo, statusCiclo: 'EM_EXECUCAO', fimUltimoCiclo: null,
    proximaExecucaoEstimada: null, atualizadoEm: new Date().toISOString(), enviados: 5 };
  responderCom(aberto);
  abrir();
  expect((await screen.findAllByText('5 comprovantes enviados')).length).toBe(2);
  expect(screen.getByText('Em andamento · parcial')).toBeTruthy();
  expect(screen.queryByText('Próximo ciclo estimado')).toBeNull();
  const antes = vi.mocked(clienteAxios.get).mock.calls.length;
  responderCom({ ...aberto, enviados: 8 });
  await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
  expect((await screen.findAllByText('8 comprovantes enviados')).length).toBe(2);
  expect(vi.mocked(clienteAxios.get).mock.calls.length).toBeGreaterThanOrEqual(antes + 2);
});

it('avisa quando o ultimo progresso ficou antigo sem declarar termino', async () => {
  responderCom({ ...ciclo, statusCiclo: 'EM_EXECUCAO', fimUltimoCiclo: null,
    proximaExecucaoEstimada: null, atualizadoEm: '2020-01-01T10:00:00' });
  abrir();
  expect((await screen.findAllByText('Sem atualização recente')).length).toBe(2);
  expect(screen.queryByText('Próximo ciclo estimado')).toBeNull();
});

describe('CiclosIntegracaoPanel', () => {
  it('separa XML de comprovantes e exibe motivo sem transformar ausencia de medicao em zero', async () => {
    responderCom({ ...ciclo, statusCiclo: 'FALHA', xmlHabilitado: true, xmlAvaliados: 20,
      xmlEnviados: 0, xmlErros: 6, xmlJaProcessados: 14, xmlPendentes: 0,
      motivoFalha: 'XML_RETIDO: Falhas XML auditadas' });
    abrir();
    expect((await screen.findAllByText('XML: 0 confirmados · 6 falhas')).length).toBe(2);
    expect(screen.getAllByText('Há falhas na etapa XML. Consulte a auditoria dos documentos.').length).toBe(2);
    expect(screen.getAllByText('0 comprovantes enviados').length).toBe(2);
  });

  it('identifica ciclos antigos sem medicao XML', async () => {
    abrir();
    expect((await screen.findAllByText('XML: sem medição neste ciclo.')).length).toBe(2);
    expect(screen.queryByText('XML: 0 confirmados · 0 falhas')).toBeNull();
  });
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

it('distingue a consulta atual do ciclo antigo e retira a previsão vencida', async () => {
  responderCom(ciclo); abrir();
  expect(await screen.findByText(/A fonte ainda não informa o progresso/)).toBeTruthy();
  expect(screen.getByText(/Consulta realizada em/)).toBeTruthy();
  expect(screen.getByText(/Estimativa anterior vencida/)).toBeTruthy();
  expect(screen.queryByText('Próximo ciclo estimado')).toBeNull();
});

it('não informa ausência de contrato quando a origem devolve progresso medido', async () => {
  responderCom({ ...ciclo, atualizadoEm: new Date().toISOString() }); abrir();
  await screen.findByRole('table');
  expect(screen.queryByText(/A fonte ainda não informa o progresso/)).toBeNull();
});
