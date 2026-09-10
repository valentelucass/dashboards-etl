# Qualidade e carregamento dos gráficos — 10/09/2026

## Escopo e isolamento

A revisão executou a suíte existente, acrescentou testes por risco e limites, corrigiu falhas reproduzidas e mediu uma otimização dos gráficos. Não houve start/restart de produção, execução de `iniciar-prod.bat`, gerenciamento das portas 5010/5173, acesso aos bancos operacionais, migrations ou publicação. As modificações de Integrações que já existiam no workspace foram preservadas.

O comando reproduzível é `./scripts/run-quality.ps1`, descrito em `scripts/README.md`. O perfil Maven `quality` produz um JAR em diretório próprio, sem substituir o operacional. SQL Server JDBC e o carregador `.env` ficam fora do classpath dos testes; Flyway fica desabilitado. Vitest usa até dois workers. Os testes MVC são locais ao processo e os repositórios usam mocks ou H2 em memória. A configuração não é uma barreira de rede do sistema operacional: novos testes que introduzam clientes de rede precisam manter mocks explícitos.

## Falhas reproduzidas e corrigidas

1. **JDK selecionado pelo Maven:** o shell apresentava Java 17, enquanto `JAVA_HOME` conduzia Maven ao Java 25. Quatro testes existentes falhavam na instrumentação Mockito/Byte Buddy. Com Java 17 todos passaram; o runner seleciona o JDK correto e o perfil rejeita Java 25 antes da execução. A rejeição foi testada com `validate`, sem alterar o Java global ou opções experimentais do Mockito.
2. **JSON malformado:** quatro casos MVC reais — JSON incompleto, corpo ausente e objeto onde se espera texto — retornavam HTTP 500. `ManipuladorGlobalExcecoes` agora retorna HTTP 400 com mensagem genérica, sem registrar o conteúdo do parser. `HttpRequestValidationTest` reproduziu a falha antes da correção e passou depois.
3. **Senha com acentos:** o frontend rejeitava `Á` como maiúscula e aceitava `é` como caractere especial; o Java tratava ambos como letras. A política frontend passou a reconhecer categorias Unicode. Exemplos equivalentes com acentos e limites de tamanho foram testados nos dois lados. Não foi modificada a política de 12 caracteres com maiúscula/minúscula/número/símbolo.

## Cobertura dos testes

A base inicial tinha 351 testes backend e 172 frontend. Um teste vazio chamado `contextLoads` foi removido: não carregava contexto nem verificava comportamento.

**Resultado final:** 615 testes backend e 213 frontend aprovados, sem falhas nem testes ignorados. Maven `verify`, JaCoCo/check, TypeScript, ESLint com zero warnings, encoding, validação do ambiente de produção frontend e Vite passaram. A cobertura frontend ficou em 19,72% das linhas/statements, 67,85% das ramificações e 45,61% das funções, incluindo arquivos sem teste.

A execução final é `20260910-005855-58fc71`, com resumo em `.tmp/quality/20260910-005855-58fc71/summary.json` e `operationalFilesPreserved: true`. O JAR candidato está em `backend/target/quality/20260910-005855-58fc71/dashboard-api-1.0.0.jar`; o frontend em `frontend/.tmp/quality-build/20260910-005855-58fc71/dist`. Eles incluem as alterações de Integrações já presentes no workspace. Não houve publicação. Os relatórios de cobertura estão no diretório `site/jacoco` do candidato backend e em `coverage` no diretório do candidato frontend.

As novas verificações incluem:

- Validação real de 18 DTOs de requisição, incluindo propriedades obrigatórias, vazias, em branco, limites exatos e limite + 1, intervalos de ano/mês, valores negativos, enums e listas aninhadas. Os casos esperados são explícitos e não derivados das próprias anotações.
- JWT válido, expirado, malformado, sem assinatura e assinado por outra chave; filtro sem bearer, sem permissões, com falha de autorização, heartbeat indisponível, rotas longas e dispatch assíncrono de exportação.
- Períodos nulos, invertidos e limites de 365/366 dias; política de senha; assinatura de uploads e rejeição de binários disfarçados como CSV.
- Contrato HTTP por MockMvc com Bean Validation real, sem servidor, banco ou Boot completo.
- Proteção de rotas com o hook de permissões real, troca obrigatória de senha, negação de acesso administrativo e ausência de sessão.
- Multisseleção e encoding de filtros, separação de filiais/parceiros, foco/teclado/Escape nos tooltips e texto HTML tratado como texto na renderização React.
- ECharts real com barras, linhas, rosca, `graphic`, `markLine`, título, legenda, zoom e eventos; o renderer SVG existe somente no teste sem DOM, enquanto a aplicação usa Canvas validado no navegador.

JaCoCo inclui 471 classes e a medição backend após as correções apresentou 50,46% das linhas e 39,80% das ramificações cobertas, com 165 classes sem instrução executada. Os relatórios HTML e CSV mostram exatamente quais classes continuam descobertas. Os pisos automatizados foram calibrados abaixo dessa base, sem excluir classes para elevar percentuais.

Esses resultados não significam que cada campo, classe e combinação possível do sistema foi testado. A suíte cobre contratos e comportamentos selecionados; não há certificação formal de segurança, teste completo de SQL Server, teste de mutação, teste de carga ou E2E de todas as páginas. O H2 não comprova execução de SQL específico do SQL Server.

## Otimização aplicada

Cinco pontos importavam a distribuição completa de `echarts-for-react`, incluindo todas as séries do ECharts. Agora `DashboardEChart` usa o wrapper `lib/core` e `echartsRuntime` registra apenas as séries e componentes usados no portal. As cinco entradas incluem o wrapper geral e os gráficos próprios de Faturamento, Cotações e Manifestos. A abordagem de importação modular é documentada pelo [Apache ECharts](https://echarts.apache.org/handbook/en/basics/import/).

Foram preservados opções, eventos de clique/drill-down, tooltips, zoom, animações, temas e dimensões dos cards. Não houve mudança de fórmula, agrupamento, fonte de dados, período ou endpoint; os dicionários de KPIs/gráficos permanecem com o mesmo contrato.

| Medida de build | Antes | Depois | Diferença |
| --- | ---: | ---: | ---: |
| Maior chunk compartilhado, bruto | 1.263,72 kB | 772,90 kB | −38,84% |
| Maior chunk compartilhado, gzip | 412,78 kB | 252,51 kB | −160,27 kB |
| Imports estáticos necessários para Coletas, bruto | 1.866,5 kB | 1.384,8 kB | −25,81% |
| JavaScript comprimido observado no navegador em Coletas | 612.341 bytes | 454.996 bytes | −157.345 bytes |

As 12 páginas com gráficos reduziram o fechamento de imports em aproximadamente 24,59% a 26,20%. O entrypoint básico subiu cerca de 0,53 kB e os chunks administrativos cresceram cerca de 9,1 kB por redistribuição do empacotamento. A soma por página, e não apenas o maior chunk, está em `frontend/.tmp/bundle-comparison.json`.

## Medição no navegador

Builds minificados antes/depois; Edge headless com perfil próprio; cache desabilitado; 1600×1000; três repetições alternadas de cada versão em dois cenários. As APIs foram totalmente simuladas, com 30 dias de dados sintéticos e espera de 200 ms por resposta. Houve 18 interceptações de API por amostra, incluindo preflights; nenhuma requisição ao backend real. Uma requisição externa de recurso foi bloqueada por amostra.

O primeiro desenho mede a primeira operação Canvas no gráfico. O término mede a última operação Canvas antes de pelo menos 400 ms de estabilidade com cinco canvases presentes. Não são métricas oficiais LCP nem prova isolada de tempo de resposta SQL.

| Cenário / mediana | Antes | Depois | Leitura |
| --- | ---: | ---: | --- |
| Desktop: primeiro desenho | 1.323,4 ms | 1.360,5 ms | Sem ganho consistente |
| Desktop: último desenho | 2.697,4 ms | 2.700,8 ms | Praticamente igual |
| CPU 4x + 2 Mbps: primeiro desenho | 4.572,5 ms | 3.881,2 ms | −691,3 ms / −15,12% |
| CPU 4x + 2 Mbps: último desenho | 6.445,9 ms | 5.589,1 ms | −856,8 ms / −13,29% |

Os cinco gráficos renderizaram sem erro JavaScript capturado nos 12 carregamentos. A captura desktop após a mudança foi inspecionada. Resultados e PNGs ficam em `frontend/.tmp/chart-benchmark`. O número de amostras é pequeno e a máquina é compartilhada com outras atividades: não se afirma significância estatística ou ganho equivalente em produção. A economia de bytes é determinística; a latência varia por máquina/rede.

## Outros pontos encontrados: hipóteses ainda não implementadas

| Local | Evidência no código | Próxima validação necessária |
| --- | --- | --- |
| `PerformancePage.tsx` | Gráficos aguardam overview e atrasos de 150 a 700 ms; tabela espera 900 ms | Medir o custo das consultas e testar concorrência limitada em ambiente isolado antes de remover esperas |
| `FaturamentoPage.tsx` | Esperas de 240/380/620 ms para séries/gráficos/ranking após overview; tabela 950 ms | Medir waterfall com períodos/filiais representativos e observar pressão sobre o pool SQL |
| `CotacoesPage.tsx` | Esperas de 150/320/520 ms e condição de visão analítica | Comparar carregamento das abas, consultas desnecessárias e número máximo de requisições simultâneas |
| `IndicadoresGestaoAVistaPage.tsx` | Cada conjunto secundário depende do overview e espera 150 a 430 ms | Verificar quais dados realmente dependem do overview, mantendo autorização e filtros |
| `ColetasService.buscarGraficos` | Três agregações SQL sequenciais para status, regiões e aging | Capturar planos/tempos em SQL Server de homologação; não paralelizar nem reescrever SQL sem medição |
| Canvas fora da área visível | Cinco instâncias são montadas no carregamento da página de Coletas | Testar montagem próxima ao viewport com altura reservada e validar rolagem/slideshow antes de adotar |

Coletas já inicia suas consultas independentes sem esperar o overview. Mudar globalmente o cache ou os tempos de atualização alteraria a atualidade dos dados e não foi usado como atalho de performance. A arquitetura de agregação no SQL Server foi preservada.

## Auditoria de dependências: pendências reais

`npm audit --omit=dev --json` apontou oito pacotes com alertas: quatro altos e quatro moderados. Entre eles: Axios, form-data, fast-uri, brace-expansion, ECharts e a família React Router. Isso representa correspondência de versões, não oito explorações reproduzidas. O JSON local completo está em `.tmp/quality/npm-audit-production.json`.

A API [OSV](https://google.github.io/osv.dev/api/) verificou 103 dependências Maven de runtime: 20 pacotes correspondem a 86 IDs distintos de advisories. Há alertas em Tomcat, Spring/Security, Jackson, Logback e outras bibliotecas. O relatório `.tmp/quality/java-osv-audit.json` enumera pacote, versão e IDs; registros diferentes podem referir-se à mesma CVE. Não foram executados exploits nem atualizações automáticas de frameworks.

O alerta do ECharts [GHSA-fgmj-fm8m-jvvx](https://github.com/advisories/GHSA-fgmj-fm8m-jvvx) descreve a série **Lines**, diferente da série **Line** usada nos gráficos do portal. `LinesChart` não integra o runtime modular criado nesta entrega. Isso reduz a aplicabilidade desse alerta específico ao bundle atual, mas não equivale a corrigir a dependência ou provar ausência de outros XSS em formatters próprios.

As próximas entregas devem tratar versões corrigidas com matriz de compatibilidade, regressão funcional e homologação, em especial Spring Boot/Tomcat/Security. Não se deve marcar a aplicação como integralmente segura somente porque as suítes passaram.
