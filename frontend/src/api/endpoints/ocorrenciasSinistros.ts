import clienteAxios from '../clienteAxios';

export const dominioSinistros = 'ocorrencias-e-sinistros';
const base = '/api/painel/' + dominioSinistros;
export interface Periodo {
  dataInicio: string;
  dataFim: string;
}
export interface Grupo {
  grupo: string;
  quantidade: number;
  notas: number;
}
export interface Tipo extends Grupo {
  codigo: number | null;
  descricao: string;
}
export interface Indicadores {
  dias: number;
  diasOcorrencias: number;
  diasFretes: number;
  diasSinistros: number;
  minutas: number;
  comOcorrencia: number;
  eventosDasMinutas: number;
  notas: number;
  emTratativa: number;
  comPrazo: number;
  noPrazo: number;
  minutasComSinistro: number;
  tipos: Tipo[];
  grupos: Grupo[];
  evolucao: { dia: string; total: number; afetadas: number }[];
}
export const statusCorretora = ['Pendente', 'Em Andamento', 'Finalizado'] as const;
export interface Acompanhamento {
  statusCorretora: (typeof statusCorretora)[number];
  franquia: number | null;
  salvados: number | null;
  revisao: number;
}
export interface Sinistro extends Acompanhamento {
  numero: number;
  ocorrido: string | null;
  abertura: string | null;
  finalizacao: string | null;
  status: string;
  cliente: string | null;
  minutas: string | null;
  notas: string | null;
  valorNf: number | null;
  seguradora: string | null;
  processo: string | null;
  prejuizo: number | null;
  aReceber: number | null;
  sinistralidade: number | null;
  sinistralidadeReal: number | null;
  saldoParcial: boolean;
}
export interface Relacao {
  total: number;
  mediaDias: number | null;
  encerrados: number;
  prazos: { dia: string; media: number }[];
  linhas: Sinistro[];
}
export interface Apolice {
  id?: number;
  numero: string;
  inicio: string;
  fim: string;
  valorSegurado: number;
  revisao: number;
}
export async function lerIndicadores(periodo: Periodo, signal?: AbortSignal) {
  return (await clienteAxios.get<Indicadores>(base + '/indicadores', { params: periodo, signal })).data;
}
export async function lerSinistros(periodo: Periodo, pagina: number, signal?: AbortSignal, tamanho = 25) {
  return (
    await clienteAxios.get<Relacao>(base + '/sinistros', { params: { ...periodo, pagina, tamanho }, signal })
  ).data;
}
export async function lerRelacaoCompleta(periodo: Periodo, signal?: AbortSignal): Promise<Relacao> {
  const tamanho = 200;
  const primeira = await lerSinistros(periodo, 0, signal, tamanho);
  const linhas = [...primeira.linhas];
  let pagina = 1;
  while (linhas.length < primeira.total) {
    const parte = await lerSinistros(periodo, pagina++, signal, tamanho);
    if (parte.total !== primeira.total || !parte.linhas.length)
      throw new Error('A relação de sinistros foi atualizada.');
    linhas.push(...parte.linhas);
  }
  if (linhas.length !== primeira.total || new Set(linhas.map((l) => l.numero)).size !== linhas.length)
    throw new Error('A relação de sinistros foi atualizada.');
  return { ...primeira, linhas };
}
export async function salvarAcompanhamento(numero: number, dados: Acompanhamento) {
  await clienteAxios.put(base + '/sinistros/' + numero, dados);
}
export async function consultarGestaoGlobal(signal?: AbortSignal) {
  return (await clienteAxios.get<boolean>(base + '/gestao-global', { signal })).data;
}
export async function lerApolices(signal?: AbortSignal) {
  return (await clienteAxios.get<Apolice[]>(base + '/apolices', { signal })).data;
}
export async function salvarApolice(apolice: Apolice) {
  const { id, ...dados } = apolice;
  if (id === undefined) await clienteAxios.post(base + '/apolices', dados);
  else await clienteAxios.put(base + '/apolices/' + id, dados);
}
