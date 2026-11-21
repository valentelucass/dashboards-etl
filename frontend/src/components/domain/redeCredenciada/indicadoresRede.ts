import type { CustosRede, DesempenhoParceiro, OperacaoRede, ValoresConsolidacao } from '../../../api/endpoints/redeCredenciadaServico';
import { formatarMoeda, formatarPorcentagem } from '../../../utils/formatadores';

export function nomeCurto(nome: string) {
  return nome.split('|')[0].trim();
}

export function exibirTaxa(valor: number | null) {
  return valor === null ? '—' : formatarPorcentagem(valor, 2);
}

export function exibirMoeda(valor: number | null) {
  return valor === null ? '—' : formatarMoeda(valor);
}

export function percentual(parte: number, total: number) {
  return total > 0 ? parte * 100 / total : null;
}

function contadoresOperacionais() {
  return { otifNoPrazo: 0, otifTotal: 0, efdEficientes: 0, efdTotal: 0, coletasNoPrazo: 0, coletas: 0, entregas: 0, anexadas: 0, arquivadas: 0, semContagemArquivos: 0 };
}

type ContadoresOperacionais = ReturnType<typeof contadoresOperacionais>;

export function taxasOperacionais(contagem: ContadoresOperacionais, arquivosCompletos: boolean) {
  return {
    otif: percentual(contagem.otifNoPrazo, contagem.otifTotal),
    efd: percentual(contagem.efdEficientes, contagem.efdTotal),
    coleta: percentual(contagem.coletasNoPrazo, contagem.coletas),
    anexado: percentual(contagem.anexadas, contagem.entregas),
    arquivado: arquivosCompletos && !contagem.semContagemArquivos ? percentual(contagem.arquivadas, contagem.entregas) : null,
  };
}

function valoresConsolidacao(): ValoresConsolidacao {
  return { consolidacoes: 0, cobradoCentavos: 0, calculadoCentavos: 0, semCobrado: 0, semCalculado: 0, calculadoZero: 0 };
}

function somarConsolidacao(destino: ValoresConsolidacao, origem: ValoresConsolidacao) {
  destino.consolidacoes += origem.consolidacoes;
  destino.cobradoCentavos += origem.cobradoCentavos;
  destino.calculadoCentavos += origem.calculadoCentavos;
  destino.semCobrado += origem.semCobrado;
  destino.semCalculado += origem.semCalculado;
  destino.calculadoZero += origem.calculadoZero;
}

export function valoresFinanceiros(dados?: ValoresConsolidacao) {
  const cobrado = dados && dados.semCobrado === 0 ? dados.cobradoCentavos / 100 : null;
  const calculado = dados && dados.semCalculado === 0 ? dados.calculadoCentavos / 100 : null;
  return {cobrado, calculado, diferenca: cobrado !== null && calculado !== null ? cobrado - calculado : null};
}

export function resumirRede(
  desempenho: DesempenhoParceiro[], operacao: OperacaoRede | undefined,
  custos: CustosRede | undefined, selecionados: string[],
) {
  const porParceiro = new Map<string, ContadoresOperacionais>();
  const porTransportadora = new Map<string, ValoresConsolidacao>();
  const porDia = new Map<string, ValoresConsolidacao>();
  const escolha = new Set(selecionados);
  function contadores(nome: string) {
    const item = porParceiro.get(nome) ?? contadoresOperacionais();
    porParceiro.set(nome, item);
    return item;
  }
  for (const registro of desempenho) {
    const item = contadores(registro.filial);
    item.otifNoPrazo += registro.otifNoPrazo;
    item.otifTotal += registro.otifTotal;
    item.efdEficientes += registro.efdEficientes;
    item.efdTotal += registro.efdTotal;
  }
  for (const entrega of operacao?.entregas ?? []) {
    const item = contadores(entrega.parceiro);
    item.entregas += entrega.finalizadas;
    item.anexadas += entrega.anexadas;
    if (entrega.arquivadas === null) item.semContagemArquivos++;
    else item.arquivadas += entrega.arquivadas;
  }
  for (const coleta of operacao?.coletas ?? []) {
    const item = contadores(coleta.parceiro);
    item.coletas += coleta.finalizadas;
    item.coletasNoPrazo += coleta.noPrazo;
  }
  for (const linha of custos?.linhas ?? []) {
    if (escolha.size && !escolha.has(linha.parceiro)) continue;
    const transportadora = porTransportadora.get(linha.parceiro) ?? valoresConsolidacao();
    somarConsolidacao(transportadora, linha);
    porTransportadora.set(linha.parceiro, transportadora);
    const dia = porDia.get(linha.dia) ?? valoresConsolidacao();
    somarConsolidacao(dia, linha);
    porDia.set(linha.dia, dia);
  }
  const nomes = [...new Set([...porParceiro.keys(), ...porTransportadora.keys()])]
    .filter(nome => escolha.size === 0 || escolha.has(nome)).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const total = contadoresOperacionais();
  const arquivosCompletos = operacao?.coberturaArquivos.completa === true;
  const parceiros = nomes.map(nome => {
    const item = porParceiro.get(nome) ?? contadoresOperacionais();
    for (const chave of Object.keys(total) as (keyof typeof total)[]) total[chave] += item[chave];
    return { nome, ...taxasOperacionais(item, arquivosCompletos), ...valoresFinanceiros(porTransportadora.get(nome)) };
  });
  const dias = [...porDia.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, valores]) => ({ dia, ...valoresFinanceiros(valores) }));
  return { parceiros, dias, total, taxas: taxasOperacionais(total, arquivosCompletos) };
}
