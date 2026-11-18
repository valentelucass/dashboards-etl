# Dashboard com ingestão contínua e capacidade para novas entidades

A solução usa o SQL Server 2022 Standard instalado. A aplicação mantém um conjunto de conexões para login, sessões e estado interno e outro, limitado, para indicadores, listas de filtros e exportações. O ETL transforma os lotes recebidos em tabelas de leitura com índices por data, filial e chave. O Dashboard consulta os mesmos contratos pelos sinônimos.

## Fluxo de uma atualização

1. O coletor confirma um lote completo, inclusive um dia válido sem registros, e grava o identificador do lote por entidade e data. O histórico e a retomada utilizam a cobertura existente do ETL V2.
2. A fila compara o lote recebido com o lote aplicado em cada publicação. O preparo lê a partição alterada e reúne as chaves do lote novo e do anterior para tratar correções, itens que mudaram de data e exclusões.
3. O preparo recalcula as chaves afetadas e grava os dados e o progresso na mesma transação. Uma falha mantém a última versão concluída daquele recorte. Reexecutar o mesmo lote deixa o resultado em uma única versão. A fila volta a indicar pendência se a origem recebeu um lote diferente.
4. O Dashboard lê tabelas preparadas e agrega os recortes solicitados no SQL. Para métricas recorrentes, o ETL pode publicar também somas e contagens por dia e filial. O detalhamento continua usando a tabela por registro para respeitar todos os filtros, permissões e fórmulas.

A fila de preparo deve ter um trabalhador SQL inicial com prazo por partição, ao lado da atualização contínua já existente. O crescimento vem de recalcular somente o recorte alterado. Aumentar o número de entidades não aumenta automaticamente o limite de conexões do Dashboard. Toda publicação deve mostrar quando a fonte foi recebida, até quando a leitura foi preparada e se há dias pendentes. O estado interno do portal continua disponível quando o limite analítico é atingido. Os dois conjuntos de conexões ainda compartilham CPU, disco e memória do mesmo SQL Server.

## Aplicação aos onze conjuntos em operação

- Coletas e Coletas Excluídas alimentam uma única tabela de leitura. O primeiro candidato fica em `database/production/publication/037_dashboard_coletas_preparacao_incremental.sql` no repositório do ETL. A leitura preparada tem os mesmos 41 campos da atual. Cada partição aplicada atualiza as chaves que entraram, saíram ou passaram a usar um registro de outro dia.
- Fretes, sua consolidação e seus comprovantes alimentam os contratos relacionados de Faturamento, Performance e Gestão à Vista. O preparo deve reutilizar o mesmo detalhe tipado e recalcular os indicadores derivados com o seu grão original. Mesmo ID com competências diferentes e contagem distinta exigem conferência específica.
- Cotações, Contas a Pagar, Faturas por Cliente, Manifestos, Rastreamento, Inventário e Sinistros precisam de publicação por chave e dos índices conforme seus filtros. Integrações depende do Satélite e tem uma prova de disponibilidade e tempo própria. As fontes auxiliares entram como dependências das publicações que as usam.
- Uma nova entidade cadastra o contrato de origem, a chave e as regras de precedência, os dependentes, os índices e os cenários de comparação. Depois do preenchimento isolado, a entrada no Dashboard é uma troca de contrato validada. As entidades existentes podem continuar atendendo enquanto o novo preparo é qualificado.

## Antes da ativação

O [inventário do Dashboard](../catalogos/inventario-dashboard.md) registra os contratos que cada página consome e as provas de 18/11. O trabalhador candidato do ETL percorre Coletas e a seleção inicial de vigência de Fretes. As dependências finais de Performance e Faturamento aguardam qualificação.

1. Retomar o acionador contínuo da V2 e conferir os dias esperados por entidade. Reconciliar a partir de 14/11 nos 11 conjuntos que ficaram atrasados. Distinguir partição vazia confirmada de dia sem captura.
2. Qualificar cada publicação na cópia antes de trocar a leitura. Comparar todas as colunas, as multiplicidades e os totais, inclusive exclusões, mudança de data, lote vazio, falha e retomada. Preencher o histórico com trabalho limitado e acompanhar o atraso até a fila ficar em dia.
3. Rodar todos os painéis e seus principais filtros com os 90 dias reais e com a ingestão concorrente em homologação. Medir também um volume maior com o mesmo perfil de dados, login, renovação, exportação, espera por memória e ocupação das conexões. Registrar percentis por rota e a capacidade observada antes de aumentar os limites.
4. Validar a atualização em ciclos consecutivos e conferir a reversão para a última publicação compatível e atual. Uma leitura de contingência atrasada deve sinalizar a data disponível.

