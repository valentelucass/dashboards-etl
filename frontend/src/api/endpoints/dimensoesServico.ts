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

export async function buscarFiliais(): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/filiais');
  return data;
}

export async function buscarClientes(): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/clientes');
  return data;
}

export async function buscarPagadores(busca?: string): Promise<PagadorDim[]> {
  const params = new URLSearchParams();
  const termo = busca?.trim();
  if (termo) {
    params.set('busca', termo);
  }
  params.set('limite', '50');

  const { data } = await clienteAxios.get<PagadorDim[]>('/api/dimensoes/pagadores', { params });
  return data;
}

export async function buscarFaturasPorClienteClientesCnpj(): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/faturas-por-cliente/clientes-cnpj');
  return data;
}

export async function buscarMotoristas(): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/motoristas');
  return data;
}

export async function buscarVeiculos(): Promise<VeiculoDim[]> {
  const { data } = await clienteAxios.get<VeiculoDim[]>('/api/dimensoes/veiculos');
  return data;
}

export async function buscarManifestosClassificacoes(filtro: ManifestosFiltro, signal?: AbortSignal): Promise<string[]> {
  const { data } = await clienteAxios.get<string[]>('/api/dimensoes/manifestos/classificacoes', {
    params: montarQueryParams(filtro),
    signal,
  });
  return data;
}

export async function buscarPlanoContas(): Promise<PlanoContasDim[]> {
  const { data } = await clienteAxios.get<PlanoContasDim[]>('/api/dimensoes/planocontas');
  return data;
}

export async function buscarUsuarios(): Promise<UsuarioDim[]> {
  const { data } = await clienteAxios.get<UsuarioDim[]>('/api/dimensoes/usuarios');
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

export async function buscarCotacoesUsuarios(filtro: CotacoesFiltro): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/usuarios', {
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesClassificacoes(filtro: CotacoesFiltro): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/classificacoes', {
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesOrigens(filtro: CotacoesFiltro): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/origens', {
    params: montarQueryParams(filtro),
  });
  return data;
}

export async function buscarCotacoesDestinos(filtro: CotacoesFiltro): Promise<DimensaoOpcao[]> {
  const { data } = await clienteAxios.get<DimensaoOpcao[]>('/api/dimensoes/cotacoes/destinos', {
    params: montarQueryParams(filtro),
  });
  return data;
}
