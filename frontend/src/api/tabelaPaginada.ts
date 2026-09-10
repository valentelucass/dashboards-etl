import clienteAxios from './clienteAxios';
import { montarQueryParams } from './endpoints/queryParams';
import { aplicarFiltrosTabelaParams } from './tableFilters';
import type { FiltroBase, PaginacaoResponse } from '../types/common';
import type { TableApiFilters } from '../types/tableFilters';

type SpringPageResponse<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

type PaginacaoBackendResponse<T> = Partial<PaginacaoResponse<T>> & SpringPageResponse<T>;

function primeiroNumeroValido(...valores: Array<number | undefined>): number | undefined {
  return valores.find((valor) => typeof valor === 'number' && Number.isFinite(valor));
}

export function normalizarPaginacaoResponse<T>(
  data: PaginacaoBackendResponse<T> | null | undefined,
  paginaSolicitada: number,
  tamanhoPaginaSolicitado: number,
): PaginacaoResponse<T> {
  const conteudo = Array.isArray(data?.conteudo)
    ? data.conteudo
    : Array.isArray(data?.content)
      ? data.content
      : [];
  const tamanhoPagina = primeiroNumeroValido(data?.tamanhoPagina, data?.size, tamanhoPaginaSolicitado) ?? tamanhoPaginaSolicitado;
  const totalElementos = primeiroNumeroValido(data?.totalElementos, data?.totalElements, conteudo.length) ?? conteudo.length;
  const paginaSpring = typeof data?.number === 'number' ? data.number + 1 : undefined;
  const paginaAtual = primeiroNumeroValido(data?.paginaAtual, paginaSpring, paginaSolicitada) ?? paginaSolicitada;
  const totalPaginasCalculado = tamanhoPagina > 0 ? Math.ceil(totalElementos / tamanhoPagina) : 0;
  const totalPaginas = primeiroNumeroValido(data?.totalPaginas, data?.totalPages, totalPaginasCalculado) ?? totalPaginasCalculado;

  return {
    conteudo,
    totalElementos,
    totalPaginas,
    paginaAtual,
    tamanhoPagina,
  };
}

export async function buscarTabelaPaginada<T, F extends FiltroBase>(
  url: string,
  filtro: F,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
  signal?: AbortSignal,
): Promise<PaginacaoResponse<T>> {
  const params = montarQueryParams(filtro);
  aplicarFiltrosTabelaParams(params, filtrosTabela);
  params.set('page', String(Math.max(0, pagina - 1)));
  params.set('size', String(tamanhoPagina));
  params.set('pagina', String(pagina));
  params.set('tamanhoPagina', String(tamanhoPagina));
  if (sortField && sortDirection) {
    params.set('sort', sortField);
    params.set('order', sortDirection);
  }

  const { data } = await clienteAxios.get<PaginacaoBackendResponse<T>>(url, { params, signal });
  return normalizarPaginacaoResponse(data, pagina, tamanhoPagina);
}
