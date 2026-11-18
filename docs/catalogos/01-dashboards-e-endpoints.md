# Catalogo de Dashboards e Endpoints

O [inventário operacional de 18/11/2026](inventario-dashboard.md) cruza as páginas atuais com métodos HTTP, permissões, fontes e ensaios. As descrições abaixo preservam o histórico deste catálogo.

Este catalogo descreve rotas e contratos do Dashboard. As views `dbo.vw_*_powerbi` e `dbo.vw_dim_*` usadas por esses contratos pertencem estruturalmente ao ETL; o Dashboard apenas consome em leitura e nao executa DDL cross-database.

## Dashboards principais

| Modulo | Rota UI | Permissao | Endpoint base | Endpoints complementares | Service backend | Campo principal de data | Tipo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Coletas | `/coletas` | `coletas` | `/api/painel/coletas` | `/serie`, `/graficos`, `/tabela` | `ColetasService` | `solicitacao` | `LocalDate` |
| Manifestos | `/manifestos` | `manifestos` | `/api/painel/manifestos` | `/serie`, `/graficos`, `/tabela` | `ManifestosService` | `dataCriacao` | `DATETIMEOFFSET` |
| Fretes | `/fretes` | `fretes` | `/api/painel/fretes` | `/serie`, `/top-clientes`, `/mix-documental`, `/graficos`, `/tabela` | `FretesService` | `dataReferenciaFaturamento` | `DATETIMEOFFSET` |
| Tracking | `/tracking` | `tracking` | `/api/painel/tracking` | `/serie`, `/graficos`, `/tabela` | `TrackingService` | `dataFrete` | `DATETIMEOFFSET` |
| Faturas | `/faturas` | `faturas` | `/api/painel/faturas` | `/mensal`, `/aging`, `/top-clientes`, `/status-processo`, `/reconciliacao`, `/tabela` | `FaturasService` | `emissao` e `dataEmissaoCte` | misto |
| Faturas por Cliente | `/faturas-por-cliente` | `faturasPorCliente` | `/api/painel/faturas-por-cliente` | `/mensal`, `/aging`, `/top-clientes`, `/status-processo`, `/tabela` | `FaturasPorClienteService` | `dataEmissaoCte` | `DATETIMEOFFSET` |
| Contas a Pagar | `/contas-a-pagar` | `contasAPagar` | `/api/painel/contas-a-pagar` | `/serie`, `/graficos`, `/tabela` | `ContasAPagarService` | `emissao` | `LocalDate` |
| Cotacoes | `/cotacoes` | `cotacoes` | `/api/painel/cotacoes` | `/serie`, `/graficos`, `/tabela` | `CotacoesService` | `dataCotacao` | `DATETIMEOFFSET` |
| Executivo | `/executivo` | `executivo` | `/api/painel/executivo` | `/serie` | `ExecutivoService` | agregado | misto |
| ETL Saude | `/etl-saude` | `etlSaude` | `/api/painel/etl-saude` | `/serie`, `/graficos`, `/tabela` | `EtlSaudeService` | `data` | `LocalDate` |

## Endpoints de autenticacao

| Endpoint | Metodo | Funcao |
| --- | --- | --- |
| `/api/auth/login` | `POST` | autentica usuario e emite JWT + refresh cookie |
| `/api/auth/me` | `GET` | devolve sessao atual |
| `/api/auth/alterar-senha` | `POST` | troca de senha do usuario autenticado |
| `/api/auth/refresh` | `POST` | rotaciona refresh token e emite novo JWT |
| `/api/auth/logout` | `POST` | revoga refresh token e limpa cookie |

## Endpoints administrativos

Base:

- `/api/admin/acesso`

Rotas:

- `/catalogo-permissoes`
- `/setores` (`GET`, `POST`)
- `/usuarios` (`GET`, `POST`)
- `/papeis`
- `/audit-logs`

## Endpoints de dimensoes

Base:

- `/api/dimensoes`

Rotas:

- `/filiais`
- `/clientes`
- `/motoristas`
- `/veiculos`
- `/planocontas`
- `/usuarios`

## Contratos de pagina no frontend

Todas as paginas de dashboard seguem o mesmo padrao de montagem:

1. overview principal;
2. blocos secundarios de serie e graficos;
3. tabela detalhada ou ranking;
4. consumo de filtros do `FiltroContext`;
5. exibicao de erro via `MensagemErro`;
6. fetching via hook React Query dedicado.

## Itens de navegacao relevantes

Dashboards:

- `Coletas`
- `Manifestos`
- `Fretes`
- `Localizacao de Cargas`
- `Faturas`
- `Faturas por Cliente`
- `Contas a Pagar`
- `Cotacoes`
- `Executivo`
- `ETL Saude`

Administracao:

- `/admin/setores`
- `/admin/usuarios`

## Quando atualizar este catalogo

Atualize este arquivo sempre que houver:

- novo dashboard;
- nova permissao;
- novo endpoint publico;
- mudanca no campo de data dominante;
- mudanca em rotas de frontend ou backend.
