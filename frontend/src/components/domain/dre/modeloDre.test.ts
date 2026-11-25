import { describe, expect, it } from 'vitest';
import { contasDre } from './contasDre';
import { apresentacaoDre, exportacaoDre, linhasContabeis, montarLinhas, selecionarContas } from './modeloDre';
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
    expect(c.valor(contasDre[0],'ano')).toBe(300);
    expect(c.anoParcial).toBe(true);
    expect(c.valor(contasDre.find(l => l.id === 'D217')!,'mes')).toBeNull();
    expect(apresentacaoDre(resumo,'2026-08').mesDisponivel).toBe(true);
    expect(apresentacaoDre(resumo,'2026-07').anoDisponivel).toBe(false);
    expect(apresentacaoDre(resumo,'2026-12').mesDisponivel).toBe(false);
    expect(apresentacaoDre(undefined,'2026-11').valor(contasDre[0],'mes')).toBeNull();
  });
  it('aceita o acumulado desde janeiro quando o histórico cobre o exercício', () => {
    const completo = {...resumo, historico:{...resumo.historico, primeiroFrete:'2025-09-15'}};
    expect(apresentacaoDre(completo,'2026-11').valor(contasDre[0],'ano')).toBe(300);
  });
  it('o recorte contábil conserva os pais e remete contas desconhecidas à conferência de títulos', () => {
    const contas = linhasContabeis(resumo,undefined,'INTERNET');
    expect(contas.map(c => c.id)).toEqual(['D99','D100','D128','D131']);
    expect(linhasContabeis(resumo,undefined,'SALÁRIOS').filter(c => c.nome === 'SALÁRIOS')).toHaveLength(3);
    expect(linhasContabeis(resumo,undefined,'CONTA NOVA')).toEqual([]);
    expect(linhasContabeis(resumo,{historico:{primeiraEmissao:null,atualizadoEm:null},valores:[{conta:'INTERNET',mes:10,ano:90}]},undefined,'Operadora')).toEqual(contas);
  });
  it('exibe os custos das três origens com sinal de despesa e mantém o resultado pendente até o rateio', () => {
    const dados = apresentacaoDre(resumo,'2026-11',undefined,true,[{id:'D33',mes:100,ano:null},{id:'D34',mes:3,ano:20},{id:'D35',mes:0,ano:null}]);
    const valor = (id: string, p: 'mes'|'ano') => dados.valor(contasDre.find(l => l.id === id)!,p);
    expect([valor('D33','mes'),valor('D34','ano'),valor('D35','mes')]).toEqual([-100,-20,0]);
    expect(valor('D33','ano')).toBeNull();
    expect(valor('D96','mes')).toBeNull();
  });
  it('concilia a descrição única, preserva rateio pendente e evita distribuir salários a três departamentos', () => {
    const pagar = {historico:{primeiraEmissao:'2025-12-01',atualizadoEm:'2026-11-24'},valores:[
      {conta:'INTERNET',mes:50,ano:250}, {conta:'SALÁRIOS',mes:100,ano:200}, {conta:'IPVA',mes:100,ano:100},
      {conta:'TARIFAS BANCÁRIAS',mes:null,ano:null},{conta:'JUROS RECEBIDOS',mes:3,ano:15},
    ]};
    const view = apresentacaoDre(resumo,'2026-11',pagar,false);
    const conta = (id:string) => contasDre.find(linha => linha.id === id)!;
    expect(view.valor(conta('D131'),'mes')).toBe(-50);
    expect(view.valor(conta('D131'),'ano')).toBe(-250);
    expect(view.valor(conta('D208'),'mes')).toBe(3);
    for (const id of ['D6','D16','D102','D178','D74','D156','D148','D217']) expect(view.valor(conta(id),'mes')).toBeNull();
    const parcial = apresentacaoDre(resumo,'2026-11',{...pagar,historico:{...pagar.historico,primeiraEmissao:'2026-08-16'}});
    expect(parcial.valor(conta('D131'),'ano')).toBe(-250);
  });
  it('soma cada filho conhecido uma vez, inclusive subgrupos, zerados e créditos', () => {
    const linha = (id: string) => contasDre.find(c => c.id === id)!;
    const pagar = {historico:{primeiraEmissao:'2026-08-16',atualizadoEm:'2026-11-25'},valores:[
      {conta:'ARLA',mes:19.47,ano:60}, {conta:'INTERNET',mes:0,ano:100},
      {conta:'JUROS RECEBIDOS',mes:10,ano:40}, {conta:'JUROS E ENCARGOS BANCÁRIOS',mes:10,ano:12},
    ]};
    const dados = apresentacaoDre(resumo,'2026-11',pagar,true,[{id:'D33',mes:100.55,ano:200},{id:'D35',mes:25.17,ano:100}]);
    for (const id of ['D14','D91']) {
      expect(dados.valor(linha(id),'mes')).toBe(-145.19);
      expect(dados.valor(linha(id),'ano')).toBe(-360);
    }
    for (const id of ['D99','D100','D128','D200']) {
      expect(dados.valor(linha(id),'mes')).toBe(0);
      expect(dados.valor(linha(id),'ano')).toBe(-100);
    }
    expect(dados.valor(linha('D206'),'mes')).toBe(0);
    expect(dados.valor(linha('D214'),'ano')).toBe(28);
    expect(dados.valor(linha('D15'),'mes')).toBeNull();
    expect(dados.valor(linha('D217'),'ano')).toBeNull();
    expect(exportacaoDre([linha('D14')],dados,'2026-11')).toContain('360,00');
    expect(exportacaoDre([linha('D14')],dados,'2026-11')).toContain('histórico parcial');
    expect(apresentacaoDre(resumo,'2026-07',pagar).valor(linha('D38'),'ano')).toBe(-60);
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
