// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { EChartsOption } from 'echarts';
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '../../../api/endpoints/ocorrenciasSinistros';
import { EditarSinistro, GerenciarApolices } from './EdicaoSinistros';
import { GraficoGrupo } from './GraficosSinistros';
import { readDashboardChart } from '../../charts/dashboardChartData';

vi.mock('../../shared/DashboardAdaptiveDialog', () => ({
  default: ({ children }: { children: ReactNode }) => <div role="dialog">{children}</div>,
}));
vi.mock('../../charts/AstryxRadialPlot', () => ({
  default: ({ option }: { option: EChartsOption }) => {
    const formatter = readDashboardChart(option).config.tooltip?.formatter;
    return (
      <>
        <output aria-label="Tipo de gráfico de notas">{JSON.stringify(option.series)}</output>
        <output aria-label="Detalhe da primeira fatia">
          {typeof formatter === 'function' && String(formatter({ dataIndex: 0 }))}
        </output>
      </>
    );
  },
}));
vi.mock('../../charts/AstryxDashboardChart', () => ({
  default: ({ option }: { option: EChartsOption }) => (
    <output aria-label="Séries de ocorrências">{JSON.stringify(option.series)}</output>
  ),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('detalha as notas distintas e os lançamentos em gráficos independentes', () => {
  const dados: api.Indicadores = {
    dias: 3,
    diasOcorrencias: 3,
    diasSinistros: 3,
    diasFretes: 3,
    minutas: 6,
    comOcorrencia: 4,
    eventosDasMinutas: 9,
    notas: 4,
    emTratativa: 1,
    comPrazo: 2,
    noPrazo: 1,
    minutasComSinistro: 1,
    evolucao: [],
    grupos: [
      { grupo: 'AVARIA', notas: 2, quantidade: 5 },
      { grupo: 'CLIENTE', notas: 4, quantidade: 7 },
    ],
    tipos: [{ grupo: 'AVARIA', descricao: 'Avaria parcial', codigo: 79, notas: 1, quantidade: 3 }],
  };
  render(
    <>
      <GraficoGrupo dados={dados} porNota />
      <GraficoGrupo dados={dados} porNota={false} />
    </>,
  );
  const notas = within(screen.getByLabelText('Percentual e quantidade de notas'));
  const eventos = within(screen.getByLabelText('Quantidade de ocorrências'));
  const item = notas.getByRole('button', { name: 'Detalhar AVARIA' });
  expect(item.textContent).toContain('50,0%');
  const maiorGrupo = notas.getByRole('button', { name: 'Detalhar CLIENTE' });
  expect(notas.getByLabelText('Detalhe da primeira fatia').textContent).toBe(
    maiorGrupo.getAttribute('aria-description'),
  );
  expect(item.getAttribute('title')).toBe('AVARIA · 2 notas · 50,0% das notas únicas');
  expect(maiorGrupo.textContent).toContain('100,0%');
  expect(within(item).getByText('2')).toBeTruthy();
  expect(notas.getByLabelText('Tipo de gráfico de notas').textContent).toContain('"type":"pie"');
  fireEvent.click(item);
  expect(notas.getByLabelText('Detalhe da primeira fatia').textContent).toBe(
    'Avaria parcial · 1 nota · 50,0% das notas únicas',
  );
  expect(notas.getByText('Avaria parcial').parentElement?.textContent).toContain('50,0%');
  const agrupamento = screen.getByRole('combobox', { name: 'Detalhar grupo de ocorrências' });
  expect(eventos.getByLabelText('Séries de ocorrências').textContent).toContain('"type":"bar"');
  fireEvent.click(screen.getByRole('button', { name: 'Grupos' }));
  fireEvent.change(agrupamento, { target: { value: 'AVARIA' } });
  const series = JSON.parse(eventos.getByLabelText('Séries de ocorrências').textContent!);
  expect(series.map((s: { data: number[] }) => s.data)).toEqual([[3], [1]]);
  expect(notas.getByRole('button', { name: 'Detalhar AVARIA' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Grupos' }));
  expect(screen.getByRole('combobox', { name: 'Detalhar grupo de ocorrências' })).toBeTruthy();
});

const linha: api.Sinistro = {
  numero: 7,
  status: 'Em aberto',
  statusCorretora: 'Pendente',
  franquia: null,
  salvados: null,
  revisao: 3,
  ocorrido: null,
  abertura: null,
  finalizacao: null,
  cliente: null,
  minutas: null,
  notas: null,
  valorNf: null,
  seguradora: null,
  processo: null,
  prejuizo: 180,
  aReceber: null,
  sinistralidade: null,
  sinistralidadeReal: null,
  saldoParcial: false,
};

it('salva o status, preserva centavos e distingue zero de um valor em branco', async () => {
  const gravar = vi.spyOn(api, 'salvarAcompanhamento').mockResolvedValue();
  const fechar = vi.fn();
  render(<EditarSinistro linha={linha} fechar={fechar} salvou={async () => {}} />);
  fireEvent.change(screen.getByLabelText(/Status do processo/), { target: { value: 'Finalizado' } });
  fireEvent.change(screen.getByLabelText(/Franquia/), { target: { value: '0' } });
  fireEvent.change(screen.getByLabelText(/Venda de salvados/), { target: { value: '12.34' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  await waitFor(() => expect(fechar).toHaveBeenCalledOnce());
  expect(gravar).toHaveBeenCalledWith(7, {
    statusCorretora: 'Finalizado',
    franquia: 0,
    salvados: 12.34,
    revisao: 3,
  });
});

it('mantém o formulário aberto se falhar e cancelar não grava uma segunda vez', async () => {
  const gravar = vi.spyOn(api, 'salvarAcompanhamento').mockRejectedValue(new Error('falha'));
  const fechar = vi.fn();
  render(<EditarSinistro linha={linha} fechar={fechar} salvou={async () => {}} />);
  fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(fechar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(gravar).toHaveBeenCalledTimes(1);
  expect(fechar).toHaveBeenCalledOnce();
});

it('cadastra uma vigência válida e mantém o número da apólice com zeros à esquerda', async () => {
  vi.spyOn(api, 'lerApolices').mockResolvedValue([]);
  const gravar = vi.spyOn(api, 'salvarApolice').mockResolvedValue();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <GerenciarApolices fechar={vi.fn()} salvou={async () => {}} />
    </QueryClientProvider>,
  );
  await screen.findByText('Nenhuma apólice cadastrada.');
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar apólice' }));
  fireEvent.change(screen.getByLabelText('Número da apólice'), { target: { value: '0007' } });
  fireEvent.change(screen.getByLabelText('Início da vigência'), { target: { value: '2026-06-01' } });
  const fim = screen.getByLabelText('Fim da vigência') as HTMLInputElement;
  fireEvent.change(fim, { target: { value: '2026-05-31' } });
  expect(fim.validity.rangeUnderflow).toBe(true);
  fireEvent.change(fim, { target: { value: '2027-05-31' } });
  fireEvent.change(screen.getByLabelText('Valor segurado (R$)'), { target: { value: '9999.99' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar apólice' }));
  await waitFor(() =>
    expect(gravar).toHaveBeenCalledWith({
      numero: '0007',
      inicio: '2026-06-01',
      fim: '2027-05-31',
      valorSegurado: 9999.99,
      revisao: 0,
    }),
  );
});
