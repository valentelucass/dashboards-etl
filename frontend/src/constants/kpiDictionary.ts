export interface KpiDefinition {
  readonly titulo: string;
  readonly descricao: string;
  readonly calculo: string;
  readonly observacao?: string;
}

export interface KpiDefinitionGroup {
  readonly [key: string]: KpiDefinition | KpiDefinitionGroup;
}

export const COLUNAS_PENDENCIAS_INTEGRACOES = {
  etapa: {
    label: 'Etapa',
    descricao: 'Parte da integração acompanhada: XML/dados ou eventos (AddEvents/Ocorrência), e comprovante de entrega. A mesma nota pode aparecer nas duas etapas.',
  },
  pendentes: {
    label: 'Pendentes',
    descricao: 'Etapas que ainda aguardam processamento ou tratamento de erro. Exclui os bloqueados e os registros a conferir. É o saldo atual, considerando todas as datas.',
  },
  bloqueados: {
    label: 'Bloqueados',
    descricao: 'Etapas impedidas de avançar por falta de informações ou arquivos, recusa do cliente ou dúvida sobre o recebimento do comprovante. Precisam de correção ou conferência antes de liberar uma nova tentativa.',
  },
  conferir: {
    label: 'A conferir',
    descricao: 'Registros sem data de confirmação ou sem classificação suficiente. Por isso, não entram nos envios confirmados. Esse número, sozinho, não significa que o documento deixou de ser enviado.',
  },
} as const;

const percentualSemBase =
  'Quando o denominador é zero, o indicador retorna 0%.';

const periodoColetas =
  'O período considera a data de solicitação. Solicitações repetidas são consolidadas pelo identificador, preservando a versão mais recente. Coletas que não são mais retornadas pelo ESL permanecem na tabela e exportação como "Excluída", mas não participam dos indicadores.';

const periodoManifestos =
  'O período considera a competência operacional do manifesto: data de saída; quando a saída não existe, usa a data de criação.';

const regraTipoContratoManifestos =
  'Veículos de propriedade da LM Transportes são reclassificados como Frota + PX. Casos sem motorista informado recebem fallback para Terceiro ou Frota + PX dependendo da tração.';

const periodoPerformance =
  'Cada minuta conta uma vez no período da previsão, com prioridade para o registro com finalização e, em seguida, para o mais recente. A reentrega vence no segundo dia útil após a emissão do CT-e. Sem emissão, vale a previsão original. Complementares e substitutos ficam fora. O original substituído e as devoluções continuam elegíveis.';

const periodoFaturamento =
  'O período considera a data de referência de faturamento. Registros excluídos na origem não entram na apuração.';

const elegibilidadeFaturamento =
  'Os valores financeiros consideram somente fretes elegíveis: sem cancelamento do documento, sem cortesia, sem bloqueio de faturamento e não marcados como inelegíveis na origem.';

const periodoCotacoes =
  'O período considera a data da cotação. O resumo conta as linhas filtradas sem consolidação adicional por cotação.';

const periodoTracking =
  'O período considera a data do frete e trabalha somente com cargas ainda não finalizadas.';

const filtrosLocalizacao =
  'O período usa a data do frete. Filial atual, status e número da minuta restringem a consulta. No Armazém reúne No Galpão, Pendente e cargas sem status.';

const baseGestaoPerformance =
  'A filial base corresponde ao responsável pela região de destino na tela Performance. As duas telas usam as mesmas minutas e a mesma previsão de entrega. Reentregas com CT-e têm prazo de dois dias úteis. Fretes complementares e de substituição ficam fora da contagem.';

const baseGestaoCubagem =
  'Considera minutas válidas, não canceladas, com valor operacional e fora das exceções oficiais ativas de pagadores sem cubagem em dbo.cliente_excecao_cubagem, além do flag legado de exclusão publicado na fato. Cada minuta aparece uma única vez.';

const regraHorarioCorteCwbNhb =
  'Na linha CWB-NHB, o corte operacional vigente é 22h.';

export const KpiDictionary = {
  dre: {
    bruta: { titulo: 'Receita Bruta · Fretes Emitidos', descricao: 'Receita dos fretes na competência selecionada.', calculo: 'Soma da receita bruta publicada em Faturamento, com os mesmos critérios de elegibilidade e de data.' },
    liquida: { titulo: 'Receita Líquida', descricao: 'Receita após os impostos do demonstrativo.', calculo: 'A apuração depende da conciliação de ICMS, PIS/COFINS, contribuição previdenciária e ISS.' },
    lucro: { titulo: 'Lucro Bruto', descricao: 'Resultado após os custos da operação.', calculo: 'Depende dos custos operacionais e da absorção da frota conforme o fechamento de Custos.' },
    margem: { titulo: 'Margem Bruta %', descricao: 'Participação do lucro bruto na receita líquida.', calculo: 'Lucro bruto dividido pela receita líquida da mesma competência. Aguarda o fechamento das duas contas.' },
    resultado: { titulo: 'Resultado Líquido', descricao: 'Lucro líquido da competência selecionada.', calculo: 'Depende da conciliação das despesas administrativas, comerciais e do resultado financeiro.' },
  },
  customerService: {
    entregas: { titulo: 'Total de entregas', descricao: 'Minutas de entrega da conta selecionada.', calculo: periodoPerformance },
    otif: { titulo: 'OTIF de entrega', descricao: 'Percentual de entregas finalizadas dentro do prazo.', calculo: 'Entregas no prazo divididas pelas entregas finalizadas da conta no período da previsão.' },
    coleta: { titulo: 'Performance de coleta', descricao: 'Percentual das coletas finalizadas que atenderam ao prazo.', calculo: 'Coletas finalizadas no prazo divididas pelas finalizadas da conta, no período da solicitação.' },
    peso: { titulo: 'Peso transportado', descricao: 'Peso real dos fretes considerados na operação do cliente.', calculo: 'Soma do peso real em quilogramas. A unidade exibida acompanha o volume.' },
    notaFiscal: { titulo: 'Valor das NFs', descricao: 'Valor das mercadorias informado nas notas fiscais dos fretes.', calculo: 'Soma do valor de notas das minutas da conta, no período das entregas.' },
    frete: { titulo: 'Valor dos fretes', descricao: 'Valor dos serviços de transporte das minutas da conta.', calculo: 'Soma do valor de frete com impostos, no período das entregas.' },
  },
  redeCredenciada: {
    otif: { titulo: 'OTIF · Entregas no prazo', descricao: 'Pontualidade das entregas executadas por parceiros da carteira.', calculo: 'Entregas no prazo divididas pelas finalizadas, com a mesma regra e data de ocorrência de Performance.' },
    efd: { titulo: 'EFD · Eficiência de destino', descricao: 'Eficiência das etapas de destino dos parceiros executores.', calculo: 'Etapas eficientes divididas pelas avaliadas. O limite é de 48 horas, descontados fins de semana e feriados nacionais.' },
    coletas: { titulo: 'Performance de coleta', descricao: 'Pontualidade das coletas com executor identificado.', calculo: 'Coletas finalizadas até o agendamento divididas pelas finalizadas do parceiro. O agente registrado ou o manifesto de coleta identifica o executor.' },
    anexados: { titulo: 'Comprovantes anexados', descricao: 'Entregas do parceiro que têm comprovante anexado hoje.', calculo: 'Entregas finalizadas com anexo divididas pelas finalizadas do parceiro no período de previsão.' },
    arquivados: { titulo: 'Comprovantes arquivados', descricao: 'Entregas do parceiro que já têm número de arquivamento no ESL.', calculo: 'Entregas distintas arquivadas até a última atualização divididas pelas finalizadas do parceiro no período de previsão.' },
    participacao: { titulo: 'Frete da rede sobre o frete Rodogarcia', descricao: 'Participação da cobrança do parceiro nos fretes vinculados.', calculo: 'Valor cobrado nas consolidações válidas com minuta dividido pelo frete bruto dessas minutas. Cada frete conta uma vez.' },
    cobrado: { titulo: 'Valor cobrado pelo parceiro', descricao: 'Cobrança das transportadoras da carteira por data de emissão.', calculo: 'Soma das cobranças em análise, inclusive as históricas e as sem minuta. Bloqueios e cálculos zerados ficam em conferência.' },
    calculado: { titulo: 'Valor calculado pelo sistema', descricao: 'Frete apurado pelo ESL nas consolidações em análise.', calculo: 'Soma dos valores calculados por data de emissão, conforme a carteira do departamento de parcerias.' },
    diferenca: { titulo: 'Diferença total', descricao: 'Diferença entre o que os parceiros cobraram e o que o ESL calculou.', calculo: 'Valor cobrado menos valor calculado nas consolidações em análise. Um resultado positivo indica cobrança acima do cálculo.' },
  },
  administracao: {
    navegacaoHoje: {
      titulo: 'Tempo registrado em foco hoje',
      descricao: 'Tempo acumulado nos períodos confirmados de cada página durante o dia de Brasília.',
      calculo: 'O servidor soma os intervalos entre sinais consecutivos de foco separados por até 75 segundos. Agrupa todos os trechos da mesma página antes de paginar; frações de segundo são acumuladas e o resultado exibido é truncado para segundos.',
      observacao: 'Pausas confirmadas e intervalos sem sinal acima de 75 segundos não são somados. Primeiro e último sinal delimitam os registros, não uma sessão contínua. Uma troca de foco não representa um novo acesso à página. É uma estimativa, sem extrapolação após o último sinal; o histórico anterior preserva a precisão com que foi registrado.',
    },
    usuariosOnline: {
      titulo: 'Online agora',
      descricao: 'Outras pessoas com conta ativa e página em foco confirmada recentemente.',
      calculo: 'Contagem de contas ativas com página em foco e último sinal entre agora e 75 segundos atrás, excluindo quem consulta. Requisições automáticas não comprovam presença.',
      observacao: 'A página envia um sinal a cada 30 segundos; a lista é consultada a cada 15 segundos. Ao perder foco, a presença é encerrada no próximo sinal recebido. Sem comunicação, expira após 75 segundos e aparece na próxima atualização. Contagem e listas usam a mesma leitura e o relógio do servidor. Recentes exibem sinais de foco das últimas 24 horas. Não mede o tempo conectado nem a atenção da pessoa. Reiniciar o servidor não apaga o histórico.',
    },
  },
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
        'Verde indica que a meta do histórico foi atingida. Abaixo dela, amarelo indica atendimento parcial e vermelho indica que nenhuma coleta cumpriu o agendamento. ' +
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
      observacao: `${periodoManifestos} Quando há movimento e orçamento aplicável, o valor fica verde até o limite e vermelho acima dele.`,
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
      titulo: 'OTIF - On-Time In-Full',
      descricao: 'Percentual das entregas finalizadas que ocorreram dentro do prazo.',
      calculo: 'Entregas no Prazo ÷ Entregas Finalizadas × 100.',
      observacao: `${periodoPerformance} ${percentualSemBase}`,
    },
    emAtraso: {
      titulo: 'Entregas em Atraso',
      descricao: 'Minutas ainda não finalizadas cuja previsão já venceu.',
      calculo:
        'Contagem de Não Finalizadas com Previsão de Entrega anterior à data atual.',
      observacao:
        `${periodoPerformance} Inclui qualquer status diferente de finalizado, inclusive cancelados que permaneçam na base filtrada.`,
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
      observacao: `${periodoPerformance} ${percentualSemBase}`,
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
      observacao: `${periodoFaturamento} ${elegibilidadeFaturamento} Com movimento e meta configurada, o valor fica verde ao atingir a meta e vermelho abaixo dela.`,
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
      titulo: 'Faturas emitidas',
      descricao: 'Valor faturado correspondente aos fretes do período selecionado.',
      calculo: 'Soma os títulos emitidos uma vez. O percentual divide o faturado pela soma do faturado e dos fretes a faturar.',
      observacao: 'Quando os filtros selecionam parte dos fretes de um título, o valor é proporcional aos fretes selecionados.',
    },
    valorAFaturar: {
      titulo: 'Fretes a faturar (R$)',
      descricao: 'Valor dos fretes elegíveis que ainda aguardam faturamento.',
      calculo: 'Soma o valor original desses fretes no período da emissão do frete.',
    },
    aguardandoFaturamento: {
      titulo: 'Fretes a faturar (quantidade)',
      descricao: 'Quantidade de fretes elegíveis que ainda aguardam faturamento.',
      calculo: 'Conta cada frete a faturar uma vez, pela emissão do frete.',
    },
    contasAReceber: {
      titulo: 'Contas a receber',
      descricao: 'Saldo das faturas vinculado aos CT-es emitidos no período selecionado.',
      calculo: 'Soma as parcelas ainda em aberto na data de corte. Cada pagamento reduz o saldo na data da liquidação bancária.',
    },
    valorEmAtraso: {
      titulo: 'Em atraso',
      descricao: 'Parte do saldo do período cujo vencimento já passou na data de corte.',
      calculo: 'O percentual divide o saldo vencido pelo saldo total a receber. Para um período encerrado, a referência é o último dia selecionado. Para um período em andamento, a referência é hoje.',
    },
    prazoCadastral: {
      titulo: 'Prazo médio cadastral',
      descricao: 'Prazo combinado na emissão da fatura.',
      calculo: 'Média dos dias entre a emissão e o vencimento das faturas com as duas datas.',
    },
    prazoAteFaturar: {
      titulo: 'Do frete à fatura',
      descricao: 'Tempo médio para faturar um frete realizado.',
      calculo: 'Média dos dias entre a data do serviço e a emissão da fatura, por frete faturado com as duas datas.',
    },
    prazoMedio: {
      titulo: 'Prazo médio real',
      descricao: 'Tempo médio entre a emissão da fatura e o recebimento.',
      calculo: 'Média dos dias da emissão da fatura até a liquidação bancária da última parcela, nas faturas integralmente recebidas até a data de corte.',
    },
    clientesAtivos: {
      titulo: 'Clientes ativos',
      descricao: 'Clientes distintos com movimento no período.',
      calculo: 'Conta os clientes presentes nos fretes ou faturas selecionados, considerando os filtros da tela.',
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
        `A indicação é reconhecida quando o status é exatamente “Conciliado”, após remover espaços nas extremidades e ignorar maiúsculas/minúsculas. “Não conciliado” e valores vazios não entram no numerador. ${percentualSemBase}`,
    },
  },

  cotacoes: {
    totalCotacoes: {
      titulo: 'Total de Cotações',
      descricao: 'Quantidade de itens cotados no período. Cargas diferentes na mesma rota contam separadamente, mesmo com o mesmo número de cotação.',
      calculo: 'Contagem dos itens da base atual que passam pelos filtros.',
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
      observacao: `${percentualSemBase} Com cotações no período, o valor fica vermelho abaixo de 35%, amarelo de 35% a menos de 60% e verde a partir de 60%.`,
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
      descricao: 'Quantidade de cargas no período e na filial selecionados.',
      calculo: 'Soma as cargas dos grupos No Armazém, Em Transferência, Manifestada, Em Entrega e Finalizadas.',
      observacao: filtrosLocalizacao,
    },
    emTransito: {
      titulo: 'Cargas em Trânsito',
      descricao: 'Quantidade de cargas em entrega, transferência ou manifestadas.',
      calculo:
        'Conta as cargas Em Entrega, Em Transferência ou Manifestada.',
      observacao: filtrosLocalizacao,
    },
    previsaoVencida: {
      titulo: 'Previsão Vencida',
      descricao: 'Cargas abertas cuja previsão de entrega já venceu.',
      calculo:
        'Conta as cargas em aberto cuja previsão de entrega é anterior a hoje.',
      observacao: `${filtrosLocalizacao} Com cargas no período, zero vencidas fica verde, de uma a dez fica amarelo e acima de dez fica vermelho.`,
    },
    valorCarteira: {
      titulo: 'Valor da Carteira',
      descricao: 'Valor de frete total das cargas em aberto.',
      calculo: 'Soma do Valor de Frete das Cargas Não Finalizadas.',
      observacao: filtrosLocalizacao,
    },
    pesoTaxado: {
      titulo: 'Peso Taxado',
      descricao: 'Peso taxado das cargas no período e na filial selecionados.',
      calculo: 'Soma o peso taxado, em quilogramas, das cargas incluídas no total.',
      observacao: filtrosLocalizacao,
    },
    percentualFinalizado: {
      titulo: 'Percentual Finalizado',
      descricao: 'Participação das cargas finalizadas entre as cargas selecionadas.',
      calculo: 'Cargas Finalizadas ÷ Total de Cargas × 100.',
      observacao: filtrosLocalizacao,
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
      calculo: 'Soma do Valor Faturado do painel Financeiro e Recebíveis.',
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
    seliaEventosConfirmados: {
      titulo: 'Eventos AddEvents confirmados',
      descricao: 'Eventos da SELIA com sucesso e data própria dentro do período selecionado.',
      calculo: 'Contagem por ocorrência ativa da SELIA com status de dados SUCESSO, ENVIADO ou PROCESSADO e data da etapa no período.',
      observacao: 'Considera somente a integração SELIA. Não usa a data do POD nem o status geral. Avaliações e tentativas não são confirmações de envio.',
    },
    seliaComprovantesConfirmados: {
      titulo: 'POD / comprovantes confirmados',
      descricao: 'Comprovantes POD da SELIA com sucesso e data própria dentro do período selecionado.',
      calculo: 'Contagem por ocorrência ativa da SELIA com status de comprovante SUCESSO, ENVIADO ou PROCESSADO e data da etapa no período.',
      observacao: 'Não copia o total de eventos AddEvents nem conta NAO_APLICAVEL como envio. Confirmações com data incerta ficam fora dos totais por período e não são pendências de envio.',
    },
    dadosConfirmados: {
      titulo: 'XML / dados confirmados',
      descricao: 'Etapas de XML, dados ou eventos com sucesso e data própria dentro do período selecionado.',
      calculo: 'Contagem exata por destino e documento/ocorrência, com status de dados SUCESSO, ENVIADO ou PROCESSADO e data da etapa no período.',
      observacao: 'Considera registros ativos. Vedacit agrupa XML por CT-e e preserva a primeira confirmação datada disponível; outros destinos usam ocorrência. Não usa a data do comprovante nem o status geral. O estado atual não reconstitui todas as tentativas ou comprova recebimento remoto de históricos divergentes.',
    },
    comprovantesConfirmados: {
      titulo: 'Comprovantes confirmados',
      descricao: 'Etapas de comprovante/POD com sucesso e data própria dentro do período selecionado.',
      calculo: 'Contagem exata com status de comprovante SUCESSO, ENVIADO ou PROCESSADO e data da etapa no período; nunca copia o total de XML.',
      observacao: 'Vedacit agrupa pelo par NF-e/CT-e efetivo dos registros ativos e usa a primeira data confiável preservada na auditoria permanente de aceites, inclusive evidência arquivada. Reenvios não somam novamente. Confirmações com data original incerta ficam fora dos totais por período e não são pendências de envio. Outros destinos usam ocorrência. Não conta NAO_APLICAVEL como envio.',
    },
    etapasPendentes: {
      titulo: 'Etapas em acompanhamento',
      descricao: 'Etapas aguardando processamento, nova tentativa, origem ou confirmação do destino.',
      calculo: 'Soma de aguardandoProcessamento, novaTentativa, aguardandoOrigem e aguardandoConfirmacao por destino/etapa no contrato operacional v3.',
      observacao: 'Saldo atual de todas as datas. Exclui confirmados, ignorados, intervenções e casos a conferir. Uma nota pode aparecer nas duas etapas; nova avaliação não cria outra pendência. Timeout exige conferência antes de reenvio.',
    },
    etapasBloqueadas: {
      titulo: 'Exigem intervenção',
      descricao: 'Etapas com recusa do destino, erro de validação ou identidade/correlação inválida.',
      calculo: 'Soma de intervencao do contrato operacional v3, após deduplicação e precedência das confirmações.',
      observacao: 'Inclui todas as datas e respeita a integração selecionada. Acesso ou documento ausente na origem e envios sem confirmação aparecem nas categorias próprias de acompanhamento.',
    },
    saldoPorEtapa: {
      titulo: 'Pendências atuais por etapa',
      descricao: 'Agrupa XML/dados e comprovantes por integração e próxima ação: processamento, nova tentativa, origem, confirmação, intervenção ou conferência.',
      calculo: 'Contagens SQL por destino e etapa, com classes exclusivas. A conferir reúne dados sem confirmação datada e status ausente/desconhecido. Comprovantes confirmados sem data original confiável não são pendências de envio; sua quantidade pode ser consultada no tooltip de Comprovantes confirmados.',
      observacao: 'Saldo atual de todas as datas; não é posição histórica ao final do período. Integrações com intervenção aparecem primeiro. Uma nota pode aparecer nas duas etapas. Sucesso tem precedência sobre cópias pendentes; logs arquivados ficam fora. Selecione a quantidade para ver documentos e horários conhecidos. A próxima avaliação é uma liberação mínima, não uma promessa de envio.',
    },
    atividadeEtapas: {
      titulo: 'Avaliações e tentativas registradas',
      descricao: 'Histórico permanente de avaliações, consultas XML à origem e envios iniciados, separado das confirmações e do saldo atual.',
      calculo: 'Contagem SQL dos eventos na data em que ocorreram. Repetições de envio são um subconjunto de envios iniciados: eventos posteriores ao primeiro registrado para o mesmo destino/documento/etapa.',
      observacao: 'Respeita a integração selecionada. Envios e consultas abrangem Vedacit; quando a seleção não inclui esse escopo, aparecem como Não medido, sem inferir zero. Avaliação sem conclusão pode ocorrer sem transmissão. Eventos antigos não mudam de dia quando o documento é reavaliado ou confirmado. A medição começa no primeiro evento registrado; períodos anteriores não são reconstruídos nem considerados zero. Início de envio não comprova recebimento.',
    },
    origemComprovantesCiclo: {
      titulo: 'Origem dos comprovantes',
      descricao: 'De onde o processo busca os comprovantes de entrega: arquivos no SFTP ou consulta à API ESL.',
      calculo: 'Origem informada pela auditoria do processo. Quando uma versão anterior da API não envia esse campo, SFTP é identificado pelo histórico exclusivo do processo que busca arquivos no SFTP.',
      observacao: 'Identifica onde este processo busca os comprovantes, mesmo quando nenhum é enviado no ciclo. Não identifica a origem histórica do XML nem o canal de envio ao cliente. Origem explicitamente desconhecida continua como Não informada. Ciclos de outros processos via API ESL ainda não estão disponíveis neste histórico.',
    },
    arquivosOrigemCiclo: {
      titulo: 'Arquivos encontrados na origem',
      descricao: 'Reconhecidos são arquivos de comprovante cuja identificação passou pelas verificações do inventário SFTP. Rejeitados são entradas recusadas por nome, tamanho, tipo ou estabilidade do upload.',
      calculo: 'Contagem de arquivos reconhecidos e rejeitados na varredura realizada naquele ciclo, antes da seleção de NF-es para envio.',
      observacao: 'Pode incluir comprovantes já enviados em ciclos anteriores e mais de um arquivo para a mesma NF-e. Reconhecido não significa enviado nem garante que o conteúdo poderá ser lido e aceito pelo cliente.',
    },
    processamentoComprovantesCiclo: {
      titulo: 'Resultado deste ciclo',
      descricao: 'NF-es avaliadas são as selecionadas para tratamento no ciclo. Enviados são comprovantes cujo tratamento terminou com sucesso. Pendentes são NF-es que continuam sem conclusão, por exemplo por arquivo indisponível ou documento ocupado por outro processo.',
      calculo: 'Comprovantes: selecionados, enviados e pendentes; erros e ignorados também participam dos selecionados. XML: confirmações, avaliações, já processados e avaliações sem conclusão (falhas ou retenções). As avaliações aguardando documento na origem aparecem quando maiores que zero. O saldo acumulado está em Pendências atuais por etapa. Uma avaliação pode ser suspensa por espera de acesso, sem envio ao destino; o mesmo CT-e pode ser reavaliado em outro ciclo.',
      observacao: 'O resultado da execução é separado dos resultados documentais. Ciclos finalizados com pendências preservam o destaque das confirmações; falhas técnicas e interrupções têm estado próprio. O status original permanece auditado. Ciclos históricos só são classificados pelas evidências do próprio ciclo; causas desconhecidas não viram sucesso. Consulta a cada minuto, com valores parciais em andamento. Ciclos sem medição não viram zero; confirmações podem incluir duplicidade reconhecida pelo destino.',
    },
    filaComprovantesCiclo: {
      titulo: 'Pendências apuradas no ciclo',
      descricao: 'Na fila são NF-es distintas ainda elegíveis na fila normal. Bloqueados são registros impedidos de reenvio por problema de origem ou recusa do destino. Sem confirmação são registros com timeout cujo envio pode ter sido recebido pelo cliente.',
      calculo: 'Saldo da fila normal referente ao inventário do ciclo; bloqueios e timeouts são contagens dos registros ativos do cliente. Durante a execução, mostram a última atualização de turno; após o término, o saldo final.',
      observacao: 'Esses números não devem ser somados: usam critérios e unidades diferentes. Não representam novos erros daquele ciclo. Bloqueios e envios sem confirmação ficam fora do reenvio automático; a fila técnica é tratada separadamente.',
    },
    agendaComprovantesCiclo: {
      titulo: 'Horários do processo',
      descricao: 'Em andamento, informa início e última atualização dos resultados parciais. Finalizado, informa término e estimativa do próximo ciclo.',
      calculo: 'Próximo ciclo estimado = término + 30 minutos, somente após finalizar. O histórico respeita a integração selecionada no topo e filtra ciclos finalizados pelo término e abertos pelo início, mantendo uma linha por execução. Ausência de ciclos auditados para o cliente não confirma parada nem sucesso do processo.',
      observacao: 'A tela consulta a cada minuto enquanto aberta e distingue a hora da consulta da atualização na origem. Sem o contrato de progresso, informa que exibe apenas o último ciclo registrado. Mais de dez minutos sem atualização parcial geram aviso, sem inventar término ou declarar parada. Uma estimativa vencida não é apresentada como próximo horário; aguarda novo início informado pelo processo.',
    },
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
      titulo: 'Ciclos de busca de comprovantes',
      descricao: 'Situação mais recente e histórico paginado do worker que lê comprovantes no SFTP Vedacit.',
      calculo: 'Arquivos reconhecidos/rejeitados na origem; NF-es avaliadas, comprovantes enviados e NF-es pendentes no ciclo; saldo, bloqueios e envios sem confirmação capturados ao final.',
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
        titulo: 'Performance',
        descricao: 'Percentual das entregas finalizadas que chegaram no prazo.',
        calculo: 'Entregas finalizadas no prazo ÷ total de entregas finalizadas × 100.',
        observacao:
          `${baseGestaoPerformance} O ranking detalha o mesmo contrato por responsável, região e cidade via drill-down.`,
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
        calculo: 'Contagem de minutas no período de previsão, em todos os status considerados na tela Performance.',
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
        descricao: 'Percentual das entregas finalizadas que chegaram no prazo.',
        calculo: 'Entregas finalizadas no prazo ÷ total de entregas finalizadas × 100.',
        observacao:
          `${baseGestaoPerformance} O gráfico de apoio permite drill-down por responsável, região e cidade, sempre recalculado no SQL para o agrupamento atual. ${percentualSemBase}`,
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
