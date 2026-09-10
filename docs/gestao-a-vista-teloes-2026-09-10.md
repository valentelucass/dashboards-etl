# Gestão à Vista — organização para telões

Reorganização dos cinco resultados e do Panorama Operacional, autorizada em todas as resoluções. A tela de notebook de referência continua sendo 1265px. Nenhum breakpoint global foi alterado.

## Entrega

- [x] Cards com maior destaque para o resultado atual, meta/limite próximo do status e contexto legível, sem cortar os detalhes.
- [x] Percentuais e barras alinhados nos cinco cards de desktop. Explicações preservadas no TooltipKpi, acessível por foco e hover.
- [x] Panorama com função complementar: comparação da cobertura das metas, em uma escala comum de 0–100%, e prioridades numeradas pelos gaps relativos já calculados.
- [x] Ranking de atenção conserva os mesmos três itens, filtro e desempates anteriores. O resultado atual continua disponível para leitores de tela e nos cards superiores.
- [x] Confirmação de todas as metas atendidas somente quando os cinco indicadores são positivos. Ausência de dados não produz confirmação verde.
- [x] Mobile com cards compactos; de 640 a 1023px, distribuição de três mais dois; a partir de 1024px, cinco resultados lado a lado e panorama com comparação e prioridades em duas colunas.
- [x] Paleta, fórmulas, limites, títulos dos indicadores, dados, metas por filial e alturas dos gráficos analíticos preservados.

## Validação

A suíte completa de frontend passou com 301 testes em 50 arquivos. Após a inclusão do estado de metas atendidas, os 16 testes direcionados do panorama e da política de metas foram reexecutados e passaram. TypeScript, lint, encoding, validação do ambiente e build aprovados.

A comparação de layout com o candidato anterior passou em 123 verificações: 13 larguras (320, 360, 390, 640, 768, 1023, 1024, 1265, 1280, 1535, 1536, 1920 e 2560px), mais estados positivos/sem dados em temas claro e escuro. Conferiu valores, cores, progressos, contenção e altura. APIs inteiramente simuladas, navegador isolado e porta aleatória, sem uso do runtime de produção.

Alturas medidas com os mesmos dados mistos antes/depois:

| Viewport | Cards antes → depois | Panorama antes → depois |
| --- | --- | --- |
| 1024px | 315 → 246px | 762 → 588px |
| 1265px | 263 → 236px | 762 → 588px |
| 1920px | 263 → 247px | 596 → 588px |

Evidência da comparação: `frontend/.tmp/gestao-design-ready-audit/summary.json`. A confirmação verde foi acrescentada posteriormente e conferida no candidato final.

O candidato final passou em mais 108 verificações: três estados de dados, dois temas e três larguras, alinhamento dos percentuais/barras, ordem das prioridades, tooltip por teclado/Escape e modo de apresentação. Total consolidado: **231 verificações aprovadas**, sem erros JavaScript. No modo de apresentação 1920×1080, os cinco resultados e o panorama ficam totalmente visíveis; o panorama termina em 924px.

Resumo: `.tmp/quality/20260910-gestao-teloes/summary.json`. Capturas do candidato final: `frontend/.tmp/gestao-teloes-final-audit/telao-full-hd.png` e `green-dark-1920.png` no mesmo diretório.

Refinamento posterior solicitado pelo usuário: bordas uniformes de **1px** nos cards de resultado e de prioridades, removendo os reforços no topo e na esquerda. Cores e organização preservadas nas três faixas.

## Arquivos e publicação

- `frontend/src/components/indicadores-gestao/IndicadoresGestaoSummaryCard.tsx`
- `frontend/src/components/indicadores-gestao/IndicadoresGestaoPanoramaSection.tsx`
- `frontend/src/components/indicadores-gestao/IndicadoresGestaoOverview.css`
- `frontend/src/pages/IndicadoresGestaoAVistaPage.tsx`

Candidato frontend: `frontend/.tmp/quality-build/20260910-gestao-bordas-uniformes/dist`. A entrega desta rodada é visual; publicação continua com o operador humano e os demais candidatos/migrations anteriores permanecem registrados em `states.md`. Builds operacionais, runtime e portas de produção preservados.
