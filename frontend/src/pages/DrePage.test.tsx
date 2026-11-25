// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as api from '../api/endpoints/dreServico';
import { FiltroProvider } from '../contexts/FiltroContext';
import { PageHeaderProvider } from '../contexts/PageHeaderContext';
import DrePage from './DrePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
beforeEach(() => {
  vi.spyOn(api,'custosTransporteDre').mockResolvedValue([]);
  vi.spyOn(api,'opcoesPagarDre').mockResolvedValue([]);
  vi.spyOn(api,'resumoPagarDre').mockResolvedValue({historico:{primeiraEmissao:null,atualizadoEm:null}, valores:[]});
});
function abrir(filtros = '') {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
  return render(<MemoryRouter initialEntries={['/dre?f.competenciaDre=2025-11'+filtros]} future={{v7_startTransition:true,v7_relativeSplatPath:true}}>
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

it('abre a composição de um resultado e chega ao frete sem perder o mês ou a filial', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([{empresa:'10000000',filial:'AGU',centro:null}]);
  vi.spyOn(api,'resumoDre').mockResolvedValue({historico:{primeiroFrete:'2025-01-01',atualizadoEm:'2026-01-01'},valores:[{classe:null,tipo:null,mes:15,ano:20}]});
  const fretes = vi.spyOn(api,'fretesDre').mockResolvedValue({itens:[{minuta:'12345',cte:'515',data:'2025-11-02',classe:'FTL',tipo:'Normal',filial:'AGU',valor:15}],temProxima:false});
  abrir('&f.filialDre=AGU');
  fireEvent.click(await screen.findByRole('button',{name:'RECEITA LÍQUIDA'}));
  fireEvent.click(screen.getByRole('button',{name:'Detalhar RECEITA BRUTA'}));
  expect(await screen.findByText('12345')).toBeTruthy();
  expect(fretes.mock.calls[0][0]).toMatchObject({competencia:'2025-11',filial:'AGU'});
  fireEvent.click(screen.getByRole('button',{name:'Voltar para RECEITA LÍQUIDA'}));
  fireEvent.click(screen.getByRole('button',{name:'Detalhar TOTAL IMPOSTOS'}));
  expect(screen.getByRole('button',{name:'Detalhar ICMS'})).toBeTruthy();
});

it('explica o filtro de centro de custo quando a base tem fretes sem nenhum centro preenchido', async () => {
  vi.spyOn(api, 'dimensoesDre').mockResolvedValue([{empresa:'12345678', filial:'Filial A', centro:null}]);
  vi.spyOn(api, 'resumoDre').mockResolvedValue({historico:{primeiroFrete:null, atualizadoEm:null}, valores:[]});
  abrir();
  await screen.findByRole('button', {name:'Expandir RECEITA BRUTA'});
  fireEvent.click(screen.getByRole('button', {name:/^Filtros/}));
  const centro = screen.getByRole('combobox', {name:'Centro de custo'});
  expect(centro.textContent).toContain('Sem centro informado');
  expect(centro.matches(':disabled, [aria-disabled="true"]')).toBe(true);
});

it('aplica conta e fornecedor aos valores e aos lançamentos, sem atribuir fretes ao fornecedor', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([]);
  vi.spyOn(api,'resumoDre').mockResolvedValue({historico:{primeiroFrete:'2024-01-01',atualizadoEm:'2026-01-01'},valores:[{classe:null,tipo:null,mes:9999,ano:12000}]});
  vi.mocked(api.opcoesPagarDre).mockResolvedValue([{tipo:'conta',nome:'INTERNET'},{tipo:'fornecedor',nome:'Operadora'}]);
  vi.mocked(api.resumoPagarDre).mockResolvedValue({historico:{primeiraEmissao:'2024-01-01',atualizadoEm:'2026-01-02'},valores:[{conta:'INTERNET',mes:50,ano:120}]});
  const consultar = vi.spyOn(api,'lancamentosPagarDre').mockResolvedValue({itens:[{numero:7001,documento:'F-11',filial:'ABC',centro:'Adm',fornecedor:'Operadora',conta:'INTERNET',mes:11,ano:2025,valor:50}],temProxima:false});
  abrir('&f.fornecedorDre=Operadora&f.contaContabilDre=INTERNET');
  await screen.findByText('Sem vínculo com este filtro');
  expect(screen.queryByText(/9\.999,00/)).toBeNull();
  fireEvent.change(screen.getByRole('searchbox',{name:'Buscar conta'}),{target:{value:'internet'}});
  fireEvent.click(screen.getByRole('button',{name:'INTERNET'}));
  expect(await within(screen.getByRole('region',{name:'Detalhe de INTERNET'})).findByText('F-11')).toBeTruthy();
  const linha = screen.getByRole('button',{name:'INTERNET'}).closest('tr')!;
  expect(within(linha).getByText(/-R\$\s*50,00/)).toBeTruthy();
  expect(consultar.mock.calls[0][0]).toMatchObject({conta:'INTERNET',fornecedor:'Operadora',competencia:'2025-11',acumulado:false});
});

it('mostra o subtotal recolhido, preserva-o ao expandir e abre os fretes do acumulado parcial', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([]);
  vi.spyOn(api,'resumoDre').mockResolvedValue({historico:{primeiroFrete:'2025-08-17',atualizadoEm:'2025-11-25'},valores:[{classe:null,tipo:null,mes:75,ano:230}]});
  vi.mocked(api.custosTransporteDre).mockResolvedValue([{id:'D33',mes:15,ano:70,anoParcial:true}]);
  const fretes = vi.spyOn(api,'fretesDre').mockResolvedValue({itens:[],temProxima:false});
  abrir();
  const botao = await screen.findByRole('button',{name:'Expandir CUSTO OPERACIONAL'});
  const grupo = within(botao.closest('tr')!);
  expect(grupo.getByText(/-R\$\s*15,00/)).toBeTruthy();
  fireEvent.click(botao);
  expect(grupo.getByText(/-R\$\s*70,00/)).toBeTruthy();
  expect(screen.getByRole('columnheader',{name:/histórico parcial/})).toBeTruthy();
  const receita = screen.getByRole('button',{name:'RECEITA BRUTA'});
  expect(within(receita.closest('tr')!).getByText(/R\$\s*230,00/)).toBeTruthy();
  fireEvent.click(receita);
  fireEvent.click(await screen.findByRole('button',{name:'Acumulado do ano'}));
  await waitFor(() => expect(fretes.mock.calls.at(-1)![0]).toMatchObject({competencia:'2025-11',acumulado:true}));
});

it('troca filial, centro, conta e fornecedor em sequência sem fechar os filtros ou consultar o recorte antigo', async () => {
  vi.spyOn(api,'dimensoesDre').mockResolvedValue([{empresa:'12345678',filial:'AGU',centro:null}]);
  vi.spyOn(api,'resumoDre').mockResolvedValue({historico:{primeiroFrete:'2025-01-01',atualizadoEm:'2026-01-01'},valores:[]});
  vi.mocked(api.opcoesPagarDre).mockImplementation(async f => {
    if (f.centro === 'ADM') return [{tipo:'centro',nome:'ADM'},{tipo:'conta',nome:'INTERNET'},{tipo:'fornecedor',nome:'Operadora'}];
    return [{tipo:'filial',nome:'AGU'},{tipo:'centro',nome:'ADM'}];
  });
  vi.spyOn(api,'lancamentosPagarDre').mockResolvedValue({itens:[],temProxima:false});
  abrir();
  await screen.findByRole('region',{name:'Tabela do DRE'});
  fireEvent.click(screen.getByRole('button',{name:/^Filtros/}));
  for(const [nome,valor] of [['Filial','AGU'],['Centro de custo','ADM'],['Conta contábil','INTERNET'],['Fornecedor','Operadora']]) {
    const campo = screen.getByRole('combobox',{name:nome});
    await within(campo).findByRole('option',{name:valor});
    fireEvent.change(campo,{target:{value:valor}});
  }
  await waitFor(() => expect(vi.mocked(api.resumoPagarDre).mock.calls.at(-1)?.[0]).toMatchObject({filial:'AGU',centro:'ADM',conta:'INTERNET',fornecedor:'Operadora'}));
});
