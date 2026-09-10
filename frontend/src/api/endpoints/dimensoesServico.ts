import clienteAxios from '../clienteAxios';
import { montarQueryParams } from './queryParams';
import type { FaturamentoFiltro } from '../../types/faturamento';
import type { CotacoesFiltro } from '../../types/cotacoes';
import type { FretesFiltro } from '../../types/fretes';
import type { ManifestosFiltro } from '../../types/manifestos';
import type { PerformanceFiltro } from '../../types/performance';

export interface VeiculoDim {
  placa: string;
  tipoVeiculo: string;
  proprietario: string;
}

export interface PlanoContasDim {
  descricao: string;
  classificacao: string;
}

export interface UsuarioDim {
  userId: string;
  nome: string;
}

export interface PagadorDim {
  nome: string;
  documento: string | null;
}

export interface DimensaoOpcao {
  value: string;
  label: string;
  description?: string | null;
}

export async function buscarFiliais(signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/filiais', { signal });
  return data;
}

export async function buscarClientes(signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/clientes', { signal });
  return data;
}

export async function buscarPagadores(busca?: string, signal?: AbortSignal): Promise<PagadorDim[]> {
  const params = new URLSearchParams();
  const termo = busca?.trim();
  if (termo) {
    params.set('busca', termo);
  }
  params.set('limite', '50');

  const { data } = await clienteAxios.get<PagadorDim[]>('/api/dimensoes/pagadores', { signal, params });
  return data;
}

export async function buscarFaturasPorClienteClientesCnpj(signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/faturas-por-cliente/clientes-cnpj', { signal });
  return data;
}

export async function buscarMotoristas(signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/motoristas', { signal });
  return data;
}

export async function buscarVeiculos(signal?: AbortSignal): Promise<VeiculoDim[]> {
  const { data } = await clienteAxios.get<VeiculoDim[]>('/api/dimensoes/veiculos', { signal });
  return data;
}

export async function buscarManifestosClassificacoes(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/manifestos/classificacoes', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarPlanoContas(signal?: AbortSignal): Promise<PlanoContasDim[]> {
  const { data } = await clienteAxios.get<PlanoContasDim[]>('/api/dimensoes/planocontas', { signal });
  return data;
}

export async function buscarUsuarios(signal?: AbortSignal): Promise<UsuarioDim[]> {
  const { data } = await clienteAxios.get<UsuarioDim[]>('/api/dimensoes/usuarios', { signal });
  return data;
}

export async function buscarFretesStatus(filtro: FretesFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/fretes/status', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarFaturamentoStatus(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<string[]> {
  return buscarFretesStatus(filtro, signal);
}

export async function buscarPerformanceResponsaveis(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/performance/responsaveis', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarPerformanceRegioesDestino(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/performance/regioes-destino', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarPerformanceCidadesDestino(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/performance/cidades-destino', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarFaturamentoResponsaveis(filtro: FaturamentoFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/faturamento/responsaveis', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarCotacoesUsuarios(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/usuarios', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesClassificacoes(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/classificacoes', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesOrigens(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/origens', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesDestinos(filtro: CotacoesFiltro, signal?: AbortSignal): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/destinos', {
    signal,
    params: montarQueryParams(filtro),
  });
  return data;
}
