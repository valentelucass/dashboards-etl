# Valida a implementação em tabelas temporárias, com dados artificiais, somente em DEV.
param([string]$OutputDirectory = (Join-Path '.tmp/presenca-sql' (Get-Date -Format 'yyyyMMdd-HHmmss')))
$ErrorActionPreference = 'Stop'
$presenceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $presenceRoot
try {
    & node scripts/verify-presenca-sql.mjs $OutputDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar cenários SQL.' }
    $presenceEnv = @{}
    foreach ($line in Get-Content -LiteralPath '.env.development.local' -Encoding UTF8) {
        if ($line -match '^\s*([A-Z][A-Z0-9_]*)=(.*)$') { $presenceEnv[$matches[1]] = $matches[2].Trim().Trim('"').Trim("'") }
    }
    if ($presenceEnv['DB_URL'] -notmatch '^jdbc:sqlserver://([^;]+);') { throw 'Formato JDBC DEV não reconhecido.' }
    $presenceServer = $matches[1] -replace ':',','
    $presenceDatabases = [regex]::Matches($presenceEnv['DB_URL'], '(?i)(?:^|;)databaseName=([^;]+)')
    if ($presenceDatabases.Count -ne 1 -or $presenceDatabases[0].Groups[1].Value -ne 'DASHBOARDS_DEV') { throw 'Conexão limitada ao DASHBOARDS_DEV.' }
    $previousSqlPassword = $env:SQLCMDPASSWORD
    try {
        $env:SQLCMDPASSWORD = $presenceEnv['DB_PASSWORD']
        & sqlcmd -S $presenceServer -d DASHBOARDS_DEV -U $presenceEnv['DB_USER'] -C -b -l 5 -t 20 -i (Join-Path $OutputDirectory 'presenca.sql') -o (Join-Path $OutputDirectory 'presenca-sql.log')
        if ($LASTEXITCODE -ne 0) { throw 'Verificação SQL falhou; consulte o log local.' }
    } finally { $env:SQLCMDPASSWORD = $previousSqlPassword }
    Get-Content -LiteralPath (Join-Path $OutputDirectory 'presenca-sql.log') -Encoding UTF8

} finally { Pop-Location }
