# Cotações no dashboard: contagem por trecho

Cada item calculado no ESL entra separadamente nos indicadores, inclusive duas cargas na mesma rota e com o mesmo número. Antes da mudança, um teste com duas linhas para o mesmo número comprovou que o resumo da filial mantinha só uma. O código removia as demais por número na série, nos resumos, nos gráficos e na tabela legada, enquanto o total geral e a tabela paginada liam todas as linhas.

Essas consultas agora usam a mesma base filtrada, sem escolher uma linha por número. A ordenação usa o trecho e o conteúdo da linha para desempatar páginas e exportações. O hash só ordena: não identifica cotação, não agrupa e não exclui linhas. Não foram alterados a fórmula de conversão, a matriz de tarifas do V1 ou o escopo de filiais. O número continua sendo mostrado como no relatório.

No ensaio com JDBC e dados reais de 02 a 10/11, a view candidata do ETL V2 apresentou as 54 colunas esperadas e 1.523 linhas recebidas. A API do exemplo retornou dois trechos; série, resumo por filial e funil reconciliaram com o total do recorte, a tabela paginada mostrou uma linha por página no teste de duas páginas e o CSV preservou as duas. O escopo de uma filial sem acesso não retornou linhas. Os testes de regressão Java e as verificações de TypeScript, lint e encoding passaram.

A ligação da view foi substituída só no teste; o servidor do dashboard e o synonym de produção não foram alterados. A base V1 continua sendo lida pelas telas atuais. A projeção e seu validador estão no repositório ETL, em `database/production/publication/002_dashboard_cotacoes.sql` e `scripts/validation/Test-DashboardCotacoesProjection.ps1`.

O histórico real desse recorte tinha 25 lotes completos (4.295 linhas arquivadas), com recaptura em oito dias. Só os nove lotes vigentes foram lidos: 1.523 linhas, conferidas por contagem independente. Nenhuma captura foi disparada pelo teste.

**Validação 0772:** os dados lidos da V2 para as duas cargas na mesma rota conferem com as imagens do ESL. Um teste isolado com os mesmos fretes e volumes cobre o resumo da API, a paginação e o CSV. No SQL Server, a simulação de recaptura atualizou o valor de um item e manteve a contagem em dois. A conexão do ensaio da API ao SQL Server retornou erro de autenticação 18456 nesta rodada.

**Validação no ESL em 11/11/2026:** as fichas mostram dois itens na 147372, dois na 147758 e três na 148085. Nos três casos, há pares com rota, CEPs, volume, valor da nota e peso iguais. A lista de trechos calculados do ESL confirma que são itens separados, e a publicação devolveu a quantidade de cada ficha.

A view de Cotações está instalada no V2. A API, a paginação e o CSV passaram em ensaio com o cliente JDBC e a conta do portal. O teste usou a publicação diretamente e também leu o synonym atual do V1. A troca dos synonyms e o retorno ainda dependem das publicações listadas no [mapa 0769](../pre-validacao-etl-v2-0769.md).
