import clienteAxios from '../clienteAxios';

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
