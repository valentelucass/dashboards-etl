[CmdletBinding()]
param([switch]$DryRun, [switch]$FunctionsOnly)

$ErrorActionPreference = 'Stop'

function Read-ProductionEnv {
    param([string]$File)
    $values = @{}
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadAllLines($File)) {
        $lineNumber++
        if ([string]::IsNullOrWhiteSpace($line) -or $line.TrimStart().StartsWith('#')) { continue }
        if ($line -notmatch '^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$') {
            throw "Formato invalido no .env, linha $lineNumber. Nenhum valor foi exibido."
        }
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or
            ($value.StartsWith("'") -and $value.EndsWith("'")))) { $value = $value.Substring(1, $value.Length - 2) }
        $values[$key] = $value
    }
    return $values
}

function Assert-ProductionCheckout {
    param([string]$Root)
    $branch = & git -C $Root branch --show-current
    if ($LASTEXITCODE -ne 0 -or $branch -ne 'main') { throw 'Build de producao exige checkout Git na branch main.' }
    $changes = @(& git -C $Root status --porcelain=v1 --untracked-files=normal)
    if ($LASTEXITCODE -ne 0) { throw 'Nao foi possivel verificar a worktree.' }
    if ($changes.Count -gt 0) { throw 'Worktree com alteracoes locais. Revise e consolide as alteracoes antes do build de producao.' }
    Write-Host '[OK] Worktree limpa na branch main.'
}

function Invoke-ProductionCommand {
    param([string]$Directory, [string]$Executable, [string[]]$Arguments)
    Push-Location -LiteralPath $Directory
    try {
        # No PowerShell 5, avisos nativos em stderr nao sao falhas de build.
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments | Out-Host
        $code = $LASTEXITCODE
        if ($code -ne 0) { throw "Comando de build falhou (exit code $code): $([IO.Path]::GetFileName($Executable))" }
    } finally { Pop-Location }
}

function Assert-ProductionDist {
    param([string]$Dist, [string]$BuildId)
    $index = Join-Path $Dist 'index.html'
    if (-not (Test-Path -LiteralPath $index)) { throw 'Frontend sem index.html.' }
    $html = [IO.File]::ReadAllText($index)
    if (-not $html.Contains($BuildId)) { throw 'Frontend nao referencia o build ID atual.' }
    foreach ($marker in @('/@vite/client', '/@react-refresh', '/src/main.tsx', '/src/main.jsx', '/node_modules/', '/@fs/')) {
        if ($html.Contains($marker)) { throw 'Frontend contem marcadores de desenvolvimento.' }
    }
    $assets = @(Get-ChildItem -LiteralPath (Join-Path $Dist 'assets') -File | Where-Object { $_.Extension -in @('.js', '.css') })
    if ($assets.Count -eq 0) { throw 'Frontend sem assets JS/CSS.' }
    if (@(Get-ChildItem -LiteralPath $Dist -Recurse -Filter '*.map' -File).Count -gt 0) { throw 'Frontend contem sourcemaps.' }
}

function Invoke-IsolatedProductionBuild {
    param([string]$Root)
    $Root = [IO.Path]::GetFullPath($Root)
    $frontend = Join-Path $Root 'frontend'
    $backend = Join-Path $Root 'backend'
    foreach ($file in @('.env', 'backend/pom.xml', 'backend/mvnw.cmd', 'frontend/package.json')) {
        if (-not (Test-Path -LiteralPath (Join-Path $Root $file))) { throw "Arquivo obrigatorio ausente: $file" }
    }
    Assert-ProductionCheckout $Root
    $originalEnvironment = @{}
    foreach ($entry in [Environment]::GetEnvironmentVariables('Process').GetEnumerator()) { $originalEnvironment[$entry.Key] = $entry.Value }
    try {
        $settings = Read-ProductionEnv (Join-Path $Root '.env')
        foreach ($key in $settings.Keys) { [Environment]::SetEnvironmentVariable($key, $settings[$key], 'Process') }
        if ($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))) {
            $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
        }
        foreach ($tool in @('java.exe', 'node.exe', 'npm.cmd')) { Get-Command $tool -ErrorAction Stop | Out-Null }
        $node = (Get-Command node.exe -ErrorAction Stop).Source
        $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
        $powershell = Join-Path $PSHOME 'powershell.exe'
        Invoke-ProductionCommand $Root $powershell @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Root 'scripts/check-java-version.ps1'), '-MinimumMajor', '17')
        $buildId = (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
        $output = Join-Path $Root ".tmp/production/$buildId"
        if (Test-Path -LiteralPath $output) { throw 'O diretorio deste build ja existe.' }
        $backendOutput = Join-Path $output 'backend'
        $dist = Join-Path $output 'frontend'
        $jar = Join-Path $backendOutput 'dashboard-api-1.0.0.jar'
        $env:SPRING_PROFILES_ACTIVE = 'prod'
        $env:ENVIRONMENT = 'production'
        $env:SERVER_PORT = '5010'
        $env:SERVER_ADDRESS = '127.0.0.1'
        $env:SECURITY_TRUST_FORWARDED_HEADERS = 'true'
        $env:AUTH_REFRESH_COOKIE_SECURE = 'true'
        $env:CORS_ORIGENS_PERMITIDAS = 'https://analytics.rodogarcia.com.br'
        $env:VITE_API_BASE_URL = 'https://api-analytics.rodogarcia.com.br'
        $env:API_BASE_URL = $env:VITE_API_BASE_URL
        $env:VITE_DASHBOARD_BUILD_ID = $buildId
        $env:DEBUG = 'false'
        $env:LOGGING_LEVEL_ROOT = 'INFO'
        $env:LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_WEB = 'INFO'
        $env:LOGGING_LEVEL_ORG_SPRINGFRAMEWORK_JDBC_CORE = 'INFO'
        $env:LOGGING_LEVEL_ORG_HIBERNATE_SQL = 'WARN'
        Write-Host '[INFO] Validando contrato das views de producao...'
        Invoke-ProductionCommand $Root $powershell @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $Root 'scripts/validate-prod-db-contract.ps1'))
        New-Item -ItemType Directory -Path $output | Out-Null
        Write-Host "[INFO] Gerando candidato isolado: $output"
        Invoke-ProductionCommand $backend (Join-Path $backend 'mvnw.cmd') @('-B', '-ntp', '-Pprod-build', "-Dproduction.build.directory=$backendOutput", 'package', '-DskipTests')
        if (-not (Test-Path -LiteralPath $jar)) { throw 'JAR candidato nao foi gerado.' }
        if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules'))) {
            Invoke-ProductionCommand $frontend $npm @('ci')
        }
        Invoke-ProductionCommand $frontend $node @('scripts/validate-prod-env.mjs')
        Invoke-ProductionCommand $frontend $node @('node_modules/typescript/bin/tsc', '-b')
        Invoke-ProductionCommand $frontend $node @('node_modules/vite/bin/vite.js', 'build', '--outDir', $dist)
        Assert-ProductionDist $dist $buildId
        $info = [ordered]@{ buildId = $buildId; builtAt = (Get-Date).ToUniversalTime().ToString('o'); distDir = $dist;
            frontendPort = 5173; backendPort = 5010; frontendPublicUrl = $env:CORS_ORIGENS_PERMITIDAS; apiPublicUrl = $env:VITE_API_BASE_URL }
        [IO.File]::WriteAllText((Join-Path $dist 'build-info.json'), ($info | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
        $artifacts = @(Get-Item -LiteralPath $jar) + @(Get-ChildItem -LiteralPath $dist -Recurse -File)
        $receipt = [ordered]@{ buildId = $buildId; backendJar = $jar; frontendDist = $dist; deployed = $false;
            files = @($artifacts | ForEach-Object { [ordered]@{ path = $_.FullName; sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }) }
        [IO.File]::WriteAllText((Join-Path $output 'build-manifest.json'), ($receipt | ConvertTo-Json -Depth 5), [Text.UTF8Encoding]::new($false))
        Write-Host "[OK] Backend candidato: $jar"
        Write-Host "[OK] Frontend candidato: $dist"
        Write-Host "[OK] Manifesto: $(Join-Path $output 'build-manifest.json')"
        Write-Host '[INFO] Build concluido. Arquivos operacionais e processos preservados.'
        Write-Host '[PROXIMO PASSO] Publicar os caminhos deste manifesto pelo procedimento do runtime compartilhado .runtime/pm2.'
        Write-Host '[INFO] Compilar nao ativa o candidato. Nao use pm2 save sem reconciliar o manifesto de boot.'
    } finally {
        foreach ($key in @([Environment]::GetEnvironmentVariables('Process').Keys)) {
            if (-not $originalEnvironment.ContainsKey($key)) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
        }
        foreach ($key in $originalEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $originalEnvironment[$key], 'Process') }
    }
}

if ($FunctionsOnly) { return }
if ($DryRun) {
    Write-Host '[DRY-RUN] Exigiria main/worktree limpa, Java 17+, Node/npm e .env valido.'
    Write-Host '[DRY-RUN] Validaria contrato SQL somente leitura; geraria backend e frontend em .tmp/production/<build-id>.'
    Write-Host '[DRY-RUN] Maven: -Pprod-build -Dproduction.build.directory=<candidato>/backend package -DskipTests.'
    Write-Host '[DRY-RUN] Sem clean, exclusao de pastas, substituicao de JAR/dist em uso ou controle de processos/portas.'
    exit 0
}
try { Invoke-IsolatedProductionBuild ([IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))) }
catch { Write-Host "[ERRO] $($_.Exception.Message)"; exit 1 }
