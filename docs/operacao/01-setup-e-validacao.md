# Setup, Ambientes e Validacao

## Requisitos locais

- Java 17 ou superior
- Node.js com npm
- acesso ao SQL Server usado pela API
- arquivo `.env.development.local` na raiz de `dashboards` para DEV local

## Configuracao de ambiente

### Arquivos de ambiente

Arquivos:

- `.env`: reservado para produção
- `.env.development`: frontend Vite dev, versionado
- `.env.development.local`: backend DEV, ignorado pelo Git

Variaveis minimas em `.env.development.local`:

```env
API_BASE_URL=http://localhost:5011
VITE_API_BASE_URL=http://localhost:5011
SERVER_ADDRESS=127.0.0.1
DB_URL=jdbc:sqlserver://HOST_DEV:1433;databaseName=DASHBOARDS_DEV;encrypt=true;trustServerCertificate=true
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
JWT_SECRET=segredo-forte
API_KEY=chave-interna
AUTH_SESSION_EXPIRACAO_HORAS=24
ACESSO_USUARIO_SUPREMO_EMAIL=admin-seguro@empresa.com
ACESSO_USUARIO_SUPREMO_SENHA_INICIAL=senha-forte-fora-do-codigo
ACESSO_USUARIO_SUPREMO_NOME=Administrador Supremo
ACESSO_USUARIO_SUPREMO_PAPEL=desenvolvedor
ACESSO_USUARIO_SUPREMO_NIVEL=1000
VITE_ACESSO_USUARIO_SUPREMO_PAPEL=desenvolvedor
```

Copie `.env.development.local.example` para `.env.development.local` e aponte `DB_URL` para um banco diferente de `DASHBOARDS`. O script `iniciar-dev.bat` e o backend recusam `databaseName=DASHBOARDS` no profile `dev`.

Configuracoes importantes no `application.yml`:

- porta padrao `5010`; em dev local o `iniciar-dev.bat` sobrescreve para `5011` via `SERVER_PORT`
- timeout JPA `30000`
- periodo timezone `America/Sao_Paulo`
- JWT `15 minutos`
- bind local da API por padrao em `127.0.0.1`

## Producao com Cloudflare Tunnel

Na VM, use as variaveis abaixo junto das credenciais reais:

```env
ENVIRONMENT=production
SPRING_PROFILES_ACTIVE=prod
VITE_API_BASE_URL=https://api-analytics.rodogarcia.com.br
SERVER_ADDRESS=127.0.0.1
SECURITY_TRUST_FORWARDED_HEADERS=true
AUTH_REFRESH_COOKIE_SECURE=true
AUTH_REFRESH_COOKIE_SAME_SITE=Lax
AUTH_SESSION_EXPIRACAO_HORAS=24
ACESSO_USUARIO_SUPREMO_EMAIL=admin-seguro@empresa.com
ACESSO_USUARIO_SUPREMO_SENHA_INICIAL=senha-forte-fora-do-codigo
ACESSO_USUARIO_SUPREMO_NOME=Administrador Supremo
ACESSO_USUARIO_SUPREMO_PAPEL=desenvolvedor
ACESSO_USUARIO_SUPREMO_NIVEL=1000
VITE_ACESSO_USUARIO_SUPREMO_PAPEL=desenvolvedor
CORS_ORIGENS_PERMITIDAS=https://analytics.rodogarcia.com.br
```

O backend de produção usa o perfil `prod` na porta `5010`. A interface estática usa a porta `5173`. Para gerar o pacote de produção na VM, execute o comando abaixo.

```powershell
.\iniciar-prod.bat
```

O comando exige a branch `main` limpa, confere a leitura do relatório de Localização de Cargas e gera o servidor, a interface e o manifesto em `.tmp/production/<build-id>`. Na publicação, o operador instala o pacote nos dois processos do painel no PM2 e confere a versão em `/build-info.json`, o login e os relatórios no endereço público.

Antes da publicação, confirme que o ETL concluiu o lote e que a fila de relatórios na V2 está vazia. Aplique as migrações do portal no banco `DASHBOARDS` com Flyway. As migrações V072 a V076 usam os relatórios preparados em `ETL_SISTEMA_V2.pub`. A API acessa esses relatórios pelos sinônimos locais.

O Cloudflare Tunnel deve apontar `analytics.rodogarcia.com.br` para `http://127.0.0.1:5173` e `api-analytics.rodogarcia.com.br` para `http://127.0.0.1:5010`.

Permissoes minimas esperadas para o usuario SQL da API no schema `acesso`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA :: acesso TO usuario_etl;
```

O usuario de runtime da API nao deve manter permissoes DDL permanentes. Migrations Flyway devem ser executadas por uma credencial elevada e isolada da esteira de deploy, com permissao para criar `dbo.flyway_schema_history` e alterar os objetos versionados apenas durante a janela de migracao. Conceder `CREATE TABLE`/`ALTER` ao `usuario_etl` em producao e uma excecao operacional temporaria e deve ser revertida quando o pipeline de deploy automatico existir.

Para permitir varios usuarios novos sem `chave_legado`, aplique a migration `V009__corrigir_unique_chave_legado_usuarios.sql` no banco de producao antes de validar o cadastro de usuarios. Ela troca a restricao `UNIQUE` comum por um indice unico filtrado que ignora `NULL`.

## Backup do banco próprio

O repositório versiona a rotina de backup do banco próprio `DASHBOARDS`/`DASHBOARDS_DEV` em `scripts/backup-dashboard-db.ps1`. O script lê `DB_URL`, `DB_USER`, `DB_PASSWORD`, `DASHBOARDS_BACKUP_DIR` e `DASHBOARDS_BACKUP_RETENTION_DAYS` do `.env`, executa `BACKUP DATABASE`, valida o arquivo com `RESTORE VERIFYONLY` e bloqueia bancos fora do domínio do portal.

Backup manual:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-dashboard-db.ps1 -EnvFile .\.env -BackupDirectory C:\Dashboards\backups\sqlserver -RetentionDays 14
```

Registro da tarefa diária no Agendador do Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-dashboard-backup-task.ps1 -EnvFile .\.env -BackupDirectory C:\Dashboards\backups\sqlserver -At 02:15 -RetentionDays 14
```

## Como subir localmente

### Opcao 1: script do monorepo

```powershell
.\iniciar-dev.bat
```

Resultado esperado:

- API dev em `http://localhost:5011`
- UI dev em `http://localhost:5174`

### Opcao 2: manual

Backend:

```powershell
cd .\backend
.\mvnw.cmd spring-boot:run
```

Frontend:

```powershell
cd .\frontend
npm install --legacy-peer-deps
npm run dev
```

## Observacao importante sobre Java no Windows

Ja ocorreu de `java -version` apontar para Java 8 enquanto o Maven wrapper usava um JDK moderno.

Sinais de problema:

- `java -jar` falha com `UnsupportedClassVersionError`;
- `.\mvnw.cmd -v` mostra um JDK mais novo que `java -version`.

Acao recomendada:

- preferir `.\mvnw.cmd spring-boot:run`; ou
- rodar o JAR com `& "$env:JAVA_HOME\bin\java.exe" -jar .\target\dashboard-api-1.0.0.jar`; ou
- ajustar `JAVA_HOME` e `PATH` antes de rodar o jar diretamente.

## Testes de rotina

Backend:

```powershell
cd .\backend
.\mvnw.cmd test
```

Frontend:

```powershell
cd .\frontend
npm test -- --run
npx tsc --noEmit
npm run lint
npm run build
npm run check:encoding
```

`npm run build` gera apenas o build de checagem em `frontend/.tmp/build-check`. O diretório servido em produção, `frontend/dist-prod`, deve ser gerado somente por `.\iniciar-prod.bat`.

## Validacao automatica do BI

Script principal:

- `scripts/validate-dashboard-consistency.mjs`

Pre requisitos:

- API dev local respondendo em `5011`
- SQL Server acessivel com as credenciais do `.env`
- ao menos um usuario ativo em `acesso.usuarios`

Execucao simples:

```powershell
node scripts/validate-dashboard-consistency.mjs
```

Execucao com periodo explicito:

```powershell
node scripts/validate-dashboard-consistency.mjs --apiBaseUrl=http://localhost:5011 --dataInicio=2026-02-24 --dataFim=2026-03-26
```

Saida:

- `reports/validacao-dashboard-<inicio>_<fim>.md`
- `reports/validacao-dashboard-<inicio>_<fim>.json`

## Bateria recomendada antes de fechar bug de filtro

Rodar pelo menos:

- `7d`
- `15d`
- `30d`
- `60d`
- `90d`
- `180d`

Motivo:

- garante que o problema nao esta escondido so na fronteira de periodo;
- detecta regressao em dashboards com `DATETIMEOFFSET`;
- diferencia bug de codigo de oscilacao de dados ao vivo no ETL.

## Gate minimo para considerar uma mudanca pronta

- testes backend passando;
- testes frontend passando;
- TypeScript limpo;
- lint limpo;
- build de producao passando;
- validacao BI em `100%` para os periodos relevantes;
- documentacao atualizada se houver mudanca de contrato ou operacao.
