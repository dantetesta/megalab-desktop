import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the tauri api
vi.mock('../../lib/tauri', () => ({
  api: {
    getGamesCatalog: vi.fn(),
    getEnabledGames: vi.fn(),
    getPrimaryGame: vi.fn(),
  },
}))

import { useLotteryStore } from '../lotteryStore'
import { api } from '../../lib/tauri'

const mockedApi = vi.mocked(api)

const megasenaConfig = {
  game_type: 'megasena',
  display_name: 'Mega-Sena',
  api_path: '/megasena',
  numbers_pool_size: 60,
  min_pick_count: 6,
  max_pick_count: 20,
  default_pick_count: 6,
  has_trevos: false,
  trevo_pool_size: 0,
  trevo_pick_count: 0,
  has_time_coracao: false,
  has_mes_sorte: false,
  sort_order: 1,
  color: '#209869',
}

const lotofacilConfig = {
  game_type: 'lotofacil',
  display_name: 'Lotofacil',
  api_path: '/lotofacil',
  numbers_pool_size: 25,
  min_pick_count: 15,
  max_pick_count: 20,
  default_pick_count: 15,
  has_trevos: false,
  trevo_pool_size: 0,
  trevo_pick_count: 0,
  has_time_coracao: false,
  has_mes_sorte: false,
  sort_order: 2,
  color: '#930992',
}

describe('lotteryStore', () => {
  beforeEach(() => {
    useLotteryStore.setState({
      enabledGames: [],
      activeGame: 'megasena',
      primaryGame: 'megasena',
      loaded: false,
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('starts with empty enabledGames', () => {
      expect(useLotteryStore.getState().enabledGames).toEqual([])
    })

    it('starts with megasena as activeGame', () => {
      expect(useLotteryStore.getState().activeGame).toBe('megasena')
    })

    it('starts as not loaded', () => {
      expect(useLotteryStore.getState().loaded).toBe(false)
    })
  })

  describe('setActiveGame', () => {
    it('updates the active game', () => {
      useLotteryStore.getState().setActiveGame('lotofacil')
      expect(useLotteryStore.getState().activeGame).toBe('lotofacil')
    })
  })

  describe('load', () => {
    it('fetches catalog, enabled games, and primary game', async () => {
      mockedApi.getGamesCatalog.mockResolvedValue([megasenaConfig, lotofacilConfig])
      mockedApi.getEnabledGames.mockResolvedValue(['megasena', 'lotofacil'])
      mockedApi.getPrimaryGame.mockResolvedValue('megasena')

      await useLotteryStore.getState().load()

      expect(mockedApi.getGamesCatalog).toHaveBeenCalled()
      expect(mockedApi.getEnabledGames).toHaveBeenCalled()
      expect(mockedApi.getPrimaryGame).toHaveBeenCalled()
    })

    it('filters catalog to only enabled games', async () => {
      mockedApi.getGamesCatalog.mockResolvedValue([megasenaConfig, lotofacilConfig])
      mockedApi.getEnabledGames.mockResolvedValue(['megasena'])
      mockedApi.getPrimaryGame.mockResolvedValue('megasena')

      await useLotteryStore.getState().load()

      const state = useLotteryStore.getState()
      expect(state.enabledGames).toHaveLength(1)
      expect(state.enabledGames[0].game_type).toBe('megasena')
    })

    it('sets primaryGame and activeGame from API', async () => {
      mockedApi.getGamesCatalog.mockResolvedValue([megasenaConfig, lotofacilConfig])
      mockedApi.getEnabledGames.mockResolvedValue(['megasena', 'lotofacil'])
      mockedApi.getPrimaryGame.mockResolvedValue('lotofacil')

      await useLotteryStore.getState().load()

      const state = useLotteryStore.getState()
      expect(state.primaryGame).toBe('lotofacil')
      expect(state.activeGame).toBe('lotofacil')
    })

    it('falls back to first enabled game when primaryGame is null', async () => {
      mockedApi.getGamesCatalog.mockResolvedValue([megasenaConfig, lotofacilConfig])
      mockedApi.getEnabledGames.mockResolvedValue(['lotofacil', 'megasena'])
      mockedApi.getPrimaryGame.mockResolvedValue(null)

      await useLotteryStore.getState().load()

      const state = useLotteryStore.getState()
      expect(state.primaryGame).toBe('lotofacil')
      expect(state.activeGame).toBe('lotofacil')
    })

    it('sets loaded to true after successful load', async () => {
      mockedApi.getGamesCatalog.mockResolvedValue([megasenaConfig])
      mockedApi.getEnabledGames.mockResolvedValue(['megasena'])
      mockedApi.getPrimaryGame.mockResolvedValue('megasena')

      await useLotteryStore.getState().load()

      expect(useLotteryStore.getState().loaded).toBe(true)
    })

    it('handles errors gracefully', async () => {
      mockedApi.getGamesCatalog.mockRejectedValue(new Error('fail'))
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await useLotteryStore.getState().load()

      expect(useLotteryStore.getState().loaded).toBe(false)
      spy.mockRestore()
    })
  })
})
