# Dashboard e ETL V2: conferência antes da troca — 0769

**Estado verificado em 11/11/2026.** Os 26 nomes analíticos do portal continuam ligados a `ETL_SISTEMA`. A V2 tem **7 dos 26 destinos analíticos publicados** e uma consulta adicional de cobertura dos recebimentos. Cotações e cobertura passaram em teste de API com JDBC e a conta atual do portal. Calendário, filiais, motoristas, veículos, plano de contas e Sinistros passaram na leitura JDBC com a mesma conta. [Cotações](operacao/cotacoes-por-trecho-v2-0771.md) · [Cobertura](operacao/cobertura-etl-v2-0770.md).

O banco recebeu 89.703 linhas vigentes das 11 entidades. Dez entidades têm datas confirmadas de 02 a 10/11. Faturas por Cliente tem datas de 29/10 a 10/11. O período disponível ainda é menor que o mês usado pelo dashboard. A carga de 90 dias continua reservada à execução manual do operador.

Os outros **19 destinos da tabela abaixo ainda precisam de publicação e validação**. O calendário publicado reproduz as regras do V1 usando a função da V2. A lista de filiais é obtida dos relatórios vigentes. As referências operacionais por vigência ainda precisam de dados. Raster e Coletores dependem de fontes além dos 11 relatórios. O banco `DASHBOARDS_DEV` ainda não existe nesta instância para o ensaio isolado de troca e retorno.

## Documentação conferida

| Etapa | O que já existe | Limite |
| --- | --- | --- |
| 0754 — mapa e dicionário | 26 nomes consultados, 958 pares objeto/coluna, tipos, expressões V1, vínculos com API, DTOs e frontend | Inventário, sem aceite do resultado de negócio no V2 |
| 0755 — matriz de adaptação | 707 nomes coincidentes, 83 candidatos por alias, 34 candidatos por rótulo, 134 soluções explícitas com expressão, grão e dependências | Candidatos e testes de tipos, em grande parte sobre estruturas de laboratório. Nenhuma equivalência de negócio inferida por nome |
| 0758 — instalação e troca | Banco segregado, acesso de leitura, dois modelos de troca/retorno protegidos e proposta dos 26 destinos | Templates com recusa explícita; não são migrations executáveis |
| 0762–0768 — recebimento e atualização | 11 entidades reais, leitura mais recente por data de negócio e conferência das duas novas fontes | Não publica os fatos, dimensões ou indicadores do dashboard |

Referência local do ETL: `docs/catalogos/integracao-etl-v2-dashboard/README.md`, `QUALIFICACAO-0755.md`, `PLANO-PRODUCAO.md` e `IMPLANTACAO-0758.md`. Artefatos 0754–0758: `Mapeamento_ETL_SISTEMA_V2.txt`, `Consumo_Dashboard_e_Fontes_V1_V2.txt`, `Dicionario_Campos_Dashboard.txt`, `matriz-958-contratos-0755.json`, `solucoes-134-campos-0755.json` e `pacote-corte-retorno0758.json`. A conferência 0769 registra hashes das evidências históricas e revisa os destinos na base real. Parte da documentação histórica existe somente na cópia local e foi preservada. As duas novas fontes têm dicionários próprios em `docs/catalogos/novas-entidades-0760/` e prova recente em `docs/catalogos/novas-entidades-0761/comparacao-e-propagacao-0768.md`.

## Testes reais de leitura

- **Conexão do consumidor:** a conta atual do portal, com Java 17, JDBC 13.4.0 e TLS validado, leu as consultas operacionais `pub.v2_installation_status` e `pub.v2_ingestion_status` no V2. A conta tem leitura no schema publicado e não tem leitura direta de `stg.production_export_latest` nem escrita em `core`. Nenhuma permissão foi ampliada.
- **Contrato atual:** o cliente Java descreveu os 26 objetos através de `DASHBOARDS`, com 958 nomes de colunas iguais ao inventário; os 26 destinos ainda apontam ao V1. A conferência do catálogo SQL encontrou **0 diferenças** nos atributos de tipo, tamanho, precisão, escala, posição e nulidade registrados em 0754. Flyway do portal: versão 069.
- **Base nova:** catálogo mostrou apenas duas views operacionais em `pub`. Nenhum dos 26 destinos propostos está instalado. Em `ref`, 0 de 18 tabelas têm linhas; em `core`, 0 de 3; em `mart`, 0 tabelas. Contagens de catálogo não substituem testes de qualidade.
- **Recebimento:** o total do último lote válido de cada entidade/data foi conferido com a contagem da view `stg.production_export_latest`. A origem observada é única, com **89.703 linhas e 103 combinações de entidade e data**. O diário contém 327.965 linhas históricas acumuladas em 355 capturas gravadas; somá-las duplicaria as reextrações. Capturas que falharam permanecem registradas (13); nenhuma estava em execução no momento da consulta.

| Entidade | Template | Campos | Dias recebidos | Período observado | Linhas atuais |
| --- | ---: | ---: | ---: | --- | ---: |
| Coletas | 6908 | 31 | 9 | 02/11/2026 a 10/11/2026 | 1.396 |
| Consolidação Detalhada | 11067 | 39 | 9 | 02/11/2026 a 10/11/2026 | 221 |
| Contas a Pagar | 8636 | 28 | 9 | 02/11/2026 a 10/11/2026 | 831 |
| Cotações | 6906 | 37 | 9 | 02/11/2026 a 10/11/2026 | 1.523 |
| Faturas por Cliente | 4924 | 52 | 13 | 29/10/2026 a 10/11/2026 | 6.984 |
| Fretes | 6389 | 114 | 9 | 02/11/2026 a 10/11/2026 | 4.879 |
| Inventário | 10633 | 26 | 9 | 02/11/2026 a 10/11/2026 | 15.446 |
| Localização de Cargas | 8656 | 26 | 9 | 02/11/2026 a 10/11/2026 | 4.314 |
| Manifestos | 6399 | 91 | 9 | 02/11/2026 a 10/11/2026 | 15.006 |
| Ocorrências | 12072 | 20 | 9 | 02/11/2026 a 10/11/2026 | 39.094 |
| Sinistros | 6392 | 44 | 9 | 02/11/2026 a 10/11/2026 | 9 |

São linhas de relatórios, não uma soma de negócios distintos. O recorte de 02 a 09/11 comparado com os Excel em 0768 não inclui 10/11; os totais acima mostram a cobertura corrente da base. A carga de 90 dias não foi executada nesta etapa e continua reservada à execução manual do responsável.

**Escopo do dashboard:** Consolidação Detalhada (11067) e Ocorrências (12072) continuam recebidas e armazenadas no V2, sem telas próprias, rotas novas ou indicadores novos no dashboard por enquanto. A troca cobre as telas que já existem e as fontes de que elas dependem.

## O que precisa substituir o V1

Todos os nomes abaixo são consultados hoje no portal ou fazem parte da sua interface SQL. Para cada um, o destino planejado é `ETL_SISTEMA_V2.pub.<mesmo nome>`. A matriz 0769 registra coluna por coluna, metadados atuais, candidatos anteriores, dependências físicas e referências estáticas no Java. A ausência desses objetos não deve ser contornada com valores vazios, cópia do V1 ou leitura direta dos arquivos brutos.

| Objeto consultado em `DASHBOARDS.dbo` | Colunas | Área dependente | Destino V2 |
| --- | ---: | --- | --- |
| `dim_calendario` | 19 | Calendário de competências e dias úteis | Publicado e testado com JDBC |
| `fato_fretes_faturamento` | 83 | Faturamento e elegibilidade de Fretes | Ausente |
| `fato_gestao_vista_coletores` | 21 | Gestão à Vista: coletores e cubagem | Ausente |
| `fato_gestao_vista_faturas` | 54 | Faturas por Cliente e indicadores financeiros | Ausente |
| `fato_gestao_vista_fretes` | 54 | Gestão à Vista: Fretes e cubagem | Ausente |
| `log_extracoes` | 9 | Auditoria e Saúde do ETL | Ausente |
| `raster_viagem_paradas` | 25 | Raster: paradas e horários de corte | Ausente |
| `raster_viagens` | 33 | Raster: viagens e horários de corte | Ausente |
| `vw_bi_monitoramento` | 9 | Saúde do ETL e atualização das fontes | Ausente |
| `vw_coletas_powerbi` | 41 | Coletas: indicadores, detalhe e exportação | Ausente |
| `vw_contas_a_pagar_powerbi` | 31 | Contas a Pagar: emissão, pagamentos e conciliação | Ausente |
| `vw_cotacoes_powerbi` | 54 | Cotações: conversão, descontos e tarifas | Publicado e testado com JDBC |
| `vw_dim_clientes` | 1 | Dimensão de clientes e filtros | Ausente |
| `vw_dim_filiais` | 2 | Dimensão de filiais e escopo de acesso | Publicado e testado com JDBC |
| `vw_dim_motoristas` | 2 | Dimensão de motoristas e filtros | Publicado e testado com JDBC |
| `vw_dim_planocontas` | 3 | Dimensão de planos de contas | Publicado e testado com JDBC |
| `vw_dim_usuarios` | 3 | Dimensão de usuários da operação; distinta do cadastro do portal | Ausente |
| `vw_dim_veiculos` | 4 | Dimensão de veículos e frota | Publicado e testado com JDBC |
| `vw_fato_manifestos_dash` | 106 | Manifestos: fato de competência operacional | Ausente |
| `vw_faturas_por_cliente_powerbi` | 42 | Faturas: detalhe e contratos auxiliares | Ausente |
| `vw_fretes_powerbi` | 123 | Fretes operacionais e Performance | Ausente |
| `vw_inventario_powerbi` | 34 | Inventário: detalhe e apoio aos indicadores | Ausente |
| `vw_localizacao_cargas_powerbi` | 29 | Tracking e exportação do Localizador | Ausente |
| `vw_manifestos_powerbi` | 105 | Manifestos: projeção operacional | Ausente |
| `vw_raster_sm_transit_time` | 37 | Raster: tempos de trânsito | Ausente |
| `vw_sinistros_powerbi` | 34 | Sinistros e indenizações | Publicado e testado com JDBC |

## Ordem da adaptação e testes de aceite

1. **Publicar o dado de negócio no repositório do ETL.** Definir, por contrato, a granularidade, chaves, seleção da última carga íntegra por origem e data, atualizações, exclusões e referências. Manter a última publicação válida quando uma carga falhar. O portal deve continuar lendo só a interface publicada. Conservação de multiplicidade nos relatórios de origem não determina, sozinha, a deduplicação de cada indicador.
2. **Fechar as dependências que não vêm dos 11 relatórios.** Calendário e competência financeira; cadastro e escopo de filiais; dimensões de clientes, motoristas, veículos, usuários e plano de contas; auditoria operacional; Raster (fonte própria). `DASHBOARDS` continua dono de usuários do portal, permissões, sessões, metas, justificativas e configurações. Integrações via satélite têm contrato próprio. As rotinas V1 de materialização e publicação precisam de substituto ou remoção ordenada.
3. **Conferir as regras que podem mudar um número.** Coletas: ID, filial, cancelamento e datas de solicitação/serviço. Fretes: separar faturamento e performance, elegibilidade, cancelamentos e previsão/finalização. Faturas: documentos, valores, competência, aging e snapshot. Manifestos: saída ou criação, composição e frota. Cotações: conversão e tarifas. Contas a Pagar: emissão, liquidação, alocação e conciliação exata. Tracking: status e filial. Sinistros/Inventário: grão e totais. Os campos da Consolidação e de Ocorrências não devem alterar os indicadores existentes por inferência; suas telas ou usos precisam de contrato próprio.
4. **Validar no SQL com dados reais antes de alterar o consumidor.** Descrever os 26 destinos e comparar os 958 contratos de coluna com a matriz. Medir tipos, escala, nulos, datas/fuso, status, filial, multiplicidades e totais por período. Comparar um intervalo já coberto e fechado usando as mesmas datas, o mesmo escopo e a mesma referência de captura. Para Coletas/Fretes, a fonte principal mudou de GraphQL para Data Export: classificar diferenças por origem ou regra e comparar com a evidência do ESL. Ausência de cobertura precisa ser distinguida de dia consultado com zero linhas. Repetição e falha devem preservar a publicação válida e não somar histórico.
5. **Ensaiar o dashboard em ambiente isolado.** Usar `DASHBOARDS_DEV`, credencial de leitura da publicação e conexão sem dependência de `ETL_SISTEMA`. Comparar SQL → API → tela → exportação, inclusive perfis com e sem acesso, filiais autorizadas, período padrão (último mês), filtros, paginação, ordenação, somas, horários e indicadores com seus dicionários. A cobertura deve comportar esse período e as dependências históricas do cálculo. Documentar e resolver divergências relevantes antes de aprovar a troca.
6. **Trocar e aposentar em etapas.** Só após os testes, preparar a migration Flyway dos 26 nomes no banco do portal e a paridade de criação do schema. Ensaiar troca e retorno; comprovar que as telas não fazem consultas residuais ao V1. Verificar também outros consumidores, jobs, serviços, integrações e rotinas de publicação antes de desligar o ETL antigo. A varredura de fonte encontrou scripts V1 de publicação para o dashboard e de reprocessamento de Manifestos; a execução atual de outros consumidores ainda não foi inventariada. O operador humano executa a implantação de produção e conserva o retorno até validar a nova rotina.

O ensaio de troca e retorno depende dos destinos restantes, das referências e da cobertura do período. O Flyway do portal permanece na versão 069, com as rotas atuais preservadas.
