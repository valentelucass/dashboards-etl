# Visualização de canhotos — verificação de 10/09/2026

A coluna **Canhoto** foi retirada das tabelas de pendências e integrados com sucesso, conforme autorizado caso a visualização não funcionasse. O modal sem outros consumidores, os botões e o estado de abertura também foram removidos. Os status de Comprovante/POD continuam na tabela; não houve alteração de processamento, envio, arquivos ou auditoria dos clientes.

## Evidência real, somente leitura

Foram consultados os três registros Vedacit da captura no endpoint local de auditoria, para o período de 01 a 10/09, sem iniciar processos ou realizar reenvios:

| Registro de auditoria | Referência recebida | Endpoint de imagem do Satélite | Referência aberta na UI local |
| --- | --- | --- | --- |
| 7579 | Ausente | HTTP 404, corpo vazio | Não aplicável |
| 10362 | Caminho relativo de arquivo JPG | HTTP 404, corpo vazio | HTTP 200, `text/html`, 823 bytes |
| 10180 | Caminho relativo de arquivo JPG | HTTP 404, corpo vazio | HTTP 200, `text/html`, 823 bytes |

O botão era habilitado pela existência de `canhotoReferencia`, sem verificar se ela entregava uma imagem. O modal inseria essa referência diretamente em `img.src`/`object.data`. Nos dois registros habilitados, o navegador recebia a página HTML do Dashboard no lugar da foto. O indicador `possuiImagemPayload` do SQL também testa apenas referência não nula; não comprova disponibilidade de bytes.

O endpoint de imagem existente no Satélite extrai conteúdo exclusivamente de payloads antigos PPG. Ele não lê comprovantes Vedacit do SFTP, e o modal nem o utilizava. A correção não consiste em trocar somente o endereço do botão: seria necessário implementar e validar uma entrega autenticada de arquivos por registro/cliente. Essa nova funcionalidade não foi criada nesta remoção.

As sondagens usaram apenas as APIs locais já em execução, com timeout, sem autenticação em ESL/SFTP/SOAP, sem escrita SQL e sem guardar ou expor imagens, chaves fiscais ou caminhos completos de comprovantes. A evidência confirma a falha dos registros examinados; não afirma que nenhuma referência histórica de outro cliente possa apontar para uma imagem válida.

## Verificação do pacote

Os 21 testes frontend existentes de contratos e ciclos passaram; lint da página sem erros, TypeScript e build Vite concluídos. A busca por consumidores remanescentes do modal e dos botões removidos não encontrou ocorrências. Não foi criado teste para apenas reproduzir a remoção de uma coluna; a decisão foi sustentada pelas respostas HTTP reais acima. O Vite mantém o aviso já existente de chunks grandes.

Build frontend preparado em saída isolada `frontend/.tmp/build-check`. Validação registrada em `frontend/.tmp/integracoes-build-sem-canhoto.log`. A publicação continua sob controle do operador; `dist-prod`, JARs e processos operacionais não foram alterados.
