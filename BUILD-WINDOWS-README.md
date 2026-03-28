# 🪟 Compilar LotoLab para Windows

## Pré-requisitos

- **Windows 10 ou superior** (64-bit)
- **Node.js 18+** - [Baixar](https://nodejs.org)
- **PowerShell 5+** ou **Command Prompt**
- **Privilégios de administrador**

## Opção 1: PowerShell (Recomendado) ⭐

### Passo 1: Abra PowerShell como Administrador

1. Pressione `Win + X`
2. Selecione **Windows PowerShell (Admin)** ou **Terminal (Admin)**
3. Navegue para a pasta do projeto:
```powershell
cd "C:\path\to\megalab-desktop"
```

### Passo 2: Permita Executar Scripts

Se receber erro de permissão, execute:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Passo 3: Execute o Script

```powershell
.\build-windows.ps1
```

**O script irá:**
- ✅ Verificar Node.js e Rust
- ✅ Instalar Rust automaticamente (se necessário)
- ✅ Instalar dependências npm
- ✅ Compilar a aplicação
- ✅ Copiar instaladores para Desktop

---

## Opção 2: Command Prompt / Batch

### Passo 1: Abra Command Prompt como Administrador

1. Pressione `Win + R`
2. Digite `cmd`
3. Pressione `Ctrl + Shift + Enter` (executar como admin)
4. Navegue para a pasta:
```cmd
cd "C:\path\to\megalab-desktop"
```

### Passo 2: Execute o Script

```cmd
build-windows.bat
```

---

## O que será gerado? 📦

Após a compilação bem-sucedida, você terá:

### 1. **Instalador MSI** (Recomendado)
```
LotoLab_2.0.0_x64_en-US.msi (≈40-60 MB)
```
- Instalação padrão do Windows
- Atalho no Menu Iniciar
- Desinstalação limpa

### 2. **Instalador NSIS** (Alternativa)
```
LotoLab_2.0.0_x64_en-US.exe (≈40-60 MB)
```
- Instalador customizável
- Compatível com sistemas mais antigos

### 3. **Executável Portable** (Opcional)
```
LotoLab.exe (≈100+ MB)
```
- Sem instalação necessária
- Pode ser copiado para qualquer pasta

---

## Tempo de Compilação ⏱️

- **Primeira vez**: 10-30 minutos (depende da internet)
- **Vezes seguintes**: 5-15 minutos

A maior parte do tempo é para baixar e compilar o Rust.

---

## Solução de Problemas 🔧

### "Rust não encontrado"
- O script instalará automaticamente
- Reinicie o terminal após a instalação

### "Node.js não encontrado"
- [Instale Node.js](https://nodejs.org) na versão LTS
- Reinicie o terminal

### "npm ci falhou"
- Delete a pasta `node_modules` e `package-lock.json`
- Execute o script novamente

### "Compilação falhou com erro Rust"
- Verifique espaço em disco (2+ GB livres)
- Execute: `cargo clean`
- Tente novamente

### "Antivírus bloqueando a compilação"
- Adicione a pasta `node_modules` à whitelist
- Adicione a pasta `.cargo` à whitelist

---

## Testando o Instalador 🧪

1. Copie o MSI para uma máquina de teste
2. Execute o instalador
3. Teste as funcionalidades principais
4. Verifique se o icon aparece corretamente

---

## Distribuindo 🚀

**Opções:**
- 📧 E-mail direto
- ☁️ Google Drive / OneDrive
- 🌐 Website próprio
- 🏪 Microsoft Store (requer conta)

---

## Notas de Versão

- **Versão atual**: 2.0.0
- **Plataformas**: Windows 10+, 64-bit
- **Ícones**: Integrados ✅
- **Tamanho**: ~50 MB

---

## Suporte

Se tiver problemas:
1. Verifique os pré-requisitos
2. Execute o script novamente
3. Verifique os logs no console

---

**Última atualização**: 26/03/2026
