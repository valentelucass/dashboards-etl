import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DataTable from './DataTable';

describe('DataTable', () => {
  it('exibe total real quando maior que linhas carregadas', () => {
    type Row = { id: number; nome: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [{ id: 1, nome: 'A' }, { id: 2, nome: 'B' }],
        colunas: [{ chave: 'nome', label: 'Nome' }],
        chaveLinha: 'id',
        totalRegistros: 4944,
      }),
    );

    expect(html).toContain('2 de 4.944 registros carregados');
  });

  it('usa total real no rodape quando a paginacao e remota', () => {
    type Row = { id: number; nome: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [{ id: 11, nome: 'K' }, { id: 12, nome: 'L' }],
        colunas: [{ chave: 'nome', label: 'Nome' }],
        chaveLinha: 'id',
        totalRegistros: 4944,
        paginaAtual: 2,
        tamanhoPagina: 10,
        onPaginaChange: () => undefined,
      }),
    );

    expect(html).toContain('4.944 registros encontrados');
    expect(html).toContain('Mostrando 11 a 12 de 4.944');
  });

  it('mostra atalhos numericos de pagina com reticencias', () => {
    type Row = { id: number; nome: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [{ id: 91, nome: 'A' }],
        colunas: [{ chave: 'nome', label: 'Nome' }],
        chaveLinha: 'id',
        totalRegistros: 5040,
        paginaAtual: 10,
        tamanhoPagina: 10,
        onPaginaChange: () => undefined,
      }),
    );

    expect(html).toContain('Pagina 10 de 504');
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('...');
    expect(html).toContain('504');
  });

  it('mantém o texto inteiro na célula com reticências e permite rolagem horizontal', () => {
    type Row = { id: number; cliente: string; documento: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [{ id: 1, cliente: 'Cliente com nome muito comprido', documento: 'Documento longo' }],
        colunas: [
          { chave: 'cliente', label: 'Cliente', largura: '160px' },
          { chave: 'documento', label: 'Documento' },
        ],
        chaveLinha: 'id',
      }),
    );

    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('w-max');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toMatch(/<span\b[^>]*\bdashboard-cell-text\b[^>]*>Cliente com nome muito comprido<\/span>/);
  });

  it('usa tooltip acessivel sem atributo title nativo', () => {
    type Row = { id: number; nome: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [{ id: 1, nome: 'A' }],
        colunas: [{ chave: 'nome', label: 'Nome', tooltip: 'Nome completo do cliente.' }],
        chaveLinha: 'id',
      }),
    );

    expect(html).toContain('aria-label="Detalhes da coluna Nome"');
    expect(html).not.toContain('title="Nome completo do cliente."');
  });

  it('exibe erro sem cair no estado vazio', () => {
    type Row = { id: number; nome: string };
    const Tabela = DataTable<Row>;
    const html = renderToStaticMarkup(
      createElement(Tabela, {
        titulo: 'Fretes',
        dados: [],
        colunas: [{ chave: 'nome', label: 'Nome' }],
        chaveLinha: 'id',
        error: new Error('Falha de comunicação'),
      }),
    );

    expect(html).toContain('Falha de comunicação');
    expect(html).not.toContain('Nenhum registro encontrado.');
  });
});
