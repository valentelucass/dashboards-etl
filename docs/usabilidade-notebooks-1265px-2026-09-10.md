# Organização para notebooks — 1265 px

O lote segue as dez imagens recebidas. As mudanças de organização estão restritas a `1024px <= largura < 1536px`, tendo 1265 px como referência. Os breakpoints globais foram preservados. A funcionalidade de notificações, a correção da distribuição com um único status e a padronização de fonte expressamente solicitada no item 8 estão disponíveis em todas as resoluções.

| Item | Entrega |
| --- | --- |
| 1 | Home: Command Center ampliado de 320 para 360 px na faixa intermediária, com redução correspondente da coluna principal. Sino com contador de não lidas e popup na barra superior, no menu lateral e no Command Center. |
| 2 | Coletas: duas linhas de cinco e quatro KPIs, com larguras proporcionais aos títulos/ícones e valores formatados. Valor NF recebe mais espaço; as duas linhas ocupam toda a largura. |
| 3 | Cotações: tabela Performance por Usuário com colunas proporcionais, barra de conversão flexível e nomes com quebra de linha. Volume permanece visível. O componente compartilhado aplica a mesma organização às visões Filial e Clientes. |
| 4 | Faturamento: formulário de metas organizado em duas linhas, Filial ampliada e campos/botões contidos no painel. |
| 5 | Faturas por Cliente: o código tratava um único status como estado vazio (`length <= 1`). Agora a distribuição também desenha o donut de 100%; ausência de registros e erro continuam distintos. Dicionário de gráficos atualizado, sem mudança na contagem SQL. |
| 6 | Gestão à Vista: os cinco controles Mostrar/Ocultar tabela ficam no cabeçalho da própria tabela na faixa intermediária. O relacionamento acessível entre botão e conteúdo usa `aria-expanded`/`aria-controls`. |
| 7 | Integrações: oito indicadores do resumo distribuídos horizontalmente abaixo do gráfico. Altura do resumo em 1265 px: 278 → 78 px, redução de 72%. |
| 8 | Performance: Valor NF sem Comprovante passa a usar 24 px, como os demais valores padrão, em todas as resoluções. Em mobile, a altura natural desse card acompanha a fonte (71 → 79 px). |
| 9 | Saúde do ETL: resumo em duas linhas com espaço proporcional para datas, registros e timestamps. A altura medida em 1265 px caiu de 417 para 144 px, redução de 65%. |
| 10 | Executivo: duas linhas de três e quatro KPIs, com pesos por conteúdo. Valor Faturado e os demais valores monetários recebem espaço proporcional; indicadores de contagem deixam de ocupar a maior parte da segunda linha. |

## Comunicações e persistência

- `V068__criar_leituras_home_comunicados.sql` cria `acesso.home_comunicado_leituras` exclusivamente no banco próprio. A mesma definição está no baseline V001, com chave primária usuário/comunicado e referências às tabelas existentes.
- `GET /api/painel/home/comunicados` inclui `naoLido`, calculado por SQL a partir da versão temporal do comunicado e da leitura daquele usuário. Registros arquivados não participam.
- `PUT /api/painel/home/comunicados/{id}/leitura` recebe a versão que foi aberta e resolve o usuário pela sessão autenticada. O MERGE com `HOLDLOCK` evita duplicidade; versão divergente não marca uma edição concorrente como lida.
- Abrir e fechar o popup não marca toda a lista como lida. É necessário abrir o conteúdo de cada comunicado. Falha de leitura mantém o alerta; leitura bem-sucedida invalida a consulta compartilhada da Home e dos sinos.
- A consulta usa cancelamento e atualização a cada 60 segundos com a aba ativa. O cache continua isolado pela identidade/escopo da sessão, conforme o mecanismo já existente.

## Validação e artefatos

- Execução completa `.tmp/quality/20260910-124529-c01997/summary.json`: 691 testes backend e 301 frontend, TypeScript, lint sem avisos, encoding, ambiente e builds aprovados. Fingerprints operacionais preservados.
- Após a conferência dos limites, o frontend corrigiu a precedência de `xl` na composição dos resumos e reservou mais largura para datas do ETL em 1024 px. A execução final `.tmp/quality/20260910-notebooks-final/summary.json` repetiu os 301 testes frontend, TypeScript, lint, encoding, ambiente e build com sucesso, preservando os artefatos operacionais.
- Candidato frontend: `frontend/.tmp/quality-build/20260910-notebooks-final/dist`.
- Candidato backend: `backend/target/quality/20260910-124529-c01997/dashboard-api-1.0.0.jar`.
- Evidências visuais: `frontend/.tmp/notebook-audit` (100 cenários iniciais), `frontend/.tmp/notebook-followup` (interações e diagnóstico dos limites) e `frontend/.tmp/notebook-final-audit` (conferência do candidato final). O navegador usa APIs artificiais, DNS externo bloqueado e servidor em porta aleatória; não acessa bancos, APIs operacionais ou sessões reais.
- A conferência final aprovou 125 verificações em 40 cenários nas larguras 390, 1023, 1024, 1265, 1280, 1535, 1536 e 1920 px, sem erros JavaScript ou falhas do interceptador. Inclui expansão/recolhimento das cinco tabelas, leitura de comunicado em outra página, igualdade do contador no drawer e na barra, indicadores completos e resumos com largura integral em toda a faixa intermediária. O resumo está em `frontend/.tmp/notebook-final-audit/summary.json`.
- Os testes backend exercitam a consulta de não lidos em H2 isolado, incluindo usuários distintos, leitura de versão anterior e arquivamento, além da autorização e preservação da versão recebida pelo serviço. A sintaxe específica do MERGE/DDL de SQL Server não foi executada em um banco real nesta entrega. Migration e baseline foram preparados para publicação conjunta pelo operador.

Os layouts fora da faixa intermediária foram comparados com o candidato anterior em 390 e 1920 px. A exceção de tamanho do item 8 é intencional. As alturas dos gráficos permanecem em 400 px nos dois resumos; fórmulas, fontes, filtros e regras de negócio dos KPIs foram preservados. Produção continua sob controle do operador humano.
