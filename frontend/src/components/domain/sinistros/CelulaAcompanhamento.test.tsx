// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '../../../api/endpoints/ocorrenciasSinistros';
import CelulaAcompanhamento from './CelulaAcompanhamento';

vi.mock('../../shared/DashboardSelector', () => ({
  default: (p: {
    value: string;
    onValueChange: (v: string) => void;
    'aria-label': string;
    children: ReactNode;
  }) => (
    <select value={p.value} aria-label={p['aria-label']} onChange={(e) => p.onValueChange(e.target.value)}>
      {p.children}
    </select>
  ),
}));
const sinistro: api.Sinistro = {
  numero: 312,
  revisao: 7,
  franquia: 240,
  salvados: null,
  statusCorretora: 'Pendente',
  abertura: null,
  ocorrido: null,
  finalizacao: null,
  status: 'Aberto',
  cliente: null,
  minutas: null,
  notas: null,
  valorNf: null,
  seguradora: null,
  processo: null,
  prejuizo: null,
  aReceber: null,
  sinistralidade: null,
  sinistralidadeReal: null,
  saldoParcial: false,
};
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('edita somente o status escolhido e atualiza a relação após a gravação', async () => {
  const alterar = vi.spyOn(api, 'alterarCampoSinistro').mockResolvedValue();
  const atualizar = vi.fn().mockResolvedValue(undefined);
  render(
    <CelulaAcompanhamento
      linha={sinistro}
      campo="statusCorretora"
      rotulo="Status da corretora"
      atualizar={atualizar}
    />,
  );
  expect(screen.getAllByRole('option').map((x) => x.textContent)).toEqual([
    'Pendente',
    'Em Andamento',
    'Finalizado',
  ]);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Em Andamento' } });
  await waitFor(() => expect(atualizar).toHaveBeenCalledOnce());
  expect(alterar).toHaveBeenCalledWith(312, 'statusCorretora', 'Em Andamento', 7);
});

it('aceita reais digitados ou colados e preserva a revisão vista no início da edição', async () => {
  const alterar = vi.spyOn(api, 'alterarCampoSinistro').mockResolvedValue();
  const atualizar = vi.fn().mockResolvedValue(undefined);
  const props = { campo: 'franquia' as const, rotulo: 'Franquia', atualizar };
  const tela = render(<CelulaAcompanhamento {...props} linha={sinistro} />);
  const entrada = screen.getByRole('textbox') as HTMLInputElement;
  expect(entrada.value).toBe('240,00');
  fireEvent.change(entrada, { target: { value: 'R$ 1.234,56' } });
  tela.rerender(<CelulaAcompanhamento {...props} linha={{ ...sinistro, revisao: 8 }} />);
  fireEvent.click(screen.getByRole('button', { name: /Salvar Franquia/ }));
  await waitFor(() => expect(atualizar).toHaveBeenCalledOnce());
  expect(alterar).toHaveBeenCalledWith(312, 'franquia', '1234.56', 7);
});

it('permite cancelar, rejeita texto inválido e distingue apagar um valor de gravar zero', async () => {
  const alterar = vi.spyOn(api, 'alterarCampoSinistro').mockResolvedValue();
  const atualizar = vi.fn().mockResolvedValue(undefined);
  render(
    <CelulaAcompanhamento
      linha={{ ...sinistro, salvados: 12 }}
      campo="salvados"
      rotulo="Salvados"
      atualizar={atualizar}
    />,
  );
  const entrada = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(entrada, { target: { value: '-1' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  expect(screen.getByRole('alert')).toBeTruthy();
  fireEvent.keyDown(entrada, { key: 'Escape' });
  expect(entrada.value).toBe('12,00');
  expect(alterar).not.toHaveBeenCalled();
  for (const [texto, esperado] of [
    ['0,00', '0.00'],
    ['', ''],
  ]) {
    fireEvent.change(entrada, { target: { value: texto } });
    fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /Salvar/ })).toBeNull());
    expect(alterar).toHaveBeenLastCalledWith(312, 'salvados', esperado, 7);
  }
});

it('mantém o valor em uma falha de rede e pede conferência se o sinistro foi alterado por outra pessoa', async () => {
  const alterar = vi
    .spyOn(api, 'alterarCampoSinistro')
    .mockRejectedValueOnce(Error('rede'))
    .mockRejectedValueOnce({ isAxiosError: true, response: { status: 409 } });
  const atualizar = vi.fn().mockResolvedValue(undefined);
  render(<CelulaAcompanhamento linha={sinistro} campo="franquia" rotulo="Franquia" atualizar={atualizar} />);
  const entrada = screen.getByRole('textbox') as HTMLInputElement;
  fireEvent.change(entrada, { target: { value: '243,07' } });
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  await screen.findByText(/Não foi possível salvar/);
  expect(entrada.value).toBe('243,07');
  fireEvent.click(screen.getByRole('button', { name: /Salvar/ }));
  await screen.findByText(/Este sinistro mudou/);
  expect(atualizar).toHaveBeenCalledOnce();
  expect(entrada.value).toBe('240,00');
  expect(alterar).toHaveBeenCalledTimes(2);
});
