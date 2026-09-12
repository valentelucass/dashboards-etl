import clienteAxios from '../clienteAxios';

export type EtapaIntegracao = 'DADOS' | 'COMPROVANTE';

export interface IndicadorEtapa {
  sistemaDestino: string;
  etapa: EtapaIntegracao;
  sucessosPeriodo: number;
  falhasPeriodo: number;
  pendentesAtuais: number;
  bloqueadosAtuais: number;
  semConfirmacaoDatada: number;
  confirmadosSemDataConfiavel: number;
}

export interface DiaEtapa {
  data: string;
  etapa: EtapaIntegracao;
  sucessos: number;
  falhas: number;
}

export interface IndicadoresEtapas {
  versao: 2;
  dataInicial: string;
  dataFinal: string;
  etapas: IndicadorEtapa[];
  evolucao: DiaEtapa[];
}

const contagem = (valor: unknown) => typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
const etapaValida = (etapa: unknown) => etapa === 'DADOS' || etapa === 'COMPROVANTE';

export async function buscarIndicadoresEtapas(
  inicio: string, fim: string, destinos: string[], signal?: AbortSignal,
): Promise<IndicadoresEtapas> {
  const params = new URLSearchParams({ dataInicial: inicio, dataFinal: fim });
  destinos.forEach(destino => params.append('destino', destino));
  const { data } = await clienteAxios.get<IndicadoresEtapas>('/api/painel/integracoes/indicadores-etapas', { params, signal });
  // Sem fallback para os percentuais antigos: resposta incompatível não significa zero envios.
  if (data?.versao !== 2 || data.dataInicial !== inicio || data.dataFinal !== fim
    || !Array.isArray(data.etapas) || !Array.isArray(data.evolucao)
    || data.etapas.some(item => !item || !etapaValida(item.etapa) || typeof item.sistemaDestino !== 'string'
      || (destinos.length > 0 && !destinos.includes(item.sistemaDestino))
      || ![item.sucessosPeriodo, item.falhasPeriodo, item.pendentesAtuais, item.bloqueadosAtuais, item.semConfirmacaoDatada, item.confirmadosSemDataConfiavel].every(contagem))
    || data.evolucao.some(item => !item || !etapaValida(item.etapa)
      || typeof item.data !== 'string' || item.data < inicio || item.data > fim
      || !contagem(item.sucessos) || !contagem(item.falhas))) {
    throw new Error('Os indicadores por etapa estão incompatíveis com o período ou a integração selecionada.');
  }
  return data;
}
