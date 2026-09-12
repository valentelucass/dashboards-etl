// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { EChartsOption } from 'echarts';
import IndicadoresIntegracoesPanel from './IndicadoresIntegracoesPanel';
import clienteAxios from '../../../api/clienteAxios';
import type { IndicadoresEtapas } from '../../../api/endpoints/integracoesEtapas';

vi.mock('../../../api/clienteAxios', () => ({ default: { get: vi.fn() } }));
vi.mock('../../charts/useEchartsTheme', () => ({ useEchartsTheme: () => ({ isDark: true }) }));
vi.mock('../../charts/ChartWrapper', () => ({ default: ({ titulo, option }: { titulo: string; option: EChartsOption }) => (
  <section aria-label={titulo}><pre>{JSON.stringify(option.series)}</pre></section>
) }));

const resposta: IndicadoresEtapas = { versao: 2, dataInicial: '2026-09-01', dataFinal: '2026-09-03', etapas: [
  { sistemaDestino: 'VEDACIT', etapa: 'DADOS', sucessosPeriodo: 0, falhasPeriodo: 0,
    pendentesAtuais: 0, bloqueadosAtuais: 775, semConfirmacaoDatada: 52, confirmadosSemDataConfiavel: 0 },
  { sistemaDestino: 'VEDACIT', etapa: 'COMPROVANTE', sucessosPeriodo: 269, falhasPeriodo: 3,
    pendentesAtuais: 1, bloqueadosAtuais: 695, semConfirmacaoDatada: 0, confirmadosSemDataConfiavel: 0 },
], evolucao: [{ data: '2026-09-02', etapa: 'COMPROVANTE', sucessos: 269, falhas: 3 }] };
let client: QueryClient;
function abrir(destinos: string[] = []) {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><IndicadoresIntegracoesPanel
    inicio="2026-09-01" fim="2026-09-03" destinos={destinos} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); client?.clear(); vi.resetAllMocks(); });

it('mantém confirmações com data incerta no tooltip, sem aviso fixo ou alteração dos totais', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...resposta, etapas: resposta.etapas.map(item =>
    ({ ...item, confirmadosSemDataConfiavel: item.etapa === 'COMPROVANTE' ? 702 : 0 })) } });
  abrir();
  await screen.findByRole('table');
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.queryByText(/702 comprovantes/)).toBeNull();
  expect(screen.queryByText(/XML e comprovantes/)).toBeNull();
  expect(screen.getByRole('region', { name: 'Comprovantes por dia' }).textContent).toContain('"data":[0,269,0]');
  expect(screen.queryByText('971')).toBeNull();
  const indicador = screen.getByText('Comprovantes confirmados').closest('[tabindex="0"]');
  expect(indicador).not.toBeNull();
  fireEvent.focus(indicador!);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip.textContent).toContain('702 comprovantes confirmados com data a conferir');
  expect(tooltip.textContent).toContain('todo o histórico das integrações selecionadas');
  expect(tooltip.textContent).toContain('não são pendências de envio');
  fireEvent.keyDown(indicador!, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
});

it('exibe zero XML e 269 comprovantes sem repetir a base', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: resposta });
  abrir();
  await screen.findByRole('table');
  const xml = screen.getByRole('region', { name: 'XML / dados por dia' });
  const pod = screen.getByRole('region', { name: 'Comprovantes por dia' });
  expect(xml.textContent).toContain('"data":[0,0,0]');
  expect(pod.textContent).toContain('"data":[0,269,0]');
  const resumo = screen.getByRole('region', { name: 'Resultados por etapa no período' });
  expect(resumo.textContent).toContain('"data":[0,269]');
  expect(resumo.textContent).toContain('"data":[0,3]');
  expect(screen.queryByText('546')).toBeNull();
  expect(screen.queryByText('99,3%')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});

it('separa pendentes, bloqueados e sem evidência em cada etapa', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { ...resposta, etapas: [
    { sistemaDestino: 'PPG', etapa: 'DADOS', sucessosPeriodo: 0, falhasPeriodo: 0,
      pendentesAtuais: 0, bloqueadosAtuais: 0, semConfirmacaoDatada: 39, confirmadosSemDataConfiavel: 0 },
    { sistemaDestino: 'SELIA', etapa: 'DADOS', sucessosPeriodo: 0, falhasPeriodo: 0,
      pendentesAtuais: 2, bloqueadosAtuais: 0, semConfirmacaoDatada: 0, confirmadosSemDataConfiavel: 0 },
    ...resposta.etapas,
  ] } });
  abrir();
  const rows = within(await screen.findByRole('table', { name: 'Pendências de VEDACIT' })).getAllByRole('row');
  expect(rows[1].textContent).toContain('XML/Dados077552');
  expect(rows[2].textContent).toContain('Comprovante16950');
  expect(screen.getAllByRole('table').map(table => within(table).getByText(/^Pendências de /).textContent))
    .toEqual(['Pendências de VEDACIT', 'Pendências de SELIA', 'Pendências de PPG']);
  expect(within(screen.getByRole('table', { name: 'Pendências de SELIA' })).getByRole('row', { name: /AddEvents/ }).textContent)
    .toContain('AddEvents200');
  expect(within(screen.getByRole('table', { name: 'Pendências de PPG' })).getByRole('row', { name: /XML\/\s*Dados/ }).textContent)
    .toContain('XML/Dados0039');
  expect(screen.getByText(/Todas as datas, respeitando/)).toBeTruthy();
});

it('erro de contrato não é exibido como zero ou como sucesso antigo', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: { totalRegistros: 273, percentualXmlSucesso: 100 } });
  abrir();
  await screen.findByRole('alert');
  expect(screen.getAllByText('—')).toHaveLength(4);
  expect(screen.queryByRole('table')).toBeNull();
  expect(screen.queryByText('273')).toBeNull();
});

it('explica as quatro colunas por mouse, teclado e toque sem alterar os números', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: resposta });
  abrir();
  const tabela = within(await screen.findByRole('table', { name: 'Pendências de VEDACIT' }));
  const explicacoes = [
    ['Etapa', 'A mesma nota pode aparecer nas duas etapas'],
    ['Pendentes', 'aguardam processamento ou tratamento de erro'],
    ['Bloqueados', 'Precisam de correção ou conferência'],
    ['A conferir', 'não significa que o documento deixou de ser enviado'],
  ];
  for (const [coluna, explicacao] of explicacoes) {
    const botao = tabela.getByRole('button', { name: `Detalhes da coluna ${coluna}` });
    fireEvent.mouseEnter(botao);
    expect((await screen.findByRole('tooltip')).textContent).toContain(explicacao);
    fireEvent.mouseLeave(botao);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  }
  const conferir = tabela.getByRole('button', { name: 'Detalhes da coluna A conferir' });
  fireEvent.focus(conferir);
  expect((await screen.findByRole('tooltip')).textContent).toContain('sem data de confirmação');
  fireEvent.keyDown(conferir, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  fireEvent.click(conferir);
  expect((await screen.findByRole('tooltip')).textContent).toContain('não entram nos envios confirmados');
  fireEvent.click(conferir);
  await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  expect(tabela.getAllByRole('row')[1].textContent).toContain('XML/Dados077552');
});

it('alterar o destino não mantém o gráfico da seleção anterior enquanto carrega', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValueOnce({ data: resposta });
  const view = abrir();
  await screen.findByRole('table');
  vi.mocked(clienteAxios.get).mockImplementation(() => new Promise(() => {}));
  view.rerender(<QueryClientProvider client={client}><IndicadoresIntegracoesPanel
    inicio="2026-09-01" fim="2026-09-03" destinos={['PPG']} /></QueryClientProvider>);
  await waitFor(() => expect(screen.getAllByText('—')).toHaveLength(4));
  expect(screen.queryByRole('table')).toBeNull();
});
