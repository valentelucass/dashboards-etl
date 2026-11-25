import clienteAxios from '../clienteAxios';

export interface FiltroDre {
  competencia: string;
  empresa?: string;
  filial?: string;
  centro?: string;
  conta?: string;
  fornecedor?: string;
}

export interface DimensaoDre { empresa: string | null; filial: string | null; centro: string | null }
export interface ValorReceita { classe: string | null; tipo: string | null; mes: number; ano: number }
export interface ResumoDre {
  historico: { primeiroFrete: string | null; atualizadoEm: string | null };
  valores: ValorReceita[];
  /** Valores orçados com o sinal contábil, quando disponibilizados por Custos. */
  orcamento?: Array<{contaId: string; mes: number | null; ano: number | null}>;
}
export interface FreteDre {
  minuta: string | null; cte: string | null; data: string; filial: string;
  classe: string | null; tipo: string | null; valor: number;
}

export interface ResumoPagarDre {
  historico: { primeiraEmissao: string | null; atualizadoEm: string | null };
  valores: Array<{conta: string; linhaDre?: string | null; mes: number | null; ano: number | null; anoParcial?: boolean}>;
}
export interface LancamentoPagarDre {
  numero: number; documento: string | null; filial: string; centro: string | null; fornecedor: string | null;
  conta: string | null; mes: number; ano: number; valor: number | null; ordem?: number;
}
export type OpcaoPagarDre = {tipo: 'filial' | 'centro' | 'conta' | 'fornecedor'; nome: string};
export type CustoTransporteDre = {id: string; mes: number | null; ano: number | null; mesParcial?: boolean; anoParcial?: boolean};
export type DocumentoTransporteDre = {documento: string; data: string; filial: string | null; responsavel: string | null; valor: number | null};

const base = '/api/painel/dre';
export async function custosTransporteDre(params: FiltroDre, signal?: AbortSignal) {
  return (await clienteAxios.get<CustoTransporteDre[]>(base + '/transporte/resumo', {params, signal})).data;
}
export async function documentosTransporteDre(params: FiltroDre & {linha: string; acumulado: boolean; pagina: number}, signal?: AbortSignal) {
  return (await clienteAxios.get<{itens: DocumentoTransporteDre[]; temProxima: boolean}>(base + '/transporte/lancamentos', {params, signal})).data;
}
export async function opcoesPagarDre(params: FiltroDre, signal?: AbortSignal) {
  return (await clienteAxios.get<OpcaoPagarDre[]>(base + '/contas-a-pagar/dimensoes', {params, signal})).data;
}
export async function resumoPagarDre(params: FiltroDre, signal?: AbortSignal) {
  return (await clienteAxios.get<ResumoPagarDre>(base + '/contas-a-pagar/resumo', {params, signal})).data;
}
export async function lancamentosPagarDre(params: FiltroDre & {linha?: string; acumulado: boolean; pagina: number}, signal?: AbortSignal) {
  return (await clienteAxios.get<{itens: LancamentoPagarDre[]; temProxima: boolean}>(base + '/contas-a-pagar/lancamentos', {params, signal})).data;
}
export async function resumoDre(params: FiltroDre, signal?: AbortSignal) {
  return (await clienteAxios.get<ResumoDre>(base + '/resumo', { params, signal })).data;
}
export async function dimensoesDre(competencia: string, signal?: AbortSignal) {
  return (await clienteAxios.get<DimensaoDre[]>(base + '/dimensoes', { params: { competencia }, signal })).data;
}
export async function fretesDre(params: FiltroDre & {classe?: string; tipo?: string; acumulado: boolean; pagina: number}, signal?: AbortSignal) {
  return (await clienteAxios.get<{itens: FreteDre[]; temProxima: boolean}>(base + '/fretes', {params, signal})).data;
}
