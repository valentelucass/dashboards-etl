import TableLoading from './TableLoading';
import DashboardSelector from "./DashboardSelector";
import DashboardButton from "./DashboardButton";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow, TableText } from './DashboardTable';
import { Card } from '@astryxdesign/core/Card';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import TableHeaderTooltip from './TableHeaderTooltip';
import { calcularLarguraMinimaTabela, getColumnSizingStyle } from './tableLayout';
import MensagemErro from '../ui/MensagemErro';
import { getApiErrorMessage, getTipoErro } from '../../utils/apiError';

type ColunaAlinhamento = 'left' | 'center' | 'right';

export interface ColunaTabela<T> {
  chave: keyof T & string;
  label: string;
  formato?: (valor: T[keyof T], row: T) => string | ReactNode;
  largura?: string;
  alinhamento?: ColunaAlinhamento;
  fixo?: boolean;
  ordenavel?: boolean;
  tooltip?: string;
}

type ItemPaginacao = number | 'ellipsis-start' | 'ellipsis-end';

function formatarInteiro(valor: number): string {
  return valor.toLocaleString('pt-BR');
}

function getTextAlignClass(alinhamento: ColunaAlinhamento = 'left') {
  if (alinhamento === 'right') return 'text-right';
  if (alinhamento === 'center') return 'text-center';
  return 'text-left';
}

function getHeaderJustifyClass(alinhamento: ColunaAlinhamento = 'left') {
  if (alinhamento === 'right') return 'justify-end';
  if (alinhamento === 'center') return 'justify-center';
  return 'justify-start';
}

interface DataTableProps<T> {
  dados: T[];
  colunas: ColunaTabela<T>[];
  chaveLinha: keyof T & string;
  isLoading?: boolean;
  titulo?: string;
  acoesCabecalho?: ReactNode;
  mostrarCabecalho?: boolean;
  paginaInicial?: number;
  tamanhoPaginaInicial?: number;
  totalRegistros?: number;
  paginaAtual?: number;
  tamanhoPagina?: number;
  onPaginaChange?: (pagina: number) => void;
  onTamanhoPaginaChange?: (tamanhoPagina: number) => void;
  error?: unknown;
  errorFallbackMessage?: string;
  semPaginacao?: boolean;
}

export default function DataTable<T>({
  dados,
  colunas,
  chaveLinha,
  isLoading,
  titulo,
  acoesCabecalho,
  mostrarCabecalho = true,
  paginaInicial = 1,
  tamanhoPaginaInicial = 10,
  totalRegistros,
  paginaAtual: paginaAtualControlada,
  tamanhoPagina: tamanhoPaginaControlado,
  onPaginaChange,
  onTamanhoPaginaChange,
  error,
  errorFallbackMessage = 'Erro ao carregar registros.',
  semPaginacao = false,
}: DataTableProps<T>) {
  const [ordenarPor, setOrdenarPor] = useState<string | null>(null);
  const [direcao, setDirecao] = useState<'asc' | 'desc'>('asc');
  const [paginaAtualInterna, setPaginaAtualInterna] = useState(paginaInicial);
  const [tamanhoPaginaInterno, setTamanhoPaginaInterno] = useState(tamanhoPaginaInicial);
  const colunaOrdenada = colunas.find((coluna) => coluna.chave === ordenarPor);
  const paginacaoAtiva = !semPaginacao;
  const paginaAtual = paginaAtualControlada ?? paginaAtualInterna;
  const tamanhoPagina = tamanhoPaginaControlado ?? tamanhoPaginaInterno;
  const paginacaoRemota = paginacaoAtiva && Boolean(onPaginaChange || onTamanhoPaginaChange);

  function alterarPagina(proximaPagina: number) {
    if (onPaginaChange) {
      onPaginaChange(proximaPagina);
      return;
    }
    setPaginaAtualInterna(proximaPagina);
  }

  function alterarTamanhoPagina(proximoTamanho: number) {
    const primeiroRegistroAtual = dadosPaginados.length === 0 ? 1 : inicio + 1;
    const totalPaginasNovo = Math.max(1, Math.ceil(totalBasePaginacao / proximoTamanho));
    const proximaPagina = Math.min(
      totalPaginasNovo,
      Math.max(1, Math.ceil(primeiroRegistroAtual / proximoTamanho)),
    );

    if (onTamanhoPaginaChange) {
      onTamanhoPaginaChange(proximoTamanho);
    } else {
      setTamanhoPaginaInterno(proximoTamanho);
    }
    alterarPagina(proximaPagina);
  }

  function handleSort(chave: string, ordenavel = true) {
    if (!ordenavel) {
      return;
    }

    if (ordenarPor === chave) {
      setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrdenarPor(chave);
      setDirecao('asc');
    }
    alterarPagina(1);
  }

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor || !colunaOrdenada || colunaOrdenada.ordenavel === false) {
      return dados;
    }

    return [...dados].sort((a, b) => {
      const va = a[ordenarPor as keyof T];
      const vb = b[ordenarPor as keyof T];

      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;

      const valorA = typeof va === 'number' ? va : String(va).toLowerCase();
      const valorB = typeof vb === 'number' ? vb : String(vb).toLowerCase();

      if (valorA < valorB) return direcao === 'asc' ? -1 : 1;
      if (valorA > valorB) return direcao === 'asc' ? 1 : -1;
      return 0;
    });
  }, [colunaOrdenada, dados, direcao, ordenarPor]);

  const totalReal = totalRegistros ?? dados.length;
  const hasError = Boolean(error);
  const totalBasePaginacao = paginacaoAtiva ? (paginacaoRemota ? totalReal : dadosOrdenados.length) : dadosOrdenados.length;
  const totalPaginas = paginacaoAtiva ? Math.max(1, Math.ceil(totalBasePaginacao / tamanhoPagina)) : 1;
  const paginaSegura = paginacaoAtiva ? Math.min(paginaAtual, totalPaginas) : 1;
  const inicio = paginacaoAtiva ? (paginaSegura - 1) * tamanhoPagina : 0;
  const dadosPaginados = paginacaoAtiva
    ? (paginacaoRemota ? dadosOrdenados : dadosOrdenados.slice(inicio, inicio + tamanhoPagina))
    : dadosOrdenados;
  const fimExibido = paginacaoAtiva
    ? paginacaoRemota
      ? Math.min(inicio + dadosPaginados.length, totalReal)
      : Math.min(inicio + dadosPaginados.length, dados.length)
    : dadosOrdenados.length;
  const resumoRegistros = hasError
    ? 'Falha ao carregar registros'
    : paginacaoRemota
    ? `${formatarInteiro(totalReal)} registros encontrados`
    : totalReal > dados.length
    ? `${formatarInteiro(dados.length)} de ${formatarInteiro(totalReal)} registros carregados`
    : `${formatarInteiro(dados.length)} registros carregados`;
  const larguraMinimaTabela = calcularLarguraMinimaTabela(colunas);
  const itensPaginacao = useMemo<ItemPaginacao[]>(() => {
    if (totalPaginas <= 7) {
      return Array.from({ length: totalPaginas }, (_, index) => index + 1);
    }

    if (paginaSegura <= 4) {
      return [1, 2, 3, 4, 5, 'ellipsis-end', totalPaginas];
    }

    if (paginaSegura >= totalPaginas - 3) {
      return [1, 'ellipsis-start', totalPaginas - 4, totalPaginas - 3, totalPaginas - 2, totalPaginas - 1, totalPaginas];
    }

    return [1, 'ellipsis-start', paginaSegura - 2, paginaSegura - 1, paginaSegura, paginaSegura + 1, paginaSegura + 2, 'ellipsis-end', totalPaginas];
  }, [paginaSegura, totalPaginas]);

  if (isLoading) {
    return <TableLoading title={titulo} columns={colunas} pageSize={tamanhoPagina} header={mostrarCabecalho} controls={Boolean(acoesCabecalho) || paginacaoAtiva} pager={paginacaoAtiva} />;
  }

  return (
    <Card padding={0}
      className="dashboard-table-card overflow-hidden rounded-[20px] border shadow-sm"
      style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}
    >
      {mostrarCabecalho && (
        <div
          className="flex min-h-[68px] flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {titulo ?? 'Tabela analitica'}
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {resumoRegistros}
            </p>
          </div>
          {(acoesCabecalho || paginacaoAtiva) && (
            <div role="group" aria-label={`Controles de ${titulo ?? 'tabela'}`} className="flex max-w-full flex-wrap items-center justify-end gap-2">
              {acoesCabecalho}
              {paginacaoAtiva && (
                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Linhas
                  <DashboardSelector label="Linhas"
                    value={tamanhoPagina}
                    onValueChange={selectedValue => alterarTamanhoPagina(Number(selectedValue))}
                    className="rounded-lg border px-2 py-1 text-xs"
                    style={{
                      backgroundColor: 'var(--color-bg)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {[10, 20, 50, 100].map((valor) => (
                      <option key={valor} value={valor}>
                        {valor}
                      </option>
                    ))}
                  </DashboardSelector>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <Table density="compact" className="w-max text-sm" style={{ minWidth: `max(100%, ${larguraMinimaTabela}px)` }}>
          <TableHeader>
            <TableRow isHeaderRow className="border-b" style={{ backgroundColor: 'var(--color-bg)', borderColor: 'var(--color-border)' }}>
              {colunas.map((col) => (
                <TableHeaderCell
                  key={col.chave}
                  onClick={() => handleSort(col.chave, col.ordenavel !== false)}
                  className={`px-3 py-2.5 ${getTextAlignClass(col.alinhamento)} text-xs font-medium uppercase tracking-wider whitespace-nowrap select-none ${
                    col.ordenavel === false ? 'cursor-default' : 'cursor-pointer'
                  } ${
                    col.fixo ? 'sticky left-0 z-10' : ''
                  }`}
                  style={{
                    color: 'var(--color-text-muted)',
                    backgroundColor: col.fixo ? 'var(--color-bg)' : undefined,
                    ...getColumnSizingStyle(col.largura),
                  }}
                >
                  <span className={`flex w-full items-center gap-1 ${getHeaderJustifyClass(col.alinhamento)}`}>
                    <TableText>{col.label}</TableText>
                    {col.tooltip ? <TableHeaderTooltip label={col.label} content={col.tooltip} /> : null}
                    {col.ordenavel !== false && ordenarPor === col.chave && (
                      <span className="shrink-0">{direcao === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </span>
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {!hasError && dadosPaginados.map((row) => (
              <TableRow
                key={String(row[chaveLinha])}
                className="border-b transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = ''; }}
              >
                {colunas.map((col) => {
                  const valor = row[col.chave];
                  const conteudo = col.formato ? col.formato(valor, row) : String(valor ?? '—');

                  return (
                    <TableCell
                      key={col.chave}
                      className={`px-3 py-2 ${getTextAlignClass(col.alinhamento)} align-middle whitespace-nowrap ${
                        col.fixo ? 'sticky left-0' : ''
                      }`}
                      style={{
                        color: 'var(--color-text)',
                        backgroundColor: col.fixo ? 'var(--color-card)' : undefined,
                        fontWeight: col.fixo ? 500 : undefined,
                        ...getColumnSizingStyle(col.largura),
                      }}
                    >
                      {conteudo}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {hasError ? (
        <div className="px-3 py-6">
          <MensagemErro mensagem={getApiErrorMessage(error, errorFallbackMessage)} tipo={getTipoErro(error)} />
        </div>
      ) : dadosPaginados.length === 0 && (
        <p role="status" className="px-3 py-8 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Nenhum registro encontrado.
        </p>
      )}

      {!hasError && paginacaoAtiva && (
        <div
          className="dashboard-table-footer flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
        >
          <span>
            Mostrando {formatarInteiro(dadosPaginados.length === 0 ? 0 : inicio + 1)} a{' '}
            {formatarInteiro(fimExibido)} de {formatarInteiro(paginacaoRemota ? totalReal : dados.length)}
          </span>
          <div className="dashboard-table-pager flex flex-wrap items-center justify-end gap-2">
            <DashboardButton
              type="button"
              onClick={() => alterarPagina(Math.max(1, paginaSegura - 1))}
              disabled={paginaSegura === 1}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Anterior
            </DashboardButton>
            <div className="dashboard-table-pages flex flex-wrap items-center justify-center gap-1" aria-label="Páginas da tabela">
              {itensPaginacao.map((item) => {
                if (typeof item !== 'number') {
                  return (
                    <span
                      key={item}
                      className="px-1.5 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-hidden="true"
                    >
                      ...
                    </span>
                  );
                }

                const ativo = item === paginaSegura;
                return (
                  <DashboardButton
                    key={item}
                    type="button"
                    onClick={() => alterarPagina(item)}
                    aria-current={ativo ? 'page' : undefined}
                    className="min-w-8 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed"
                    style={
                      ativo
                        ? {
                            backgroundColor: 'var(--color-primary)',
                            borderColor: 'var(--color-primary)',
                            color: 'white',
                          }
                        : {
                            borderColor: 'var(--color-border)',
                            color: 'var(--color-text)',
                          }
                    }
                  >
                    {item}
                  </DashboardButton>
                );
              })}
            </div>
            <span className="min-w-[92px] text-center">
              Pagina {paginaSegura} de {totalPaginas}
            </span>
            <DashboardButton
              type="button"
              onClick={() => alterarPagina(Math.min(totalPaginas, paginaSegura + 1))}
              disabled={paginaSegura === totalPaginas}
              className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            >
              Proxima
            </DashboardButton>
          </div>
        </div>
      )}
    </Card>
  );
}
