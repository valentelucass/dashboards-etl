// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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

const resposta: IndicadoresEtapas = { versao: 1, dataInicial: '2026-09-01', dataFinal: '2026-09-03', etapas: [
  { sistemaDestino: 'VEDACIT', etapa: 'DADOS', sucessosPeriodo: 0, falhasPeriodo: 0,
    pendentesAtuais: 0, bloqueadosAtuais: 775, semConfirmacaoDatada: 52 },
  { sistemaDestino: 'VEDACIT', etapa: 'COMPROVANTE', sucessosPeriodo: 269, falhasPeriodo: 3,
    pendentesAtuais: 1, bloqueadosAtuais: 695, semConfirmacaoDatada: 0 },
], evolucao: [{ data: '2026-09-02', etapa: 'COMPROVANTE', sucessos: 269, falhas: 3 }] };
let client: QueryClient;
function abrir(destinos: string[] = []) {
  client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0, gcTime: 0 } } });
  return render(<QueryClientProvider client={client}><IndicadoresIntegracoesPanel
    inicio="2026-09-01" fim="2026-09-03" destinos={destinos} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); client?.clear(); vi.resetAllMocks(); });

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
  expect(screen.getByRole('status').textContent).toContain('52 etapas sem confirmação datada');
});

it('separa pendentes, bloqueados e sem evidência em cada etapa', async () => {
  vi.mocked(clienteAxios.get).mockResolvedValue({ data: resposta });
  abrir(['VEDACIT']);
  const rows = within(await screen.findByRole('table')).getAllByRole('row');
  expect(rows[1].textContent).toContain('VEDACIT · XML/Dados077552');
  expect(rows[2].textContent).toContain('VEDACIT · Comprovante16950');
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
