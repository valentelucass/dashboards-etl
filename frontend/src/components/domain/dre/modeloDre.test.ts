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
  it('soma os três materiais em Uso e Consumo uma única vez em ADM no mês e no ano', () => {
    const pagar = {historico: {primeiraEmissao: '2026-01-01', atualizadoEm: null}, valores: [
      {conta: 'MATERIAL DE ESCRITÓRIO', mes: 0, ano: 120},
      {conta: 'MATERIAL DE HIGIENE E LIMPEZA', mes: 6292.35, ano: 12340.55},
      {conta: 'MATERIAL PARA COZINHA E REFEITÓRIO', mes: 7967.36, ano: 8439.76},
      {conta: 'TARIFAS BANCÁRIAS', mes: 10, ano: 30},
    ]};
    const dados = apresentacaoDre(resumo, '2026-09', pagar);
    const grupo = contasDre.find(c => c.id === 'D144')!;
    const adm = contasDre.find(c => c.id === 'D100')!;
    expect(selecionarContas(contasDre, grupo.nome).map(c => c.id))
      .toEqual(['D99', 'D100', 'D144', 'D145', 'D146', 'D147']);
    expect([dados.valor(grupo, 'mes'), dados.valor(grupo, 'ano')]).toEqual([-14259.71, -20900.31]);
    expect([dados.valor(adm, 'mes'), dados.valor(adm, 'ano')]).toEqual([-14269.71, -20930.31]);
    const filtro = linhasContabeis(resumo, pagar, 'MATERIAL DE HIGIENE E LIMPEZA');
    expect(filtro.map(c => c.id)).toEqual(['D99', 'D100', 'D144', 'D146']);
    expect(exportacaoDre(filtro, dados, '2026-09'))
      .toContain('DESPESAS / ADM / USO E CONSUMO (ESCRIT. / HIGIE.) / MATERIAL DE HIGIENE E LIMPEZA');
  });

  it('concilia folha por departamento, tributos compostos, combustível e pendências sem duplicar o DRE', () => {
    const pagar = {historico:{primeiraEmissao:'2026-01-01',atualizadoEm:'2026-11-25'},valores:[
      {conta:'FGTS',linhaDre:'D24',mes:40,ano:100},{conta:'FGTS',linhaDre:'D110',mes:30,ano:80},
      {conta:'FGTS',linhaDre:'D185',mes:20,ano:60},{conta:'FGTS',linhaDre:'PESSOAL_REVISAR',mes:10,ano:15},
      {conta:'PIS A RECOLHER',linhaDre:'D9',mes:2.11,ano:12.30},{conta:'COFINS A RECOLHER',linhaDre:'D9',mes:3.12,ano:21.81},
      {conta:'CONTRIBUIÇÃO PREVIDENCIARIA A RECOLHER',linhaDre:'D10',mes:4,ano:14},
      {conta:'ABASTECIMENTOS ( TRIVALE E POSTOS )',linhaDre:'D36',mes:12,ano:40},
      {conta:'SOFTWARES E LICENÇAS',linhaDre:'D130',mes:3,ano:5},
      {conta:'PLANO DE SAÚDE',linhaDre:'D143',mes:6,ano:7},
      {conta:'FGTS A RECOLHER',mes:1000,ano:2000},{conta:'ICMS',mes:99,ano:99},
    ]};
    const dados = apresentacaoDre(resumo,'2026-09',pagar);
    const linha = (id:string) => contasDre.find(c=>c.id===id)!;
    expect(['D15','D101','D177','D9','D10','D36','D7','D14','D99'].map(id=>dados.valor(linha(id),'mes')))
      .toEqual([-40,-30,-20,-5.23,-4,-12,-9.23,-52,-59]);
    expect(dados.valor(linha('D143'),'mes')).toBe(-6);
    expect(dados.valor(linha('D128'),'mes')).toBe(-3);
    expect(linhasContabeis(resumo,pagar,'SOFTWARES E LICENÇAS').map(c=>c.id)).toEqual(['D99','D100','D128','D130']);
    expect(dados.valor(linha('D9'),'ano')).toBe(-34.11);
    expect(dados.valor(linha('D8'),'mes')).toBeNull();
    expect(dados.pessoalPendente).toEqual({mes:10,ano:15});
    expect(linhasContabeis(resumo,pagar,'COFINS A RECOLHER').map(c=>c.id)).toEqual(['D7','D9']);
    expect(dados.contaPagar(linha('D24'))?.linha).toBe('D24');
    expect(exportacaoDre([linha('D9')],dados,'2026-09')).toContain('34,11');
  });
  it('preserva a hierarquia sem os três rodapés TOTAL e mantém contas homônimas em seus grupos', () => {
    expect(contasDre).toHaveLength(221);
    expect(contasDre.some(c => c.nome === 'TOTAL')).toBe(false);
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
    const lucro = contasDre.find(l => l.id === 'D217')!;
    expect(c.valor(lucro,'mes')).toBe(120);
    expect(c.resultadoParcial(lucro,'mes')).toBe(true);
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
  it('inclui os custos disponíveis no lucro bruto e identifica o resultado parcial enquanto falta rateio', () => {
    const dados = apresentacaoDre(resumo,'2026-11',undefined,true,[{id:'D33',mes:100,ano:null},{id:'D34',mes:3,ano:20},{id:'D35',mes:0,ano:null}]);
    const valor = (id: string, p: 'mes'|'ano') => dados.valor(contasDre.find(l => l.id === id)!,p);
    expect([valor('D33','mes'),valor('D34','ano'),valor('D35','mes')]).toEqual([-100,-20,0]);
    expect(valor('D33','ano')).toBeNull();
    expect(valor('D96','mes')).toBe(17);
    expect(dados.resultadoParcial(contasDre.find(l => l.id === 'D96')!,'mes')).toBe(true);
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
    expect(dados.valor(linha('D14'),'mes')).toBe(-145.19);
    expect(dados.valor(linha('D14'),'ano')).toBe(-360);
    for (const id of ['D99','D100','D128']) {
      expect(dados.valor(linha(id),'mes')).toBe(0);
      expect(dados.valor(linha(id),'ano')).toBe(-100);
    }
    expect(dados.valor(linha('D206'),'mes')).toBe(0);
    expect(dados.valor(linha('D206'),'ano')).toBe(28);
    expect(dados.valor(linha('D15'),'mes')).toBeNull();
    expect(dados.valor(linha('D217'),'ano')).toBe(-132);
    expect(exportacaoDre([linha('D14')],dados,'2026-11')).toContain('360,00');
    expect(exportacaoDre([linha('D14')],dados,'2026-11')).toContain('histórico parcial');
    expect(apresentacaoDre(resumo,'2026-07',pagar).valor(linha('D38'),'ano')).toBe(-60);
  });
  it('exporta as onze colunas, todos os níveis do filtro e a ausência de orçamento', () => {
    const linhas = selecionarContas(montarLinhas(resumo), 'salarios');
    expect(linhas.filter(c => c.nome === 'SALÁRIOS')).toHaveLength(3);
    expect(linhas.some(c => c.id === 'D217')).toBe(false);
    const csv = exportacaoDre(linhas, apresentacaoDre(resumo,'2026-11'),'2026-11');
    expect(csv.split('\r\n').every(l => l.split(';').length === 11)).toBe(true);
    expect(csv).toContain('DESPESAS / COMERCIAL / PESSOAL / SALÁRIOS');
    expect(csv).not.toContain('undefined');
    expect(csv).not.toContain('0,00');
  });
  it('calcula todas as fórmulas e cada % ROL com o sinal, o período e a base do cenário correspondente', () => {
    const receitas: ResumoDre = {...resumo, valores:[{classe:null,tipo:null,mes:1000,ano:2200}],
      orcamento:[{contaId:'D6',mes:900,ano:2500},{contaId:'D8',mes:-150,ano:-500},
        {contaId:'D33',mes:-150,ano:-400},{contaId:'D94',mes:-70,ano:-100}]};
    const pagar = {historico:{primeiraEmissao:'2026-01-01',atualizadoEm:'2026-11-25'},valores:[
      {conta:'ICMS A RECOLHER',linhaDre:'D8',mes:200,ano:200}, {conta:'INTERNET',mes:60,ano:190},
      {conta:'JUROS RECEBIDOS',mes:10,ano:30}, {conta:'JUROS E ENCARGOS BANCÁRIOS',mes:12,ano:20},
    ]};
    const dados = apresentacaoDre(receitas,'2026-11',pagar,true,[{id:'D33',mes:300,ano:900},{id:'D94',mes:80,ano:150}]);
    const linha = (id:string) => contasDre.find(c => c.id === id)!;
    const resultados = ['D12','D96','D203','D217'];
    expect(resultados.map(id => dados.valor(linha(id),'mes'))).toEqual([800,420,360,358]);
    expect(resultados.map(id => dados.valor(linha(id),'ano'))).toEqual([2000,950,760,770]);
    expect(dados.resultadoParcial(linha('D217'),'mes')).toBe(false);
    expect(['D97','D204','D218'].map(id => dados.celulasPeriodo(linha(id),'mes')[0])).toEqual(['52,5%','45,0%','44,8%']);
    expect(['D97','D204','D218'].map(id => dados.celulasPeriodo(linha(id),'ano')[0])).toEqual(['47,5%','38,0%','38,5%']);
    const roles = (id:string, periodo:'ano'|'mes') => {
      const colunas = dados.celulasPeriodo(linha(id),periodo);
      return [colunas[1],colunas[3]];
    };
    expect(roles('D6','mes')).toEqual(['125,0%','120,0%']);
    expect(roles('D12','mes')).toEqual(['100,0%','100,0%']);
    expect(roles('D14','mes')).toEqual(['-37,5%','-20,0%']);
    expect(roles('D14','ano')).toEqual(['-45,0%','-20,0%']);
    expect(roles('D97','mes')).toEqual(['—','—']);
    expect(roles('D38','mes')).toEqual(['—','—']);
    expect(dados.celulasPeriodo(linha('D97'),'mes')[2]).toBe('70,7%');
    const csv = exportacaoDre([linha('D14')],dados,'2026-11').split('\r\n')[1];
    expect(csv.split(';').map(c => c.slice(1,-1))).toEqual(['CUSTO OPERACIONAL',...dados.celulasPeriodo(linha('D14'),'mes'),...dados.celulasPeriodo(linha('D14'),'ano')]);
  });
  it('preserva saldos negativos e zeros e não calcula percentuais com receita líquida zero ou ausente', () => {
    const pagar = {historico:{primeiraEmissao:'2026-01-01',atualizadoEm:'2026-11-25'},valores:[{conta:'ICMS A RECOLHER',linhaDre:'D8',mes:120,ano:400}]};
    const dados = apresentacaoDre(resumo,'2026-11',pagar,true,[{id:'D33',mes:8,ano:12},{id:'D35',mes:0,ano:0}]);
    const linha = (id:string) => contasDre.find(c => c.id === id)!;
    expect(dados.valor(linha('D12'),'mes')).toBe(0);
    expect(dados.valor(linha('D96'),'mes')).toBe(-8);
    expect(dados.celulasPeriodo(linha('D12'),'mes')[1]).toBe('—');
    expect(dados.celulasPeriodo(linha('D97'),'mes')[0]).toBe('—');
    expect(dados.celulasPeriodo(linha('D12'),'ano')[1]).toBe('100,0%');
    expect(dados.celulasPeriodo(linha('D35'),'ano')[1]).toBe('0,0%');
    expect(dados.celulasPeriodo(linha('D14'),'ano')[1]).toBe('12,0%');
    const semReceita = apresentacaoDre(resumo,'2026-11',pagar,false);
    for (const id of ['D12','D96','D203','D217']) expect(semReceita.valor(linha(id),'mes')).toBeNull();
    expect(semReceita.celulasPeriodo(linha('D8'),'mes')[1]).toBe('—');
  });
});
