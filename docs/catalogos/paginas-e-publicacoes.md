# Páginas, navegação e contratos de leitura

Os métodos, parâmetros, permissões, serviços, repositórios, objetos, fontes e resultados por rota estão na [matriz HTTP](rotas-e-dependencias.csv). O [guia de manutenção](inventario-dashboard.md) descreve o escopo e a reprodução.

23 padrões de navegação, 18 componentes de página, 221 operações HTTP e 28 controladores. DELETE 11, GET 175, PATCH 1, POST 25, PUT 9.

| Caminho | Página ou destino | Guarda no navegador | Filtros ou entradas principais |
|---|---|---|---|
| `/login` | LoginPage | pública / resolução de sessão | credenciais, redefinição e troca obrigatória |
| `/auth/trocar-senha` | LoginPage | pública / resolução de sessão | credenciais, redefinição e troca obrigatória |
| `/acesso-negado` | AcessoNegadoPage | pública / resolução de sessão | — |
| `/alterar-senha` | AlterarSenhaPage | sessão inclusive troca de senha | credenciais da sessão |
| `/` | HomePage | sessão | comunicados, solicitações e visibilidade do usuário |
| `/coletas` | ColetasPage | coletas, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, clientes, status, regioes, usuarios |
| `/manifestos` | ManifestosPage | manifestos, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, status, motoristas, veiculos, numeroManifesto, classificacoes, tiposCarga, tiposContrato, tipoMotorista |
| `/faturamento` | FaturamentoPage | fretes, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, status, pagadores, responsaveis, ufOrigem, ufDestino, tiposFrete, modais |
| `/fretes` | redireciona a /faturamento | fretes, sessão | — |
| `/performance` | PerformancePage | performance, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, status, pagadores, responsaveis, regioesDestino, cidadesDestino |
| `/tracking` | TrackingPage | tracking, sessão | dataInicio, dataFim, filialEmissora, filialAtual, filialDestino, regiaoOrigem, regiaoDestino, statusCarga |
| `/faturas-por-cliente` | FaturasPorClientePage | faturasPorCliente, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, pagadores, clientesCnpj, statusProcesso |
| `/contas-a-pagar` | ContasAPagarPage | contasAPagar, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, fornecedores, classificacoes, centrosCusto, pago, conciliado |
| `/cotacoes` | CotacoesPage | cotacoes, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, clientes, ufOrigem, ufDestino, statusConversao, tabelas, usuarios, classificacoes, origens, destinos |
| `/indicadores-gestao-a-vista` | IndicadoresGestaoAVistaPage | indicadoresGestaoAVista, sessão | dataInicio, dataFim, filiais, parceirosLogisticos, classificacoes |
| `/executivo` | ExecutivoPage | executivo, sessão | período, filiais, parceiros logísticos |
| `/etl-saude` | EtlSaudePage | etlSaude, sessão | período, status e entidade na cobertura |
| `/painel/integracoes` | IntegracoesPage | integracoes, sessão | período, destino, escopo, etapa, situação, origem, busca, paginação |
| `/painel/quarentena` | redireciona a /painel/integracoes | integracoes, sessão | — |
| `/admin` | redireciona a /admin/setores | admin, sessão | — |
| `/admin/setores` | AdminSetoresPage | admin, sessão | setor, papel e catálogo de permissões |
| `/admin/usuarios` | AdminUsuariosPage | admin, sessão | usuário, setor, papel, estado e navegação |
| `*` | primeira página permitida ou login | pública / resolução de sessão | — |

## AcessoNegadoPage

Entrada no código: `/acesso-negado`.

| Método | Caminho usado pelo cliente |
|---|---|
| POST | `/api/auth/logout` |

## AdminSetoresPage

Entrada no código: `/admin/setores`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/admin/acesso/setores/{}` |
| GET | `/api/admin/acesso/catalogo-permissoes` |
| GET | `/api/admin/acesso/setores` |
| GET | `/api/dimensoes/filiais` |
| POST | `/api/admin/acesso/setores` |
| PUT | `/api/admin/acesso/setores/{}` |

## AdminUsuariosPage

Entrada no código: `/admin/usuarios`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/admin/acesso/usuarios/{}` |
| GET | `/api/admin/acesso/catalogo-permissoes` |
| GET | `/api/admin/acesso/papeis` |
| GET | `/api/admin/acesso/setores` |
| GET | `/api/admin/acesso/usuarios` |
| GET | `/api/admin/acesso/usuarios/importacao/template` |
| GET | `/api/admin/acesso/usuarios/resumo-sessoes` |
| GET | `/api/admin/acesso/usuarios/{}/navegacao-dia` |
| GET | `/api/dimensoes/filiais` |
| POST | `/api/admin/acesso/setores` |
| POST | `/api/admin/acesso/usuarios` |
| POST | `/api/admin/acesso/usuarios/importacao` |
| POST | `/api/admin/acesso/usuarios/importacao/pre-validacao` |
| POST | `/api/admin/acesso/usuarios/importacao/revalidacao` |
| POST | `/api/usuarios/{}/reset-senha` |
| PUT | `/api/admin/acesso/usuarios/{}` |

## AlterarSenhaPage

Entrada no código: `/alterar-senha`.

| Método | Caminho usado pelo cliente |
|---|---|
| POST | `/api/auth/alterar-senha` |
| POST | `/api/auth/logout` |

## AutenticacaoProvider

Entrada no código: `ciclo global da sessão`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/auth/me` |
| POST | `/api/auth/alterar-senha` |
| POST | `/api/auth/login` |
| POST | `/api/auth/logout` |
| POST | `/api/auth/nova-senha-obrigatoria` |
| POST | `/api/auth/refresh` |

## ColetasPage

Entrada no código: `/coletas`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/clientes` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/dimensoes/usuarios` |
| GET | `/api/painel/coletas` |
| GET | `/api/painel/coletas/exportacao` |
| GET | `/api/painel/coletas/graficos/cidades` |
| GET | `/api/painel/coletas/graficos/historico-performance` |
| GET | `/api/painel/coletas/graficos/operacao` |
| GET | `/api/painel/coletas/graficos/status` |
| GET | `/api/painel/coletas/serie` |
| GET | `/api/painel/coletas/tabela/paginada` |

## ContasAPagarPage

Entrada no código: `/contas-a-pagar`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/filiais` |
| GET | `/api/dimensoes/planocontas` |
| GET | `/api/painel/contas-a-pagar` |
| GET | `/api/painel/contas-a-pagar/exportacao` |
| GET | `/api/painel/contas-a-pagar/graficos` |
| GET | `/api/painel/contas-a-pagar/graficos/centros-custo` |
| GET | `/api/painel/contas-a-pagar/graficos/fornecedores` |
| GET | `/api/painel/contas-a-pagar/serie` |
| GET | `/api/painel/contas-a-pagar/tabela/paginada` |

## CotacoesPage

Entrada no código: `/cotacoes`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/clientes` |
| GET | `/api/dimensoes/cotacoes/classificacoes` |
| GET | `/api/dimensoes/cotacoes/destinos` |
| GET | `/api/dimensoes/cotacoes/origens` |
| GET | `/api/dimensoes/cotacoes/usuarios` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/painel/cotacoes` |
| GET | `/api/painel/cotacoes/exportacao` |
| GET | `/api/painel/cotacoes/graficos` |
| GET | `/api/painel/cotacoes/resumo/cliente` |
| GET | `/api/painel/cotacoes/resumo/filial` |
| GET | `/api/painel/cotacoes/resumo/usuario` |
| GET | `/api/painel/cotacoes/serie` |
| GET | `/api/painel/cotacoes/tabela/paginada` |

## EtlSaudePage

Entrada no código: `/etl-saude`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/painel/etl-saude` |
| GET | `/api/painel/etl-saude/cobertura-v2` |
| GET | `/api/painel/etl-saude/evolucao-insercoes-atualizacoes` |
| GET | `/api/painel/etl-saude/exportacao` |
| GET | `/api/painel/etl-saude/serie` |
| GET | `/api/painel/etl-saude/tabela` |
| GET | `/api/painel/etl-saude/tabelas/resumo` |

## ExecutivoPage

Entrada no código: `/executivo`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/filiais` |
| GET | `/api/painel/executivo` |
| GET | `/api/painel/executivo/resumo-financeiro` |
| GET | `/api/painel/executivo/serie` |

## FaturamentoPage

Entrada no código: `/faturamento`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/painel/fretes/metas/configuracoes` |
| GET | `/api/dimensoes/clientes` |
| GET | `/api/dimensoes/faturamento/responsaveis` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/dimensoes/fretes/status` |
| GET | `/api/painel/fretes` |
| GET | `/api/painel/fretes/exportacao` |
| GET | `/api/painel/fretes/graficos` |
| GET | `/api/painel/fretes/metas` |
| GET | `/api/painel/fretes/metas/configuracoes` |
| GET | `/api/painel/fretes/serie` |
| GET | `/api/painel/fretes/tabela/paginada` |
| GET | `/api/painel/fretes/top-clientes` |
| POST | `/api/painel/fretes/metas/replicar` |
| PUT | `/api/painel/fretes/metas/configuracoes` |

## FaturasPorClientePage

Entrada no código: `/faturas-por-cliente`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/faturas-por-cliente/clientes-cnpj` |
| GET | `/api/dimensoes/faturas-por-cliente/pagadores` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/painel/faturas-por-cliente` |
| GET | `/api/painel/faturas-por-cliente/aging` |
| GET | `/api/painel/faturas-por-cliente/aging/drilldown` |
| GET | `/api/painel/faturas-por-cliente/exportacao` |
| GET | `/api/painel/faturas-por-cliente/serie` |
| GET | `/api/painel/faturas-por-cliente/status-processo` |
| GET | `/api/painel/faturas-por-cliente/status-processo/evolucao` |
| GET | `/api/painel/faturas-por-cliente/tabela/paginada` |
| GET | `/api/painel/faturas-por-cliente/top-clientes/drilldown` |

## HomePage

Entrada no código: `/`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/painel/home/comunicados/{}` |
| DELETE | `/api/painel/home/comunicados/{}/comentarios/{}` |
| DELETE | `/api/painel/home/solicitacoes/{}` |
| GET | `/api/painel/home/comunicados` |
| GET | `/api/painel/home/comunicados/{}/comentarios` |
| GET | `/api/painel/home/solicitacoes` |
| GET | `/api/painel/home/solicitacoes/minhas` |
| GET | `/api/painel/home/solicitacoes/{}/anexos/{}` |
| PATCH | `/api/painel/home/solicitacoes/{}/concluir` |
| POST | `/api/painel/home/comunicados` |
| POST | `/api/painel/home/comunicados/{}/comentarios` |
| POST | `/api/painel/home/comunicados/{}/curtidas` |
| POST | `/api/painel/home/solicitacoes` |
| PUT | `/api/painel/home/comunicados/{}` |
| PUT | `/api/painel/home/comunicados/{}/leitura` |

## IndicadoresGestaoAVistaPage

Entrada no código: `/indicadores-gestao-a-vista`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/kpi-goals/branch/{}` |
| DELETE | `/api/painel/gestao-vista/cubagem/clientes/{}` |
| DELETE | `/api/painel/indicadores-gestao-a-vista/horarios-corte/justificativas/{}` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/kpi-goals` |
| GET | `/api/kpi-goals/effective` |
| GET | `/api/kpi-goals/history/page` |
| GET | `/api/kpi-goals/overrides` |
| GET | `/api/painel/gestao-vista/cubagem/clientes` |
| GET | `/api/painel/indicadores-gestao-a-vista/cubagem-mercadorias/exportacao` |
| GET | `/api/painel/indicadores-gestao-a-vista/cubagem-mercadorias/overview` |
| GET | `/api/painel/indicadores-gestao-a-vista/cubagem-mercadorias/serie` |
| GET | `/api/painel/indicadores-gestao-a-vista/cubagem-mercadorias/tabela/paginada` |
| GET | `/api/painel/indicadores-gestao-a-vista/horarios-corte/exportacao` |
| GET | `/api/painel/indicadores-gestao-a-vista/horarios-corte/overview` |
| GET | `/api/painel/indicadores-gestao-a-vista/horarios-corte/serie` |
| GET | `/api/painel/indicadores-gestao-a-vista/horarios-corte/tabela/paginada` |
| GET | `/api/painel/indicadores-gestao-a-vista/indenizacao-mercadorias/exportacao` |
| GET | `/api/painel/indicadores-gestao-a-vista/indenizacao-mercadorias/overview` |
| GET | `/api/painel/indicadores-gestao-a-vista/indenizacao-mercadorias/serie` |
| GET | `/api/painel/indicadores-gestao-a-vista/indenizacao-mercadorias/tabela/paginada` |
| GET | `/api/painel/indicadores-gestao-a-vista/performance-entrega/exportacao` |
| GET | `/api/painel/indicadores-gestao-a-vista/performance-entrega/overview` |
| GET | `/api/painel/indicadores-gestao-a-vista/performance-entrega/serie` |
| GET | `/api/painel/indicadores-gestao-a-vista/performance-entrega/tabela/paginada` |
| GET | `/api/painel/indicadores-gestao-a-vista/utilizacao-coletores/exportacao` |
| GET | `/api/painel/indicadores-gestao-a-vista/utilizacao-coletores/overview` |
| GET | `/api/painel/indicadores-gestao-a-vista/utilizacao-coletores/ranking` |
| GET | `/api/painel/indicadores-gestao-a-vista/utilizacao-coletores/tabela/paginada` |
| POST | `/api/painel/gestao-vista/cubagem/clientes/importacao` |
| POST | `/api/painel/gestao-vista/cubagem/clientes/importacao/pre-validacao` |
| POST | `/api/painel/indicadores-gestao-a-vista/horarios-corte/justificativas` |
| PUT | `/api/kpi-goals/branch/{}` |
| PUT | `/api/kpi-goals/global` |

## IntegracoesPage

Entrada no código: `/painel/integracoes`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/painel/integracoes` |
| GET | `/api/painel/integracoes/exportacao` |
| GET | `/api/painel/integracoes/indicadores-operacionais` |
| GET | `/api/painel/integracoes/pendencias-etapas` |
| GET | `/api/painel/integracoes/vedacit-sftp/clientes` |
| GET | `/api/painel/integracoes/vedacit-sftp/execucoes` |

## LayoutPainel

Entrada no código: `layout das páginas autenticadas`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/apresentacoes/{}` |
| GET | `/api/apresentacoes` |
| GET | `/api/painel/home/comunicados` |
| POST | `/api/apresentacoes` |
| POST | `/api/auth/logout` |
| PUT | `/api/painel/home/comunicados/{}/leitura` |
| PUT | `/api/sessao/presenca` |

## LoginPage

Entrada no código: `/login, /auth/trocar-senha`.

| Método | Caminho usado pelo cliente |
|---|---|
| POST | `/api/auth/login` |
| POST | `/api/auth/nova-senha-obrigatoria` |
| POST | `/api/auth/password-reset-request` |

## ManifestosPage

Entrada no código: `/manifestos`.

| Método | Caminho usado pelo cliente |
|---|---|
| DELETE | `/api/painel/manifestos/metas` |
| GET | `/api/dimensoes/filiais` |
| GET | `/api/dimensoes/manifestos/classificacoes` |
| GET | `/api/dimensoes/motoristas` |
| GET | `/api/dimensoes/veiculos` |
| GET | `/api/painel/manifestos/exportacao` |
| GET | `/api/painel/manifestos/metas` |
| GET | `/api/painel/manifestos/metas/importacao/template` |
| GET | `/api/painel/manifestos/performance` |
| GET | `/api/painel/manifestos/tabela/paginada` |
| POST | `/api/painel/manifestos/metas` |
| POST | `/api/painel/manifestos/metas/importacao` |
| POST | `/api/painel/manifestos/metas/importacao/pre-validacao` |
| POST | `/api/painel/manifestos/metas/replicar` |

## PerformancePage

Entrada no código: `/performance`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/filiais` |
| GET | `/api/dimensoes/pagadores` |
| GET | `/api/dimensoes/performance/cidades-destino` |
| GET | `/api/dimensoes/performance/regioes-destino` |
| GET | `/api/dimensoes/performance/responsaveis` |
| GET | `/api/painel/performance/aging` |
| GET | `/api/painel/performance/drilldown` |
| GET | `/api/painel/performance/exportacao` |
| GET | `/api/painel/performance/historico` |
| GET | `/api/painel/performance/overview` |
| GET | `/api/painel/performance/serie-temporal` |
| GET | `/api/painel/performance/status` |
| GET | `/api/painel/performance/tabela/paginada` |

## RotaProtegida

Entrada no código: `guarda de acesso`.

A tela utiliza estado de navegação ou o provedor comum de sessão.

## TrackingPage

Entrada no código: `/tracking`.

| Método | Caminho usado pelo cliente |
|---|---|
| GET | `/api/dimensoes/filiais` |
| GET | `/api/painel/tracking/dashboard` |
| GET | `/api/painel/tracking/detalhes` |
| GET | `/api/painel/tracking/exportacao` |

## Publicações da V071 e cobertura V070

| Contrato SQL | Definição no ETL | Entidades alcançadas | Leitura e tabelas auxiliares |
|---|---|---|---|
| `dim_calendario` | `003_dashboard_dim_calendario.sql` | referência ou auditoria | ctl.production_installation_step, ref.ufn_calendar_seed_candidate_v1 |
| `fato_fretes_faturamento` | `035_dashboard_fretes_faturamento.sql` | FATURAS_POR_CLIENTE, FRETES, LOCALIZACAO_CARGAS | ctl.production_ingestion_coverage, ctl.production_installation_step, ref.dashboard_faturamento_atribuicao_filial, ref.dashboard_frete_filial_documento, ref.dashboard_frete_filial_nome, ref.ufn_calendar_seed_candidate_v1, stg.production_export_latest |
| `fato_gestao_vista_coletores` | `021_dashboard_fato_coletores.sql` | FRETES, INVENTARIO, MANIFESTOS | ctl.production_ingestion_coverage, ctl.production_ingestion_run, stg.production_export_latest, stg.production_export_occurrence |
| `fato_gestao_vista_faturas` | `013_dashboard_fato_faturas.sql` | FATURAS_POR_CLIENTE | ctl.production_ingestion_coverage, stg.production_export_latest |
| `fato_gestao_vista_fretes` | `031_dashboard_gestao_vista_fretes_tuned.sql` | FATURAS_POR_CLIENTE, FRETES, LOCALIZACAO_CARGAS | ctl.production_ingestion_coverage, ref.dashboard_frete_regras_documento, stg.production_export_latest |
| `log_extracoes` | `022_dashboard_log_extracoes.sql` | referência ou auditoria | ctl.dashboard_refresh_log, ctl.production_ingestion_run |
| `raster_viagem_paradas` | `019_dashboard_raster_paradas.sql` | referência ou auditoria | RASTER, stg.dashboard_auxiliary_latest |
| `raster_viagens` | `018_dashboard_raster_viagens.sql` | referência ou auditoria | RASTER, stg.dashboard_auxiliary_latest |
| `vw_bi_monitoramento` | `023_dashboard_bi_monitoramento.sql` | referência ou auditoria | ctl.dashboard_refresh_cycle, ctl.dashboard_refresh_log, ctl.production_ingestion_run |
| `vw_coletas_powerbi` | `032_dashboard_coletas.sql` | COLETAS, COLETAS_EXCLUIDAS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_contas_a_pagar_powerbi` | `014_dashboard_contas_a_pagar.sql` | CONTAS_A_PAGAR | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_cotacoes_powerbi` | `002_dashboard_cotacoes.sql` | COTACOES | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_dim_clientes` | `015_dashboard_dim_clientes.sql` | COLETAS, FATURAS_POR_CLIENTE, FRETES | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_dim_filiais` | `004_dashboard_dim_filiais.sql` | CONTAS_A_PAGAR, FATURAS_POR_CLIENTE, FRETES, MANIFESTOS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_dim_motoristas` | `005_dashboard_dim_motoristas.sql` | MANIFESTOS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_dim_planocontas` | `007_dashboard_dim_planocontas.sql` | CONTAS_A_PAGAR | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_dim_usuarios` | `016_dashboard_dim_usuarios.sql` | referência ou auditoria | USERS, stg.dashboard_auxiliary_latest |
| `vw_dim_veiculos` | `006_dashboard_dim_veiculos.sql` | MANIFESTOS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_etl_v2_receiving_overview` | `001_dashboard_receiving_overview.sql` | COLETAS, COLETAS_EXCLUIDAS, COMPROVANTES_ENTREGA, CONSOLIDACAO_DETALHADA, CONTAS_A_PAGAR, COTACOES, FATURAS_POR_CLIENTE, FRETES, INVENTARIO, LOCALIZACAO_CARGAS, MANIFESTOS, OCORRENCIAS, SINISTROS | ctl.production_export_template, ctl.production_ingestion_coverage, ctl.production_ingestion_run |
| `vw_fato_manifestos_dash` | `027_dashboard_manifestos_fato_dash.sql` | COLETAS, FRETES, MANIFESTOS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_faturas_por_cliente_powerbi` | `012_dashboard_faturas_por_cliente.sql` | FATURAS_POR_CLIENTE | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_fretes_powerbi` | `034_dashboard_fretes_detalhe.sql` | FATURAS_POR_CLIENTE, FRETES, INVENTARIO, LOCALIZACAO_CARGAS | ctl.production_ingestion_coverage, ctl.production_ingestion_run, ref.dashboard_faturamento_atribuicao_filial, ref.dashboard_frete_cidade_destino, ref.dashboard_frete_filial_documento, ref.dashboard_frete_filial_nome, stg.production_export_latest, stg.production_export_occurrence |
| `vw_inventario_powerbi` | `009_dashboard_inventario.sql` | FRETES, INVENTARIO | ctl.production_ingestion_coverage, ctl.production_ingestion_run, stg.production_export_latest, stg.production_export_occurrence |
| `vw_localizacao_cargas_powerbi` | `010_dashboard_localizacao_cargas.sql` | LOCALIZACAO_CARGAS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_manifestos_powerbi` | `026_dashboard_manifestos_powerbi.sql` | COLETAS, FRETES, MANIFESTOS | ctl.production_ingestion_coverage, stg.production_export_latest |
| `vw_raster_sm_transit_time` | `020_dashboard_raster_transit_time.sql` | referência ou auditoria | RASTER, stg.dashboard_auxiliary_latest |
| `vw_sinistros_powerbi` | `008_dashboard_sinistros.sql` | SINISTROS | ctl.production_ingestion_coverage, stg.production_export_latest |

## Catálogo de recebimento

| Entidade | Template | Campo do dia | Campos declarados | Contratos que a referenciam |
|---|---:|---|---:|---|
| COLETAS | 6908 | request_date | 31 | vw_coletas_powerbi, vw_dim_clientes, vw_fato_manifestos_dash, vw_manifestos_powerbi |
| FRETES | 6389 | service_at | 114 | fato_fretes_faturamento, fato_gestao_vista_coletores, fato_gestao_vista_fretes, vw_dim_clientes, vw_dim_filiais, vw_fato_manifestos_dash, vw_fretes_powerbi, vw_inventario_powerbi, vw_manifestos_powerbi |
| MANIFESTOS | 6399 | janela do contrato de extração | 91 | fato_gestao_vista_coletores, vw_dim_filiais, vw_dim_motoristas, vw_dim_veiculos, vw_fato_manifestos_dash, vw_manifestos_powerbi |
| COTACOES | 6906 | requested_at | 37 | vw_cotacoes_powerbi |
| LOCALIZACAO_CARGAS | 8656 | service_at | 26 | fato_fretes_faturamento, fato_gestao_vista_fretes, vw_fretes_powerbi, vw_localizacao_cargas_powerbi |
| CONTAS_A_PAGAR | 8636 | issue_date | 28 | vw_contas_a_pagar_powerbi, vw_dim_filiais, vw_dim_planocontas |
| FATURAS_POR_CLIENTE | 4924 | service_at | 52 | fato_fretes_faturamento, fato_gestao_vista_faturas, fato_gestao_vista_fretes, vw_dim_clientes, vw_dim_filiais, vw_faturas_por_cliente_powerbi, vw_fretes_powerbi |
| INVENTARIO | 10633 | started_at | 26 | fato_gestao_vista_coletores, vw_fretes_powerbi, vw_inventario_powerbi |
| SINISTROS | 6392 | opening_at_date | 44 | vw_sinistros_powerbi |
| CONSOLIDACAO_DETALHADA | 11067 | issue_date | 39 | somente cobertura neste mapa de views |
| OCORRENCIAS | 12072 | occurrence_at | 20 | somente cobertura neste mapa de views |
| COLETAS_EXCLUIDAS | 12899 | deleted_at | 10 | vw_coletas_powerbi |
| COMPROVANTES_ENTREGA | 11361 | janela do contrato de extração | 23 | somente cobertura neste mapa de views |
