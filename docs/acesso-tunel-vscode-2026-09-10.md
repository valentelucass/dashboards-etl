# API pelo Ports do VS Code — 10/09/2026

## Diagnóstico e alteração

A página de login aberta em `https://<tunel>-5174.brs.devtunnels.ms` usava `http://127.0.0.1:5011` como endereço absoluto da API. Esse endereço era acessado pelo navegador da outra máquina. A mensagem de indisponibilidade não demonstrava que o processo do backend estava desligado: o destino da requisição estava incorreto para acesso remoto.

`frontend/src/config/api.ts` agora usa endereço relativo em DEV. O navegador solicita `/api/...` na origem da página; `frontend/vite.config.ts` encaminha somente esse prefixo à API DEV fixa `http://127.0.0.1:5011`, na máquina do projeto. Login, refresh silencioso, logout, consultas, uploads e downloads compartilham o cliente/endereço existente, sem alteração nos endpoints ou nos contratos de dados. A configuração `VITE_API_BASE_URL` continua validada para impedir apontamento DEV à API de produção. Builds de produção mantêm a URL externa configurada.

`frontend/config/devApiProxy.ts` centraliza o proxy. A origem é validada antes de ser normalizada para o CORS local aceito pelo Spring. Origens desconhecidas, `Origin: null` e requisições explicitamente cross-site são bloqueadas antes de alcançar a API. O destino não é escolhido por parâmetro, Host ou cabeçalho encaminhado. Os cookies permanecem com `HttpOnly`, `SameSite` e `Path=/api/auth`, sem alterações no backend. Falha de conexão ao destino retorna HTTP 503.

O Vite continua vinculado a `127.0.0.1`; sua validação de Host permanece ativa. `DASHBOARD_DEV_TUNNEL_ORIGIN` é uma opção para informar uma origem HTTPS exata de um túnel que preserve Host/Origin públicos. É lida apenas pelo servidor DEV, sem prefixo `VITE_`, e admite somente esse hostname/origem adicional. Não há liberação global de `devtunnels.ms`, `allowedHosts: true`, CORS irrestrito ou confiança em `X-Forwarded-Host`. O proxy também fica ausente do preview.

## Uso

1. Mantenha a API DEV 5011 e o frontend DEV 5174 em execução na máquina do projeto.
2. No painel Ports do VS Code, encaminhe **5174**. Não é necessário um segundo túnel para a API.
3. Abra o endereço HTTPS na outra máquina e recarregue a página com `Ctrl+F5` após obter a correção.
4. Prefira visibilidade **Private**, entrando com a conta usada no VS Code.

Somente se o túnel preservar os cabeçalhos públicos e houver bloqueio de hostname/origem, adicione em `.env.development.local` na raiz:

```dotenv
DASHBOARD_DEV_TUNNEL_ORIGIN=https://SEU-TUNEL-5174.brs.devtunnels.ms
```

Use apenas a origem do seu túnel atual, sem `/login`. Quando o endereço mudar, atualize essa configuração opcional. O acesso real verificado nesta rodada funcionou com a configuração padrão, sem editar arquivos `.env`.

## Evidência

- **296 testes frontend aprovados em 49 arquivos**, incluindo 31 testes novos de resolução da URL, isolamento DEV/PROD, configuração de origem e integração HTTP do proxy Vite real com API simulada.
- Os testes HTTP verificam corpo e Bearer token, origens locais/externa autorizada, bloqueio de outro túnel/Host/Origin, login, encaminhamento de cookie, rotação de refresh, limpeza no logout, parâmetros, arquivo binário, `Content-Disposition`, status 401, recorte do prefixo `/api` e API desligada. Não usam credenciais reais ou banco.
- TypeScript, lint sem avisos, encoding, validação do ambiente de produção e build isolado aprovados. Cobertura frontend: 23,61% linhas, 72,20% branches e 50,93% funções; a cobertura continua parcial. O aviso existente de tamanho de chunk do build permanece.
- Configuração Vite real carregada nos modos DEV, build de produção e preview DEV: proxy presente somente no primeiro.
- Verificação real em **10/09/2026 às 15:02 UTC**: `GET /api/auth/me` retornou o mesmo contrato JSON HTTP 401 diretamente pela API DEV, pelo proxy local e pelo túnel informado. A resposta foi identificada pelos campos `timestamp`, `status`, `erro`, `mensagem` e pela mensagem de autenticação do próprio backend; não se tratava de um bloqueio do serviço de túneis. As requisições não enviaram credenciais. Isso comprova a comunicação até a API, não um login autenticado com a conta do usuário.

Registros locais: `.tmp/quality/20260910-tunel/summary.json`, `tests.log`, `tunnel-smoke.json` e logs das verificações. Candidato frontend: `frontend/.tmp/quality-build/20260910-tunel/dist`. Os 687 testes backend da rodada anterior não foram reexecutados: não houve alteração Java. O candidato backend continua `backend/target/quality/20260910-103509-123598/dashboard-api-1.0.0.jar`.

Fingerprints dos arquivos de ambiente, configuração operacional, JAR operacional, `frontend/dist-prod` e build operacional anterior permaneceram iguais. Não houve publicação, gerenciamento de processos ou alteração nas portas de produção 5010/5173.

## Referências

O encaminhamento e a autenticação de portas privadas seguem a [documentação oficial do VS Code](https://code.visualstudio.com/docs/debugtest/port-forwarding). O proxy e a lista restrita de hosts seguem as [opções de servidor do Vite](https://vite.dev/config/server-options). O comportamento de reescrita de Origin em Dev Tunnels está registrado no [repositório oficial da Microsoft](https://github.com/microsoft/dev-tunnels/issues/284); a solução foi verificada também contra o túnel real informado nesta tarefa.
