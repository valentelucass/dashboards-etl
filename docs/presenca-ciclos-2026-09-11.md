# Presença, acessos por página e atualização de ciclos — 11/09/2026

## Diagnóstico confirmado

O Satélite reiniciou às 19:30, mas API e worker continuavam apontando para
`target/satelite-0.0.1-SNAPSHOT.jar`, SHA-256 `5FDE1735...`, anterior à publicação
de progresso. A leitura direta de `/api/auditoria/vedacit-sftp/clientes` às
19:58 retornou o ciclo concluído às 16:53:30, sem `atualizadoEm`. O novo JAR
`4FD9D952...` estava somente em `target/progresso-ciclos-20260911/`.
Reiniciar o mesmo arquivo antigo não instala o candidato.

O frontend operacional já era o build `20260911213826`, iniciado às 18:40,
e anunciava atualização por minuto. A API Dashboard operacional era `F8C6CAF3...`.
Portanto, nesta ocorrência a falta de parciais é comprovada na origem.
As colunas da V23 foram reconferidas em leitura às 20:18, exclusivamente em
`SATELITE_TMS_AUDITORIA`; não há migration pendente para esta publicação.

Na presença, a perda/retomada de foco fragmentava a mesma página em várias
linhas. Em leitura agregada de produção às 20:12, havia 317 trechos para 40
combinações de pessoa/página; 28 combinações tinham repetição, com máximo de
96 trechos numa mesma página. Havia uma conta com foco recente entre as 42
ativas, incluindo o operador na amostra. Isso não prova que o zero da captura
era incorreto: a tela exclui o próprio operador e exige foco recente.
Nenhuma identidade foi extraída para o diagnóstico.

Também foram identificados: fluxo recriado e requisições abortadas em cada
rota; `pagehide` dependendo do foco ainda informado pelo navegador; saída com
falha sem nova tentativa enquanto oculta; pulsos antigos em espera capazes de
registrar foco já perdido; arredondamento por fronteira de segundo; recentes
misturando sinais de foco com atividade HTTP; leituras de contagem/listas em
instantes diferentes; histórico antigo permanecendo visível depois de erro.

## Mudanças

- O fluxo e a fila de envio sobrevivem às mudanças de rota. A saída é enviada
  explicitamente no `pagehide`; a restauração da página e a conexão retomam o
  sinal. Uma saída que falhar é tentada novamente. Pulsos em espera de páginas
  já deixadas são descartados. Encerrar a identidade cancela suas requisições.
- SQL acumula milissegundos entre sinais contínuos de até 75 segundos. Uma
  pausa confirmada ou ausência acima desse limite não acrescenta tempo. Os
  trechos históricos preservam a precisão original, sem reescrita retroativa.
- `/navegacao-dia` agrupa por rota antes de ordenar e paginar. `total` passa a
  contar páginas, `segundosTotal` soma o tempo por página e
  `agrupamento=PAGINA` identifica o contrato. As linhas mantêm `rota`, `inicio`,
  `fim`, `segundos`, `ordem` e acrescentam `trechos`. A autorização exclusiva
  da conta suprema e o limite ao dia de Brasília permanecem.
- Contagem, online e recentes compartilham relógio SQL e transação de leitura
  serializável. Recentes usam exclusivamente sinais de foco das últimas 24
  horas, com a página correspondente ao sinal, sem substituir por polling HTTP.
- O detalhe ocupa o próprio painel de presença. Há uma linha por página,
  primeiro/último sinal com segundos, tempo acumulado e retorno à lista com
  foco restaurado. O texto esclarece que o intervalo não é permanência contínua
  e que a própria conta está fora do indicador. Erro oculta resultados antigos.
- A tela de ciclos distingue hora da consulta e progresso na origem, explica
  respostas sem o contrato de parciais e retira previsões vencidas da posição
  de próximo horário. Datas do Satélite sem offset são interpretadas como
  Brasília mesmo em navegador configurado em UTC.
- Dicionário de KPIs atualizado. Não há alteração estrutural de banco.

## Validação

- 703 testes backend e 370 frontend aprovados; TypeScript, lint sem avisos,
  encoding, configuração e builds aprovados. Execução isolada
  `.tmp/quality/20260911-201231-cf7d75/summary.json`, com
  `operationalFilesPreserved=true`.
- 28 verificações SQL com dados sintéticos e tabelas temporárias exclusivamente
  em `DASHBOARDS_DEV`: agrupamento antes da paginação, pausas, frações de segundo,
  expiração, virada do dia, inativos e paridade entre contagem/listas.
  `.tmp/presenca-ciclos-20260911/sql/presenca-sql.log`.
- 56 verificações de presença no navegador, em 390/1265/1920px, claro/escuro:
  painel único, teclado, retorno, troca de pessoa, agrupamento, paginação,
  contrato antigo, falha/recuperação e polling. Sem exceções ou transbordamento.
  `frontend/.tmp/presenca-ciclos-audit/summary.json`.
- 12 cenários visuais de ciclos nas mesmas larguras/temas, com progresso atual
  e resposta antiga, incluindo navegador em UTC. Sem exceções ou transbordamento.
  `frontend/.tmp/presenca-ciclos-integracoes-visual/summary.json`.
- 569 classes/recursos do JAR Dashboard conferidos contra a compilação testada;
  H2 ausente do pacote. O Satélite conserva o candidato anteriormente validado:
  362 testes aprovados, três manuais ignorados e dois testes do runner após a
  limpeza de avisos, sem somar as rodadas sobrepostas.
- Os 59 arquivos do frontend reunido para publicação coincidem com o candidato;
  o servidor estático real iniciou em porta aleatória local e respondeu HTTP
  200 com HTML, header e metadados do mesmo build. Evidência em
  `.tmp/presenca-ciclos-20260911/static-validation.json`.

## Pacote publicado

Os três artefatos estão reunidos em `.tmp/publicacao-presenca-ciclos-20260911/`,
fora dos diretórios Maven que um `clean` remove:

| Artefato | Identificador |
| --- | --- |
| `dashboard-api-1.0.0.jar` | SHA-256 `EF3B1D7B1A0E1FEB6EB15718A3E7A1D64EA1AC1316DD88FD9A59F6F6E95BA4B6` |
| `satelite-0.0.1-SNAPSHOT.jar` | SHA-256 `4FD9D952C4982106B3CB27A717833F117FC5B095B7336E9D47307E22C7BE4A99` |
| `dist-prod/` | Build `2026-09-11T231757926Z`, com metadados e sem sourcemaps |

Fontes dos pacotes: `backend/target/quality/20260911-201231-cf7d75/` e
`frontend/.tmp/quality-build/20260911-201231-cf7d75/dist`; Satélite em
`../../satelite-tms-api/target/progresso-ciclos-20260911/`.

O usuário autorizou explicitamente a publicação completa, incluindo parada e
início dos quatro processos, como exceção nesta sessão ao controle humano
previsto nos AGENTS/contexto global. A instalação ocorreu em 11/09/2026 às
20:31:40 BRT, após confirmar os processos antigos encerrados e as portas livres.
Os dois JARs foram substituídos e conferidos pelos hashes acima; a UI foi
trocada junto da API Dashboard. Os arquivos anteriores estão preservados em
`.tmp/publicacao-presenca-ciclos-20260911/backup/`. Não houve nova migration.

Os cadastros e ambientes existentes do PM2 foram preservados. Após o início,
Dashboard API/UI ficaram nos PIDs 49108/7548; Satélite API/worker nos PIDs
45748/49776. A API DEV 5011 permaneceu no PID 26584. O servidor 5173 respondeu
HTTP 200 com o build novo; a API 5010 respondeu 401 à consulta anônima de sessão,
como esperado. Os avisos de inicialização do Dashboard sobre localização de
migrations, versão SQL Server/dialeto e colunas de Horário de Corte já constavam
no início anterior às 18:40; não impediram a inicialização desta publicação.

A API Satélite respondeu HTTP 200 e abriu o ciclo às 20:32:19.091, com término
nulo e `EM_EXECUCAO`. Às 20:35, a mesma execução já tinha `atualizadoEm` em
20:34:39.564 e passou de zero para uma avaliação XML/um erro. O histórico
filtrado por dia/status retornou essa única execução aberta. O log registrou
`ORIGEM_XML_HTTP_401`: a pendência externa de autorização do download XML
permanece; a publicação de progresso não é evidência de resolução dessa recusa.
O painel consulta a cada minuto com a aba aberta; os números avançam quando o
worker publica o resultado do turno, não a cada segundo ou chamada externa.

A consulta de acessos extraída do repositório foi executada em produção
somente em leitura, sem retornar identidade no diagnóstico: 15 páginas,
primeira página com dez linhas distintas representando 163 trechos, total de
3.876 segundos em foco. Nenhuma página duplicada no resultado. O histórico
existente não foi reescrito. O aceite HTTP autenticado de presença com outra
conta real não foi realizado; os testes SQL DEV e de navegador cobrem foco,
saída, retomada, agrupamento e tratamento de falhas.

Evidências de instalação, processos, HTTP, progresso e agrupamento ficam em
`.tmp/publicacao-presenca-ciclos-20260911/`. O primeiro ciclo ainda estava aberto
nesta conferência; seu fechamento não foi afirmado nem forçado. O ciclo que
rodava no JAR antigo não ganha progresso retrospectivo. Abas abertas antes da
publicação precisam ser recarregadas para executar o novo frontend.
