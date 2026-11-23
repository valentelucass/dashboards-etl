// @vitest-environment jsdom
import { lazy, Suspense } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import DashboardPageBoundary from './DashboardPageBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('mantém a navegação e permite voltar quando o módulo de Gestão à Vista falha depois de abrir a página', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let falhar!: (error: Error) => void;
  const Tela = lazy(() => new Promise<{ default: () => null }>((_, reject) => { falhar = reject; }));
  render(<MemoryRouter initialEntries={['/gestao']} future={{ v7_startTransition:true, v7_relativeSplatPath:true }}>
    <header><Link to="/inicio">Início</Link></header>
    <DashboardPageBoundary>
      <Suspense fallback={<p>Carregando indicadores</p>}>
        <Routes>
          <Route path="/gestao" element={<Tela />} />
          <Route path="/inicio" element={<h1>Outros painéis</h1>} />
        </Routes>
      </Suspense>
    </DashboardPageBoundary>
  </MemoryRouter>);
  expect(screen.getByText('Carregando indicadores')).toBeTruthy();
  falhar(new TypeError('Failed to fetch dynamically imported module'));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByRole('button', { name:'Recarregar página' })).toBeTruthy();
  fireEvent.click(screen.getByRole('link', { name:'Início' }));
  expect(await screen.findByRole('heading', { name:'Outros painéis' })).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});
