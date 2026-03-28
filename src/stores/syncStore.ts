import { create } from 'zustand'
import { api, type GameSyncInfo } from '../lib/tauri.ts'

export type GameSyncStatus = 'idle' | 'checking' | 'syncing' | 'paused' | 'done' | 'error'

export interface GameSyncState {
  status: GameSyncStatus
  progress: number
  message: string
  remoteLast: number
  localLast: number
  missing: number
  error?: string
}

const defaultGameState: GameSyncState = {
  status: 'idle',
  progress: 0,
  message: '',
  remoteLast: 0,
  localLast: 0,
  missing: 0,
}

interface SyncStore {
  games: Record<string, GameSyncState>
  _stopFlags: Record<string, boolean>

  getGameState: (gameType: string) => GameSyncState
  checkGameStatus: (gameType: string) => Promise<void>
  checkAllGames: (gameTypes: string[]) => Promise<void>
  startSync: (gameType: string) => Promise<void>
  syncAllEnabled: (gameTypes: string[]) => Promise<void>
  stopSync: (gameType: string) => void
  stopAll: () => void
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  games: {},
  _stopFlags: {},

  getGameState: (gameType: string): GameSyncState => {
    return get().games[gameType] || { ...defaultGameState }
  },

  checkGameStatus: async (gameType: string) => {
    set(s => ({
      games: {
        ...s.games,
        [gameType]: { ...(s.games[gameType] || defaultGameState), status: 'checking' as const, message: 'Verificando...', error: undefined }
      }
    }))

    try {
      const info: GameSyncInfo = await api.checkGameStatus(gameType)
      set(s => ({
        games: {
          ...s.games,
          [gameType]: {
            ...(s.games[gameType] || defaultGameState),
            status: info.missing_count === 0 ? 'done' as const : 'idle' as const,
            message: info.missing_count === 0 ? 'Atualizado!' : `${info.missing_count} concursos faltando`,
            remoteLast: info.remote_latest,
            localLast: info.local_latest,
            missing: info.missing_count,
            error: undefined,
          }
        }
      }))
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      set(s => ({
        games: {
          ...s.games,
          [gameType]: {
            ...(s.games[gameType] || defaultGameState),
            status: 'error' as const,
            message: 'Erro ao verificar',
            error: errMsg,
          }
        }
      }))
    }
  },

  checkAllGames: async (gameTypes: string[]) => {
    await Promise.all(gameTypes.map(gt => get().checkGameStatus(gt)))
  },

  startSync: async (gameType: string) => {
    const current = get().games[gameType]
    if (current?.status === 'syncing') return

    // Clear stop flag
    set(s => ({
      _stopFlags: { ...s._stopFlags, [gameType]: false },
      games: {
        ...s.games,
        [gameType]: {
          ...(s.games[gameType] || defaultGameState),
          status: 'syncing' as const,
          progress: 0,
          message: 'Sincronizando...',
          error: undefined,
        }
      }
    }))

    try {
      // Call the Rust sync command
      const result = await api.syncGame(gameType)

      // Check if stop was requested while we were syncing
      const wasStopped = get()._stopFlags[gameType]

      if (wasStopped) {
        set(s => ({
          games: {
            ...s.games,
            [gameType]: {
              ...(s.games[gameType] || defaultGameState),
              status: 'idle' as const,
              progress: 0,
              message: 'Parado pelo usuário',
            }
          }
        }))
      } else {
        set(s => ({
          games: {
            ...s.games,
            [gameType]: {
              ...(s.games[gameType] || defaultGameState),
              status: 'done' as const,
              progress: 100,
              message: result,
              missing: 0,
            }
          }
        }))
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      set(s => ({
        games: {
          ...s.games,
          [gameType]: {
            ...(s.games[gameType] || defaultGameState),
            status: 'error' as const,
            message: 'Erro ao sincronizar',
            error: errMsg,
          }
        }
      }))
    }
  },

  syncAllEnabled: async (gameTypes: string[]) => {
    // Start syncs sequentially to avoid overloading the API
    for (const gt of gameTypes) {
      const stopFlag = get()._stopFlags[gt]
      if (stopFlag) break
      const gameState = get().games[gt]
      if (gameState?.status === 'syncing') continue
      if (gameState?.status === 'done' && gameState.missing === 0) continue
      await get().startSync(gt)
    }
  },

  stopSync: (gameType: string) => {
    set(s => ({
      _stopFlags: { ...s._stopFlags, [gameType]: true },
      games: {
        ...s.games,
        [gameType]: {
          ...(s.games[gameType] || defaultGameState),
          status: s.games[gameType]?.status === 'syncing' ? 'paused' as const : (s.games[gameType]?.status || 'idle' as const),
          message: s.games[gameType]?.status === 'syncing' ? 'Parando...' : (s.games[gameType]?.message || ''),
        }
      }
    }))
  },

  stopAll: () => {
    const { games } = get()
    const newFlags: Record<string, boolean> = {}
    const newGames: Record<string, GameSyncState> = { ...games }
    for (const gt of Object.keys(games)) {
      newFlags[gt] = true
      if (games[gt].status === 'syncing') {
        newGames[gt] = { ...games[gt], status: 'paused', message: 'Parando...' }
      }
    }
    set({ _stopFlags: newFlags, games: newGames })
  },
}))
