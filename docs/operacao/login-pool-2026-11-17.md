# Falha intermitente no login — 17/11/2026

## Diagnóstico comprovado

A mensagem `Instabilidade no servidor. Tente novamente em alguns instantes.` vem de `frontend/src/utils/apiError.ts`: qualquer resposta HTTP 503 é apresentada assim. A API converte falhas de conexão/transação SQL em 503 no `ManipuladorGlobalExcecoes`. Não significa senha incorreta.

Às 19:27–19:28 BRT, testes sem cookies ou contas reais observaram:

| Chamada | Resposta | Tempo |
| --- | --- | --- |
| UI local / portal público | 200 / 200 | 142 / 250 ms |
| Readiness local | 200 | 10 ms |
| `/api/auth/me`, sem token | 401 | 4 ms |
| `/api/auth/refresh`, sem cookie | 503 | 10.056 ms |
| `/api/auth/login`, conta inexistente de diagnóstico, local | 503 | 10.017 ms |
| Mesmo login pelo domínio público da API | 503 | 14.321 ms |

Os três 503 tinham o JSON `Serviço de dados temporariamente indisponível.`. O público passou pelo Cloudflare (Ray `a5c22aa2c9f09417-UDI`) e coincidiu com a exceção da API. O login falhou no acesso a `JdbcRateLimitBucketStore.consultar`, antes da validação da senha. O refresh falhou ao abrir a transação. O pool aguardou 10 segundos e lançou `SQLTransientConnectionException`. Foram encontrados 22 erros de login/refresh desse tipo entre 19:13:12 e 19:38:45 na coleta, além de falhas de outras rotas.

O dump de threads do PID 22120 mostrou dez requisições aguardando o SQL: nove em `PerformanceDashboardSqlRepository` (overview, série e status) e uma em `ColetasAgregadosSqlRepository.buscarStatusDistribuicao`. A fotografia SQL confirmou as dez conexões ocupadas, sem transações abertas. Sete consultas esperavam `RESOURCE_SEMAPHORE`; três tinham grants e esperas de paralelismo `CXSYNC_PORT`. As requisições já duravam mais de 15 minutos na primeira observação.

Cada consulta solicitava aproximadamente 1,43 GiB para execução. Três receberam cerca de 4,29 GiB somados, deixando aproximadamente 1,32 GiB disponíveis no semáforo principal, insuficientes para a próxima solicitação. A VM tinha memória física disponível: a restrição imediata era o orçamento do SQL e o pool compartilhado da API, não falta de RAM física ou evidência de heap Java esgotado.

O log atual do Cloudflare registrou cancelamentos pelo cliente em chamadas da API, incluindo login às 19:21:14 BRT. Não registra respostas individuais completas nem permite atribuir todos os incidentes históricos. A reprodução local e pública comprova a origem na API para o incidente medido. UI estática e readiness saudáveis não demonstram disponibilidade da autenticação dependente do banco.

V071 foi aplicada com sucesso às 18:26:44, redirecionando os 26 contratos analíticos. Após a troca há timeouts JPA às 18:41:51 e, depois, saturação por consultas JDBC. A configuração existente de 30 segundos é de JPA; não limita `JdbcTemplate` ou `NamedParameterJdbcTemplate`. A sequência temporal e as consultas ativas comprovam a saturação; não isolam qual mudança de plano, cardinalidade ou conteúdo do ETL causou a duração excessiva. Otimizar as publicações do ETL exige trabalho no repositório proprietário e validação de planos/paridade.

## Proteção preparada no código

- `spring.jdbc.template.query-timeout=30s` aplica prazo também aos statements JDBC usados por Performance e Coletas, alinhado ao prazo JPA já existente.
- Um interceptor MVC limita globalmente por instância as leituras de `/api/painel/**` e `/api/dimensoes/**` a três requisições. O limite efetivo respeita o tamanho configurado do pool e deixa margem de pelo menos duas conexões em relação a esse trabalho analítico. Isso não é uma reserva exclusiva de conexões contra todas as demais rotas.
- Excesso recebe 503 com `Retry-After: 2`, antes de executar o controller. Login, refresh, sessão, administração e mutações não entram nessa fila. Os filtros de autenticação, autorização e rate limit permanecem ativos.
- Exportações assíncronas conservam a vaga enquanto seu trabalho continua, inclusive quando a requisição HTTP termina antes. Conclusão e erro liberam uma única vez. As rotas assíncronas atuais usam `StreamingResponseBody`/Callable.

Testes em checkout isolado de `65eaefe` mais esta correção: 717 testes, 97 classes, zero falhas/erros/ignorados. Incluem configuração YAML real e `setQueryTimeout(30)` no statement com parâmetros nomeados; três consultas bloqueadas mantendo conexões reais Hikari/H2 enquanto login/refresh/me de fixture continuam; excesso recusado; recuperação após erro e término; exportação assíncrona ainda ocupada após conclusão HTTP. Os testes de autenticação e segurança existentes também passaram. Não houve carga analítica de teste em produção nem autenticação com conta real.

## Limites da VM revistos a pedido do responsável

A expansão de 32 para 64 GiB foi confirmada: 63,99 GiB físicos, aproximadamente 35,7 GiB disponíveis antes da revisão.

| Limite | Antes | Depois / situação |
| --- | --- | --- |
| Teto de memória SQL | 8 GiB | 16 GiB, efetivo, sem reinício |
| Mínimo SQL | 4 GiB | 4 GiB, preservado; não é reserva exclusiva |
| Tarefas pesadas protegidas | 1 | Até 2 simultâneas |
| Memória por tarefa e descendentes | 2 GiB | Até 4 GiB compartilhados pela árvore |
| Margem livre na partida | 4 GiB antes da tarefa | Memória para a tarefa mais 8 GiB de margem |
| Comprometimento máximo na partida | 85% | 85%, preservado |
| Duração padrão de tarefa protegida | 120 min | 120 min, preservado |
| Heap máximo da API | 384 MiB | Preservado; não representa toda a memória do processo Java |
| Pool SQL efetivo da API | 10 conexões | Preservado; o YAML tem 40, mas o runtime limita a 10 |
| Espera por conexão da API | 10 s | Preservada |
| Prazo de consulta JPA / JDBC | 30 s / sem prazo do template | 30 s / 30 s após instalar o candidato |
| Leituras analíticas simultâneas no servidor | Sem limite global | Até 3 após instalar o candidato |

Após elevar o teto SQL para 16 GiB, sete consultas receberam memória e três continuaram esperando. O responsável relatou retorno do login, seguido de lentidão e novos avisos de instabilidade. A nova fotografia confirmou novamente dez conexões ocupadas, incluindo consultas recém-admitidas. Trata-se de recuperação intermitente, não resolução. A capacidade adicional não substitui o controle de duração/concorrência.

A proteção compartilhada mantém a trava antiga como primeira vaga: processos já em andamento contam e conservam suas quotas anteriores. A segunda vaga foi usada pelos testes; uma terceira tentativa foi recusada. O recibo confirmou limite Windows de 4.294.967.296 bytes para tarefa/processo, pico do primeiro ensaio de aproximadamente 1,32 GiB e nenhum timeout. Não houve alocação artificial de 4 GiB.

Arquivos compartilhados revistos: `.runtime/memory-control/Executar-Batch.ps1`, seu README e `../AGENTS.md`. Backups em `.runtime/memory-control/backups/20261117-64gb`. O controle de processos Windows não foi reescrito. O SQL preservou versão 16.0.1000.6, edição, mínimo, paralelismo e configuração anterior de opções avançadas. A mudança de teto não exige restart. Reversão do teto: reabrir temporariamente opções avançadas se necessário, executar `sp_configure 'max server memory (MB)', 8192; RECONFIGURE`, e restaurar a visibilidade anterior.

## Instalação e limites da evidência

O processo produtivo permaneceu PID 22120, iniciado às 10:33:32, e o JAR operacional manteve SHA-256 `48AA583FEA75FAD0959ACA34DBB6A9FE0DA94C4E9DBD5C485E940DE07B446919`. Não foram reiniciados processos, encerradas sessões, canceladas consultas, alterados synonyms/fontes nem executado `iniciar-prod.bat`.

A proteção de código depende de instalação pelo operador. Enquanto o JAR antigo executa, consultas JDBC já pendentes continuam sem receber retroativamente o novo prazo. Não se comprovou resolução do login em produção nem paridade/performance integral das consultas V2. O próximo aceite deve conferir autenticação real autorizada, navegação concorrente, cancelamento JDBC e pool no runtime atualizado.

Evidência sanitizada entregue no chat: `evidencias-login-e-limites.json`. Não contém credenciais, cookies, tokens, emails reais, linhas de negócio ou SQL integral. Logs brutos e dumps foram mantidos fora do Git. O pacote candidato usa o código do commit-base mais esta correção, preservando alterações anteriores não commitadas.

## Coletas e logout automático, 19:52–19:55 BRT

O resumo de Coletas para 01/11 a 17/11 entrou na API às 19:52:52. A captura de 19:54 encontrou dez consultas ocupando as dez conexões do processo de produção. Cinco de Coletas aguardavam memória de execução (`RESOURCE_SEMAPHORE`), com pedidos de cerca de 2,86 GiB por consulta. O diagnóstico Java identificou resumo, série, status e histórico. As outras cinco eram consultas de resumo de Performance, com 43 a 47 minutos de duração. O HTML público de `/coletas` respondeu 200. O Cloudflare registrou cancelamentos do resumo, série, status e presença. O preflight `OPTIONS` da presença respondeu 200 com a origem e os cabeçalhos esperados. O `PUT` de presença registra navegação à parte e não é aguardado para carregar Coletas. Não havia referência `file:///` no HTML público verificado, e a origem desse aviso do navegador segue indeterminada.

O navegador registrou três respostas 401 de Coletas após cerca de 20 s. O log da API confirma falta de conexão na consulta de permissões e no limitador de chamadas. Na versão em produção, o filtro engole a exceção de leitura das permissões e continua sem autenticação. Uma requisição posterior de refresh falhou no pool às 19:54:51, seguida de login às 19:54:52, logout às 19:55:01 e novo login às 19:55:10. O cliente atual chama logout remoto e limpa a sessão local quando o refresh falha, inclusive por indisponibilidade. O 503 do logout mostra que a revogação também não conseguiu abrir conexão. A captura não prova que todas as chamadas no intervalo vieram do mesmo navegador.

O filtro atualizado devolve 503 se o banco falhar na verificação de permissões. A requisição termina sem autorização, sem passar pelo controlador e sem tocar no cookie. Na interface, 503, 504 e ausência de resposta na renovação encerram a tentativa de consulta e preservam a sessão local. Se a renovação confirmar expiração, a sessão é encerrada pelo fluxo existente. A proteção anterior de três consultas simultâneas e prazo JDBC de 30 s faz parte do candidato da API. As consultas analíticas ainda precisam de revisão de planos para reduzir a duração.

Validação em checkout isolado: 718 testes de backend e 399 de frontend aprovados, além de tipos, lint dos arquivos alterados, encoding e builds. O teste da cadeia de segurança verificou JWT válido com falta de conexão, JSON 503 com CORS correto, controlador não chamado e cookie intacto. O teste do cliente cobriu requisições Coletas simultâneas quando o refresh recebe 503, 504 ou não responde. A fila termina sem logout. O processo produtivo continuou com o JAR anterior e o portal com o build `20261005-selia-integracao`. A publicação dos dois candidatos cabe ao operador.
