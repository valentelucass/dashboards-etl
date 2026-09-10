import { useQuery } from '@tanstack/react-query';
import {
  buscarFiliais,
  buscarClientes,
  buscarPagadores,
  buscarFaturasPorClienteClientesCnpj,
  buscarMotoristas,
  buscarVeiculos,
  buscarManifestosClassificacoes,
  buscarPlanoContas,
  buscarUsuarios,
  buscarCotacoesUsuarios,
  buscarCotacoesClassificacoes,
  buscarCotacoesOrigens,
  buscarCotacoesDestinos,
  buscarFaturamentoStatus,
  buscarFaturamentoResponsaveis,
  buscarFretesStatus,
  buscarPerformanceCidadesDestino,
  buscarPerformanceRegioesDestino,
  buscarPerformanceResponsaveis,
} from '../../api/endpoints/dimensoesServico';
import type { FaturamentoFiltro } from '../../types/faturamento';
import type { CotacoesFiltro } from '../../types/cotacoes';
import type { FretesFiltro } from '../../types/fretes';
import type { ManifestosFiltro } from '../../types/manifestos';
import type { PerformanceFiltro } from '../../types/performance';

const STALE_TIME = 30 * 60 * 1000; // 30 minutos
const GC_TIME = 24 * 60 * 60 * 1000; // 24 horas

export function useFiliais() {
  return useQuery({
    queryKey: ['dim', 'filiais'],
    queryFn: ({ signal }) => buscarFiliais(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useClientes() {
  return useQuery({
    queryKey: ['dim', 'clientes'],
    queryFn: ({ signal }) => buscarClientes(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function usePagadores(busca: string) {
  const buscaNormalizada = busca.trim();

  return useQuery({
    queryKey: ['dim', 'pagadores', buscaNormalizada],
    queryFn: ({ signal }) => buscarPagadores(buscaNormalizada, signal),
    placeholderData: (previousData) => previousData,
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useFaturasPorClienteClientesCnpj() {
  return useQuery({
    queryKey: ['dim', 'faturas-por-cliente', 'clientes-cnpj'],
    queryFn: ({ signal }) => buscarFaturasPorClienteClientesCnpj(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useMotoristas() {
  return useQuery({
    queryKey: ['dim', 'motoristas'],
    queryFn: ({ signal }) => buscarMotoristas(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useVeiculos() {
  return useQuery({
    queryKey: ['dim', 'veiculos'],
    queryFn: ({ signal }) => buscarVeiculos(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useManifestosClassificacoes(filtro: ManifestosFiltro) {
  return useQuery({
    queryKey: ['dim', 'manifestos', 'classificacoes', filtro],
    queryFn: ({ signal }) => buscarManifestosClassificacoes(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function usePlanoContas() {
  return useQuery({
    queryKey: ['dim', 'planocontas'],
    queryFn: ({ signal }) => buscarPlanoContas(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useUsuarios() {
  return useQuery({
    queryKey: ['dim', 'usuarios'],
    queryFn: ({ signal }) => buscarUsuarios(signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useFretesStatus(filtro: FretesFiltro) {
  return useQuery({
    queryKey: ['dim', 'fretes', 'status', filtro],
    queryFn: ({ signal }) => buscarFretesStatus(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useFaturamentoStatus(filtro: FaturamentoFiltro) {
  return useQuery({
    queryKey: ['dim', 'faturamento', 'status', filtro],
    queryFn: ({ signal }) => buscarFaturamentoStatus(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function usePerformanceResponsaveis(filtro: PerformanceFiltro) {
  return useQuery({
    queryKey: ['dim', 'performance', 'responsaveis', filtro],
    queryFn: ({ signal }) => buscarPerformanceResponsaveis(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function usePerformanceRegioesDestino(filtro: PerformanceFiltro) {
  return useQuery({
    queryKey: ['dim', 'performance', 'regioes-destino', filtro],
    queryFn: ({ signal }) => buscarPerformanceRegioesDestino(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function usePerformanceCidadesDestino(filtro: PerformanceFiltro) {
  return useQuery({
    queryKey: ['dim', 'performance', 'cidades-destino', filtro],
    queryFn: ({ signal }) => buscarPerformanceCidadesDestino(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useFaturamentoResponsaveis(filtro: FaturamentoFiltro) {
  return useQuery({
    queryKey: ['dim', 'faturamento', 'responsaveis', filtro],
    queryFn: ({ signal }) => buscarFaturamentoResponsaveis(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useCotacoesUsuarios(filtro: CotacoesFiltro) {
  return useQuery({
    queryKey: ['dim', 'cotacoes', 'usuarios', filtro],
    queryFn: ({ signal }) => buscarCotacoesUsuarios(filtro, signal),
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useCotacoesClassificacoes(filtro: CotacoesFiltro) {
  return useQuery({
    queryKey: ['dim', 'cotacoes', 'classificacoes', filtro],
    queryFn: ({ signal }) => buscarCotacoesClassificacoes(filtro, signal),
    staleTime: Infinity,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useCotacoesOrigens(filtro: CotacoesFiltro) {
  return useQuery({
    queryKey: ['dim', 'cotacoes', 'origens', filtro],
    queryFn: ({ signal }) => buscarCotacoesOrigens(filtro, signal),
    staleTime: Infinity,
    gcTime: GC_TIME,
    retry: 1,
  });
}

export function useCotacoesDestinos(filtro: CotacoesFiltro) {
  return useQuery({
    queryKey: ['dim', 'cotacoes', 'destinos', filtro],
    queryFn: ({ signal }) => buscarCotacoesDestinos(filtro, signal),
    staleTime: Infinity,
    gcTime: GC_TIME,
    retry: 1,
  });
}
