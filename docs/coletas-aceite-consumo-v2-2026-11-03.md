## Atualização0673 — auditoria Coletas3/3 concluída; consumo real pendente

As três semanas12–18/10,19–25/10e26/10–01/11/2026 passaram o conteúdo completo das31colunas, com associação dos valores por coleta, totais, multiplicidades e ausências: zero diferenças ou pendências nos pares aprovados. Foram4277linhas por lado/265174decisões de células, sem descartar informação adicional daAPI. Terceiro par Source0672-01/Excel1760924,1439linhas/1144coletas, gerados próximos em03/11às22:47–22:48BRT. Evidências e falhas anteriores estão preservadas no Checkpoint0673 do ETL e no aceiteRootfinal.

O consumo real do V2 pelo dashboard continua sem aprovação: manter as pendências de semântica/catálogo de status, exclusão/região/horário de publicação, tipo deVolumes, ponte/publicaçãoSQL e roundtrip/endpoints. Os52testes locais e o aceite dos18campos diretos são evidências anteriores, não foram repetidos nesta etapa. Não houve cargaSQL ou mudança de produção. V1 permanece pausado.

### Registros anteriores — histórico, sujeitos à atualização acima
# Coletas: aceite de consumo do ETL V2

Verificação em 03/11/2026. **O consumo real do V2 ainda não está aprovado.** A comparação completa do primeiro período, 19–25/10/2026, passou nas 31 colunas associadas por coleta, com multiplicidades preservadas. São **1 de 3 períodos** completos. Os 52 testes do contrato passaram, e os valores dos 18 campos com origem direta no Data Export passaram na verificação de tipos e limites. Isso não substitui a validação da publicação SQL, da semântica e dos resultados do painel.

Os Excel das outras duas semanas foram gerados e baixados pelo navegador interno, com filtro Data Solicitação e os demais filtros vazios: ESL1760627, 12–18/10/2026, gerado às 18:36, 1.277 linhas e 31 colunas; ESL1760628, 26/10–01/11/2026, gerado às 18:37, 1.431 linhas e 31 colunas. Ambos sem cache. Essas são contagens dos arquivos de referência, sem afirmar contagem Source ou igualdade de conteúdo. As cópias exatas foram preservadas em `Armazenamento-Projetos/dashboards-etl/coletas-next-weeks-excel0667-01`; as extrações e comparações desses períodos permanecem pendentes.

A leitura nativa dos dois novos Excel já concluiu sob Original, preservando células e estilos. A tentativa Source12–18 parou antes de qualquer HTTP: o produto5481 ainda fixa19–25/10 no construtor `ColetasWeeklyCurrentGate`, linha90. Caller e descriptor novos estavam em12–18. Main/Java falhou, embora o host Original tenha fechado com retorno0; isso não é captura aprovada. Todos os processos próprios encerraram, e o marcador de progresso zero foi reconciliado para856F/B4/slot0. Correção do produto em preparação, registrada no Checkpoint0668 do ETL. Nenhum erro429 ocorreu nessa tentativa e o login ESL está funcionando.

## Resultado conjunto do primeiro período

Aceite Root `root-acceptance-coletas-week-complete0667-01.json`, SHA-256 `B323905B9D0257AF402890B532979041C49BEE85A2EA6E06BB213AF8A6E42D96`: todas as 1.561 ocorrências de 1.155 coletas passaram na associação conjunta das 31 colunas, com zero diferenças ou pendências. Foram 96.782 decisões sobre células dos dois lados e 131 verificações do mecanismo, incluindo casos adversos de associação cruzada e multiplicidade. As chaves de comparação contêm os valores completos das tuplas, sem depender apenas de hashes ou da ordem das linhas. A representação numérica do Excel e sua exibição de datas possuem decisões qualificadas específicas desse par; não autorizam uma tolerância genérica para outros arquivos. Execução Original: retorno 0, 123.944 ms, pico 346.873.856 bytes, encerramento confirmado e estado restaurado. Escopo MAPPED/captura03/Excel16:05; não constitui publicação SQL nem aprovação de outros períodos.

## Validação dos tipos SQL consumidos

`ColetasViewContractValidator` agora confere as famílias de tipos das 21 colunas efetivamente consumidas, além de listar todas as ausentes. Colunas adicionais continuam permitidas. Recusa, por exemplo, peso em `FLOAT`/`REAL`, Volumes em `BIGINT` incompatível com `Integer`, datas como texto e flag de exclusão sem `BIT`. Essa consulta é de metadados; não comprova precisão/escala reais, valores publicados ou equivalência de negócio.

Validação: **48 testes do contrato e 4 do serviço**, zero falhas, erros ou ignorados; 432 fontes e 98 arquivos de teste compilados. Aceite `root-acceptance-dashboard-types0667-02.json`, SHA-256 `17ED59D94BA6FCA7AB904F4DCA4E46AFC4A803611F83245AD8445D063B0D8D30`. Original: 60.586 ms, pico 875.065.344 bytes, retorno 0. A tentativa 01 falhou por inicialização do mecanismo de mocks e excedeu o limite de memória; foi preservada e não integra o aceite. A rodada 02 ajustou somente as opções locais das JVMs, sem aumentar o limite de 1 GiB ou mudar a aplicação para contornar o teste. Mapa estrutural atualizado em execução serial: SHA-256 `64B68B93B3D8EBC5271C22F01D4078BEA35736B23BD3966400177E0DEE0C04C8`, 109.384 ms, pico 1.005.481.984 bytes. Nenhuma Source, SQL ou inicialização de produção nessas verificações.

## Evidência real utilizada

Captura Data Export 6908 `033b024b-d604-4210-9930-67106a1aba2c`, solicitação de 19 a 25/10/2026, encerrada às 16:04:37 BRT. Foram preservadas 1.561 ocorrências de 1.155 coletas. Excel ESL1760193 gerado às 16:05, sem cache, SHA-256 `EDD65AF4F47B87EF0BEBAE14A10E32B4E89DC90E70DB0FE9651DE2076EA36512`.

Uma auditoria offline percorreu todas as ocorrências da projeção MAPPED fechada. Verificou presença, tipo, datas civis, inteiros nos limites Java, textos em unidades UTF-16 e representabilidade exata em `DECIMAL(28,8)`. Os pesos/valores são textos decimais na origem e foram analisados como decimais exatos; nenhuma conversão para ponto flutuante, tolerância ou arredondamento foi usada nesta auditoria. NULL e ausência permaneceram distintos. Os 18 campos estavam presentes em todas as ocorrências, admitindo os nulos originais: **zero valores incompatíveis**. Nenhum desses 18 campos apresentou valores diferentes dentro da mesma coleta nesta captura.

Aceite privado: `C:/Users/suporte/Documents/Codex/2026-10-27/etl-v2-supervisor-finalizacao/outputs/root-acceptance-dashboard-direct-value-fit0666-02.json`, SHA-256 `392429190E7EB200BDC67BB3FB16160A19BEAF33128E489E6102017FD8318FF5`. Original: 3.126 ms, pico 64.249.856 bytes, retorno 0; processos encerrados e estado restaurado. Nenhuma requisição ESL, consulta SQL, carga ou inicialização de produção. A primeira tentativa parou no limite de tamanho do resumo e permanece preservada; o resultado aceito é o da tentativa 02.

## Mapa das 21 colunas consumidas

“Tipos conferidos” abaixo significa que os valores da captura cabem no contrato proposto. A equivalência de negócio e o roundtrip SQL continuam sujeitos aos aceites posteriores.

| Coluna do dashboard | Origem Data Export ou regra necessária | Tipo Java | Resultado da captura |
|---|---|---|---|
| ID | `id`, sem confundir chave com número da coleta | String | Inteiro de 64 bits conferido; representação final SQL/JPA pendente |
| Coleta | `sequence_code` | Long | Tipos conferidos |
| Solicitacao | `request_date` | LocalDate | Tipos conferidos, todas no intervalo |
| Agendamento | `service_date` | LocalDate | Tipos conferidos; 61 nulos preservados |
| Finalizacao | `finish_date` | LocalDate | Tipos conferidos; 147 nulos preservados |
| Status | `status`, catálogo de rótulos e regra de ausência | String | Texto conferido; catálogo canônico ainda precisa da correção qualificada |
| Excluída na Origem | Reconciliação completa, confirmação e reativação | Boolean | Pendente; não inferir exclusão de uma ausência no filtro semanal |
| Volumes | `invoices_volumes` | Integer | Limite de 32 bits conferido |
| Peso Real | `invoices_weight` | BigDecimal | Decimal exato conferido |
| Peso Taxado | `taxed_weight` | BigDecimal | Decimal exato conferido |
| Valor NF | `invoices_value` | BigDecimal | Decimal exato conferido |
| Numero Manifesto | `pck_mik_mft_sequence_code`; regra de vínculo e escolha para o painel | Long | Limite de 64 bits conferido; 204 nulos preservados; vínculo publicado pendente |
| Cliente | `pck_cor_nickname`; definir equivalência com o nome esperado no painel | String | Texto conferido; projeção atual usa complemento lateral |
| Cidade | `pck_pds_cty_name` | String | Tipos conferidos |
| UF | `pck_pds_cty_sae_code` | String | Tipos conferidos |
| Região da Coleta | `pck_prn_name`; confrontar regra já usada pelo consumidor | String | Texto conferido; 13 nulos preservados; projeção atual sintetiza cidade/UF |
| Região Logística | Referência governada por CEP/cidade/UF e vigência | String | Pendente; `pck_prn_drt_nickname` é filial responsável e não prova essa equivalência |
| Filial | `pck_crn_psn_nickname`, com vínculo governado para filtro e ACL | String | Texto conferido; vínculo da publicação pendente |
| Usuario | `pck_uer_name` | String | Tipos conferidos; 97 nulos preservados |
| Motivo Cancel. | `cancellation_reason` | String | Tipos conferidos; 1.522 nulos preservados |
| Data de extracao | Horário da captura/publicação com linhagem e zona explícitas | LocalDateTime | Pendente; não usar `updated_at` do negócio como horário da extração |

## Pendências encontradas no código atual

O consumidor lê `dbo.vw_coletas_powerbi`. A migration do dashboard `V027__substituir_wrappers_etl_por_synonyms.sql` aponta esse nome para a view do ETL existente. A projeção localizada no V2, `database/migrations/V091__project_analytic_collection_queries.sql`, publica `pub.analytic_lab_sql_03`, com filtros de referência e disposição `READY`. A ligação desse resultado ao consumidor não foi executada nem comprovada. A existência de dados da V1 nessa view não validaria a publicação da V2.

Na V091, `Cliente` vem de `l.customer_name`, `Filial` de `branch.raw_name`, `Numero Manifesto` de um vínculo com manifesto e `Região da Coleta` de cidade/UF. Esses caminhos precisam ser confrontados com a definição do consumidor e com o Data Export. A regra vigente da tarefa permite GraphQL somente para Usuários; complementos GraphQL de Coletas não podem ser considerados extrações autorizadas ou obrigatórias por causa dessa projeção.

O checkout canônico ainda contém `ColetaStatus` versão `coletas-status-v1`, com `finished` → `Finalizada`, e constraints correspondentes na V010. A correção privada previamente qualificada para o rótulo da ESL não equivale à sua incorporação nessa camada. Isso deve ser resolvido no ETL, com compatibilidade do catálogo SQL e sem alterar fórmulas do dashboard para esconder a diferença.

As 1.561 ocorrências precisam continuar preservadas na extração/auditoria. A publicação do painel deve respeitar sua granularidade por coleta e a regra de manifesto, sem multiplicar somas. A igualdade dos 18 campos dentro de cada coleta nesta captura é uma evidência favorável, mas não substitui a prova da publicação e de todas as associações.

## Critérios restantes para liberar consumo

1. Incorporar as correções qualificadas do catálogo e resolver as regras de Cliente, Filial, Região da Coleta e manifesto.
2. Comprovar região logística, exclusão na origem e horário da extração com suas referências e linhagem.
3. Validar publicação V2, os 21 nomes/tipos SQL, a granularidade e a ponte de consumo, sem substituir dados de produção durante a auditoria. A publicação deve entregar Volumes compatível com `Integer`; não basta a extração caber nesse intervalo se a view continua declarando `BIGINT`.
4. Conferir valores, nulos, precisão, identidade, filtros e totais após o roundtrip SQL e nos endpoints reais de tabela, exportação, indicadores e gráficos.
5. Concluir os dois períodos adicionais, chegando a três distintos 100% comparados conforme a regra do usuário. Os Excel já estão baixados; as capturas Source e a igualdade de conteúdo desses dois períodos ainda não estão aprovadas.

Colunas adicionais retornadas pela API são permitidas e preservadas. A aprovação depende de os campos comuns e os dados consumidos estarem corretos; não exige descartar informação extra nem tornar a quantidade de linhas físicas igual à quantidade de coletas do painel.


Atualização 20:10: a Source de Coletas12–18/10 concluiu1277registros/12HTTP200/terminalvazio, aceiteRootA34EC469. Excel1760627tem1277×31. Conteúdo ainda em comparação; leitoroffline parou por período19–25fixo e está sendo corrigido sem novaAPI. Progresso1/3;52testeslocais não representam consumoSQLreal. V1 e produção preservados.


Coletas2/3períodos aprovados:12–18/10 concluiu31colunas/1277registros/937coletas,zero diferenças conjuntas/totais/multiplicidades;aceiteRoot5982CC27com recuperação pós-validação explícita. Terceira26/10–01/11 emcaptura. A publicação e o consumo real das21colunas do dashboard continuam pendentes;52testeslocais não demonstram roundtripSQLreal.


Atualização0670: Coletas2/3períodos integralmente aprovados nas31colunas (19–25/10 e12–18/10). Terceira26/10–01/11 extraída1439registros/todosrequest_dates dentro da semana; Excel anterior1431, referência atualizada aguarda loginESL. Nada de reprovação automática por contagem ou por colunasextras. Consumo/publicação real continua pendente;52testeslocaisPASS. Ver checkpoint0670no ETLV2.
