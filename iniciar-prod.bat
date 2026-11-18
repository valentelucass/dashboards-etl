@echo off
SETLOCAL EnableExtensions DisableDelayedExpansion
REM Build isolado. Runtime de producao permanece exclusivo do operador humano.
REM AVISO IA: nao execute iniciar-prod.bat nem controle as portas 5010/5173.
chcp 65001 >nul
if not "%~2"=="" goto usage
if "%~1"=="" goto build
if /i "%~1"=="--dry-run" goto dryrun
:usage
echo [ERRO] Uso: iniciar-prod.bat [--dry-run]
exit /b 1
:dryrun
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-prod.ps1" -DryRun
exit /b %ERRORLEVEL%
:build
echo.
echo ============================================
echo   DASHBOARDS - BUILD DE PRODUCAO ISOLADO
echo ============================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build-prod.ps1"
exit /b %ERRORLEVEL%
