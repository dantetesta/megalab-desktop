# LotoLogic - Laboratorio de Loterias

Ferramenta desktop completa de analise para loterias CAIXA. Desenvolvida com Tauri 2 + React + Rust.

## Download

Baixe a versao mais recente para seu sistema operacional:

| Plataforma | Link |
|------------|------|
| macOS (Apple Silicon) | [LotoLogic_aarch64.dmg](https://github.com/dantetesta/megalab-desktop/releases/latest) |
| macOS (Intel) | [LotoLogic_x64.dmg](https://github.com/dantetesta/megalab-desktop/releases/latest) |
| Windows (Setup) | [LotoLogic_x64-setup.exe](https://github.com/dantetesta/megalab-desktop/releases/latest) |
| Windows (MSI) | [LotoLogic_x64_en-US.msi](https://github.com/dantetesta/megalab-desktop/releases/latest) |
| Linux (AppImage) | [LotoLogic_amd64.AppImage](https://github.com/dantetesta/megalab-desktop/releases/latest) |
| Linux (deb) | [LotoLogic_amd64.deb](https://github.com/dantetesta/megalab-desktop/releases/latest) |

Todos os instaladores estao disponiveis na pagina de [Releases](https://github.com/dantetesta/megalab-desktop/releases).

## Funcionalidades

- Analise estatistica completa de todas as loterias CAIXA
- Gerador inteligente de jogos com multiplas estrategias
- LotoCore Engine - motor de geracao com 9 algoritmos combinados
- SuperLab - laboratorio avancado com backtest, Monte Carlo, genetico e mais
- Assistente IA integrado (OpenAI / Gemini)
- Calendario lunar correlacionado com sorteios
- Gerenciamento de apostas com conferencia automatica
- Dashboard interativo com graficos e estatisticas
- Importacao/exportacao de dados (CSV, SQL)
- Suporte a 9 loterias: Mega-Sena, Lotofacil, Quina, Lotomania, Timemania, Dupla Sena, Dia de Sorte, Super Sete, +Milionaria

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Recharts, Zustand
- **Backend:** Rust, Tauri 2, SQLite (rusqlite), Tokio
- **Build:** Vite 8, GitHub Actions (CI/CD multi-plataforma)

## Desenvolvimento

```bash
# Instalar dependencias
npm install

# Rodar em modo dev
npm run dev:tauri

# Build de producao
npx tauri build
```

## Autor

**Dante Testa** - [lotologic.com.br](https://lotologic.com.br)

## Licenca

MIT
