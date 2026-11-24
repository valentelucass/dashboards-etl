// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import * as api from '../api/endpoints/dreServico';
import { FiltroProvider } from '../contexts/FiltroContext';
import { PageHeaderProvider } from '../contexts/PageHeaderContext';
import DrePage from './DrePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function abrir() {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  return render(<MemoryRouter initialEntries={['/dre?f.competenciaDre=2025-11']} future={{v7_startTransition:true,v7_relativeSplatPath:true}}>
    <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><FiltroProvider><PageHeaderProvider>
      <DrePage/>
    </PageHeaderProvider></FiltroProvider></QueryClientProvider>
  </MemoryRouter>);
}
it('expande as contas, mostra lançamentos da família selecionada e troca a competência sem reaproveitar os números da anterior', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([{empresa:'12345678', filial:'TESTE', centro:'Operação'}]);
  const resumo = vi.spyOn(api,'resumoDre').mockImplementation(async f => ({
    historico:{primeiroFrete:'2024-01-01',atualizadoEm:'2026-01-31T12:00:00'},
    valores:[{classe:null,tipo:null,mes:f.competencia === '2025-11' ? 150 : 90,ano:999}],
  }));
  const fretes = vi.spyOn(api,'fretesDre').mockResolvedValue({itens:[{minuta:'10009',cte:'123',data:'2025-11-07',classe:'FTL',tipo:'Normal',filial:'TESTE',valor:150}],temProxima:false});
  abrir();
  await screen.findByRole('button',{name:'Expandir RECEITA BRUTA'});
  expect(screen.queryByRole('button',{name:'FTL'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Expandir RECEITA BRUTA'}));
  fireEvent.click(screen.getByRole('button',{name:'FTL'}));
  expect(await screen.findByText('10009')).toBeTruthy();
  expect(fretes.mock.calls[0][0]).toMatchObject({competencia:'2025-11',classe:'FTL',pagina:0,acumulado:false});
  const tabela = screen.getByRole('region',{name:'Tabela do DRE'});
  expect(within(tabela).getAllByText('R$ 150,00').length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole('button',{name:/^Filtros/}));
  expect(screen.getByRole('combobox',{name:'Filial'})).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Competência'),{target:{value:'2025-10'}});
  await waitFor(() => expect(resumo.mock.calls.at(-1)![0].competencia).toBe('2025-10'));
  await screen.findAllByText('R$ 90,00');
  expect(screen.queryByText('10009')).toBeNull();
});
it('mantém o erro de consulta explícito, sem publicar números zerados', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([]);
  vi.spyOn(api,'resumoDre').mockRejectedValue(new Error('indisponível'));
  abrir();
  expect((await screen.findByRole('alert')).textContent).toContain('Falha ao carregar o DRE');
  expect(screen.queryByText('R$ 0,00')).toBeNull();
});
