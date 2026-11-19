@echo off
SETLOCAL EnableExtensions DisableDelayedExpansion

REM ============================================================
REM Arquivo : iniciar-dev.bat
REM Papel   : Inicia backend e frontend do monorepo em paralelo.
REM AVISO IA: este e o unico modo permitido para IA subir/testar a aplicacao.
REM AVISO IA: backend 5011 e frontend 5174. Producao fica fora do fluxo da IA.
REM Uso     : iniciar-dev.bat com --front-only ou --back-only opcionais
REM Teste   : iniciar-dev.bat --dry-run com um dos modos opcionais
REM ============================================================

chcp 65001 >nul
cd /d "%~dp0"

set "ROOT_DIR=%CD%"
set "BACKEND_DIR=%ROOT_DIR%\backend"
set "FRONTEND_DIR=%ROOT_DIR%\frontend"
set "BACKEND_MVNW=%BACKEND_DIR%\mvnw.cmd"
set "BACKEND_POM=%BACKEND_DIR%\pom.xml"
set "FRONTEND_PACKAGE=%FRONTEND_DIR%\package.json"
set "BACKEND_LOG_DIR=%BACKEND_DIR%\logs"
set "BACKEND_DEV_LOG=%BACKEND_LOG_DIR%\dashboard-api-dev.out.log"
set "BACKEND_DEV_ERR=%BACKEND_LOG_DIR%\dashboard-api-dev.err.log"
set "BACKEND_PID_FILE=%BACKEND_LOG_DIR%\dashboard-api-dev.pid"
set "BACKEND_PORT=5011"
set "FRONTEND_PORT=5174"
set "PROD_BACKEND_PORT=5010"
set "PROD_FRONTEND_PORT=5173"
set "FRONTEND_MODE=development"
set "FRONTEND_DEV_ENV_FILE=%ROOT_DIR%\.env.development"
set "BACKEND_DEV_ENV_FILE=%ROOT_DIR%\.env.development.local"
set "LOCAL_API_URL=http://127.0.0.1:%BACKEND_PORT%"
set "LOCAL_FRONTEND_ORIGINS=http://127.0.0.1:%FRONTEND_PORT%,http://localhost:%FRONTEND_PORT%"
set "BACKEND_CMD=call "%BACKEND_MVNW%" -f "%BACKEND_POM%" spring-boot:run -Dspring-boot.run.profiles=dev"
set "DRY_RUN=0"
set "FRONT_ONLY=0"
set "BACK_ONLY=0"

:parse_args
if "%~1"=="" goto args_ready
if /i "%~1"=="--dry-run" set "DRY_RUN=1"
if /i "%~1"=="--front-only" set "FRONT_ONLY=1"
if /i "%~1"=="--back-only" set "BACK_ONLY=1"
shift
goto parse_args

:args_ready
if "%FRONT_ONLY%%BACK_ONLY%"=="11" (
    echo [ERRO] Use apenas um dos modos --front-only ou --back-only.
    exit /b 1
)

call :prefer_java_home

echo.
echo ============================================
echo   INICIAR DASHBOARDS - DEV
echo ============================================
echo.

if not exist "%BACKEND_DIR%\" (
    echo [ERRO] Pasta nao encontrada: backend
    pause
    exit /b 1
)

if not exist "%FRONTEND_DIR%\" (
    echo [ERRO] Pasta nao encontrada: frontend
    pause
    exit /b 1
)

if not exist "%BACKEND_MVNW%" (
    echo [ERRO] Arquivo nao encontrado: backend\mvnw.cmd
    pause
    exit /b 1
)

if not exist "%BACKEND_POM%" (
    echo [ERRO] Arquivo nao encontrado: backend\pom.xml
    pause
    exit /b 1
)

if not exist "%FRONTEND_PACKAGE%" (
    echo [ERRO] Arquivo nao encontrado: frontend\package.json
    pause
    exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
    echo [ERRO] Java nao encontrado no PATH.
    echo O backend precisa do Java 17 ou superior para rodar.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERRO] npm nao encontrado no PATH.
    echo O frontend precisa do Node.js com npm instalado.
    pause
    exit /b 1
)

where powershell >nul 2>nul
if errorlevel 1 (
    echo [ERRO] PowerShell nao encontrado no PATH.
    echo O script usa PowerShell para liberar portas presas com seguranca.
    pause
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%\scripts\check-java-version.ps1" -MinimumMajor 17
if errorlevel 1 (
    echo.
    echo [ERRO] Corrija o Java antes de iniciar o backend Spring.
    pause
    exit /b 1
)

call :validate_dev_contract
if errorlevel 1 (
    pause
    exit /b 1
)

echo Backend dev esperado em: http://127.0.0.1:%BACKEND_PORT%
echo Frontend dev esperado em: http://127.0.0.1:%FRONTEND_PORT%
echo.
echo [INFO] O modo dev inicia diretamente:
if "%FRONT_ONLY%"=="1" (
    echo        - npm run dev -- --mode %FRONTEND_MODE% --strictPort
) else (
    echo        - backend\mvnw.cmd spring-boot:run
    if "%BACK_ONLY%"=="0" echo        - npm run dev -- --mode %FRONTEND_MODE% --strictPort
)
if "%FRONT_ONLY%"=="1" (
    echo [INFO] Modo --front-only ativo: backend existente sera preservado.
    echo [INFO] Antes de iniciar, apenas processos na porta dev do frontend serao encerrados.
) else if "%BACK_ONLY%"=="1" (
    echo [INFO] Modo --back-only ativo: frontend existente sera preservado.
    echo [INFO] Antes de iniciar, apenas processos na porta dev do backend serao encerrados.
) else (
    echo [INFO] Antes de iniciar, apenas processos nas portas dev serao encerrados.
    echo [INFO] O backend roda em background e grava log em backend\logs.
)
if "%BACK_ONLY%"=="0" echo [INFO] O frontend roda neste terminal.
if "%BACK_ONLY%"=="0" echo [INFO] Este modo injeta API local no frontend: %LOCAL_API_URL%
echo [INFO] Este modo libera CORS local para: %LOCAL_FRONTEND_ORIGINS%
if "%BACK_ONLY%"=="0" echo [INFO] Vite carregara .env.development e recusara fallback para API publica.
if "%FRONT_ONLY%"=="1" (
    echo [INFO] Front-only valida .env.development.local, mas nao reinicia o backend.
) else (
    echo [INFO] Backend DEV carregara segredos somente de .env.development.local.
)
echo [INFO] Este modo nao executa build, deploy ou limpeza de frontend\dist-prod.
echo [INFO] Producao/Cloudflare permanece nas portas %PROD_BACKEND_PORT% e %PROD_FRONTEND_PORT%.
echo [INFO] Para Cloudflare/producao, use iniciar-prod.bat.
echo.

if "%DRY_RUN%"=="1" (
    if "%FRONT_ONLY%"=="1" (
        echo [DRY-RUN] modo front-only: liberar apenas porta %FRONTEND_PORT%
        echo [DRY-RUN] backend preservado na porta %BACKEND_PORT%
    ) else if "%BACK_ONLY%"=="1" (
        echo [DRY-RUN] modo back-only: liberar apenas porta %BACKEND_PORT%
        echo [DRY-RUN] frontend preservado na porta %FRONTEND_PORT%
    ) else (
        echo [DRY-RUN] liberar portas %BACKEND_PORT% e %FRONTEND_PORT%
    )
    echo [DRY-RUN] portas de producao proibidas neste script: %PROD_BACKEND_PORT% e %PROD_FRONTEND_PORT%
    if "%FRONT_ONLY%"=="1" (
        echo [DRY-RUN] sem iniciar backend, sem healthcheck backend
    ) else (
        echo [DRY-RUN] backend profile: dev
        echo [DRY-RUN] backend env local: %BACKEND_DEV_ENV_FILE%
        echo [DRY-RUN] backend banco: DB_URL deve apontar para databaseName diferente de DASHBOARDS
        echo [DRY-RUN] backend ambiente: .env.development.local injetado em SPRING_APPLICATION_JSON acima de dashboards\.env
        echo [DRY-RUN] backend CORS: %LOCAL_FRONTEND_ORIGINS%
        echo [DRY-RUN] backend comando: backend\mvnw.cmd -f backend\pom.xml spring-boot:run -Dspring-boot.run.profiles=dev
        echo [DRY-RUN] log backend: %BACKEND_DEV_LOG%
        echo [DRY-RUN] aguardar healthcheck http://127.0.0.1:%BACKEND_PORT%/actuator/health/liveness
    )
    if "%BACK_ONLY%"=="0" (
        echo [DRY-RUN] frontend env: %FRONTEND_DEV_ENV_FILE%
        echo [DRY-RUN] frontend neste terminal: npm run dev -- --mode %FRONTEND_MODE% --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort
    )
    echo [DRY-RUN] sem build de producao, sem deploy, sem alteracao em frontend\dist-prod
    exit /b 0
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(%FRONTEND_PORT%);" ^
  "if ($env:FRONT_ONLY -ne '1') { $ports = @(%BACKEND_PORT%, %FRONTEND_PORT%) };" ^
  "if ($env:BACK_ONLY -eq '1') { $ports = @(%BACKEND_PORT%) };" ^
  "$forbidden = @(%PROD_BACKEND_PORT%, %PROD_FRONTEND_PORT%);" ^
  "if ($ports | Where-Object { $forbidden -contains $_ }) { Write-Host '[ERRO] Script DEV tentou operar em porta de producao.'; exit 4 }" ^
  "foreach ($port in $ports) {" ^
  "  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "  if (-not $listeners) { Write-Host ('[OK] Porta ' + $port + ' livre.'); continue }" ^
  "  $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique;" ^
  "  Write-Host ('[INFO] Porta ' + $port + ' em uso. Encerrando processos...');" ^
  "  foreach ($procId in $processIds) {" ^
  "    $process = Get-Process -Id $procId -ErrorAction SilentlyContinue;" ^
  "    if ($process) {" ^
  "      Write-Host ('[INFO] Encerrando PID=' + $procId + ' | ' + $process.ProcessName + ' | ' + $process.Path);" ^
  "      try { Stop-Process -Id $procId -Force -ErrorAction Stop } catch { Write-Host ('[ERRO] Falha ao encerrar PID=' + $procId + ': ' + $_.Exception.Message); exit 3 }" ^
  "    }" ^
  "  }" ^
  "  Start-Sleep -Milliseconds 800;" ^
  "  $restantes = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue;" ^
  "  if ($restantes) { Write-Host ('[ERRO] Porta ' + $port + ' continuou em uso.'); exit 2 }" ^
  "  Write-Host ('[OK] Porta ' + $port + ' liberada.');" ^
  "}" ^
  "exit 0"

if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel liberar as portas de desenvolvimento.
    pause
    exit /b 1
)

if "%FRONT_ONLY%"=="1" (
    echo.
    echo [INFO] Modo --front-only ativo: backend preservado; pulando start e healthcheck.
    goto start_frontend
)

if not exist "%BACKEND_LOG_DIR%\" mkdir "%BACKEND_LOG_DIR%"
if exist "%BACKEND_DEV_LOG%" del /q "%BACKEND_DEV_LOG%" >nul 2>nul
if exist "%BACKEND_DEV_ERR%" del /q "%BACKEND_DEV_ERR%" >nul 2>nul

call :load_env_file "%BACKEND_DEV_ENV_FILE%"
if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel carregar .env.development.local.
    pause
    exit /b 1
)

echo.
echo [INFO] Iniciando backend em background...
set "SPRING_PROFILES_ACTIVE=dev"
set "ENVIRONMENT=dev"
set "SERVER_ADDRESS=127.0.0.1"
set "SERVER_PORT=%BACKEND_PORT%"
set "CORS_ORIGENS_PERMITIDAS=%LOCAL_FRONTEND_ORIGINS%"
set "SECURITY_TRUST_FORWARDED_HEADERS=false"
set "AUTH_REFRESH_COOKIE_SECURE=false"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$env:SPRING_PROFILES_ACTIVE = 'dev';" ^
  "$env:ENVIRONMENT = 'dev';" ^
  "$env:SERVER_ADDRESS = '127.0.0.1';" ^
  "$env:SERVER_PORT = $env:BACKEND_PORT;" ^
  "$env:CORS_ORIGENS_PERMITIDAS = $env:LOCAL_FRONTEND_ORIGINS;" ^
  "$env:SECURITY_TRUST_FORWARDED_HEADERS = 'false';" ^
  "$env:AUTH_REFRESH_COOKIE_SECURE = 'false';" ^
  "$sessionHours = 24; if ($env:AUTH_SESSION_EXPIRACAO_HORAS) { $sessionHours = [int]$env:AUTH_SESSION_EXPIRACAO_HORAS };" ^
  "$springConfig = [ordered]@{ spring = @{ profiles = @{ active = 'dev' }; datasource = @{ url = $env:DB_URL; username = $env:DB_USER; password = $env:DB_PASSWORD } }; app = @{ environment = 'dev' }; server = @{ address = '127.0.0.1'; port = [int]$env:BACKEND_PORT }; cors = @{ 'origens-permitidas' = $env:LOCAL_FRONTEND_ORIGINS }; security = @{ 'trust-forwarded-headers' = $false }; auth = @{ 'session-expiracao-horas' = $sessionHours; 'refresh-cookie-secure' = $false }; jwt = @{ secret = $env:JWT_SECRET }; api = @{ interno = @{ key = $env:API_KEY } }; acesso = @{ 'usuario-supremo' = @{ email = $env:ACESSO_USUARIO_SUPREMO_EMAIL; 'senha-inicial' = $env:ACESSO_USUARIO_SUPREMO_SENHA_INICIAL; nome = $env:ACESSO_USUARIO_SUPREMO_NOME; papel = $env:ACESSO_USUARIO_SUPREMO_PAPEL; nivel = $env:ACESSO_USUARIO_SUPREMO_NIVEL; 'rotacionar-senha' = $false } } };" ^
  "$env:SPRING_APPLICATION_JSON = $springConfig | ConvertTo-Json -Compress -Depth 6;" ^
  "$process = Start-Process -FilePath $env:ComSpec -ArgumentList @('/d','/c',$env:BACKEND_CMD) -WorkingDirectory $env:ROOT_DIR -WindowStyle Hidden -RedirectStandardOutput $env:BACKEND_DEV_LOG -RedirectStandardError $env:BACKEND_DEV_ERR -PassThru;" ^
  "Set-Content -Path $env:BACKEND_PID_FILE -Value $process.Id;" ^
  "Write-Host ('[OK] Backend iniciado em background. PID=' + $process.Id);" ^
  "Write-Host ('[INFO] Log backend: ' + $env:BACKEND_DEV_LOG);" ^
  "exit 0"

if errorlevel 1 (
    echo.
    echo [ERRO] Nao foi possivel iniciar o backend em background.
    pause
    exit /b 1
)

echo.
echo [INFO] Aguardando backend responder...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = 'http://127.0.0.1:%BACKEND_PORT%/actuator/health/liveness';" ^
  "$deadline = (Get-Date).AddSeconds(120);" ^
  "while ((Get-Date) -lt $deadline) {" ^
  "  try {" ^
  "    $response = Invoke-RestMethod -Uri $url -TimeoutSec 3;" ^
  "    if ($response.status -eq 'UP') { Write-Host '[OK] Backend pronto para login.'; exit 0 }" ^
  "  } catch {}" ^
  "  Start-Sleep -Seconds 2;" ^
  "}" ^
  "Write-Host ('[ERRO] Backend nao respondeu no healthcheck: ' + $url);" ^
  "exit 1"

if errorlevel 1 (
    echo.
    echo [ERRO] O backend DEV ainda nao ficou disponivel.
    echo Verifique os logs:
    echo   %BACKEND_DEV_LOG%
    echo   %BACKEND_DEV_ERR%
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "Write-Host '[INFO] Ultimas linhas do log do backend:';" ^
      "Get-Content -Path $env:BACKEND_DEV_LOG -Tail 60 -ErrorAction SilentlyContinue;" ^
      "Get-Content -Path $env:BACKEND_DEV_ERR -Tail 60 -ErrorAction SilentlyContinue;"
    pause
    exit /b 1
)

if "%BACK_ONLY%"=="1" exit /b 0

:start_frontend
echo.
echo [INFO] Iniciando frontend dev neste terminal...
if "%FRONT_ONLY%"=="1" (
    echo [INFO] Use Ctrl+C para encerrar o frontend. O backend em background sera preservado.
) else (
    echo [INFO] Use Ctrl+C para encerrar o frontend. O backend sera encerrado na proxima execucao ao liberar a porta %BACKEND_PORT%.
)
echo.

cd /d "%FRONTEND_DIR%"
set "DASHBOARD_FRONTEND_WINDOW=1"
set "NODE_ENV=development"
set "VITE_API_BASE_URL=%LOCAL_API_URL%"
set "API_BASE_URL=%LOCAL_API_URL%"
call npm run dev -- --mode %FRONTEND_MODE% --host 127.0.0.1 --port %FRONTEND_PORT% --strictPort
set "EXIT_CODE=%ERRORLEVEL%"

echo.
echo [INFO] Frontend dev encerrado com codigo %EXIT_CODE%.
exit /b %EXIT_CODE%

:validate_dev_contract
if not "%BACKEND_PORT%"=="5011" (
    echo [ERRO] Contrato DEV violado: BACKEND_PORT precisa ser 5011.
    exit /b 1
)

if not "%FRONTEND_PORT%"=="5174" (
    echo [ERRO] Contrato DEV violado: FRONTEND_PORT precisa ser 5174.
    exit /b 1
)

if "%BACKEND_PORT%"=="%PROD_BACKEND_PORT%" (
    echo [ERRO] Contrato DEV violado: backend tentou usar porta de producao %PROD_BACKEND_PORT%.
    exit /b 1
)

if "%FRONTEND_PORT%"=="%PROD_FRONTEND_PORT%" (
    echo [ERRO] Contrato DEV violado: frontend tentou usar porta de producao %PROD_FRONTEND_PORT%.
    exit /b 1
)

if not exist "%FRONTEND_DEV_ENV_FILE%" (
    echo [ERRO] Arquivo nao encontrado: .env.development
    echo        O Vite dev deve carregar .env.development com API local em %LOCAL_API_URL%.
    exit /b 1
)

if not exist "%BACKEND_DEV_ENV_FILE%" (
    echo [ERRO] Arquivo local nao encontrado: .env.development.local
    echo        Copie .env.development.local.example para .env.development.local e use banco DEV separado.
    echo        O arquivo .env da raiz e reservado para producao.
    exit /b 1
)

findstr /B /L /C:"VITE_API_BASE_URL=%LOCAL_API_URL%" "%FRONTEND_DEV_ENV_FILE%" >nul
if errorlevel 1 (
    echo [ERRO] .env.development precisa definir VITE_API_BASE_URL=%LOCAL_API_URL%.
    exit /b 1
)

findstr /I /C:"api-analytics.rodogarcia.com.br" /C:"analytics.rodogarcia.com.br" "%FRONTEND_DEV_ENV_FILE%" >nul
if not errorlevel 1 (
    echo [ERRO] .env.development nao pode apontar para dominios de producao.
    exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$file = $env:BACKEND_DEV_ENV_FILE;" ^
  "$required = @('DB_URL','DB_USER','DB_PASSWORD','JWT_SECRET','API_KEY','ACESSO_USUARIO_SUPREMO_EMAIL','ACESSO_USUARIO_SUPREMO_SENHA_INICIAL','ACESSO_USUARIO_SUPREMO_NOME','ACESSO_USUARIO_SUPREMO_PAPEL','ACESSO_USUARIO_SUPREMO_NIVEL');" ^
  "$values = @{};" ^
  "Get-Content -LiteralPath $file | ForEach-Object { $line = $_.Trim(); if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) { $idx = $line.IndexOf('='); $key = $line.Substring(0, $idx).Trim(); $value = $line.Substring($idx + 1).Trim().Trim([char]34).Trim([char]39); $values[$key] = $value } };" ^
  "$missing = $required | Where-Object { -not $values.ContainsKey($_) -or [string]::IsNullOrWhiteSpace([string]$values[$_]) };" ^
  "if ($missing) { Write-Host ('[ERRO] .env.development.local sem variaveis obrigatorias: ' + ($missing -join ', ')); exit 1 }" ^
  "$dbUrl = [string]$values['DB_URL'];" ^
  "if ($dbUrl -match '(?i)(^|;)database(name)?=DASHBOARDS($|;)') { Write-Host '[ERRO] .env.development.local nao pode usar databaseName=DASHBOARDS. Use DASHBOARDS_DEV ou outro banco DEV.'; exit 2 }" ^
  "if ($dbUrl -notmatch '(?i)(^|;)database(name)?=[^;]+') { Write-Host '[ERRO] .env.development.local precisa declarar databaseName explicito.'; exit 3 }" ^
  "$prodText = ($values.GetEnumerator() | ForEach-Object { [string]$_.Value }) -join ' ';" ^
  "if ($prodText -match '(?i)api-analytics\.rodogarcia\.com\.br|analytics\.rodogarcia\.com\.br') { Write-Host '[ERRO] .env.development.local nao pode apontar para dominios publicos de producao.'; exit 4 }" ^
  "if (($values['ENVIRONMENT'] -match '(?i)prod|production|producao') -or ($values['SPRING_PROFILES_ACTIVE'] -match '(?i)prod|production|producao')) { Write-Host '[ERRO] .env.development.local nao pode declarar ambiente de producao.'; exit 5 }" ^
  "Write-Host '[OK] .env.development.local validado para DEV isolado.';" ^
  "exit 0"
if errorlevel 1 exit /b 1

exit /b 0

:load_env_file
set "ENV_FILE_TO_LOAD=%~f1"

if not exist "%ENV_FILE_TO_LOAD%" (
    echo [ERRO] Arquivo de ambiente nao encontrado: %ENV_FILE_TO_LOAD%
    exit /b 1
)

for /f "eol=# tokens=1,* delims==" %%A in ('findstr /L /C:"=" "%ENV_FILE_TO_LOAD%"') do (
    if not "%%~A"=="" (
        set "%%~A=%%~B"
    )
)

echo [INFO] Variaveis DEV carregadas de %ENV_FILE_TO_LOAD%.
exit /b 0

:prefer_java_home
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set "PATH=%JAVA_HOME%\bin;%PATH%"
    )
)
exit /b 0
