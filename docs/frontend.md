> [!WARNING] DOCUMENTAÇÃO OBSOLETA / LEGADA
> Este arquivo registra uma fase anterior do projeto e não é fonte de verdade atual para arquitetura, sessão, ACL ou integração com views do ETL. Use os READMEs da raiz e a trilha canônica em `docs/arquitetura/` quando houver conflito.

Documentação Arquitetural: Frontend (Dashboard UI)
1. Stack Tecnológica Base
A combinação destas ferramentas visa tipagem estrita, performance de renderização e controle de estado de servidor sem mascaramento de dados.

Core: React 18+ com TypeScript.

Build Tool: Vite (substitui o Webpack por ser mais rápido na compilação local).

Roteamento: React Router DOM v6 (Gerencia as rotas protegidas e redirecionamentos).

Data Fetching & Caching: TanStack Query v5 (Obrigatório para o modelo não-blocante. Gerencia o estado de "carregando", "sucesso" e "erro" de cada gráfico de forma independente).

Comunicação HTTP: Axios (Permite criar interceptadores para injetar o token JWT e tratar erros globais como 401 e 503).

A visualização de dados usa Astryx Charts em `AstryxDashboardChart`. Os painéis compartilham barras, linhas, áreas, eixos e legendas. Roscas e semicírculos são marcas SVG desenhadas na superfície do Astryx.

Estilização: Tailwind CSS (Permite criar o layout via classes utilitárias, evitando arquivos CSS gigantescos e difíceis de manter).

2. Estrutura de Diretórios e Arquivos (Granularidade Máxima)
A topologia segue o padrão de isolamento por responsabilidade (separação de conceitos). Nomes de pastas estruturais em inglês; regras de negócio e componentes visuais em português.

Plaintext
/frontend
├── package.json                    # Declaração das dependências (React, Vite, ECharts, Axios).
├── tsconfig.json                   # Regras de compilação do TypeScript. Deve operar em modo "strict".
├── tailwind.config.js              # Configuração de temas, cores da empresa e espaçamentos.
├── vite.config.ts                  # Configuração da porta de desenvolvimento (ex: 3000) e proxies.
└── src/
    ├── main.tsx                    # Ponto de entrada absoluto. Monta a árvore do React no DOM.
    ├── App.tsx                     # Orquestrador de Rotas e Provedores de Contexto (TanStack, Auth).
    │
    ├── api/                        # Camada de Rede (Fronteira com o Java)
    │   ├── clienteAxios.ts         # Instância base do Axios. Define a URL do Java e injeta o JWT no header.
    │   ├── interceptadores.ts      # Captura erros globalmente. Ex: Se o Java retornar 403, força o logout.
    │   └── endpoints/
    │       ├── authServico.ts      # Função POST para /api/auth/login.
    │       ├── logisticaServico.ts # Funções GET para buscar dados da frota e fretes.
    │       └── financeiroServico.ts# Funções GET para faturamento e custos.
    │
    ├── types/                      # Contratos de Dados (A Garantia contra Mascaramentos)
    │   ├── IUsuarioSessao.ts       # interface { nome: string, setor: "FINANCEIRO" | "LOGISTICA", token: string }
    │   ├── IResumoFinanceiro.ts    # Espelho exato do DTO do Java. Se faltar um campo, o TS acusa erro.
    │   └── IStatusFrota.ts         # Espelho do DTO logístico.
    │
    ├── contexts/                   # Estado Global (Sem bibliotecas pesadas como Redux)
    │   ├── AutenticacaoContext.tsx # Armazena os dados do usuário logado e fornece a função de login/logout.
    │   └── FiltroDataContext.tsx   # Armazena { dataInicio, dataFim }. Se alterar aqui, os gráficos reagem.
    │
    ├── hooks/                      # Lógica Reativa Customizada
    │   ├── useFiltroData.ts        # Facilita a leitura/escrita do FiltroDataContext.
    │   └── queries/                # Integrações com o TanStack Query
    │       ├── useBuscarFretes.ts  # Hook que aciona logisticaServico e gerencia o cache.
    │       └── useBuscarCustos.ts  # Hook que aciona financeiroServico e gerencia o cache.
    │
    ├── components/                 # Blocos Visuais de Montagem
    │   ├── layout/                 # Estrutura da Página
    │   │   ├── RotaProtegida.tsx   # Componente interceptador. Valida permissões antes de renderizar a tela.
    │   │   ├── EstruturaPainel.tsx # O "esqueleto" (Navbar superior + área de conteúdo).
    │   │   └── BarraNavegacao.tsx  # Exibe o usuário logado e o botão de sair.
    │   │
    │   ├── ui/                     # Interface de Usuário Genérica (Burra)
    │   │   ├── EsqueletoCard.tsx   # O efeito "shimmer" cinza que aparece enquanto os dados carregam.
    │   │   ├── MensagemErro.tsx    # O card vermelho amigável ("Serviço Indisponível").
    │   │   └── SeletorPeriodo.tsx  # O input duplo de datas que atualiza o FiltroDataContext.
    │   │
    │   └── charts/                 # Gráficos Isolados
    │       ├── GraficoFreteEcharts.tsx  # Recebe os dados brutos e os converte para a estrutura do ECharts.
    │       └── GraficoFrotaEcharts.tsx  # Gráfico de pizza ou rosca indicando status dos caminhões.
    │
    ├── pages/                      # Montadores Finais (Telas Completas)
    │   ├── LoginPage.tsx           # Contém o formulário. Dispara authServico e redireciona via perfil.
    │   ├── PainelLogisticaPage.tsx # Agrupa EsqueletoCard, MensagemErro e GraficoFreteEcharts.
    │   ├── PainelFinanceiroPage.tsx# Agrupa gráficos financeiros.
    │   └── AcessoNegadoPage.tsx    # Tela para interceptações de segurança da RotaProtegida.
    │
    └── utils/                      # Lógica Pura (Testável sem React)
        ├── gerenciadorSessao.ts    # Salva/Lê o token no sessionStorage para não perder ao dar F5.
        └── formatadorValores.ts    # Funções para máscaras de dinheiro e datas (ex: DD/MM/AAAA).
3. Arquitetura de Roteamento e Autenticação (Redirecionamento Ativo)
O sistema não possui um menu central. O destino é determinado pela identidade da rede (Active Directory).

Ação de Login: O usuário acessa /login e insere credenciais.

Processamento (LoginPage.tsx):

Chama authServico.login(user, pass).

Recebe o IUsuarioSessao (Token + Setor).

Salva no sessionStorage via gerenciadorSessao.ts.

Atualiza o AutenticacaoContext.

Redirecionamento Automático:

Avalia o campo setor.

Se setor === "LOGISTICA", executa Maps("/painel-logistica", { replace: true }).

A Trava (RotaProtegida.tsx):

Envolve as rotas no App.tsx (Ex: <RotaProtegida rolesPermitidas={["LOGISTICA"]}> <PainelLogisticaPage /> </RotaProtegida>).

Se o usuário tentar forçar a URL /painel-financeiro, o componente lê o sessionStorage, constata a violação e redireciona para /acesso-negado.

4. O Padrão Não-Blocante (Progressive Loading)
A exigência de uma tela que não congela é atendida pela arquitetura de componentes autônomos. A página não espera os dados para ser desenhada.

A PainelLogisticaPage.tsx é montada quase instantaneamente. O layout (EstruturaPainel.tsx) e os filtros (SeletorPeriodo.tsx) já ficam visíveis.

Dentro da página, invocamos os gráficos. Cada gráfico usa o seu próprio hook (ex: useBuscarFretes()).

O TanStack Query imediatamente retorna isLoading: true.

O componente avalia: if (isLoading) return <EsqueletoCard />.

Quando o JSON chega validado e processado, o React re-renderiza apenas aquele componente de gráfico específico, substituindo o esqueleto pelo Apache ECharts. Se a query demorar 5 segundos, o usuário não fica paralisado; ele pode interagir com os filtros.

5. Resiliência e Isolamento de Falhas (Error Boundaries)
Se a requisição do useBuscarFretes() falhar (ex: SQL Server fora do ar, gerando um erro 503 vindo do Java), o estado do TanStack Query muda para isError: true.

O componente avalia: if (isError) return <MensagemErro texto="Dados indisponíveis no momento" />.

A página continua operando. O gráfico ao lado, que busca dados de frota em outra query, pode carregar normalmente se não tiver falhado. O erro é contido.
