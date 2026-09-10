# Refinos de interface e presença — 10/09/2026

Os seis itens solicitados estão implementados:

1. `LayoutPainel`: versão/data fica junto ao copyright, à esquerda, com divisor vertical. Créditos e suporte permanecem à direita no desktop; os grupos quebram no mobile.
2. `TopNav`: o drawer contém navegação, fechamento e saída. Foram retirados logo, título visível, nome, perfil/setor/e-mail e sino redundantes. O diálogo mantém nome acessível e controle de foco.
3. Curtidas: o botão e os corações ficam acima do balão com os nomes, inclusive durante a animação, sem bloquear sua leitura.
4. Presença: contagem e lista SQL consideram outras contas ativas com atividade nos últimos 15 minutos, excluindo o operador autenticado por login/e-mail. A lista de vistos recentemente também omite a própria conta e contas inativas. O KPI está documentado em `kpiDictionary.ts` e integrado a `TooltipKpi`.
5. Cotações: Visão Analítica é a abertura padrão. Os quatro botões têm bordas e seleção preenchida; setas, Home e End alternam a seleção pelo teclado. Abaixo de 768px, as ações usam uma linha própria na barra, sem alterar as demais páginas.
6. Destaques de Cotações: as quatro colunas distribuem largura pelo conteúdo com `minmax(0, auto)`. Textos curtos recebem o espaço necessário e nomes longos aproveitam o restante. Quando o conjunto excede a largura, o truncamento preserva o texto integral no título. Regras e valores dos destaques não mudaram.

## Trilha do dia

- `PUT /api/sessao/presenca`: a identidade vem do JWT; o corpo aceita somente rota conhecida, visibilidade e identificador do fluxo. Filtros, documentos, URLs externas, duração informada pelo cliente e conteúdo das páginas não são registrados.
- `usePresencaNavegacao` confirma a página em foco a cada 30 segundos e nos eventos de foco/visibilidade. A perda de foco encerra o trecho; troca de rota ou identidade cancela chamadas antigas. Um identificador por fluxo impede que o blur atrasado de outra aba encerre a aba ativa.
- `NavegacaoDiaSqlRepository` calcula as durações e mantém os trechos em SQL Server. Intervalos acima de 75 segundos sem confirmação não são somados. O lock transacional por usuário serializa os pulsos, e pulsos no mesmo instante não duplicam duração. A estimativa mede permanência com a página em foco; não mede atenção humana. Sem novo pulso, não há extrapolação até o horário da consulta.
- `GET /api/admin/acesso/usuarios/{usuarioId}/navegacao-dia?pagina=0` retorna exclusivamente o dia atual de Brasília, com ordenação por acesso mais recente, contagem e paginação SQL de dez itens. Consulta restrita à conta suprema já configurada, além da autorização administrativa. O serviço verifica novamente essa identidade.
- `PresenceHistory` abre sobre cada pessoa por hover, foco ou clique. Exibe página, intervalo e duração, com estados de carregamento, vazio e erro. O cache é separado por pessoa/dia/página e descartado quando não utilizado; respostas de outro dia não são apresentadas.
- A V069 cria `acesso.usuario_navegacao_dia`, uma linha reutilizável por usuário. É estado transitório da sessão, separado da auditoria administrativa. À meia-noite de Brasília e no startup, o conteúdo expirado é substituído por `[]`, preservando a linha e sem `DELETE`. O primeiro pulso de um novo dia também reinicializa o conteúdo. Se o runtime estiver desligado à meia-noite, a limpeza ocorre no próximo startup; a leitura nunca retorna dias anteriores. Backups do banco seguem sua retenção operacional independente.
- O baseline V001 contém a mesma definição da V069. Nenhuma nova variável de ambiente ou estrutura do ETL é necessária. A trilha começa após publicar a implementação; os registros anteriores de última atividade não permitem reconstruí-la.

## Validação e publicação

- Qualidade completa em `.tmp/quality/20260910-154439-154fb6/summary.json`: 695 testes backend, 313 frontend, cobertura, TypeScript, lint, encoding, ambiente e builds aprovados. Fingerprints operacionais preservados.
- Autorização adicional: 51 testes direcionados aprovados em `.tmp/six-refinements/backend-autorizacao.log`, incluindo quatro casos novos de cadeia HTTP/JWT/validação. Esses 51 se sobrepõem à suíte completa e não devem ser somados integralmente ao total anterior.
- Após o ajuste mobile e de distribuição: 313 testes frontend, TypeScript, lint, encoding e build aprovados; logs `frontend/.tmp/six-final-*.log`.
- `scripts/verify-presenca-sql.ps1` executa doze cenários no SQL Server usando exclusivamente tabelas temporárias e dados artificiais. O runner exige `DASHBOARDS_DEV`, mantém a senha fora dos argumentos e do log e verifica a paridade V001/V069. Foram cobertos início, pulsos repetidos, mudança de página, blur, outra aba, lacuna de atividade, virada do dia, limpeza, paginação, inativação e exclusão do operador na contagem/lista. Evidência: `.tmp/six-refinements/presenca-sql.log`. Não foram aplicadas migrations nem alteradas tabelas reais nesta validação.
- Navegador: 99 verificações aprovadas, nas larguras 390/1265/1920/2560px e nos temas claro/escuro, com respostas artificiais, portas dinâmicas e rede externa bloqueada: `frontend/.tmp/six-refinements-audit/summary.json` e capturas no mesmo diretório. Conferidos rodapé, drawer, seleção e teclado de Cotações, distribuição dos nomes, consulta/paginação de presença e sobreposição dos corações.
- Candidatos: `frontend/.tmp/quality-build/20260910-six-final/dist` e `backend/target/quality/20260910-154439-154fb6/dashboard-api-1.0.0.jar`. Publicação coordenada com V068 e V069 pelo operador humano. Nenhum runtime, porta de produção ou artefato operacional foi substituído.

As funções JSON usadas no repositório seguem os contratos oficiais de [JSON_MODIFY](https://learn.microsoft.com/en-us/sql/t-sql/functions/json-modify-transact-sql) e [OPENJSON](https://learn.microsoft.com/en-us/sql/t-sql/functions/openjson-transact-sql); os cenários acima também exercitaram sua execução no SQL Server disponível em DEV.
