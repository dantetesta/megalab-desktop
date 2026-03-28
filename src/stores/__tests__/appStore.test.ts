import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the tauri api before importing the store
vi.mock('../../lib/tauri', () => ({
  api: {
    getDashboardSummary: vi.fn(),
    getSyncStatus: vi.fn(),
    startFullSync: vi.fn(),
  },
}))

import { useAppStore } from '../appStore'
import { api } from '../../lib/tauri'

const mockedApi = vi.mocked(api)

describe('appStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useAppStore.setState({
      currentPage: 'dashboard',
      dashboard: null,
      syncStatus: null,
      isSyncing: false,
      toast: null,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('currentPage', () => {
    it('has "dashboard" as the default page', () => {
      expect(useAppStore.getState().currentPage).toBe('dashboard')
    })

    it('setCurrentPage updates the current page', () => {
      useAppStore.getState().setCurrentPage('gerador')
      expect(useAppStore.getState().currentPage).toBe('gerador')
    })
  })

  describe('loadDashboard', () => {
    it('fetches and stores dashboard data', async () => {
      const mockDashboard = {
        total_contests: 100,
        last_contest_number: 2800,
        last_contest_date: '2024-01-01',
        last_contest_numbers: [1, 2, 3, 4, 5, 6],
        last_sync_at: null,
        saved_games_count: 5,
        db_is_empty: false,
      }
      mockedApi.getDashboardSummary.mockResolvedValue(mockDashboard)

      await useAppStore.getState().loadDashboard()

      expect(mockedApi.getDashboardSummary).toHaveBeenCalled()
      expect(useAppStore.getState().dashboard).toEqual(mockDashboard)
    })

    it('handles errors gracefully without crashing', async () => {
      mockedApi.getDashboardSummary.mockRejectedValue(new Error('network error'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await useAppStore.getState().loadDashboard()

      expect(useAppStore.getState().dashboard).toBeNull()
      spy.mockRestore()
    })
  })

  describe('toast', () => {
    it('showToast sets toast with default info type', () => {
      useAppStore.getState().showToast('Hello')
      const toast = useAppStore.getState().toast
      expect(toast).toEqual({ message: 'Hello', type: 'info' })
    })

    it('showToast accepts explicit type', () => {
      useAppStore.getState().showToast('Error!', 'error')
      const toast = useAppStore.getState().toast
      expect(toast).toEqual({ message: 'Error!', type: 'error' })
    })

    it('clearToast resets toast to null', () => {
      useAppStore.getState().showToast('test')
      expect(useAppStore.getState().toast).not.toBeNull()
      useAppStore.getState().clearToast()
      expect(useAppStore.getState().toast).toBeNull()
    })
  })

  describe('startSync', () => {
    it('sets isSyncing to true then false', async () => {
      mockedApi.startFullSync.mockResolvedValue('ok')
      mockedApi.getDashboardSummary.mockResolvedValue({
        total_contests: 100,
        last_contest_number: 2800,
        last_contest_date: '2024-01-01',
        last_contest_numbers: [1, 2, 3, 4, 5, 6],
        last_sync_at: null,
        saved_games_count: 0,
        db_is_empty: false,
      })

      const promise = useAppStore.getState().startSync()
      // isSyncing should be true immediately
      expect(useAppStore.getState().isSyncing).toBe(true)

      await promise
      // After completion, isSyncing should be false
      expect(useAppStore.getState().isSyncing).toBe(false)
    })

    it('shows success toast after sync', async () => {
      mockedApi.startFullSync.mockResolvedValue('ok')
      mockedApi.getDashboardSummary.mockResolvedValue({
        total_contests: 100,
        last_contest_number: 2800,
        last_contest_date: '2024-01-01',
        last_contest_numbers: [1, 2, 3, 4, 5, 6],
        last_sync_at: null,
        saved_games_count: 0,
        db_is_empty: false,
      })

      await useAppStore.getState().startSync()
      const toast = useAppStore.getState().toast
      expect(toast?.type).toBe('success')
    })

    it('shows error toast on failure', async () => {
      mockedApi.startFullSync.mockRejectedValue(new Error('fail'))

      await useAppStore.getState().startSync()

      const toast = useAppStore.getState().toast
      expect(toast?.type).toBe('error')
      expect(useAppStore.getState().isSyncing).toBe(false)
    })
  })

  describe('pollSyncStatus', () => {
    it('updates syncStatus and isSyncing from API response', async () => {
      mockedApi.getSyncStatus.mockResolvedValue({
        is_syncing: true,
        progress: 50,
        message: 'Syncing...',
        total: 100,
        current: 50,
      })

      await useAppStore.getState().pollSyncStatus()

      expect(useAppStore.getState().syncStatus?.progress).toBe(50)
      expect(useAppStore.getState().isSyncing).toBe(true)
    })
  })
})
