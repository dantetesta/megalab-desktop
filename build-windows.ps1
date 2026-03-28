# LotoLab Windows Build Script
# Execute em Windows PowerShell com privilégios de administrador
# PS> .\build-windows.ps1

Write-Host "🔨 LotoLab - Windows Build Script" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se está em Windows
if ($PSVersionTable.Platform -ne "Win32NT") {
    Write-Host "❌ Este script deve ser executado em Windows!" -ForegroundColor Red
    exit 1
}

# Verificar Node.js
Write-Host "✓ Verificando Node.js..." -ForegroundColor Yellow
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "❌ Node.js não encontrado! Instale em https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js encontrado: $($node.Version)" -ForegroundColor Green

# Verificar Rust
Write-Host "✓ Verificando Rust..." -ForegroundColor Yellow
$rustc = Get-Command rustc -ErrorAction SilentlyContinue
if (-not $rustc) {
    Write-Host "⚠️  Rust não encontrado!" -ForegroundColor Yellow
    Write-Host "   Instalando Rust via rustup..." -ForegroundColor Yellow

    $rustupUrl = "https://win.rustup.rs/x86_64"
    $rustupPath = "$env:TEMP\rustup-init.exe"

    Write-Host "   Baixando rustup..." -ForegroundColor Gray
    Invoke-WebRequest -Uri $rustupUrl -OutFile $rustupPath

    Write-Host "   Executando instalador (aceite as opções padrão)..." -ForegroundColor Gray
    & $rustupPath -y

    # Atualizar PATH
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"

    Remove-Item $rustupPath
    Write-Host "✅ Rust instalado!" -ForegroundColor Green
} else {
    Write-Host "✅ Rust encontrado" -ForegroundColor Green
}

# Verificar Cargo
$cargo = Get-Command cargo -ErrorAction SilentlyContinue
if (-not $cargo) {
    Write-Host "❌ Cargo não disponível!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✓ Limpando builds anteriores..." -ForegroundColor Yellow
Remove-Item -Path "src-tauri\target\release\bundle" -Recurse -ErrorAction SilentlyContinue
Write-Host "  ✅ Pasta de bundle limpa" -ForegroundColor Green

Write-Host ""
Write-Host "✓ Instalando dependências npm..." -ForegroundColor Yellow
npm ci --legacy-peer-deps
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro ao instalar dependências!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Dependências instaladas" -ForegroundColor Green

Write-Host ""
Write-Host "🔨 Compilando aplicação Tauri para Windows..." -ForegroundColor Cyan
Write-Host "   Isto pode levar 5-20 minutos na primeira vez" -ForegroundColor Gray
Write-Host ""

npm run build:tauri
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "❌ Erro na compilação!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Compilação concluída!" -ForegroundColor Green
Write-Host ""

# Procurar pelos arquivos gerados
Write-Host "📦 Arquivos gerados:" -ForegroundColor Cyan
Write-Host ""

$msi = Get-Item "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue
if ($msi) {
    Write-Host "  ✅ Instalador MSI:" -ForegroundColor Green
    foreach ($file in $msi) {
        Write-Host "     📁 $($file.Name)" -ForegroundColor White
        Write-Host "        Tamanho: $([math]::Round($file.Length/1MB, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host "  ⚠️  Nenhum MSI gerado" -ForegroundColor Yellow
}

$exe = Get-Item "src-tauri\target\release\bundle\nsis\*.exe" -ErrorAction SilentlyContinue
if ($exe) {
    Write-Host ""
    Write-Host "  ✅ Instalador NSIS:" -ForegroundColor Green
    foreach ($file in $exe) {
        Write-Host "     📁 $($file.Name)" -ForegroundColor White
        Write-Host "        Tamanho: $([math]::Round($file.Length/1MB, 2)) MB" -ForegroundColor Gray
    }
} else {
    Write-Host ""
    Write-Host "  ⚠️  Nenhum NSIS gerado" -ForegroundColor Yellow
}

$portable = Get-Item "src-tauri\target\release\bundle\portable\*.exe" -ErrorAction SilentlyContinue
if ($portable) {
    Write-Host ""
    Write-Host "  ✅ Executável Portable:" -ForegroundColor Green
    foreach ($file in $portable) {
        Write-Host "     📁 $($file.Name)" -ForegroundColor White
        Write-Host "        Tamanho: $([math]::Round($file.Length/1MB, 2)) MB" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📍 Localização: src-tauri\target\release\bundle\" -ForegroundColor Gray
Write-Host ""

# Copiar para Desktop
Write-Host "✓ Copiando para Desktop..." -ForegroundColor Yellow
$desktop = [Environment]::GetFolderPath("Desktop")

if ($msi) {
    foreach ($file in $msi) {
        Copy-Item $file.FullName "$desktop\$($file.Name)" -Force
        Write-Host "  ✅ $($file.Name)" -ForegroundColor Green
    }
}

if ($exe) {
    foreach ($file in $exe) {
        Copy-Item $file.FullName "$desktop\$($file.Name)" -Force
        Write-Host "  ✅ $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Pronto! Os instaladores estão em: $desktop" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "  1. Teste o instalador MSI em uma máquina limpa" -ForegroundColor Gray
Write-Host "  2. Faça upload para distribuição" -ForegroundColor Gray
Write-Host "  3. Compartilhe o link com usuários" -ForegroundColor Gray
Write-Host ""

Write-Host "🎉 Build completo!" -ForegroundColor Green
