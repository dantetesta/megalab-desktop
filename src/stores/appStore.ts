import { create } from 'zustand'
import { api, type DashboardSummary, type SyncStatus } from '../lib/tauri'

interface AppStore {
  currentPage: string
  setCurrentPage: (page: string) => void

  dashboard: DashboardSummary | null
  loadDashboard: () => Promise<void>

  syncStatus: SyncStatus | null
  isSyncing: boolean
  startSync: () => Promise<void>
  pollSyncStatus: () => Promise<void>

  toast: { message: string; type: 'success' | 'error' | 'info' } | null
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void
  clearToast: () => void
}

export const useAppStore = create<AppStore>((set, get) => ({
  currentPage: 'dashboard',
  setCurrentPage: (page) => {
    set({ currentPage: page })
    api.trackPage(page)
  },

  dashboard: null,
  loadDashboard: async () => {
    try {
      const data = await api.getDashboardSummary()
      set({ dashboard: data })
    } catch (e) {
      console.error('Failed to load dashboard:', e)
    }
  },

  syncStatus: null,
  isSyncing: false,
  startSync: async () => {
    set({ isSyncing: true })
    try {
      await api.startFullSync()
      await get().loadDashboard()
      get().showToast('Base atualizada com sucesso!', 'success')
    } catch (e: any) {
      get().showToast(e?.toString() || 'Erro ao sincronizar', 'error')
    } finally {
      set({ isSyncing: false })
    }
  },
  pollSyncStatus: async () => {
    try {
      const status = await api.getSyncStatus()
      set({ syncStatus: status, isSyncing: status.is_syncing })
    } catch (e) {
      console.error(e)
    }
  },

  toast: null,
  showToast: (message, type = 'info') => {
    set({ toast: { message, type } })
    setTimeout(() => set({ toast: null }), 4000)
  },
  clearToast: () => set({ toast: null }),
}))
