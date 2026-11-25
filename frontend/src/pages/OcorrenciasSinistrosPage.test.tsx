// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import * as api from '../api/endpoints/ocorrenciasSinistros';
import OcorrenciasSinistrosPage from './OcorrenciasSinistrosPage';

vi.mock('../contexts/FiltroContext', () => ({
  useFiltro: () => ({ dataInicio: '2026-11-01', dataFim: '2026-11-25' }),
}));
vi.mock('../contexts/PageHeaderContext', () => ({ usePageHeader: () => undefined }));
vi.mock('../hooks/usePermissions', () => ({ usePermissions: () => ({ canAccess: () => false }) }));
vi.mock('../components/shared/FilterBar', () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('permite consultar a tabela enquanto os indicadores ainda estão carregando', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const periodo = ['ocorrencias-e-sinistros', '2026-11-01', '2026-11-25'];
  vi.spyOn(api, 'lerIndicadores').mockImplementation(() => new Promise(() => {}));
  vi.spyOn(api, 'lerRelacaoCompleta').mockResolvedValue({
    total: 0,
    mediaDias: null,
    encerrados: 0,
    prazos: [],
    linhas: [],
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <OcorrenciasSinistrosPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('region', { name: 'Dados da relação de sinistros' })).toBeTruthy();
  expect(
    screen.getByRole('status', { name: 'Carregando indicadores de ocorrências e sinistros' }),
  ).toBeTruthy();
  expect(screen.queryByRole('status', { name: 'Carregando Relação de sinistros' })).toBeNull();
  expect(client.getQueryState([...periodo, 'indicadores'])?.fetchStatus).toBe('fetching');
  await act(() => client.cancelQueries());
});
