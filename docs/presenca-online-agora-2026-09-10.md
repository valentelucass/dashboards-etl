# Presença atual e abertura dos detalhes — 10/09/2026

## Diagnóstico

O indicador anterior tratava qualquer requisição autenticada nos últimos 15
minutos como presença online. Isso incluía chamadas automáticas. O texto
“Ativo há 12 min” mostrava o tempo desde a última atividade registrada, e não
o tempo conectado. Reiniciar a aplicação não apaga esses registros no banco.

A leitura somente de agregados em produção, às 20:41–20:42 BRT, confirmou a
V069 disponível e a inconsistência. Das 42 contas ativas, três tinham atividade
HTTP nos últimos 15 minutos, incluindo o operador. Na leitura conjunta, nenhuma
tinha página em foco com pulso válido nos últimos 75 segundos; duas estavam na
faixa de cinco a 15 minutos desde a atividade. Não houve horário futuro nessa
amostra. Os processos Dashboard observados no PM2 haviam iniciado às 20:05:13.
Evidência sanitizada em `.tmp/presenca-online-20260910/producao-*.log`.
Nenhuma identidade, token ou conteúdo da navegação foi extraído para o relatório.

Também havia duas fontes diferentes na tela: o resumo atualizava a cada 30
segundos, enquanto recentes e rota vinham da lista administrativa em cache.
Uma falha de atualização mantinha os dados antigos aparentando presença atual.
O detalhe individual abria por hover e foco; o foco automático do popup externo
podia abrir outro popup, e o retorno do foco ao fechar podia reabri-lo.

## Comportamento corrigido

- Online exige conta ativa, página em foco e pulso entre agora e 75 segundos
  atrás, pelo relógio do SQL Server. A própria conta é excluída do KPI e das
  listas. Horários futuros, ausência de pulso, blur e expiração não dão presença.
- A fonte é `acesso.usuario_navegacao_dia`, já alimentada a cada 30 segundos.
  Requisições HTTP genéricas permanecem como registro de atividade, mas não
  sustentam presença. Reinício não limpa histórico nem força logout.
- Resumo, rota atual e até 12 recentes vêm na consulta leve de presença,
  atualizada a cada 15 segundos e ao recuperar foco/conexão. A configuração
  global desativava a atualização ao voltar à aba; essa consulta a habilita.
  Recentes deixam de depender da lista de
  permissões em cache. A tabela também acompanha esse resumo; a própria conta
  aparece como “Sua conta”. Em falha, a tela informa indisponibilidade.
- “Último sinal há…” explicita a idade do pulso. A estimativa indica a página
  em foco, sem provar atenção humana ou conexão contínua. Sem comunicação,
  expira em 75 segundos e aparece na consulta seguinte: não é instantânea.
- Detalhes individuais abrem somente por clique ou ativação do botão com
  Enter/Espaço. Hover e simples foco não abrem nada. Fechamento por botão,
  Escape, clique externo ou novo clique segue o comportamento do Popover.
  O painel principal limita a altura disponível e permite rolagem em telas pequenas.
  O detalhe individual abre acima/abaixo, com ajuste horizontal à tela: a posição
  lateral anterior ultrapassava a borda em 390px, mesmo após remover o hover.
- O histórico de hoje, a autorização da conta suprema, a separação por pessoa,
  a paginação e o cancelamento das consultas foram preservados. O timer de
  mudança do dia só roda enquanto o detalhe está aberto.

## Validação

- Qualidade completa inicial: 703 testes backend e 356 frontend aprovados, TypeScript,
  lint sem avisos, encoding, configuração de produção e builds isolados.
  Relatório: `.tmp/quality/20260910-205042-1e66a9/summary.json`.
- Revisão final de interface: 358 testes frontend aprovados, TypeScript, lint,
  encoding, ambiente e build aprovados novamente, após corrigir o posicionamento
  mobile e a atualização ao voltar à aba. Nove testes direcionados exercitam
  clique, foco, blur, relógio, polling e recuperação de falha. Evidências em
  `.tmp/presenca-online-20260910/frontend-final/`. Não somar testes sobrepostos.
- SQL Server: 23 cenários aprovados exclusivamente com tabelas temporárias e
  dados sintéticos em `DASHBOARDS_DEV`. Incluem a fronteira exata de 75 segundos,
  75,001 segundos, atividade HTTP sem pulso, blur, pulso futuro, retorno após
  expiração, exclusão do operador/inativos e paridade das quatro consultas.
  Evidência: `.tmp/presenca-online-20260910/sql-dev/presenca-sql.log`.
- Navegador: 59 verificações aprovadas em 390×740, 1265×768 e 1920×768, nos temas
  claro/escuro, usando APIs artificiais e navegador/portas isolados. Hover e foco
  não abrem a trilha; Enter e clique abrem, Escape/fechamento não reabrem,
  paginação funciona, popups cabem na tela, recentes atualizam com a consulta e
  erro remove a apresentação de presença antiga. Nenhuma exceção JavaScript.
  `frontend/.tmp/presenca-online-audit/summary.json` e capturas no mesmo diretório.
- A rodada visual anterior identificou duas falhas reais de posição em 390px,
  preservadas em `frontend/.tmp/presenca-online-audit/attempt3/`. A mudança da
  posição lateral para acima/abaixo resolveu ambas na rodada final. Duas
  tentativas iniciais corrigiram escape de seletor e envio de Enter do próprio
  harness; logs preservados, sem atribuí-las ao produto.
- Diff próprio dos arquivos existentes: `.tmp/presenca-online-20260910/diff-presenca.patch`;
  teste adicional versionado em `frontend/src/hooks/queries/useAdminAcesso.presenca.test.tsx`.

## Pacotes preparados

- API: `backend/target/quality/20260910-205042-1e66a9/dashboard-api-1.0.0.jar`.
  SHA-256: `D5337D7047581849559EF0C6D4208D895A9DC1C38B6DC9748DCB0773DDC70E78`.
- Frontend: `frontend/.tmp/quality-build/20260910-presenca-final/dist`.

A correção usa a estrutura V069 existente, sem nova migration. Os pacotes
incluem as alterações anteriores do workspace. A publicação deve atualizar API
e frontend em conjunto; conferir presença e navegação autenticadas depois.
Os arquivos operacionais foram preservados pela qualidade. Nenhum serviço ou
porta de produção foi gerenciado nesta rodada: o `CONTEXTO_GLOBAL.md`, seção 5,
reserva o controle de runtime ao operador humano.
