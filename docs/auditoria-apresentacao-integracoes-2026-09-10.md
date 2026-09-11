# Auditoria da apresentação de XML e comprovantes — 10/09/2026

## Conclusão

As barras iguais são consequência do cálculo da tela: o mesmo total de registros é atribuído às duas etapas. Elas não medem transmissões independentes de XML e comprovante. Além disso, a API seleciona registros pela última atualização geral e consulta seus status atuais, permitindo apresentar um sucesso antigo de XML junto de um comprovante atualizado no período. Bloqueios SFTP são excluídos desse universo. A combinação pode mostrar alta taxa de sucesso mesmo com XML parado e documentos acumulados.

Esta entrega é uma auditoria: não altera fórmulas, código operacional, banco, configuração, builds ou processos.

## Reprodução da imagem

Às 19:21 BRT, uma consulta GET à API local do Satélite para **01–10/09/2026** retornou Vedacit com `totalRegistros=273`, `percentualXmlSucesso=100` e `percentualCanhotoSucesso=98.53`. Os outros três destinos retornaram zero. Esse intervalo reproduz os números da imagem; o filtro da captura não está visível e não foi presumido como confirmado.

As funções reais de `IntegracoesPage.tsx` foram extraídas pela AST TypeScript e executadas isoladamente com essa resposta, sem montar a aplicação ou acessar serviços externos:

| Número exibido | Como foi obtido | Limite da interpretação |
|---|---|---|
| XML/Dados: 273 | Cópia de `totalRegistros` | Não conta XML transmitido no período. |
| Canhoto: 273 | Segunda cópia de `totalRegistros` | Não representa 273 comprovantes confirmados. |
| Processado: 546 | 273 + 273 | Duas avaliações de status por registro; não comprova 546 envios. |
| Sucessos: 542 | 273 de XML + 269 de canhoto, reconstruídos dos percentuais | Mistura status das duas etapas, inclusive histórico. |
| Erros/pendências: 4 | 273 − 269 | Apenas o restante do universo selecionado; não é o estoque total pendente. |
| Taxa: 99,3% | 542 ÷ 546 | Não mede o recebimento dos documentos que faltam na Vedacit. |
| Etapas: 8 | Quatro destinos × duas etapas | Conta também etapas com volume zero. |

O controle adicional manteve 273 registros, reduziu o sucesso XML a zero e manteve o comprovante em 100%. **As duas barras continuaram em 273**, comprovando que sua igualdade independe do envio de XML. Todas as asserções da reprodução passaram.

Evidências locais em `../../satelite-tms-api/target/auditoria-apresentacao-integracoes-20260910/`: `metricas-api.json`, `reproduzir-resumo.cjs` e `reproducao-resumo.json`. Foram preservados somente agregados da resposta, sem chaves fiscais ou anexos.

## Origem de cada inconsistência

- **Frontend — `frontend/src/pages/IntegracoesPage.tsx`:** `buildResumoIntegracoesDados` atribui `totalProcessado: totalRegistros` às duas linhas; `buildResumoIntegracoesOption` desenha exatamente esse campo. Os sucessos são reconstruídos por arredondamento de percentuais, em vez de receber contagens exatas por etapa. O resumo é derivado de `metricasConsolidadas`, sem consultar o endpoint de resumo por etapa.
- **Satélite — `LogIntegracaoRepository.buscarMetricasIntegracoesClientes`:** filtra por `data_processamento`, não pelas datas individuais de XML e comprovante. O sucesso é o status atual da etapa, com fallback para o status geral. A query não exige evidência datada de transmissão daquela etapa no período. Exclui Vedacit SFTP em `BLOQUEADO_ORIGEM`/`BLOQUEADO_DESTINO`, ocultando precisamente parte do acúmulo investigado.
- **Proxy — `backend/.../service/IntegracoesService.java`:** encaminha o JSON do Satélite. A duplicação das barras ocorre no frontend; a seleção temporal e de status vem do Satélite.
- **Sazonalidade:** a query considera sucesso quando qualquer uma das etapas ou o status geral possui sucesso. Assim, XML com sucesso histórico pode esconder falha/pendência de comprovante. O gráfico usa a última atualização, não um diário de transmissões.
- **Saúde por Sistema Destino:** o frontend calcula sucesso somente pelo percentual de XML e chama o restante de erro; falhas exclusivas de comprovante não são representadas nessa conta.
- **Card Pendências:** soma os erros da sazonalidade, não o saldo pendente. Herda a exclusão de bloqueios e o sucesso por qualquer etapa.
- **Textos dos indicadores:** os dicionários descrevem processamento/envio sem esclarecer todas essas restrições; precisam acompanhar a futura mudança matemática.

Trocar apenas a chamada pelo endpoint legado `resumo-tabelas` não resolve: `IntegracaoAuditoriaQueryRepository.buscarResumoTabelas` também usa a data geral, fallback de status, exclusão de bloqueios e ainda classifica `NAO_APLICAVEL` como sucesso.

## Relação com a auditoria anterior

A leitura SQL somente leitura de 10/09 às 17:49, preservada em `../../satelite-tms-api/target/auditoria-envios-20260910/database-additional-readonly.json`, encontrou a última etapa XML bem-sucedida datada em **20/08 às 14:28**, incluindo registros arquivados. Os 273 registros recentes tinham status XML `SUCESSO`; 269 tinham canhoto `SUCESSO`, três estavam em timeout ambíguo e um com canhoto pendente. Essa classificação reproduz os agregados atuais, mas não comprova que 273 XMLs foram enviados em setembro.

A falha anterior que podia criar sucesso indevido de XML é um problema adicional já corrigido no candidato do Satélite. Não se deve atribuir os 273 registros inteiros a essa falha nem inferir recebimento remoto a partir da flag local.

## Correção necessária

Separar no contrato os envios de cada etapa, seu resultado e sua data; fornecer contagens exatas e identificar explicitamente histórico sem evidência suficiente. XML/CT-e e comprovante/NF-e precisam de deduplicação adequada à operação. Para histórico completo de tentativas, usar auditoria de eventos preservados, pois o estado atual não reconstitui todas as transmissões passadas.

Exibir o estoque pendente/bloqueado separadamente dos envios do período; não removê-lo para calcular uma aparente saúde global. Alinhar resumo, sazonalidade, saúde, cards, filtros e os dois dicionários na mesma entrega. Validar XML antigo com comprovante novo, zero XML com comprovantes enviados, falha parcial, bloqueio, status legado sem evidência, datas sem movimento e múltiplas NF-es por CT-e. Preservar logs históricos e não alterar status para fazer o gráfico coincidir.
