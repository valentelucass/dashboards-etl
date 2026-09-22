import clienteAxios from '../clienteAxios';
import type { EtapaIntegracao } from './integracoesEtapas';

export const ACOES_ETAPA = {
  AGUARDANDO_PROCESSAMENTO: 'Aguardando processamento',
  NOVA_TENTATIVA: 'Aguardando nova tentativa',
  AGUARDANDO_ORIGEM: 'Aguardando origem',
  AGUARDANDO_CONFIRMACAO: 'Aguardando confirmação',
  INTERVENCAO: 'Exige intervenção',
  A_CONFERIR: 'A conferir',
} as const;
export type AcaoEtapa = keyof typeof ACOES_ETAPA;
export interface EtapaOperacional {
  sistemaDestino: string; etapa: EtapaIntegracao; sucessosPeriodo: number;
  aguardandoProcessamento: number; novaTentativa: number; aguardandoOrigem: number;
  aguardandoConfirmacao: number; intervencao: number; semConfirmacaoDatada: number; confirmadosSemDataConfiavel: number;
}
export interface AtividadeEtapa {
  data: string; etapa: EtapaIntegracao; avaliacoes: number; enviosIniciados: number;
  reenviosIniciados: number; consultasOrigem: number; retencoes: number; confirmacoesAvaliadas: number;
}
export interface IndicadoresOperacionais {
  versao: 3; dataInicial: string; dataFinal: string; etapas: EtapaOperacional[];
  evolucao: { data: string; etapa: EtapaIntegracao; sucessos: number }[];
  atividade: AtividadeEtapa[]; historicoDesde: string | null; escopoTransmissoes: 'VEDACIT';
}
export interface PendenciaEtapa {
  id: number; sistemaDestino: string; etapa: EtapaIntegracao; documento: string; acao: AcaoEtapa; motivo: string;
  pendenteDesde: string | null; ultimaAvaliacao: string | null; proximaAvaliacao: string | null;
}
export interface PendenciasEtapas { itens: PendenciaEtapa[]; totalElementos: number; pagina: number; tamanho: number }
const contagem = (v: unknown) => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const etapaValida = (v: unknown) => v === 'DADOS' || v === 'COMPROVANTE';
const dataHora = (v: unknown) => v === null || (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)));

export async function buscarIndicadoresOperacionais(inicio: string, fim: string, destinos: string[], signal?: AbortSignal): Promise<IndicadoresOperacionais> {
  const params = new URLSearchParams({ dataInicial: inicio, dataFinal: fim });
  destinos.forEach(destino => params.append('destino', destino));
  const { data } = await clienteAxios.get<IndicadoresOperacionais>('/api/painel/integracoes/indicadores-operacionais', { params, signal });
  if (data?.versao !== 3 || data.dataInicial !== inicio || data.dataFinal !== fim || data.escopoTransmissoes !== 'VEDACIT'
    || !dataHora(data.historicoDesde) || !Array.isArray(data.etapas) || !Array.isArray(data.evolucao) || !Array.isArray(data.atividade)
    || data.etapas.some(e => !e || !etapaValida(e.etapa) || typeof e.sistemaDestino !== 'string'
      || (destinos.length > 0 && !destinos.includes(e.sistemaDestino))
      || ![e.sucessosPeriodo, e.aguardandoProcessamento, e.novaTentativa, e.aguardandoOrigem, e.aguardandoConfirmacao,
        e.intervencao, e.semConfirmacaoDatada, e.confirmadosSemDataConfiavel].every(contagem))
    || data.evolucao.some(d => !d || !etapaValida(d.etapa) || typeof d.data !== 'string' || d.data < inicio || d.data > fim || !contagem(d.sucessos))
    || data.atividade.some(d => !d || !etapaValida(d.etapa) || typeof d.data !== 'string' || d.data < inicio || d.data > fim
      || ![d.avaliacoes, d.enviosIniciados, d.reenviosIniciados, d.consultasOrigem, d.retencoes, d.confirmacoesAvaliadas].every(contagem)
      || d.reenviosIniciados > d.enviosIniciados || d.retencoes + d.confirmacoesAvaliadas > d.avaliacoes)) {
    throw new Error('Os indicadores operacionais estão incompatíveis com a seleção.');
  }
  return data;
}

export async function buscarPendenciasEtapas(destino: string, etapa: EtapaIntegracao, acao: AcaoEtapa, pagina: number, signal?: AbortSignal): Promise<PendenciasEtapas> {
  const params = new URLSearchParams({ destino, etapa, acao, pagina: String(pagina), tamanho: '25' });
  const { data } = await clienteAxios.get<PendenciasEtapas>('/api/painel/integracoes/pendencias-etapas', { params, signal });
  if (!data || data.pagina !== pagina || data.tamanho !== 25 || !contagem(data.totalElementos) || !Array.isArray(data.itens)
    || data.itens.length > 25 || data.itens.some(i => !i || !contagem(i.id) || i.sistemaDestino !== destino || i.etapa !== etapa || i.acao !== acao
      || typeof i.documento !== 'string' || typeof i.motivo !== 'string' || ![i.pendenteDesde, i.ultimaAvaliacao, i.proximaAvaliacao].every(dataHora))) {
    throw new Error('As pendências retornadas não correspondem à seleção.');
  }
  return data;
}
