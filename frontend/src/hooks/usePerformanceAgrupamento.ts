import { useSearchParams } from 'react-router-dom';
import type { PerformanceDrilldownNivel, PerformanceDrilldownParams, PerformanceFiltro } from '../types/performance';

export function usePerformanceAgrupamento(filtro: PerformanceFiltro) {
  const [query, setQuery] = useSearchParams();
  const valor = query.get('drillNivel');
  const nivel: PerformanceDrilldownNivel = valor === 'cidade' || valor === 'regiao' ? valor : 'responsavel';
  const responsavel = nivel !== 'responsavel' ? query.get('drillResponsavel')?.trim() || null : null;
  const regiao = nivel === 'cidade' ? query.get('drillRegiao')?.trim() || null : null;
  const parametros: PerformanceDrilldownParams = { nivel, responsavel, regiaoDestino: regiao };
  // O detalhamento e o CSV recebem as mesmas condições exatas da barra selecionada.
  const filtroDetalhamento = { ...filtro, drillResponsavel: responsavel, drillRegiao: regiao };

  function navegar(novoNivel: PerformanceDrilldownNivel, novoResponsavel: string | null = null, novaRegiao: string | null = null) {
    const next = new URLSearchParams(query);
    next.delete('drillNivel');
    next.delete('drillResponsavel');
    next.delete('drillRegiao');
    if (novoNivel !== 'responsavel') next.set('drillNivel', novoNivel);
    if (novoResponsavel) next.set('drillResponsavel', novoResponsavel);
    if (novaRegiao) next.set('drillRegiao', novaRegiao);
    setQuery(next, { replace: true, preventScrollReset: true });
  }

  function abrirGrupo(nome: string | null) {
    if (!nome) return;
    if (nivel === 'responsavel') navegar('regiao', nome);
    if (nivel === 'regiao') navegar('cidade', responsavel, nome);
  }

  function voltar() {
    if (nivel === 'cidade') navegar('regiao', responsavel);
    else navegar('responsavel');
  }

  return { nivel, responsavel, regiao, parametros, filtroDetalhamento, selecionarNivel: navegar, abrirGrupo, voltar } as const;
}
