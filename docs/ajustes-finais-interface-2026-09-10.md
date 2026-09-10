# Ajustes finais da interface — 10/09/2026

A referência continua sendo o viewport de 1265 px. Neste lote, o usuário autorizou expressamente a organização dos formulários e filtros também nos monitores maiores, com adaptação no mobile. Rodapé, exportações e controles locais de tabela são globais. Os breakpoints e os ajustes de gráficos/KPIs do lote anterior foram preservados.

## Checklist entregue

| Item | Resultado |
| --- | --- |
| 1 | Gestão de Setores: nome e descrição na mesma linha a partir de 1024 px; escopo e seletores de filiais ocupam a linha seguinte. |
| 2 | Gestão de Usuários: nome, e-mail e senha na mesma linha a partir de 1024 px. Importação fica junto das ações do formulário. |
| 3 | Confirmação de senha, setor e status formam a segunda linha, sem alterar validações ou permissões. |
| 4 | Papéis administrativos distribuem a largura conforme as opções recebidas; admitem quebra se a quantidade superar o espaço disponível. |
| 5 | Rodapé com identificação RodoGarcia, ano corrente e direitos reservados, Lucas Andrade com o mesmo LinkedIn e suporte por e-mail. A atualização usa `deployedAt`; quando só existe `builtAt`, informa “Versão gerada em”. O ID permanece no título auxiliar, sem ocupar outro selo. DEV sem data não inventa atualização. |
| 6 | Filtros com período separado das dimensões, campos agrupados conforme sua quantidade, alturas consistentes e limpeza integrada. A faixa de chips aparece somente com seleções ativas. Drawer mobile e filtros da apresentação permanecem funcionais. |
| 7 | CSV no cabeçalho da tabela, junto da busca, filtros, limpeza e linhas. Gestão à Vista usa o cabeçalho local de cada uma das cinco tabelas, com expansão/recolhimento no mesmo lugar em qualquer resolução. Controles de recolhimento continuam disponíveis durante o carregamento. |

## Páginas conferidas

Filtros e exportação: Coletas; Cotações (CSV na aba Análise); Faturamento; Manifestos; Performance; Faturas por Cliente; Contas a Pagar; Localização de Cargas; Executivo; Saúde do ETL; Integrações; Indicadores de Gestão à Vista.

Formulários: Gestão de Setores e Gestão de Usuários. Rodapé compartilhado por todas as páginas autenticadas.

As exportações de Executivo, Saúde do ETL e Integrações já ficavam no cabeçalho e foram conferidas sem duplicação. As demais reutilizam `acoesCabecalho` de `AnalyticalDataTable`/`DataTable`. Nenhum endpoint, filtro enviado, formato de arquivo, cálculo, fonte analítica ou contrato de KPI foi alterado.

## Validação

- 301 testes frontend aprovados, TypeScript, lint, encoding, configuração de produção e build. Logs e resumo em `.tmp/quality/20260910-final-layout`.
- Navegador Edge isolado com APIs artificiais e portas aleatórias. Matriz de 14 páginas × 7 larguras: 390, 768, 1024, 1265, 1280, 1536 e 1920 px. Dados, formulários, filtros, rodapé e posição dos CSVs registrados em `frontend/.tmp/final-layout-audit`.
- Conferência complementar das três páginas administrativas/Gestão à Vista no candidato final em `frontend/.tmp/final-layout-ready-audit` (21 cenários/120 verificações); interações, filtros enviados no CSV, datas do rodapé e apresentação em `frontend/.tmp/final-layout-interactions`. O CSV da Saúde do ETL foi reconferido depois do carregamento da tabela em `frontend/.tmp/final-layout-etl-export`.
- Consolidação final: **636 verificações aprovadas**, em `.tmp/quality/20260910-final-layout/browser-checks.json` e `summary.json`. A consolidação considera a última execução de cada caso: o roteiro passou a distinguir o botão da tabela analítica de cubagem do botão da lista de clientes, a contar somente GETs de exportação (sem preflight OPTIONS) e a aguardar a tabela ETL antes de exportar. As evidências anteriores permanecem preservadas.
- Candidato frontend: `frontend/.tmp/quality-build/20260910-final-layout-ready/dist`. Backend e migrations não foram alterados neste lote; mantém-se o candidato backend e a V068 preparados na entrega anterior.
- Produção, portas 5010/5173, arquivos de ambiente e artefatos operacionais não foram modificados. Publicação continua com o operador humano.

## Refinamento: datas e lista de comunicações

- De/Até reservam 164px por campo no painel desktop para separar o valor e o ícone nativo. Atalhos curtos ficam menores que os de texto longo, distribuindo proporcionalmente o restante da linha. O período pode quebrar quando a largura disponível exige.
- O popup limita sua altura ao viewport e ao espaço disponível na âncora. A lista comporta aproximadamente cinco avisos recolhidos; quantidade maior ou texto expandido usa rolagem interna, mantendo título e botão de fechar visíveis. A rolagem fica contida na lista.
- Os nove testes existentes de período e comunicações passaram, assim como TypeScript, lint do componente, encoding e validação do ambiente de produção. APIs de leitura, atalhos e callbacks de data foram preservados.
- Navegador: 104 verificações consolidadas aprovadas, cobrindo as 12 páginas em 1265px, larguras adicionais de 390/768/1024/1920px e listas com 5, 6 e 15 comunicados, além de texto expandido em janela baixa. Resumo em `.tmp/quality/20260910-dates-notices/summary.json`; imagens em `frontend/.tmp/dates-notices-ready-audit` e `frontend/.tmp/dates-notices-audit`.
- Candidato frontend mais recente: `frontend/.tmp/quality-build/20260910-dates-notices-ready/dist`, com build aprovado e produção preservada.
