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
const totais: Record<string, string[]> = {
  D12:['D6','D7'], D91:['D14'], D96:['D12','D91','D94'], D200:['D99'],
  D203:['D96','D200'], D214:['D206'], D217:['D203','D214'],
};
const margens: Record<string, string> = {D97:'D96',D201:'D200',D204:'D203',D215:'D214',D218:'D217'};
const componentes = new Map(contasDre.map(conta => {
  const calculo = margens[conta.id] ? [margens[conta.id], 'D12'] : totais[conta.id];
  if (calculo) return [conta.id, calculo.map(id => porId.get(id)!)];
  const filhos = conta.fonte === 'grupo' || conta.fonte === 'classificacao'
    ? contasDre.filter(c => c.pai === conta.id && !totais[c.id] && !margens[c.id]) : [];
  return [conta.id, filhos];
}));

export function composicaoConta(conta: ContaDre): ContaDre[] {
  return componentes.get(conta.id) ?? [];
}

export function apresentacaoDre(resumo: ResumoDre | undefined, competencia: string, pagar?: ResumoPagarDre, aplicaFretes = true, transporte: CustoTransporteDre[] = []) {
  const primeiro = resumo?.historico.primeiroFrete;
  const atualizado = resumo?.historico.atualizadoEm?.slice(0, 10);
  const mes = competencia + '-01';
  const ano = competencia.slice(0, 4) + '-01-01';
  const mesDisponivel = Boolean(primeiro && atualizado && primeiro <= mes && atualizado >= mes);
  const anoDisponivel = mesDisponivel && Boolean(primeiro && primeiro <= ano);
  const valores = new Map(resumo?.valores.map(v => [chaveReceita(v.classe, v.tipo), v]));
  const contas = new Map(pagar?.valores.map(v => [nomeContabil(v.conta), v]));
  const custosTransporte = new Map(transporte.map(v => [v.id,v]));
  const primeira = pagar?.historico.primeiraEmissao;
  const atualizacao = pagar?.historico.atualizadoEm?.slice(0,10);
  const mesPagar = Boolean(primeira && atualizacao && primeira <= mes && atualizacao >= mes);
  const anoPagar = mesPagar && Boolean(primeira && primeira <= ano);
  function contaPagar(linha: ContaDre) {
    const nome = nomeContabil(linha.nome);
    return linha.fonte === 'pagar' && nomesPagar.get(nome) === 1 ? contas.get(nome) : undefined;
  }
  function valorFolha(conta: ContaDre, periodo: 'mes' | 'ano') {
    const operacional = custosTransporte.get(conta.id);
    if (operacional) {
      const custo = operacional[periodo];
      return custo == null || custo === 0 ? custo : -custo;
    }
    if (conta.fonte === 'fretes') {
      if (!aplicaFretes || !(periodo === 'mes' ? mesDisponivel : anoDisponivel)) return null;
      return valores.get(conta.id)?.[periodo] ?? 0;
    }
    if (!(periodo === 'mes' ? mesPagar : anoPagar)) return null;
    const quantia = contaPagar(conta)?.[periodo];
    if (quantia == null || quantia === 0) return quantia ?? null;
    return conta.pai === 'D207' ? quantia : -quantia;
  }
  function valor(conta: ContaDre, periodo: 'mes' | 'ano'): number | null {
    if (margens[conta.id]) {
      const base = valor(porId.get('D12')!,periodo);
      const resultado = valor(porId.get(margens[conta.id])!,periodo);
      return base && resultado != null ? 100 * resultado / base : null;
    }
    const partes = composicaoConta(conta);
    if (!partes.length) return valorFolha(conta,periodo);
    let total = 0;
    for (const parte of partes) {
      const parcela = valor(parte,periodo);
      if (parcela === null) return null;
      total += parcela;
    }
    return total;
  }
  return {mesDisponivel, anoDisponivel, mesPagar, anoPagar, aplicaFretes, contaPagar, valor};
}

export function dinheiro(valor: number | null) {
  return valor == null ? '—' : formatarMoeda(valor);
}

export function formatarConta(conta: ContaDre, valor: number | null) {
  if (conta.fonte !== 'percentual' || valor == null) return dinheiro(valor);
  return (valor / 100).toLocaleString('pt-BR', {style:'percent', minimumFractionDigits:2, maximumFractionDigits:2});
}

export function exportacaoDre(linhas: ContaDre[], dados: ReturnType<typeof apresentacaoDre>, competencia: string) {
  const colunas = ['Conta', competencia + ' · Realizado', competencia + ' · Orçado', 'Variação mês R$ / %',
    'Jan a ' + competencia + ' · Realizado', 'Jan a ' + competencia + ' · Orçado', 'Variação ano R$ / %'];
  const caminho = new Map<string, string>();
  const celula = (valor: string) => '"' + valor.replaceAll('"', '""') + '"';
  const linhasCsv = [colunas];
  for (const linha of linhas) {
    const nome = linha.pai ? caminho.get(linha.pai) + ' / ' + linha.nome : linha.nome;
    caminho.set(linha.id, nome);
    linhasCsv.push([nome, formatarConta(linha,dados.valor(linha,'mes')), '—', '—', formatarConta(linha,dados.valor(linha,'ano')), '—', '—']);
  }
  return '\uFEFF' + linhasCsv.map(c => c.map(celula).join(';')).join('\r\n');
}
