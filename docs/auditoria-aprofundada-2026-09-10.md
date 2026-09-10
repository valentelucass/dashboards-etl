# Auditoria aprofundada e segunda rodada de otimização — 10/09/2026

## Resultado e limites

A rodada ampliou a validação por risco, corrigiu falhas reproduzidas e otimizou a página Performance e a resolução de autorização no backend. Foram preservados os trabalhos anteriores de Integrações. Não houve publicação, start/restart, acesso aos bancos operacionais, migrations ou alteração das portas 5010/5173.

A comparação desta rodada parte **da versão que já tinha ECharts modular**, e não da distribuição completa anterior. Resultados de páginas/cenários distintos não devem ser somados.

## Otimizações implementadas e medidas

### Página Performance: consultas independentes com concorrência limitada

Antes, série, status, histórico, drill-down, aging e tabela aguardavam sucesso do overview e atrasos fixos de 150 a 900 ms. Nenhum desses endpoints recebe dados calculados pelo overview: recebem filtros independentes. A indisponibilidade do resumo também impedia os gráficos de iniciar.

`PerformancePage.tsx` passou a habilitar essas consultas diretamente. `performanceRequestQueue.ts`, integrado ao transporte Axios, limita a **três requisições simultâneas por instância de cliente** para `/api/painel/performance/**` e `/api/dimensoes/performance/**`. A fila prioriza overview, gráficos, dimensões e tabela, nessa ordem. Auth, escritas, exportações e outros painéis não entram nessa fila. O limite não é global entre usuários/abas e não inclui dimensões gerais como filiais/pagadores.

Os 11 hooks/consultas do domínio encaminham `AbortSignal` até Axios, incluindo tabela paginada e dimensões. Ao mudar filtros ou desmontar o último consumidor, consultas em espera são removidas antes do envio; requisições já enviadas recebem cancelamento no cliente. Isso **não comprova interrupção da consulta SQL já iniciada no servidor**. Falhas HTTP, erros síncronos e cancelamentos liberam vagas. Consumidores simultâneos continuam compartilhando a mesma query.

Esse desenho segue o problema de [waterfalls descrito pelo TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/request-waterfalls). Cache, polling, filtros, fórmulas, dimensões dos cards e dados retornados não foram usados para fabricar ganho.

### Medição no navegador

Edge headless com perfil próprio, builds minificados, cache desabilitado, 1600×1000, APIs sintéticas com 200 ms por resposta/interceptação e DNS externo bloqueado. Houve cinco repetições por versão/cenário em Performance (20 carregamentos) e três em Coletas (12 carregamentos). As versões foram alternadas; não foram executados builds ou suítes pesadas durante as amostras temporais. Tráfego de teste não chegou a APIs reais.

| Página/cenário | Mediana antes | Mediana depois | Redução de tempo |
| --- | ---: | ---: | ---: |
| Performance/desktop: primeiro desenho | 2.085,6 ms | 1.404,1 ms | **32,68% / 681,5 ms** |
| Performance/desktop: último desenho | 3.588,6 ms | 2.954,0 ms | **17,68% / 634,6 ms** |
| Performance/CPU 4x + 2 Mbps: primeiro desenho | 4.496,0 ms | 3.923,0 ms | **12,74% / 573,0 ms** |
| Performance/CPU 4x + 2 Mbps: último desenho | 6.367,0 ms | 5.508,0 ms | **13,49% / 859,0 ms** |
| Coletas/desktop: primeiro desenho | 1.445,6 ms | 1.397,9 ms | Variação pequena: 3,30% |
| Coletas/CPU 4x + 2 Mbps: primeiro desenho | 4.041,3 ms | 4.012,3 ms | Praticamente igual: 0,72% |

O pico observado de GETs do domínio Performance passou de quatro para três. Preflights não entram nesse pico. O número de consultas funcionais não foi reduzido pela fila: sua ordem e concorrência foram alteradas.

O primeiro desenho é a primeira operação Canvas; o último é a última operação antes de 400 ms de estabilidade, com cinco canvases presentes. Não são LCP, SLA de produção nem medidas de SQL Server. A amostra é pequena, sem intervalo de confiança ou conclusão estatística universal.

As atualizações de segurança e o código adicional aumentaram o JavaScript comprimido de Performance de 457.468 para 467.075 bytes (**+2,10%**). Em Coletas: 455.016 para 464.975 bytes (**+2,19%**). A melhora desta rodada veio da execução das consultas; não houve nova redução de bundle.

Artefatos: `frontend/.tmp/audit2-before`, `frontend/.tmp/audit2-after`, `frontend/.tmp/audit2-performance/results.json` e `frontend/.tmp/audit2-coletas/results.json`. Capturas desktop foram inspecionadas.

Um smoke separado (`frontend/.tmp/audit2-smoke/smoke.json`) devolveu HTTP 503 em todas as tentativas de overview de Performance e confirmou cinco gráficos renderizados, layouts de 1024 e 390 px sem transbordamento horizontal, alturas mínimas preservadas e troca para tema escuro. O smoke não entra nas medianas. Ajustes de fixtures/seletor no harness durante sua preparação não foram classificados como defeitos do produto.

### Backend: uma resolução do papel por chamada

`AutenticacaoService.authoritiesFor` consultava `UsuarioPapelVinculoRepository.findAllByUsuarioId` quatro vezes no fluxo comum e três no administrador de plataforma. `PermissaoResolverService.resolverAcesso` agora devolve papel, flags administrativas, escopo total de filiais e mapa de permissões em `AcessoResolvidoDTO`, reutilizados pela montagem das authorities e da sessão.

Nos testes com **os dois serviços reais**, a consulta de papel caiu de **4 para 1** no fluxo comum: 75% menos invocações desse repositório por autenticação. Isso não significa 75% menos tempo de backend, nem conta SQL adicional gerado pelo ORM. Não há cache entre requisições: a revogação de papel é relida na chamada seguinte. A matriz inclui usuário comum, admin de acesso, admin de plataforma, desenvolvedor, template, GRANT/DENY, maior nível e ausência de vínculo. As regras de privilégio foram preservadas.

## Falhas reproduzidas e corrigidas

| Falha | Reprodução | Correção |
| --- | --- | --- |
| Cache atravessava logout/troca de identidade ou autorização | Sete casos falharam; uma resposta antiga também era reutilizada pelo usuário seguinte | Limpeza síncrona de queries/mutações e remontagem dos consumidores quando identidade, papel, setor, permissões, filiais ou troca obrigatória mudam. Renovação de validade não limpa dados |
| Histórico compartilhava chave entre parceiros logísticos | Filtros A/B geravam a mesma chave | Inclusão de `parceirosLogisticos` na chave e teste com QueryClient/HTTP reais em memória |
| Conteúdo externo virava HTML de tooltip | Três casos criavam elementos `img`, `svg` ou tags vindas do nome do cliente | `escapeHtml` nos textos interpolados dos formatters; revisão de 14 arquivos. Nomes usados em filtros/Canvas permanecem originais; markup fixo e marcadores do ECharts são preservados |
| DEV aceitava banco de produção em URL escapada/ambígua | Quatro URLs contornavam a validação; um profile ativo ocultava marcador DEV do ambiente | Parser local de propriedades JDBC com chaves escapadas, rejeição de duplicatas/aliases ambíguos e combinação dos marcadores de ambiente |
| Leitura repetida do papel na autenticação | Dez casos excediam a contagem esperada; a mudança simulada entre leituras também produzia combinação inconsistente de papel/permissões | Uma leitura reutilizada dentro da chamada, sem armazenar autorização entre requests |

A injeção de tooltip foi provada localmente pela criação de elementos/manipuladores a partir de dados sintéticos; não houve exploração de usuário real, execução de payload contra produção ou prova de contorno do CSP operacional. O [ECharts documenta que callbacks de tooltip aceitam HTML sem sanitização automática](https://echarts.apache.org/handbook/en/best-practices/security/).

O parser JDBC é conservador e não abre conexões nem registra URLs/credenciais. Preserva propriedades escapadas com `;` e `}}`; URLs inválidas, sem banco ou com múltiplas definições são recusadas em DEV. A sintaxe de escape é descrita pela [Microsoft](https://learn.microsoft.com/en-us/sql/connect/jdbc/building-the-connection-url?view=sql-server-ver17). Ele não substitui a validação pelo driver nem verifica permissões reais do login no SQL Server.

## Testes e cobertura

Além dos testes anteriores, esta rodada acrescentou integração entre hooks, TanStack Query e Axios; fila/cancelamento/deduplicação; cache entre sessões; injeção de HTML; parser de banco; gestão de setores e matriz de autorização com contagem de repositório.

`SecurityChainIntegrationTest` instancia contexto MVC em memória com a configuração de segurança, filtros JWT/API key/rate limit, assinatura JWT, `AcessoSeguranca` e `PerformanceController` reais. Valida oito rotas sem sessão, seis rotas sem permissão, JWT assinado por outra chave, acesso autorizado, headers, CORS e 429. Serviços de dados são mocks. Não inicia Spring Boot, servidor, datasource ou Flyway. CORS usa origens sintéticas restritas; os testes existentes continuam validando a configuração operacional.

Resultado final: **678 testes backend e 237 frontend**, sem falhas/ignorados. Cobertura backend: **52,04% das linhas e 41,83% das ramificações**, 473 classes, 161 sem instrução executada. Frontend: **20,78% das linhas/statements, 69,19% das ramificações e 48,18% das funções**. Os pisos/exclusões não foram alterados para aumentar o percentual.

Há lacunas reais: centenas de fluxos de UI/SQL não têm cobertura integral; mocks não comprovam dialeto, plano SQL, índices, pool ou comportamento de transações em SQL Server. Não houve teste de carga, fuzzing exaustivo, mutação de toda a suíte ou certificação de segurança.

## Dependências: correções e triagem

Atualizações selecionadas dentro das linhas atuais: Axios **1.20.0**, ECharts **6.1.0**, React Router DOM **6.30.6**; `brace-expansion`, `fast-uri` e `form-data` foram atualizadas dentro das restrições do lockfile. Scripts de instalação ficaram desabilitados. Foram necessários pequenos ajustes de tipos de testes para as tipagens Axios. Referências dos mantenedores: [Axios](https://github.com/axios/axios/releases/tag/v1.20.0), [ECharts](https://github.com/apache/echarts/releases/tag/6.1.0), [React Router](https://github.com/remix-run/react-router/releases/tag/react-router%406.30.6).

`npm audit --omit=dev` caiu de **oito pacotes (quatro altos/quatro moderados) para dois moderados, zero altos/críticos**. Os dois restantes são React Router/React Router DOM: a correção integral indicada para os avisos remanescentes exige mudança de major. A aplicação usa `BrowserRouter` e `createRoot`, sem SSR/hydration; as navegações de login verificadas usam rotas internas de `firstAccessibleRoute`. Isso reduz a aplicabilidade de alguns caminhos, mas não justifica silenciar os alertas. Relatório: `.tmp/quality/audit2-npm-after.json`.

No Java, as versões de runtime não foram modificadas nesta rodada. A expansão dos **86 advisories** confirmou **85 aliases CVE distintos**, com severidade cadastrada de **10 críticos, 30 altos, 32 moderados e 14 baixos**. São classificações dos avisos, não 86 explorações confirmadas. Os 20 pacotes afetados continuam pendentes.

`scripts/triage-java-advisories.mjs` consulta apenas IDs públicos na OSV, com concorrência limitada, e registra descrições, versões afetadas/corrigidas, aliases e referências em `.tmp/quality/java-osv-triage.json`. Não lê `.env` nem envia código, logs ou dados da aplicação.

| Família | Evidência local / aplicabilidade inicial | Tratamento profissional |
| --- | --- | --- |
| Tomcat 10.1.20 | API MVC embutida, multipart habilitado e execução Windows. HTTP/2, WebDAV, CGI, autenticação FORM/DIGEST e DefaultServlet gravável não foram encontrados na configuração/código auditados | Prioridade alta para atualização coordenada; confirmar configuração efetiva e testar multipart/limites, HTTP e proxy. A ausência de configuração no repositório não prova ausência no runtime |
| Spring/Security/Data/Boot | Spring MVC e method security estão ativos; a cadeia real passou nos testes. Não foram encontrados WebFlux, `EndpointRequest`, SpEL recebido de usuários ou configuração Cloud Foundry no trecho auditado | Migrar de linha com suíte, startup isolado e homologação; unitários não eliminam avisos do framework |
| Jackson | DTOs/records JSON; não foram encontrados default typing, `JsonTypeInfo`, estratégias polimórficas customizadas ou DTO de `InetSocketAddress` | Atualizar via BOM e testar contratos/validação/limites. JSON inválido 400 e DTOs já são exercitados |
| LDAP | Starter presente, mas `LdapAutoConfiguration` explicitamente excluída no aplicativo | Avaliar remoção da dependência ociosa ou atualização pela BOM; não declarar fluxo LDAP explorável por presença do JAR |
| Bouncy Castle | Usado para senha Argon2; os avisos incluem GOST CTR e LDAP | Atualizar com testes de leitura/migração de hashes. Não inferir que aviso de GOST quebra Argon2 |
| Logback, Log4j API, Commons Lang e Micrometer | Presentes no runtime; aplicabilidade depende de configuração, entradas e APIs utilizadas | Priorizar versões corrigidas e reproduções limitadas; não executar cargas/exploits contra a operação |

Spring Boot 3.2 encerrou suporte aberto na [versão 3.2.12](https://spring.io/blog/2024/11/21/spring-boot-3-2-12-available-now/). Uma linha candidata é [3.5.16, compatível com Java 17](https://docs.spring.io/spring-boot/3.5/system-requirements.html). Essa migração **não foi executada nem validada** aqui: exige revisar Hibernate/Flyway/Security/Jackson e testar startup, schema, autenticação, uploads e regressão em SQL Server isolado. Não misturar essa hipótese com as correções comprovadas acima.

## Próximos gargalos e critério de aceitação

1. **Homologação SQL/HTTP:** medir duração e leituras lógicas por endpoint/período/filial, p50/p95 e ocupação do pool. A fila por cliente não limita carga agregada de muitos usuários.
2. **Faturamento, Cotações e Gestão à Vista:** os atrasos/dependências existentes permanecem. Repetir fixtures e benchmark por página antes de aplicar a mesma fila; não remover todos os atrasos globalmente.
3. **Coletas:** três agregações sequenciais permanecem. Avaliar plano/índices no repositório ETL e custo de uma consulta consolidada; não paralelizar JDBC sem avaliar o pool nem mudar matemática/fonte sem atualizar os dicionários.
4. **Renderização:** montagem próxima ao viewport e eliminação da inicialização temporária do wrapper ECharts continuam hipóteses. Exigem testar resize, abas, rolagem, apresentação, tema e descarte antes de substituir o wrapper.
5. **Segurança/cobertura:** fechar os alertas restantes, ampliar testes de sessão concorrente e domínios ainda descobertos, além de E2E das demais páginas. A suíte verde não significa teste de cada combinação possível.

## Reprodução e entrega

```powershell
./scripts/run-quality.ps1
node scripts/triage-java-advisories.mjs
cd frontend
node scripts/benchmark-charts.mjs .tmp/audit2-before .tmp/audit2-after .tmp/audit2-performance performance 5
node scripts/benchmark-charts.mjs .tmp/audit2-before .tmp/audit2-after .tmp/audit2-coletas coletas 3
node scripts/benchmark-charts.mjs .tmp/audit2-before .tmp/audit2-after .tmp/audit2-smoke performance 1 smoke
```

Os benchmarks dependem dos dois builds preservados. Novas comparações devem usar diretórios distintos, mantendo uma base anterior à alteração.

Execução final: `20260910-013856-33cd19`. Candidatos isolados: `backend/target/quality/20260910-013856-33cd19/dashboard-api-1.0.0.jar` e `frontend/.tmp/quality-build/20260910-013856-33cd19/dist`. Resumo e logs: `.tmp/quality/20260910-013856-33cd19`; JaCoCo em `site/jacoco` do candidato backend, V8 em `coverage` do candidato frontend. Os artefatos operacionais e candidatos anteriores foram preservados; a publicação continua sendo do operador humano.
