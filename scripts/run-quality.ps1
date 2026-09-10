[CmdletBinding()]
param(
    [string]$JavaHome,
    [switch]$Audit
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 6)
$reportRoot = Join-Path $repoRoot ".tmp/quality/$runId"
$backendOutput = Join-Path $repoRoot "backend/target/quality/$runId"
$frontendOutput = ".tmp/quality-build/$runId"
New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null
$originalJavaHome = $env:JAVA_HOME
$steps = [Collections.Generic.List[object]]::new()

function Get-OperationalFingerprint {
    $paths = @('.env', '.env.development.local', 'backend/.env', 'ecosystem.config.js',
        'backend/target/dashboard-api-1.0.0.jar', 'frontend/dist-prod', 'frontend/.tmp/build-check')
    $entries = foreach ($path in $paths) {
        $absolute = Join-Path $repoRoot $path
        if (-not (Test-Path -LiteralPath $absolute)) { "$path|absent"; continue }
        $item = Get-Item -LiteralPath $absolute
        $files = if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $absolute -File -Recurse } else { @($item) }
        foreach ($file in $files) {
            $relative = $file.FullName.Substring($repoRoot.Length)
            "$relative|$((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash)"
        }
    }
    return ($entries | Sort-Object) -join "`n"
}

function Invoke-QualityStep {
    param([string]$Name, [string]$Directory, [string]$Executable, [string[]]$Arguments)
    $logPath = Join-Path $reportRoot "$Name.log"
    $watch = [Diagnostics.Stopwatch]::StartNew()
    Write-Host "[quality] $Name"
    Push-Location -LiteralPath $Directory
    try {
        # Native stderr is a log stream; exit status, not warning text, determines failure.
        $ErrorActionPreference = 'Continue'
        & $Executable @Arguments *> $logPath
        $stepExit = $LASTEXITCODE
    } finally { Pop-Location }
    $watch.Stop()
    $steps.Add([pscustomobject]@{ step = $Name; exitCode = $stepExit; seconds = [math]::Round($watch.Elapsed.TotalSeconds, 2); log = $logPath })
    if ($stepExit -ne 0) {
        Write-Host "[quality] Falha em $Name. Consulte $logPath"
    }
}

$before = Get-OperationalFingerprint
try {
    if (-not $JavaHome) {
        $candidates = @($env:JAVA_HOME) + @(Get-ChildItem -Path 'C:/Program Files/Eclipse Adoptium/jdk-17*' -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
        foreach ($candidate in $candidates) {
            if (-not $candidate -or -not (Test-Path -LiteralPath (Join-Path $candidate 'release'))) { continue }
            if ((Get-Content -LiteralPath (Join-Path $candidate 'release')) -match '^JAVA_VERSION="17\.') {
                $JavaHome = $candidate; break
            }
        }
    }
    if (-not $JavaHome -or -not (Test-Path -LiteralPath (Join-Path $JavaHome 'bin/javac.exe'))) {
        throw 'Informe -JavaHome com um JDK 17 instalado.'
    }
    if (-not ((Get-Content -LiteralPath (Join-Path $JavaHome 'release')) -match '^JAVA_VERSION="17\.')) {
        throw 'O perfil quality exige JDK 17 para executar Mockito sem opções experimentais.'
    }
    $env:JAVA_HOME = $JavaHome
    $maven = (Get-Command mvn.cmd -ErrorAction Stop).Source
    $npm = (Get-Command npm.cmd -ErrorAction Stop).Source
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    $frontend = Join-Path $repoRoot 'frontend'
    if (-not (Test-Path -LiteralPath (Join-Path $frontend 'node_modules/@vitest/coverage-v8/package.json'))) {
        throw 'Instale as dependências de desenvolvimento com npm ci em frontend antes de executar a qualidade.'
    }

    Invoke-QualityStep 'backend' $repoRoot $maven @('-B', '-ntp', '-f', 'backend/pom.xml', '-Pquality', "-Dquality.build.directory=$backendOutput", 'verify')
    Invoke-QualityStep 'frontend' $frontend $npm @('run', 'test:coverage', '--', '--coverage.reportsDirectory', "$frontendOutput/coverage")
    Invoke-QualityStep 'typescript' $frontend $node @('node_modules/typescript/bin/tsc', '-b')
    Invoke-QualityStep 'lint' $frontend $npm @('run', 'lint', '--', '--max-warnings=0')
    Invoke-QualityStep 'encoding' $frontend $npm @('run', 'check:encoding')
    Invoke-QualityStep 'production-env' $frontend $node @('scripts/validate-prod-env.mjs')
    Invoke-QualityStep 'frontend-build' $frontend $node @('node_modules/vite/bin/vite.js', 'build', '--outDir', "$frontendOutput/dist", '--manifest')
    if ($Audit) {
        # Contacts only the package registry using dependency metadata; does not install or fix packages.
        Invoke-QualityStep 'audit-production' $frontend $npm @('audit', '--omit=dev', '--json')
    }
} finally {
    $env:JAVA_HOME = $originalJavaHome
    $preserved = $before -eq (Get-OperationalFingerprint)
    $summary = [pscustomobject]@{ runId = $runId; operationalFilesPreserved = $preserved; backendOutput = $backendOutput;
        frontendOutput = "frontend/$frontendOutput"; steps = @($steps.ToArray()) }
    $summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $reportRoot 'summary.json') -Encoding UTF8
    Write-Host "[quality] Relatório: $reportRoot/summary.json"
    if (-not $preserved) { throw 'O fingerprint dos arquivos operacionais mudou durante a execução. Verifique alterações concorrentes.' }
}
if (@($steps | Where-Object { $_.exitCode -ne 0 }).Count -gt 0) { exit 1 }
Write-Host '[quality] Verificações concluídas; arquivos operacionais preservados.'
