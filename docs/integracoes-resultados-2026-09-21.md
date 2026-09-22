# Integrações: confirmações, pendências e tentativas

Implementação autorizada e validada em 21/09/2026, limitada a Dashboards e Satélite TMS API. [Diagnóstico, política e alteração no Satélite](../../../satelite-tms-api/docs/integracoes-resultados-reprocessamento-2026-09-21.md).

## Comportamento entregue

Os gráficos diários e por integração mostram as primeiras confirmações confiáveis. A série antiga de falhas agrupava o último estado mutável e fazia as falhas mudarem de dia a cada reavaliação; ela foi retirada desses gráficos. A informação permanece no saldo atual por ação e na auditoria.

As pendências são separadas em processamento, nova tentativa, origem, confirmação, intervenção e conferência. Clicar numa quantidade abre documentos paginados pelo servidor, com motivo e horários conhecidos. Ausência de idade histórica ou programação é apresentada explicitamente. Os 702 comprovantes confirmados sem primeira data confiável continuam no tooltip, fora do saldo de envio e dos sucessos datados.

Nos ciclos, confirmações têm destaque e o estado documental é separado de falha técnica/interrupção. Um ciclo com sete comprovantes e sete XMLs confirmados, mais cinco retenções XML, aparece como **Finalizado com pendências**. As causas permanecem acessíveis em **Ver ocorrências do ciclo**. Os filtros usam o resultado calculado pelo Satélite, sem transformar um ciclo antigo de causa desconhecida em sucesso.

Avaliações e tentativas têm painel secundário. Repetições de envio são parte dos envios iniciados, não mais documentos. A medição detalhada começa quando o Satélite novo executar; os logs antigos não permitem reconstruir todas as tentativas. Consultas XML à origem e envios instrumentados abrangem Vedacit.

## Contrato e banco

O backend encaminha `indicadores-operacionais` e `pendencias-etapas` mantendo a autorização da página. A classificação, deduplicação, contagem e paginação pertencem ao SQL do Satélite; o Dashboard não acessa o banco operacional nem o ETL para esse painel. O contrato v2 continua disponível. Dicionários de KPI e gráficos foram atualizados junto das regras.

A V28 está aplicada somente em `SATELITE_TMS_AUDITORIA`, incluindo histórico imutável e agenda de reavaliação. Nenhuma migration nova é necessária no banco DASHBOARDS. As variáveis existentes bastam; o intervalo documental novo possui padrão de 30 minutos no Satélite. Aceites, pares NF-e/CT-e e timeouts continuam protegidos contra reenvio automático.

## Validação

- Satélite: 144 testes isolados com rede bloqueada; SQL real com 83 consultas JDBC e 44 consultas JPA, ambas somente leitura/rollback. As 36 categorias tiveram total e detalhe conferidos.
- Dashboard API: 704 testes, zero falhas/erros, Maven verify e pisos de cobertura aprovados.
- Dashboard frontend: 392 testes em 61 arquivos aprovados; TypeScript, ESLint, encoding, ambiente de produção e Vite aprovados.
- Edge isolado: componentes reais, CSS do build e transporte simulado, 1600/390 px, temas claro/escuro, detalhe funcional, três gráficos de 350 px e nenhum transbordamento/exceção. Agregados da consulta real; ciclo/documento demonstrativos.

Evidências: `.tmp/quality/20260921-221425-f79263/summary.json` preserva a primeira rodada, inclusive dois testes novos que inicialmente confundiam as opções do filtro com badges. A rodada final corrigida está em `frontend/.tmp/quality-build/20260921-221425-f79263/testes-finais.log`; o build final está em `build-final.log`. As evidências finais consolidadas estão em `validacao-final.json` no mesmo diretório.

Prévias locais: [confirmações](../frontend/.tmp/integracoes-v3/desktop.png), [pendências e ciclo](../frontend/.tmp/integracoes-v3/pendencias-desktop-dark.png) e [celular](../frontend/.tmp/integracoes-v3/pendencias-mobile-dark.png). Os arquivos `.tmp` não são versionados; o comportamento e os resultados permanecem registrados aqui.

## Pacotes preparados

| Componente | Candidato |
| --- | --- |
| Satélite | `satelite-tms-api/target/unit-tests/coverage-20260921-222111-935/satelite-0.0.1-SNAPSHOT.jar`, SHA-256 `B4389CC8C8E34C8B32E81497BDEAAA0FB38E85663CF0E9BA71ECCE8EAE6179D1`. |
| Dashboard API | `backend/target/quality/20260921-221425-f79263/dashboard-api-1.0.0.jar`, SHA-256 `F3D0A5234ADB28218398CD275C3627C8D0F6946389576DD79C07234A44F33762`. |
| Dashboard UI | `frontend/.tmp/quality-build/20260921-221425-f79263/dist`. |

Os pacotes operacionais e serviços em execução foram preservados. Para ativar, a ordem é V28 (já aplicada), Satélite API/worker, Dashboard API e UI. A instalação operacional e a administração humana dos processos ainda não ocorreram; `iniciar-prod.bat` e as portas produtivas não foram administrados nesta validação. Após a ativação, conferir as rotas v3 e o primeiro evento/ciclo natural sem provocar reenvios. Nenhum teste enviou documentos reais nem consultou ESL/SOAP.

