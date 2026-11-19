export interface IndicadoresGestaoVistaFiltro {
  dataInicio: string;
  dataFim: string;
  filiais?: string[];
  parceirosLogisticos?: string[];
  classificacoes?: string[];
}

export const KPI_GOAL_INDICATOR_KEYS = [
  'delivery_performance',
  'collector_usage',
  'cargo_cubage',
  'cargo_indemnity',
  'cutoff_time',
] as const;

export type KpiGoalIndicatorKey = (typeof KPI_GOAL_INDICATOR_KEYS)[number];
export type KpiGoalsMap = Record<KpiGoalIndicatorKey, number>;
export type KpiGoalSource = 'GLOBAL' | 'BRANCH_OVERRIDE';
export type KpiGoalHistoryAction = 'GLOBAL_UPDATE' | 'BRANCH_UPDATE' | 'BRANCH_OVERRIDE_REMOVED';

export interface KpiGoalUser {
  id: string | null;
  name: string | null;
}

export interface KpiGoalBranchOverride {
  branchId: string;
  competencia: string;
  goals: KpiGoalsMap;
  updatedAt: string | null;
  updatedBy: KpiGoalUser | null;
}

export interface KpiGoalsFullResponse {
  competencia: string;
  global: KpiGoalsMap;
  branches: KpiGoalBranchOverride[];
}

export interface KpiGoalEffectiveResponse {
  branchId: string;
  source: KpiGoalSource;
  competencia: string;
  goals: KpiGoalsMap;
}

export interface KpiGoalsUpdatePayload {
  goals: KpiGoalsMap;
  forceOverride?: boolean | null;
  competencia?: string;
}

export interface KpiGoalHistoryItem {
  branchId: string | null;
  indicatorKey: KpiGoalIndicatorKey;
  competencia: string;
  oldValue: number | null;
  newValue: number | null;
  updatedBy: KpiGoalUser | null;
  updatedAt: string | null;
  action: KpiGoalHistoryAction;
}

export interface KpiGoalConflictResponse {
  mensagem?: string;
  branches?: KpiGoalBranchOverride[];
}

export interface KpiGoalIndicatorOverride {
  branchId: string;
  branchName: string;
  competencia: string;
  goalValue: number;
  updatedAt: string | null;
  updatedBy: KpiGoalUser | null;
}

export interface KpiGoalOverridesResponse {
  indicatorKey: KpiGoalIndicatorKey;
  competencia: string;
  globalGoal: number;
  overrides: KpiGoalIndicatorOverride[];
}

export interface PerformanceEntregaOverview {
  updatedAt: string;
  totalEntregas: number;
  finalizadas: number;
  entregasNoPrazo: number;
  entregasForaDoPrazo: number;
  pctNoPrazo: number;
}

export type NivelVisaoPerformance = 'RESPONSAVEL' | 'REGIAO' | 'CIDADE';

export interface PerformanceEntregaSerieParams {
  visao: NivelVisaoPerformance;
  responsavelFiltro?: string | null;
  regiaoFiltro?: string | null;
}

export interface PerformanceEntregaSeriePoint {
  label: string;
  filtro: string | null;
  visao: NivelVisaoPerformance;
  totalEntregas: number;
  finalizadas: number;
  entregasNoPrazo: number;
  entregasForaDoPrazo: number;
  pctNoPrazo: number;
}

export interface PerformanceEntregaRow {
  numeroMinuta: number;
  dataFrete: string | null;
  filialPerformance: string | null;
  filialEmissora: string | null;
  previsaoEntrega: string | null;
  dataFinalizacao: string | null;
  performanceDiferencaDias: number | null;
  performanceStatus: string | null;
}

export interface UtilizacaoColetoresOverview {
  updatedAt: string;
  manifestosBipados: number;
  manifestosEmitidos: number;
  manifestosDescarregamento: number;
  totalManifestos: number;
  manifestosIncompletos: number;
  pctUtilizacao: number;
}

export interface UtilizacaoColetoresSeriePoint {
  date: string | null;
  filial: string | null;
  classificacao: string | null;
  manifestosBipados: number;
  manifestosEmitidos: number;
  manifestosDescarregamento: number;
  totalManifestos: number;
  manifestosIncompletos: number;
  pctUtilizacao: number;
}

export interface UtilizacaoColetoresRankingItem {
  branchId: string;
  branchName: string;
  utilization: number;
  goal: number;
  ordensConferencia: number;
  manifestosBipaveis: number;
  descarregamentos: number;
  ordensIncompletas: number;
}

export interface UtilizacaoColetoresRow {
  chave: string;
  date: string | null;
  filial: string | null;
  classificacao: string | null;
  manifestosBipados: number;
  manifestosEmitidos: number;
  manifestosDescarregamento: number;
  totalManifestos: number;
  manifestosIncompletos: number;
  pctUtilizacao: number;
}

export interface CubagemMercadoriasOverview {
  updatedAt: string;
  totalFretes: number;
  fretesCubados: number;
  fretesComPesoReal: number;
  pctCubagem: number;
}

export interface CubagemMercadoriasSeriePoint {
  date: string | null;
  filial: string | null;
  totalFretes: number;
  fretesCubados: number;
  pctCubagem: number;
}

export interface CubagemMercadoriasRow {
  numeroMinuta: number;
  dataFrete: string | null;
  filialEmissora: string | null;
  pagador: string | null;
  remetenteDocumento: string | null;
  destino: string | null;
  pesoTaxado: number;
  pesoReal: number;
  pesoCubado: number;
  totalM3: number;
  cubado: boolean;
}

export interface ClienteExcecaoCubagem {
  clienteCnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cidadeUf: string | null;
  atualizadoPor: string | null;
  dataAtualizacao: string | null;
}

export type CubagemClientesImportacaoStatus = 'PRONTA' | 'ERRO_VALIDACAO';

export interface CubagemClientesImportacaoTotais {
  totalLinhas: number;
  validas: number;
  invalidas: number;
}

export interface CubagemClientesImportacaoPreviewLinha {
  linha: number;
  clienteCnpj: string;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  cidadeUf: string | null;
  status: CubagemClientesImportacaoStatus;
  mensagens: string[];
}

export interface CubagemClientesImportacaoPreviewResponse {
  nomeArquivo: string;
  totais: CubagemClientesImportacaoTotais;
  podeImportar: boolean;
  linhasPreview: CubagemClientesImportacaoPreviewLinha[];
}

export interface CubagemClientesImportacaoImportado {
  linha: number;
  clienteCnpj: string;
  razaoSocial: string | null;
}

export interface CubagemClientesImportacaoErro {
  linha: number;
  motivo: string;
  tipoErro: string;
}

export interface CubagemClientesImportacaoResultado {
  totalProcessados: number;
  totalImportados: number;
  totalErros: number;
  listaImportados: CubagemClientesImportacaoImportado[];
  listaErros: CubagemClientesImportacaoErro[];
}

export interface IndenizacaoMercadoriasOverview {
  updatedAt: string;
  totalSinistros: number;
  valorIndenizadoAbs: number;
  valorIndenizadoOriginal: number;
  faturamentoBase: number;
  pctIndenizacao: number;
}

export interface IndenizacaoMercadoriasSeriePoint {
  date: string | null;
  filial: string | null;
  totalSinistros: number;
  valorIndenizadoOriginal?: number;
  valorIndenizadoAbs: number;
  faturamentoBase: number;
  faturamentoPeriodoFilial?: number;
  pctIndenizacao: number;
}

export interface IndenizacaoMercadoriasRow {
  numeroSinistro: number;
  dataFinalizacao: string | null;
  filial: string | null;
  minuta: number | null;
  resultadoFinalOriginal: number;
  resultadoFinalAbs: number;
  causaRaiz: string | null;
  solucao: string | null;
  pctSobreFaturamentoFilial: number;
}

export interface HorariosCorteOverview {
  updatedAt: string;
  saidasNoHorario: number;
  totalProgramado: number;
  pctNoHorario: number;
  ultimaImportacaoEm: string | null;
  ultimaImportacaoArquivo: string | null;
}

export interface HorariosCorteSeriePoint {
  date: string | null;
  filial: string | null;
  saidasNoHorario: number;
  totalProgramado: number;
  pctNoHorario: number;
}

export interface HorarioCorteRow {
  id: number;
  data: string | null;
  filial: string | null;
  linhaOuOperacao: string | null;
  origemSm: string | null;
  destinoSm: string | null;
  origemDestino: string | null;
  origem: string | null;
  ordem: string | null;
  destino: string | null;
  horarioCorteSm: string | null;
  previsaoChegadaDestino: string | null;
  transitTime: string | null;
  inicio: string | null;
  manifestado: string | null;
  smGerada: string | null;
  corte: string | null;
  saidaEfetiva: string | null;
  horarioCorte: string | null;
  saiuNoHorario: boolean | null;
  atrasoMinutos: number | null;
  justificativa: string | null;
  observacao: string | null;
  nomeArquivo: string | null;
  importadoEm: string | null;
  importadoPor: string | null;
  acaoJustificativa?: null;
}

export interface ViagemJustificativaPayload {
  codSolicitacao: number;
  justificativa: string;
}

export interface ViagemJustificativa {
  id: number;
  codSolicitacao: number;
  justificativa: string;
  criadoEm: string;
  criadoPor: string;
}
