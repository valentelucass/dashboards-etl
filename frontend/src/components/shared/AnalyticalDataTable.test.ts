import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import AnalyticalDataTable, { type ColunaTabelaAnalitica } from './AnalyticalDataTable';

type Row = { id: number; status: string; cliente: string; valor: number; acao?: string };

const colunas: ColunaTabelaAnalitica<Row>[] = [
  { chave: 'id', label: 'ID', fixo: true, filtroTabela: 'codigo' },
  { chave: 'status', label: 'Status', filtroTabela: 'status' },
  { chave: 'cliente', label: 'Cliente', filtroTabela: 'razaoSocial' },
  { chave: 'valor', label: 'Valor', tooltip: 'Valor consolidado do registro.' },
];

function renderTabela(overrides = {}) {
  return renderToStaticMarkup(
    createElement(AnalyticalDataTable<Row>, {
      titulo: 'Fretes Analiticos',
      dados: [{ id: 1, status: 'Faturado', cliente: 'ACME', valor: 100 }],
      colunas,
      chaveLinha: 'id',
      filtros: {},
      hiddenActiveCount: 0,
      hasAnyFilter: false,
      onTextFilterChange: () => undefined,
      onMultiFilterChange: () => undefined,
      onColumnFilterChange: () => undefined,
      onClearFilters: () => undefined,
      statusOptions: ['Faturado'],
      totalRegistros: 1,
      paginaAtual: 1,
      tamanhoPagina: 10,
      onPaginaChange: () => undefined,
      onTamanhoPaginaChange: () => undefined,
      ...overrides,
    }),
  );
}

describe('AnalyticalDataTable', () => {
  it('renderiza header com busca, filtros, limpar e linhas', () => {
    const html = renderTabela();

    expect(html).toContain('Fretes Analiticos');
    expect(html).toContain('Buscar na tabela...');
    expect(html).toContain('Filtros');
    expect(html).toContain('Limpar');
    expect(html).toContain('Linhas');
  });

  it('renderiza segunda linha no thead para filtros por coluna', () => {
    const html = renderTabela();

    const header = html.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/)?.[1];
    expect(header).toBeDefined();
    expect((header?.match(/<tr\b/g) ?? []).length).toBe(2);
    expect(html).toContain('placeholder="ID"');
    expect(html).toContain('placeholder="Cliente"');
    expect(html).toContain('placeholder="Valor"');
    expect(html).toContain('Status');
  });

  it('usa tooltip acessivel sem atributo title nativo', () => {
    const html = renderTabela();

    expect(html).toContain('aria-label="Detalhes da coluna Valor"');
    expect(html).not.toContain('title="Valor consolidado do registro."');
  });

  it('nao conta busca global no badge de filtros', () => {
    const html = renderTabela({
      filtros: { busca: 'ACME' },
      hiddenActiveCount: 0,
      hasAnyFilter: true,
    });

    expect(html).not.toContain('filtros ativos');
  });

  it('exibe badge para filtros avancados e por coluna', () => {
    const html = renderTabela({
      filtros: { columnFilters: { valor: '100' } },
      hiddenActiveCount: 1,
      hasAnyFilter: true,
    });

    expect(html).toContain('1 filtros ativos');
  });

  it('permite scroll lateral com celulas completas', () => {
    const html = renderTabela({
      dados: [{ id: 1, status: 'Faturado', cliente: 'Cliente com nome muito comprido', valor: 100 }],
    });

    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('w-max');
    expect(html).toContain('min-w-0');
    expect(html).toContain('whitespace-nowrap');
    expect(html).toContain('Cliente com nome muito comprido');
    expect(html).not.toContain('table-fixed');
    expect(html).not.toContain('min-w-0 truncate');
  });

  it('exibe erro sem cair no estado vazio', () => {
    const html = renderTabela({
      dados: [],
      totalRegistros: undefined,
      error: new Error('Falha de comunicação'),
    });

    expect(html).toContain('Falha de comunicação');
    expect(html).not.toContain('Nenhum registro encontrado.');
  });

  it('sinaliza atualização paginada e bloqueia os controles temporariamente', () => {
    const html = renderTabela({ isFetching: true });

    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Atualizando...');
    expect(html).toMatch(/role="combobox"[^>]*aria-disabled="true"/);
    expect(html).toContain('role="status"');
  });

  it('exibe somente a ordenacao remota controlada', () => {
    const html = renderTabela({
      sortField: 'valor',
      sortDirection: 'desc',
      onSortChange: () => undefined,
    });

    expect(html).toContain('cursor-pointer');
    expect(html).toContain('↓');
  });

  it('permite coluna de acao sem filtro por coluna', () => {
    const html = renderTabela({
      colunas: [
        ...colunas,
        { chave: 'acao', label: 'Acao', ordenavel: false, filtravel: false },
      ],
    });

    expect(html).toContain('Acao');
    expect(html).not.toContain('placeholder="Acao"');
  });
});
