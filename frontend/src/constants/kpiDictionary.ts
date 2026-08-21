export interface KpiDefinition {
  readonly titulo: string;
  readonly descricao: string;
  readonly calculo: string;
  readonly observacao?: string;
}

export interface KpiDefinitionGroup {
  readonly [key: string]: KpiDefinition | KpiDefinitionGroup;
}

const percentualSemBase =
  'Quando o denominador é zero, o indicador retorna 0%.';

const periodoColetas =
  'O período considera a data de solicitação. Solicitações repetidas são consolidadas pelo identificador, preservando a versão mais recente. Coletas que não são mais retornadas pelo ESL permanecem na tabela e exportação como "Excluída", mas não participam dos indicadores.';

const periodoManifestos =
  'O período considera a competência operacional do manifesto: data de saída; quando a saída não existe, usa a data de criação.';

const regraTipoContratoManifestos =
  'Veículos de propriedade da LM Transportes são reclassificados como Frota + PX. Casos sem motorista informado recebem fallback para Terceiro ou Frota + PX dependendo da tração.';

const periodoPerformance =
  'O período considera a previsão de entrega. Cada minuta aparece uma única vez, priorizando o registro finalizado e mais recente.';

const periodoFaturamento =
  'O período considera a data de referência de faturamento. Registros excluídos na origem não entram na apuração.';

const elegibilidadeFaturamento =
  'Os valores financeiros consideram somente fretes elegíveis: sem cancelamento do documento, sem cortesia, sem bloqueio de faturamento e não marcados como inelegíveis na origem.';

const periodoCotacoes =
  'O período considera a data da cotação. O resumo conta as linhas filtradas sem consolidação adicional por cotação.';

const periodoTracking =
  'O período considera a data do frete e trabalha somente com cargas ainda não finalizadas.';

const baseGestaoPerformance =
  'Considera minutas válidas, com previsão e filial de performance, excluindo cancelamentos, cortesias e registros operacionalmente inelegíveis. Cada minuta aparece uma única vez.';

const baseGestaoCubagem =
  'Considera minutas válidas, não canceladas, com valor operacional e fora das exceções oficiais ativas de pagadores sem cubagem em dbo.cliente_excecao_cubagem, além do flag legado de exclusão publicado na fato. Cada minuta aparece uma única vez.';

const regraHorarioCorteCwbNhb =
  'Na linha CWB-NHB, o corte operacional vigente é 22h.';

export const KpiDictionary = {
  coletas: {
    totalColetas: {
      titulo: 'Total de Coletas',
      descricao: 'Quantidade de solicitações de coleta no período selecionado.',
      calculo: 'Contagem de solicitações consolidadas.',
      observacao: periodoColetas,
    },
    finalizadas: {
      titulo: 'Coletas Finalizadas',
      descricao: 'Solicitações cujo status indica coleta finalizada ou coletada.',
      calculo: 'Finalizadas + Coletadas.',
      observacao: periodoColetas,
    },
    taxaSucesso: {
      titulo: 'Taxa de Sucesso',
      descricao: 'Percentual das solicitações que chegaram a uma conclusão de coleta.',
      calculo: '(Finalizadas + Coletadas) ÷ Total de Solicitações × 100.',
      observacao: `${periodoColetas} ${percentualSemBase}`,
    },
    cancelamento: {
      titulo: 'Cancelamento',
      descricao: 'Percentual das solicitações encerradas como canceladas.',
      calculo: 'Canceladas ÷ Total de Solicitações × 100.',
      observacao: `${periodoColetas} ${percentualSemBase}`,
    },
    slaAgendamento: {
      titulo: 'SLA de Agendamento',
      descricao: 'Percentual de coletas concluídas até a data e hora agendadas.',
      calculo:
        'Finalizadas ou coletadas até o agendamento ÷ Total de Finalizadas ou Coletadas × 100.',
      observacao:
        'Finalizadas sem data de conclusão ou sem agendamento permanecem no denominador, mas não contam como SLA atendido. ' +
        percentualSemBase,
    },
    leadTimeMedio: {
      titulo: 'Lead Time Médio',
      descricao: 'Tempo médio entre a solicitação e a conclusão da coleta.',
      calculo:
        'Soma dos dias completos entre Solicitação e Finalização ÷ Coletas finalizadas com as duas datas.',
      observacao:
        `${periodoColetas} Somente coletas finalizadas ou coletadas com data de solicitação e data de finalização participam da média.`,
    },
    tentativasMedias: {
      titulo: 'Tentativas Médias',
      descricao: 'Média de tentativas realizadas por solicitação de coleta.',
      calculo: 'Indicador atualmente fixado em 0.',
      observacao:
        'A camada de dados ainda não fornece a quantidade de tentativas; o valor enviado ao dashboard é sempre zero.',
    },
    pesoTaxado: {
      titulo: 'Peso Taxado',
      descricao: 'Peso taxado total informado nas solicitações do período.',
      calculo: 'Soma do Peso Taxado de todas as solicitações consolidadas.',
      observacao: periodoColetas,
    },
    valorNotaFiscal: {
      titulo: 'Valor de Nota Fiscal',
      descricao: 'Valor total das notas fiscais vinculadas às solicitações.',
      calculo: 'Soma do Valor das Notas Fiscais.',
      observacao: periodoColetas,
    },
    regiaoLogistica: {
      titulo: 'Coletas por Região Logística',
      descricao: 'Distribuição de solicitações por macro-região logística de origem.',
      calculo: 'Contagem de Coletas únicas e soma do Peso Taxado agrupadas pela Região Logística publicada pelo ETL.',
      observacao:
        `${periodoColetas} A região logística é resolvida no banco por Faixa de CEP; quando não há faixa aplicável, usa Cidade/UF; sem regra encontrada, preserva Cidade - UF.`,
    },
  },

  manifestos: {
    totalManifestos: {
      titulo: 'Total de Manifestos',
      descricao: 'Quantidade de manifestos no período e filtros selecionados.',
      calculo: 'Contagem de Manifestos.',
      observacao: periodoManifestos,
    },
    emTransito: {
      titulo: 'Manifestos em Trânsito',
      descricao: 'Quantidade de manifestos classificados como em trânsito.',
      calculo: 'Contagem de Manifestos com status Em Trânsito.',
      observacao: periodoManifestos,
    },
    pendentes: {
      titulo: 'Manifestos Pendentes',
      descricao: 'Quantidade de manifestos pendentes de encerramento ou trânsito.',
      calculo: 'Contagem de Manifestos com status Pendente.',
      observacao:
        'Status não reconhecidos como encerrado ou em trânsito são agrupados como pendentes.',
    },
    encerrados: {
      titulo: 'Manifestos Encerrados',
      descricao: 'Quantidade de manifestos classificados como encerrados.',
      calculo: 'Contagem de Manifestos com status Encerrado.',
      observacao: periodoManifestos,
    },
    kmTotal: {
      titulo: 'Quilometragem Total',
      descricao: 'Distância total registrada pelos manifestos.',
      calculo: 'Soma da Quilometragem dos Manifestos.',
      observacao: periodoManifestos,
    },
    custoTotal: {
      titulo: 'Custo Total',
      descricao: 'Custo operacional total registrado nos manifestos.',
      calculo: 'Soma do Custo Total dos Manifestos.',
      observacao: periodoManifestos,
    },
    custosPorContrato: {
      titulo: 'Custos por Tipo de Contrato',
      descricao: 'Mede a representatividade financeira e o custo total das operações de transporte segmentadas pela classificação unificada de contrato.',
      calculo: 'Soma do Custo Total, agrupada pela classificação unificada de Tipo de Contrato na fato materializada.',
      observacao: `${periodoManifestos} ${regraTipoContratoManifestos}`,
    },
    orcamentoCusto: {
      titulo: 'Orçamento de Custo',
      descricao: 'Orçamento mensal de custo operacional aplicável às competências e filiais selecionadas.',
      calculo:
        'Soma dos Orçamentos Mensais por filial, tipo de contrato e classificação canônica. Sem filtro de filial, a meta global prevalece; com filtro ou escopo restrito, são somadas as metas das filiais aplicáveis.',
      observacao:
        'Quando houver filtro de classificação, somente metas com a mesma chave em caixa alta entram no orçamento. O orçamento não é comparado quando existem filtros de status, motorista, veículo, tipo de carga ou tipo de motorista.',
    },
    custoReal: {
      titulo: 'Custo Real',
      descricao: 'Custo operacional acumulado dos manifestos no período selecionado.',
      calculo: 'Soma do Custo Total dos Manifestos filtrados.',
      observacao: periodoManifestos,
    },
    limiteDiarioBase: {
      titulo: 'Limite Diário Base',
      descricao: 'Parcela média diária do orçamento de custo.',
      calculo: 'Orçamento de Custo ÷ Total de Dias Úteis das competências.',
      observacao:
        'Os dias úteis vêm do calendário corporativo; na indisponibilidade dele, são usados os dias de segunda a sexta.',
    },
    custoMedioDiarioReal: {
      titulo: 'Custo Médio Diário Real',
      descricao: 'Média diária do custo acumulado até o último dia útil fechado.',
      calculo: 'Custo acumulado até D-1 ÷ Dias Úteis Decorridos.',
      observacao: 'O divisor mínimo é um.',
    },
    saldoOrcamentario: {
      titulo: 'Saldo Orçamentário',
      descricao: 'Valor de orçamento ainda disponível para o restante das competências.',
      calculo: 'Orçamento de Custo − Custo acumulado até o último Dia Útil Fechado.',
      observacao: 'O valor fica negativo quando o custo realizado supera o orçamento.',
    },
    limiteDiarioDinamico: {
      titulo: 'Limite Diário Dinâmico',
      descricao: 'Custo médio diário máximo disponível nos dias úteis restantes.',
      calculo: 'Máximo entre Saldo Orçamentário e zero ÷ Dias Úteis Restantes.',
      observacao: 'O divisor mínimo é um. Quando o orçamento já foi estourado, o limite diário exibido é zero.',
    },
    tendenciaCusto: {
      titulo: 'Tendência de Custo',
      descricao: 'Projeção de custo para o fechamento das competências selecionadas.',
      calculo: 'Custo Real + Custo Médio Diário Real × Dias Úteis Restantes.',
      observacao:
        'A média diária usa somente os dias úteis já fechados, enquanto o custo real preserva o acumulado do período selecionado.',
    },
    consumoOrcamento: {
      titulo: 'Consumo do Orçamento',
      descricao: 'Percentual do orçamento de custo já consumido.',
      calculo: 'Custo Real ÷ Orçamento de Custo × 100.',
      observacao:
        'Para controle de custos, valores até 100% são favoráveis; valores acima de 100% indicam estouro orçamentário.',
    },
    custoPorKg: {
      titulo: 'Custo por KG',
      descricao: 'Custo médio ponderado por quilograma transportado.',
      calculo: 'Custo Total ÷ Peso Taxado Total.',
      observacao: 'Quando o peso taxado total é zero, o indicador retorna zero.',
    },
    custoPorKm: {
      titulo: 'Custo por Quilômetro',
      descricao: 'Custo médio ponderado por quilômetro percorrido.',
      calculo: 'Custo Total ÷ Quilometragem Total.',
      observacao: 'Quando a quilometragem total é zero, o indicador retorna zero.',
    },
    receitaPorKg: {
      titulo: 'Receita por KG',
      descricao: 'Receita transportada média por quilograma taxado.',
      calculo:
        'Receita Total Transportada (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) ÷ Peso Taxado Total.',
      observacao: 'Quando o peso taxado total é zero, o indicador retorna zero.',
    },
    receitaPorKm: {
      titulo: 'Receita por Quilômetro',
      descricao: 'Receita transportada média por quilômetro percorrido.',
      calculo:
        'Receita Total Transportada (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) ÷ Quilometragem Total.',
      observacao: 'Quando a quilometragem total é zero, o indicador retorna zero.',
    },
    remuneracao: {
      tabela: {
        titulo: 'Remuneração na Listagem',
        descricao: 'Relação entre custo e receita no nível do manifesto.',
        calculo:
          'Quando a Receita Total Transportada é R$ 0,00 e o Custo Total é maior que R$ 0,00, ou quando a receita está entre R$ 0,01 e R$ 5,00, o manifesto retorna 100%. Quando custo e receita são R$ 0,00, fica sem percentual. Nos demais casos, Custo Total ÷ Receita Total Transportada × 100.',
        observacao: percentualSemBase,
      },
      geral: {
        titulo: 'Remuneração Geral',
        descricao: 'Relação entre o custo dos manifestos e a receita transportada.',
        calculo:
          'Custo Total ÷ Receita Total Transportada (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) × 100.',
        observacao: percentualSemBase,
      },
      distribuicao: {
        titulo: 'Remuneração de Distribuição',
        descricao: 'Relação entre custo e receita dos manifestos de distribuição.',
        calculo:
          'Custo dos Manifestos de Distribuição ÷ Receita Total Transportada de Distribuição (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) × 100.',
        observacao: percentualSemBase,
      },
      transferencia: {
        titulo: 'Remuneração de Transferência',
        descricao: 'Relação entre custo e receita dos manifestos de transferência.',
        calculo:
          'Custo dos Manifestos de Transferência ÷ Receita Total Transportada de Transferência (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) × 100.',
        observacao: percentualSemBase,
      },
      cargaFechada: {
        titulo: 'Remuneração de Carga Fechada',
        descricao: 'Relação entre custo e receita dos manifestos de carga fechada.',
        calculo:
          'Custo dos Manifestos de Carga Fechada ÷ Receita Total Transportada de Carga Fechada (Frete Total + Receita de Coleta (Minuta de Coleta Vinculada)) × 100.',
        observacao: percentualSemBase,
      },
    },
    aproveitamento: {
      geral: {
        titulo: 'Aproveitamento Geral',
        descricao: 'Percentual da capacidade de peso utilizada pelos manifestos.',
        calculo:
          'Peso Taxado Transportado ÷ Capacidade de Lotação × 100. A capacidade soma o veículo trator, a Carreta 1 e a Carreta 2, tratando componentes ausentes como zero.',
        observacao: percentualSemBase,
      },
      distribuicao: {
        titulo: 'Aproveitamento de Distribuição',
        descricao: 'Percentual da capacidade utilizada nos manifestos de distribuição.',
        calculo:
          'Peso Taxado de Distribuição ÷ Capacidade de Lotação de Distribuição × 100. A capacidade soma o veículo trator, a Carreta 1 e a Carreta 2, tratando componentes ausentes como zero.',
        observacao: percentualSemBase,
      },
      transferencia: {
        titulo: 'Aproveitamento de Transferência',
        descricao: 'Percentual da capacidade utilizada nos manifestos de transferência.',
        calculo:
          'Peso Taxado de Transferência ÷ Capacidade de Lotação de Transferência × 100. A capacidade soma o veículo trator, a Carreta 1 e a Carreta 2, tratando componentes ausentes como zero.',
        observacao: percentualSemBase,
      },
      cargaFechada: {
        titulo: 'Aproveitamento de Carga Fechada',
        descricao: 'Percentual da capacidade utilizada nos manifestos de carga fechada.',
        calculo:
          'Peso Taxado de Carga Fechada ÷ Capacidade de Lotação de Carga Fechada × 100. A capacidade soma o veículo trator, a Carreta 1 e a Carreta 2, tratando componentes ausentes como zero.',
        observacao: percentualSemBase,
      },
    },
    efetividade: {
      geral: {
        titulo: 'Efetividade Geral',
        descricao: 'Percentual dos serviços dos manifestos que foram finalizados.',
        calculo: 'Serviços Finalizados ÷ Total de Serviços × 100.',
        observacao: percentualSemBase,
      },
      distribuicao: {
        titulo: 'Efetividade de Distribuição',
        descricao: 'Percentual de serviços finalizados nos manifestos de distribuição.',
        calculo:
          'Serviços Finalizados de Distribuição ÷ Total de Serviços de Distribuição × 100.',
        observacao: percentualSemBase,
      },
      transferencia: {
        titulo: 'Efetividade de Transferência',
        descricao: 'Percentual de serviços finalizados nos manifestos de transferência.',
        calculo:
          'Serviços Finalizados de Transferência ÷ Total de Serviços de Transferência × 100.',
        observacao: percentualSemBase,
      },
      cargaFechada: {
        titulo: 'Efetividade de Carga Fechada',
        descricao: 'Percentual de serviços finalizados nos manifestos de carga fechada.',
        calculo:
          'Serviços Finalizados de Carga Fechada ÷ Total de Serviços de Carga Fechada × 100.',
        observacao: percentualSemBase,
      },
    },
  },

  performance: {
    totalEntregas: {
      titulo: 'Total de Entregas',
      descricao: 'Quantidade total de minutas com previsão de entrega no período.',
      calculo: 'Contagem de Minutas Consolidadas.',
      observacao: periodoPerformance,
    },
    finalizadas: {
      titulo: 'Entregas Finalizadas',
      descricao: 'Quantidade de minutas com status finalizado.',
      calculo: 'Contagem de Minutas Finalizadas.',
      observacao: periodoPerformance,
    },
    noPrazo: {
      titulo: 'Entregas no Prazo',
      descricao: 'Entregas finalizadas na previsão ou antes dela.',
      calculo:
        'Contagem de Finalizadas cuja diferença entre Finalização e Previsão é menor ou igual a zero dia.',
      observacao: periodoPerformance,
    },
    foraDoPrazo: {
      titulo: 'Entregas Fora do Prazo',
      descricao: 'Entregas finalizadas depois da previsão.',
      calculo:
        'Contagem de Finalizadas cuja diferença entre Finalização e Previsão é maior que zero dia.',
      observacao: periodoPerformance,
    },
    percentualPerformance: {
      titulo: 'Performance',
      descricao: 'Percentual das entregas finalizadas que ocorreram dentro do prazo.',
      calculo: 'Entregas no Prazo ÷ Entregas Finalizadas × 100.',
      observacao: percentualSemBase,
    },
    emAtraso: {
      titulo: 'Entregas em Atraso',
      descricao: 'Minutas ainda não finalizadas cuja previsão já venceu.',
      calculo:
        'Contagem de Não Finalizadas com Previsão de Entrega anterior à data atual.',
      observacao:
        'A regra considera qualquer status diferente de finalizado, inclusive cancelados que permaneçam na base filtrada.',
    },
    pesoTaxadoToneladas: {
      titulo: 'Peso Taxado',
      descricao: 'Peso taxado total das minutas, convertido para toneladas.',
      calculo: 'Soma do Peso Taxado em quilogramas ÷ 1.000.',
      observacao: periodoPerformance,
    },
    comprovanteAnexado: {
      titulo: 'Comprovante Anexado',
      descricao: 'Percentual de entregas finalizadas com comprovante anexado.',
      calculo:
        'Finalizadas com Comprovante ÷ Total de Entregas Finalizadas × 100.',
      observacao: percentualSemBase,
    },
    valorNfSemComprovante: {
      titulo: 'Valor de NF sem Comprovante',
      descricao: 'Valor das notas fiscais de entregas finalizadas sem comprovante.',
      calculo:
        'Soma do Valor das Notas Fiscais das Finalizadas sem Comprovante.',
      observacao: periodoPerformance,
    },
  },

  faturamento: {
    totalMinutas: {
      titulo: 'Minutas',
      descricao: 'Quantidade de minutas ativas no período de faturamento.',
      calculo: 'Contagem de Minutas Filtradas.',
      observacao:
        `${periodoFaturamento} A contagem inclui minutas financeiramente inelegíveis; os valores dessas minutas são zerados pela governança.`,
    },
    totalFretes: {
      titulo: 'Fretes',
      descricao: 'Quantidade de fretes ativos no período de faturamento.',
      calculo: 'Contagem de Fretes Filtrados.',
      observacao:
        `${periodoFaturamento} A contagem inclui fretes financeiramente inelegíveis; os valores desses fretes são zerados pela governança.`,
    },
    faturamentoRealizado: {
      titulo: 'Faturamento Realizado',
      descricao: 'Receita bruta elegível acumulada no período.',
      calculo: 'Soma do Valor Total dos Fretes Elegíveis.',
      observacao: `${periodoFaturamento} ${elegibilidadeFaturamento}`,
    },
    faturamentoLiquido: {
      titulo: 'Faturamento Líquido',
      descricao: 'Valor líquido elegível dos fretes no período.',
      calculo: 'Soma do Valor Líquido dos Fretes Elegíveis.',
      observacao: `${periodoFaturamento} ${elegibilidadeFaturamento}`,
    },
    ticketMedio: {
      titulo: 'Ticket Médio',
      descricao: 'Receita bruta média por frete elegível para faturamento.',
      calculo: 'Faturamento Realizado ÷ Quantidade de Fretes Elegíveis.',
      observacao:
        `${elegibilidadeFaturamento} Quando não há fretes elegíveis, o indicador retorna zero.`,
    },
    pesoTaxado: {
      titulo: 'Peso Taxado',
      descricao: 'Peso taxado total dos fretes filtrados.',
      calculo: 'Soma do Peso Taxado.',
      observacao: periodoFaturamento,
    },
    volumes: {
      titulo: 'Volumes',
      descricao: 'Quantidade total de volumes transportados.',
      calculo: 'Soma dos Volumes dos Fretes.',
      observacao: periodoFaturamento,
    },
    metaFaturamento: {
      titulo: 'Meta de Faturamento',
      descricao: 'Meta financeira configurada para os meses e filiais selecionados.',
      calculo:
        'Soma das Metas Mensais aplicáveis ao período e às filiais filtradas.',
      observacao:
        'Se não houver filtro de filial e existir meta global, ela prevalece. Meses parcialmente selecionados recebem a meta mensal inteira, sem rateio por dias.',
    },
    atingimentoMeta: {
      titulo: 'Atingimento da Meta',
      descricao: 'Percentual da meta de faturamento já realizado.',
      calculo: 'Faturamento Realizado ÷ Meta de Faturamento × 100.',
      observacao: percentualSemBase,
    },
    tendenciaPercentual: {
      titulo: 'Tendência',
      descricao: 'Projeção percentual de fechamento em relação à meta.',
      calculo:
        '[(Faturamento Acumulado + Média Diária Real × Dias Úteis Restantes) ÷ Meta] − 1, em percentual.',
      observacao:
        'A projeção usa o calendário de dias úteis. O acumulado considera o período selecionado e a média diária usa somente os dias úteis já fechados.',
    },
    percentualCte: {
      titulo: 'Percentual de CT-e',
      descricao: 'Percentual dos fretes que possuem CT-e emitido.',
      calculo: 'Fretes com CT-e ÷ Total de Fretes × 100.',
      observacao: percentualSemBase,
    },
    percentualNfse: {
      titulo: 'Percentual de NFS-e',
      descricao: 'Percentual dos fretes que possuem NFS-e emitida.',
      calculo: 'Fretes com NFS-e ÷ Total de Fretes × 100.',
      observacao: percentualSemBase,
    },
    previsaoVencida: {
      titulo: 'Fretes com Previsão Vencida',
      descricao: 'Quantidade de fretes cuja previsão de entrega está vencida.',
      calculo:
        'Contagem de Fretes com Previsão anterior à data atual e sem status finalizado ou cancelado.',
      observacao:
        'Na visão atual de faturamento, a previsão não é materializada e este indicador tende a retornar zero.',
    },
    metaDiaria: {
      titulo: 'Meta de Faturamento Diário',
      descricao: 'Parcela média diária da meta mensal.',
      calculo: 'Meta de Faturamento ÷ Total de Dias Úteis do Mês.',
      observacao:
        'Os dias úteis vêm do calendário corporativo, incluindo feriados. Se ele não estiver disponível, são usados os dias de segunda a sexta.',
    },
    faturamentoDiarioReal: {
      titulo: 'Faturamento Diário Real',
      descricao: 'Média diária do faturamento acumulado nos dias úteis já fechados.',
      calculo:
        'Faturamento Acumulado até o último Dia Útil Fechado ÷ Dias Úteis Decorridos.',
      observacao:
        'A data de fechamento nunca ultrapassa o fim do filtro nem a data atual; o divisor mínimo é um.',
    },
    diferencaDiaria: {
      titulo: 'Diferença Diária',
      descricao: 'Distância entre o faturamento diário real e a meta diária.',
      calculo: 'Faturamento Diário Real − Meta de Faturamento Diário.',
    },
    faturamentoFaltante: {
      titulo: 'Faturamento Faltante',
      descricao: 'Valor ainda necessário para alcançar a meta.',
      calculo:
        'Meta de Faturamento − Faturamento Acumulado até o último Dia Útil Fechado.',
      observacao:
        'O valor pode ficar negativo quando o faturamento acumulado supera a meta.',
    },
    metaDiariaDinamica: {
      titulo: 'Meta Diária Dinâmica',
      descricao: 'Média diária necessária nos dias úteis restantes para alcançar a meta.',
      calculo: 'Faturamento Faltante ÷ Dias Úteis Restantes.',
      observacao:
        'O divisor mínimo é um. O resultado pode ficar negativo quando a meta já foi superada.',
    },
  },

  faturasPorCliente: {
    valorFaturado: {
      titulo: 'Valor Faturado',
      descricao: 'Valor operacional total dos registros faturados.',
      calculo: 'Soma do Valor Operacional com status Faturado.',
      observacao: 'O período considera a data de emissão do CT-e.',
    },
    registrosFaturados: {
      titulo: 'Registros Faturados',
      descricao: 'Quantidade de registros com faturamento concluído.',
      calculo: 'Contagem de Registros com status Faturado.',
      observacao: 'O período considera a data de emissão do CT-e.',
    },
    aguardandoFaturamento: {
      titulo: 'Aguardando Faturamento',
      descricao: 'Quantidade de registros ainda aguardando faturamento.',
      calculo:
        'Contagem de Registros com status Aguardando Faturamento.',
      observacao: 'O período considera a data de emissão do CT-e.',
    },
    titulosEmAtraso: {
      titulo: 'Títulos em Atraso',
      descricao: 'Títulos faturados, vencidos e ainda sem pagamento.',
      calculo:
        'Contagem de Faturados com Vencimento anterior à data atual e sem Data de Pagamento.',
      observacao: 'O período considera a data de emissão do CT-e.',
    },
    prazoMedio: {
      titulo: 'Prazo Médio',
      descricao: 'Prazo médio concedido entre a data-base e o vencimento da fatura.',
      calculo:
        'Soma dos dias completos entre Data-base e Vencimento ÷ Registros com Documento de Fatura e ambas as datas.',
      observacao:
        'A média não é limitada ao status faturado; participam os registros que possuem documento e datas válidas.',
    },
    clientesAtivos: {
      titulo: 'Clientes Ativos',
      descricao: 'Quantidade de clientes distintos presentes no período.',
      calculo: 'Contagem distinta de Clientes.',
      observacao:
        'Todos os status filtrados participam da contagem. O período considera a data de emissão do CT-e.',
    },
  },

  contasAPagar: {
    valorAPagar: {
      titulo: 'Valor a Pagar',
      descricao: 'Valor total original dos títulos no período.',
      calculo: 'Soma do Valor a Pagar.',
      observacao: 'O período considera a data de emissão do título.',
    },
    valorPago: {
      titulo: 'Valor Pago',
      descricao: 'Valor total já pago nos títulos selecionados.',
      calculo: 'Soma do Valor Pago.',
      observacao: 'O período considera a data de emissão do título.',
    },
    saldoAberto: {
      titulo: 'Saldo em Aberto',
      descricao: 'Valor líquido ainda não quitado.',
      calculo: 'Valor a Pagar − Valor Pago.',
    },
    taxaLiquidacao: {
      titulo: 'Taxa de Liquidação',
      descricao: 'Percentual dos títulos marcados como pagos.',
      calculo: 'Títulos Pagos ÷ Total de Títulos × 100.',
      observacao:
        `São considerados pagos os títulos sinalizados como “Sim” ou “Pago”. ${percentualSemBase}`,
    },
    leadTime: {
      titulo: 'Lead Time de Pagamento',
      descricao: 'Tempo médio entre a emissão e a liquidação do título.',
      calculo:
        'Soma dos dias completos entre Emissão e Liquidação ÷ Títulos com ambas as datas.',
    },
    percentualConciliado: {
      titulo: 'Percentual Conciliado',
      descricao: 'Percentual de títulos identificados como conciliados.',
      calculo: 'Títulos com indicação de Conciliação ÷ Total de Títulos × 100.',
      observacao:
        `A indicação é reconhecida quando o texto de conciliação contém a expressão “conciliado”. ${percentualSemBase}`,
    },
  },

  cotacoes: {
    totalCotacoes: {
      titulo: 'Total de Cotações',
      descricao: 'Quantidade de linhas de cotação no período selecionado.',
      calculo: 'Contagem de Cotações Filtradas.',
      observacao: periodoCotacoes,
    },
    valorPotencial: {
      titulo: 'Valor Potencial',
      descricao: 'Valor total ofertado em todas as cotações.',
      calculo: 'Soma do Valor de Frete Cotado.',
      observacao: periodoCotacoes,
    },
    valorConvertido: {
      titulo: 'Valor Convertido',
      descricao: 'Valor ofertado nas cotações convertidas.',
      calculo: 'Soma do Valor de Frete das Cotações Convertidas.',
      observacao: periodoCotacoes,
    },
    freteMedio: {
      titulo: 'Frete Médio',
      descricao: 'Valor médio ofertado por cotação.',
      calculo: 'Valor Potencial ÷ Total de Cotações.',
      observacao: 'Quando não há cotações, o indicador retorna zero.',
    },
    fretePorKg: {
      titulo: 'Frete por Quilograma',
      descricao: 'Valor médio ponderado por quilograma cotado.',
      calculo:
        'Valor de Frete das Cotações com Peso Positivo ÷ Peso Positivo Total.',
      observacao: 'Cotações sem peso positivo não participam da razão.',
    },
    conversaoValor: {
      titulo: 'Conversão por Valor',
      descricao: 'Percentual do valor potencial que foi convertido.',
      calculo: 'Valor Convertido ÷ Valor Potencial × 100.',
      observacao: percentualSemBase,
    },
    conversaoQuantidade: {
      titulo: 'Conversão por Quantidade',
      descricao: 'Percentual das cotações que foram convertidas.',
      calculo: 'Cotações Convertidas ÷ Total de Cotações × 100.',
      observacao: percentualSemBase,
    },
    reprovacao: {
      titulo: 'Reprovação',
      descricao: 'Percentual das cotações reprovadas ou perdidas.',
      calculo:
        '(Cotações Reprovadas + Cotações Perdidas) ÷ Total de Cotações × 100.',
      observacao: percentualSemBase,
    },
    conversaoCte: {
      titulo: 'Conversão em CT-e',
      descricao: 'Percentual das cotações que resultaram em emissão de CT-e.',
      calculo: 'Cotações com CT-e Emitido ÷ Total de Cotações × 100.',
      observacao: percentualSemBase,
    },
    conversaoNfse: {
      titulo: 'Conversão em NFS-e',
      descricao: 'Percentual das cotações que resultaram em emissão de NFS-e.',
      calculo: 'Cotações com NFS-e Emitida ÷ Total de Cotações × 100.',
      observacao: percentualSemBase,
    },
    tempoMedioConversao: {
      titulo: 'Tempo Médio de Conversão',
      descricao: 'Tempo médio entre a cotação e a emissão do CT-e.',
      calculo:
        'Soma das horas entre Cotação e Emissão do CT-e ÷ Cotações com ambas as datas.',
    },
  },

  tracking: {
    totalCargas: {
      titulo: 'Total de Cargas',
      descricao: 'Quantidade de cargas em aberto no período.',
      calculo: 'Contagem de Cargas Não Finalizadas.',
      observacao: periodoTracking,
    },
    emTransito: {
      titulo: 'Cargas em Trânsito',
      descricao: 'Quantidade de cargas em entrega, transferência ou manifestadas.',
      calculo:
        'Contagem de Cargas com status Em Entrega, Em Transferência ou Manifestado.',
      observacao: periodoTracking,
    },
    previsaoVencida: {
      titulo: 'Previsão Vencida',
      descricao: 'Cargas abertas cuja previsão de entrega já venceu.',
      calculo:
        'Cargas com Previsão anterior à data atual e sem status Finalizado ou Cancelado.',
      observacao: periodoTracking,
    },
    valorCarteira: {
      titulo: 'Valor da Carteira',
      descricao: 'Valor de frete total das cargas em aberto.',
      calculo: 'Soma do Valor de Frete das Cargas Não Finalizadas.',
      observacao: periodoTracking,
    },
    pesoTaxado: {
      titulo: 'Peso Taxado',
      descricao: 'Peso taxado total das cargas em aberto.',
      calculo: 'Soma do Peso Taxado das Cargas Não Finalizadas.',
      observacao: periodoTracking,
    },
    percentualFinalizado: {
      titulo: 'Percentual Finalizado',
      descricao: 'Percentual de cargas finalizadas entre as cargas não canceladas.',
      calculo: 'Cargas Finalizadas ÷ Cargas Não Canceladas × 100.',
      observacao:
        'A projeção usada pelo dashboard já exclui cargas finalizadas; por isso, este campo tende a retornar zero e não é exibido nos cards atuais.',
    },
  },

  executivo: {
    receitaOperacional: {
      titulo: 'Receita Operacional',
      descricao: 'Receita bruta elegível consolidada no painel executivo.',
      calculo: 'Soma da Receita Bruta do painel de Faturamento.',
      observacao: `${periodoFaturamento} ${elegibilidadeFaturamento}`,
    },
    valorFaturado: {
      titulo: 'Valor Faturado',
      descricao: 'Valor faturado consolidado por cliente no período selecionado.',
      calculo: 'Soma do Valor Faturado do painel de Faturas por Cliente.',
      observacao: 'O período considera a data de emissão do CT-e.',
    },
    saldoAReceber: {
      titulo: 'A Receber',
      descricao: 'Saldo a receber reservado para a visão executiva.',
      calculo: 'Indicador atualmente fixado em zero.',
      observacao:
        'A camada de dados ainda não fornece saldo a receber para o painel executivo.',
    },
    saldoAPagar: {
      titulo: 'A Pagar',
      descricao: 'Saldo financeiro em aberto no contas a pagar.',
      calculo: 'Soma do Saldo em Aberto do painel de Contas a Pagar.',
    },
    backlogColetas: {
      titulo: 'Backlog de Coletas',
      descricao: 'Quantidade de coletas ainda não concluídas no período.',
      calculo: 'Total de Coletas − Coletas Finalizadas.',
      observacao: periodoColetas,
    },
    cargasPrevisaoVencida: {
      titulo: 'Previsão Vencida',
      descricao: 'Cargas em aberto cuja previsão de entrega está vencida.',
      calculo: 'Cargas com Previsão anterior à data atual e sem status Finalizado ou Cancelado.',
      observacao: periodoTracking,
    },
    ocupacaoMediaManifestos: {
      titulo: 'Ocupação de Manifestos',
      descricao: 'Percentual médio de ocupação de peso dos manifestos.',
      calculo: 'Peso Taxado Transportado ÷ Capacidade de Lotação × 100.',
      observacao: periodoManifestos,
    },
    resumoFinanceiro: {
      totalFaturado: {
        titulo: 'Total Faturado',
        descricao: 'Receita bruta elegível agrupada por filial.',
        calculo: 'Soma da Receita Bruta dos fretes elegíveis por filial.',
        observacao: `${periodoFaturamento} ${elegibilidadeFaturamento}`,
      },
      fretePeso: {
        titulo: 'Frete Peso',
        descricao: 'Peso taxado total dos fretes transportados por filial.',
        calculo: 'Soma de peso_taxado dos fretes filtrados.',
        observacao:
          'Este indicador não restringe o peso pela elegibilidade de faturamento.',
      },
      freteValor: {
        titulo: 'Frete Valor',
        descricao: 'Valor de frete original dos fretes transportados por filial.',
        calculo: 'Soma de valor_frete_original dos fretes filtrados.',
        observacao:
          'Este indicador não restringe o valor pela elegibilidade de faturamento; quando o valor original não existe, usa o valor de frete publicado pela fato.',
      },
      ticketMedio: {
        titulo: 'Ticket Médio',
        descricao: 'Receita bruta média por frete elegível em cada filial.',
        calculo: 'Total Faturado ÷ Quantidade de Fretes Elegíveis.',
        observacao:
          `${elegibilidadeFaturamento} Quando não há fretes elegíveis, o indicador retorna zero.`,
      },
    },
  },

  integracoes: {
    volumeOperacional: {
      titulo: 'Volume Operacional',
      descricao: 'Quantidade total de registros de integração no período selecionado.',
      calculo: 'Soma do total de registros consolidados por sistema destino enviado pelo Satélite.',
      observacao:
        'Indicador renderizado pelo Dashboard a partir da resposta consolidada do microsserviço Satélite. Quando há filtro Integração, considera somente os destinos selecionados.',
    },
    taxaSucessoGlobal: {
      titulo: 'Taxa de Sucesso Dados/Eventos',
      descricao: 'Percentual global de registros com a etapa principal integrada com sucesso no período selecionado.',
      calculo: 'Média ponderada do percentual de sucesso de dados/eventos por sistema destino, usando o volume de cada destino como peso.',
      observacao:
        'Os percentuais e volumes por destino são calculados pelo microsserviço Satélite. ' +
        `Quando há filtro Integração, considera somente os destinos selecionados. ${percentualSemBase}`,
    },
    taxaSucessoCanhotos: {
      titulo: 'Taxa de Sucesso Comprovantes/POD',
      descricao: 'Percentual global de comprovantes integrados com sucesso no período selecionado.',
      calculo: 'Média ponderada do percentual de sucesso de comprovantes/POD por sistema destino, usando o volume de cada destino como peso.',
      observacao:
        'Os percentuais e volumes por destino são calculados pelo microsserviço Satélite. ' +
        `Quando há filtro Integração, considera somente os destinos selecionados. ${percentualSemBase}`,
    },
    pendenciasErros: {
      titulo: 'Pendências',
      descricao: 'Quantidade de registros classificados como erro na evolução diária do período selecionado.',
      calculo: 'Soma dos erros diários enviados pelo endpoint de evolução diária do Satélite.',
      observacao:
        'O agrupamento diário e a classificação de sucesso ou erro são calculados pelo microsserviço Satélite e respeitam os destinos selecionados no filtro Integração.',
    },
    ciclosSftpVedacit: {
      titulo: 'Ciclos SFTP Vedacit',
      descricao: 'Situação mais recente e histórico paginado do worker que lê comprovantes no SFTP Vedacit.',
      calculo: 'Valores registrados pelo ciclo do worker: inventário, seleção, envios, pendências, saldo, bloqueios, timeouts e duração.',
      observacao:
        'A fonte é a auditoria técnica do Satélite. O estado waiting restart do PM2 é esperado entre ciclos; a próxima execução é estimada como término do último ciclo mais 30 minutos.',
    },
    taxaSucessoIntegracao: {
      titulo: 'Taxa de Sucesso da Integração',
      descricao:
        'Percentual de registros integrados com sucesso. Reflete o envio consolidado em relação ao volume total no período selecionado.',
      calculo: 'Registros integrados com sucesso ÷ Volume total de registros × 100.',
      observacao:
        'Indicador calculado pelo microsserviço Satélite a partir da auditoria de integração. ' +
        percentualSemBase,
    },
    vedacitXml: {
      titulo: 'VEDACIT XML',
      descricao: 'Percentual de registros Vedacit com XML enviado com sucesso.',
      calculo: 'Registros Vedacit com status de dados SUCESSO ÷ Total de registros Vedacit × 100.',
      observacao:
        'Indicador calculado pelo microsserviço Satélite a partir da auditoria de integração. ' +
        percentualSemBase,
    },
    vedacitComprovante: {
      titulo: 'VEDACIT Comprovante',
      descricao: 'Percentual de registros Vedacit com comprovante enviado com sucesso.',
      calculo: 'Registros Vedacit com status de canhoto SUCESSO ÷ Total de registros Vedacit × 100.',
      observacao:
        'Indicador calculado pelo microsserviço Satélite a partir da auditoria de integração. ' +
        percentualSemBase,
    },
    ppgComprovante: {
      titulo: 'PPG Comprovante',
      descricao: 'Percentual de registros PPG com comprovante enviado com sucesso.',
      calculo: 'Registros PPG com status de canhoto SUCESSO ÷ Total de registros PPG × 100.',
      observacao:
        'Indicador calculado pelo microsserviço Satélite a partir da auditoria de integração. ' +
        percentualSemBase,
    },
    sazonalidade: {
      titulo: 'Sazonalidade de Integrações',
      descricao: 'Evolução diária dos registros de integração classificados como sucesso ou erro no período selecionado.',
      calculo: 'Séries de sucessos e erros agrupadas por data no endpoint de evolução diária do Satélite.',
      observacao:
        'O Dashboard apenas renderiza as séries temporais retornadas pelo microsserviço Satélite.',
    },
    saudePorDestino: {
      titulo: 'Saúde por Sistema Destino',
      descricao: 'Comparação do volume integrado com sucesso e do volume remanescente por sistema destino.',
      calculo: 'Total de registros por destino × percentual de sucesso XML para sucessos; o restante compõe erros.',
      observacao:
        'O total e o percentual de sucesso XML por destino são calculados pelo microsserviço Satélite e respeitam os destinos selecionados no filtro Integração.',
    },
  },

  etlSaude: {
    tempoMedioExecucao: {
      titulo: 'Tempo Médio de Execução',
      descricao: 'Duração média das execuções do ETL no período selecionado.',
      calculo: 'Média, em segundos, entre timestamp_inicio e timestamp_fim de cada execução registrada.',
      observacao: 'A fonte é dbo.log_extracoes e o período considera timestamp_inicio.',
    },
    execucoesComErro: {
      titulo: 'Execuções com Erro',
      descricao: 'Quantidade de execuções por entidade/tabela que não terminaram com sucesso.',
      calculo: 'Contagem de status_final diferente de COMPLETO, SUCCESS ou SUCESSO.',
      observacao: 'Status vazio também é tratado como erro operacional em dbo.log_extracoes.',
    },
    totalExecucoes: {
      titulo: 'Total de Execuções',
      descricao: 'Quantidade de execuções por entidade/tabela registradas no período selecionado.',
      calculo: 'COUNT(1) sobre dbo.log_extracoes.',
      observacao: 'O período considera timestamp_inicio.',
    },
    volumeProcessado: {
      titulo: 'Volume Processado',
      descricao: 'Quantidade total de registros processados pelas execuções filtradas.',
      calculo: 'Soma de registros_extraidos e noop_count em dbo.log_extracoes.',
      observacao: 'A mesma fonte das falhas e do resumo por tabela.',
    },
    taxaSucesso: {
      titulo: 'Taxa de Sucesso',
      descricao: 'Percentual de execuções por entidade/tabela encerradas com sucesso.',
      calculo: 'Status COMPLETO, SUCCESS ou SUCESSO ÷ Total de Execuções × 100.',
      observacao:
        `${percentualSemBase} Usa a mesma auditoria operacional em dbo.log_extracoes do gráfico Sucessos/Falhas por Dia.`,
    },
  },

  gestaoAVista: {
    resumo: {
      performanceFretes: {
        titulo: 'Nova Tela de Fretes',
        descricao: 'Percentual de minutas válidas entregues no prazo.',
        calculo: 'Entregas no Prazo ÷ Total de Entregas Válidas × 100.',
        observacao:
          `${baseGestaoPerformance} Entregas ainda em aberto permanecem no total e reduzem o percentual. O ranking detalha o mesmo contrato por responsável, região e cidade via drill-down.`,
      },
      utilizacaoColetores: {
        titulo: 'Utilização dos Coletores',
        descricao: 'Relação entre ordens de conferência e manifestos bipáveis.',
        calculo:
          'Ordens de Conferência ÷ (Manifestos Emitidos + Descarregamentos) × 100.',
        observacao: percentualSemBase,
      },
      cubagemMercadorias: {
        titulo: 'Cubagem de Mercadorias',
        descricao: 'Percentual das minutas válidas que possuem volume cúbico informado.',
        calculo: 'Minutas Cubadas ÷ Total de Minutas Válidas × 100.',
        observacao: `${baseGestaoCubagem} ${percentualSemBase}`,
      },
      indenizacaoMercadorias: {
        titulo: 'Indenização de Mercadorias',
        descricao: 'Percentual do faturamento comprometido por indenizações.',
        calculo: 'Valor Absoluto Indenizado ÷ Faturamento Base × 100.',
        observacao: percentualSemBase,
      },
      horariosCorte: {
        titulo: 'Horários de Corte',
        descricao: 'Percentual das saídas realizadas dentro do horário de corte.',
        calculo: 'Saídas no Horário ÷ Total de Saídas Programadas × 100.',
        observacao:
          `Há tolerância de 10 minutos após o horário de corte da rota. ${regraHorarioCorteCwbNhb} SMs com justificativa ativa contam como no horário; ao excluir logicamente a justificativa, a SM volta ao status original de contabilização. ${percentualSemBase}`,
      },
    },

    performance: {
      totalEntregas: {
        titulo: 'Total de Entregas',
        descricao: 'Quantidade de minutas válidas com previsão no período.',
        calculo: 'Entregas no Prazo + Entregas Fora do Prazo + Entregas em Aberto.',
        observacao: baseGestaoPerformance,
      },
      foraDoPrazo: {
        titulo: 'Entregas Fora do Prazo',
        descricao: 'Minutas concluídas depois da previsão.',
        calculo:
          'Contagem de Minutas cuja Finalização ocorreu mais de zero dia após a Previsão.',
        observacao: baseGestaoPerformance,
      },
      noPrazo: {
        titulo: 'Entregas no Prazo',
        descricao: 'Minutas concluídas na previsão ou antes dela.',
        calculo:
          'Contagem de Minutas cuja Finalização ocorreu até a Previsão.',
        observacao: baseGestaoPerformance,
      },
      percentualNoPrazo: {
        titulo: 'Performance de Entrega',
        descricao: 'Percentual de todas as minutas válidas que foram concluídas no prazo.',
        calculo: 'Entregas no Prazo ÷ Total de Entregas Válidas × 100.',
        observacao:
          `${baseGestaoPerformance} Entregas em aberto permanecem no denominador. O gráfico de apoio permite drill-down por responsável, região e cidade, sempre recalculado no SQL para o agrupamento atual. ${percentualSemBase}`,
      },
      gapMeta: {
        titulo: 'Gap vs Meta de Performance',
        descricao: 'Quanto falta para alcançar a meta mínima de performance.',
        calculo: 'Máximo entre (Meta − Performance Atual) e zero.',
        observacao: 'Quando a performance alcança ou supera a meta, o gap é zero.',
      },
    },

    coletores: {
      ordensConferencia: {
        titulo: 'Ordens de Conferência',
        descricao: 'Quantidade de ordens operacionais iniciadas no período.',
        calculo:
          'Contagem de Ordens de Picking, Retorno, Recebimento, Carregamento e Descarregamento.',
        observacao:
          'Ordens repetidas são consolidadas pelo número, preservando a versão mais recente.',
      },
      manifestosBipaveis: {
        titulo: 'Manifestos Bipáveis',
        descricao: 'Total de oportunidades operacionais de bipagem.',
        calculo: 'Manifestos Emitidos + Descarregamentos.',
        observacao:
          'Manifestos repetidos são consolidados. Carga fechada, acerto de motorista, frete retorno e viagem vazia não entram nesta base.',
      },
      descarregamentos: {
        titulo: 'Descarregamentos',
        descricao: 'Quantidade de manifestos atribuídos a uma filial de descarregamento.',
        calculo: 'Contagem de Manifestos com Local de Descarregamento Elegível.',
        observacao:
          'Quando há vários locais, cada manifesto é atribuído a apenas um deles para evitar duplicidade.',
      },
      ordensIncompletas: {
        titulo: 'Ordens Incompletas',
        descricao: 'Ordens de conferência iniciadas e ainda sem finalização.',
        calculo: 'Contagem de Ordens sem Data de Finalização.',
      },
      percentualUtilizacao: {
        titulo: 'Utilização dos Coletores',
        descricao: 'Relação entre ordens de conferência e manifestos bipáveis.',
        calculo:
          'Ordens de Conferência ÷ (Manifestos Emitidos + Descarregamentos) × 100.',
        observacao: percentualSemBase,
      },
    },

    cubagem: {
      totalMinutas: {
        titulo: 'Total de Minutas Válidas',
        descricao: 'Quantidade de minutas aptas para o indicador de cubagem.',
        calculo: 'Contagem de Minutas Válidas para Cubagem.',
        observacao: baseGestaoCubagem,
      },
      minutasCubadas: {
        titulo: 'Minutas Cubadas',
        descricao: 'Minutas válidas que possuem volume cúbico diferente de zero.',
        calculo: 'Contagem de Minutas com Volume Cúbico diferente de zero.',
        observacao: baseGestaoCubagem,
      },
      minutasSemCubagem: {
        titulo: 'Minutas sem Cubagem',
        descricao: 'Minutas válidas sem volume cúbico informado.',
        calculo: 'Total de Minutas Válidas − Minutas Cubadas.',
        observacao: baseGestaoCubagem,
      },
      minutasComPesoReal: {
        titulo: 'Minutas com Peso Real',
        descricao: 'Minutas válidas que possuem peso real positivo.',
        calculo: 'Contagem de Minutas com Peso Real maior que zero.',
        observacao: baseGestaoCubagem,
      },
      percentualCubagem: {
        titulo: 'Percentual de Cubagem',
        descricao: 'Percentual das minutas válidas que foram cubadas.',
        calculo: 'Minutas Cubadas ÷ Total de Minutas Válidas × 100.',
        observacao: `${baseGestaoCubagem} ${percentualSemBase}`,
      },
      gapMeta: {
        titulo: 'Gap vs Meta de Cubagem',
        descricao: 'Quanto falta para alcançar a meta mínima de cubagem.',
        calculo: 'Máximo entre (Meta − Percentual de Cubagem) e zero.',
        observacao: 'Quando a cubagem alcança ou supera a meta, o gap é zero.',
      },
    },

    indenizacao: {
      valorIndenizado: {
        titulo: 'Valor Indenizado',
        descricao: 'Valor absoluto total pago ou devido em sinistros.',
        calculo: 'Soma dos Valores Absolutos de Indenização.',
        observacao:
          'O período considera a data de abertura do sinistro. Sinistros repetidos são consolidados pela versão mais recente.',
      },
      totalSinistros: {
        titulo: 'Total de Sinistros',
        descricao: 'Quantidade de sinistros válidos no período.',
        calculo: 'Contagem de Sinistros Consolidados.',
        observacao:
          'O período considera a data de abertura. São exigidos número e data válidos para o sinistro.',
      },
      faturamentoBase: {
        titulo: 'Faturamento Base',
        descricao: 'Receita bruta ativa usada como base de comparação das indenizações.',
        calculo: 'Soma do Faturamento Bruto no mesmo período e filiais.',
        observacao: 'O período considera a data de referência de faturamento.',
      },
      percentualIndenizacao: {
        titulo: 'Percentual de Indenização',
        descricao: 'Percentual do faturamento comprometido por indenizações.',
        calculo: 'Valor Absoluto Indenizado ÷ Faturamento Base × 100.',
        observacao: percentualSemBase,
      },
      acimaDoLimite: {
        titulo: 'Acima do Limite',
        descricao: 'Excesso do percentual de indenização sobre o limite máximo.',
        calculo:
          'Máximo entre (Percentual de Indenização − Limite) e zero.',
        observacao: 'Quando o percentual está dentro do limite, o excesso é zero.',
      },
    },

    horariosCorte: {
      saidasNoHorario: {
        titulo: 'Saídas no Horário',
        descricao: 'Viagens iniciadas até o limite tolerado para a rota.',
        calculo:
          'Contagem de Saídas com Início Real até Horário de Corte + 10 minutos, incluindo SMs com justificativa ativa.',
        observacao:
          'A data-base é a partida programada; quando ela não existe, é usada a data do início real. A rota RJR → SPO possui corte operacional às 22h.',
      },
      saidasForaHorario: {
        titulo: 'Saídas Fora do Horário',
        descricao: 'Viagens iniciadas depois do limite tolerado para a rota.',
        calculo: 'Total Programado − Saídas no Horário; SMs justificadas são removidas deste grupo.',
      },
      totalProgramado: {
        titulo: 'Total Programado',
        descricao: 'Quantidade de viagens aptas à avaliação do horário de corte.',
        calculo:
          'Contagem de Viagens com Rota Mapeada, Horário de Corte e Início Real.',
      },
      percentualNoHorario: {
        titulo: 'Percentual no Horário',
        descricao: 'Percentual das saídas programadas realizadas dentro do limite.',
        calculo: 'Saídas no Horário, incluindo SMs com justificativa ativa, ÷ Total Programado × 100.',
        observacao:
          `Há tolerância de 10 minutos após o horário de corte. ${regraHorarioCorteCwbNhb} SMs com justificativa ativa contam como no horário; ao excluir logicamente a justificativa, a SM volta ao status original de contabilização. ${percentualSemBase}`,
      },
      gapMeta: {
        titulo: 'Gap vs Meta de Horário',
        descricao: 'Quanto falta para alcançar a meta mínima de saídas no horário.',
        calculo: 'Máximo entre (Meta − Percentual no Horário) e zero.',
        observacao: 'Quando o indicador alcança ou supera a meta, o gap é zero.',
      },
    },
  },
} as const satisfies KpiDefinitionGroup;
