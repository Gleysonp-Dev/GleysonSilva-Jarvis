@echo off
setlocal
title GleysonSilva-Jarvis - Teste local
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale Node.js 24 ou superior em https://nodejs.org
  pause
  exit /b 1
)
if not exist "dist\app.js" (
  echo Preparando interface. Na primeira instalacao, execute npm install nesta pasta.
  call npm.cmd run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
set JARVIS_TEST_PORT=47833
echo Jarvis abrira em http://127.0.0.1:47833
echo Mantenha esta janela aberta durante o teste. Ctrl+C encerra.
echo As chaves ficam somente na memoria desta sessao.
start "" "http://127.0.0.1:47833"
node scripts/local-test.mjs
pause
