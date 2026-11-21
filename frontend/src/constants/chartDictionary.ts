export interface ChartDefinition {
  descricao: string;
  tabelasOrigem: string;
  cruzamentos: string;
  calculoTecnico: string;
  calculoNegocio: string;
  agrupamento: string;
}

const fretesFaturamentoBase = {
  tabelasOrigem: 'dbo.fato_fretes_faturamento',
  cruzamentos: 'Nenhum JOIN; CTE fretes -> filtrados no VisaoFretesRepository.',
} as const;

const cotacoesBase = {
  tabelasOrigem: 'vw_cotacoes_powerbi',
  cruzamentos: 'A consulta usa os itens da base atual que passam pelos filtros. Itens diferentes podem ter a mesma rota e o mesmo número de cotação.',
} as const;

const coletasBase = {
  tabelasOrigem: 'vw_coletas_powerbi',
  cruzamentos:
    'Nenhum JOIN; CTE base_filtrada -> base_deduplicada por ROW_NUMBER() PARTITION BY [ID]. Antes das agregações, o SQL remove o status "Excluída"; a linha continua disponível apenas na tabela e na exportação para auditoria.',
} as const;

const trackingBase = {
  tabelasOrigem: 'vw_localizacao_cargas_powerbi',
  cruzamentos: 'Nenhum JOIN nas queries dos gráficos; a projeção TRACKING usa OUTER APPLY para normalizar status, filial e responsável.',
} as const;

const performanceBase = {
  tabelasOrigem: 'dbo.vw_fretes_powerbi, dbo.dim_calendario',
  cruzamentos: 'A reentrega vence no segundo dia útil após a emissão do CT-e. Sem emissão, vale a previsão original. O período considera essa previsão e conta cada minuta uma vez. Complementares e substitutos ficam fora. O original substituído e as devoluções continuam elegíveis.',
} as const;

const faturasClienteBase = {
  tabelasOrigem: 'dbo.dashboard_financeiro_fretes e dbo.dashboard_parcelas_recebiveis',
  cruzamentos: 'As parcelas são vinculadas à fatura por documento, emissão e cliente. O valor de cada frete determina sua participação.',
} as const;

const contasPagarBase = {
  tabelasOrigem: 'vw_contas_a_pagar_powerbi',
  cruzamentos: 'Nenhum JOIN; leitura via DashboardExportDefinition.CONTAS_A_PAGAR.',
} as const;

const integracoesBase = {
  tabelasOrigem: 'Satélite TMS / endpoints de auditoria de integrações',
  cruzamentos: 'Sem JOIN no Dashboard; dados consolidados no backend Satélite e repassados pelo proxy /api/painel/integracoes. Quando selecionado, o filtro Integração é enviado como destino repetido e limita todas as métricas e séries aos destinos escolhidos.',
} as const;

export const chartDictionary = {
  csEvolucao: {
    ...performanceBase, descricao: 'Evolução da pontualidade do cliente.',
    calculoTecnico: '100 vezes a soma de entregas no prazo dividida pela soma das finalizadas em cada intervalo.',
    calculoNegocio: 'Os períodos sem finalizações ficam sem percentual.', agrupamento: 'Data prevista de entrega, consolidada por dia, mês ou ano conforme a duração do período.',
  },
  csStatus: {
    ...performanceBase, descricao: 'Quantidade de minutas em cada status operacional.',
    calculoTecnico: 'Contagem de minutas da conta por status normalizado.',
    calculoNegocio: 'Cada entrega é atribuída a um único status.', agrupamento: 'Status atual da entrega.',
  },
  csComprovantes: {
    descricao: 'Cobertura documental das entregas finalizadas do cliente.',
    tabelasOrigem: 'Fretes da Performance e relatório de comprovantes do ESL.',
    cruzamentos: 'A minuta identifica o frete nas duas fontes.',
    calculoTecnico: 'Minutas com anexo ou com número de arquivamento divididas pelas minutas finalizadas.',
    calculoNegocio: 'O número de arquivamento comprova que o frete foi arquivado. Cada minuta conta uma única vez em cada indicador.',
    agrupamento: 'Cliente selecionado e período da previsão de entrega.',
  },
  csOcorrencias: {
    descricao: 'Avarias, extravios e distribuição dos registros de ocorrência.',
    tabelasOrigem: 'Relatório de ocorrências do ESL e fretes.', cruzamentos: 'Vínculo dos registros de ocorrência às minutas da conta.',
    calculoTecnico: 'Os destaques contam minutas distintas com registro explícito de avaria ou extravio, parcial ou total. Uma minuta com os dois motivos conta uma vez no total combinado.',
    calculoNegocio: 'O detalhamento mostra o número de registros de cada tipo, inclusive eventos operacionais como saída e entrega.', agrupamento: 'Tipo e data da ocorrência.',
  },
  csFaturamento: {
    ...faturasClienteBase, descricao: 'Quanto já foi faturado e quanto falta faturar.',
    calculoTecnico: 'Soma dos valores dos fretes elegíveis, classificados pela vinculação à fatura.',
    calculoNegocio: 'Os dois valores seguem os critérios do Financeiro e Recebíveis.', agrupamento: 'Cliente e situação de faturamento.',
  },
  csRecebimentos: {
    ...faturasClienteBase, descricao: 'Situação dos recebimentos do cliente na data de corte.',
    calculoTecnico: 'Separação das parcelas pelo vencimento, saldo e liquidações bancárias reconhecidas até o corte.',
    calculoNegocio: 'Pagamentos parciais reduzem o valor em aberto. Parcelas sem vencimento aparecem separadamente.',
    agrupamento: 'Cliente e posição na data de corte.',
  },
  coletasSerie: {
    ...coletasBase,
    descricao: 'Acompanha o volume diário de solicitações de coleta e separa o que avançou, foi cancelado ou permaneceu em tratativa no período filtrado.',
    calculoTecnico:
      "COUNT(1); SUM(CASE WHEN status_normalizado IN (N'finalizada', N'coletada') THEN 1 ELSE 0 END); SUM(CASE WHEN status_normalizado = N'cancelada' THEN 1 ELSE 0 END); SUM(CASE WHEN status_normalizado = N'em tratativa' THEN 1 ELSE 0 END)",
    calculoNegocio:
      'Conta cada coleta deduplicada do dia e distribui esse total pelas situações operacionais, permitindo enxergar demanda, conclusão, cancelamento e pendência na mesma linha do tempo. O gráfico inclui uma linha tracejada de marcação dinâmica (markLine) que exibe a média aritmética do total de coletas do período selecionado.',
    agrupamento: 'GROUP BY data_solicitacao',
  },
  coletasStatus: {
    ...coletasBase,
    descricao: 'Mostra a distribuição atual das coletas por status para evidenciar concentração de pendências, conclusões e exceções operacionais.',
    calculoTecnico: 'COUNT(1)',
    calculoNegocio:
      'Cada coleta deduplicada vale uma unidade e é posicionada no status normalizado correspondente; status vazio entra como "Sem status" para não desaparecer do gráfico.',
    agrupamento: "GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(100), [Status]))), N''), N'Sem status')",
  },
  coletasHistoricoPerformance: {
    ...coletasBase,
    descricao: 'Evolui o percentual de coletas realizadas dentro do prazo, dando visão histórica da disciplina operacional de atendimento.',
    calculoTecnico:
      'CAST(COALESCE(CAST(no_prazo AS FLOAT) * 100.0 / NULLIF(no_prazo + fora_do_prazo, 0), 0) AS DECIMAL(19,2))',
    calculoNegocio:
      'Divide as coletas no prazo pelo total de coletas avaliáveis, ignorando divisão por zero, e apresenta o resultado como percentual de cumprimento do prazo.',
    agrupamento: 'GROUP BY data_solicitacao ou CAST(DATEADD(month, DATEDIFF(month, 0, data_solicitacao), 0) AS date)',
  },
  coletasOrigem: {
    ...coletasBase,
    cruzamentos:
      'A consulta usa a última versão de cada ID na vw_coletas_powerbi e lê a região da coleta no campo pck_prn_name da extração.',
    descricao: 'Mostra a quantidade de coletas em colunas e o peso taxado em linha. Clique em uma região para ver as cidades dela ou em Cidades para comparar todas as cidades dos filtros atuais.',
    calculoTecnico: 'COUNT(DISTINCT [Coleta]); SUM(COALESCE([Peso Taxado], 0))',
    calculoNegocio:
      'Conta coletas únicas e soma o peso taxado na região informada pelo ESL. Coletas sem região ficam no grupo “Sem região informada”.',
    agrupamento:
      "Região da coleta (pck_prn_name), cidade dentro da região selecionada ou cidade e UF no agrupamento geral.",
  },
  coletasAging: {
    ...coletasBase,
    descricao: 'Segmenta coletas em aberto por idade para priorizar tratativas antigas e reduzir risco de atraso operacional.',
    calculoTecnico: 'COUNT(DISTINCT [Coleta])',
    calculoNegocio:
      'Conta cada coleta aberta uma única vez e a coloca na faixa de dias decorridos desde a solicitação até a data de referência.',
    agrupamento:
      "GROUP BY CASE WHEN DATEDIFF(day, [Solicitacao], :dataReferencia) <= 2 THEN N'0-2 dias' WHEN <= 5 THEN N'3-5 dias' WHEN <= 10 THEN N'6-10 dias' ELSE N'11+ dias' END",
  },

  manifestosCustoEvolucao: {
    tabelasOrigem: 'dbo.vw_fato_manifestos_dash, dbo.dim_calendario',
    cruzamentos: 'Nenhum JOIN no gráfico; dbo.dim_calendario é consultada separadamente para metas/dias úteis.',
    descricao: 'Evolui o custo total dos manifestos ao longo do tempo para acompanhar pressão de frete, contratação e execução logística.',
    calculoTecnico: 'COALESCE(SUM(custo_total), 0)',
    calculoNegocio:
      'Soma todos os custos de manifestos criados em cada data e retorna zero quando não há valor, mantendo a série financeira contínua.',
    agrupamento: 'GROUP BY data_criacao_date',
  },
  manifestosStatusTemporal: {
    tabelasOrigem: 'dbo.vw_fato_manifestos_dash',
    cruzamentos: 'Nenhum JOIN; CTE manifestos no ManifestosPerformanceSqlRepository.',
    descricao: 'Mostra a evolução dos manifestos por situação operacional para identificar acúmulo de pendentes, trânsito e encerramentos.',
    calculoTecnico:
      "SUM(CASE WHEN status_norm = N'Encerrado' THEN 1 ELSE 0 END); SUM(CASE WHEN status_norm = N'Em Trânsito' THEN 1 ELSE 0 END); SUM(CASE WHEN status_norm = N'Pendente' THEN 1 ELSE 0 END)",
    calculoNegocio:
      'Conta manifestos por período e reparte o volume entre encerrados, em trânsito e pendentes, permitindo comparar execução concluída contra carteira ainda aberta.',
    agrupamento:
      'GROUP BY data_criacao_date ou DATEFROMPARTS(YEAR(data_criacao_date), MONTH(data_criacao_date), 1) ou DATEFROMPARTS(YEAR(data_criacao_date), 1, 1)',
  },
  manifestosCustosContrato: {
    tabelasOrigem: 'dbo.vw_fato_manifestos_dash',
    cruzamentos: 'Nenhum JOIN; CTE manifestos no ManifestosPerformanceSqlRepository.',
    descricao: 'Compara o custo total dos manifestos por tipo de contrato para apoiar leitura de concentração e eficiência contratual.',
    calculoTecnico: 'COALESCE(SUM(custo_total), 0)',
    calculoNegocio:
      'Soma o custo dos manifestos dentro de cada tipo de contrato, mostrando quais modalidades concentram maior desembolso operacional. Veículos de propriedade da LM Transportes são reclassificados como Frota + PX. Casos sem motorista informado recebem fallback para Terceiro ou Frota + PX dependendo da tração.',
    agrupamento: 'GROUP BY tipo_contrato',
  },
  manifestosTiposVeiculo: {
    tabelasOrigem: 'dbo.vw_fato_manifestos_dash',
    cruzamentos: 'Nenhum JOIN; CTE manifestos no ManifestosPerformanceSqlRepository.',
    descricao: 'Distribui manifestos por tipo de veículo para entender o perfil de frota usado nas operações do período.',
    calculoTecnico:
      'COUNT(DISTINCT sequence_code); COALESCE(SUM(peso_taxado) * 100.0 / NULLIF(SUM(capacidade_veiculo), 0), 0); COALESCE(SUM(itens_entrega + itens_coleta) * 1.0 / NULLIF(COUNT(DISTINCT sequence_code), 0), 0)',
    calculoNegocio:
      'Conta manifestos únicos por categoria de veículo, evitando duplicidade do mesmo manifesto e destacando a composição física da malha. O tooltip também mostra o aproveitamento médio por peso contra capacidade e a média de eventos de entrega/coleta por manifesto.',
    agrupamento: 'GROUP BY tipo_veiculo',
  },

  fretesReceitaDia: {
    ...fretesFaturamentoBase,
    descricao: 'Evolui a receita operacional dos fretes por data de referência para acompanhar geração diária de faturamento.',
    calculoTecnico: 'COALESCE(SUM(valor_total), 0)',
    calculoNegocio:
      'Soma o valor total dos fretes em cada dia do período filtrado e usa zero quando não há receita, mantendo a curva financeira legível.',
    agrupamento: 'GROUP BY data_referencia_periodo',
  },
  fretesTopClientes: {
    ...fretesFaturamentoBase,
    descricao: 'Ranqueia clientes pagadores por receita e volume elegível para destacar concentração comercial e ticket médio operacional.',
    calculoTecnico:
      'COALESCE(SUM(valor_total), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT); COALESCE(SUM(valor_total) / NULLIF(SUM(elegivel_faturamento), 0), 0)',
    calculoNegocio:
      'Para cada grupo de cliente, soma a receita, conta fretes elegíveis e divide receita por quantidade elegível para estimar o valor médio gerado.',
    agrupamento: 'GROUP BY CNPJ base do pagador (LEFT(pagador_documento, 8) após limpeza de máscara); fallback por pagador_nome quando não houver CNPJ válido',
  },
  fretesMixDocumental: {
    ...fretesFaturamentoBase,
    descricao: 'Mostra o mix documental dos fretes entre CT-e, NFS-e e pendentes para avaliar maturidade e pendências de emissão.',
    calculoTecnico: 'COUNT_BIG(1)',
    calculoNegocio:
      'Conta cada registro de frete e o classifica pelo documento disponível: CT-e quando há identificador de CT-e, NFS-e quando há número de nota de serviço, ou pendente.',
    agrupamento: "GROUP BY CASE WHEN cte_id IS NOT NULL THEN N'CT-e' WHEN nfse_numero IS NOT NULL THEN N'NFS-e' ELSE N'Pendente' END",
  },

  evolucaoFaturamento: {
    ...fretesFaturamentoBase,
    descricao: 'Acompanha a evolução de receita, subtotal e quantidade elegível para medir a cadência de faturamento operacional.',
    calculoTecnico:
      'COALESCE(SUM(valor_total), 0); COALESCE(SUM(subtotal), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT)',
    calculoNegocio:
      'Soma os valores financeiros dos fretes por período e contabiliza quantos itens entram na base elegível de faturamento.',
    agrupamento: 'GROUP BY data_referencia_periodo',
  },
  faturamentoClassificacao: {
    ...fretesFaturamentoBase,
    descricao: 'Quebra o faturamento por classificação operacional para comparar o peso financeiro de FTL, LTL, PTL e demais categorias.',
    calculoTecnico: 'COALESCE(SUM(valor_total), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT)',
    calculoNegocio:
      'Agrupa fretes pela classificação normalizada, soma a receita de cada grupo e conta o volume elegível para leitura de participação por tipo de operação.',
    agrupamento:
      "GROUP BY CASE WHEN UPPER(COALESCE(classificacao_nome, N'')) LIKE N'%FTL%' THEN N'FTL' WHEN LIKE N'%LTL%' THEN N'LTL' WHEN LIKE N'%PTL%' THEN N'PTL' ELSE COALESCE(classificacao_nome, N'Sem classificação') END",
  },
  faturamentoResponsavel: {
    ...fretesFaturamentoBase,
    descricao: 'Distribui faturamento por responsável de destino para comparar carteira financeira e volume sob cada responsável regional.',
    calculoTecnico: 'COALESCE(SUM(valor_total), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT)',
    calculoNegocio:
      'Soma a receita e conta fretes elegíveis atribuídos a cada responsável de destino, usando rótulo padrão quando o responsável não foi informado.',
    agrupamento: "GROUP BY COALESCE(responsavel_regiao_destino, N'Responsável não informado')",
  },
  faturamentoParticipacaoClientes: {
    ...fretesFaturamentoBase,
    descricao: 'Mede a participação dos clientes no faturamento para identificar concentração de receita e dependência comercial.',
    calculoTecnico:
      'COALESCE(SUM(valor_total), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT); participação no frontend = receita do cliente / receita total do período',
    calculoNegocio:
      'Soma a receita por grupo de cliente, conta fretes elegíveis e compara a receita de cada grupo contra o total filtrado para calcular sua fatia no período.',
    agrupamento: 'GROUP BY CNPJ base do pagador (LEFT(pagador_documento, 8) após limpeza de máscara); fallback por pagador_nome quando não houver CNPJ válido',
  },
  faturamentoRota: {
    ...fretesFaturamentoBase,
    descricao: 'Aponta as rotas com maior faturamento por combinação de origem e destino, ajudando a entender corredores de receita.',
    calculoTecnico: 'COALESCE(SUM(valor_total), 0); CAST(COALESCE(SUM(elegivel_faturamento), 0) AS INT)',
    calculoNegocio:
      'Soma receita e volume elegível por par de UFs de origem e destino, substituindo ausência de UF por N/A para manter a rota visível.',
    agrupamento: "GROUP BY COALESCE(origem_uf, N'N/A'), COALESCE(destino_uf, N'N/A')",
  },

  performanceSerieTemporal: {
    ...performanceBase,
    descricao: 'Evolui entregas por status ao longo do prazo previsto para acompanhar finalizações, trânsito, pendências, cancelamentos e tratativas.',
    calculoTecnico:
      "COUNT_BIG(1); SUM(CASE WHEN status_norm = N'Finalizada' THEN 1 ELSE 0 END); SUM por Em Trânsito, Pendente, Cancelada e Em Tratativa",
    calculoNegocio:
      'Conta as entregas deduplicadas de cada período e distribui o total entre os status normalizados, expondo a composição da carteira logística.',
    agrupamento:
      'GROUP BY data_previsao_entrega ou DATEFROMPARTS(YEAR(data_previsao_entrega), MONTH(data_previsao_entrega), 1) ou DATEFROMPARTS(YEAR(data_previsao_entrega), 1, 1)',
  },
  performanceStatus: {
    ...performanceBase,
    descricao: 'Mostra a fotografia das entregas por status para evidenciar o tamanho da operação encerrada, ativa e problemática.',
    calculoTecnico: 'COUNT_BIG(1)',
    calculoNegocio:
      'Conta cada entrega deduplicada dentro do status normalizado correspondente, servindo como visão rápida da carteira operacional.',
    agrupamento: 'GROUP BY status_norm',
  },
  performanceHistorico: {
    ...performanceBase,
    descricao: 'Acompanha o histórico de cumprimento de prazo das entregas finalizadas para medir evolução de performance logística.',
    calculoTecnico:
      "SUM(CASE WHEN status_norm = N'Finalizada' THEN 1 ELSE 0 END); SUM(CASE WHEN status_norm = N'Finalizada' AND performance_diferenca_dias <= 0 THEN 1 ELSE 0 END); percentual Java = noPrazo / finalizadas",
    calculoNegocio:
      'Conta entregas finalizadas, identifica quantas terminaram sem atraso e divide esse volume pelo total finalizado para obter o percentual no prazo.',
    agrupamento: 'GROUP BY CONVERT(char(7), data_previsao_entrega, 23)',
  },
  performanceDrilldown: {
    ...performanceBase,
    descricao: 'Detalha performance por responsável, região ou cidade para localizar onde estão pontualidade, atraso e risco operacional.',
    calculoTecnico:
      "SUM(CASE WHEN status_norm = N'Finalizada' AND performance_diferenca_dias <= 0 THEN 1 ELSE 0 END); SUM(fora_do_prazo); SUM(em_atraso); COUNT_BIG(1)",
    calculoNegocio:
      'Para cada dimensão do drilldown, separa entregas no prazo, fora do prazo, ainda em atraso e volume total, permitindo comparar gargalos por área.',
    agrupamento: 'GROUP BY responsavel ou GROUP BY regiao_destino ou GROUP BY cidade_destino',
  },
  performanceOcorrenciasAtraso: {
    tabelasOrigem: 'Fretes, notas fiscais e ocorrências do relatório ESL 12072.',
    descricao: 'Mostra a última ocorrência das notas fiscais vencidas que ainda aguardam entrega.',
    cruzamentos: 'Vincula o frete e as notas fiscais às ocorrências do ESL pela minuta e pela nota.',
    calculoTecnico: 'Uma nota por minuta e número de NF, agrupada pelo tipo da última ocorrência.',
    calculoNegocio: 'Cada nota pendente com previsão vencida entra uma vez. A entrega com ressalvas também encerra a pendência da nota.',
    agrupamento: 'Tipo da última ocorrência.',
  },
  performanceEntregasAtencao: {
    tabelasOrigem: 'Fretes e ocorrências do relatório ESL 12072.',
    descricao: 'Relaciona minutas com previsão vencida, vencimento hoje ou tratativa em andamento.',
    cruzamentos: 'Cruza a minuta com suas ocorrências para mostrar o último registro.',
    calculoTecnico: 'Uma linha por minuta em aberto que atende a pelo menos um critério de atenção.',
    calculoNegocio: 'A previsão indica a urgência e o status indica a situação operacional. A coluna Cliente mostra o pagador do frete.',
    agrupamento: 'Minuta.',
  },
  performanceEficienciaFiliais: {
    tabelasOrigem: 'Fretes, ocorrências do relatório ESL 12072 e calendário nacional.',
    descricao: 'Compara embarque (EFE), transbordo (EFT), destino (EFD) e pontualidade da entrega (OTIF) por filial.',
    cruzamentos: 'Combina minutas e ocorrências com a filial de registro. O período das etapas considera a data da ocorrência.',
    calculoTecnico: 'Etapas eficientes ÷ etapas avaliadas × 100. OTIF = entregas no prazo ÷ finalizadas × 100, somente na filial entregadora.',
    calculoNegocio: 'Embarque e transbordo têm limite de 24 horas e destino de 48 horas. Sábados, domingos e feriados nacionais são descontados. Pontos facultativos em dias úteis contam normalmente. Uma etapa aberta entra como ineficiente ao ultrapassar o prazo. Etapas sem informação suficiente ficam fora do percentual.',
    agrupamento: 'Filial responsável pela saída da etapa. Um traço indica ausência de base para aquela medida.',
  },
  performanceAging: {
    ...performanceBase,
    descricao: 'Mostra quantas entregas estão em aberto e há quantos dias sua previsão venceu.',
    calculoTecnico: 'COUNT_BIG(1)',
    calculoNegocio:
      'A faixa de 0 a 2 dias inclui entregas com prazo em dia, além das vencidas há até dois dias. As demais faixas mostram os dias corridos após o vencimento.',
    agrupamento:
      "GROUP BY CASE WHEN DATEDIFF(day, data_previsao_entrega, :hoje) <= 2 THEN '0-2 dias' WHEN <= 5 THEN '3-5 dias' WHEN <= 10 THEN '6-10 dias' ELSE '11+ dias' END",
  },

  trackingStatus: {
    ...trackingBase,
    descricao: 'Resume cargas rastreadas por status de exibição e valor de frete para avaliar onde está o volume financeiro em trânsito.',
    calculoTecnico: 'COUNT(1); CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2))',
    calculoNegocio:
      'Mostra a quantidade de cargas em cada um dos cinco status. No Armazém reúne No Galpão, Pendente e cargas sem status. Cada fatia corresponde à participação do grupo no total filtrado.',
    agrupamento: 'GROUP BY status_exibicao',
  },
  trackingValorRegiao: {
    ...trackingBase,
    descricao: 'Distribui valor de frete e quantidade de cargas por região de destino, destacando as regiões mais relevantes no tracking.',
    calculoTecnico: "CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)); COUNT(1)",
    calculoNegocio:
      'Soma o valor dos fretes por sigla do responsável pela região de destino. Mostra as dez siglas de maior valor e reúne as demais em Outros.',
    agrupamento: 'Agrupa pelas três primeiras letras do nome fantasia do responsável. Sem responsável, usa FEC.',
  },

  faturasMensal: {
    ...faturasClienteBase,
    descricao: 'Compara o valor original dos fretes com o valor nominal das faturas por dia, semana, mês ou ano.',
    calculoTecnico: 'Soma por período o valor original dos fretes elegíveis e o valor atribuído dos títulos emitidos.',
    calculoNegocio: 'Azul mostra os fretes faturados e a faturar. Cinza mostra os títulos emitidos, que podem incluir ajustes. A referência escolhe a data usada para agrupar.',
    agrupamento: 'Por dia, semana, mês ou ano de emissão, vencimento ou liquidação bancária. Cada período exige a data de referência escolhida.',
  },
  faturasAging: {
    ...faturasClienteBase,
    descricao: 'Distribui os títulos em aberto pelo prazo até o vencimento ou pelos dias em atraso.',
    calculoTecnico: 'Soma as parcelas em aberto no fim do período pelo vencimento de cada parcela. Conta cada fatura uma vez por faixa.',
    calculoNegocio: 'O período seleciona os CT-es pela data de emissão. Um título com vencimento no último dia do período ou depois fica em A vencer. Para períodos ainda em andamento, a referência é hoje. Títulos sem vencimento têm uma faixa própria.',
    agrupamento: 'Por faixa de vencimento, depois por cliente e fatura.',
  },
  faturasTopClientes: {
    ...faturasClienteBase,
    descricao: 'Compara o valor faturado e o valor dos fretes a faturar de cada cliente.',
    calculoTecnico: 'Soma os valores por cliente e ordena pelo valor faturado decrescente.',
    calculoNegocio: 'Exibe os 5, 10 ou 15 primeiros clientes pelo valor faturado. Cada barra reúne o faturado e o valor a faturar. Selecione o cliente para detalhar o faturado por CNPJ e fatura.',
    agrupamento: 'Por cliente no ranking. O detalhe do faturado agrupa por CNPJ e depois por fatura.',
  },
  faturasClientesEmAtraso: {
    ...faturasClienteBase,
    descricao: 'Mostra os dez clientes com mais títulos vencidos em aberto.',
    calculoTecnico: 'Conta os títulos distintos, soma o valor em atraso e calcula o maior número de dias desde o vencimento.',
    calculoNegocio: 'Cada título conta uma vez. O maior atraso corresponde ao título em aberto que venceu há mais tempo para o cliente.',
    agrupamento: 'Por cliente, em ordem decrescente de quantidade de títulos vencidos.',
  },
  faturasStatusProcesso: {
    ...faturasClienteBase,
    descricao: 'Mostra a distribuição atual ou a evolução temporal dos status Faturado e Aguardando Faturamento.',
    calculoTecnico: 'COUNT(1); na evolução, SUM(CASE WHEN status_processo = ... THEN 1 ELSE 0 END).',
    calculoNegocio:
      'Conta cada fatura dentro do status de processo normalizado, expondo em qual etapa a carteira está concentrada. A distribuição também é exibida quando há um único status, que representa 100% dos registros.',
    agrupamento: 'GROUP BY status_processo ou GROUP BY período temporal selecionado.',
  },

  contasPagarSerie: {
    ...contasPagarBase,
    descricao: 'Evolui valores pagos e valores em aberto pela data de emissão, competência ou liquidação, com leitura diária, semanal ou mensal.',
    calculoTecnico: 'SUM([Valor pago]); SUM([Valor a pagar] - [Valor pago])',
    calculoNegocio:
      'Soma o que já foi pago e calcula o saldo aberto subtraindo o pago do valor a pagar. O controle do card escolhe a data de referência e a granularidade, sem mudar os filtros globais da página.',
    agrupamento: 'GROUP BY dia, início da semana (segunda-feira) ou mês da data de referência selecionada.',
  },
  contasPagarTopFornecedores: {
    ...contasPagarBase,
    descricao: 'Identifica a concentração por fornecedor e permite detalhar a classificação e a despesa sem alterar os demais gráficos.',
    calculoTecnico: 'SUM([Valor a pagar] | saldo aberto | [Valor pago] | COUNT(1)); SELECT TOP (:limite).',
    calculoNegocio:
      'O card permite escolher a métrica e Top 5, 10 ou 15. Clique em um fornecedor para descer para classificação e depois para descrição da despesa.',
    agrupamento: 'Fornecedor → Classificação contábil → Descrição da despesa.',
  },
  contasPagarCentroCusto: {
    ...contasPagarBase,
    descricao: 'Distribui contas a pagar por centro de custo e permite detalhar sua composição contábil e de despesas.',
    calculoTecnico: 'SUM([Valor a pagar] | saldo aberto | [Valor pago] | COUNT(1)); SELECT TOP (:limite).',
    calculoNegocio:
      'O card permite escolher a métrica e Top 5, 10 ou 15. Clique em um centro para descer para classificação e depois para descrição da despesa.',
    agrupamento: 'Centro de custo → Classificação contábil → Descrição da despesa.',
  },
  contasPagarConciliacao: {
    ...contasPagarBase,
    descricao: 'Separa contas a pagar por situação de conciliação para evidenciar pendências de conferência financeira.',
    calculoTecnico: 'COUNT(1); SUM([Valor a pagar])',
    calculoNegocio:
      'Conta títulos e soma valor a pagar em cada situação de conciliação, usando "Sem conciliação" quando o campo vem vazio.',
    agrupamento: "GROUP BY COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(NVARCHAR(255), [Conciliado]))), N''), N'Sem conciliação')",
  },

  integracoesDadosPorDia: {
    ...integracoesBase,
    descricao: 'Confirmações diárias de XML, dados ou eventos, separadas dos comprovantes e das pendências.',
    calculoTecnico: 'GET indicadores-operacionais v3; etapa DADOS, agrupamento SQL pela primeira data de confirmação disponível após deduplicação dos registros ativos.',
    calculoNegocio: 'Conta somente sucessos datados no dia. Dias sem confirmação datável aparecem com zero. Reavaliações com erro não se misturam à produção confirmada.',
    agrupamento: 'XML Vedacit por CT-e; demais destinos por ocorrência, respeitando o filtro. Avaliações e tentativas possuem histórico separado.',
  },
  integracoesComprovantesPorDia: {
    ...integracoesBase,
    descricao: 'Confirmações diárias de comprovantes/POD, separadas de XML e das tentativas.',
    calculoTecnico: 'GET indicadores-operacionais v3; comprovantes Vedacit usam primeira_confirmacao_em da auditoria permanente por NF-e/CT-e efetivo. Demais destinos usam a primeira data própria disponível após deduplicação.',
    calculoNegocio: 'Cada comprovante com data confiável conta uma vez. Reenvios não somam novamente. Confirmações com data incerta ficam fora da série e constam no tooltip do indicador. Zero representa ausência de confirmações datáveis, não ausência de atividade.',
    agrupamento: 'Dia do comprovante, respeitando destinos selecionados. Vedacit por NF-e/CT-e efetivo; demais destinos por ocorrência.',
  },
  integracoesResultadosEtapas: {
    ...integracoesBase,
    descricao: 'Compara confirmações de cada etapa no período selecionado.',
    calculoTecnico: 'Contagens exatas sucessosPeriodo do GET indicadores-operacionais v3. Sem reconstrução por percentual ou soma com tentativas e pendências.',
    calculoNegocio: 'Cada barra usa exclusivamente os resultados datados de sua etapa. Sucesso datado tem precedência sobre cópias pendentes, preservando a primeira data disponível. Bloqueados e casos sem confirmação aparecem no saldo atual separado.',
    agrupamento: 'Destino e etapa; mesmos grupos usados nos gráficos diários. Status NAO_APLICAVEL/IGNORADO não conta como envio. Histórico sobrescrito ou arquivado não é reconstituído.',
  },
  integracoesSazonalidade: {
    ...integracoesBase,
    descricao: 'Acompanha a evolução diária de sucessos e erros das integrações de XML e comprovantes com os destinos atendidos.',
    calculoTecnico: 'Leitura do endpoint /api/auditoria/integracoes-clientes/evolucao-diaria no Satélite.',
    calculoNegocio:
      'Para cada dia do período filtrado, exibe a quantidade de integrações bem-sucedidas e a quantidade de falhas retornadas pela auditoria operacional.',
    agrupamento: 'Agrupado por data de processamento no Satélite.',
  },
  integracoesSaudeDestino: {
    ...integracoesBase,
    descricao: 'Compara o volume de registros integrados e com erro por sistema destino para localizar concentração operacional.',
    calculoTecnico: 'Leitura das métricas consolidadas do endpoint /api/auditoria/integracoes-clientes no Satélite.',
    calculoNegocio:
      'Calcula sucessos por destino a partir do total de registros e do percentual de sucesso de XML; o restante é apresentado como erro.',
    agrupamento: 'Agrupado por sistema destino.',
  },
  integracoesResumoEntidade: {
    ...integracoesBase,
    descricao: 'Consolida o volume processado por etapa operacional de integração e destaca, em KPIs laterais, sucesso, erro, taxa e gargalos.',
    calculoTecnico:
      'Leitura das métricas consolidadas do endpoint /api/auditoria/integracoes-clientes no Satélite; totalSucesso = ROUND(totalRegistros * percentualEtapa / 100) para as etapas retornadas por destino; totalErro = totalRegistros - totalSucesso.',
    calculoNegocio:
      'Cada sistema destino vira duas etapas operacionais. Para PPG/Vedacit são XML/Dados e Canhoto; para SELIA são AddEvents e POD/Comprovante. O gráfico horizontal mostra o volume total processado por etapa, enquanto os KPIs laterais resumem sucessos, erros/pendências, taxa de sucesso, maior volume e etapa crítica.',
    agrupamento: 'Agrupado por sistema destino no Satélite e separado no frontend conforme os rótulos de etapa retornados pelo contrato.',
  },
  integracoesCiclosSftp: {
    ...integracoesBase,
    descricao: 'Linha do tempo operacional dos ciclos SFTP Vedacit por cliente.',
    calculoTecnico: 'Leitura paginada de /api/auditoria/vedacit-sftp/execucoes no Satélite, via proxy autenticado do Dashboard.',
    calculoNegocio:
      'Exibe o resultado do ciclo, conexão, inventário e processamento para identificar execução saudável, falha isolada e saldo pendente sem acionar integrações externas.',
    agrupamento: 'Ordenado por início do ciclo e ID, em ordem decrescente. Período usa término para finalizados e início para abertos; filtro de resultado separa pendências documentais de falhas técnicas.',
  },

  cotacoesSerie: {
    ...cotacoesBase,
    descricao: 'Evolui cotações por data com conversões, perdas e valor de frete para medir geração e qualidade da demanda comercial.',
    calculoTecnico:
      "COUNT(1); SUM(CASE WHEN status_normalizado IN (N'convertida', N'convertido') THEN 1 ELSE 0 END); SUM(CASE WHEN status_normalizado IN (N'reprovada', N'reprovado', N'perdida', N'perdido') THEN 1 ELSE 0 END); SUM(valor_frete)",
    calculoNegocio:
      'Conta os itens cotados no dia, separa os convertidos e reprovados e soma o valor do frete de cada item.',
    agrupamento: 'GROUP BY data_cotacao',
  },
  cotacoesFunil: {
    ...cotacoesBase,
    descricao: 'Mostra o funil de cotações por status e valor de frete para avaliar avanço comercial e exposição de receita potencial.',
    calculoTecnico: 'COUNT(1); CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2))',
    calculoNegocio:
      'Conta quantas cotações estão em cada status e soma o valor de frete, conectando estágio comercial ao tamanho financeiro do funil.',
    agrupamento: 'GROUP BY status_exibicao',
  },
  cotacoesTaxasConversao: {
    ...cotacoesBase,
    descricao: 'Calcula taxa de conversão por valor e por quantidade para comparar eficiência comercial no tempo e por tipo de operação.',
    calculoTecnico:
      "valor: SUM(CASE WHEN convertida THEN valor_frete ELSE 0 END) / NULLIF(SUM(valor_frete), 0); quantidade: SUM(CASE WHEN convertida THEN 1 ELSE 0 END) / NULLIF(COUNT(1), 0)",
    calculoNegocio:
      'Divide o valor convertido pelo valor total cotado e também divide a quantidade convertida pela quantidade total, evitando divisão por zero.',
    agrupamento: 'GROUP BY data_cotacao para evolução; GROUP BY tipo_operacao_normalizado para blocos LTL/FTL/PTL',
  },
  cotacoesTrechos: {
    ...cotacoesBase,
    descricao: 'Ranqueia trechos e UFs por valor cotado, valor convertido e volume para localizar rotas com maior oportunidade comercial.',
    calculoTecnico:
      'CAST(COALESCE(SUM(valor_frete), 0) AS DECIMAL(19,2)); SUM(CASE WHEN convertida THEN valor_frete ELSE 0 END); COUNT(1); SUM(convertidas); SUM(reprovadas)',
    calculoNegocio:
      'Para cada trecho ou UF, soma o valor cotado, soma o valor convertido, conta cotações e separa resultados convertidos e reprovados.',
    agrupamento: 'GROUP BY trecho ou GROUP BY uf_origem ou GROUP BY uf_destino',
  },
  cotacoesMotivosPerda: {
    ...cotacoesBase,
    descricao: 'Expõe motivos de perda por dimensão comercial para entender por que oportunidades não avançaram.',
    calculoTecnico: 'COUNT(1)',
    calculoNegocio:
      'Conta cotações perdidas ou reprovadas e as agrupa por motivo, cliente pagador ou trecho conforme o nível de detalhamento selecionado.',
    agrupamento: 'GROUP BY motivo_perda ou GROUP BY cliente_pagador ou GROUP BY trecho',
  },

  gestaoPerformanceRanking: {
    tabelasOrigem: 'dbo.vw_fretes_powerbi, dbo.dim_calendario',
    cruzamentos: 'A mesma seleção de minutas da tela Performance aplica o calendário de dias úteis às reentregas.',
    descricao: 'Ranqueia a performance de entrega no prazo por responsável, região ou cidade conforme o nível de drill-down selecionado na gestão à vista.',
    calculoTecnico:
      '100 × SUM(is_no_prazo) / SUM(is_finalizada), com duas casas decimais. Mostra até 50 grupos por consulta.',
    calculoNegocio:
      'Conta entregas válidas no agrupamento atual, soma quantas ficaram no prazo e fora do prazo, e calcula a taxa de pontualidade sobre as entregas finalizadas.',
    agrupamento: 'GROUP BY responsavel_regiao_destino; no drill, GROUP BY regiao_destino filtrando responsavel; no nível final, GROUP BY destino_cidade filtrando responsavel e regiao',
  },
  gestaoColetoresRanking: {
    tabelasOrigem: 'dbo.fato_gestao_vista_coletores',
    cruzamentos: 'Nenhum JOIN; CTE coletores_base -> coletores_agregados.',
    descricao: 'Compara filiais pela taxa de manifestos bipados para medir aderência do processo de coleta e conferência.',
    calculoTecnico:
      'ROUND((SUM(manifestos_bipados) * 100.0) / NULLIF(SUM(total_manifestos), 0), 1)',
    calculoNegocio:
      'Divide manifestos bipados pelo total de manifestos da filial e arredonda o percentual, evitando divisão por zero.',
    agrupamento: 'GROUP BY data_referencia, filial, classificacao',
  },
  gestaoCubagemRanking: {
    tabelasOrigem: 'dbo.fato_gestao_vista_fretes, dbo.cliente_excecao_cubagem',
    cruzamentos: 'Filtro anti-semi join por NOT EXISTS entre pagador_documento_key e dbo.cliente_excecao_cubagem.cliente_cnpj, considerando somente exceções ativas.',
    descricao: 'Ranqueia filiais pela proporção de fretes cubados para medir aderência à captura de cubagem.',
    calculoTecnico: 'COUNT_BIG(1); SUM(CAST(is_cubado AS BIGINT)); percentual Java = fretes_cubados / total_fretes; exclui is_pagador_excluido_cubagem = 1 e CNPJs ativos em dbo.cliente_excecao_cubagem',
    calculoNegocio:
      'Conta fretes por filial depois de retirar pagadores dispensados de cubagem, soma os que possuem cubagem e divide esse volume pelo total de fretes avaliados.',
    agrupamento: 'GROUP BY data_frete_date, filial',
  },
  gestaoIndenizacaoRanking: {
    tabelasOrigem: 'dbo.vw_sinistros_powerbi, dbo.fato_fretes_faturamento',
    cruzamentos:
      'LEFT JOIN faturamento_mensal fm ON fm.mes_ref = sm.mes_ref AND fm.filial = sm.filial; LEFT JOIN faturamento_periodo fp ON fp.filial = sm.filial',
    descricao: 'Relaciona indenizações de sinistros com faturamento para medir impacto financeiro relativo por filial e período.',
    calculoTecnico: 'SUM(ABS(valor_a_pagar_cliente)) / NULLIF(faturamento_base, 0)',
    calculoNegocio:
      'Soma o valor absoluto das indenizações a pagar ao cliente e divide pelo faturamento base, mostrando o peso percentual do sinistro sobre a receita.',
    agrupamento: 'GROUP BY DATEFROMPARTS(YEAR(data_abertura), MONTH(data_abertura), 1), filial',
  },
  gestaoHorariosRanking: {
    tabelasOrigem: 'dbo.raster_viagens, dbo.raster_viagem_paradas',
    cruzamentos:
      'INNER JOIN viagens_base vb ON vb.cod_solicitacao = p.cod_solicitacao; LEFT JOIN paradas p ON p.cod_solicitacao = v.cod_solicitacao; LEFT JOIN hc_apoio apoio ON apoio.origem_sm = rc.origem_sm AND apoio.destino_sm = rc.destino_sm; LEFT JOIN filiais_raster filial ON filial.origem_sm = rc.origem_sm',
    descricao: 'Ranqueia filiais pela saída no horário para acompanhar disciplina de início de viagens e impacto no cumprimento operacional.',
    calculoTecnico:
      'COUNT_BIG(1); SUM(CASE WHEN saiu_no_horario = 1 THEN 1 ELSE 0 END); SUM(CASE WHEN saiu_no_horario = 0 THEN 1 ELSE 0 END)',
    calculoNegocio:
      'Conta viagens avaliadas, separa as que saíram no horário das que atrasaram e permite comparar aderência por filial.',
    agrupamento: 'GROUP BY data_corte, filial',
  },

  executivoTendenciaFinanceira: {
    tabelasOrigem:
      'dbo.fato_fretes_faturamento, dbo.fato_gestao_vista_faturas, vw_contas_a_pagar_powerbi, vw_coletas_powerbi',
    cruzamentos: 'Nenhum JOIN único; ExecutivoService agrega em memória séries já consolidadas por serviço e por YearMonth.',
    descricao: 'Consolida tendência executiva de receita, faturamento, contas a pagar e backlog de coletas para leitura mensal integrada.',
    calculoTecnico:
      'receitaOperacional += SUM(receita_bruta); valorFaturado += SUM(valor_operacional); saldoAPagar += SUM(aberto); backlogColetas += total - finalizadas - canceladas',
    calculoNegocio:
      'Une séries mensais já consolidadas das áreas financeira e operacional, somando receitas, faturas, saldo aberto e coletas ainda não resolvidas.',
    agrupamento: 'YearMonth.parse(ponto.date/month); fontes SQL agrupam por dia ou CONVERT(CHAR(7), mês, 23)',
  },
  executivoFaturamentoBacklog: {
    tabelasOrigem: 'dbo.fato_gestao_vista_faturas, vw_coletas_powerbi',
    cruzamentos: 'Nenhum JOIN único; ExecutivoService cruza as séries por YearMonth em Map<YearMonth, ExecutivoTrendAccumulator>.',
    descricao: 'Compara faturamento mensal com backlog de coletas para expor relação entre geração financeira e pendência operacional.',
    calculoTecnico: 'valorFaturado += SUM(valor_operacional); backlogColetas += total - finalizadas - canceladas',
    calculoNegocio:
      'Soma o valor faturado no mês e calcula backlog removendo coletas finalizadas e canceladas do total de coletas do mesmo período.',
    agrupamento: 'YearMonth.parse(ponto.date/month)',
  },

  etlTaxasDiarias: {
    tabelasOrigem: 'dbo.log_extracoes',
    cruzamentos: 'Nenhum JOIN; leitura direta da auditoria operacional de extrações.',
    descricao: 'Acompanha a volumetria diária de execuções concluídas com sucesso e falhas para evidenciar picos de erro no período filtrado.',
    calculoTecnico:
      "SUM(CASE WHEN status_final normalizado IN (N'COMPLETO', N'SUCCESS', N'SUCESSO') THEN 1 ELSE 0 END); SUM(CASE WHEN status_final normalizado NOT IN (...) THEN 1 ELSE 0 END); filtro sargable por timestamp_inicio.",
    calculoNegocio:
      'Agrupa as execuções pelo dia de início e separa quantas terminaram como sucesso das demais, permitindo localizar dias específicos com aumento de falhas.',
    agrupamento: 'GROUP BY CAST(timestamp_inicio AS DATE)',
  },
  etlInsercoesAtualizacoes: {
    tabelasOrigem: 'dbo.log_extracoes',
    cruzamentos: 'Nenhum JOIN; leitura direta da auditoria operacional de extrações.',
    descricao: 'Mostra a evolução diária das operações de inserção/persistência e das atualizações idempotentes registradas pelo ETL.',
    calculoTecnico: 'SUM(COALESCE(registros_extraidos, 0)); SUM(COALESCE(noop_count, 0)); filtro sargable por timestamp_inicio.',
    calculoNegocio:
      'Agrupa as extrações pelo dia de início, soma os registros gravados no log como inserções/persistências e soma os no-op idempotentes como atualizações já reconhecidas pelo destino.',
    agrupamento: 'GROUP BY CAST(timestamp_inicio AS DATE)',
  },
  etlTabelasResumo: {
    tabelasOrigem: 'dbo.log_extracoes',
    cruzamentos: 'Nenhum JOIN; leitura direta da auditoria operacional de extrações por entidade/tabela alvo.',
    descricao: 'Consolida execuções, volume gravado e janela temporal de processamento por tabela alvo para confrontar gaps de carga entre entidades do ETL.',
    calculoTecnico:
      "COUNT_BIG(1); SUM(CASE WHEN status_final normalizado IN (N'COMPLETO', N'SUCCESS', N'SUCESSO') THEN 1 ELSE 0 END); SUM(CASE WHEN status_final normalizado NOT IN (...) THEN 1 ELSE 0 END); SUM(COALESCE(registros_extraidos, 0) + COALESCE(noop_count, 0)); MIN(timestamp_inicio); MAX(timestamp_fim); filtro sargable por timestamp_inicio.",
    calculoNegocio:
      'Agrupa as execuções pela entidade registrada no log, conta quantas vezes cada tabela rodou, separa sucessos e falhas, soma o volume gravado/auditado, mostra a primeira e última execução dentro do período filtrado e ordena as barras do menor para o maior volume.',
    agrupamento: 'GROUP BY entidade normalizada; ORDER BY total_registros_gravados ASC, target_entity',
  },
} as const satisfies Record<string, ChartDefinition>;

export type ChartDictionaryKey = keyof typeof chartDictionary;
