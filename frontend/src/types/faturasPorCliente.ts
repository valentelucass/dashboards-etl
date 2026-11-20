export interface FaturasPorClienteOverview {
  updatedAt: string;
  valorAFaturar: number;
  contasAReceber: number;
  valorEmAtraso: number;
  percentualFaturado: number;
  percentualEmAtraso: number;
  valorFaturado: number;
  registrosFaturados: number;
  aguardandoFaturamento: number;
  titulosEmAtraso: number;
  prazoMedioDias: number;
  prazoAteFaturarDias: number | null;
  prazoRecebimentoDias: number | null;
  clientesAtivos: number;
}

export interface FaturasPorClienteMensalTrend {
  month: string;
  valorFaturado: number;
  registrosFaturados: number;
}

export type FaturasPorClienteGranularidade = 'dia' | 'semana' | 'mes' | 'ano';
export type FaturasPorClienteReferenciaTemporal = 'emissao' | 'vencimento' | 'baixa';
export type FaturasPorClienteMetrica = 'valor_faturado' | 'registros_faturados' | 'ticket_medio' | 'valor_em_atraso';
export type FaturasPorClienteAgingEscopo = 'todos' | 'a_vencer' | 'em_atraso';
export type FaturasPorClienteDrilldownNivel = 'cliente' | 'cnpj' | 'fatura';

export interface FaturasPorClienteSerie {
  periodo: string;
  valor: number;
  registros: number;
}

export interface FaturasPorClienteDrilldownPoint {
  label: string;
  detalhe: string | null;
  valor: number;
  registros: number;
  percentualAcumulado: number;
}

export interface FaturasPorClienteStatusEvolucao {
  periodo: string;
  faturado: number;
  aguardandoFaturamento: number;
}

export interface FaturasPorClienteAgingBucket {
  faixa: string;
  valor: number;
  titulos: number;
}

export interface ClienteEmAtraso {
  cliente: string;
  clienteCnpj: string | null;
  titulos: number;
  maiorAtrasoDias: number;
  valorEmAtraso: number;
}

export interface EvolucaoFretes {
  periodo: string;
  valorTotalFretes: number;
  valorFaturado: number;
  quantidadeFretes: number;
}

export interface FaturasPorClienteTopCliente {
  valorAFaturar: number;
  cliente: string;
  clienteCnpj: string | null;
  valorFaturado: number;
}

export interface FaturasPorClienteStatusProcesso {
  statusProcesso: string;
  total: number;
}

export interface FaturaPorClienteResumoRow {
  idUnico: string;
  documentoFatura: string | null;
  emissao: string | null;
  vencimento: string | null;
  baixa: string | null;
  filial: string | null;
  clientePagador: string | null;
  clienteCnpj: string | null;
  numeroCte: number | null;
  valorFaturado: number;
  statusProcesso: string;
}

export interface FaturasPorClienteFiltro {
  dataInicio: string;
  dataFim: string;
  filiais?: string[];
  parceirosLogisticos?: string[];
  pagadores?: string[];
  clientesCnpj?: string[];
  statusProcesso?: string[];
}
