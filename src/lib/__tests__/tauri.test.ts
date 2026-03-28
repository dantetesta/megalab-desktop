import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @tauri-apps/api/core before importing our module
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { api } from '../tauri'
import type {
  DashboardSummary,
  SyncStatus,
  Contest,
  NumberStat,
  LotteryConfig,
} from '../tauri'
import { invoke } from '@tauri-apps/api/core'

const mockedInvoke = vi.mocked(invoke)

describe('tauri api wrapper', () => {
  beforeEach(() => {
    mockedInvoke.mockReset()
  })

  it('getDashboardSummary calls invoke with correct command', async () => {
    const mock: DashboardSummary = {
      total_contests: 100,
      last_contest_number: 2800,
      last_contest_date: '2024-01-01',
      last_contest_numbers: [1, 2, 3, 4, 5, 6],
      last_sync_at: null,
      saved_games_count: 5,
      db_is_empty: false,
    }
    mockedInvoke.mockResolvedValue(mock)
    const result = await api.getDashboardSummary()
    expect(mockedInvoke).toHaveBeenCalledWith('get_dashboard_summary')
    expect(result).toEqual(mock)
  })

  it('getSyncStatus calls invoke with correct command', async () => {
    const mock: SyncStatus = { is_syncing: false, progress: 100, message: 'done', total: 100, current: 100 }
    mockedInvoke.mockResolvedValue(mock)
    const result = await api.getSyncStatus()
    expect(mockedInvoke).toHaveBeenCalledWith('get_sync_status')
    expect(result).toEqual(mock)
  })

  it('searchContests passes params correctly', async () => {
    mockedInvoke.mockResolvedValue({ contests: [], total: 0, page: 1, per_page: 10, total_pages: 0 })
    await api.searchContests({ page: 1, per_page: 10 })
    expect(mockedInvoke).toHaveBeenCalledWith('search_contests', {
      params: { page: 1, per_page: 10 },
    })
  })

  it('generateGame passes strategy_id and game_type', async () => {
    mockedInvoke.mockResolvedValue({ numbers: [1, 2, 3, 4, 5, 6], strategy_id: 'hibrido', strategy_label: 'Hibrido', analysis: {} })
    await api.generateGame('hibrido', 'megasena')
    expect(mockedInvoke).toHaveBeenCalledWith('generate_game', {
      params: { strategy_id: 'hibrido', count: 1, game_type: 'megasena', pick_count: null },
    })
  })

  it('generateGame uses null for optional params when omitted', async () => {
    mockedInvoke.mockResolvedValue({})
    await api.generateGame('aleatorio_puro')
    expect(mockedInvoke).toHaveBeenCalledWith('generate_game', {
      params: { strategy_id: 'aleatorio_puro', count: 1, game_type: null, pick_count: null },
    })
  })

  it('saveGame passes all fields', async () => {
    mockedInvoke.mockResolvedValue(1)
    await api.saveGame({
      numbers: [1, 2, 3, 4, 5, 6],
      strategy_id: 'test',
      strategy_label: 'Test',
      game_type: 'megasena',
    })
    expect(mockedInvoke).toHaveBeenCalledWith('save_game', {
      params: {
        numbers: [1, 2, 3, 4, 5, 6],
        strategy_id: 'test',
        strategy_label: 'Test',
        game_type: 'megasena',
      },
    })
  })

  it('listSavedGames defaults gameType to null', async () => {
    mockedInvoke.mockResolvedValue([])
    await api.listSavedGames()
    expect(mockedInvoke).toHaveBeenCalledWith('list_saved_games', { gameType: null })
  })

  it('deleteSavedGame passes id', async () => {
    mockedInvoke.mockResolvedValue(undefined)
    await api.deleteSavedGame(42)
    expect(mockedInvoke).toHaveBeenCalledWith('delete_saved_game', { id: 42 })
  })

  it('toggleFavoriteGame passes id', async () => {
    mockedInvoke.mockResolvedValue(true)
    const result = await api.toggleFavoriteGame(5)
    expect(mockedInvoke).toHaveBeenCalledWith('toggle_favorite_game', { id: 5 })
    expect(result).toBe(true)
  })
})

describe('tauri type definitions', () => {
  it('DashboardSummary has expected shape', () => {
    const obj: DashboardSummary = {
      total_contests: 0,
      last_contest_number: null,
      last_contest_date: null,
      last_contest_numbers: null,
      last_sync_at: null,
      saved_games_count: 0,
      db_is_empty: true,
    }
    expect(obj.total_contests).toBe(0)
    expect(obj.db_is_empty).toBe(true)
  })

  it('Contest type includes all required fields', () => {
    const c: Contest = {
      id: 1,
      contest_number: 2800,
      contest_date: '2024-01-01',
      location: null,
      numbers_draw_order: [6, 5, 4, 3, 2, 1],
      numbers_sorted: [1, 2, 3, 4, 5, 6],
      numbers_sorted_text: '01-02-03-04-05-06',
      accumulated: false,
      next_contest_number: 2801,
      next_contest_date: null,
      estimated_next_prize: null,
      amount_collected: null,
      prizes: [],
      raw_json: null,
      trevos_json: null,
      time_coracao: null,
      mes_sorte: null,
    }
    expect(c.contest_number).toBe(2800)
  })

  it('LotteryConfig has game configuration fields', () => {
    const config: LotteryConfig = {
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
    expect(config.numbers_pool_size).toBe(60)
    expect(config.has_trevos).toBe(false)
  })

  it('NumberStat includes statistical fields', () => {
    const stat: NumberStat = {
      number_value: 7,
      historical_frequency: 350,
      recent_frequency_30: 5,
      recent_frequency_60: 10,
      recent_frequency_100: 18,
      current_delay: 3,
      average_gap: 10.5,
      gap_std_dev: 2.3,
    }
    expect(stat.number_value).toBe(7)
    expect(stat.average_gap).toBe(10.5)
  })
})
