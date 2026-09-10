// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import KpiGoalsManagerPanel from './KpiGoalsManagerPanel';

type Props = ComponentProps<typeof KpiGoalsManagerPanel>;
const globalGoals = { delivery_performance: 95, collector_usage: 80, cargo_cubage: 80, cargo_indemnity: 0.2, cutoff_time: 90 };
function props(overrides: Partial<Props> = {}): Props {
  return {
    open: true, branchId: 'CWB', competencia: '2026-09-01', branchOptions: ['CWB', 'SPO'],
    data: { competencia: '2026-09-01', global: globalGoals, branches: [] },
    historyPage: 1, isLoading: false, isHistoryLoading: false, isSaving: false, error: null, saveError: null,
    onBranchChange: vi.fn(), onCompetenciaChange: vi.fn(), onApplyGlobal: vi.fn().mockResolvedValue(undefined),
    onSaveBranch: vi.fn().mockResolvedValue(undefined), onRemoveOverride: vi.fn().mockResolvedValue(undefined),
    onHistoryPageChange: vi.fn(), ...overrides,
  };
}
const branchForm = () => screen.getByRole('form', { name: 'Meta Específica por Filial' });
const branchInput = () => within(branchForm()).getByRole('spinbutton', { name: 'Utilização dos Coletores' }) as HTMLInputElement;
afterEach(cleanup);

describe('Gerenciamento de metas', () => {
  it('explica a herança com a meta global carregada, incluindo o limite decimal', () => {
    render(<KpiGoalsManagerPanel {...props()} />);
    expect(branchInput().value).toBe('80');
    expect(within(branchForm()).getAllByText('Valor herdado: 80%')).toHaveLength(2);
    expect(within(branchForm()).getByText('Valor herdado: 0,2%')).toBeTruthy();
    fireEvent.change(branchInput(), { target: { value: '81' } });
    expect(within(branchForm()).getByText('Meta global: 80%')).toBeTruthy();
  });

  it('descarta o rascunho da filial anterior mesmo quando ambas herdam o mesmo objeto global', () => {
    const input = props();
    const view = render(<KpiGoalsManagerPanel {...input} />);
    fireEvent.change(branchInput(), { target: { value: '81' } });
    view.rerender(<KpiGoalsManagerPanel {...input} branchId="SPO" />);
    expect(branchInput().value).toBe('80');
    fireEvent.submit(branchForm());
    expect(input.onSaveBranch).toHaveBeenCalledWith('SPO', globalGoals);
  });

  it('não transporta rascunhos de uma competência para outra', () => {
    const input = props();
    const view = render(<KpiGoalsManagerPanel {...input} />);
    fireEvent.change(branchInput(), { target: { value: '81' } });
    const globalForm = screen.getByRole('form', { name: 'Meta Global' });
    fireEvent.change(within(globalForm).getByRole('spinbutton', { name: 'Performance de Entrega' }), { target: { value: '97' } });
    view.rerender(<KpiGoalsManagerPanel {...input} competencia="2026-10-01" data={{ ...input.data!, competencia: '2026-10-01' }} />);
    expect(branchInput().value).toBe('80');
    expect((within(globalForm).getByRole('spinbutton', { name: 'Performance de Entrega' }) as HTMLInputElement).value).toBe('95');
  });

  it('bloqueia escritas quando não foi possível carregar as metas, inclusive submissão programática', () => {
    const input = props({ data: undefined, error: new Error('indisponível') });
    render(<KpiGoalsManagerPanel {...input} />);
    expect(branchInput().disabled).toBe(true);
    fireEvent.submit(branchForm());
    fireEvent.submit(screen.getByRole('form', { name: 'Meta Global' }));
    expect(input.onSaveBranch).not.toHaveBeenCalled();
    expect(input.onApplyGlobal).not.toHaveBeenCalled();
  });

  it('mantém o bloqueio global por exceção e salva ou remove somente a filial escolhida', () => {
    const goals = { ...globalGoals, collector_usage: 83 };
    const input = props({ data: { competencia: '2026-09-01', global: globalGoals,
      branches: [{ branchId: 'CWB', competencia: '2026-09-01', goals, updatedAt: null, updatedBy: null }] } });
    render(<KpiGoalsManagerPanel {...input} />);
    expect((screen.getByRole('button', { name: 'Remova metas específicas' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole('form', { name: 'Meta Global' }));
    expect(input.onApplyGlobal).not.toHaveBeenCalled();
    fireEvent.submit(branchForm());
    expect(input.onSaveBranch).toHaveBeenCalledWith('CWB', goals);
    fireEvent.click(within(branchForm()).getByRole('button', { name: 'Remover Override' }));
    expect(input.onRemoveOverride).toHaveBeenCalledWith('CWB');
  });

  it('preserva os cinco valores da atualização global e normaliza a competência selecionada', () => {
    const input = props();
    render(<KpiGoalsManagerPanel {...input} />);
    const globalForm = screen.getByRole('form', { name: 'Meta Global' });
    fireEvent.change(within(globalForm).getByRole('spinbutton', { name: 'Indenização de Mercadorias' }), { target: { value: '0.15' } });
    fireEvent.submit(globalForm);
    expect(input.onApplyGlobal).toHaveBeenCalledWith({ ...globalGoals, cargo_indemnity: 0.15 });
    fireEvent.change(screen.getByLabelText('Competência das metas'), { target: { value: '2026-10' } });
    expect(input.onCompetenciaChange).toHaveBeenCalledWith('2026-10-01');
  });
});
