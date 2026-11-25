import type { CustoTransporteDre, ResumoDre, ResumoPagarDre } from '../../../api/endpoints/dreServico';
import { formatarMoeda } from '../../../utils/formatadores';
import { contasDre, type ContaDre } from './contasDre';

export const nomesTipos: Record<string, string> = {
  NORMAL: 'NORMAL', REENTREGA: 'REENTREGA', DEVOLUCAO: 'DEVOLUÇÃO',
  COMPLEMENTAR: 'COMPLEMENTAR', SUBSTITUICAO: 'SUBSTITUIÇÃO', OUTRO: 'Demais tipos',
};

export function chaveReceita(classe: string | null, tipo: string | null) {
  if (!classe) return 'D6';
  return tipo ? classe + '.' + tipo : classe;
}

export function montarLinhas(resumo?: ResumoDre): ContaDre[] {
  const linhas = [...contasDre];
  // Mantém as classificações adicionais da origem reconciliáveis com o total de Faturamento.
  const adicionais = (resumo?.valores ?? []).filter(v => v.classe && (v.mes !== 0 || v.ano !== 0)
    && (v.classe === 'OUTRA' || v.tipo === 'OUTRO'));
  for (const classe of ['FTL', 'LTL', 'PTL', 'OUTRA']) {
    const valores = adicionais.filter(v => v.classe === classe);
    if (!valores.length) continue;
    const novas: ContaDre[] = [];
    if (classe === 'OUTRA') novas.push({id: classe, pai: 'D6', nome: 'Demais classificações', fonte: 'fretes'});
    for (const v of valores.filter(v => v.tipo).sort((a, b) => String(a.tipo).localeCompare(String(b.tipo)))) {
      novas.push({id: chaveReceita(classe, v.tipo), pai: classe, nome: nomesTipos[v.tipo!] ?? v.tipo!, fonte: 'fretes'});
    }
    const ultima = classe === 'OUTRA' ? linhas.findIndex(l => l.id === 'D7') : linhas.map(l => l.pai).lastIndexOf(classe) + 1;
    linhas.splice(ultima, 0, ...novas);
  }
  return linhas;
}

function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
}

export function selecionarContas(contas: ContaDre[], busca: string) {
  const termo = normalizar(busca.trim());
  if (!termo) return contas;
  const relevantes = new Set<string>();
  const agrupamentos = new Set<string>();
  const porId = new Map(contas.map(c => [c.id, c]));
  for (const conta of contas) {
    if (normalizar(conta.nome).includes(termo) || (conta.pai && agrupamentos.has(conta.pai))) {
      agrupamentos.add(conta.id);
      let atual: ContaDre | undefined = conta;
      while (atual && !relevantes.has(atual.id)) {
        relevantes.add(atual.id);
        atual = atual.pai ? porId.get(atual.pai) : undefined;
      }
    }
  }
  return contas.filter(c => relevantes.has(c.id));
}

const nomesPagar = new Map<string, number>();
const nomeContabil = (nome: string) => nome.trim().toLocaleUpperCase('pt-BR');
for (const linha of contasDre.filter(l => l.fonte === 'pagar')) {
  const nome = nomeContabil(linha.nome);
  nomesPagar.set(nome, (nomesPagar.get(nome) ?? 0) + 1);
}

export function linhasContabeis(resumo: ResumoDre | undefined, pagar: ResumoPagarDre | undefined, conta?: string, fornecedor?: string) {
  const linhas = montarLinhas(resumo);
  if (!conta && !fornecedor) return linhas;
  const nomes = new Set(conta ? [nomeContabil(conta)] : pagar?.valores.map(l => nomeContabil(l.conta)));
  const ids = new Set<string>();
  for (let i = linhas.length - 1; i >= 0; i--) {
    const l = linhas[i];
    if (l.fonte === 'pagar' && nomes.has(nomeContabil(l.nome))) ids.add(l.id);
    if (l.pai && ids.has(l.id)) ids.add(l.pai);
  }
  return linhas.filter(l => ids.has(l.id));
}

const porId = new Map(contasDre.map(linha => [linha.id, linha]));
const resultados: Record<string, string[]> = {
  D12: ['D6', 'D7'],
  D96: ['D12', 'D14', 'D93'],
  D203: ['D96', 'D99'],
  D217: ['D203', 'D206'],
};
const margens: Record<string, string> = {D97:'D96', D201:'D99', D204:'D203', D215:'D206', D218:'D217'};
const componentes = new Map(contasDre.map(conta => {
  const calculo = margens[conta.id] ? [margens[conta.id], 'D12'] : resultados[conta.id];
  if (calculo) return [conta.id, calculo.map(id => porId.get(id)!)];
  const filhos = conta.fonte === 'grupo' || conta.fonte === 'classificacao'
    ? contasDre.filter(c => c.pai === conta.id && c.fonte !== 'percentual') : [];
  return [conta.id, filhos];
}));

export function composicaoConta(conta: ContaDre): ContaDre[] {
  return componentes.get(conta.id) ?? [];
}

type Periodo = 'mes' | 'ano';
type Cenario = 'realizado' | 'orcado';
export const colunasPeriodoDre = ['Realizado', '% ROL', 'Orçado', '% ROL', 'Variação R$ / %'] as const;
function percentual(valor: number | null, base: number | null) {
  if (valor == null || base == null || base === 0) return null;
  return valor === 0 ? 0 : 100 * valor / base;
}

export function apresentacaoDre(resumo: ResumoDre | undefined, competencia: string, pagar?: ResumoPagarDre, aplicaFretes = true, transporte: CustoTransporteDre[] = []) {
  const primeiro = resumo?.historico.primeiroFrete;
  const atualizado = resumo?.historico.atualizadoEm?.slice(0, 10);
  const mes = competencia + '-01';
  const ano = competencia.slice(0, 4) + '-01-01';
  const temFretesAteCompetencia = Boolean(primeiro && primeiro.slice(0, 7) <= competencia);
  const mesDisponivel = temFretesAteCompetencia && Boolean(atualizado && atualizado >= mes);
  const anoDisponivel = temFretesAteCompetencia && Boolean(atualizado && atualizado >= ano);
  const valores = new Map(resumo?.valores.map(v => [chaveReceita(v.classe, v.tipo), v]));
  const orcamento = new Map((aplicaFretes ? resumo?.orcamento : undefined)?.map(v => [v.contaId, v]));
  const contas = new Map(pagar?.valores.map(v => [nomeContabil(v.conta), v]));
  const custosTransporte = new Map(transporte.map(v => [v.id,v]));
  const primeira = pagar?.historico.primeiraEmissao;
  const anoParcial = Boolean((aplicaFretes && anoDisponivel && primeiro && primeiro > ano)
    || (pagar?.valores.length && primeira && primeira > ano) || pagar?.valores.some(v => v.anoParcial)
    || transporte.some(v => v.anoParcial));
  function contaPagar(linha: ContaDre) {
    const nome = nomeContabil(linha.nome);
    return linha.fonte === 'pagar' && nomesPagar.get(nome) === 1 ? contas.get(nome) : undefined;
  }
  function valorFolha(conta: ContaDre, periodo: Periodo) {
    const operacional = custosTransporte.get(conta.id);
    if (operacional) {
      const custo = operacional[periodo];
      return custo == null || custo === 0 ? custo : -custo;
    }
    if (conta.fonte === 'fretes') {
      if (!aplicaFretes || !(periodo === 'mes' ? mesDisponivel : anoDisponivel)) return null;
      return valores.get(conta.id)?.[periodo] ?? 0;
    }
    // O SQL já selecionou o lançamento pela competência, que pode preceder sua emissão.
    const lancamento = contaPagar(conta);
    const quantia = lancamento?.[periodo];
    if (quantia == null || quantia === 0) return quantia ?? null;
    return conta.pai === 'D207' ? quantia : -quantia;
  }
  function valor(conta: ContaDre, periodo: Periodo, cenario: Cenario = 'realizado'): number | null {
    if (margens[conta.id]) {
      return percentual(valor(porId.get(margens[conta.id])!, periodo, cenario), valor(porId.get('D12')!, periodo, cenario));
    }
    if (cenario === 'orcado' && !orcamento.size) return null;
    const partes = composicaoConta(conta);
    if (cenario === 'orcado' && conta.fonte !== 'resultado') {
      const previsto = orcamento.get(conta.id)?.[periodo];
      if (previsto != null) return previsto;
    }
    if (!partes.length) return cenario === 'realizado' ? valorFolha(conta, periodo) : null;
    let centavos: number | null = null;
    for (const parte of partes) {
      const parcela = valor(parte, periodo, cenario);
      // A primeira parcela é a base do resultado (receita bruta, receita líquida, lucro bruto ou EBIT).
      if (parcela == null && conta.fonte === 'resultado' && parte === partes[0]) return null;
      if (parcela != null) centavos = (centavos ?? 0) + Math.round(parcela * 100);
    }
    return centavos === null ? null : centavos / 100;
  }
  function celulasPeriodo(conta: ContaDre, periodo: Periodo) {
    const realizado = valor(conta, periodo);
    const orcado = valor(conta, periodo, 'orcado');
    const monetaria = conta.fonte !== 'percentual';
    const liquida = porId.get('D12')!;
    const rolReal = monetaria && realizado != null ? percentual(realizado, valor(liquida, periodo)) : null;
    const rolOrcado = monetaria && orcado != null ? percentual(orcado, valor(liquida, periodo, 'orcado')) : null;
    const diferenca = monetaria && realizado != null && orcado != null
      ? (Math.round(realizado * 100) - Math.round(orcado * 100)) / 100 : null;
    return [formatarConta(conta, realizado), formatarPercentual(rolReal), formatarConta(conta, orcado),
      formatarPercentual(rolOrcado), diferenca == null ? '—' : dinheiro(diferenca) + ' / ' + formatarPercentual(percentual(diferenca, orcado))];
  }
  function resultadoParcial(conta: ContaDre, periodo: Periodo): boolean {
    if (conta.fonte !== 'resultado' && conta.fonte !== 'percentual') return false;
    return composicaoConta(conta).some(parte => valor(parte, periodo) == null || resultadoParcial(parte, periodo));
  }
  return {mesDisponivel, anoDisponivel, anoParcial, aplicaFretes, temOrcamento: orcamento.size > 0, contaPagar, valor, celulasPeriodo, resultadoParcial};
}

export function dinheiro(valor: number | null) {
  return valor == null ? '—' : formatarMoeda(valor);
}

const formatoPercentual = new Intl.NumberFormat('pt-BR', {style:'percent', minimumFractionDigits:1, maximumFractionDigits:1});
function formatarPercentual(valor: number | null) {
  return valor == null ? '—' : formatoPercentual.format(valor / 100);
}

export function formatarConta(conta: ContaDre, valor: number | null) {
  return conta.fonte === 'percentual' ? formatarPercentual(valor) : dinheiro(valor);
}

export function exportacaoDre(linhas: ContaDre[], dados: ReturnType<typeof apresentacaoDre>, competencia: string) {
  const colunas = ['Conta', ...[competencia, 'Jan a ' + competencia].flatMap((periodo,i) => [
    periodo + ' · Realizado' + (i === 1 && dados.anoParcial ? ' (histórico parcial)' : ''),
    periodo + ' · % ROL realizado', periodo + ' · Orçado', periodo + ' · % ROL orçado', periodo + ' · Variação R$ / %',
  ])];
  const caminho = new Map<string, string>();
  const celula = (valor: string) => '"' + valor.replaceAll('"', '""') + '"';
  const linhasCsv = [colunas];
  for (const linha of linhas) {
    const nome = linha.pai ? caminho.get(linha.pai) + ' / ' + linha.nome : linha.nome;
    caminho.set(linha.id, nome);
    linhasCsv.push([nome, ...dados.celulasPeriodo(linha,'mes'), ...dados.celulasPeriodo(linha,'ano')]);
  }
  return '\uFEFF' + linhasCsv.map(c => c.map(celula).join(';')).join('\r\n');
}
