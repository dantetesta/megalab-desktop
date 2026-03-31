import { invoke, convertFileSrc } from '@tauri-apps/api/core'

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
  github_url: string
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
  generatePortfolio: (count: number, gameType?: string, pickCount?: number) => invoke<GeneratedGame[]>('generate_portfolio', { count, gameType: gameType || null, pickCount: pickCount || null }),
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
  getTableCounts: () => invoke<[string, number][]>('get_table_counts'),
  downloadAndImportSql: (url: string, gameType: string) => invoke<string>('download_and_import_sql', { url, gameType }),
  checkForNewContests: () => invoke<string>('check_for_new_contests'),
  checkGameStatus: (gameType: string) => invoke<GameSyncInfo>('check_game_status', { gameType }),
  getSpecialFieldStats: (gameType: string, lastN?: number | null) => invoke<SpecialFieldStat[]>('get_special_field_stats', { gameType, lastN: lastN || null }),
  getTrevoStats: (lastN?: number | null) => invoke<SpecialFieldStat[]>('get_trevo_stats', { lastN: lastN || null }),
  generateGamesPdfHtml: () => invoke<string>('generate_games_pdf_html'),
  toggleBetGame: (id: number) => invoke<boolean>('toggle_bet_game', { id }),
  checkBetResults: (gameType?: string) => invoke<BetCheckResult[]>('check_bet_results', { gameType: gameType || null }),
  checkBetResultsForContest: (gameType: string, contestNumber: number) => invoke<BetCheckResult[]>('check_bet_results_for_contest', { gameType, contestNumber }),
  checkHistoricalWins: (gameType: string) => invoke<HistoricalWinResult[]>('check_historical_wins', { gameType }),
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

  // ═══ LotoCore Engine ═══
  generateLotoCore: (config: LotoCoreConfig) => invoke<LotoCoreResult>('generate_lotocore', { config }),

  // ═══ AI Assistant ═══
  aiChat: (config: AiConfig, messages: AiMessage[], gameType?: string) => invoke<AiResponse>('ai_chat', { config, messages, gameType: gameType || null }),
  aiQueryDb: (sql: string) => invoke<string>('ai_query_db', { sql }),
  trackPage: (page: string) => invoke<void>('track_page', { page }).catch(() => {}),
  getAiConfig: () => invoke<AiConfig | null>('get_ai_config'),
  saveAiConfig: (config: AiConfig) => invoke<void>('save_ai_config', { config }),
  aiSaveGames: (games: AiGameToSave[]) => invoke<string>('ai_save_games', { games }),

  // ═══ Lunar Calendar ═══
  importLunarCalendar: (jsonData: string) => invoke<string>('import_lunar_calendar', { jsonData }),
  getLunarCalendarCount: () => invoke<number>('get_lunar_calendar_count'),

  // ═══ Data Management ═══
  auditStorage: () => invoke<StorageAudit>('audit_storage'),
  clearCache: () => invoke<CleanupResult>('clear_cache'),
  clearTemp: () => invoke<CleanupResult>('clear_temp'),
  clearLogs: () => invoke<CleanupResult>('clear_logs'),
  backupDatabase: () => invoke<string>('backup_database'),
  safeReset: () => invoke<CleanupResult>('safe_reset'),
  autoCleanup: () => invoke<CleanupResult>('auto_cleanup'),

  // ═══ Banners / Ads ═══
  getBanners: () => invoke<LocalBanner[]>('get_banners'),
  syncBanners: () => invoke<LocalBanner[]>('sync_banners_cmd'),

  // ═══ SuperLab ═══
  superlabBacktestGames: (games: number[][], gameType: string) =>
    invoke<SuperLabBacktestSummary[]>('superlab_backtest_games', { games, gameType }),
  superlabGetCooccurrence: (gameType: string, topN?: number) =>
    invoke<SuperLabCooccurrenceEntry[]>('superlab_get_cooccurrence', { gameType, topN: topN ?? 200 }),
  superlabGenerateFiltered: (params: SuperLabFilterParams) =>
    invoke<number[][]>('superlab_generate_filtered', { params }),
  superlabScorePortfolio: (games: number[][], gameType: string) =>
    invoke<SuperLabPortfolioScore>('superlab_score_portfolio', { games, gameType }),
  superlabAdvancedAnalytics: (gameType: string, lastN?: number) =>
    invoke<SuperLabAdvancedAnalytics>('superlab_advanced_analytics', { gameType, lastN: lastN ?? null }),
  superlabMonteCarlo: (game: number[], gameType: string, iterations?: number) =>
    invoke<SuperLabMonteCarloResult>('superlab_monte_carlo', { game, gameType, iterations: iterations ?? 10000 }),
  superlabGreedyCover: (baseNumbers: number[], gameType: string) =>
    invoke<SuperLabSetCoverResult>('superlab_greedy_cover', { baseNumbers, gameType }),
  superlabGenerateDiverse: (gameType: string, count: number, minDistance?: number) =>
    invoke<number[][]>('superlab_generate_diverse', { gameType, count, minDistance: minDistance ?? null }),
  superlabSaveStrategy: (params: SuperLabSaveStrategyParams) =>
    invoke<number>('superlab_save_strategy', { params }),
  superlabListStrategies: (gameType: string) =>
    invoke<SuperLabStrategy[]>('superlab_list_strategies', { gameType }),
  superlabDeleteStrategy: (id: number) =>
    invoke<void>('superlab_delete_strategy', { id }),
  superlabMultiObjective: (gameType: string, portfolioSize?: number, candidates?: number, wFrequency?: number, wDiversity?: number, wCoverage?: number) =>
    invoke<SuperLabMultiObjectiveResult>('superlab_multi_objective', {
      gameType,
      portfolioSize: portfolioSize ?? null,
      candidates: candidates ?? null,
      wFrequency: wFrequency ?? null,
      wDiversity: wDiversity ?? null,
      wCoverage: wCoverage ?? null,
    }),
  superlabDistributionAnalysis: (gameType: string, lastN?: number) =>
    invoke<SuperLabDistributionAnalysis>('superlab_distribution_analysis', { gameType, lastN: lastN ?? null }),
  superlabTripleCooccurrence: (gameType: string, topN?: number, lastN?: number) =>
    invoke<SuperLabTripleEntry[]>('superlab_triple_cooccurrence', { gameType, topN: topN ?? null, lastN: lastN ?? null }),
  superlabPeriodCompare: (gameType: string, windowA?: number, windowB?: number) =>
    invoke<SuperLabPeriodCompareResult>('superlab_period_compare', { gameType, windowA: windowA ?? null, windowB: windowB ?? null }),
  superlabGeneticOptimize: (gameType: string, portfolioSize?: number, popSize?: number, generations?: number, wFrequency?: number, wDiversity?: number, wCoverage?: number) =>
    invoke<SuperLabGeneticResult>('superlab_genetic_optimize', {
      gameType,
      portfolioSize: portfolioSize ?? null,
      popSize: popSize ?? null,
      generations: generations ?? null,
      wFrequency: wFrequency ?? null,
      wDiversity: wDiversity ?? null,
      wCoverage: wCoverage ?? null,
    }),
  superlabSimulatedAnnealing: (gameType: string, portfolioSize?: number, maxIterations?: number, wFrequency?: number, wDiversity?: number, wCoverage?: number) =>
    invoke<SuperLabSAResult>('superlab_simulated_annealing', {
      gameType,
      portfolioSize: portfolioSize ?? null,
      maxIterations: maxIterations ?? null,
      wFrequency: wFrequency ?? null,
      wDiversity: wDiversity ?? null,
      wCoverage: wCoverage ?? null,
    }),
  superlabReduceRedundancy: (games: number[][], maxSimilarity?: number) =>
    invoke<SuperLabRedundancyResult>('superlab_reduce_redundancy', { games, maxSimilarity: maxSimilarity ?? null }),
  superlabProbabilityEngine: (gameType: string, pickCount?: number) =>
    invoke<SuperLabProbabilityResult>('superlab_probability_engine', { gameType, pickCount: pickCount ?? null }),
  superlabComparePortfolios: (games: number[][], names: string[], gameType: string) =>
    invoke<SuperLabPortfolioCompareResult>('superlab_compare_portfolios', { games, names, gameType }),
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

export interface HistoricalWinResult {
  game_id: number
  game_numbers: number[]
  contest_number: number
  contest_date: string
  contest_numbers: number[]
  hits: number[]
  hit_count: number
  prize_label: string
  prize_value: number | null
}

// ═══ LotoCore Engine Types ═══

export interface AlgorithmWeights {
  frequency: number
  entropy: number
  patterns: number
  genetic: number
}

export interface EnabledAlgorithms {
  monte_carlo: boolean
  frequency: boolean
  delay: boolean
  entropy: boolean
  pattern_avoidance: boolean
  bayesian: boolean
  markov: boolean
  genetic: boolean
  annealing: boolean
}

export interface LotoCoreConfig {
  game_type: string
  pick_count: number
  pool_size: number
  num_games: number
  simulation_depth: number
  mode: string // "single" | "combined" | "weighted"
  weights: AlgorithmWeights
  enabled_algorithms: EnabledAlgorithms
  xray_enabled: boolean
}

export interface AlgorithmScores {
  entropy: number
  frequency: number
  delay: number
  bayesian: number
  markov: number
  pattern: number
  balance: number
}

export interface LotoCoreGame {
  numbers: number[]
  score: number
  algorithm_scores: AlgorithmScores
}

export interface LotoCoreResult {
  games: LotoCoreGame[]
  generation_time_ms: number
  algorithms_used: string[]
  total_candidates_evaluated: number
  xray: XRayPipelineSummary | null
}

export interface XRayStep {
  step_index: number
  total_steps: number
  algorithm_name: string
  algorithm_key: string
  status: string
  duration_ms: number
  candidates_generated: number
  candidates_sample: { numbers: number[], score: number }[]
  score_min: number
  score_max: number
  score_avg: number
  numbers_heatmap: [number, number][]
  message: string
}

export interface XRayPipelineSummary {
  steps: XRayStep[]
  total_duration_ms: number
  total_candidates: number
  final_count: number
}

// ═══ AI Save Games ═══

export interface AiGameToSave {
  numbers: number[]
  game_type: string
  strategy_label: string
}

// ═══ AI Layer Types ═══

export interface AiConfig {
  provider: string // "openai" | "gemini"
  api_key: string
  model: string
}

export interface AiMessage {
  role: string // "user" | "assistant" | "system"
  content: string
}

export interface AiResponse {
  message: string
  config_json: string | null
  sql_query: string | null
}

// ═══ Data Management Types ═══

export interface StorageAudit {
  db_size_bytes: number
  db_path: string
  cache_size_bytes: number
  log_size_bytes: number
  temp_size_bytes: number
  total_size_bytes: number
  contests_count: number
  saved_games_count: number
}

export interface CleanupResult {
  freed_bytes: number
  actions: string[]
}

export interface LocalBanner {
  id: string
  position: string
  local_image_path: string
  image_url: string
  link_url: string
  title: string
  duration_seconds: number
}

/** Convert a local file path to a Tauri asset URL for use in <img> src */
export const assetUrl = (filePath: string) => convertFileSrc(filePath)

// ═══ SuperLab Types ═══
export interface SuperLabBacktestHit {
  contest_number: number
  contest_date: string
  hits: number[]
  hit_count: number
  prize_label: string
}

export interface SuperLabBacktestSummary {
  game: number[]
  total_contests: number
  hits: SuperLabBacktestHit[]
  max_hits: number
  count_4plus: number
  count_5plus: number
  count_6plus: number
}

export interface SuperLabCooccurrenceEntry {
  num_a: number
  num_b: number
  frequency: number
  pct: number
}

export interface SuperLabFilterParams {
  game_type: string
  count: number
  sum_min: number | null
  sum_max: number | null
  even_min: number | null
  even_max: number | null
  repeats_max: number | null
  strategy_id: string | null
}

export interface SuperLabPortfolioScore {
  total_games: number
  distinct_numbers: number
  pool_size: number
  coverage_pct: number
  avg_overlap: number
  diversity_score: number
  quality_label: string
}

export interface SuperLabNumberAnalytics {
  number: number
  frequency: number
  freq_pct: number
  delay: number
  avg_gap: number
  recent_30: number
  recent_100: number
  score: number
}

export interface SuperLabAdvancedAnalytics {
  game_type: string
  total_contests: number
  window: number
  numbers: SuperLabNumberAnalytics[]
  sum_avg: number
  even_avg: number
  entropy: number
  top_hot: number[]
  top_cold: number[]
  top_pairs: SuperLabCooccurrenceEntry[]
  insights: string[]
}

export interface SuperLabMonteCarloResult {
  game: number[]
  iterations: number
  min_prize_hits: number
  hit_counts: number[]
  hit_pcts: number[]
  expected_contests_to_prize: number
}

export interface SuperLabSetCoverResult {
  tickets: number[][]
  covered_pairs: number
  total_pairs: number
  coverage_pct: number
}

export interface SuperLabStrategy {
  id: number
  name: string
  game_type: string
  strategy_type: string
  config_json: string
  games_json: string
  notes: string | null
  score_json: string | null
  created_at: string
}

export interface SuperLabSaveStrategyParams {
  name: string
  game_type: string
  strategy_type: string
  config_json: string
  games: number[][]
  notes: string | null
}

export interface SuperLabOptimizedPortfolio {
  rank: number
  games: number[][]
  frequency_score: number
  diversity_score: number
  coverage_score: number
  composite_score: number
  is_pareto: boolean
}

export interface SuperLabMultiObjectiveResult {
  portfolios: SuperLabOptimizedPortfolio[]
  pareto_count: number
  total_candidates: number
  w_frequency: number
  w_diversity: number
  w_coverage: number
}

export interface SuperLabMolduraMioloStats {
  avg_moldura: number
  avg_miolo: number
}

export interface SuperLabSumHistogramBucket {
  range_label: string
  count: number
  pct: number
}

export interface SuperLabRepeatsBucket {
  repeats: number
  count: number
  pct: number
}

export interface SuperLabDistributionAnalysis {
  game_type: string
  total_contests: number
  window: number
  range_01_10: number
  range_11_20: number
  range_21_30: number
  range_31_40: number
  range_41_50: number
  range_51_60: number
  avg_even: number
  avg_odd: number
  avg_primes: number
  avg_fibonacci: number
  avg_sum: number
  sum_histogram: SuperLabSumHistogramBucket[]
  repeats_distribution: SuperLabRepeatsBucket[]
  avg_repeats_from_last: number
  moldura_miolo: SuperLabMolduraMioloStats | null
}

export interface SuperLabTripleEntry {
  num_a: number
  num_b: number
  num_c: number
  frequency: number
  pct: number
}

export interface SuperLabNumberDelta {
  number: number
  freq_delta: number
  delay_delta: number
  score_delta: number
}

export interface SuperLabPeriodCompareResult {
  window_a: number
  window_b: number
  top_gainers: SuperLabNumberDelta[]
  top_losers: SuperLabNumberDelta[]
  deltas: SuperLabNumberDelta[]
}

export interface SuperLabGeneticResult {
  best_portfolio: number[][]
  score_history: number[]
  final_score: number
  frequency_score: number
  diversity_score: number
  coverage_score: number
  generations_run: number
}

export interface SuperLabSAResult {
  best_portfolio: number[][]
  initial_score: number
  final_score: number
  iterations_run: number
  improvements: number
  frequency_score: number
  diversity_score: number
  coverage_score: number
}

export interface SuperLabRedundancyResult {
  original_count: number
  reduced_count: number
  removed_count: number
  portfolio: number[][]
  avg_similarity_before: number
  avg_similarity_after: number
}

export interface SuperLabPrizeTier {
  name: string
  hits_required: number
  probability: number
  one_in: number
  expected_tickets_to_win: number
}

export interface SuperLabProbabilityResult {
  game_type: string
  pick_count: number
  pool_size: number
  total_combinations: number
  tiers: SuperLabPrizeTier[]
}

export interface SuperLabStrategyCompareEntry {
  name: string
  game: number[]
  total_contests: number
  prize_count: number
  prize_rate_pct: number
  max_hits: number
  count_4plus: number
  count_5plus: number
  count_6plus: number
}

export interface SuperLabPortfolioCompareResult {
  strategies: SuperLabStrategyCompareEntry[]
  best_by_prize_rate_idx: number
  best_by_max_hits_idx: number
}
