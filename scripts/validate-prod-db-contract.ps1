$ErrorActionPreference = 'Stop'

function Resolve-SqlServer {
    param([Parameter(Mandatory = $true)][string] $DbUrl)

    if ($DbUrl -match 'jdbc:sqlserver://([^;]+)') {
        return ($Matches[1] -replace ':(\d+)$', ',$1')
    }

    return 'localhost,1433'
}

function Resolve-SqlDatabase {
    param([Parameter(Mandatory = $true)][string] $DbUrl)

    if ($DbUrl -match '(?i)databaseName=([^;]+)') {
        return $Matches[1]
    }

    if ($DbUrl -match '(?i)database=([^;]+)') {
        return $Matches[1]
    }

    return 'DASHBOARDS'
}

function Resolve-MssqlJdbcJar {
    $pom = [xml][IO.File]::ReadAllText((Join-Path $PSScriptRoot '../backend/pom.xml'))
    $version = [string]$pom.project.properties.'mssql-jdbc.version'
    if ($version -notmatch '^\d+\.\d+\.\d+\.jre\d+$') {
        throw 'Versao do driver SQL ausente ou invalida no backend/pom.xml.'
    }
    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($env:MAVEN_REPO_LOCAL)) {
        $candidates += $env:MAVEN_REPO_LOCAL
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates += (Join-Path $env:USERPROFILE '.m2\repository')
    }
    $candidates += 'C:\Users\suporte\.m2\repository'

    foreach ($root in $candidates | Select-Object -Unique) {
        $driverRoot = Join-Path $root 'com\microsoft\sqlserver\mssql-jdbc'
        if (-not (Test-Path -LiteralPath $driverRoot)) {
            continue
        }

        $jar = Join-Path $driverRoot "$version/mssql-jdbc-$version.jar"
        if (Test-Path -LiteralPath $jar -PathType Leaf) {
            return $jar
        }
    }

    return $null
}

if ([string]::IsNullOrWhiteSpace($env:DB_URL)) {
    Write-Host '[ERRO] DB_URL nao definido em dashboards\.env.'
    exit 1
}

if ([string]::IsNullOrWhiteSpace($env:DB_USER) -or [string]::IsNullOrWhiteSpace($env:DB_PASSWORD)) {
    Write-Host '[ERRO] DB_USER/DB_PASSWORD nao definidos em dashboards\.env.'
    exit 1
}

$server = Resolve-SqlServer -DbUrl $env:DB_URL
$database = Resolve-SqlDatabase -DbUrl $env:DB_URL
Write-Host "[INFO] Validando contrato via JDBC: servidor=$server banco=$database"

$query = @'
SET NOCOUNT ON;

IF DB_NAME()<>N'DASHBOARDS' OR DB_ID(N'ETL_SISTEMA_V2') IS NULL
    THROW 52100, 'O painel de producao exige DASHBOARDS e ETL_SISTEMA_V2.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM ETL_SISTEMA_V2.sys.objects o
    JOIN ETL_SISTEMA_V2.sys.schemas s ON s.schema_id = o.schema_id
    WHERE s.name = N'pub'
      AND o.name = N'vw_localizacao_cargas_powerbi'
      AND o.type IN (N'V', N'SN')
)
    THROW 52101, 'Relatorio de localizacao ausente em ETL_SISTEMA_V2.pub.', 1;

IF NOT EXISTS (
    SELECT 1
    FROM sys.synonyms s
    WHERE s.schema_id=SCHEMA_ID(N'dbo') AND s.name=N'vw_localizacao_cargas_powerbi'
      AND PARSENAME(s.base_object_name,4) IS NULL
      AND PARSENAME(s.base_object_name,3)=N'ETL_SISTEMA_V2'
      AND PARSENAME(s.base_object_name,2)=N'pub'
      AND PARSENAME(s.base_object_name,1) IN (N'vw_localizacao_cargas_powerbi',N'vw_localizacao_cargas_powerbi_preparada')
)
    THROW 52102, 'O relatorio de localizacao do dashboard precisa apontar para a V2.', 1;

DECLARE @esperadas TABLE (ordinal INT NOT NULL PRIMARY KEY, nome SYSNAME NOT NULL);
INSERT INTO @esperadas (ordinal, nome)
VALUES
    (1, N'Hora (Solicitacao)'),
    (2, N'N' + NCHAR(176) + N' Minuta'),
    (3, N'Tipo'),
    (4, N'Data do frete'),
    (5, N'Volumes'),
    (6, N'Peso Taxado'),
    (7, N'Peso Taxado Decimal'),
    (8, N'Valor NF'),
    (9, N'Valor NF Decimal'),
    (10, N'Valor Frete'),
    (11, N'Tipo Servi' + NCHAR(231) + N'o'),
    (12, N'Filial Emissora'),
    (13, N'Previs' + NCHAR(227) + N'o Entrega/Previs' + NCHAR(227) + N'o de entrega'),
    (14, N'Regi' + NCHAR(227) + N'o Destino'),
    (15, N'Filial Destino'),
    (16, N'Respons' + NCHAR(225) + N'vel pela Regi' + NCHAR(227) + N'o de Destino'),
    (17, N'Sigla Respons' + NCHAR(225) + N'vel Regi' + NCHAR(227) + N'o Destino'),
    (18, N'Classifica' + NCHAR(231) + NCHAR(227) + N'o'),
    (19, N'Status Carga'),
    (20, N'Status Normalizado'),
    (21, N'Status Terminal'),
    (22, N'Cancelado Flag'),
    (23, N'Filial Atual'),
    (24, N'Regi' + NCHAR(227) + N'o Origem'),
    (25, N'Filial Origem'),
    (26, N'Localiza' + NCHAR(231) + NCHAR(227) + N'o Atual'),
    (27, N'Hash Localiza' + NCHAR(231) + NCHAR(227) + N'o'),
    (28, N'Metadata'),
    (29, N'Data de extracao');

DECLARE @etlColunas TABLE (
    column_ordinal INT NULL,
    name SYSNAME NULL,
    error_number INT NULL,
    is_hidden BIT NULL
);

INSERT INTO @etlColunas (column_ordinal, name, error_number, is_hidden)
SELECT column_ordinal, name, error_number, is_hidden
FROM sys.dm_exec_describe_first_result_set(
    N'SELECT TOP (0) * FROM ETL_SISTEMA_V2.pub.vw_localizacao_cargas_powerbi',
    NULL,
    0
);

IF EXISTS (SELECT 1 FROM @etlColunas WHERE error_number IS NOT NULL)
OR EXISTS (
    SELECT 1
    FROM @esperadas e
    WHERE NOT EXISTS (
        SELECT 1
        FROM @etlColunas c
        WHERE c.error_number IS NULL
          AND ISNULL(c.is_hidden, 0) = 0
          AND c.name = e.nome
    )
)
    THROW 52103, 'Contrato invalido: contrato ETL de localizacao sem colunas governadas. Aplique as migrations do ETL antes do Dashboard.', 1;

DECLARE @dashboardColunas TABLE (
    column_ordinal INT NULL,
    name SYSNAME NULL,
    error_number INT NULL,
    is_hidden BIT NULL
);

INSERT INTO @dashboardColunas (column_ordinal, name, error_number, is_hidden)
SELECT column_ordinal, name, error_number, is_hidden
FROM sys.dm_exec_describe_first_result_set(
    N'SELECT TOP (0) * FROM dbo.vw_localizacao_cargas_powerbi',
    NULL,
    0
);

IF EXISTS (SELECT 1 FROM @dashboardColunas WHERE error_number IS NOT NULL)
OR EXISTS (
    SELECT 1
    FROM @esperadas e
    LEFT JOIN @dashboardColunas c
      ON c.error_number IS NULL
     AND ISNULL(c.is_hidden, 0) = 0
     AND c.column_ordinal = e.ordinal
    WHERE c.name IS NULL OR c.name <> e.nome
) OR (
    SELECT COUNT(1)
    FROM @dashboardColunas
    WHERE error_number IS NULL
      AND ISNULL(is_hidden, 0) = 0
) <> (SELECT COUNT(1) FROM @esperadas)
BEGIN
    THROW 52104, 'As colunas de localizacao no dashboard divergem do contrato. Verifique as migracoes da V2 e do painel.', 1;
END;

PRINT '[OK] Contrato de localizacao de cargas validado.';
'@

$validator = Join-Path $PSScriptRoot 'ProdDbContractValidator.java'
if (-not (Test-Path -LiteralPath $validator)) {
    Write-Host "[ERRO] Validador Java nao encontrado: $validator"
    exit 1
}

$jdbcJar = Resolve-MssqlJdbcJar
if ([string]::IsNullOrWhiteSpace($jdbcJar)) {
    Write-Host '[ERRO] Driver mssql-jdbc nao encontrado no repositório Maven local.'
    exit 1
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Write-Host '[ERRO] Java nao encontrado no PATH.'
    exit 1
}

$env:DASHBOARD_CONTRACT_QUERY = $query
try {
    $output = & java --class-path $jdbcJar $validator 2>&1
    $exitCode = $LASTEXITCODE
    $output | ForEach-Object { Write-Host $_ }
    if ($exitCode -ne 0) {
        exit $exitCode
    }
} finally {
    Remove-Item Env:DASHBOARD_CONTRACT_QUERY -ErrorAction SilentlyContinue
}
