export interface ColetaResumoRow {
  id: string;
  coleta: number | null;
  solicitacao: string | null;
  agendamento: string | null;
  finalizacao: string | null;
  diasEmAberto: number | null;
  status: string;
  volumes: number | null;
  pesoTaxado: number;
  valorNf: number;
  numeroManifesto: number | null;
  cliente: string | null;
  cidade: string | null;
  uf: string | null;
  regiaoColeta: string | null;
  regiaoLogistica: string | null;
  filial: string | null;
  usuario: string | null;
  motivoCancelamento: string | null;
  numeroTentativas: number | null;
}

export type ColetaRow = ColetaResumoRow;

export interface ColetasOverview {
  updatedAt: string;
  totalColetas: number;
  finalizadas: number;
  taxaSucesso: number;
  taxaCancelamento: number;
  slaNoAgendamento: number;
  leadTimeMedioDias: number;
  tentativasMedias: number;
  pesoTaxadoTotal: number;
  valorNfTotal: number;
}

export interface ColetasTrendPoint {
  date: string;
  total: number;
  finalizadas: number;
  canceladas: number;
  emTratativa: number;
}

export interface ColetasStatusDistribuicao {
  status: string;
  total: number;
}

export interface ColetasHistoricoPerformance {
  date: string;
  performancePercentual: number;
  metaPercentual: number;
  finalizadas: number;
  noPrazo: number;
  foraDoPrazo: number;
}

export type ColetasHistoricoPeriodo = 'dias' | '3meses' | '6meses' | '1ano';

export type VisaoOrigemColetas = { nivel: 'regiao' } | { nivel: 'cidade'; regiao: string | null };

export interface ColetasRegiaoOrigem {
  regiaoLogistica: string;
  totalColetas: number;
  pesoTaxado: number;
}

export interface ColetasCidadeOrigem {
  cidade: string;
  totalColetas: number;
  pesoTaxado: number;
}

export interface ColetasAgingBucket {
  faixa: string;
  total: number;
}

export interface ColetasCharts {
  statusDistribuicao: ColetasStatusDistribuicao[];
  historicoPerformance: ColetasHistoricoPerformance[];
  regioesOrigem: ColetasRegiaoOrigem[];
  agingAbertas: ColetasAgingBucket[];
}

export interface ColetasFiltro {
  dataInicio: string;
  dataFim: string;
  filiais?: string[];
  parceirosLogisticos?: string[];
  clientes?: string[];
  status?: string[];
  regioes?: string[];
  usuarios?: string[];
}
