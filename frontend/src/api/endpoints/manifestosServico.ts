import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { extrairNomeArquivo, salvarBlobComoArquivo } from '../downloadArquivo';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type {
  ManifestosCostGoalConfig,
  ManifestosCostGoalPayload,
  ManifestosMetasImportacaoPreviewResponse,
  ManifestosMetasImportacaoResultado,
  ManifestoResumoRow,
  ManifestosCharts,
  ManifestosFiltro,
  ManifestosOverview,
  ManifestosTempoNivel,
  ManifestosTrendPoint,
  PerformanceVeiculosDados,
} from '../../types/manifestos';
import type { TableApiFilters } from '../../types/tableFilters';

export async function buscarManifestosOverview(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<ManifestosOverview> {
  const { data } = await clienteAxios.get<ManifestosOverview>('/api/painel/manifestos', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarManifestosSerie(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<ManifestosTrendPoint[]> {
  const { data } = await clienteAxios.get<ManifestosTrendPoint[]>('/api/painel/manifestos/serie', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarManifestosGraficos(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<ManifestosCharts> {
  const { data } = await clienteAxios.get<ManifestosCharts>('/api/painel/manifestos/graficos', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarManifestosPerformance(
  filtro: ManifestosFiltro,
  nivel: ManifestosTempoNivel,
  ano?: number | null,
  mes?: number | null,
  signal?: AbortSignal,
): Promise<PerformanceVeiculosDados> {
  const params = montarQueryParams(filtro);
  params.set('nivel', nivel);
  if (ano) {
    params.set('ano', String(ano));
  }
  if (mes) {
    params.set('mes', String(mes));
  }

  const { data } = await clienteAxios.get<PerformanceVeiculosDados>('/api/painel/manifestos/performance', {
    params,
    signal,
  });
  return data;
}

export async function buscarManifestosMetas(
  branchId: string,
  ano: number,
  mes: number,
  signal?: AbortSignal,
): Promise<ManifestosCostGoalConfig[]> {
  const { data } = await clienteAxios.get<ManifestosCostGoalConfig[]>('/api/painel/manifestos/metas', {
    params: { branchId, ano, mes },
    signal,
  });
  return data;
}

export async function salvarManifestosMeta(payload: ManifestosCostGoalPayload): Promise<ManifestosCostGoalConfig> {
  const { data } = await clienteAxios.post<ManifestosCostGoalConfig>('/api/painel/manifestos/metas', payload);
  return data;
}

export async function replicarManifestosMetas(
  ano: number,
  mes: number,
): Promise<ManifestosCostGoalConfig[]> {
  const { data } = await clienteAxios.post<ManifestosCostGoalConfig[]>('/api/painel/manifestos/metas/replicar', {
    ano,
    mes,
  });
  return data;
}

export async function removerManifestosMeta(
  branchId: string,
  ano: number,
  mes: number,
  contractTypeKey?: string,
  classificationKey?: string | null,
): Promise<void> {
  await clienteAxios.delete('/api/painel/manifestos/metas', {
    params: { branchId, ano, mes, contractTypeKey, classificationKey },
  });
}

export async function baixarTemplateManifestosMetas(): Promise<void> {
  const response = await clienteAxios.get<Blob>('/api/painel/manifestos/metas/importacao/template', {
    responseType: 'blob',
  });
  const contentDisposition = response.headers['content-disposition'];
  const nomeArquivo = extrairNomeArquivo(
    Array.isArray(contentDisposition) ? contentDisposition[0] : contentDisposition,
    'manifestos-metas-modelo.xlsx',
  );
  salvarBlobComoArquivo(response.data, nomeArquivo);
}

export async function preValidarManifestosMetasImportacao(
  arquivo: File,
): Promise<ManifestosMetasImportacaoPreviewResponse> {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  const { data } = await clienteAxios.post<ManifestosMetasImportacaoPreviewResponse>(
    '/api/painel/manifestos/metas/importacao/pre-validacao',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function importarManifestosMetas(
  arquivo: File,
): Promise<ManifestosMetasImportacaoResultado> {
  const formData = new FormData();
  formData.append('arquivo', arquivo);

  const { data } = await clienteAxios.post<ManifestosMetasImportacaoResultado>(
    '/api/painel/manifestos/metas/importacao',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return data;
}

export async function buscarManifestosTabela(
  filtro: ManifestosFiltro,
  limite = 100,
  signal?: AbortSignal,
): Promise<ManifestoResumoRow[]> {
  const params = montarQueryParams(filtro);
  params.set('limite', String(limite));
  const { data } = await clienteAxios.get<ManifestoResumoRow[]>('/api/painel/manifestos/tabela', { params, signal });
  return data;
}

export async function buscarManifestosTabelaTotal(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<number> {
  const { data } = await clienteAxios.get<{ total: number }>('/api/painel/manifestos/tabela/total', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data.total;
}

export async function buscarManifestosTabelaPaginada(
  filtro: ManifestosFiltro,
  pagina: number,
  tamanhoPagina: number,
  filtrosTabela?: TableApiFilters,
  sortField?: string,
  sortDirection?: 'asc' | 'desc',
  signal?: AbortSignal,
): Promise<PaginacaoResponse<ManifestoResumoRow>> {
  return buscarTabelaPaginada(
    '/api/painel/manifestos/tabela/paginada',
    filtro,
    pagina,
    tamanhoPagina,
    filtrosTabela,
    sortField,
    sortDirection,
    signal,
  );
}

export async function exportarManifestosCsv(filtro: ManifestosFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
  await baixarCsv('/api/painel/manifestos/exportacao', filtro, 'manifestos', filtrosTabela);
}
