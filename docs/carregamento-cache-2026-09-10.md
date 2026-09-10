# Carregamento por posição na tela e cache de navegação

## Diagnóstico

- A fila anterior limitava três GETs em quatro domínios. Coletas, Cotações, Gestão à Vista, Localização, contas/faturas, ETL e Integrações não participavam dela; dimensões globais também disputavam recursos fora desse controle.
- Coletas devolvia status, regiões e aging em um pacote, executando três agregações sequenciais. O primeiro gráfico de status esperava as consultas da linha inferior. Histórico e tabela eram independentes e podiam aparecer antes.
- Cotações esperava o overview e acrescentava atrasos fixos de 150–850 ms. Gestão à Vista também esperava os overviews e acrescentava 150–430 ms. Esses atrasos não acompanhavam nem o tempo do servidor nem a posição dos cartões.
- Os dados analíticos ficavam frescos por cinco minutos e, por padrão do TanStack Query instalado, eram removidos após cinco minutos sem observadores. Reutilização e validade tinham praticamente a mesma janela.
- Os links do menu descartavam os filtros e o período anterior, produzindo outra chave de consulta. Executivo e Saúde do ETL ainda substituíam datas explícitas por 180 dias depois da montagem, disparando consultas para o período anterior e impedindo o retorno à seleção escolhida.

## Comportamento entregue

Os doze dashboards compartilham até três GETs analíticos/de dimensões em transporte. A liberação de cada vaga recalcula a ordem usando a posição dos cartões: indicadores (incluindo suas metas), conteúdo visível, próximas linhas e tabelas. Gestão à Vista usa a posição de cada seção para combinar seus indicadores e gráfico. A rolagem e os breakpoints alteram essa prioridade sem timers ou listeners contínuos. Uma consulta lenta não bloqueia as outras vagas; respostas prontas continuam sendo exibidas.

As listas dos filtros fechados são carregadas depois dos dados da página. Abrir os filtros promove essas listas na fila. Escritas, autenticação, exportações e downloads mantêm o fluxo próprio. O limite de três não é um limite global do servidor: vale por instância da aplicação no navegador. Cancelar no navegador interrompe a espera/transporte, mas não garante que uma consulta SQL já iniciada no servidor seja interrompida.

Coletas passa a consultar `/api/painel/coletas/graficos/status` e `/api/painel/coletas/graficos/operacao`. A primeira resposta contém somente status; a segunda contém regiões e aging. Cada agregação continua sendo executada uma vez. O endpoint anterior `/graficos` permanece compatível. Controller, autorização, filtros, calendário, DTOs existentes e SQL matemático mantêm o contrato; não houve mudança de KPI, agrupamento ou origem dos gráficos, nem migration nesta etapa.

As séries de evolução e conversão de Cotações identificam o cartão consumidor mesmo compartilhando o endpoint, preservando a prioridade da linha correta. Cotações e Gestão à Vista deixam de usar atrasos fixos e dependência de sucesso do overview para consultas independentes. O cancelamento do TanStack chega ao Axios nos demais hooks de leitura: navegação ou troca de filtros cancela as consultas antigas, inclusive as ainda não enviadas.

O cache guarda dados das cinco páginas mais recentes, incluindo a atual, por até 30 minutos sem observadores. Mantém até 24 consultas inativas por domínio e 40 consultas inativas de dimensões; consultas em uso são preservadas. Faturamento/Fretes contam como um domínio. Esses limites controlam quantidade de respostas, não constituem uma garantia de tamanho em bytes. Páginas desmontadas não mantêm seus gráficos ou polling montados. Dados permanecem somente na memória da aba. As dimensões mantêm seus prazos próprios (em geral 30 minutos de validade e 24 horas de retenção), agora também sujeitas ao teto de quantidade.

O prazo de validade dos dados continua o de cada consulta: em geral cinco minutos, e um minuto em Integrações. Retornar dentro dessa validade reaproveita a resposta sem GET adicional. Depois dela, a resposta em cache aparece enquanto a atualização ocorre em segundo plano. Filtros diferentes usam chaves diferentes; dados nunca são tratados como atuais apenas porque ainda estão no cache.

O menu lembra período e filtros da URL para até cinco páginas dentro da mesma sessão. URLs explícitas e Voltar/Avançar continuam comandando os filtros. Não há manutenção de árvores React escondidas nem persistência de todas as seleções locais de drill-down. Executivo e Saúde do ETL resolvem seus 180 dias padrão antes da primeira consulta, somente quando a URL não informa datas. Logout e mudança de identidade, papel, setor, permissões, filiais ou exigência de senha continuam limpando o cache e a memória de navegação.

O carregamento do módulo da página tem uma fronteira Suspense dentro do painel, preservando a navegação e a estrutura externa.

## Validação

- Suíte completa isolada `20260910-162544-afcbf9`: 701 testes backend e 335 frontend; TypeScript, lint, encoding, validação de ambiente e build. A validação final do frontend passou com 340 testes, incluindo os períodos de Executivo/Saúde do ETL e séries de Cotações que compartilham endpoint, em `frontend/.tmp/cascade-final-*.log`.
- Testes direcionados exercitam ordem visual, rolagem, continuação com KPI lento, cancelamento de filtros e páginas, reutilização sem HTTP, atualização com dados visíveis depois de seis minutos, expiração em 30 minutos, limites do cache e limpeza de sessão com resposta antiga em voo.
- Testes do serviço confirmam que status não executa regiões/aging e que operação não repete status; filtros e data de referência permanecem iguais. O pacote legado continua coberto.
- Comparação e navegação no navegador usam API interceptada e dados sintéticos, com DNS externo bloqueado. Os resultados medem o comportamento do cliente; não são p50/p95 do SQL de produção.

A auditoria de navegação atravessou os doze dashboards, com 13 transições e 39 verificações de layout em 390/1265/1920 px. O retorno fresco a Coletas manteve o período escolhido e os cinco gráficos com zero GET adicional; depois da passagem pelas demais páginas, os dados foram consultados novamente. O navegador manteve apenas os gráficos da página atual. Com fixtures pequenas, o heap JavaScript após coleta variou de aproximadamente 10,39 a 14,40 MiB; isso não estima o uso com volumes reais nem inclui toda a memória nativa do navegador. Evidência: `frontend/.tmp/cascade-ready/navigation/navigation.json`. Migrations V068/V069 continuam pertencendo à entrega anterior e devem acompanhar seus candidatos na publicação coordenada pelo operador.

## Medições no navegador

Foram 60 carregamentos: cinco páginas, dois perfis, três repetições por versão, alternando a ordem antes/depois. As medianas abaixo começam na navegação e medem o início do desenho de todos os gráficos ECharts da primeira linha ou da página. Não significam término das animações, conclusão das listas de filtros nem tempo de SQL real. Não foi introduzida espera artificial para ocultar respostas prontas.

| Página | Perfil | Primeira linha, antes → depois | Todos os gráficos, antes → depois | Variação da primeira linha |
| --- | --- | ---: | ---: | ---: |
| Coletas | Desktop | 1.343 → 1.262 ms | 1.365 → 1.454 ms | -6,0% |
| Coletas | CPU 4× / 2 Mbps | 4.103 → 3.962 ms | 4.199 → 4.072 ms | -3,4% |
| Cotações | Desktop | 1.488 → 1.090 ms | 1.831 → 1.313 ms | -26,7% |
| Cotações | CPU 4× / 2 Mbps | 4.181 → 3.602 ms | 5.064 → 4.316 ms | -13,8% |
| Gestão à Vista | Desktop | 1.405 → 1.002 ms | 1.679 → 1.618 ms | -28,7% |
| Gestão à Vista | CPU 4× / 2 Mbps | 4.834 → 3.980 ms | 5.356 → 5.316 ms | -17,7% |
| Executivo | Desktop | 1.103 → 1.029 ms | 1.103 → 1.029 ms | -6,7% |
| Executivo | CPU 4× / 2 Mbps | 3.614 → 3.380 ms | 3.614 → 3.380 ms | -6,5% |
| Saúde do ETL | Desktop | 1.080 → 1.062 ms | 1.095 → 1.264 ms | -1,7% |
| Saúde do ETL | CPU 4× / 2 Mbps | 3.582 → 3.296 ms | 3.663 → 3.669 ms | -8,0% |

Em Coletas, a primeira linha melhorou nos dois perfis, mas o início do desenho de todos os gráficos ficou 89 ms depois no desktop (+6,5%) e 127 ms antes no cenário limitado. Em Saúde do ETL, o gráfico inferior ficou 169 ms depois no desktop; os GETs analíticos caíram de dez para cinco. O Executivo caiu de seis GETs para três, eliminando os três disparos para o período que seria sobrescrito. Esses dois comparativos também envolvem a correção das datas, e não representam uma comparação SQL de períodos equivalentes.

A fila favorece o topo e limita a disputa por recursos; não garante redução do tempo total em todos os cenários. A diferença entre páginas e a variação entre repetições impedem prometer aceleração universal. Permanecem necessárias medições p50/p95, planos e pool com SQL Server real isolado antes de aumentar concorrência ou reestruturar agregações.

O mock usa 200 ms por resposta. Para refletir somente a composição sequencial conhecida de Coletas, o pacote legado simula três unidades de 200 ms, status uma e operação duas; OPTIONS não simula trabalho SQL. Esse modelo é controlado e não atribui custos medidos às consultas reais. Resultados individuais, long tasks, solicitações, cancelamentos, fim dos desenhos e screenshots estão em `frontend/.tmp/cascade-ready/<pagina>/results.json`; o consolidado está em `frontend/.tmp/cascade-ready/summary.json`.

Reprodução a partir de `frontend`:

```powershell
node scripts/benchmark-charts.mjs .tmp/quality-build/20260910-six-final/dist .tmp/quality-build/20260910-cascade-final/dist .tmp/cascade-repro/coletas coletas 3 loading
node scripts/benchmark-charts.mjs .tmp/quality-build/20260910-six-final/dist .tmp/quality-build/20260910-cascade-final/dist .tmp/cascade-repro/navigation coletas 1 navigation
```

## Candidatos preparados

- Frontend atual: `frontend/.tmp/quality-build/20260910-menu-tabs/dist`, com Visão Analítica como primeiro botão e identificação da sessão no topo do menu lateral. O candidato `20260910-cascade-final` permanece como referência das medições acima.
- Backend: `backend/target/quality/20260910-162544-afcbf9/dashboard-api-1.0.0.jar`.
- Relatório completo: `.tmp/quality/20260910-162544-afcbf9/summary.json`; verificação final frontend em `frontend/.tmp/cascade-final-checks.json` e logs `cascade-ready-typescript/queue/lint/build`.
- Navegação do candidato final: `frontend/.tmp/cascade-ready/navigation/navigation.json`, sem erros, zero GET no retorno fresco a Coletas, 13 transições e 39 layouts válidos. Heap JavaScript com fixtures pequenas: 10,39–14,40 MiB após coleta; nenhuma página anterior mantém seus canvas montados.

Publicar frontend/backend em conjunto: a interface usa os novos endpoints de Coletas. V068/V069 e o baseline V001 da entrega anterior continuam preparados. Não houve DDL/DML operacional, alteração dos artefatos em uso ou gerenciamento dos runtimes/portas de produção.

Revalidação dos ajustes de menu/abas: TypeScript, lint dos componentes, encoding, ambiente, build e 24 testes existentes de fila/cache/navegação/filtros aprovados. O navegador isolado passou 65 verificações das abas e do cabeçalho (390/1265/1920/2560px, claro/escuro) e repetiu a navegação dos 12 dashboards com 13 transições e 39 verificações de layout. O retorno imediato a Coletas reutilizou os dados com zero GET; após exceder as cinco páginas, fez seis GETs, conforme a retenção limitada. Evidências em `frontend/.tmp/menu-tabs-audit/summary.json`, `frontend/.tmp/menu-tabs-navigation/navigation.json` e `frontend/.tmp/menu-tabs-coverage.json`. A fila e o cache continuam compartilhados pelos 12 dashboards; autenticação, escritas e exportações seguem seus fluxos próprios. Não foram refeitas medições comparativas de velocidade nesta alteração visual.
