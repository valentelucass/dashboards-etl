import clienteAxios from '../clienteAxios';

export interface FiltroDre {
  competencia: string;
  empresa?: string;
  filial?: string;
  centro?: string;
}

export interface DimensaoDre { empresa: string | null; filial: string | null; centro: string | null }
export interface ValorReceita { classe: string | null; tipo: string | null; mes: number; ano: number }
export interface ResumoDre {
  historico: { primeiroFrete: string | null; atualizadoEm: string | null };
  valores: ValorReceita[];
}
export interface FreteDre {
  minuta: string | null; cte: string | null; data: string; filial: string;
  classe: string | null; tipo: string | null; valor: number;
}

const base = '/api/painel/dre';
export async function resumoDre(params: FiltroDre, signal?: AbortSignal) {
  return (await clienteAxios.get<ResumoDre>(base + '/resumo', { params, signal })).data;
}
export async function dimensoesDre(competencia: string, signal?: AbortSignal) {
  return (await clienteAxios.get<DimensaoDre[]>(base + '/dimensoes', { params: { competencia }, signal })).data;
}
export async function fretesDre(params: FiltroDre & {classe?: string; tipo?: string; acumulado: boolean; pagina: number}, signal?: AbortSignal) {
  return (await clienteAxios.get<{itens: FreteDre[]; temProxima: boolean}>(base + '/fretes', {params, signal})).data;
}
