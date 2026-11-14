@echo off
chcp 65001 >nul
title Saldo API
cd /d "%~dp0"
echo ============================================
echo   Saldo API
echo ============================================
where npm >nul 2>nul
if errorlevel 1 goto :sem_node
if not exist .env copy .env.example .env >nul
if exist node_modules goto :rodar
echo Instalando dependencias - na primeira vez leva 1 ou 2 minutos...
call npm install
if errorlevel 1 goto :erro
:rodar
start "" cmd /c "timeout /t 6 >nul & start http://localhost:3333/docs"
call npm run dev
echo.
echo A API parou. Veja a mensagem acima.
pause
exit /b
:sem_node
echo [ERRO] Node.js nao encontrado. Instale a versao LTS em https://nodejs.org
start https://nodejs.org/pt
pause
exit /b 1
:erro
echo.
echo [ERRO] Algo deu errado. Tire um print desta janela e mande para o Claude.
pause
exit /b 1
