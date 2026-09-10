# Scripts

## Qualidade isolada, cobertura e build

Na raiz, execute `./scripts/run-quality.ps1`. O runner seleciona um JDK 17 instalado em Eclipse Adoptium, ou aceita `-JavaHome 'C:/caminho/jdk-17'`. Ele exige Maven, Node e dependências frontend previamente instalados; não instala nem atualiza pacotes.

O perfil Maven `quality` rejeita JDK incompatível antes de compilar, exclui SQL Server JDBC e spring-dotenv do processo de testes, desabilita Flyway e usa configuração exclusiva de teste. Os testes atuais são unitários, MVC em memória, HTTP simulado e H2 em memória. Não há inicialização do Spring Boot completo, execução de migrations, consultas a bancos reais ou teste de carga nos serviços operacionais. Isso não substitui um sandbox de rede do sistema operacional para testes futuros arbitrários.

Cada execução cria um diretório próprio em `backend/target/quality/<execução>` e `frontend/.tmp/quality-build/<execução>`. Executa Maven `verify` com JaCoCo e JAR candidato, Vitest com V8, TypeScript, ESLint, encoding, validação do ambiente frontend e build Vite. O processo Java usa um único fork com heap máximo de 512 MB; Vitest usa até dois workers. Um fingerprint confirma a preservação dos arquivos operacionais monitorados, incluindo JAR, `dist-prod`, configurações e o candidato anterior `build-check`.

Resultados e códigos de saída ficam em `.tmp/quality/<execução>/summary.json`. Relatórios HTML: `<backendOutput>/site/jacoco/index.html` e `<frontendOutput>/coverage/index.html`. As coberturas incluem código sem testes. Pisos iniciais: backend 49% de linhas/38% de ramificações; frontend 19% de linhas/statements, 66% de ramificações e 44% de funções. Esses pisos detectam quedas relevantes na base medida; não representam cobertura completa nem uma meta final.

`-Audit` acrescenta `npm audit --omit=dev --json`, sem aplicar correções. Para conferir dependências Java por versão, gere `mvn.cmd -B -ntp -f backend/pom.xml -Pquality dependency:list -DincludeScope=runtime -DoutputFile=target/quality/dependencies.txt` com JDK 17 e execute `node scripts/audit-java-dependencies.mjs`. Essa etapa consulta a API pública OSV usando somente coordenadas/versionamentos públicos das bibliotecas. Alertas não provam explorabilidade na configuração do portal e retornam código diferente de zero.

## Medição do carregamento dos gráficos

`frontend/scripts/measure-bundle.mjs` compara builds em `frontend/.tmp/quality-perf-before` e `frontend/.tmp/quality-perf-after`, gerados com `vite build --manifest --outDir <diretório>`. O relatório soma o fechamento de imports estáticos de cada página, sem duplicar chunks, e calcula tamanhos bruto/gzip.

`node frontend/scripts/benchmark-charts.mjs` usa esses dois builds e inicia exclusivamente um servidor estático temporário em loopback/porta dinâmica e um Edge headless com perfil próprio. `QUALITY_BROWSER_PATH` permite indicar outro Chromium. Todas as APIs recebem fixtures sintéticas; DNS externo é bloqueado e requisições externas são interceptadas. Nada é enviado aos serviços do portal. O processo fecha somente o navegador que criou.

O benchmark compara três repetições alternadas por build, cache desabilitado, desktop e CPU 4x/2 Mbps, com cinco gráficos reais de Coletas e 200 ms de latência simulada por resposta de API. JSON e capturas ficam em `frontend/.tmp/chart-benchmark`. Os números são medições locais com amostra pequena, não SLA de produção. Consulte `docs/qualidade-e-graficos-2026-09-10.md` para resultados, limitações e próximos pontos de investigação.

## Validação automática dos dashboards

Este diretório contém a automação que compara os KPIs do SQL Server com os valores consumidos pela UI via API.

### Arquivos

- `validate-dashboard-consistency.mjs`
  Runner principal. Executa as queries no SQL Server, chama os endpoints `/api/painel/*`, compara as métricas e gera os relatórios.
- `validate-gestao-vista-xlsx-vs-dashboard.mjs`
  Validação específica de Gestão à Vista. Usa o XLSX de divergências como fonte da verdade, chama a API local que alimenta o dashboard e gera relatório `.md`/`.json` com OK/ERRO por métrica.
- `dashboard-validation/entities.mjs`
  Catálogo das entidades validadas, queries SQL-resumo e mapeamento entre aliases do banco e campos da API/UI.
- `backup-dashboard-db.ps1`
  Executa backup `COPY_ONLY` do banco próprio `DASHBOARDS`/`DASHBOARDS_DEV`, valida com `RESTORE VERIFYONLY` e aplica retenção local.
- `install-dashboard-backup-task.ps1`
  Registra uma tarefa diária no Agendador do Windows chamando `backup-dashboard-db.ps1`; não roda produção nem reinicia serviços.

### Pré-requisitos

- API dev local disponível em `http://localhost:5011`
- SQL Server acessível com as credenciais de `backend/.env`
- `backend/.env` preenchido com `DB_URL`, `DB_USER`, `DB_PASSWORD` e `JWT_SECRET`
- Java no `PATH` e driver `mssql-jdbc` disponível no repositório Maven local
- Pelo menos um usuário ativo em `acesso.usuarios`

### Como rodar

Na raiz do repositório:

```powershell
node scripts/validate-dashboard-consistency.mjs
```

Com período explícito:

```powershell
node scripts/validate-dashboard-consistency.mjs --dataInicio=2026-03-01 --dataFim=2026-03-31
```

Com overrides opcionais:

```powershell
node scripts/validate-dashboard-consistency.mjs --apiBaseUrl=http://localhost:5011 --apiUserEmail=desenvolvedor@rodogarcia.com.br
```

Validação Gestão à Vista a partir do XLSX:

```powershell
node scripts/validate-gestao-vista-xlsx-vs-dashboard.mjs --dataInicio=2026-03-01 --dataFim=2026-03-31
```

Com XLSX/API explícitos:

```powershell
node scripts/validate-gestao-vista-xlsx-vs-dashboard.mjs --xlsx="Análise - Divergências - Indicadores Projeto Gestão a Vista Operacional.xlsx" --apiBaseUrl=http://localhost:5011
```

Runner para Agendador do Windows ou CI self-hosted:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\run-gestao-vista-daily-validation.ps1 -DataInicio 2026-03-01 -DataFim 2026-03-31 -ApiBaseUrl http://localhost:5011
```

Backup manual do banco próprio:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-dashboard-db.ps1 -EnvFile .\.env -BackupDirectory C:\Dashboards\backups\sqlserver -RetentionDays 14
```

Instalação da rotina diária no Agendador do Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-dashboard-backup-task.ps1 -EnvFile .\.env -BackupDirectory C:\Dashboards\backups\sqlserver -At 02:15 -RetentionDays 14
```

O backup usa apenas `DB_URL`, `DB_USER`, `DB_PASSWORD`, `DASHBOARDS_BACKUP_DIR` e `DASHBOARDS_BACKUP_RETENTION_DAYS` do ambiente. O script bloqueia bancos fora de `DASHBOARDS`/`DASHBOARDS_DEV`.

### Saída

O script gera dois arquivos em `reports/`:

- `validacao-dashboard-<dataInicio>_<dataFim>.md`
- `validacao-dashboard-<dataInicio>_<dataFim>.json`
- `validacao-gestao-vista-xlsx-dashboard-<dataInicio>_<dataFim>.md`
- `validacao-gestao-vista-xlsx-dashboard-<dataInicio>_<dataFim>.json`

O `.md` é o relatório para leitura rápida.
O `.json` guarda os dados brutos da comparação, incluindo a reconciliação detalhada por chave quando a API expõe linha a linha.

Para Gestão à Vista, a validação oficial é zero divergência: contagens precisam bater com diferença `0`, moeda precisa bater no centavo e percentuais usam o mesmo arredondamento visual do dashboard. O script sai com código diferente de zero quando qualquer métrica comparável fica `ERRO`.

### O que é validado

- Coletas
- Fretes
- Faturas
- Cotações
- Contas a Pagar
- Localização de Cargas
- Manifestos
- Faturas por Cliente
- ETL Saúde
- Executivo

### Observações

- A comparação geral usa tolerância por tipo de métrica, por exemplo `%` e valores decimais; a validação XLSX vs Dashboard de Gestão à Vista usa tolerância zero nas métricas comparáveis.
- O script trata `NULL` versus `0` para evitar falso positivo em agregações vazias.
- A coleta do "frontend" é feita pela mesma API consumida pela UI, não por scraping.
### Auditoria aprofundada e benchmark por página

`docs/auditoria-aprofundada-2026-09-10.md` registra a segunda rodada, correções de cache/tooltips/isolamento DEV, fila de Performance, redução de consultas de autorização e lacunas remanescentes.

- `node scripts/triage-java-advisories.mjs` expande os IDs do relatório OSV anterior com severidades, aliases e faixas corrigidas. Envia somente IDs públicos à OSV; não lê credenciais ou conecta ao banco. Aceita caminhos opcionais de entrada e saída.
- Em `frontend`, `node scripts/benchmark-charts.mjs <build-antes> <build-depois> <saida> performance 5` compara cinco amostras de cada versão em desktop e CPU 4x/2 Mbps. Use `coletas 3` para a comparação de Coletas. Paths são relativos a `frontend`.
- O argumento final `smoke` com `performance 1` valida somente o build posterior: overview simulado com HTTP 503, cinco gráficos independentes, larguras 1024/390 px e tema escuro. Resultados de smoke não devem ser usados como medição de velocidade.
- Preserve diretórios de evidência por rodada. Os scripts abrem apenas navegador próprio e servidor de arquivos em porta dinâmica local; APIs ficam interceptadas e não chegam à operação.
- A rodada de quatro páginas está em `docs/performance-quatro-paginas-2026-09-10.md`. O benchmark também aceita `faturamento`, `manifestos` e `executivo`, com cinco, sete e dois gráficos respectivamente; registra cada título separadamente, parâmetros e conclusão das APIs. As fixtures adicionais ficam em `frontend/scripts/benchmark-page-fixtures.mjs`. `smoke` aceita as quatro páginas; Manifestos usa resposta completa, pois seu endpoint ainda concentra todos os gráficos.
