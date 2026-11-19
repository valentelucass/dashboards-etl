# Visao Geral da Plataforma

## Objetivo do sistema

O monorepo `dashboards` entrega uma plataforma de dashboards operacionais, financeiros, executivos e de saude do ETL. O backend expoe contratos HTTP protegidos por JWT e ACL. O frontend consome esses contratos com React Query, mantendo filtros compartilhados na URL e renderizacao progressiva.

Este projeto consome os dados que o ETL publica em `ETL_SISTEMA_V2.pub`.

## Topologia do monorepo

```text
dashboards/
|-- backend/     -> Spring Boot 3.2, JPA, SQL Server, JWT, ACL
|-- frontend/      -> React 19, TypeScript, Vite, React Query
|-- docs/              -> referencia tecnica e operacional
|-- scripts/           -> automacao de validacao BI
|-- reports/           -> artefatos gerados pelas validacoes
`-- iniciar-dev.bat    -> bootstrap local no Windows
```

## Fluxo fim a fim de uma consulta

```text
Pagina React
    -> hook em src/hooks/queries
    -> endpoint em src/api/endpoints
    -> clienteAxios (JWT, refresh, interceptors)
    -> controller Spring /api/painel/*
    -> FiltroRequestMapper
    -> service de dominio
    -> repository com projecao SQL
    -> view SQL Server publicada pelo ETL
    -> DTO de resposta
    -> componente React (cards, graficos, tabela)
```

## Dominios de negocio atuais

Dashboards principais:

- Coletas
- Manifestos
- Fretes
- Tracking
- Faturas
- Faturas por Cliente
- Contas a Pagar
- Cotacoes
- Executivo
- ETL Saude

Modulos de apoio:

- autenticacao e sessao;
- ACL administrativa de setores e usuarios;
- dimensoes compartilhadas para filtros;
- endpoints internos protegidos por API key;
- health probes para operacao.

## Principios arquiteturais

### 1. O ETL e o banco sao a fonte estrutural dos dados

O ETL mantém as views em `ETL_SISTEMA_V2.pub`. O Dashboard consulta essas views em modo de leitura por meio dos sinônimos no banco do painel.

No schema proprio do Dashboard, a fonte de verdade estrutural e o Flyway em `database/migrations`. DDL em runtime dentro de Java e proibido; inicializadores ou validadores podem conferir pre-condicoes, mas nao criar estrutura automaticamente em producao.

### 2. A API coordena contrato, filtro e seguranca

A API nao deve puxar grandes massas para agregar, filtrar ou calcular `distinct` em memoria da JVM. Agregacoes, rankings, filtros textuais e listas distintas devem ser expressos como projecoes SQL/repositories para que o banco execute o plano correto.

### 3. Filtros precisam ser reproduziveis

Periodo e filtros adicionais devem estar serializados na URL. Isso garante links compartilhaveis, reproducao de bugs e query keys estaveis no React Query.

### 4. Erro de negocio precisa chegar legivel ate a UI

O backend devolve mensagens claras via `RespostaErroPadrao`. O frontend deve consumir essas mensagens com `getApiErrorMessage()` e escolher o tipo visual correto com `getTipoErro()`.

### 5. `LocalDate` e `DATETIMEOFFSET` nao sao a mesma coisa

Essa e a principal fonte de regressao no BI. Qualquer dashboard baseado em `DATETIMEOFFSET` deve aplicar a janela local de `America/Sao_Paulo`, com inicio inclusivo e fim exclusivo.

### 6. A validacao BI e parte do produto

O script em `scripts/validate-dashboard-consistency.mjs` nao e acessorio. Ele e o mecanismo formal para comparar SQL x API e deve permanecer alinhado com a semantica atual da aplicacao.

## Componentes mais importantes por camada

Backend:

- `controller/`: fronteira HTTP
- `service/`: regra de negocio, validacao de periodo e orquestracao de consultas
- `service/acesso/`: autenticacao, ACL, auditoria e refresh token
- `repository/`: leitura projetada das views publicadas pelo ETL e das tabelas proprias do Dashboard
- `security/`: JWT, API key, rate limit
- `config/`: CORS, seguranca, async, password
- `exception/`: contrato uniforme de erro

Frontend:

- `src/App.tsx`: arvore de providers e rotas
- `src/contexts/`: sessao e filtros globais
- `src/api/`: cliente HTTP e endpoints
- `src/hooks/queries/`: caching e estados remotos
- `src/pages/`: montagem final de cada dashboard
- `src/components/`: layout, filtros, cards, erro e graficos
- `src/utils/`: funcoes puras de sessao, data, acesso e erro

## Invariantes que nao devem ser quebrados

- toda rota protegida deve exigir autenticacao;
- toda consulta de dashboard deve validar periodo antes de chegar ao banco;
- toda estrutura propria do Dashboard deve nascer em migration Flyway;
- o Dashboard nao deve criar ou alterar views/tabelas do ETL;
- agregacoes, filtros e `distinct` de BI devem permanecer em SQL, nao em memoria da JVM;
- filtros adicionais devem usar o prefixo `f.` na URL;
- dashboards com `DATETIMEOFFSET` devem usar `PeriodoOffsetDateTimeHelper`;
- erros de timeout devem retornar `408 Request Timeout`;
- validacao automatica BI deve fechar em `100%` antes de um ajuste ser considerado confiavel.
