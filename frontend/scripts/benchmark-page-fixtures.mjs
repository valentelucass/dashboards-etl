// Contratos sintéticos determinísticos; nenhum dado operacional é lido.
export const chartCounts = { coletas: 5, performance: 5, faturamento: 5, manifestos: 7, executivo: 2, tracking: 2,
  'contas-a-pagar': 4, 'faturas-por-cliente': 4, 'etl-saude': 3, cotacoes: 5,
  'painel/integracoes': 3, 'indicadores-gestao-a-vista': 5 };
const dates = Array.from({ length: 30 }, (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`);
const group = [{ nome: 'Distribuição', receita: 180000, fretes: 900 }, { nome: 'Transferência', receita: 120000, fretes: 600 }];
const gauge = { global: 75, distribuicao: 80, transferencia: 70, cargaFechada: 75 };

export function chartApiPaths(route, title) {
  if (route === 'tracking') return ['/api/painel/tracking/dashboard'];
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

export function pageFixture(path, params = new URLSearchParams()) {
  if (path.startsWith('/api/dimensoes/cotacoes/')) return ['Sintético'];
  if (path === '/api/painel/cotacoes') return { updatedAt: '2026-09-10T00:00:00Z', totalCotacoes: 100,
    valorPotencial: 50000, valorConvertido: 30000, freteMedio: 500, freteKgMedio: 2,
    conversaoValor: 60, conversaoQuantidade: 60, reprovacaoPercentual: 20,
    taxaConversaoCte: 50, taxaConversaoNfse: 10, tempoMedioConversaoHoras: 24 };
  if (path === '/api/painel/cotacoes/serie') return dates.map(date => ({ date, cotacoes: 10,
    convertidas: 6, reprovadas: 2, valorPotencial: 5000, valorConvertido: 3000 }));
  if (path.includes('/api/painel/cotacoes/resumo/')) return [];
  if (path === '/api/painel/cotacoes/graficos') {
    const trecho = { nome: 'PR - SP', valorPotencial: 50000, valorConvertido: 30000, cotacoes: 100, convertidas: 60, reprovadas: 20 };
    const perda = { motivo: 'Preço', total: 20 };
    return { funil: [{ etapa: 'Cotada', total: 100, valor: 50000 }, { etapa: 'Convertida', total: 60, valor: 30000 }, { etapa: 'Reprovada', total: 20, valor: 10000 }],
      corredoresMaisValiosos: [{ trecho: 'PR - SP', valorFrete: 50000, cotacoes: 100 }], motivosPerda: [perda],
      trechosMaisValiosos: [trecho], trechosPorUfOrigem: [{ ...trecho, nome: 'PR' }], trechosPorUfDestino: [{ ...trecho, nome: 'SP' }],
      conversaoPorTipoOperacao: [{ ...trecho, nome: 'Distribuição' }], perdasPorCliente: [perda], perdasPorTrecho: [perda] };
  }
  if (path === '/api/painel/integracoes') return { geradoEm: '2026-09-10T00:00:00Z',
    metricasConsolidadas: [{ sistemaDestino: 'VEDACIT', totalRegistros: 100, percentualXmlSucesso: 95, percentualCanhotoSucesso: 90 }],
    pendencias: { itens: [], paginacao: { pagina: 0, tamanho: 10, totalElementos: 0, totalPaginas: 0, primeiraPagina: true, ultimaPagina: true } } };
  if (path === '/api/painel/integracoes/evolucao-diaria') return dates.map(data => ({ data, total: 100, sucessos: 95, erros: 5 }));
  if (path === '/api/painel/integracoes/vedacit-sftp/clientes') return [];
  if (path === '/api/painel/integracoes/vedacit-sftp/execucoes') return { itens: [], paginacao: { pagina: 0, tamanho: 10, totalElementos: 0, totalPaginas: 0, primeiraPagina: true, ultimaPagina: true } };
  if (path === '/api/kpi-goals/effective') return { branchId: 'GLOBAL', source: 'GLOBAL', competencia: '2026-08',
    goals: { delivery_performance: 95, collector_usage: 95, cargo_cubage: 95, cargo_indemnity: 1, cutoff_time: 95 } };
  if (path === '/api/painel/gestao-vista/cubagem/clientes') return [];
  if (path === '/api/kpi-goals/overrides') return { indicatorKey: params.get('indicatorKey'), competencia: '2026-08',
    globalGoal: params.get('indicatorKey') === 'cargo_indemnity' ? 1 : 95, overrides: [] };
  const indicadores = '/api/painel/indicadores-gestao-a-vista/';
  if (path.startsWith(indicadores)) {
    const section = path.slice(indicadores.length).split('/')[0];
    const common = { updatedAt: '2026-09-10T00:00:00Z', date: '2026-08-01', filial: 'CWB' };
    const values = {
      'performance-entrega': { totalEntregas: 100, entregasNoPrazo: 95, entregasForaDoPrazo: 5, pctNoPrazo: 95, label: 'CWB', filtro: 'CWB', visao: 'RESPONSAVEL' },
      'utilizacao-coletores': { manifestosBipados: 95, manifestosEmitidos: 100, manifestosDescarregamento: 95, totalManifestos: 100, manifestosIncompletos: 5, pctUtilizacao: 95, classificacao: 'Distribuição' },
      'cubagem-mercadorias': { totalFretes: 100, fretesCubados: 95, fretesComPesoReal: 100, pctCubagem: 95 },
      'indenizacao-mercadorias': { totalSinistros: 1, valorIndenizadoAbs: 100, valorIndenizadoOriginal: -100, faturamentoBase: 50000, faturamentoPeriodoFilial: 50000, pctIndenizacao: 0.2 },
      'horarios-corte': { saidasNoHorario: 95, totalProgramado: 100, pctNoHorario: 95, ultimaImportacaoEm: null, ultimaImportacaoArquivo: null },
    }[section];
    if (values && path.endsWith('/overview')) return { ...common, ...values };
    if (values && path.endsWith('/serie')) return [{ ...common, ...values }];
    if (path.endsWith('/utilizacao-coletores/ranking')) return [{ branchId: 'CWB', branchName: 'CWB', utilization: 95,
      goal: 95, ordensConferencia: 95, manifestosBipaveis: 100, descarregamentos: 95, ordensIncompletas: 5 }];
  }
  if (path === '/api/dimensoes/planocontas') return ['Despesa operacional'];
  if (path === '/api/dimensoes/faturas-por-cliente/clientes-cnpj') return ['12345678000199'];
  if (path === '/api/painel/contas-a-pagar') return { updatedAt: '2026-09-10T00:00:00Z', valorAPagar: 50000,
    valorPago: 30000, saldoAberto: 20000, taxaLiquidacao: 60, leadTimeLiquidacaoDias: 10, pctConciliado: 80 };
  if (path === '/api/painel/contas-a-pagar/serie') return dates.map(month => ({ month, pago: 1000, aberto: 600 }));
  if (path === '/api/painel/contas-a-pagar/graficos') return { topFornecedores: [], centroCusto: [], conciliacao: [
    { status: 'Sim', total: 80, valor: 40000 }, { status: 'Não', total: 20, valor: 10000 },
  ] };
  if (path === '/api/painel/contas-a-pagar/graficos/fornecedores' || path === '/api/painel/contas-a-pagar/graficos/centros-custo') return [
    { label: 'Despesa A', valor: 30000, titulos: 60 }, { label: 'Despesa B', valor: 20000, titulos: 40 },
  ];
  if (path === '/api/painel/faturas-por-cliente') return { updatedAt: '2026-09-10T00:00:00Z', valorFaturado: 50000,
    registrosFaturados: 80, aguardandoFaturamento: 20, titulosEmAtraso: 10, prazoMedioDias: 15, clientesAtivos: 5 };
  if (path === '/api/painel/faturas-por-cliente/serie') return dates.map(periodo => ({ periodo, valor: 2000, registros: 5 }));
  if (path === '/api/painel/faturas-por-cliente/aging') return [{ faixa: '1-30 dias', valor: 5000, titulos: 10 }];
  if (path === '/api/painel/faturas-por-cliente/top-clientes/drilldown') return [
    { label: 'Cliente A', detalhe: null, valor: 30000, registros: 50, percentualAcumulado: 60 },
    { label: 'Cliente B', detalhe: null, valor: 20000, registros: 30, percentualAcumulado: 100 },
  ];
  if (path === '/api/painel/faturas-por-cliente/status-processo') return [
    { statusProcesso: 'Faturado', total: 80 }, { statusProcesso: 'Aguardando Faturamento', total: 20 },
  ];
  if (path === '/api/painel/faturas-por-cliente/status-processo/evolucao') return dates.map(periodo => ({ periodo, faturado: 8, aguardandoFaturamento: 2 }));
  if (path === '/api/painel/etl-saude') return { updatedAt: '2026-09-10T00:00:00Z', tempoMedioExecucaoSegundos: 120,
    execucoesComErro: 2, totalExecucoes: 100, volumeProcessadoTotal: 10000, taxaSucesso: 98 };
  if (path === '/api/painel/etl-saude/serie') return dates.map(dataReferencia => ({ dataReferencia, qtdSucesso: 20, qtdFalha: 1 }));
  if (path === '/api/painel/etl-saude/evolucao-insercoes-atualizacoes') return dates.map(dataReferencia => ({ dataReferencia, insercoes: 200, atualizacoes: 50 }));
  if (path === '/api/painel/etl-saude/tabelas/resumo') return [{ tabelaAlvo: 'fretes', qtdExtracoes: 100,
    qtdSucessos: 98, qtdFalhas: 2, totalRegistrosGravados: 10000, primeiraExtracao: '2026-08-01T00:00:00Z',
    ultimaExtracao: '2026-08-30T00:00:00Z', menorDataNegocio: '2026-08-01', maiorDataNegocio: '2026-08-30' }];
  if (path === '/api/painel/etl-saude/tabela') return [];
  if (path === '/api/painel/tracking/dashboard') return {
    overview: { updatedAt: '2026-09-10T00:00:00Z', totalCargas: 100, emTransito: 30, previsaoVencida: 5,
      valorFreteEmCarteira: 50000, pesoTaxadoTotal: 10000, pctFinalizado: 20 },
    matrizRegiaoDestino: [{ siglaRegiaoDestino: 'SUL - Região Sul', responsavelRegiaoDestino: 'Operador sintético',
      pesoTaxado: 10000, valorFrete: 50000, valorNota: 200000, volumes: 300, foraDoPrazo: 5 }],
    graficos: { statusDistribuicao: [
      { status: 'NO ARMAZÉM', total: 50, valorFrete: 25000 },
      { status: 'Em entrega', total: 30, valorFrete: 15000 },
      { status: 'Entregue', total: 20, valorFrete: 10000 },
    ], previsaoVencidaPorFilialAtual: [], valorPorRegiaoDestino: [
      { regiaoDestino: 'SUL - Região Sul', valorFrete: 30000, cargas: 60 },
      { regiaoDestino: 'SUDESTE - Região Sudeste', valorFrete: 20000, cargas: 40 },
    ] },
  };
  if (path === '/api/painel/tracking/detalhes') return { conteudo: [], totalElementos: 0, totalPaginas: 0, paginaAtual: 1, tamanhoPagina: 10 };
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
