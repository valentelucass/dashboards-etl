# Arquitetura Backend

## Stack e objetivo

O backend e uma API Spring Boot 3.2 que publica contratos de leitura para dashboards e modulos administrativos. O foco nao e CRUD generico; o foco e expor dados ja modelados no SQL Server com seguranca, filtros consistentes e mensagens de erro acionaveis.

O Dashboard consome as views de `ETL_SISTEMA_V2.pub` pelos sinônimos no banco da aplicação.

## Estrutura de pacotes

```text
backend/src/main/java/com/dashboard/api/
|-- config/
|-- controller/
|-- dto/
|-- exception/
|-- model/
|-- repository/
|-- security/
`-- service/
    `-- acesso/
```

## Responsabilidades por camada

### `controller/`

Responsavel por:

- declarar a rota;
- validar autenticacao/autorizacao via `@PreAuthorize`;
- converter `request params` em `FiltroConsultaDTO`;
- devolver DTOs, nunca entidades JPA.

Padrao atual:

- dashboards usam `FiltroRequestMapper.from(dataInicio, dataFim, params)`;
- filtros extras entram como `f.<chave>`;
- cada controller de dashboard expone overview, serie, graficos e/ou tabela.

### `service/`

Responsavel por:

- validar periodo com `ValidadorPeriodoService`;
- coordenar regras de negocio que pertencem ao contrato HTTP;
- escolher a projecao/repository correta para cada resposta;
- transformar resultados SQL ja agregados/projetados em DTOs finais;
- garantir semantica correta de data para `LocalDate` e `DATETIMEOFFSET`.

Regra importante:

- nao carregar grandes massas para agregar, filtrar, ranquear ou calcular `distinct` em memoria da JVM;
- agregacoes, filtros textuais, rankings e listas distintas devem nascer como SQL/projecoes no banco;
- transformacoes no service devem ser pequenas, deterministicas e orientadas ao formato do DTO.

Arquivos centrais:

- `ConsultaFiltroUtils.java`
- `ConsultaLimiteUtils.java`
- `ConsultaSpecificationUtils.java`
- `PeriodoOffsetDateTimeHelper.java`
- `ValidadorPeriodoService.java`

### `repository/`

Responsavel por:

- encapsular acesso a views SQL e tabelas proprias do Dashboard;
- expor consultas/projecoes que empurrem filtros e agregacoes para o banco;
- manter contratos de leitura coerentes com as views publicadas pelo ETL.

Regra importante:

- para `OffsetDateTime`, prefira metodos `GreaterThanEqualAndLessThan` ou `Specification` com `>=` e `<`;
- evite `between` quando a coluna representa instante e o filtro representa dia civil.

## Banco de dados e ownership estrutural

### Schema do Dashboard

- A unica fonte de verdade estrutural e o Flyway em `database/migrations`.
- `spring.jpa.hibernate.ddl-auto` deve permanecer sem geracao automatica de schema.
- DDL em runtime dentro de Java e proibido em producao.
- Inicializadores/validadores podem validar estado, registrar alerta ou falhar cedo; eles nao devem criar tabelas, alterar colunas ou corrigir schema em tempo de execucao.

### Schema do ETL

- O ETL mantém a estrutura de `ETL_SISTEMA_V2` e das views publicadas no schema `pub`.
- O Dashboard acessa esse schema como consumidor de leitura.
- O Dashboard nao deve executar DDL cross-database para criar, substituir ou sincronizar views do ETL.

### `exception/`

`ManipuladorGlobalExcecoes` padroniza erros relevantes:

- `400` para validacao de entrada e periodo invalido;
- `403` para acesso negado;
- `408` para timeout de consulta;
- `503` para indisponibilidade de banco;
- `500` para falhas nao tratadas.

Essa padronizacao e parte do contrato com a UI.

## Fluxo padrao para um novo dashboard

1. Criar DTOs de overview, serie, graficos e tabela.
2. Criar controller em `/api/painel/<modulo>`.
3. Chamar `FiltroRequestMapper`.
4. Validar o periodo no service.
5. Confirmar que a view/coluna necessaria existe no contrato publicado pelo ETL.
6. Definir o campo de data correto da view.
7. Se a view usa `DATETIMEOFFSET`, construir janela com `PeriodoOffsetDateTimeHelper`.
8. Implementar filtros, agregacoes, rankings e `distinct` como SQL/projecao no repository.
9. Limitar tabelas com `ConsultaLimiteUtils`.
10. Cobrir com teste de service/repository conforme o risco.
11. Incluir o modulo na validacao BI em `scripts/dashboard-validation/entities.mjs`.

## Semantica de consulta por tipo de data

### `LocalDate`

Use quando a view representa dia de negocio, nao instante.

Exemplos:

- `coletas.solicitacao`
- `contas_a_pagar.emissao`
- `faturas_graphql.emissao`

Padrao:

- `between(dataInicio, dataFim)`

### `OffsetDateTime`

Use quando a view representa instante real, com offset.

Exemplos:

- `fretes.dataReferenciaFaturamento`
- `tracking.dataFrete`
- `manifestos.dataCriacao`
- `cotacoes.dataCotacao`
- `faturas_por_cliente.dataEmissaoCte`

Padrao:

- janela local em `America/Sao_Paulo`
- `inicioInclusivo = dataInicio 00:00 local`
- `fimExclusivo = dataFim + 1 dia 00:00 local`
- filtros `>= inicioInclusivo` e `< fimExclusivo`

## Decisoes recentes que precisam ser preservadas

- periodo maximo aumentado para `365 dias`;
- timeout JPA aumentado para `30000 ms`;
- timeout de consulta mapeado para `408`;
- helper central de `DATETIMEOFFSET` introduzido para evitar regressao por UTC;
- Flyway e o unico mecanismo aceito para estruturas proprias do Dashboard;
- runtime Java nao executa DDL estrutural;
- views do ETL sao contrato externo de leitura, nao estrutura administrada pelo Dashboard;
- overview de `Faturas` nao pode zerar `clientesAtivos` quando houver base operacional sem titulos financeiros.

## Checklist de revisao backend

Antes de considerar uma mudanca pronta:

- o service valida periodo?
- o filtro de data usa o tipo correto?
- a consulta empurra filtros/agregacoes para SQL?
- a mudanca estrutural propria esta em Flyway?
- nao ha DDL Java em runtime?
- nenhuma view/tabela do ETL esta sendo criada ou alterada pelo Dashboard?
- o endpoint devolve DTO e nao entidade?
- existe teste cobrindo a regra nova?
- se o modulo entra no BI, o script de validacao foi atualizado?
- a mensagem de erro do backend chega clara para a UI?
