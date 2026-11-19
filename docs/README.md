# Documentacao Canonica

Esta pasta passa a ser o ponto de entrada oficial da documentacao do monorepo.

Objetivo:

- reduzir onboarding oral;
- registrar decisoes arquiteturais que afetam backend, frontend e BI;
- deixar claro onde cada responsabilidade vive;
- padronizar como diagnosticar divergencias entre SQL, API e UI;
- separar o que e referencia vigente do que e material historico.

## Como navegar

Leitura recomendada para onboarding tecnico:

1. `docs/arquitetura/01-visao-geral.md`
2. `docs/arquitetura/02-backend.md`
3. `docs/arquitetura/03-frontend.md`
4. `docs/arquitetura/04-seguranca-e-acesso.md`
5. `docs/arquitetura/05-filtros-e-dados.md`
6. `docs/catalogos/01-dashboards-e-endpoints.md`
7. `docs/operacao/01-setup-e-validacao.md`
8. `docs/operacao/02-runbook.md`
9. `docs/operacao/03-skills-claude-codex.md`

## Estrutura atual

```text
docs/
|-- README.md
|-- arquitetura/
|   |-- 01-visao-geral.md
|   |-- 02-backend.md
|   |-- 03-frontend.md
|   |-- 04-seguranca-e-acesso.md
|   `-- 05-filtros-e-dados.md
|-- catalogos/
|   `-- 01-dashboards-e-endpoints.md
`-- operacao/
    |-- 01-setup-e-validacao.md
    |-- 02-runbook.md
    `-- 03-skills-claude-codex.md
```

## Fatos operacionais que devem permanecer alinhados

- API DEV local: `http://localhost:5011`
- UI DEV local: `http://localhost:5174`
- API PROD local: `http://localhost:5010`
- UI PROD local: `http://localhost:5173`
- periodo maximo aceito: `365 dias`
- timeout JPA: `30000 ms`
- timezone canonico para filtros `DATETIMEOFFSET`: `America/Sao_Paulo`
- serializacao de filtros adicionais na URL: prefixo `f.`
- relatorios do validador BI: pasta `reports/`
- estrutura propria do Dashboard: somente Flyway em `database/migrations`
- views analiticas `dbo.vw_*_powerbi` e `dbo.vw_dim_*`: owner estrutural e o projeto ETL
- acesso do Dashboard ao schema do ETL: leitura, sem DDL cross-database

## Fronteira entre Dashboard e ETL

O Dashboard e uma camada consumidora e de apresentacao. Ele valida filtros, aplica seguranca, expoe contratos HTTP e entrega DTOs para o frontend.

O projeto `etl-extracao-dados-v2` mantém as tabelas e as views analíticas publicadas em `ETL_SISTEMA_V2.pub`. O Dashboard mantém os sinônimos locais de leitura.

No banco proprio do Dashboard, a unica fonte de verdade estrutural e o Flyway. DDL em runtime Java e proibido; validadores podem detectar drift e falhar cedo, mas nao corrigir schema automaticamente.

Agregacoes, filtros, rankings e `distinct` de BI devem ser executados por SQL/projecoes no banco. A JVM nao deve carregar grandes massas das views do ETL para calcular resultado em memoria.

## O que e canonico vs. historico

Documentos canonicos:

- todos os arquivos desta trilha nova em `docs/arquitetura`, `docs/catalogos` e `docs/operacao`;
- `README.md` da raiz para bootstrap rapido;
- `scripts/README.md` para o uso do validador automatico.

Documentos historicos:

- `docs/backend.md`
- `docs/frontend.md`
- `docs/GUIA-INTEGRACAO-SQL-DTOS-VIEWS.md`
- `docs/novopage.md`
- `docs/relatorio-*.md`
- `docs/validacao-manual-entidades-dashboard.md`

Os arquivos historicos nao sao descartados, mas podem refletir fases anteriores do projeto. Ao encontrar conflito entre um documento historico e esta trilha nova, prevalece a trilha nova.

Registros em `docs/analises/` sao auditoria historica e nao devem ser editados durante saneamentos de documentacao.

## Quando atualizar esta documentacao

Atualize esta pasta sempre que houver uma das mudancas abaixo:

- novo dashboard, rota, DTO ou endpoint;
- alteracao de semantica de filtro, periodo, timezone ou tolerancia;
- mudanca em autenticacao, refresh token, papeis ou permissoes;
- mudanca nos scripts de validacao ou no processo de release;
- incidente real que gere um novo runbook ou checklist.

## Padrao de escrita esperado

- descrever a regra de negocio junto com a decisao tecnica;
- registrar invariantes, nao apenas "como hoje funciona";
- evitar frases vagas do tipo "depois ajustamos";
- sempre citar o caminho do codigo quando a regra depender de implementacao;
- sempre distinguir dado financeiro (`LocalDate`) de dado operacional com `DATETIMEOFFSET`.
