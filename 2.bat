@echo off
setlocal EnableDelayedExpansion

echo [1/3] 取得 npm 全域路徑...
for /f "delims=" %%i in ('npm prefix -g 2^>nul') do set "NPM_GLOBAL=%%i"

if not defined NPM_GLOBAL (
    echo [錯誤] 無法取得 npm 全域路徑
    pause
    exit /b 1
)

echo NPM_GLOBAL=!NPM_GLOBAL!

echo [2/3] 安裝 Codex CLI...
call npm install -g @openai/codex
if errorlevel 1 (
    echo [錯誤] 安裝失敗
    pause
    exit /b 1
)

echo [3/3] 設定 PATH...
set "PATH=%PATH%;!NPM_GLOBAL!"

set "USERPATH="
for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v PATH 2^>nul') do set "USERPATH=%%B"

echo;!USERPATH!; | find /I ";!NPM_GLOBAL!;" >nul
if errorlevel 1 (
    if defined USERPATH (
        setx PATH "!USERPATH!;!NPM_GLOBAL!" >nul
    ) else (
        setx PATH "!NPM_GLOBAL!" >nul
    )
)

echo.
where codex
codex --help
pause