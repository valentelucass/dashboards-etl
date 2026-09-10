# Integrações — origem e significado dos comprovantes

A tela agora separa arquivos encontrados, trabalho realizado no ciclo e pendências acumuladas. A coluna **Origem dos comprovantes** e os filtros de cliente/origem permitem identificar a fonte de busca auditada. O filtro de resultado permanece no histórico. As contagens mantêm os valores retornados pelo Satélite, com unidades e explicações em português, acessíveis por mouse e teclado.

## Como interpretar o exemplo

| Exibição | Significado |
| --- | --- |
| 3.058 arquivos reconhecidos | Arquivos que passaram pelas verificações de identificação/inventário no SFTP, inclusive arquivos já tratados. Não é quantidade enviada no ciclo. |
| 37 arquivos rejeitados | Entradas recusadas por nome, tamanho, tipo ou estabilidade; não significa necessariamente conteúdo fiscal inválido. |
| 1 NF-e avaliada | Uma nota selecionada e tratada naquele ciclo. |
| 0 comprovantes enviados / 1 NF-e pendente | A nota foi avaliada, mas o comprovante permaneceu pendente. |
| 1 NF-e na fila normal | Saldo de notas distintas ainda elegíveis no inventário do ciclo. |
| 780 registros bloqueados | Bloqueios ativos acumulados do cliente, fora de reenvio automático. |
| 18 envios sem confirmação (timeout) | Registros cujo envio pode ter chegado ao destino, mas sem confirmação conclusiva; ficam fora de reenvio automático. |

Saldo, bloqueios e timeouts têm critérios/unidades diferentes e não devem ser somados. O próximo ciclo é uma estimativa de término + 30 minutos, sem consultar se o processo está ligado.

## Origem e limites da auditoria

O Satélite declara `origemComprovantes=SFTP` porque a tabela consultada audita exclusivamente `WORK-SFTP-CLIENTES`, cuja busca de comprovantes não consulta a API ESL. Não foi acrescentada coluna de banco nem alterado o processamento das entregas. Essa origem não descreve a obtenção histórica do XML, nem o canal de envio ao cliente.

O filtro `origem` percorre as duas APIs e participa da consulta e contagem paginadas no Satélite. Selecionar `API_ESL` retorna vazio neste histórico específico; a interface explica que os ciclos de outros processos ainda não estão disponíveis. Isso não serve como evidência de consumo zero da ESL. Não foram criados ciclos fictícios nem reclassificados registros por nome de cliente.

Em 10/09, a consulta somente leitura às duas rotas do Satélite em execução confirmou respostas HTTP 200 com os 15 campos antigos, sem `origemComprovantes`. O JAR operacional ainda tem SHA-256 `EBC700C71B264A50EC933FDD290B3761DBB915152420AE5D6626746ADB7F60E2`; o candidato que inclui o campo não foi instalado. Essa é a causa de **Não informada** nas capturas.

O adaptador frontend agora identifica como SFTP as respostas antigas sem o campo **somente nas duas rotas exclusivas de auditoria do worker SFTP**. Essa compatibilidade usa o contrato da origem consultada, nunca o nome do cliente. Não altera a resposta recebida, as contagens nem a paginação. Valores explicitamente enviados, inclusive `API_ESL`, `null` e valores desconhecidos, são preservados; apenas valores reconhecidos recebem o rótulo correspondente.

Se a resposta contiver `API_ESL`, o cartão, a coluna e o filtro exibem **API ESL**, validado com o adaptador real e resposta HTTP simulada. Isso não significa que os processos ESL já sejam auditados: a consulta atual do Satélite lê apenas `tb_work_sftp_cliente_execucao` e declara SFTP. O `WorkSftpClientesRunner` exige `VEDACIT_SFTP_RECEIPT_ONLY=true`; a conversão de canhotos interrompe o processamento quando não encontra o documento, antes do fallback ESL. Já o fluxo geral pode usar ESL, mas seus ciclos e a origem efetiva de cada obtenção não chegam a esta consulta. A coluna não comprova ausência de consumo nem monitora todos os fallbacks do ecossistema.

Se uma API antiga ignorar o filtro, o histórico apresenta aviso e oculta a página incompatível, sem filtrar artificialmente a página no navegador ou exibir totais falsos. A troca de filtros reinicia a paginação e não mostra linhas antigas durante a nova consulta. Falha na consulta tem mensagem distinta de resultado vazio. Para `API_ESL`, o aviso explica que o servidor não disponibilizou os ciclos dessa origem, sem interpretar isso como consumo zero.

## Validação

- Frontend: 21 testes aprovados. Incluem o componente com o adaptador real e HTTP simulado: resposta antiga identificada como SFTP, origem API ESL exibida e filtrada, preservação de valores explícitos, paginação, resposta com origens incompatíveis, falhas HTTP, explicações pelo teclado e contagens em ciclos com falha.
- API Dashboard: quatro testes aprovados; um percorre controller, serviço e cliente HTTP com resposta simulada, verificando origem, página, período e preservação do corpo.
- Satélite: 27 testes aprovados, incluindo serialização da origem e aplicação do filtro tanto à página quanto à contagem. Testes Java com rede bloqueada, sem SQL ou integrações reais.
- TypeScript e build Vite de produção concluídos em saída isolada. Lint geral sem erros; os dois avisos de dependência de `useMemo` da página foram corrigidos e os arquivos alterados revalidados.
- Prévia no Edge headless com dados locais e `connect-src 'none'`, em desktop e janela estreita. A medição da janela estreita confirmou largura de documento igual à área útil (477 px), com rolagem horizontal restrita à tabela. Imagens locais em `frontend/.tmp/integracoes-preview/`.

## Artefatos preparados para atualização humana

| Componente | Artefato | SHA-256 |
| --- | --- | --- |
| Satélite | `satelite-tms-api/target/unit-tests/coverage-20260909-235105-562/satelite-0.0.1-SNAPSHOT.jar` | `FA925E2E524BDECB72AD171FE3741A120580172F07C4EE08790103C65BE5A2B4` |
| API Dashboard | `backend/target/integracoes-validation/20260909-235241/dashboard-api-1.0.0.jar` | `BE8C2080A309AD02252E3FAC61DA0AF3D3242D06BD4AE78C6E07D61092990BE2` |
| Frontend | `frontend/.tmp/build-check/` | Build atualizado com configuração de produção, registrado em `frontend/.tmp/integracoes-build-origem-layout.log`. |

O frontend atualizado funciona com as respostas antigas dos ciclos SFTP; as APIs candidatas acrescentam a origem explícita e o filtro no servidor. A auditoria de ciclos dos demais processos ESL continua sendo uma lacuna separada, não resolvida pela publicação desses candidatos. A montagem dos artefatos não executou deploy, migrations, escrita SQL, chamadas ESL/SFTP/SOAP ou start/restart. O `ecosystem.config.js`, o `.env`, o `dist-prod` e os JARs operacionais foram preservados.

## Organização visual em 10/09/2026

O resumo reúne cliente, origem, resultado, conexão e horários em um cabeçalho compacto. Abaixo, três colunas com divisórias alinham arquivos encontrados, trabalho do ciclo e pendências acumuladas. Os detalhes secundários compartilham a mesma linha quando há espaço, e zero envios tem cor neutra. A versão ampla mede 131 px na prévia de 1.900 px; em tela estreita as informações empilham e a rolagem horizontal fica restrita à tabela. As medições confirmaram largura de documento igual à área útil: 1.876 px no desktop e 501 px na janela estreita. Imagens em `frontend/.tmp/integracoes-preview/organizado.png` e `organizado-estreito.png`, com respostas antigas simuladas, adaptador real e conexões de dados bloqueadas.

O operador informou que o erro interno do histórico deixou de ocorrer; a consulta somente leitura ao Satélite confirmou HTTP 200. Esta revisão alterou apresentação, compatibilidade de leitura, testes e documentação. Os 21 testes direcionados, lint e TypeScript/Vite passaram; o build atualizado fica em `frontend/.tmp/build-check`. O Vite mantém o aviso de chunks grandes já existente, sem falha na compilação.
