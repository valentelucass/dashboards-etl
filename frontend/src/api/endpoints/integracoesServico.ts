import clienteAxios from '../clienteAxios';
import { aplicarFiltrosTabelaParams } from '../tableFilters';
import { baixarCsvComParametros } from '../downloadCsv';
import type { TableApiFilters } from '../../types/tableFilters';

export type IntegracoesEscopo = 'PENDENCIAS' | 'SUCESSO';

export interface IntegracaoMetricaConsolidada {
  sistemaDestino: string;
  totalRegistros: number;
  percentualXmlSucesso: number;
  percentualCanhotoSucesso: number;
  rotuloDados?: string;
  rotuloComprovante?: string;
}

export interface IntegracaoEvolucaoDiaria {
  data: string;
  total: number;
  sucessos: number;
  erros: number;
}

export interface ResumoTabelaIntegracao {
  entidadeTabela: string;
  totalProcessado: number;
  totalSucesso: number;
  totalErro: number;
  totalQuarentena: number;
}

export interface IntegracaoPendencia {
  id: number;
  sistemaDestino: string;
  occurrenceId: number | null;
  freightId: number | null;
  chaveNfe: string | null;
  numeroNf: number | null;
  serieNf: string | null;
  statusDados: string | null;
  statusCanhoto: string | null;
  mensagemErroDados: string | null;
  mensagemErroCanhoto: string | null;
  canhotoReferencia: string | null;
  canhotoMimeType: string | null;
  dataProcessamento: string | null;
  dataProcessamentoDados: string | null;
  dataProcessamentoCanhoto: string | null;
  possuiImagem?: boolean | null;
  possuiImagemCanhoto?: boolean | null;
  possuiImagemPayload?: boolean | null;
  imagemDisponivel?: boolean | null;
}

export interface IntegracoesPaginacao {
  pagina: number;
  tamanho: number;
  totalElementos: number;
  totalPaginas: number;
  primeiraPagina: boolean;
  ultimaPagina: boolean;
}

export interface IntegracoesPendenciasPaginadas {
  itens: IntegracaoPendencia[];
  paginacao: IntegracoesPaginacao;
}

export interface IntegracoesAuditoriaResponse {
  geradoEm: string;
  metricasConsolidadas: IntegracaoMetricaConsolidada[];
  pendencias: IntegracoesPendenciasPaginadas;
}

export interface WorkSftpClienteStatus {
  cliente: string;
  inicioUltimoCiclo: string | null;
  fimUltimoCiclo: string | null;
  conexao: string;
  statusCiclo: string;
  arquivosValidos: number;
  arquivosRejeitados: number;
  selecionados: number;
  enviados: number;
  pendentes: number;
  saldo: number;
  bloqueios: number;
  timeoutsAmbiguos: number;
  duracaoMs: number;
  proximaExecucaoEstimada: string | null;
}

export interface WorkSftpExecucoesResponse {
  itens: WorkSftpClienteStatus[];
  paginacao: IntegracoesPaginacao;
}

export async function buscarIntegracoesAuditoria(
  pagina: number,
  tamanhoPagina: number,
  dataInicio: string,
  dataFim: string,
  filtrosTabela?: TableApiFilters,
  sortField?: keyof IntegracaoPendencia & string,
  sortDirection?: 'asc' | 'desc',
  escopo: IntegracoesEscopo = 'PENDENCIAS',
  destinos?: string[],
): Promise<IntegracoesAuditoriaResponse> {
  const params = new URLSearchParams();
  params.set('pagina', String(Math.max(0, pagina - 1)));
  params.set('tamanho', String(tamanhoPagina));
  params.set('escopo', escopo);
  params.set('dataInicial', dataInicio);
  params.set('dataFinal', dataFim);
  destinos?.forEach((destino) => params.append('destino', destino));
  if (sortField) {
    params.set('sortField', sortField);
    params.set('sortDirection', sortDirection === 'desc' ? 'desc' : 'asc');
  }
  aplicarFiltrosTabelaParams(params, filtrosTabela);

  const { data } = await clienteAxios.get<IntegracoesAuditoriaResponse>('/api/painel/integracoes', { params });
  return data;
}

export async function buscarIntegracoesEvolucaoDiaria(
  dataInicio: string,
  dataFim: string,
  escopo?: IntegracoesEscopo,
  destinos?: string[],
): Promise<IntegracaoEvolucaoDiaria[]> {
  const params = new URLSearchParams();
  params.set('dataInicial', dataInicio);
  params.set('dataFinal', dataFim);
  if (escopo) {
    params.set('escopo', escopo);
  }
  destinos?.forEach((destino) => params.append('destino', destino));

  const { data } = await clienteAxios.get<IntegracaoEvolucaoDiaria[]>(
    '/api/painel/integracoes/evolucao-diaria',
    { params },
  );
  return data;
}

export async function buscarStatusWorkSftpClientes(): Promise<WorkSftpClienteStatus[]> {
  const { data } = await clienteAxios.get<WorkSftpClienteStatus[]>('/api/painel/integracoes/vedacit-sftp/clientes');
  return data;
}

export async function buscarExecucoesWorkSftpClientes(
  pagina: number,
  tamanho: number,
  dataInicio: string,
  dataFim: string,
  cliente?: string,
  status?: string,
): Promise<WorkSftpExecucoesResponse> {
  const params = new URLSearchParams();
  params.set('pagina', String(Math.max(0, pagina - 1)));
  params.set('tamanho', String(tamanho));
  params.set('dataInicial', dataInicio);
  params.set('dataFinal', dataFim);
  if (cliente) params.set('cliente', cliente);
  if (status) params.set('status', status);
  const { data } = await clienteAxios.get<WorkSftpExecucoesResponse>(
    '/api/painel/integracoes/vedacit-sftp/execucoes', { params },
  );
  return data;
}

export async function exportarIntegracoesCsv(
  dataInicio: string,
  dataFim: string,
  filtrosTabela: TableApiFilters | undefined,
  sortField: keyof IntegracaoPendencia & string | null | undefined,
  sortDirection: 'asc' | 'desc' | undefined,
  escopo: IntegracoesEscopo,
  destinos?: string[],
): Promise<void> {
  const params = new URLSearchParams();
  params.set('escopo', escopo);
  params.set('dataInicial', dataInicio);
  params.set('dataFinal', dataFim);
  destinos?.forEach((destino) => params.append('destino', destino));
  if (sortField) {
    params.set('sortField', sortField);
    params.set('sortDirection', sortDirection === 'desc' ? 'desc' : 'asc');
  }
  aplicarFiltrosTabelaParams(params, filtrosTabela);

  const nomeArquivo = escopo === 'SUCESSO' ? 'integracoes-sucesso' : 'integracoes-pendencias';
  await baixarCsvComParametros('/api/painel/integracoes/exportacao', params, nomeArquivo);
}
