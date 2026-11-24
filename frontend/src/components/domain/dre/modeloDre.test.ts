import { describe, expect, it } from 'vitest';
import { contasDre } from './contasDre';
import { apresentacaoDre, exportacaoDre, montarLinhas, selecionarContas } from './modeloDre';
import type { ResumoDre } from '../../../api/endpoints/dreServico';

const resumo: ResumoDre = {
  historico: {primeiroFrete:'2026-08-17', atualizadoEm:'2026-11-24T12:00:00'},
  valores: [
    {classe:null,tipo:null,mes:120,ano:300}, {classe:'FTL',tipo:null,mes:100,ano:280},
    {classe:'FTL',tipo:'NORMAL',mes:100,ano:280}, {classe:'OUTRA',tipo:null,mes:20,ano:20},
    {classe:'OUTRA',tipo:'NORMAL',mes:20,ano:20},
  ],
};

describe('demonstrativo de Custos', () => {
  it('preserva todas as linhas da planilha, inclusive contas com nome idêntico em grupos diferentes', () => {
    expect(contasDre).toHaveLength(224);
    const anteriores = new Set<string>();
    for (const c of contasDre) {
      expect(c.pai === null || anteriores.has(c.pai)).toBe(true);
      expect(anteriores.has(c.id)).toBe(false);
      anteriores.add(c.id);
    }
    expect(contasDre.filter(c => c.nome === 'SALÁRIOS').map(c => c.pai)).toEqual(['D15','D101','D177']);
    expect(contasDre.at(-1)?.id).toBe('D218');
  });
  it('mantém classificações fora das três famílias do modelo rastreáveis até o total', () => {
    const contas = montarLinhas(resumo);
    expect(contas.filter(c => c.pai === 'D6').map(c => c.id)).toEqual(['FTL','LTL','PTL','OUTRA']);
    expect(contas[contas.findIndex(c => c.id === 'D7')-1].id).toBe('OUTRA.NORMAL');
    const view = apresentacaoDre(resumo, '2026-11');
    expect(contas.filter(c => c.pai === 'D6').reduce((s,c) => s + (view.valor(c,'mes') ?? 0),0)).toBe(120);
  });
  it('distingue zero real de orçamento, custo ou período indisponível', () => {
    const c = apresentacaoDre(resumo,'2026-11');
    expect(c.valor(contasDre[0],'mes')).toBe(120);
    expect(c.valor(contasDre.find(l => l.id === 'LTL')!,'mes')).toBe(0);
    expect(c.valor(contasDre[0],'ano')).toBeNull();
    expect(c.valor(contasDre.find(l => l.id === 'D217')!,'mes')).toBeNull();
    expect(apresentacaoDre(resumo,'2026-08').mesDisponivel).toBe(false);
    expect(apresentacaoDre(resumo,'2026-12').mesDisponivel).toBe(false);
    expect(apresentacaoDre(undefined,'2026-11').valor(contasDre[0],'mes')).toBeNull();
  });
  it('aceita o acumulado desde janeiro quando o histórico cobre o exercício', () => {
    const completo = {...resumo, historico:{...resumo.historico, primeiroFrete:'2025-09-15'}};
    expect(apresentacaoDre(completo,'2026-11').valor(contasDre[0],'ano')).toBe(300);
  });
  it('exporta as sete colunas, todos os níveis do filtro, os totais e a ausência de orçamento', () => {
    const linhas = selecionarContas(montarLinhas(resumo), 'salarios');
    expect(linhas.filter(c => c.nome === 'SALÁRIOS')).toHaveLength(3);
    expect(linhas.some(c => c.id === 'D217')).toBe(false);
    const csv = exportacaoDre(linhas, apresentacaoDre(resumo,'2026-11'),'2026-11');
    expect(csv.split('\r\n').every(l => l.split(';').length === 7)).toBe(true);
    expect(csv).toContain('DESPESAS / COMERCIAL / PESSOAL / SALÁRIOS');
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('0,00');
  });
});
