import { create } from 'zustand'
import { api, type LotteryConfig } from '../lib/tauri'

interface LotteryStore {
  enabledGames: LotteryConfig[]
  activeGame: string
  primaryGame: string
  loaded: boolean
  load: () => Promise<void>
  setActiveGame: (gt: string) => void
}

export const useLotteryStore = create<LotteryStore>((set) => ({
  enabledGames: [],
  activeGame: 'megasena',
  primaryGame: 'megasena',
  loaded: false,

  load: async () => {
    try {
      const catalog = await api.getGamesCatalog()
      const enabledTypes = await api.getEnabledGames()
      const primary = await api.getPrimaryGame()
      const enabledConfigs = catalog.filter(g => enabledTypes.includes(g.game_type))
      set({
        enabledGames: enabledConfigs,
        primaryGame: primary || enabledTypes[0] || 'megasena',
        activeGame: primary || enabledTypes[0] || 'megasena',
        loaded: true,
      })
    } catch (e) {
      console.error('Failed to load lottery store:', e)
    }
  },

  setActiveGame: (gt) => set({ activeGame: gt }),
}))
