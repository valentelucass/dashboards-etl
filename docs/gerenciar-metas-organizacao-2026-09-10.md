# Gerenciar Metas — organização e conferência

## Interface

- [x] Competência no cabeçalho do painel, deixando explícito o período comum das metas globais e por filial.
- [x] Campos percentuais compactos, cinco por linha nos notebooks/monitores; distribuição de três mais dois em tablets e uma coluna no mobile.
- [x] Seleção de filial junto das ações de edição, com nomes longos contidos e título completo disponível.
- [x] Histórico integrado à seção da filial, sem card interno adicional. O texto “Todas as competências” explicita o contrato existente da consulta paginada.
- [x] Bordas uniformes de 1px, preservando a preferência registrada no ajuste anterior.

## Correções verificadas

1. **Valor herdado:** os campos já recebiam a meta global correta, mas a legenda usava constantes antigas. Ela passa a apresentar a meta global carregada; campos editados continuam mostrando a referência global.
2. **Rascunhos:** trocar entre duas filiais que herdavam o mesmo objeto global não reinicializava o formulário. O formulário agora acompanha também a identidade da filial e a competência.
3. **Falha de leitura:** os campos e os handlers de escrita ficam bloqueados quando não há metas carregadas ou a consulta falha, evitando salvar os valores de fallback.
4. **Erros de outro contexto:** a troca de filial/competência limpa erros das mutations, impedindo que um conflito de outra seleção permaneça no painel.

O salvamento conserva os endpoints, os cinco indicadores e a competência normalizada. O bloqueio de atualização global enquanto houver metas específicas, a herança, a remoção de exceções e a paginação mantêm o contrato anterior. Não houve alteração de fórmulas, dicionários, tabelas, migrations ou código backend.

## Verificação

- Frontend: 307 testes em 51 arquivos, incluindo seis novos casos de regressão; TypeScript e lint dos arquivos alterados aprovados.
- Backend: 13 testes de `KpiGoalServiceTest` aprovados em profile `quality`, sem conexão operacional. Classes e relatórios em `backend/target/quality/20260910-metas-manager-check`.
- Encoding, configuração do ambiente e build frontend aprovados.
- Layout comparado com o candidato anterior em navegador isolado, usando APIs simuladas. Na amostra sem histórico/exceções, a altura em 1265px passou de 826px para aproximadamente 706px.

A conferência final aprovou **61 verificações no navegador**: layout em oito larguras, herança após atualização global, isolamento de rascunhos, escopo dos payloads, remoção e retorno à herança, limite de 100%, conflito HTTP 409, mudança de competência, falha HTTP 503 e paginação do histórico. Histórico/exceções preenchidos foram conferidos nos temas claro/escuro em 390/1265/1920px. Os dados foram simulados, sem gravações operacionais. Resumo em `.tmp/quality/20260910-metas-manager/summary.json`.

## Observação da revisão

O serviço legado ainda remove fisicamente exceções de metas e reduz o histórico a 200 registros por escopo. A revisão da interface preserva esse comportamento existente. A adequação à regra de exclusão lógica exige uma entrega própria, com migration, baseline e testes de retenção; foi registrada em `states.md`. Os testes desta rodada não executaram gravações em bancos reais nem comprovam o comportamento do SQL Server de produção.

## Candidato

`frontend/.tmp/quality-build/20260910-metas-manager-final/dist`. O candidato backend anterior continua válido; não foi substituído. Publicação e runtime permanecem com o operador humano.
