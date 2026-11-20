// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FilterBar from './FilterBar';

afterEach(cleanup);

it('exibe cada filtro uma vez ao abrir a barra e permite remover inclusive o quarto filtro', () => {
  const removerStatus = vi.fn();
  render(<FilterBar onClear={vi.fn()} activeFilters={[
    { label: 'Filial Atual', count: 1, valueLabel: 'AGU' },
    { label: 'Cliente', count: 1, onRemove: vi.fn() },
    { label: 'Minuta', count: 1, onRemove: vi.fn() },
    { label: 'Status', count: 1, onRemove: removerStatus },
  ]}><input aria-label="Número da minuta" /></FilterBar>);

  expect(screen.getByText('+1')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: /Filtros/ }));
  expect(screen.getByText('Filial Atual: AGU')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Remover filtro Filial Atual' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Limpar', exact: true })).toBeNull();
  expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Remover filtro Status' }));
  expect(removerStatus).toHaveBeenCalledOnce();
});
