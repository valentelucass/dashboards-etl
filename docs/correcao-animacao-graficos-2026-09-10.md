# Animação repetida dos gráficos — 10/09/2026

## Causa reproduzida

No build de produção anterior, Localização aplicava os mesmos dados três vezes em cada gráfico quando o detalhamento chegava depois do dashboard. O elemento React continuava montado; contar somente montagens não detectava o problema.

Foram identificados três gatilhos:

1. O adaptador `echarts-for-react` 3.0.6 inicializava uma instância temporária e esperava `finished` para descartá-la e criar a definitiva. Uma atualização React antes desse evento aplicava dados na instância temporária. Ela animava, terminava e era substituída, repetindo o desenho. O código instalado e a [implementação do adaptador](https://github.com/hustcc/echarts-for-react/blob/master/src/core.tsx) confirmam essa sequência.
2. Opções e formatadores eram recriados em renderizações sem alteração dos dados. Como os consumidores usam `notMerge`, reaplicar essas opções reiniciava as séries. Encontrados em Localização, Executivo, Contas a Pagar, Faturas por Cliente e nos dois gráficos internos de conversão de Cotações. Nas duas páginas financeiras, a paleta recriada invalidava inclusive opções que já usavam `useMemo`.
3. Com respostas rápidas em Cotações, `graficos` chegava antes de o timer habilitar `conversionSerie`. O estado `isLoading` ainda era falso na consulta desabilitada e os dois gráficos de conversão apareciam prematuramente. Quando a consulta começava, o skeleton os desmontava. O teste com API de 10 ms reproduziu duas montagens por gráfico mesmo depois da correção compartilhada. A condição passou a usar `isPending`, aguardando o resultado efetivo das duas fontes.

## Correção

`DashboardEChart.tsx`, já consumido por todas as páginas com ECharts, passou a controlar diretamente `init`, `setOption`, eventos, `resize` e `dispose`. A inicialização é síncrona e usa uma instância por montagem; não depende do término da animação. `ResizeObserver` acompanha o tamanho do card, agrupa mudanças em um frame e libera observer, eventos e frame pendente na desmontagem. A [documentação oficial do ECharts](https://echarts.apache.org/handbook/en/concepts/chart-size/) orienta inicialização com as dimensões do contêiner, observação das mudanças de tamanho e descarte na remoção do elemento.

A comparação profunda continua considerando funções por identidade, preservando atualizações reais de closures e formatadores. A dependência `fast-deep-equal` 3.1.3, que já existia no lockfile por meio do adaptador anterior, foi declarada diretamente. O contrato de props anterior permanece tipado; não há importação de runtime do adaptador anterior no bundle.

As cinco páginas afetadas estabilizam opções/paletas pelas dependências efetivas de dados, modo de visualização e tema. Animações permanecem habilitadas. Não houve alteração de fórmula, fonte, filtros de negócio, séries, alturas de cards, SQL, migrations ou backend.

## Testes automatizados

- Dez testes do componente: primeira renderização sem aguardar `finished`, dados novos antes do primeiro término, opções equivalentes, closures atualizadas, troca/remoção de handlers, tema/renderizador, loading/replaceMerge/lazyUpdate, resize, ativação do observer e desmontagem em StrictMode.
- Três testes da página real de Localização: chegada da tabela preserva as opções; dados novos atualizam série/legenda; tema atualiza cores preservando valores.
- Reprodução anterior em `frontend/.tmp/animation-regression-before.log`, incluindo a recriação após `finished`. Testes posteriores passaram.
- Validação completa `20260910-103509-123598`: **687 testes backend + 265 frontend = 952**, sem falhas ou ignorados. TypeScript, lint com zero warnings, encoding, validação do ambiente e builds aprovados. Cobertura de linhas frontend: 23,57%; backend: 52,38%. Cobertura continua parcial.
- `.tmp/quality/20260910-103509-123598/summary.json`: `operationalFilesPreserved: true`. A condição final de Cotações foi validada novamente pelos 265 testes frontend, TypeScript, lint, encoding, ambiente e build; resumo em `.tmp/quality/20260910-animacao-final/summary.json`, associado ao backend inalterado da execução completa anterior.

## Protocolo de navegador

`scripts/audit-chart-animations.mjs` executa sequencialmente o navegador headless isolado e compara os builds anterior/candidato. A instrumentação observa identificadores reais das instâncias, aplicações de opções, eventos `finished` e desenho no Canvas. Na inicialização síncrona, o primeiro modelo é lido no commit React; as atualizações posteriores são interceptadas. Nenhuma instrumentação é publicada no aplicativo.

As APIs são interceptadas e recebem contratos sintéticos; autenticação também é sintética. DNS externo é bloqueado. Servidor e navegador usam somente portas dinâmicas próprias. O teste não contata SQL Server, Satélite ou APIs operacionais. O atraso padrão das APIs é de 200 ms; detalhes/tabelas/resumo financeiro recebem 2.200 ms no cenário de animação, provocando uma atualização da página depois da primeira animação. O critério de término aguarda também as requisições pendentes.

Cada página é comparada em desktop e CPU 4x/rede 2 Mbps. Cotações também possui o cenário `animation-fast`, com respostas de 10 ms e tabela tardia. O smoke adicional verifica 1024/390 px, tema escuro e legendas disponíveis; Localização também aplica o filtro real da interface e verifica a nova série retornada pela API simulada. Overview 503 é simulado em Performance, Faturamento e Executivo para verificar a independência dos gráficos.

Há uma particularidade anterior em Manifestos: a 1024 px, o Canvas de evolução de custo mede 358 px dentro de um elemento de 362 px, tanto no build anterior quanto no candidato. A tolerância de quatro pixels fica restrita a esse gráfico; demais comparações de tamanho usam um pixel. Os dois Canvas de conversão de Cotações dividem um card de altura fixa e são verificados como gráficos internos, sem exigir 350 px de cada Canvas.

## Resultado nas 12 páginas

A rodada final em `frontend/.tmp/animation-final-audit` aprovou **50 gráficos ECharts**, em **64 carregamentos**: 48 carregamentos comparativos normais, quatro com API rápida em Cotações e 12 smokes. Foram verificadas 110 comparações por gráfico/cenário. Todas preservaram os nomes/valores das séries e apresentaram **uma inicialização e uma aplicação de dados no candidato**. Os 12 smokes passaram, com 25 verificações de legendas disponíveis, resize, tema escuro e filtro de status em Localização; nenhum erro JavaScript foi registrado.

| Página | Gráficos | Aplicações por gráfico antes (mín.–máx.) | Depois |
| --- | ---: | ---: | ---: |
| Coletas | 5 | 1 | 1 |
| Performance | 5 | 1 | 1 |
| Faturamento | 5 | 1 | 1 |
| Manifestos | 7 | 1 | 1 |
| Executivo | 2 | 1–3 | 1 |
| Localização | 2 | 3 | 1 |
| Contas a Pagar | 4 | 1–3 | 1 |
| Faturas por Cliente | 4 | 1–4 | 1 |
| Saúde ETL | 3 | 1 | 1 |
| Cotações | 5 | 1–2 | 1 |
| Integrações | 3 | 1 | 1 |
| Gestão à Vista | 5 | 1 | 1 |

A tabela usa o cenário normal de 200 ms. No cenário rápido adicional, os dois gráficos internos de Cotações passaram de quatro aplicações/inicializações por gráfico para uma no desktop, eliminando também a montagem prematura; em CPU 4x passaram de duas para uma. Nas páginas que já apresentaram uma aplicação de dados no controle, a mudança remove a instância temporária e protege o ciclo compartilhado, sem alegar que esse mesmo cenário tenha reproduzido uma repetição visível em todas elas.

Os resultados intermediários serviram para diagnóstico; o consolidado final usa o mesmo candidato frontend, os contratos sintéticos completos e a instrumentação corrigida para instâncias ainda sem modelo. Arquivos: `summary.json`, `<rota>/comparison.json`, `<rota>/results.json`, `<rota>-smoke/smoke.json`, `<rota>/*.png` e `cotacoes-fast/comparison.json` dentro de `frontend/.tmp/animation-final-audit`.

Reprodução, a partir de `frontend`:

```powershell
node scripts/audit-chart-animations.mjs .tmp/quality-build/20260910-094146-d84f1c/dist .tmp/quality-build/20260910-animacao-final/dist .tmp/nova-auditoria-animacoes
```

## Medição específica de Localização

O ensaio inicial teve oito carregamentos alternados, duas amostras por versão/cenário, em `frontend/.tmp/animation-tracking/results.json`. O candidato intermediário tem a mesma implementação de Localização e do componente compartilhado do candidato final.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Inicializações por gráfico | 2 | 1 |
| Aplicações dos mesmos dados por gráfico | 3 | 1 |
| Mediana do último desenho dos dois gráficos, desktop | 4.198 ms | 2.432 ms |
| Mediana do último desenho, CPU 4x / 2 Mbps | 6.129 ms | 4.637 ms |

A redução observada foi de 42,1% e 24,3% nesse cenário sintético de resposta tardia. É a estabilização visual dos gráficos, incluindo animação, e não uma medição da latência de produção ou do SQL. Não extrapolar essas porcentagens às outras páginas.

## Limites e operação

A lentidão de dados de Localização precisa de medição SQL/HTTP separada: apesar do nome `buscarDashboardConsultaUnica`, o repositório executa quatro agregações sequenciais — status, regiões, overview e matriz — além da consulta de metadados quando necessária. Nenhuma dessas consultas foi alterada nesta correção visual.

Os candidatos são `frontend/.tmp/quality-build/20260910-animacao-final/dist` e `backend/target/quality/20260910-103509-123598/dashboard-api-1.0.0.jar`. Os artefatos operacionais e candidatos anteriores foram preservados. Nenhum start/restart foi realizado; publicação permanece com o operador humano.
