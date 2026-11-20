export interface TrackingRawRow {
  numeroMinuta: number;
  dataFrete: string | null;
  tipo: string | null;
  volumes: number | null;
  pesoTaxadoRaw: string | null;
  valorNfRaw: string | null;
  valorFrete: number;
  filialEmissora: string | null;
  filialOrigem: string | null;
  filialAtual: string | null;
  filialDestino: string | null;
  regiaoOrigem: string | null;
  regiaoDestino: string | null;
  classificacao: string | null;
  statusCarga: string | null;
  previsaoEntrega: string | null;
}

export interface TrackingRow extends Omit<TrackingRawRow, 'pesoTaxadoRaw' | 'valorNfRaw'> {
  pesoTaxado: number | null;
  valorNf: number | null;
}

export interface TrackingOverview {
  updatedAt: string;
  totalCargas: number;
  emTransito: number;
  previsaoVencida: number;
  valorFreteEmCarteira: number;
  pesoTaxadoTotal: number;
  pctFinalizado: number;
}

interface TrackingTotaisGrupo {
  totalCargas: number;
  pesoTaxado: number;
  valorFrete: number;
  valorNota: number;
  volumes: number;
  foraDoPrazo: number;
}

export interface TrackingMatrizRegiao extends TrackingTotaisGrupo {
  siglaRegiaoDestino: string;
  responsavelRegiaoDestino: string | null;
}

export interface TrackingRegiao extends TrackingTotaisGrupo {
  regiaoDestino: string;
}

export interface TrackingFrete {
  numeroMinuta: number;
  numerosNf: string[];
  previsaoEntrega: string | null;
  atrasado: boolean;
  statusCarga: string;
  volumes: number;
  pesoTaxado: number;
  valorFrete: number;
  valorNota: number;
}

export interface TrackingStatusDistribuicao {
  status: string;
  total: number;
  valorFrete: number;
}

export interface TrackingPrevisaoVencidaFilial {
  filialAtual: string;
  vencidas: number;
  total: number;
}

export interface TrackingOrigemDestino {
  origem: string;
  destino: string;
  cargas: number;
  valorFrete: number;
}

export interface TrackingValorPorRegiao {
  regiaoDestino: string;
  valorFrete: number;
  cargas: number;
}

export interface TrackingCharts {
  statusDistribuicao: TrackingStatusDistribuicao[];
  previsaoVencidaPorFilialAtual: TrackingPrevisaoVencidaFilial[];
  valorPorRegiaoDestino: TrackingValorPorRegiao[];
}

export interface TrackingDashboard {
  overview: TrackingOverview;
  matrizRegiaoDestino: TrackingMatrizRegiao[];
  graficos: TrackingCharts;
}

export interface TrackingTimelinePoint {
  date: string;
  pendente: number;
  manifestada: number;
  emEntrega: number;
  emTransferencia: number;
  finalizado: number;
}

export interface TrackingFiltro {
  dataInicio: string;
  dataFim: string;
  numeroMinuta?: string;
  filialEmissora?: string[];
  filialAtual?: string[];
  filialDestino?: string[];
  regiaoOrigem?: string[];
  regiaoDestino?: string[];
  statusCarga?: string[];
  classificacoes?: string[];
}
