# Integrações separadas por etapa — 10/09/2026

## Diagnóstico após o reinício humano — 20:13 BRT

O HTTP 404 foi reproduzido diretamente no Satélite, em `127.0.0.1:19090`, para o novo endpoint e o período 01–10/09. O PM2 carrega `satelite-tms-api/target/satelite-0.0.1-SNAPSHOT.jar`, modificado em 09/09 às 23:30, SHA-256 `EBC700C71B264A50EC933FDD290B3761DBB915152420AE5D6626746ADB7F60E2`. A classe de controller desse pacote **não contém** `indicadores-etapas`. Reiniciar esse mesmo arquivo não incorpora as alterações do código.

Já a API Dashboard carrega `backend/target/dashboard-api-1.0.0.jar`, modificado em 10/09 às 20:03, SHA-256 `196D4E36F9594952AF93AA4D9725FDB000528451D364DF647A05D4EEB894BD02`, cuja classe de controller contém a rota nova. O GET local anônimo ao Dashboard retorna 401, como esperado para uma rota autenticada; o 404 autenticado foi informado pelo usuário. A dependência Satélite desatualizada está comprovada por inspeção do pacote e pelo GET direto, sem contornar a autenticação.

A pendência concreta é publicar o pacote Satélite já validado `target/indicadores-etapas-20260910/satelite-0.0.1-SNAPSHOT.jar` (hash `45CEF40A...`, completo abaixo), no lugar do pacote antigo referenciado pelo PM2. O operador deve coordenar a publicação considerando que API e worker compartilham esse arquivo, preservando o anterior para recuperação e conferindo o SHA-256 após a troca. A ativação do worker/XML continua sujeita à prévia e ao primeiro lote supervisionado documentados no Satélite. A validação final é obter HTTP 200/contrato versão 1 no Satélite e na sessão autenticada do Dashboard e conferir os gráficos separados. Essa validação operacional ainda não foi executada com o novo pacote.

O candidato antigo da API Dashboard listado na seção histórica de pacotes abaixo não existe mais após a compilação humana; não utilizá-lo como origem de cópia. O pacote operacional atual já contém a rota. Nenhum pacote operacional ou processo foi alterado nesta investigação. Evidência sanitizada: `satelite-tms-api/target/diagnostico-404-etapas-20260910/evidence.json`.

## Comportamento entregue

A tela deixa de copiar um total para XML e comprovantes. Agora possui:

- Confirmados de XML/dados e de comprovantes em cards e gráficos diários separados.
- Resultados por destino/etapa com contagens exatas de confirmados e falhas.
- Saldo atual de pendentes, bloqueados e casos sem confirmação datada/classificação em uma tabela própria.
- Datas de XML/dados, comprovante e última atualização na tabela de auditoria.

Um XML confirmado em agosto e um comprovante confirmado em setembro aparecem nos respectivos períodos. Os bloqueios não são removidos do saldo. As pendências atuais abrangem todas as datas, respeitando o destino selecionado; não são uma fotografia histórica do último dia do filtro. Uma nota pode ter duas etapas pendentes, portanto a soma não representa notas distintas.

O gráfico de Saúde que usava apenas o percentual de XML e o resumo que somava duas cópias de `totalRegistros` foram retirados dessa tela. Os ciclos SFTP e a tabela de auditoria permanecem disponíveis. O contrato antigo continua acessível para compatibilidade, mas não alimenta os novos indicadores.

## Contrato e critérios

O Satélite expõe `GET /api/auditoria/integracoes-clientes/indicadores-etapas`, com período obrigatório, destino opcional, versão 1, resumo por etapa e série diária. O Dashboard encaminha esse JSON por `/api/painel/integracoes/indicadores-etapas`, com a permissão já existente de Integrações. Não consulta ESL ou bancos de transporte diretamente.

`IntegracaoIndicadoresEtapasRepository` agrega no SQL Server os registros ativos. Cada etapa usa seu status explícito e sua própria data; não há fallback para o status geral. Sucessos sem data e status desconhecidos/ausentes ficam em conferência, sem virar envios. `IGNORADO` e `NAO_APLICAVEL` não contam como transmissões.

Vedacit deduplica XML por CT-e e comprovante pelo par NF-e/CT-e efetivo; outros destinos usam ocorrência. Quando existem cópias, uma confirmação datada prevalece sobre cópias pendentes, preservando a primeira data de confirmação disponível. Se não há sucesso datado, prevalece o registro mais recentemente atualizado. Identificação ausente preserva o log individual, sem agrupar documentos por suposição.

O contrato contabiliza resultados disponíveis no estado atual, e não um histórico completo de todas as tentativas: logs sobrescritos/arquivados não são reconstituídos, e uma divergência de recebimento remoto exige conciliação. O frontend completa apenas dias vazios e apresenta os agregados SQL. Resposta antiga/incompatível ou endpoint ausente gera indisponibilidade explícita, sem estimar números pelo contrato anterior.

Fórmulas, escopos, deduplicação, calendário e limites estão sincronizados nos novos verbetes de `kpiDictionary.ts` e `chartDictionary.ts`.

## Validação

- **Satélite: 42 testes direcionados aprovados**, incluindo 12 cenários SQL em H2 com as queries reais, filtros/contrato e contexto passivo com rede bloqueada. Cobrem XML antigo/comprovante novo, sucesso sem data, falha parcial, bloqueio, saldo anterior ao período, duas NF-es por CT-e, reconciliação, arquivamento, não aplicável e limites de datas. Saída: `satelite-tms-api/target/unit-tests/coverage-20260910-194501-359/`.
- **Dashboard: 703 testes backend e 355 frontend aprovados**; TypeScript, lint, encoding, configuração de produção e builds isolados aprovados. Evidência: `.tmp/quality/20260910-194135-307d4b/summary.json`, com `operationalFilesPreserved=true`.
- **SQL Server real somente leitura:** quatro statements, guarda contra escrita e rollback em `SATELITE_TMS_AUDITORIA`. Para 01–10/09, a nova regra retornou **0 XMLs e 267 comprovantes com confirmação datada**, além de três falhas de comprovante. Resumo e série diária coincidiram; o total XML também coincidiu com SQL independente. A contagem anterior de 269 comprovantes usava status/atualização geral; o novo número usa data própria e deduplicação. Evidência: `satelite-tms-api/target/indicadores-etapas-20260910/sql-readonly.json`.
- Saldo observado nessa leitura: XML com 777 bloqueios e 1.333 casos sem confirmação datada/classificação; comprovantes com um pendente, 835 bloqueios e 108 casos sem confirmação datada/classificação. São contagens por etapa e documento auditado, não os volumes das planilhas ou do inventário SFTP, e podem mudar com a operação.
- **Navegador:** oito cenários passaram, com APIs interceptadas usando os agregados sanitizados acima: 390/1265/1920px, claro/escuro, seleção PPG e endpoint indisponível. Três gráficos renderizados, saldo separado, nenhuma exceção JavaScript ou rolagem horizontal da página; a tabela possui rolagem própria em telas estreitas. Evidências e capturas em `frontend/.tmp/indicadores-etapas-audit/`.

## Pacotes para publicação conjunta

| Componente | Candidato |
|---|---|
| Frontend | `frontend/.tmp/quality-build/20260910-194135-307d4b/dist` |
| API Dashboard | `backend/target/quality/20260910-194135-307d4b/dashboard-api-1.0.0.jar` |
| Satélite | `../../satelite-tms-api/target/indicadores-etapas-20260910/satelite-0.0.1-SNAPSHOT.jar` |

SHA-256 da API Dashboard: `A17471C4223E90F577FA1083CBA5DFBC41A43CDB4C2C0FBAB7ECE0D9AE09DECF`.

SHA-256 do Satélite: `45CEF40A497725004A4F141C7E42DF34AD83C809A41A438B817EDF12579ED550`. Seus 1.249 arquivos de aplicação coincidem com a saída testada; H2 é dependência exclusiva dos testes e não está no JAR. Inclui as correções Vedacit previamente preparadas. Evidências em `target/indicadores-etapas-20260910/package-verification.json` no Satélite.

Não há migration, alteração de credencial, reset de cursor ou ajuste de status histórico nesta mudança. Os pacotes anteriores foram preservados. O JAR operacional do Satélite permanece `EBC700C7...`; nenhuma API/worker operacional ou porta de produção foi iniciada, interrompida ou reiniciada.

A publicação deve ser conduzida pelo operador: disponibilizar primeiro as APIs com o novo endpoint e depois a interface. O `CONTEXTO_GLOBAL.md`, seção 5, determina: “O controle de runtime pertence exclusivamente ao humano.” As flags e a ativação do worker para recuperação dos XMLs continuam sendo a etapa operacional documentada no Satélite; atualizar a visualização não executa recuperação nem confirma recebimentos remotos.
