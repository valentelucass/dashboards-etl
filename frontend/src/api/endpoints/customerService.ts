import clienteAxios from '../clienteAxios';
import { salvarBlobComoArquivo } from '../downloadArquivo';

export interface ContaCustomerService {
  id: number;
  nome: string;
}

export interface PeriodoConta {
  clienteId: number;
  dataInicio: string;
  dataFim: string;
}

export interface OperacaoCliente {
  totalEntregas: number;
  finalizadas: number;
  noPrazo: number;
  coletasFinalizadas: number;
  coletasNoPrazo: number;
  anexadas: number;
  arquivadas: number | null;
  pesoRealKg: number | null;
  valorNf: number | null;
  valorFrete: number | null;
  porStatus: { status: string; quantidade: number }[];
  evolucao: { dia: string; totalEntregas: number; finalizadas: number; noPrazo: number }[];
  avarias: number | null;
  extravios: number | null;
  fretesComAvariaOuExtravio: number | null;
  ocorrenciasPorTipo: { tipo: string; quantidade: number }[] | null;
  coberturaOcorrencias?: { diasCobertos: number; diasSolicitados: number; ultimaData: string | null };
  coberturaArquivos?: { diasCobertos: number; diasSolicitados: number; dataFinal: string | null; completa: boolean };
}

export interface FinanceiroCliente {
  faturado: number;
  pendenteFaturamento: number;
  aVencer: number;
  emAtraso: number;
  pago: number;
  semVencimento: number;
  fretes: number;
  fretesFaturados: number;
  fretesPendentes: number;
  fretesFaturadosSemParcela: number;
  dataCorte: string;
}

const base = '/api/painel/customer-service';

export async function buscarContasCS(signal?: AbortSignal) {
  const { data } = await clienteAxios.get<ContaCustomerService[]>(base + '/clientes', { signal });
  return data;
}

export async function buscarOperacaoCS(params: PeriodoConta, signal?: AbortSignal) {
  const { data } = await clienteAxios.get<OperacaoCliente>(base + '/operacional', { params, signal });
  return data;
}

export async function buscarFinanceiroCS(params: PeriodoConta, signal?: AbortSignal) {
  const { data } = await clienteAxios.get<FinanceiroCliente>(base + '/financeiro', { params, signal });
  return data;
}

export interface ResumoCarteiraCS {
  competencia: string;
  versaoAtual: number;
  hashCarteira: string;
  grupos: number;
  cnpjs: number;
  adicionados: number;
  removidos: number;
  transferidos: number;
  semAlteracao: boolean;
}

const carteira = '/api/admin/customer-service/carteira';

export async function baixarModeloCarteiraCS() {
  const { data } = await clienteAxios.get<Blob>(carteira + '/modelo', {responseType: 'blob'});
  salvarBlobComoArquivo(data, 'Carteira-Key-Account.xlsx');
}

export async function conferirCarteiraCS(arquivo: File, competencia: string) {
  const formulario = new FormData();
  formulario.append('arquivo', arquivo);
  formulario.append('competencia', competencia);
  const { data } = await clienteAxios.post<ResumoCarteiraCS>(carteira + '/previa', formulario);
  return data;
}

export async function aplicarCarteiraCS(arquivo: File, previa: ResumoCarteiraCS) {
  const formulario = new FormData();
  formulario.append('arquivo', arquivo);
  formulario.append('competencia', previa.competencia);
  formulario.append('versaoAtual', String(previa.versaoAtual));
  formulario.append('hashCarteira', previa.hashCarteira);
  const { data } = await clienteAxios.post<ResumoCarteiraCS>(carteira + '/aplicar', formulario);
  return data;
}
