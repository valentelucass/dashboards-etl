# DASHBOARDS Database

Fonte organizada dos scripts SQL do banco `DASHBOARDS`.

## Estrutura

- `migrations/`: migrations versionadas usadas pela API.
- `setup/`: scripts operacionais de criacao, migracao e sincronizacao.
- `validation/`: checks de schema, permissao e pos-migration.

## Ordem Recomendada

1. Aplicar as migrations pelo executor padrao:

```bat
database\executar_database.bat
```

2. Para inspecionar o historico Flyway sem alterar o banco:

```bat
database\executar_database.bat --info
```

3. Para corrigir somente o escopo de filiais por usuario, aplicar:

```powershell
sqlcmd -S localhost,1433 -d DASHBOARDS -E -C -b -f 65001 -i database\migrations\V011__adicionar_escopo_filiais_usuario.sql
```

4. Validar o schema:

```powershell
sqlcmd -S localhost,1433 -d DASHBOARDS -U usuario_etl -P "<senha>" -C -b -f 65001 -i database\validation\001_validar_escopo_filiais_usuario.sql
sqlcmd -S localhost,1433 -d DASHBOARDS -U usuario_etl -P "<senha>" -C -b -f 65001 -i database\validation\002_validar_metas_custo_manifestos.sql
```

5. Antes de migrations que criem chaves estrangeiras no schema `acesso`, o administrador do SQL Server deve conceder ao login usado pelo Flyway a permissão mínima de `REFERENCES` no schema:

```powershell
sqlcmd -S localhost,1433 -d master -E -C -b -f 65001 -v TargetDb="DASHBOARDS" AppLogin="usuario_etl" -i database\setup\002_conceder_references_schema_acesso.sql
```

## Executor Windows

- `database/executar_database.bat` usa o plugin Maven do Flyway configurado no backend.
- Carrega `database/config.bat`, `DASHBOARDS_ENV_FILE`, `.env.development.local` ou `.env`, nessa ordem.
- `database/config.bat` deve ser criado a partir de `database/config_exemplo.bat` e nao deve ser versionado.
- Em DEV, o executor bloqueia `databaseName=DASHBOARDS`; use `DASHBOARDS_DEV`.
- Por padrao, somente `DASHBOARDS` e `DASHBOARDS_DEV` sao aceitos. Para sandbox controlado, defina `DASHBOARDS_DB_ALLOW_CUSTOM=1`.
- Quando `DB_URL` tiver `trustServerCertificate=true`, o executor tambem passa `-C` ao `sqlcmd` nas validacoes.

## Observacoes

- O usuario da aplicacao pode nao ter permissao de `ALTER` ou `CREATE TABLE`. Nesse caso, aplique migrations com usuario `dbo` ou credencial administrativa.
- O login de migrations também precisa de `REFERENCES` em `acesso` para criar chaves estrangeiras; o script `setup/002_conceder_references_schema_acesso.sql` concede somente essa permissão de schema.
- O alvo desta pasta e sempre o banco proprio do portal: `DASHBOARDS` em producao ou `DASHBOARDS_DEV` em desenvolvimento.
- Use `-f 65001` ao aplicar migrations via `sqlcmd`; as views de dashboard possuem aliases acentuados e devem ser lidas como UTF-8.
- `TODAS` significa acesso total as filiais da empresa; `HERDAR_SETOR` usa o escopo do setor; `SELECIONADAS` usa `acesso.usuario_filiais_permitidas`.
