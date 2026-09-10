/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { rememberedDashboardHref, rememberDashboardSearch, type DashboardNavigationEntry } from '../utils/dashboardNavigation';
import { dataHojeLocal, primeiroDiaMesAtualLocal } from '../utils/dateUtils';
import { DATE_RANGE_PRESETS } from '../components/shared/dateRangePresets';

interface FiltroContexto {
  dataInicio: string;
  dataFim: string;
  filtros: Record<string, string[]>;
  setDataInicio: (data: string) => void;
  setDataFim: (data: string) => void;
  setDataRange: (inicio: string, fim: string) => void;
  setFiltro: (chave: string, valores: string[]) => void;
  setFiltros: (alteracoes: Record<string, string[]>) => void;
  limparFiltros: () => void;
  obterLinkPainel: (path: string) => string;
}

const FiltroContext = createContext<FiltroContexto | null>(null);
const PREFIXO_FILTRO = 'f.';

function lerFiltros(params: URLSearchParams): Record<string, string[]> {
  const filtros: Record<string, string[]> = {};

  for (const [chave, valor] of params.entries()) {
    if (!chave.startsWith(PREFIXO_FILTRO) || !valor) {
      continue;
    }

    const nomeFiltro = chave.slice(PREFIXO_FILTRO.length);
    if (!nomeFiltro) {
      continue;
    }

    if (!filtros[nomeFiltro]) {
      filtros[nomeFiltro] = [];
    }

    filtros[nomeFiltro].push(valor);
  }

  return filtros;
}

export function FiltroProvider({ children }: { children: ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [navigation, setNavigation] = useState(() => ({
    key: location.key,
    entries: rememberDashboardSearch([] as DashboardNavigationEntry[], location.pathname, location.search),
  }));
  // Memória da navegação do menu, limitada e vinculada ao provider da sessão.
  // URLs explícitas e Voltar/Avançar continuam sendo a fonte dos filtros atuais.
  if (navigation.key !== location.key) {
    setNavigation({
      key: location.key,
      entries: rememberDashboardSearch(navigation.entries, location.pathname, location.search),
    });
  }
  const obterLinkPainel = (path: string) => rememberedDashboardHref(navigation.entries, path);

  const defaultPeriod = location.pathname === '/executivo' || location.pathname === '/etl-saude'
    ? DATE_RANGE_PRESETS.find(preset => preset.label === '180d')?.getRange() : undefined;
  const dataInicio = searchParams.get('dataInicio') ?? defaultPeriod?.dataInicio ?? primeiroDiaMesAtualLocal();
  const dataFim = searchParams.get('dataFim') ?? defaultPeriod?.dataFim ?? dataHojeLocal();
  const filtros = useMemo(() => lerFiltros(searchParams), [searchParams]);

  const atualizarParams = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const setDataInicio = useCallback(
    (data: string) => {
      atualizarParams((params) => {
        params.set('dataInicio', data);
      });
    },
    [atualizarParams]
  );

  const setDataFim = useCallback(
    (data: string) => {
      atualizarParams((params) => {
        params.set('dataFim', data);
      });
    },
    [atualizarParams]
  );

  const setDataRange = useCallback(
    (inicio: string, fim: string) => {
      atualizarParams((params) => {
        params.set('dataInicio', inicio);
        params.set('dataFim', fim);
      });
    },
    [atualizarParams]
  );

  const setFiltro = useCallback(
    (chave: string, valores: string[]) => {
      atualizarParams((params) => {
        params.delete(`${PREFIXO_FILTRO}${chave}`);

        valores
          .filter((valor) => valor.trim().length > 0)
          .forEach((valor) => params.append(`${PREFIXO_FILTRO}${chave}`, valor));
      });
    },
    [atualizarParams]
  );

  const setFiltros = useCallback(
    (alteracoes: Record<string, string[]>) => {
      atualizarParams((params) => {
        Object.entries(alteracoes).forEach(([chave, valores]) => {
          params.delete(`${PREFIXO_FILTRO}${chave}`);

          valores
            .filter((valor) => valor.trim().length > 0)
            .forEach((valor) => params.append(`${PREFIXO_FILTRO}${chave}`, valor));
        });
      });
    },
    [atualizarParams]
  );

  const limparFiltros = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  return (
    <FiltroContext.Provider
      value={{
        dataInicio,
        dataFim,
        filtros,
        setDataInicio,
        setDataFim,
        setDataRange,
        setFiltro,
        setFiltros,
        limparFiltros,
        obterLinkPainel,
      }}
    >
      {children}
    </FiltroContext.Provider>
  );
}

export function useFiltro(): FiltroContexto {
  const ctx = useContext(FiltroContext);
  if (!ctx) throw new Error('useFiltro deve ser usado dentro de FiltroProvider');
  return ctx;
}
