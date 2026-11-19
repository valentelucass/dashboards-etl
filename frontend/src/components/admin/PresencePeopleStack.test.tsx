// @vitest-environment jsdom
import { useState } from 'react';
import { InternationalizationProvider } from '@astryxdesign/core/i18n';
import ptBR from '@astryxdesign/core/locales/pt-BR.generated.js';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import PresencePeopleStack from './PresencePeopleStack';
import { usePresencePage, type PessoaPresente } from './usePresencePage';

afterEach(cleanup);

function pessoas(grupo: string, quantidade: number): PessoaPresente[] {
  return Array.from({ length: quantidade }, (_, indice) => {
    const id = `${grupo}-${indice + 1}`;
    return { id, nome: `${grupo} ${indice + 1}`, email: `${id}@example.test`, ultimaAtividade: null, ultimaRotaAcessada: null };
  });
}

function Paginacao({ online, recentes, onHistory }: {
  online: PessoaPresente[];
  recentes: PessoaPresente[];
  onHistory?: (pessoa: PessoaPresente) => void;
}) {
  const onlinePage = usePresencePage(online);
  const recentesPage = usePresencePage(recentes);
  const [aberta, setAberta] = useState<string | null>(null);
  return <InternationalizationProvider locale="pt-BR" messages={{ 'pt-BR': ptBR }}>
    <section aria-label="Online"><PresencePeopleStack online pagina={onlinePage} aberta={aberta} onOpen={setAberta} onHistory={onHistory} /></section>
    <section aria-label="Recentes"><PresencePeopleStack online={false} pagina={recentesPage} aberta={aberta} onOpen={setAberta} onHistory={onHistory} /></section>
  </InternationalizationProvider>;
}

it('alcança cada pessoa em listas com mais de 42 e mantém a outra lista na página e ficha escolhidas', async () => {
  const online = pessoas('Online', 43);
  const recentes = pessoas('Recente', 48);
  const historico = vi.fn();
  render(<Paginacao online={online} recentes={recentes} onHistory={historico} />);

  const pagOnline = within(screen.getByRole('navigation', { name: 'Paginação de pessoas online' }));
  const pagRecentes = within(screen.getByRole('navigation', { name: 'Paginação de pessoas vistas recentemente' }));
  fireEvent.click(pagRecentes.getByRole('button', { name: 'Ir para a última página' }));
  expect(pagRecentes.getByText('Página 10 de 10')).toBeTruthy();
  const ultimaPessoa = screen.getByRole('button', { name: 'Recente 48' });
  fireEvent.click(ultimaPessoa);
  fireEvent.click(pagOnline.getByRole('button', { name: 'Ir para a última página' }));
  expect(pagOnline.getByText('Página 9 de 9')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Online 43' })).toBeTruthy();
  expect(ultimaPessoa.getAttribute('aria-expanded')).toBe('true');
  const ficha = ultimaPessoa.closest<HTMLElement>('.admin-presence-sheet')!;
  fireEvent.click(within(ficha).getByRole('button', { name: 'Ver acessos de hoje' }));
  expect(historico).toHaveBeenCalledWith(recentes[47]);

  fireEvent.click(pagOnline.getByRole('button', { name: 'Ir para a primeira página' }));
  const lidos: string[] = [];
  for (let pagina = 1; pagina <= 9; pagina++) {
    await pagOnline.findByText(`Página ${pagina} de 9`);
    const lista = within(screen.getByRole('region', { name: 'Online' }));
    lidos.push(...lista.getAllByText(/^Online \d+$/).map(item => item.textContent!));
    if (pagina < 9) fireEvent.click(pagOnline.getByRole('button', { name: 'Ir para a próxima página' }));
  }
  expect(lidos).toEqual(online.map(pessoa => pessoa.nome));
  expect(pagRecentes.getByText('Página 10 de 10')).toBeTruthy();
});

it('mantém a página durante um pulso e recua quando a última página deixa de existir', async () => {
  const online = pessoas('Online', 43);
  const recentes = pessoas('Recente', 5);
  const tela = render(<Paginacao online={online} recentes={recentes} />);
  const pagOnline = within(screen.getByRole('navigation', { name: 'Paginação de pessoas online' }));
  expect(screen.queryByRole('navigation', { name: 'Paginação de pessoas vistas recentemente' })).toBeNull();
  fireEvent.click(pagOnline.getByRole('button', { name: 'Ir para a última página' }));
  tela.rerender(<Paginacao online={[...online].reverse()} recentes={recentes} />);
  expect(pagOnline.getByText('Página 9 de 9')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Online 1' })).toBeTruthy();

  tela.rerender(<Paginacao online={online.slice(0, 7)} recentes={recentes} />);
  expect(await pagOnline.findByText('Página 2 de 2')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Online 7' })).toBeTruthy();
  tela.rerender(<Paginacao online={online} recentes={recentes} />);
  expect(pagOnline.getByText('Página 2 de 9')).toBeTruthy();
  tela.rerender(<Paginacao online={[]} recentes={recentes} />);
  expect(screen.queryByRole('navigation')).toBeNull();
  tela.rerender(<Paginacao online={online} recentes={recentes} />);
  expect(screen.getByRole('button', { name: 'Online 1' })).toBeTruthy();
});
