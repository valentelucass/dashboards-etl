// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EChartsOption } from 'echarts';
import IndicadoresIntegracoesPanel from './IndicadoresIntegracoesPanel';
import clienteAxios from '../../../api/clienteAxios';
import type { IndicadoresOperacionais } from '../../../api/endpoints/integracoesOperacionais';

vi.mock('../../../api/clienteAxios', () => ({ default: { get: vi.fn() } }));
vi.mock('../../charts/useEchartsTheme', () => ({ useEchartsTheme: () => ({ isDark: true }) }));
vi.mock('../../charts/ChartWrapper', () => ({ default: ({ titulo, option }: { titulo: string; option: EChartsOption }) => (
  <section aria-label={titulo}><pre>{JSON.stringify(option.series)}</pre></section>
) }));
const resposta: IndicadoresOperacionais = { versao: 3, dataInicial: '2026-09-01', dataFinal: '2026-09-03',
  historicoDesde: '2026-09-02T12:00:00', escopoTransmissoes: 'VEDACIT', atividade: [], etapas: [
    { sistemaDestino: 'VEDACIT', etapa: 'DADOS', sucessosPeriodo: 0, aguardandoProcessamento: 0,
      novaTentativa: 2, aguardandoOrigem: 160, aguardandoConfirmacao: 0, intervencao: 1, semConfirmacaoDatada: 52, confirmadosSemDataConfiavel: 0 },
    { sistemaDestino: 'VEDACIT', etapa: 'COMPROVANTE', sucessosPeriodo: 269, aguardandoProcessamento: 1,
      novaTentativa: 3, aguardandoOrigem: 205, aguardandoConfirmacao: 67, intervencao: 10, semConfirmacaoDatada: 0, confirmadosSemDataConfiavel: 0 },
  ], evolucao: [{ data: '2026-09-02', etapa: 'COMPROVANTE', sucessos: 269 }] };
let client: QueryClient;
function abrir(destinos: string[] = []) {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><IndicadoresIntegracoesPanel
    inicio="2026-09-01" fim="2026-09-03" destinos={destinos} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); client?.clear(); vi.resetAllMocks(); });

it('preserva 702 confirmações com data incerta no tooltip sem somá-las ao período ou à fila', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...resposta, etapas: resposta.etapas.map(item =>
    ({ ...item, confirmadosSemDataConfiavel: item.etapa === 'COMPROVANTE' ? 702 : 0 })) } });
  abrir();
  await screen.findByRole('table', { name: 'Pendências de VEDACIT' });
  expect(screen.queryByText(/702 comprovantes/)).toBeNull();
  expect(screen.getByRole('region', { name: 'Comprovantes por dia' }).textContent).toContain('"data":[0,269,0]');
  expect(screen.queryByText('971')).toBeNull();
  fireEvent.focus(screen.getByText('Comprovantes confirmados').closest('[tabindex="0"]')!);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.textContent).toContain('702 comprovantes confirmados com data a conferir');
  expect(tooltip.textContent).toContain('não são pendências de envio');
});
it('separa confirmações do saldo e da atividade repetida', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...resposta, atividade: [
    { data: '2026-09-02', etapa: 'DADOS', avaliacoes: 10, enviosIniciados: 0, reenviosIniciados: 0,
      consultasOrigem: 1, retencoes: 10, confirmacoesAvaliadas: 0 },
  ] } });
  abrir();
  const tabela = within(await screen.findByRole('table', { name: 'Pendências de VEDACIT' }));
  expect(tabela.getByRole('row', { name: /Aguardando origem/ }).textContent).toContain('160205');
  expect(tabela.getByRole('row', { name: /Aguardando confirmação/ }).textContent).toContain('067');
  expect(tabela.getByRole('row', { name: /Exige intervenção/ }).textContent).toContain('110');
  expect(screen.getByText('438')).toBeTruthy();
  expect(screen.getByText('11')).toBeTruthy();
  const resumo = screen.getByRole('region', { name: 'Confirmações por etapa no período' });
  expect(resumo.textContent).toContain('"data":[0,269]');
  expect(resumo.textContent).not.toContain('Com falha');
  expect(screen.getByRole('region', { name: 'XML / dados por dia' }).textContent).toContain('"data":[0,0,0]');
  fireEvent.click(screen.getByText('Avaliações e tentativas no período'));
  expect(within(screen.getByRole('table', { name: 'Histórico de avaliações e tentativas' })).getAllByRole('row')[1].textContent)
    .toContain('02/09/2026XML/Dados1000110');
});
it('abre documentos paginados sem inventar idade histórica ou programação', async () => {
  vi.mocked(clienteAxios.get).mockImplementation(async (url, config) => {
    if (!url.endsWith('/pendencias-etapas')) return { data: resposta };
    const p = config?.params as URLSearchParams;
    expect(p.get('destino')).toBe('VEDACIT'); expect(p.get('etapa')).toBe('DADOS'); expect(p.get('acao')).toBe('AGUARDANDO_ORIGEM');
    return { data: { pagina: Number(p.get('pagina')), tamanho: 25, totalElementos: 26, itens: [
      { id: 123, sistemaDestino: 'VEDACIT', etapa: 'DADOS', acao: 'AGUARDANDO_ORIGEM', documento: 'CT-e 000012345',
        motivo: 'ACESSO_ORIGEM_RECUSADO', pendenteDesde: null, ultimaAvaliacao: '2026-09-02T12:00:00', proximaAvaliacao: null },
    ] } };
  });
  abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Ver Aguardando origem de VEDACIT · XML/Dados' }));
  const docs = within(await screen.findByRole('table', { name: 'Documentos da pendência selecionada' }));
  expect(docs.getByText('Não registrada')).toBeTruthy();
  expect(docs.getByText('Sem programação registrada')).toBeTruthy();
  expect(docs.getByText('A origem recusou o acesso ao XML')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Próxima' }));
  await screen.findByText('26 documentos · página 2');
  fireEvent.click(screen.getByRole('button', { name: 'Fechar documentos' }));
  expect(screen.queryByRole('table', { name: 'Documentos da pendência selecionada' })).toBeNull();
});
it('recusa contrato antigo sem exibir zeros', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { versao: 2, totalRegistros: 273 } });
  abrir(); await screen.findByRole('alert');
  expect(screen.getAllByText('—')).toHaveLength(4);
  expect(screen.queryByRole('table')).toBeNull();
});
it('não representa ausência de histórico de tentativas como zero', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...resposta, historicoDesde: null } });
  abrir(); await screen.findByRole('table');
  fireEvent.click(screen.getByText('Avaliações e tentativas no período'));
  expect(screen.getByText(/O histórico detalhado ainda não possui registros/)).toBeTruthy();
  expect(screen.getByText(/Datas anteriores ao início da medição não representam zero tentativas/)).toBeTruthy();
});
it('trocar integração oculta detalhes e indicadores anteriores enquanto carrega', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValueOnce({ data: resposta });
  const view = abrir(); await screen.findByRole('table');
  vi.mocked(clienteAxios.get).mockImplementation(() => new Promise(() => {}));
  fireEvent.click(screen.getByRole('button', { name: 'Ver Aguardando origem de VEDACIT · XML/Dados' }));
  view.rerender(<QueryClientProvider client={client}><IndicadoresIntegracoesPanel
    inicio="2026-09-01" fim="2026-09-03" destinos={['PPG']} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(4));
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByText('Fechar documentos')).toBeNull();
});
