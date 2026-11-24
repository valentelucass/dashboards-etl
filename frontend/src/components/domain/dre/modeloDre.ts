import type { ResumoDre } from '../../../api/endpoints/dreServico';
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

export function apresentacaoDre(resumo: ResumoDre | undefined, competencia: string) {
  const primeiro = resumo?.historico.primeiroFrete;
  const atualizado = resumo?.historico.atualizadoEm?.slice(0, 10);
  const mes = competencia + '-01';
  const ano = competencia.slice(0, 4) + '-01-01';
  const mesDisponivel = Boolean(primeiro && atualizado && primeiro <= mes && atualizado >= mes);
  const anoDisponivel = mesDisponivel && Boolean(primeiro && primeiro <= ano);
  const valores = new Map(resumo?.valores.map(v => [chaveReceita(v.classe, v.tipo), v]));
  function valor(conta: ContaDre, periodo: 'mes' | 'ano') {
    if (conta.fonte !== 'fretes' || !(periodo === 'mes' ? mesDisponivel : anoDisponivel)) return null;
    return valores.get(conta.id)?.[periodo] ?? 0;
  }
  return {mesDisponivel, anoDisponivel, valor};
}

export function dinheiro(valor: number | null) {
  return valor == null ? '—' : formatarMoeda(valor);
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
    linhasCsv.push([nome, dinheiro(dados.valor(linha, 'mes')), '—', '—', dinheiro(dados.valor(linha, 'ano')), '—', '—']);
  }
  return '\uFEFF' + linhasCsv.map(c => c.map(celula).join(';')).join('\r\n');
}
