// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import clienteAxios from '../../../api/clienteAxios';
import { lerRelacaoCompleta, type Sinistro } from '../../../api/endpoints/ocorrenciasSinistros';
import * as download from '../../../api/downloadArquivo';
import RelacaoSinistros from './RelacaoSinistros';
import { camposSinistros, filtrarSinistros, gerarCsvSinistros, ordenarSinistros } from './camposSinistros';

const periodo = { dataInicio: '2026-11-01', dataFim: '2026-11-25' };
const base: Sinistro = {
  numero: 0,
  ocorrido: '2026-11-01',
  abertura: '2026-11-02',
  finalizacao: null,
  status: 'Aberto',
  cliente: 'São José',
  minutas: '00047',
  notas: '00623',
  seguradora: null,
  processo: null,
  statusCorretora: 'Pendente',
  valorNf: 1024.51,
  prejuizo: null,
  aReceber: null,
  franquia: null,
  salvados: 0,
  sinistralidade: null,
  sinistralidadeReal: null,
  saldoParcial: false,
  revisao: 0,
};
const linhas = Array.from({ length: 27 }, (_, i) => ({ ...base, numero: 1000 + i }));
linhas[26] = {
  ...linhas[26],
  status: 'Finalizado',
  cliente: 'Indústria Santa Fé',
  franquia: 0,
  sinistralidade: 950,
  saldoParcial: true,
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('busca em toda a carteira autorizada, combina filtros e exporta os mesmos campos da tela', () => {
  expect(camposSinistros).toHaveLength(18);
  expect(
    filtrarSinistros(linhas, {
      busca: 'industria',
      razaoSocial: 'santa fe',
      status: ['Finalizado'],
      columnFilters: { franquia: 'R$ 0,00' },
    }),
  ).toEqual([linhas[26]]);
  expect(
    filtrarSinistros(linhas, {
      columnFilters: { status: ['Aberto', 'Finalizado'], ocorrido: '01/11/2026', valorNf: '1.024,51' },
    }),
  ).toHaveLength(27);
  expect(filtrarSinistros(linhas, { busca: 'parcial', codigo: '1026' })).toEqual([linhas[26]]);
  expect(filtrarSinistros(linhas, { columnFilters: { status: 'Final' } })).toHaveLength(0);
  const csv = gerarCsvSinistros([{ ...linhas[26], cliente: '=teste;"teste"' }]);
  expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('"\'=teste;""teste"""');
  expect(csv).toContain(' (parcial)');
  expect(csv).toContain('"00047"');
  expect(csv).toContain('"—"');
});

it('ordena valores monetários pelo valor, com zero preservado e vazios ao final', () => {
  const valores = [null, 10, 0, 2].map((franquia) => ({ ...base, franquia }));
  expect(ordenarSinistros(valores, 'franquia', 'asc').map((l) => l.franquia)).toEqual([0, 2, 10, null]);
  expect(ordenarSinistros(valores, 'franquia', 'desc').map((l) => l.franquia)).toEqual([10, 2, 0, null]);
  expect(valores[0].franquia).toBeNull();
});

it('carrega páginas adicionais com o mesmo período e cancelamento e rejeita duplicação ou mudança de total', async () => {
  const get = vi.spyOn(clienteAxios, 'get');
  const signal = new AbortController().signal;
  const primeira = { total: 27, encerrados: 1, mediaDias: 2, prazos: [], linhas: linhas.slice(0, 25) };
  const segunda = { ...primeira, linhas: linhas.slice(25) };
  get.mockResolvedValueOnce({ data: primeira }).mockResolvedValueOnce({ data: segunda });
  expect((await lerRelacaoCompleta(periodo, signal)).linhas).toEqual(linhas);
  expect(get).toHaveBeenNthCalledWith(2, expect.any(String), {
    params: { ...periodo, pagina: 1, tamanho: 200 },
    signal,
  });
  for (const inconsistente of [
    { ...segunda, linhas: [linhas[0], linhas[26]] },
    { ...segunda, total: 26 },
    { ...segunda, linhas: [] },
  ]) {
    get.mockResolvedValueOnce({ data: primeira }).mockResolvedValueOnce({ data: inconsistente });
    await expect(lerRelacaoCompleta(periodo)).rejects.toThrow('atualizada');
  }
});

it('usa a tabela analítica para buscar um sinistro da terceira página, editar e exportar só o resultado', async () => {
  const editar = vi.fn();
  const salvar = vi.spyOn(download, 'salvarBlobComoArquivo').mockImplementation(() => {});
  render(
    <MemoryRouter>
      <RelacaoSinistros periodo={periodo} linhas={linhas} editar={editar} />
    </MemoryRouter>,
  );
  const tabela = within(screen.getByRole('region', { name: 'Dados da relação de sinistros' }));
  expect(tabela.getByText('27 registros encontrados')).toBeTruthy();
  expect(tabela.queryByRole('button', { name: 'Editar sinistro 1026' })).toBeNull();
  const busca = tabela.getByPlaceholderText('Buscar na tabela...');
  fireEvent.change(busca, { target: { value: 'industria santa fe' } });
  fireEvent.keyDown(busca, { key: 'Enter' });
  await waitFor(() => expect(tabela.getByText('1 registro encontrado')).toBeTruthy());
  fireEvent.click(tabela.getByRole('button', { name: 'Editar sinistro 1026' }));
  expect(editar).toHaveBeenCalledWith(linhas[26]);
  fireEvent.click(tabela.getByRole('button', { name: 'Exportar CSV' }));
  expect(salvar).toHaveBeenCalledOnce();
  const leitor = new FileReader();
  const texto = new Promise<string>((resolve) => {
    leitor.onload = () => resolve(String(leitor.result));
  });
  leitor.readAsText(salvar.mock.calls[0][0]);
  expect((await texto).split('\r\n')).toHaveLength(2);
  fireEvent.click(tabela.getByRole('button', { name: 'Limpar' }));
  expect(await tabela.findByText('27 registros encontrados')).toBeTruthy();
});

it('apresenta todos os campos financeiros em modo de leitura', () => {
  render(
    <MemoryRouter>
      <RelacaoSinistros periodo={periodo} linhas={[linhas[26]]} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('button', { name: /Editar sinistro/ })).toBeNull();
  expect(screen.queryByRole('combobox', { name: /Status do processo da corretora do sinistro/ })).toBeNull();
  expect(screen.queryByRole('textbox', { name: /do sinistro 1026 em reais/ })).toBeNull();
  expect(screen.getByRole('columnheader', { name: /^Venda de salvados$/i })).toBeTruthy();
  expect(screen.getByText(/950,00 \(parcial\)/)).toBeTruthy();
});
