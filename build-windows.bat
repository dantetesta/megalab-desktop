@echo off
REM LotoLab Windows Build Script (Batch)
REM Execute em Windows Command Prompt com privilégios de administrador

setlocal enabledelayedexpansion

echo.
echo ========================================
echo   LotoLab - Windows Build Script
echo ========================================
echo.

REM Verificar Node.js
echo [*] Verificando Node.js...
where node >nul 2>nul
if errorlevel 1 (
    echo [X] Node.js nao encontrado!
    echo     Instale em https://nodejs.org
    pause
    exit /b 1
) else (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
    echo [OK] Node.js encontrado: !NODE_VERSION!
)

REM Verificar Rust
echo [*] Verificando Rust...
where rustc >nul 2>nul
if errorlevel 1 (
    echo [!] Rust nao encontrado!
    echo.
    echo Instalando Rust via rustup...
    curl --proto "=https" --tlsv1.2 -sSf https://win.rustup.rs -o "%TEMP%\rustup-init.exe"
    "%TEMP%\rustup-init.exe" -y
    del "%TEMP%\rustup-init.exe"
    echo [OK] Rust instalado!
    echo.
    echo Por favor, reinicie o Command Prompt e execute este script novamente.
    pause
    exit /b 1
) else (
    echo [OK] Rust encontrado
)

REM Limpar builds anteriores
echo.
echo [*] Limpando builds anteriores...
if exist "src-tauri\target\release\bundle" (
    rmdir /s /q "src-tauri\target\release\bundle"
    echo [OK] Pasta de bundle limpa
)

REM Instalar dependências
echo.
echo [*] Instalando dependências npm...
call npm ci --legacy-peer-deps
if errorlevel 1 (
    echo [X] Erro ao instalar dependencias!
    pause
    exit /b 1
)
echo [OK] Dependencias instaladas

REM Compilar
echo.
echo ========================================
echo   Compilando aplicacao Tauri...
echo   (isto pode levar 5-20 minutos)
echo ========================================
echo.

call npm run build:tauri
if errorlevel 1 (
    echo.
    echo [X] Erro na compilacao!
    pause
    exit /b 1
)

echo.
echo [OK] Compilacao concluida!
echo.

REM Procurar pelos arquivos
echo [*] Procurando arquivos gerados...
echo.

set FOUND_FILES=0

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\msi\*.msi" 2^>nul') do (
    set FOUND_FILES=1
    echo [OK] Instalador MSI:
    echo      %%f
    for %%A in ("src-tauri\target\release\bundle\msi\%%f") do (
        set SIZE=%%~zf
        set /a SIZE_MB=!SIZE!/1048576
        echo      Tamanho: !SIZE_MB! MB
    )
)

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\nsis\*.exe" 2^>nul') do (
    set FOUND_FILES=1
    echo [OK] Instalador NSIS:
    echo      %%f
    for %%A in ("src-tauri\target\release\bundle\nsis\%%f") do (
        set SIZE=%%~zf
        set /a SIZE_MB=!SIZE!/1048576
        echo      Tamanho: !SIZE_MB! MB
    )
)

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\portable\*.exe" 2^>nul') do (
    set FOUND_FILES=1
    echo [OK] Executavel Portable:
    echo      %%f
    for %%A in ("src-tauri\target\release\bundle\portable\%%f") do (
        set SIZE=%%~zf
        set /a SIZE_MB=!SIZE!/1048576
        echo      Tamanho: !SIZE_MB! MB
    )
)

if !FOUND_FILES! equ 0 (
    echo [!] Nenhum arquivo gerado encontrado
)

echo.
echo [*] Localizacao: src-tauri\target\release\bundle\
echo.

REM Copiar para Desktop
echo [*] Copiando para Desktop...
set DESKTOP=%USERPROFILE%\Desktop

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\msi\*.msi" 2^>nul') do (
    copy "src-tauri\target\release\bundle\msi\%%f" "!DESKTOP!\%%f" >nul
    echo [OK] %%f
)

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\nsis\*.exe" 2^>nul') do (
    copy "src-tauri\target\release\bundle\nsis\%%f" "!DESKTOP!\%%f" >nul
    echo [OK] %%f
)

for /f "delims=" %%f in ('dir /b "src-tauri\target\release\bundle\portable\*.exe" 2^>nul') do (
    copy "src-tauri\target\release\bundle\portable\%%f" "!DESKTOP!\%%f" >nul
    echo [OK] %%f
)

echo.
echo ========================================
echo   [OK] Build concluido!
echo ========================================
echo.
echo [*] Os instaladores estao em: !DESKTOP!
echo.
echo [*] Proximos passos:
echo     1. Teste o instalador MSI
echo     2. Compartilhe com usuarios
echo.

pause
