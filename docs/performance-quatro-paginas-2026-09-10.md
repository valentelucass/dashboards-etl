# Auditoria de Faturamento, Manifestos, Performance e Executivo

## Escopo e evidência

São 19 gráficos Canvas reais: cinco de Faturamento, sete de Manifestos, cinco de Performance e dois de Executivo. O benchmark anterior de Performance não media essas outras páginas. Esta rodada usa os mesmos builds, navegador, filtros e dados sintéticos para comparar cada página antes/depois. Não houve conexão com banco, API operacional, mudança de schema, publicação ou gerenciamento das portas 5010/5173.

O build anterior é `frontend/.tmp/quality-build/20260910-013856-33cd19/dist`: já contém as duas otimizações anteriores. Portanto os ganhos desta rodada são incrementais. O código Java anterior continua preservado nesse diretório de qualidade do backend.

## Alterações implementadas

- **Faturamento:** removida a condição de sucesso do overview que bloqueava todas as outras consultas, junto dos timers de 120/240/380/620/760/950 ms. Consultas independentes entram imediatamente na fila, com prioridade para resumo/gráficos e limite compartilhado de três GETs. Antes, a participação de clientes podia inclusive desenhar temporariamente apenas “Outros” enquanto o ranking estava desabilitado; com a consulta ativa desde a abertura, o loading reflete a espera real.
- **Quatro páginas:** `dashboardRequestQueue.ts` substitui a fila exclusiva de Performance. O limite é por instância Axios e compartilhado entre páginas, não três por página. Requisições aguardando vaga são removidas quando canceladas. Autenticação, exportações, templates e escritas não aguardam essa fila.
- **Faturamento, Manifestos e Executivo:** hooks e camadas de endpoints agora consomem o AbortSignal do TanStack Query. Trocar filtros/desmontar a página cancela o transporte obsoleto; três queries canceladas em espera foram verificadas sem chegar ao adapter. Isso reduz trabalho descartável na navegação. Não significa que uma consulta SQL já iniciada será interrompida. A propagação segue o [contrato oficial de cancelamento do TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation).
- **Executivo/backend:** `FretesService.buscarReceitaBruta` usa a mesma consulta agregada, filtros, escopo e arredondamento de `buscarOverview`, mas não calcula metas, realizado por filial, calendário ou tendência. `ExecutivoService` precisa somente da receita desse domínio. Os testes com receita positiva, zero, ausência de fretes e valor negativo preservam exatamente o valor do fluxo anterior e verificam uma única chamada ao repositório de Fretes. Isso não representa uma única consulta para toda a página Executivo.
- **Executivo/navegador:** a página substitui o período recebido pelo padrão de 180 dias na montagem. O comportamento foi preservado. Antes, três GETs do período inicial e três do padrão chegavam ao transporte; após propagar o cancelamento, apenas os três GETs do período efetivo chegaram nas amostras. Preflights iniciais ainda podem ocorrer. O override incondicional de datas explícitas na URL continua sendo uma lacuna funcional a revisar separadamente.
- **Manifestos/backend:** o custo fechado reaproveita o custo já calculado para a resposta quando o intervalo fechado coincide com o filtro. Elimina uma consulta de soma repetida nesse cenário. Períodos que incluem o dia ainda aberto continuam consultando o recorte fechado; intervalo inteiramente posterior ao último dia útil retorna zero para esse recorte. Quatro casos de fronteira cobrem esses comportamentos e a preservação dos filtros.

Não foram alterados fórmulas, unidades, fontes, arredondamentos, contratos JSON, periodicidade de atualização, temas ou alturas. Os dicionários de KPI/gráfico continuam descrevendo as mesmas regras; não foi criada uma fórmula alternativa para acelerar as consultas.

## Gargalos ainda presentes e propostas concretas

| Página | Evidência no código | Próxima solução a validar | Critério de aceitação |
| --- | --- | --- | --- |
| Faturamento | `FretesService.buscarGraficos` executa sete consultas de grupos, inclusive dimensões usadas só após drill-down. Overview e `/metas` ainda calculam resumos de metas separadamente. | Separar séries/dimensões solicitadas pelos controles ou consolidar agrupamentos SQL; evitar computar o mesmo resumo de metas duas vezes com contrato explícito. | Mesmos totais/filiais/status, ranking/“Outros” e drill-down; menos leituras lógicas e menor p95 com pool limitado. Não introduzir cache global sem escopo ACL. |
| Manifestos | `ManifestosPerformanceSqlRepository.buscarPerformance` faz cinco consultas sequenciais (overview, gauges, sazonalidade, contratos, tipos), seguidas de calendário/custos/metas no serviço. Os sete gráficos aguardam essa resposta. A chave do hook inclui nível/ano/mês, embora só a sazonalidade use esse recorte adicional. | Separar sazonalidade num endpoint e cache próprios; estudar divisão do resumo e evolução de custos para carregamento independente sem duplicar agregações. | Alterar dia/mês/ano deve consultar somente a sazonalidade; filtros globais continuam atualizando todos os blocos. Comparar dados, falhas parciais e consultas totais. |
| Performance | Cada endpoint recompõe a CTE de `dbo.vw_fretes_powerbi`, conversões e `ROW_NUMBER` por minuta; tabela acrescenta contagem e página. Período e pagador já são filtrados na fonte. | Medir planos por endpoint e publicar colunas analíticas tipadas/normalizadas pelo repositório ETL; avaliar reaproveitamento de agregações compatíveis. | Preservar deduplicação dentro da janela e precedência por finalização/extração/ID. Não trocar por deduplicação global sem demonstrar paridade para datas e pagadores diferentes. |
| Executivo | Mesmo após remover o overview completo de Fretes, o resumo chama outros cinco domínios em sequência; a série combina quatro consultas e reagrupa resultados mensais em Java. O financeiro normaliza filial na expressão SQL. | Criar consultas executivas próprias com agregações mensais e junções no SQL, reaproveitando exatamente elegibilidade, calendários e escopo dos contratos existentes. | Paridade monetária no centavo, mês sem dados, backlog e filiais; menor número de consultas/linhas transportadas. Evitar fan-out de threads, que ampliaria pressão no pool sem reduzir trabalho. |
| Renderização comum | `echarts-for-react` inicializa uma instância temporária, espera `finished`, descarta e inicializa outra. Manifestos monta sete gráficos juntos. | Experimentar lifecycle com uma inicialização/ResizeObserver ou renderização fora da viewport sob demanda, em alteração isolada. | Ganho medido de CPU/long tasks e testes de desmontagem, StrictMode, resize, tema, eventos, zoom e apresentação. Não trocar o wrapper somente por hipótese. |

Essas propostas não foram publicadas nem declaradas como ganhos. Não é possível escolher índices ou atribuir a latência da produção a um operador SQL sem plano/custo medidos. O [plano de execução real do SQL Server](https://learn.microsoft.com/en-us/sql/relational-databases/performance/display-an-actual-execution-plan?view=sql-server-ver17) fornece informações da execução; o [Query Store](https://learn.microsoft.com/en-us/sql/relational-databases/performance/monitoring-performance-by-using-the-query-store?view=sql-server-ver17) permite comparar planos, duração e esperas quando já estiver disponível.

### Validação necessária em SQL Server isolado

Reproduzir períodos de 1/30/365 dias, filial restrita/ampla, ausência de dados e filtros de maior cardinalidade, com dados sintéticos ou anonimizados. Medir p50/p95 HTTP, tempo e quantidade de consultas, leituras lógicas, CPU, spills, cardinalidade estimada/real e espera por conexão. Comparar o mesmo conjunto de dados antes/depois com carga limitada. Não limpar cache global do SQL Server nem aplicar índices no ETL pelo Dashboard. Estruturas analíticas pertencem ao repositório ETL; mudanças no banco próprio exigem Flyway e baseline correspondente.

## Como reproduzir o navegador

Em `frontend`, usar `node scripts/benchmark-charts.mjs <build-antes> <build-depois> <diretorio-saida> <rota> 3`. Rotas: `faturamento`, `manifestos`, `performance`, `executivo`; `coletas` continua disponível como controle.

O script usa somente servidor de arquivos em loopback/porta dinâmica e Edge próprio, com DNS externo bloqueado e todas as APIs interceptadas. As fixtures ficam em `scripts/benchmark-page-fixtures.mjs`. Cada resposta/preflight simulado espera 200 ms; isso não reproduz o custo SQL. Os cenários são desktop e CPU 4x/rede 2 Mbps; versões alternam a ordem, sem compilação concorrente durante a medição.

`results.json` contém tempos por título de gráfico, primeiro/último desenho, long tasks, bytes JS, parâmetros e horários de todas as APIs. `firstDraw` geral é o primeiro traço de qualquer Canvas, inclusive estados transitórios; os tempos individuais se referem à última montagem daquele gráfico. `lastDraw` inclui animação e não é LCP nem “usuário já pode interagir”. Poucas repetições em uma máquina não estabelecem SLA ou ganho de produção.

Com o argumento final `smoke`, o script verifica larguras de 1024/390 px e tema escuro. Em Faturamento, Performance e Executivo, o overview responde 503 para verificar a independência dos gráficos. Em Manifestos o smoke usa a resposta completa, pois a API ainda agrega todos os blocos.

## Resultado e limites da entrega

Faturamento apresentou redução do último desenho de todos os gráficos nos dois cenários: 17,3% no desktop e 12,7% em CPU 4x/2 Mbps. Executivo reduziu seis para três GETs de dados na abertura e melhorou 30,2% no desktop, mas ficou 2,7% mais lento no cenário limitado. Performance ficou próxima da referência (2,9%/0,8% menor). Manifestos melhorou 8,3% no desktop, mas ficou 4,4% mais lento no cenário limitado, mesmo incluindo a rodada adicional de confirmação. Portanto não há evidência de aceleração universal dessas páginas; a variação/regressão de Manifestos e Executivo sob limitação permanece explicitamente aberta. Os benefícios backend de consultas evitadas não aparecem no benchmark com respostas artificiais de duração fixa.

O primeiro traço geral de Faturamento não é comparável a “gráfico pronto”: na referência, a participação de clientes teve duas montagens (estado transitório “Outros” e ranking carregado); depois, uma. O relatório detalha a última montagem e o término do desenho de cada gráfico. O endpoint do Executivo mantém o padrão de 180 dias, de modo que seu período efetivo difere do intervalo fixo solicitado pelo harness, igualmente em ambas as versões.

Foram consolidados 60 carregamentos de medição e quatro smokes. Manifestos tem seis amostras por versão/cenário, incluindo todas as amostras das duas rodadas para não selecionar só as favoráveis. Faturamento e Performance usam a rodada de confirmação com fixtures corrigidas (tendência em razão decimal e dimensões `value`/`label`); as rodadas exploratórias anteriores permanecem arquivadas, fora do resumo. A confirmação de Faturamento substitui a estimativa intermediária de 7,6% no cenário limitado. Não foram reexecutados testes de runtime de produção.

Validação completa `20260910-094146-d84f1c`: **687 testes backend + 252 frontend = 939**, sem falhas/ignorados; TypeScript, lint com zero avisos, encoding, ambiente frontend e builds aprovados. JaCoCo: 52,38% de linhas/42,06% de ramificações, 159 das 473 classes sem instrução executada. Frontend: 21,81% de linhas, 69,96% de ramificações, 51,23% de funções. Isso não representa cobertura integral do projeto. O aviso de tamanho do chunk ECharts permanece no Vite; não foi ocultado.

Os quatro smokes passaram em 1024/390 px, sem transbordamento horizontal da página e com todos os gráficos presentes após a troca para tema escuro. Os gauges de Manifestos mantêm o Canvas de 300 px dentro dos cards de altura maior, como antes; os demais Canvas mantêm seus mínimos existentes. Os três smokes de resumo indisponível registraram HTTP 503 real no transporte simulado e os gráficos independentes renderizaram. Capturas desktop e mobile estão nos diretórios de evidência.

Candidatos preparados, sem publicação:

- Backend: `backend/target/quality/20260910-094146-d84f1c/dashboard-api-1.0.0.jar`.
- Frontend: `frontend/.tmp/quality-build/20260910-094146-d84f1c/dist`.
- Qualidade: `.tmp/quality/20260910-094146-d84f1c/summary.json`, com `operationalFilesPreserved: true`.
- Medições finais: `frontend/.tmp/audit3-confirmacao-faturamento`, `audit3-confirmacao-performance`, `audit3-manifestos`, `audit3-confirmacao-manifestos` e `audit3-executivo`.
- Smokes: `frontend/.tmp/audit3-smoke-{faturamento,manifestos,performance,executivo}`.
- Resumo reproduzível: `frontend/.tmp/audit3-resumo.json` e `.md`, gerados por `scripts/summarize-chart-benchmark.mjs` (saída sem extensão, seguida dos diretórios de medição). Os JSON brutos e screenshots foram preservados.

As pendências anteriores de versões vulneráveis continuam registradas em `docs/auditoria-aprofundada-2026-09-10.md`. Esta rodada não atualizou dependências nem encerrou essa dívida.

## Medição no navegador

Medianas em ms; variação negativa significa menor tempo. APIs sintéticas de 200 ms, sem custo SQL real.

| Página | Cenário | Amostras por versão | Último desenho antes | Depois | Variação |
| --- | --- | ---: | ---: | ---: | ---: |
| faturamento | desktop | 3/3 | 3426,3 | 2832,6 | -17,3% |
| faturamento | cpu4x-2Mbps | 3/3 | 6415,5 | 5602,4 | -12,7% |
| manifestos | desktop | 6/6 | 2860,7 | 2622,0 | -8,3% |
| manifestos | cpu4x-2Mbps | 6/6 | 5638,8 | 5886,6 | 4,4% |
| performance | desktop | 3/3 | 3000,5 | 2913,0 | -2,9% |
| performance | cpu4x-2Mbps | 3/3 | 5533,3 | 5487,0 | -0,8% |
| executivo | desktop | 3/3 | 3507,4 | 2447,0 | -30,2% |
| executivo | cpu4x-2Mbps | 3/3 | 5864,2 | 6024,7 | 2,7% |

### Cada gráfico em CPU 4x / 2 Mbps

Tempos desde a navegação. “Dados” é a conclusão das APIs simuladas usadas pelo gráfico; “Após dados” inclui montagem, trabalho da thread principal e animações até o último desenho. Não é tempo de CPU exclusivo do gráfico.

| Página / gráfico | Último desenho antes → depois | Dados antes → depois | Após dados antes → depois |
| --- | ---: | ---: | ---: |
| faturamento: Participação de Clientes no Faturamento | 6386,2 → 5602,4 | 4811,0 → 4066,7 | 1519,8 → 1535,7 |
| faturamento: Evolução do Faturamento | 5799,1 → 5061,2 | 4528,0 → 3581,7 | 1297,6 → 1479,5 |
| faturamento: Faturamento por Classificação (FTL/LTL/PTL) | 5955,1 → 5105,1 | 4593,0 → 3587,7 | 1434,4 → 1517,4 |
| faturamento: Faturamento por Responsável pela Região de Destino | 5995,2 → 5141,5 | 4593,0 → 3587,7 | 1493,7 → 1554,7 |
| faturamento: Faturamento por Rota | 6065,8 → 5212,7 | 4593,0 → 3587,7 | 1626,7 → 1625,9 |
| manifestos: Evolução do Custo Real x Meta Diária Base | 5145,4 → 5362,9 | 3527,2 → 3750,6 | 1600,8 → 1622,0 |
| manifestos: Remuneração (Custo x Receita Transportada) | 5260,1 → 5463,2 | 3527,2 → 3750,6 | 1709,9 → 1687,3 |
| manifestos: Aproveitamento (Peso Transportado x Capacidade do Veículo) | 5321,6 → 5504,8 | 3527,2 → 3750,6 | 1750,5 → 1750,9 |
| manifestos: Efetividade (quantidade de serviços x quantidade de serviços finalizados) | 5321,9 → 5541,3 | 3527,2 → 3750,6 | 1776,0 → 1766,7 |
| manifestos: Status de Manifestos por dia, mês e ano | 5638,8 → 5884,8 | 3527,2 → 3750,6 | 2088,2 → 2125,2 |
| manifestos: Custos por Tipo de Contrato | 5538,9 → 5796,8 | 3527,2 → 3750,6 | 1978,6 → 2023,2 |
| manifestos: Tipo de Veículos Utilizados | 5619,2 → 5865,9 | 3527,2 → 3750,6 | 2065,0 → 2107,2 |
| performance: Entregas por dia, mês e ano | 5213,3 → 5181,6 | 3542,3 → 3506,7 | 1722,4 → 1566,0 |
| performance: Distribuição por Status | 5218,8 → 5076,9 | 3543,3 → 3507,7 | 1646,0 → 1569,2 |
| performance: Histórico de Performance | 5529,6 → 5487,0 | 3986,3 → 3937,7 | 1543,3 → 1591,6 |
| performance: Performance por responsável, região e cidade | 5432,5 → 5373,1 | 4000,3 → 3946,7 | 1463,3 → 1475,7 |
| performance: Entregas em aberto | 5533,3 → 5451,9 | 4012,3 → 3953,7 | 1537,6 → 1545,5 |
| executivo: Faturamento x Backlog Mensal | 5864,2 → 6024,7 | 3426,6 → 3505,4 | 2456,6 → 2519,3 |
| executivo: Tendência Financeira | 4872,8 → 4946,5 | 3426,6 → 3505,4 | 1471,5 → 1443,8 |
