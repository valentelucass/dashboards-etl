// Contratos sintéticos determinísticos; nenhum dado operacional é lido.
export const chartCounts = { coletas: 5, performance: 5, faturamento: 5, manifestos: 7, executivo: 2 };
const dates = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
const group = [{ nome: 'Distribuição', receita: 180000, fretes: 900 }, { nome: 'Transferência', receita: 120000, fretes: 600 }];
const gauge = { global: 75, distribuicao: 80, transferencia: 70, cargaFechada: 75 };

export function chartApiPaths(route, title) {
  if (route === 'manifestos') return ['/api/painel/manifestos/performance'];
  if (route === 'executivo') return ['/api/painel/executivo/serie'];
  if (route === 'faturamento') {
    if (title === 'Evolução do Faturamento') return ['/api/painel/fretes', '/api/painel/fretes/serie'];
    if (title === 'Participação de Clientes no Faturamento') return ['/api/painel/fretes', '/api/painel/fretes/top-clientes'];
    return ['/api/painel/fretes/graficos'];
  }
  if (route === 'performance') {
    const suffix = { 'Entregas por dia, mês e ano': 'serie-temporal', 'Distribuição por Status': 'status',
      'Histórico de Performance': 'historico', 'Performance por responsável, região e cidade': 'drilldown',
      'Entregas em aberto': 'aging' }[title];
    if (!suffix) throw new Error(`Gráfico sem mapeamento de API: ${title}`);
    return [`/api/painel/performance/${suffix}`];
  }
  return [];
}

export function pageFixture(path) {
  if (path === '/api/dimensoes/fretes/status') return ['Autorizado'];
  if (path === '/api/dimensoes/faturamento/responsaveis') return [{ value: 'CWB', label: 'CWB' }];
  if (path === '/api/dimensoes/manifestos/classificacoes') return ['Distribuição', 'Transferência'];
  if (path === '/api/dimensoes/motoristas') return ['Motorista sintético'];
  if (path === '/api/dimensoes/veiculos') return [{ placa: 'ABC1D23', tipoVeiculo: 'Truck', proprietario: 'Próprio' }];
  if (path === '/api/painel/fretes') return { updatedAt: '2026-09-10T00:00:00Z', totalFretes: 1500,
    receitaBruta: 300000, valorFrete: 280000, ticketMedio: 200, pesoTaxadoTotal: 23000, volumesTotais: 10000,
    pctCteEmitido: 95, pctNfseEmitida: 5, fretesPrevisaoVencida: 20, totalDiasCivis: 30, totalDiasUteis: 22,
    metaFaturamento: 350000, percentualAtingimentoFaturamento: 85.71,
    faturamentoDiario: { totalDiasUteisMes: 22, diasUteisDecorridos: 20, diasUteisRestantes: 2,
      metaDiariaBase: 15909, faturamentoDiarioReal: 15000, metaDiariaDinamica: 25000,
      faturamentoFaltante: 50000, tendenciaFaturamento: 330000, tendenciaPercentual: -0.057143 } };
  if (path === '/api/painel/fretes/serie') return dates.map(date => ({ date, receitaBruta: 10000, valorFrete: 9000, fretes: 50 }));
  if (path === '/api/painel/fretes/graficos') return {
    previsaoPorStatus: [{ status: 'Autorizado', vencidos: 20, noPrazo: 1480 }],
    topRotasPorReceita: [{ origemUf: 'PR', destinoUf: 'SP', receita: 300000, fretes: 1500 }],
    faturamentoPorClassificacao: group, faturamentoPorResponsavelDestino: [{ ...group[0], nome: 'CWB' }],
    faturamentoPorUfOrigem: [{ ...group[0], nome: 'PR' }], faturamentoPorUfDestino: [{ ...group[0], nome: 'SP' }],
    faturamentoPorCidadeDestino: [{ ...group[0], nome: 'São Paulo' }],
  };
  if (path === '/api/painel/fretes/top-clientes') return Array.from({ length: 10 }, (_, i) => ({
    cliente: `Cliente sintético ${i + 1}`, cnpjBase: String(i + 1).padStart(8, '0'), receita: 30000 - i * 1000, fretes: 150 - i * 5, ticketMedio: 200,
  }));
  if (path === '/api/painel/fretes/metas') return { dataInicio: '2026-08-01', dataFim: '2026-08-30',
    metaFaturamento: 350000, realizadoFaturamento: 300000, percentualAtingimentoFaturamento: 85.71,
    branches: [{ branchId: 'CWB', metaFaturamento: 350000, realizadoFaturamento: 300000, percentualAtingimentoFaturamento: 85.71 }] };
  if (path === '/api/painel/manifestos/performance') return { updatedAt: '2026-09-10T00:00:00Z', totalDiasUteis: 22,
    kpis: { totalManifestos: 300, emTransito: 30, pendentes: 20, encerrados: 250, kmTotal: 50000,
      custoTotal: 100000, custoPorKg: 2, custoPorKm: 2, receitaPorKg: 3, receitaPorKm: 3 },
    remuneracao: gauge, aproveitamento: gauge, efetividade: gauge,
    statusSazonal: dates.map(data => ({ data, encerrado: 8, emTransito: 1, pendente: 1 })),
    custosContrato: [{ tipoContrato: 'Próprio', custoTotal: 60000 }, { tipoContrato: 'Terceiro', custoTotal: 40000 }],
    tiposVeiculo: [{ tipo: 'Truck', quantidade: 30, aproveitamentoMedio: 75, mediaEventos: 5 }],
    custosEvolucao: { orcamentoAplicavel: true, orcamentoConfigurado: true, observacao: null, totalDiasUteis: 22,
      diasUteisDecorridos: 20, diasUteisRestantes: 2, orcamentoCusto: 120000, custoReal: 100000,
      limiteDiarioBase: 5454.55, custoMedioDiarioReal: 5000, saldoOrcamentario: 20000,
      limiteDiarioDinamico: 10000, tendenciaCusto: 110000, consumoOrcamento: 83.33,
      serieDiaria: dates.map(data => ({ data, custoReal: 3333.33 })) },
  };
  if (path === '/api/painel/executivo') return { updatedAt: '2026-09-10T00:00:00Z', receitaOperacional: 300000,
    valorFaturado: 280000, saldoAReceber: 0, saldoAPagar: 100000, backlogColetas: 100,
    cargasPrevisaoVencida: 20, ocupacaoMediaManifestos: 75 };
  if (path === '/api/painel/executivo/serie') return [6, 7, 8].map(month => ({ month: `2026-0${month}`,
    receitaOperacional: month * 50000, valorFaturado: month * 45000, saldoAReceber: 0, saldoAPagar: month * 20000, backlogColetas: month * 10 }));
  if (path === '/api/painel/executivo/resumo-financeiro') return [{ filial: 'CWB', totalFaturado: 300000, fretePeso: 200000, freteValor: 100000, ticketMedio: 200 }];
  return undefined;
}
