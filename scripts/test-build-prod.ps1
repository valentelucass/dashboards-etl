$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'build-prod.ps1') -FunctionsOnly
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$testRoot = Join-Path $repo ('.tmp/build-prod-tests/' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
function Assert-True([bool]$Value, [string]$Message) { if (-not $Value) { throw $Message } }
function Write-Utf8([string]$File, [string]$Value) { [IO.File]::WriteAllText($File, $Value, [Text.UTF8Encoding]::new($false)) }

# Valores de teste deliberadamente adversos ao parser do CMD; nunca sao executados.
$special = 'a"b&c|d<e>f^g!h%PATH%=i(j);k#l'
$envFile = Join-Path $testRoot 'test.env'
Write-Utf8 $envFile ("# comentario`n`nDUMMY=$special`nQUOTED='x=y&z'`nEMPTY=`n")
$parsed = Read-ProductionEnv $envFile
Assert-True ($parsed.DUMMY -ceq $special) 'Valor com caracteres especiais alterado.'
Assert-True ($parsed.QUOTED -ceq 'x=y&z') 'Aspas externas nao tratadas.'
Assert-True ($parsed.ContainsKey('EMPTY') -and $parsed.EMPTY -eq '') 'Valor vazio perdido.'
Write-Utf8 $envFile 'INVALID LINE SECRET_FIXTURE'
try { $null = Read-ProductionEnv $envFile; throw 'Formato invalido aceito.' }
catch { Assert-True ($_.Exception.Message -like 'Formato invalido no .env*' -and $_.Exception.Message -notlike '*SECRET_FIXTURE*') 'Erro vazou valor ou nao recusou linha invalida.' }

# Checkout temporario, sem tocar no historico Git do projeto.
$gitFixture = Join-Path $testRoot 'git-fixture'
New-Item -ItemType Directory -Path $gitFixture | Out-Null
& git init --quiet --initial-branch=main $gitFixture
if ($LASTEXITCODE -ne 0) { throw 'Falha ao criar fixture Git.' }
Assert-ProductionCheckout $gitFixture
Write-Utf8 (Join-Path $gitFixture 'alteracao.txt') 'fixture'
try { Assert-ProductionCheckout $gitFixture; throw 'Worktree alterada foi aceita.' }
catch { Assert-True ($_.Exception.Message -like 'Worktree com alteracoes locais*') 'Guard da worktree nao detectou alteracoes.' }

$node = (Get-Command node.exe).Source
try { Invoke-ProductionCommand $testRoot $node @('-e', 'process.exit(7)'); throw 'Falha nativa foi ignorada.' }
catch { Assert-True ($_.Exception.Message -like '*exit code 7*') 'Exit code nativo nao propagado.' }

# Exercita a orquestracao inteira com compiladores simulados, JAR bloqueado e dist operacional.
$fixture = Join-Path $testRoot 'checkout com espacos'
foreach ($dir in @('backend/target', 'frontend/node_modules', 'frontend/dist-prod', 'scripts')) {
    New-Item -ItemType Directory -Path (Join-Path $fixture $dir) -Force | Out-Null
}
foreach ($file in @('backend/pom.xml', 'backend/mvnw.cmd', 'frontend/package.json')) { Write-Utf8 (Join-Path $fixture $file) 'fixture' }
Write-Utf8 (Join-Path $fixture '.env') "BUILD_TEST_LITERAL=$special"
$activeJar = Join-Path $fixture 'backend/target/dashboard-api-1.0.0.jar'
$activeIndex = Join-Path $fixture 'frontend/dist-prod/index.html'
Write-Utf8 $activeJar 'JAR OPERACIONAL'
Write-Utf8 $activeIndex 'FRONTEND OPERACIONAL'
$lockedJar = [IO.File]::Open($activeJar, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
$calls = [Collections.Generic.List[object]]::new()
$failStage = $null
$oldLiteral = $env:BUILD_TEST_LITERAL
function Assert-ProductionCheckout { param([string]$Root) }
function Invoke-ProductionCommand {
    param([string]$Directory, [string]$Executable, [string[]]$Arguments)
    Assert-True ($env:BUILD_TEST_LITERAL -ceq $special) 'O .env nao foi transmitido literalmente ao processo.'
    $calls.Add([pscustomobject]@{ executable = $Executable; arguments = $Arguments })
    if ($failStage -and $Arguments -contains $failStage) { throw 'FALHA_SIMULADA' }
    if ($Executable.EndsWith('mvnw.cmd')) {
        Assert-True (-not ($Arguments -contains 'clean')) 'Build tentou executar clean.'
        Assert-True ($Arguments -contains '-Pprod-build') 'Perfil isolado ausente.'
        $outputArgument = @($Arguments | Where-Object { $_.StartsWith('-Dproduction.build.directory=') })[0]
        $candidate = $outputArgument.Substring('-Dproduction.build.directory='.Length)
        Assert-True ([IO.Path]::GetFullPath($candidate).StartsWith([IO.Path]::GetFullPath((Join-Path $fixture '.tmp/production')) + [IO.Path]::DirectorySeparatorChar)) 'Saida Maven fora do candidato.'
        New-Item -ItemType Directory -Path $candidate -Force | Out-Null
        Write-Utf8 (Join-Path $candidate 'dashboard-api-1.0.0.jar') 'NOVO JAR'
    }
    if ($Arguments -contains 'node_modules/vite/bin/vite.js') {
        $dist = $Arguments[[Array]::IndexOf($Arguments, '--outDir') + 1]
        New-Item -ItemType Directory -Path (Join-Path $dist 'assets') -Force | Out-Null
        Write-Utf8 (Join-Path $dist 'index.html') "<html>$env:VITE_DASHBOARD_BUILD_ID</html>"
        Write-Utf8 (Join-Path $dist 'assets/app.js') 'fixture'
    }
}
try {
    Invoke-IsolatedProductionBuild $fixture
    Assert-True ([IO.File]::ReadAllText($activeJar) -ceq 'JAR OPERACIONAL') 'JAR operacional alterado.'
    Assert-True ([IO.File]::ReadAllText($activeIndex) -ceq 'FRONTEND OPERACIONAL') 'Frontend operacional alterado.'
    Assert-True ($env:BUILD_TEST_LITERAL -ceq $oldLiteral) 'Ambiente nao restaurado.'
    $manifests = @(Get-ChildItem -LiteralPath (Join-Path $fixture '.tmp/production') -Recurse -Filter 'build-manifest.json')
    Assert-True ($manifests.Count -eq 1) 'Manifesto ausente.'
    $manifest = Get-Content -Raw -LiteralPath $manifests[0].FullName | ConvertFrom-Json
    Assert-True (-not $manifest.deployed -and $manifest.files.Count -eq 4) 'Manifesto inconsistente.'
    $countBefore = $calls.Count
    $failStage = 'package'
    try { Invoke-IsolatedProductionBuild $fixture; throw 'Falha Maven ignorada.' }
    catch { Assert-True ($_.Exception.Message -eq 'FALHA_SIMULADA') 'Falha Maven nao propagada.' }
    Assert-True ($calls.Count -eq $countBefore + 3) 'Build prosseguiu depois da falha Maven.'
    Assert-True ($env:BUILD_TEST_LITERAL -ceq $oldLiteral) 'Ambiente nao restaurado apos falha.'
    Write-Host '[OK] Parser literal/erro sanitizado, guard Git, exit code, build isolado com JAR bloqueado e interrupcao apos falha aprovados.'
} finally { $lockedJar.Dispose() }
