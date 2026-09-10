import clienteAxios from '../clienteAxios';
import { baixarCsv } from '../downloadCsv';
import { buscarTabelaPaginada } from '../tabelaPaginada';
import { aplicarFiltrosTabelaParams } from '../tableFilters';
import { montarQueryParams } from './queryParams';
import type { PaginacaoResponse } from '../../types/common';
import type {
  PerformanceAgingPoint,
  PerformanceDrilldownParams,
  PerformanceDrilldownPoint,
  PerformanceFiltro,
  PerformanceHistoricoPoint,
  PerformanceOverview,
  PerformanceSerieTemporalPoint,
  PerformanceStatusDistribuicao,
  PerformanceTabelaPage,
  PerformanceTabelaRow,
  PerformanceTempoNivel,
} from '../../types/performance';
import type { TableApiFilters } from '../../types/tableFilters';

export const PERFORMANCE_API_BASE_PATH = '/api/painel/performance';

function paramsComFiltro(filtro: PerformanceFiltro): URLSearchParams {
  return montarQueryParams(filtro);
}

function paramsComDrilldown(
  filtro: PerformanceFiltro,
  drilldown: PerformanceDrilldownParams,
): URLSearchParams {
  const params = paramsComFiltro(filtro);
  params.set('nivel', drilldown.nivel);

  if (drilldown.responsavel?.trim()) {
    params.set('responsavel', drilldown.responsavel.trim());
  }

  if (drilldown.regiaoDestino?.trim()) {
    params.set('regiaoDestino', drilldown.regiaoDestino.trim());
  }

  return params;
}

export function createPerformanceServico(basePath = PERFORMANCE_API_BASE_PATH) {
  return {
    async buscarOverview(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<PerformanceOverview> {
      const { data } = await clienteAxios.get<PerformanceOverview>(`${basePath}/overview`, {
        params: paramsComFiltro(filtro),
        signal,
      });
      return data;
    },

    async buscarSerieTemporal(
      filtro: PerformanceFiltro,
      nivel: PerformanceTempoNivel,
      ano?: number | null,
      mes?: number | null,
      signal?: AbortSignal,
    ): Promise<PerformanceSerieTemporalPoint[]> {
      const params = paramsComFiltro(filtro);
      params.set('nivel', nivel);
      if (ano) {
        params.set('ano', String(ano));
      }
      if (mes) {
        params.set('mes', String(mes));
      }

      const { data } = await clienteAxios.get<PerformanceSerieTemporalPoint[]>(`${basePath}/serie-temporal`, {
        params,
        signal,
      });
      return data;
    },

    async buscarStatus(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<PerformanceStatusDistribuicao[]> {
      const { data } = await clienteAxios.get<PerformanceStatusDistribuicao[]>(`${basePath}/status`, {
        params: paramsComFiltro(filtro),
        signal,
      });
      return data;
    },

    async buscarHistorico(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<PerformanceHistoricoPoint[]> {
      const { data } = await clienteAxios.get<PerformanceHistoricoPoint[]>(`${basePath}/historico`, {
        params: paramsComFiltro(filtro),
        signal,
      });
      return data;
    },

    async buscarDrilldown(
      filtro: PerformanceFiltro,
      drilldown: PerformanceDrilldownParams,
      signal?: AbortSignal,
    ): Promise<PerformanceDrilldownPoint[]> {
      const { data } = await clienteAxios.get<PerformanceDrilldownPoint[]>(`${basePath}/drilldown`, {
        params: paramsComDrilldown(filtro, drilldown),
        signal,
      });
      return data;
    },

    async buscarAging(filtro: PerformanceFiltro, signal?: AbortSignal): Promise<PerformanceAgingPoint[]> {
      const { data } = await clienteAxios.get<PerformanceAgingPoint[]>(`${basePath}/aging`, {
        params: paramsComFiltro(filtro),
        signal,
      });
      return data;
    },

    async buscarTabela(
      filtro: PerformanceFiltro,
      pagina: number,
      tamanhoPagina: number,
      filtrosTabela?: TableApiFilters,
      signal?: AbortSignal,
    ): Promise<PerformanceTabelaPage> {
      const params = paramsComFiltro(filtro);
      aplicarFiltrosTabelaParams(params, filtrosTabela);
      params.set('page', String(Math.max(0, pagina - 1)));
      params.set('size', String(tamanhoPagina));

      const { data } = await clienteAxios.get<PerformanceTabelaPage>(`${basePath}/tabela`, {
        params,
        signal,
      });
      return data;
    },

    async buscarTabelaPaginada(
      filtro: PerformanceFiltro,
      pagina: number,
      tamanhoPagina: number,
      filtrosTabela?: TableApiFilters,
      signal?: AbortSignal,
    ): Promise<PaginacaoResponse<PerformanceTabelaRow>> {
      return buscarTabelaPaginada<PerformanceTabelaRow, PerformanceFiltro>(
        `${basePath}/tabela/paginada`,
        filtro,
        pagina,
        tamanhoPagina,
        filtrosTabela,
        undefined,
        undefined,
        signal,
      );
    },

    async exportarCsv(filtro: PerformanceFiltro, filtrosTabela?: TableApiFilters): Promise<void> {
      await baixarCsv(`${basePath}/exportacao`, filtro, 'performance', filtrosTabela);
    },
  };
}

export const performanceServico = createPerformanceServico();

export const buscarPerformanceOverview = performanceServico.buscarOverview;
export const buscarPerformanceSerieTemporal = performanceServico.buscarSerieTemporal;
export const buscarPerformanceStatus = performanceServico.buscarStatus;
export const buscarPerformanceHistorico = performanceServico.buscarHistorico;
export const buscarPerformanceDrilldown = performanceServico.buscarDrilldown;
export const buscarPerformanceAging = performanceServico.buscarAging;
export const buscarPerformanceTabela = performanceServico.buscarTabela;
export const buscarPerformanceTabelaPaginada = performanceServico.buscarTabelaPaginada;
export const exportarPerformanceCsv = performanceServico.exportarCsv;
