use serde::{Deserialize, Serialize};

// ── API Response ──
// The CAIXA lottery API uses different field names across lottery types.
// We use serde aliases to accept all variants.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiContest {
    pub concurso: i64,
    pub data: Option<String>,
    // Location: API returns "local" for most, "localSorteio" for some
    #[serde(alias = "localSorteio", alias = "local")]
    pub local_sorteio: Option<String>,
    pub dezenas: Vec<String>,
    #[serde(alias = "dezenasOrdemSorteio")]
    pub dezenas_ordem_sorteio: Option<Vec<String>>,
    // Prizes: API returns "premiacoes" (not "premiacao")
    #[serde(alias = "premiacao", alias = "premiacoes")]
    pub premiacoes: Option<Vec<ApiPrize>>,
    pub acumulou: Option<bool>,
    #[serde(alias = "proximoConcurso")]
    pub proximo_concurso: Option<i64>,
    #[serde(alias = "dataProximoConcurso")]
    pub data_proximo_concurso: Option<String>,
    #[serde(alias = "valorEstimadoProximoConcurso")]
    pub valor_estimado_proximo_concurso: Option<f64>,
    #[serde(alias = "valorArrecadado")]
    pub valor_arrecadado: Option<f64>,
    // Special fields per lottery type
    #[serde(alias = "mesSorte", alias = "nomesMesDaSorte")]
    pub mes_sorte: Option<String>,
    #[serde(alias = "timeCoracao", alias = "nomeTimeCoracao")]
    pub time_coracao: Option<String>,
    #[serde(alias = "trevosSorteados")]
    pub trevos: Option<Vec<String>>,
    // Winner locations
    #[serde(alias = "localGanhadores")]
    pub local_ganhadores: Option<Vec<serde_json::Value>>,
    // Accumulated values
    #[serde(alias = "valorAcumuladoConcurso_0_5")]
    pub valor_acumulado_05: Option<f64>,
    #[serde(alias = "valorAcumuladoConcursoEspecial")]
    pub valor_acumulado_especial: Option<f64>,
    #[serde(alias = "valorAcumuladoProximoConcurso")]
    pub valor_acumulado_proximo: Option<f64>,
    pub observacao: Option<String>,
    #[serde(alias = "concursoEspecial")]
    pub concurso_especial: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiPrize {
    pub descricao: Option<String>,
    pub faixa: Option<i64>,
    pub ganhadores: Option<i64>,
    #[serde(alias = "valorPremio")]
    pub valor_premio: Option<f64>,
}

// ── Local DB Models ──
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Contest {
    pub id: i64,
    pub contest_number: i64,
    pub contest_date: String,
    pub location: Option<String>,
    pub numbers_draw_order: Vec<i32>,
    pub numbers_sorted: Vec<i32>,
    pub numbers_sorted_text: String,
    pub accumulated: bool,
    pub next_contest_number: Option<i64>,
    pub next_contest_date: Option<String>,
    pub estimated_next_prize: Option<f64>,
    pub amount_collected: Option<f64>,
    pub prizes: Vec<Prize>,
    pub raw_json: Option<String>,
    pub trevos_json: Option<String>,
    pub time_coracao: Option<String>,
    pub mes_sorte: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prize {
    pub description: Option<String>,
    pub range_number: Option<i64>,
    pub winners_count: Option<i64>,
    pub prize_value: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContestDerivedStats {
    pub contest_id: i64,
    pub sum_total: i32,
    pub even_count: i32,
    pub odd_count: i32,
    pub range_01_10: i32,
    pub range_11_20: i32,
    pub range_21_30: i32,
    pub range_31_40: i32,
    pub range_41_50: i32,
    pub range_51_60: i32,
    pub repeated_from_previous_count: i32,
    pub has_sequence: bool,
    pub max_sequence_length: i32,
    pub dispersion_score: f64,
    pub parity_signature: String,
    pub range_signature: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NumberStat {
    pub number_value: i32,
    pub historical_frequency: i32,
    pub recent_frequency_30: i32,
    pub recent_frequency_60: i32,
    pub recent_frequency_100: i32,
    pub current_delay: i32,
    pub average_gap: f64,
    pub gap_std_dev: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedGame {
    pub id: i64,
    pub name: Option<String>,
    pub numbers: Vec<i32>,
    pub numbers_text: String,
    pub strategy_id: String,
    pub strategy_label: String,
    pub notes: Option<String>,
    pub is_favorite: bool,
    pub is_bet: bool,
    pub target_contest_number: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
    pub game_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameAnalysis {
    pub numbers: Vec<i32>,
    pub sum_total: i32,
    pub even_count: i32,
    pub odd_count: i32,
    pub range_01_10: i32,
    pub range_11_20: i32,
    pub range_21_30: i32,
    pub range_31_40: i32,
    pub range_41_50: i32,
    pub range_51_60: i32,
    pub max_sequence_length: i32,
    pub consecutive_count: i32,
    pub avg_distance: f64,
    pub number_details: Vec<NumberDetail>,
    pub repeats_from_last: i32,
    pub exact_match_count: i32,
    pub same_parity_count: i32,
    pub same_range_count: i32,
    pub dispersion_score: f64,
    pub affinity_score: f64,
    pub structural_score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NumberDetail {
    pub number: i32,
    pub historical_frequency: i32,
    pub recent_frequency: i32,
    pub current_delay: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardSummary {
    pub total_contests: i64,
    pub last_contest_number: Option<i64>,
    pub last_contest_date: Option<String>,
    pub last_contest_numbers: Option<Vec<i32>>,
    pub last_sync_at: Option<String>,
    pub saved_games_count: i64,
    pub db_is_empty: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncStatus {
    pub is_syncing: bool,
    pub progress: f64,
    pub message: String,
    pub total: i64,
    pub current: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameSyncInfo {
    pub game_type: String,
    pub remote_latest: i64,
    pub local_latest: i64,
    pub missing_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SpecialFieldStat {
    pub label: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContestSearchParams {
    pub search_number: Option<i64>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    pub page: i64,
    pub per_page: i64,
    pub game_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ContestSearchResult {
    pub contests: Vec<Contest>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GenerateGameParams {
    pub strategy_id: String,
    pub count: Option<i32>,
    pub game_type: Option<String>,
    pub pick_count: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedGame {
    pub numbers: Vec<i32>,
    pub strategy_id: String,
    pub strategy_label: String,
    pub analysis: GameAnalysis,
    pub mes_sorte: Option<String>,
    pub time_coracao: Option<String>,
    pub trevos: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SaveGameParams {
    pub name: Option<String>,
    pub numbers: Vec<i32>,
    pub strategy_id: String,
    pub strategy_label: String,
    pub notes: Option<String>,
    pub target_contest_number: Option<i64>,
    pub game_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreditsData {
    pub author: String,
    pub pix_key: String,
    pub website: String,
    pub academy_website: String,
    pub phone: String,
    pub whatsapp: String,
    pub email: String,
    pub api_credit: String,
    pub app_version: String,
    pub message_headline: String,
    pub message_body: String,
    pub pix_note: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BetCheckResult {
    pub game_id: i64,
    pub game_numbers: Vec<i32>,
    pub contest_number: i64,
    pub contest_numbers: Vec<i32>,
    pub hits: Vec<i32>,
    pub hit_count: i32,
    pub prize_label: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HistoricalWinResult {
    pub game_id: i64,
    pub game_numbers: Vec<i32>,
    pub contest_number: i64,
    pub contest_date: String,
    pub contest_numbers: Vec<i32>,
    pub hits: Vec<i32>,
    pub hit_count: i32,
    pub prize_label: String,
    pub prize_value: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardNumberData {
    pub number: i32,
    pub frequency: i32,
    pub delay: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SumBucket {
    pub label: String,
    pub count: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RangeDist {
    pub label: String,
    pub total: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DynamicDashboardStats {
    pub contest_count: i64,
    pub first_contest: i64,
    pub last_contest: i64,
    pub avg_sum: f64,
    pub even_pct: f64,
    pub odd_pct: f64,
    pub number_data: Vec<DashboardNumberData>,
    pub sum_distribution: Vec<SumBucket>,
    pub range_distribution: Vec<RangeDist>,
}

impl DynamicDashboardStats {
    pub fn empty() -> Self {
        Self {
            contest_count: 0, first_contest: 0, last_contest: 0,
            avg_sum: 0.0, even_pct: 0.0, odd_pct: 0.0,
            number_data: vec![], sum_distribution: vec![], range_distribution: vec![],
        }
    }
}
