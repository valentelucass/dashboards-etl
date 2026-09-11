import type { DiaEtapa, EtapaIntegracao, IndicadorEtapa } from '../api/endpoints/integracoesEtapas';

export function rotuloEtapa(item: Pick<IndicadorEtapa, 'sistemaDestino' | 'etapa'>): string {
  if (item.etapa === 'COMPROVANTE') return item.sistemaDestino === 'SELIA' ? 'POD/Comprovante' : 'Comprovante';
  if (item.sistemaDestino === 'SELIA') return 'AddEvents';
  return item.sistemaDestino === 'SUPPORTE' ? 'Ocorrência' : 'XML/Dados';
}

export function completarDiasEtapas(inicio: string, fim: string, valores: DiaEtapa[], etapa: EtapaIntegracao): DiaEtapa[] {
  const index = new Map(valores.filter(item => item.etapa === etapa).map(item => [item.data, item]));
  const resultado: DiaEtapa[] = [];
  const dia = new Date(`${inicio}T00:00:00Z`);
  const limite = new Date(`${fim}T00:00:00Z`);
  while (dia <= limite) {
    const data = dia.toISOString().slice(0, 10);
    resultado.push(index.get(data) ?? { data, etapa, sucessos: 0, falhas: 0 });
    dia.setUTCDate(dia.getUTCDate() + 1);
  }
  return resultado;
}
