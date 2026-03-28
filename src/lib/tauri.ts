import { invoke } from '@tauri-apps/api/core'

// Types
export interface DashboardSummary {
  total_contests: number
  last_contest_number: number | null
  last_contest_date: string | null
  last_contest_numbers: number[] | null
  last_sync_at: string | null
  saved_games_count: number
  db_is_empty: boolean
}

export interface SyncStatus {
  is_syncing: boolean
  progress: number
  message: string
  total: number
  current: number
}

export interface Contest {
  id: number
  contest_number: number
  contest_date: string
  location: string | null
  numbers_draw_order: number[]
  numbers_sorted: number[]
  numbers_sorted_text: string
  accumulated: boolean
  next_contest_number: number | null
  next_contest_date: string | null
  estimated_next_prize: number | null
  amount_collected: number | null
  prizes: Prize[]
  raw_json: string | null
  trevos_json: string | null
  time_coracao: string | null
  mes_sorte: string | null
}

export interface Prize {
  description: string | null
  range_number: number | null
  winners_count: number | null
  prize_value: number | null
}

export interface ContestSearchResult {
  contests: Contest[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface NumberStat {
  number_value: number
  historical_frequency: number
  recent_frequency_30: number
  recent_frequency_60: number
  recent_frequency_100: number
  current_delay: number
  average_gap: number
  gap_std_dev: number
}

export interface NumberDetail {
  number: number
  historical_frequency: number
  recent_frequency: number
  current_delay: number
}

export interface GameAnalysis {
  numbers: number[]
  sum_total: number
  even_count: number
  odd_count: number
  range_01_10: number
  range_11_20: number
  range_21_30: number
  range_31_40: number
  range_41_50: number
  range_51_60: number
  max_sequence_length: number
  consecutive_count: number
  avg_distance: number
  number_details: NumberDetail[]
  repeats_from_last: number
  exact_match_count: number
  same_parity_count: number
  same_range_count: number
  dispersion_score: number
  affinity_score: number
  structural_score: number
}

export interface GeneratedGame {
  numbers: number[]
  strategy_id: string
  strategy_label: string
  analysis: GameAnalysis
  mes_sorte: string | null
  time_coracao: string | null
  trevos: number[] | null
}

export interface SavedGame {
  id: number
  name: string | null
  numbers: number[]
  numbers_text: string
  strategy_id: string
  strategy_label: string
  notes: string | null
  is_favorite: boolean
  is_bet: boolean
  target_contest_number: number | null
  created_at: string
  updated_at: string
  game_type: string | null
}

export interface GameSyncInfo {
  game_type: string
  remote_latest: number
  local_latest: number
  missing_count: number
}

export interface SpecialFieldStat {
  label: string
  count: number
}

export interface CreditsData {
  author: string
  pix_key: string
  website: string
  academy_website: string
  phone: string
  whatsapp: string
  email: string
  api_credit: string
  app_version: string
  message_headline: string
  message_body: string
  pix_note: string
}

// API calls
export const api = {
  getDashboardSummary: () => invoke<DashboardSummary>('get_dashboard_summary'),
  getSyncStatus: () => invoke<SyncStatus>('get_sync_status'),
  startFullSync: () => invoke<string>('start_full_sync'),
  startIncrementalSync: () => invoke<string>('start_incremental_sync'),
  searchContests: (params: { search_number?: number | null; date_from?: string | null; date_to?: string | null; page: number; per_page: number; game_type?: string | null }) =>
    invoke<ContestSearchResult>('search_contests', { params }),
  getContestDetails: (contestNumber: number, gameType?: string) => invoke<Contest | null>('get_contest_details', { contestNumber, gameType: gameType || null }),
  generateGame: (strategyId: string, gameType?: string, pickCount?: number) => invoke<GeneratedGame>('generate_game', { params: { strategy_id: strategyId, count: 1, game_type: gameType || null, pick_count: pickCount || null } }),
  generatePortfolio: (count: number, gameType?: string) => invoke<GeneratedGame[]>('generate_portfolio', { count, gameType: gameType || null }),
  analyzeGame: (numbers: number[], gameType?: string) => invoke<GameAnalysis>('analyze_game_cmd', { numbers, gameType: gameType || null }),
  saveGame: (params: { name?: string | null; numbers: number[]; strategy_id: string; strategy_label: string; notes?: string | null; target_contest_number?: number | null; game_type?: string | null }) =>
    invoke<number>('save_game', { params }),
  listSavedGames: (gameType?: string) => invoke<SavedGame[]>('list_saved_games', { gameType: gameType || null }),
  deleteSavedGame: (id: number) => invoke<void>('delete_saved_game', { id }),
  toggleFavoriteGame: (id: number) => invoke<boolean>('toggle_favorite_game', { id }),
  markGameAsBet: (id: number) => invoke<void>('mark_game_as_bet', { id }),
  formatGameForClipboard: (numbers: number[]) => invoke<string>('format_game_for_clipboard', { numbers }),
  formatAllGamesForClipboard: (games: number[][]) => invoke<string>('format_all_games_for_clipboard', { games }),
  getNumberStats: () => invoke<NumberStat[]>('get_number_stats'),
  getCreditsData: () => invoke<CreditsData>('get_credits_data'),
  // Export/Import
  exportContestsCsv: () => invoke<string>('export_contests_csv'),
  exportSavedGamesCsv: () => invoke<string>('export_saved_games_csv'),
  exportFullDatabaseSql: () => invoke<string>('export_full_database_sql'),
  importDatabaseSql: (sql: string) => invoke<string>('import_database_sql', { sql }),
  downloadAndImportSql: (url: string, gameType: string) => invoke<string>('download_and_import_sql', { url, gameType }),
  checkForNewContests: () => invoke<string>('check_for_new_contests'),
  checkGameStatus: (gameType: string) => invoke<GameSyncInfo>('check_game_status', { gameType }),
  getSpecialFieldStats: (gameType: string, lastN?: number | null) => invoke<SpecialFieldStat[]>('get_special_field_stats', { gameType, lastN: lastN || null }),
  getTrevoStats: (lastN?: number | null) => invoke<SpecialFieldStat[]>('get_trevo_stats', { lastN: lastN || null }),
  generateGamesPdfHtml: () => invoke<string>('generate_games_pdf_html'),
  toggleBetGame: (id: number) => invoke<boolean>('toggle_bet_game', { id }),
  checkBetResults: (gameType?: string) => invoke<BetCheckResult[]>('check_bet_results', { gameType: gameType || null }),
  checkBetResultsForContest: (gameType: string, contestNumber: number) => invoke<BetCheckResult[]>('check_bet_results_for_contest', { gameType, contestNumber }),
  getDynamicDashboardStats: (lastN: number | null, gameType?: string) => invoke<DynamicDashboardStats>('get_dynamic_dashboard_stats', { lastN, gameType: gameType || null }),
  // Multi-game
  getAllLotteries: () => invoke<LotteryConfig[]>('get_all_lotteries'),
  getGamesCatalog: () => invoke<LotteryConfig[]>('get_games_catalog'),
  isOnboardingDone: () => invoke<boolean>('is_onboarding_done'),
  getEnabledGames: () => invoke<string[]>('get_enabled_games'),
  getPrimaryGame: () => invoke<string | null>('get_primary_game'),
  completeOnboarding: (gameTypes: string[], primary: string) => invoke<void>('complete_onboarding', { gameTypes, primary }),
  getBetPrice: (gameType: string, pickCount: number) => invoke<number | null>('get_bet_price', { gameType, pickCount }),
  getLotteryConfig: (gameType: string) => invoke<LotteryConfig | null>('get_lottery_config', { gameType }),
  syncGame: (gameType: string) => invoke<string>('sync_game', { gameType }),
  updateBetPrice: (gameType: string, pickCount: number, price: number) => invoke<void>('update_bet_price', { gameType, pickCount, price }),
  getContestsCountPerGame: () => invoke<[string, number][]>('get_contests_count_per_game'),
  runManualSeedImport: () => invoke<string>('run_manual_seed_import'),
  factoryReset: () => invoke<string>('factory_reset'),
}

export interface DynamicDashboardStats {
  contest_count: number
  first_contest: number
  last_contest: number
  avg_sum: number
  even_pct: number
  odd_pct: number
  number_data: { number: number; frequency: number; delay: number }[]
  sum_distribution: { label: string; count: number }[]
  range_distribution: { label: string; total: number }[]
}

export interface LotteryConfig {
  game_type: string
  display_name: string
  api_path: string
  numbers_pool_size: number
  min_pick_count: number
  max_pick_count: number
  default_pick_count: number
  has_trevos: boolean
  trevo_pool_size: number
  trevo_pick_count: number
  has_time_coracao: boolean
  has_mes_sorte: boolean
  sort_order: number
  color: string
}

export interface BetCheckResult {
  game_id: number
  game_numbers: number[]
  contest_number: number
  contest_numbers: number[]
  hits: number[]
  hit_count: number
  prize_label: string
}
