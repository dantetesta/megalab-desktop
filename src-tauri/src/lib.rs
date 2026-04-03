mod ai;
mod analytics;
mod api;
mod banners;
mod datamanager;
mod db;
mod generators;
pub mod lotocore;
mod models;
mod registry;
mod services;
mod superlab;

use db::Database;
use models::*;
use rand::Rng;
use std::sync::Arc;
use tauri::{Manager, State};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};

pub struct AppState {
    pub db: Database,
    pub is_syncing: AtomicBool,
    pub sync_current: AtomicI64,
    pub sync_total: AtomicI64,
    pub sync_message: std::sync::Mutex<String>,
}

// ── Dashboard ──
#[tauri::command]
fn get_dashboard_summary(state: State<Arc<AppState>>) -> Result<DashboardSummary, String> {
    let total = state.db.get_total_contests()?;
    let last = state.db.get_last_contest()?;
    let last_sync = state.db.get_last_sync_at()?;
    let saved_count = state.db.get_saved_games_count()?;

    Ok(DashboardSummary {
        total_contests: total,
        last_contest_number: last.as_ref().map(|c| c.contest_number),
        last_contest_date: last.as_ref().map(|c| c.contest_date.clone()),
        last_contest_numbers: last.as_ref().map(|c| c.numbers_sorted.clone()),
        last_sync_at: last_sync,
        saved_games_count: saved_count,
        db_is_empty: total == 0,
    })
}

// ── Sync ──
#[tauri::command]
fn get_sync_status(state: State<Arc<AppState>>) -> Result<SyncStatus, String> {
    let msg = state.sync_message.lock().map_err(|e| e.to_string())?.clone();
    let total = state.sync_total.load(Ordering::Relaxed);
    let current = state.sync_current.load(Ordering::Relaxed);
    let progress = if total > 0 { current as f64 / total as f64 } else { 0.0 };

    Ok(SyncStatus {
        is_syncing: state.is_syncing.load(Ordering::Relaxed),
        progress,
        message: msg,
        total,
        current,
    })
}

#[tauri::command]
async fn start_full_sync(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    // Atomic check-and-set to prevent race condition
    if state.is_syncing.compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed).is_err() {
        return Err("Sincronização já em andamento.".to_string());
    }
    *state.sync_message.lock().map_err(|e| e.to_string())? = "Buscando último concurso...".to_string();

    let latest = api::fetch_latest().await?;
    let latest_number = latest.concurso;

    let last_imported = state.db.get_last_imported_contest()?;
    let start_from = last_imported + 1;

    if start_from > latest_number {
        state.is_syncing.store(false, Ordering::Relaxed);
        *state.sync_message.lock().map_err(|e| e.to_string())? = "Base já está atualizada!".to_string();
        return Ok("Base já está atualizada!".to_string());
    }

    let total = latest_number - start_from + 1;
    state.sync_total.store(total, Ordering::Relaxed);
    state.sync_current.store(0, Ordering::Relaxed);

    let mut imported = 0i64;
    let mut last_success = last_imported;

    for n in start_from..=latest_number {
        *state.sync_message.lock().map_err(|e| e.to_string())? =
            format!("Baixando concurso {} de {}...", n, latest_number);

        match api::fetch_contest(n).await {
            Ok(contest) => {
                state.db.insert_contest(&contest)?;
                last_success = n;
                imported += 1;
            }
            Err(e) => {
                log::warn!("Erro ao baixar concurso {}: {}", n, e);
                // Continue with next
            }
        }

        state.sync_current.store(imported, Ordering::Relaxed);
    }

    // Also insert the latest we already have
    if last_success >= latest_number {
        state.db.insert_contest(&latest).ok();
    }

    state.db.update_sync_state(last_success)?;

    // Recalculate stats
    *state.sync_message.lock().map_err(|e| e.to_string())? = "Calculando estatísticas...".to_string();
    services::stats::recalculate_all_stats(&state.db)?;

    state.is_syncing.store(false, Ordering::Relaxed);
    *state.sync_message.lock().map_err(|e| e.to_string())? = format!("{} concursos importados com sucesso!", imported);

    Ok(format!("{} concursos importados.", imported))
}

#[tauri::command]
async fn start_incremental_sync(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    start_full_sync(state).await
}

// ── Contests ──
#[tauri::command]
fn search_contests(state: State<Arc<AppState>>, params: ContestSearchParams) -> Result<ContestSearchResult, String> {
    state.db.search_contests(&params)
}

#[tauri::command]
fn get_contest_details(state: State<Arc<AppState>>, contest_number: i64, game_type: Option<String>) -> Result<Option<Contest>, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");
    state.db.get_contest_by_number_for_game(contest_number, gt)
}

// ── Generator ──
#[tauri::command]
fn generate_game(state: State<Arc<AppState>>, params: GenerateGameParams) -> Result<GeneratedGame, String> {
    let game_type = params.game_type.as_deref().unwrap_or("megasena");
    let config = registry::get_lottery_config(game_type).unwrap_or_else(|| registry::get_lottery_config("megasena").unwrap());
    let pool = config.numbers_pool_size;
    let pick = params.pick_count.unwrap_or(config.default_pick_count);

    let numbers = generators::generate_game(&state.db, game_type, &params.strategy_id, pool, pick)?;
    let analysis = services::analysis::analyze_game(&state.db, &numbers, game_type)?;
    let label = generators::get_strategy_label(&params.strategy_id).to_string();

    // Generate special fields for specific lottery types
    let mut rng = rand::thread_rng();
    let mes_sorte = if config.has_mes_sorte {
        let idx = rng.gen_range(0..registry::MESES_DA_SORTE.len());
        Some(registry::MESES_DA_SORTE[idx].to_string())
    } else { None };
    let time_coracao = if config.has_time_coracao {
        let idx = rng.gen_range(0..registry::TIMES_TIMEMANIA.len());
        Some(registry::TIMES_TIMEMANIA[idx].to_string())
    } else { None };
    let trevos = if config.has_trevos && config.trevo_pool_size > 0 && config.trevo_pick_count > 0 {
        let mut pool: Vec<i32> = (1..=config.trevo_pool_size).collect();
        let mut picked = vec![];
        for _ in 0..config.trevo_pick_count {
            if pool.is_empty() { break; }
            let idx = rng.gen_range(0..pool.len());
            picked.push(pool.remove(idx));
        }
        picked.sort();
        Some(picked)
    } else { None };

    Ok(GeneratedGame {
        numbers,
        strategy_id: params.strategy_id,
        strategy_label: label,
        analysis,
        mes_sorte,
        time_coracao,
        trevos,
    })
}

#[tauri::command]
fn generate_portfolio(state: State<Arc<AppState>>, count: i32, game_type: Option<String>, pick_count: Option<i32>) -> Result<Vec<GeneratedGame>, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");
    let config = registry::get_lottery_config(gt).unwrap_or_else(|| registry::get_lottery_config("megasena").unwrap());
    let pick = pick_count.unwrap_or(config.default_pick_count);
    let games = generators::generate_portfolio(&state.db, gt, count, config.numbers_pool_size, pick)?;
    let mut rng = rand::thread_rng();
    let mut result = vec![];
    for game in games {
        let analysis = services::analysis::analyze_game(&state.db, &game, gt)?;
        let mes_sorte = if config.has_mes_sorte {
            let idx = rng.gen_range(0..registry::MESES_DA_SORTE.len());
            Some(registry::MESES_DA_SORTE[idx].to_string())
        } else { None };
        let time_coracao = if config.has_time_coracao {
            let idx = rng.gen_range(0..registry::TIMES_TIMEMANIA.len());
            Some(registry::TIMES_TIMEMANIA[idx].to_string())
        } else { None };
        let trevos = if config.has_trevos && config.trevo_pool_size > 0 && config.trevo_pick_count > 0 {
            let mut pool: Vec<i32> = (1..=config.trevo_pool_size).collect();
            let mut picked = vec![];
            for _ in 0..config.trevo_pick_count {
                if pool.is_empty() { break; }
                let idx = rng.gen_range(0..pool.len());
                picked.push(pool.remove(idx));
            }
            picked.sort();
            Some(picked)
        } else { None };
        result.push(GeneratedGame {
            numbers: game,
            strategy_id: "carteira_inteligente".to_string(),
            strategy_label: "Carteira inteligente".to_string(),
            analysis,
            mes_sorte,
            time_coracao,
            trevos,
        });
    }
    Ok(result)
}

#[tauri::command]
fn analyze_game_cmd(state: State<Arc<AppState>>, numbers: Vec<i32>, game_type: Option<String>) -> Result<GameAnalysis, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");
    services::analysis::analyze_game(&state.db, &numbers, gt)
}

// ── Saved Games ──
#[tauri::command]
fn save_game(state: State<Arc<AppState>>, params: SaveGameParams) -> Result<i64, String> {
    analytics::track_save_game(params.game_type.as_deref().unwrap_or("unknown"), &params.strategy_id);
    state.db.save_game(&params)
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct AiGameToSave {
    numbers: Vec<i32>,
    game_type: String,
    strategy_label: String,
}

#[tauri::command]
fn ai_save_games(state: State<Arc<AppState>>, games: Vec<AiGameToSave>) -> Result<String, String> {
    let mut saved = 0;
    for game in &games {
        let params = SaveGameParams {
            name: None,
            numbers: game.numbers.clone(),
            strategy_id: "ai_suggestion".to_string(),
            strategy_label: game.strategy_label.clone(),
            notes: Some("Gerado pelo Assistente IA".to_string()),
            target_contest_number: None,
            game_type: Some(game.game_type.clone()),
        };
        if state.db.save_game(&params).is_ok() { saved += 1; }
    }
    Ok(format!("{} jogos salvos com sucesso!", saved))
}

#[tauri::command]
fn list_saved_games(state: State<Arc<AppState>>, game_type: Option<String>) -> Result<Vec<SavedGame>, String> {
    if let Some(gt) = game_type {
        state.db.list_saved_games_for_game(&gt)
    } else {
        state.db.list_saved_games()
    }
}

#[tauri::command]
fn delete_saved_game(state: State<Arc<AppState>>, id: i64) -> Result<(), String> {
    state.db.delete_saved_game(id)
}

#[tauri::command]
fn toggle_favorite_game(state: State<Arc<AppState>>, id: i64) -> Result<bool, String> {
    state.db.toggle_favorite(id)
}

#[tauri::command]
fn mark_game_as_bet(state: State<Arc<AppState>>, id: i64) -> Result<(), String> {
    state.db.mark_as_bet(id)
}

#[tauri::command]
fn toggle_bet_game(state: State<Arc<AppState>>, id: i64) -> Result<bool, String> {
    state.db.toggle_bet(id)
}

// ── Check bets against latest contest (per game type) ──
#[tauri::command]
fn check_bet_results(state: State<Arc<AppState>>, game_type: Option<String>) -> Result<Vec<BetCheckResult>, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");

    // Get only bets for this game type
    let games = state.db.list_saved_games_for_game(gt)?;
    let bets: Vec<_> = games.into_iter().filter(|g| g.is_bet).collect();
    if bets.is_empty() { return Ok(vec![]); }

    // Get last contest for this specific game type
    let last = state.db.get_last_contest_for_game(gt)?.ok_or(format!("Nenhum concurso de {} na base.", gt))?;
    let drawn = &last.numbers_sorted;

    // Get lottery config for prize labels
    let config = registry::get_lottery_config(gt);
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6);

    let mut results = vec![];
    for bet in &bets {
        let hits: Vec<i32> = bet.numbers.iter().filter(|n| drawn.contains(n)).copied().collect();
        let hit_count = hits.len() as i32;
        let prize = get_prize_label(gt, hit_count, pick_count);
        results.push(BetCheckResult {
            game_id: bet.id,
            game_numbers: bet.numbers.clone(),
            contest_number: last.contest_number,
            contest_numbers: drawn.clone(),
            hits,
            hit_count,
            prize_label: prize,
        });
    }
    results.sort_by(|a, b| b.hit_count.cmp(&a.hit_count));
    Ok(results)
}

// ── Check bets against a specific contest (per game type) ──
#[tauri::command]
fn check_bet_results_for_contest(state: State<Arc<AppState>>, game_type: Option<String>, contest_number: i64) -> Result<Vec<BetCheckResult>, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");

    // Get only bets for this game type
    let games = state.db.list_saved_games_for_game(gt)?;
    let bets: Vec<_> = games.into_iter().filter(|g| g.is_bet).collect();
    if bets.is_empty() { return Ok(vec![]); }

    // Get specific contest for this game type
    let contest = state.db.get_contest_by_number_for_game(contest_number, gt)?
        .ok_or(format!("Concurso #{} não encontrado para {}.", contest_number, gt))?;
    let drawn = &contest.numbers_sorted;

    // Get lottery config for prize labels
    let config = registry::get_lottery_config(gt);
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6);

    let mut results = vec![];
    for bet in &bets {
        let hits: Vec<i32> = bet.numbers.iter().filter(|n| drawn.contains(n)).copied().collect();
        let hit_count = hits.len() as i32;
        let prize = get_prize_label(gt, hit_count, pick_count);
        results.push(BetCheckResult {
            game_id: bet.id,
            game_numbers: bet.numbers.clone(),
            contest_number: contest.contest_number,
            contest_numbers: drawn.clone(),
            hits,
            hit_count,
            prize_label: prize,
        });
    }
    results.sort_by(|a, b| b.hit_count.cmp(&a.hit_count));
    Ok(results)
}

// ── Check historical wins for ALL saved games across ALL contests ──
#[tauri::command]
fn check_historical_wins(state: State<Arc<AppState>>, game_type: String) -> Result<Vec<HistoricalWinResult>, String> {
    let gt = game_type.as_str();

    // Get ALL saved games for this game type (not just bets — allows "what if" analysis)
    let games = state.db.list_saved_games_for_game(gt)?;
    let bets = games;
    if bets.is_empty() { return Ok(vec![]); }

    // Get ALL contests for this game type (id, contest_number, date, numbers)
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, contest_number, contest_date, numbers_sorted_json FROM contests WHERE game_type = ?1 ORDER BY contest_number ASC"
    ).map_err(|e| e.to_string())?;
    let all_contests: Vec<(i64, i64, String, Vec<i32>)> = stmt.query_map(rusqlite::params![gt], |row| {
        let id: i64 = row.get(0)?;
        let cn: i64 = row.get(1)?;
        let date: String = row.get(2)?;
        let json: String = row.get(3)?;
        let nums: Vec<i32> = serde_json::from_str(&json).unwrap_or_default();
        Ok((id, cn, date, nums))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    drop(stmt);

    if all_contests.is_empty() { drop(conn); return Ok(vec![]); }

    // Get lottery config for prize labels
    let config = registry::get_lottery_config(gt);
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6);

    let mut results = vec![];

    for bet in &bets {
        for (contest_id, cn, date, drawn) in &all_contests {
            let hits: Vec<i32> = bet.numbers.iter().filter(|n| drawn.contains(n)).copied().collect();
            let hit_count = hits.len() as i32;
            let prize = get_prize_label(gt, hit_count, pick_count);

            // Only include results that qualify for a prize (contain "!")
            if prize.contains('!') {
                // Try to fetch the prize value from contest_prizes
                let faixa = get_prize_faixa(gt, hit_count, pick_count);
                let prize_value: Option<f64> = if let Some(f) = faixa {
                    conn.query_row(
                        "SELECT prize_value FROM contest_prizes WHERE contest_id = ?1 AND range_number = ?2",
                        rusqlite::params![contest_id, f],
                        |r| r.get(0),
                    ).ok()
                } else {
                    None
                };

                results.push(HistoricalWinResult {
                    game_id: bet.id,
                    game_numbers: bet.numbers.clone(),
                    contest_number: *cn,
                    contest_date: date.clone(),
                    contest_numbers: drawn.clone(),
                    hits,
                    hit_count,
                    prize_label: prize,
                    prize_value,
                });
            }
        }
    }

    drop(conn);

    // Sort by hit_count DESC, then contest_number DESC
    results.sort_by(|a, b| b.hit_count.cmp(&a.hit_count).then(b.contest_number.cmp(&a.contest_number)));
    Ok(results)
}

/// Map (game_type, hit_count) to the contest_prizes range_number (faixa).
fn get_prize_faixa(game_type: &str, hits: i32, pick_count: i32) -> Option<i64> {
    match game_type {
        "megasena" | "duplasena" => match hits {
            6 => Some(1), 5 => Some(2), 4 => Some(3), _ => None,
        },
        "lotofacil" => match hits {
            15 => Some(1), 14 => Some(2), 13 => Some(3), 12 => Some(4), 11 => Some(5), _ => None,
        },
        "quina" => match hits {
            5 => Some(1), 4 => Some(2), 3 => Some(3), 2 => Some(4), _ => None,
        },
        "lotomania" => match hits {
            20 => Some(1), 0 => Some(7),
            _ if hits >= 15 => Some((20 - hits + 1) as i64),
            _ => None,
        },
        "timemania" => match hits {
            7 => Some(1), 6 => Some(2), 5 => Some(3), 4 => Some(4), 3 => Some(5), _ => None,
        },
        "diadesorte" => match hits {
            7 => Some(1), 6 => Some(2), 5 => Some(3), 4 => Some(4), _ => None,
        },
        _ => {
            if hits == pick_count { Some(1) }
            else if hits >= pick_count - 1 { Some(2) }
            else { None }
        }
    }
}

fn get_prize_label(game_type: &str, hits: i32, pick_count: i32) -> String {
    match game_type {
        "megasena" | "duplasena" => match hits {
            6 => "SENA! Prêmio principal!".to_string(),
            5 => "QUINA! Segundo prêmio!".to_string(),
            4 => "QUADRA! Terceiro prêmio!".to_string(),
            _ => format!("{} acertos", hits),
        },
        "lotofacil" => match hits {
            15 => "15 ACERTOS! Prêmio principal!".to_string(),
            14 => "14 acertos! Segundo prêmio!".to_string(),
            13 => "13 acertos! Terceiro prêmio!".to_string(),
            12 => "12 acertos! Quarto prêmio!".to_string(),
            11 => "11 acertos! Quinto prêmio!".to_string(),
            _ => format!("{} acertos", hits),
        },
        "quina" => match hits {
            5 => "QUINA! Prêmio principal!".to_string(),
            4 => "QUADRA! Segundo prêmio!".to_string(),
            3 => "TERNO! Terceiro prêmio!".to_string(),
            2 => "DUQUE! Quarto prêmio!".to_string(),
            _ => format!("{} acertos", hits),
        },
        "lotomania" => match hits {
            20 => "20 ACERTOS! Prêmio principal!".to_string(),
            0 => "0 ACERTOS! Prêmio especial!".to_string(),
            _ if hits >= 15 => format!("{} acertos! Premiado!", hits),
            _ => format!("{} acertos", hits),
        },
        "timemania" => match hits {
            7 => "7 ACERTOS! Prêmio principal!".to_string(),
            6 => "6 acertos! Segundo prêmio!".to_string(),
            5 => "5 acertos! Terceiro prêmio!".to_string(),
            4 => "4 acertos! Quarto prêmio!".to_string(),
            3 => "3 acertos! Quinto prêmio!".to_string(),
            _ => format!("{} acertos", hits),
        },
        "diadesorte" => match hits {
            7 => "7 ACERTOS! Prêmio principal!".to_string(),
            6 => "6 acertos! Segundo prêmio!".to_string(),
            5 => "5 acertos! Terceiro prêmio!".to_string(),
            4 => "4 acertos! Quarto prêmio!".to_string(),
            _ => format!("{} acertos", hits),
        },
        _ => {
            if hits == pick_count {
                format!("{} ACERTOS! Prêmio principal!", hits)
            } else if hits >= pick_count - 1 {
                format!("{} acertos! Premiado!", hits)
            } else {
                format!("{} acertos", hits)
            }
        }
    }
}

// ── Clipboard formatting ──
#[tauri::command]
fn format_game_for_clipboard(numbers: Vec<i32>) -> Result<String, String> {
    let text = numbers.iter().map(|n| format!("{:02}", n)).collect::<Vec<_>>().join(", ");
    Ok(text)
}

#[tauri::command]
fn format_all_games_for_clipboard(games: Vec<Vec<i32>>) -> Result<String, String> {
    let mut lines = vec!["MEUS JOGOS".to_string(), String::new()];
    for (i, game) in games.iter().enumerate() {
        let text = game.iter().map(|n| format!("{:02}", n)).collect::<Vec<_>>().join(", ");
        lines.push(format!("Jogo {}: {}", i + 1, text));
    }
    lines.push(String::new());
    lines.push("Gerado pelo app LotoLogic".to_string());
    Ok(lines.join("\n"))
}

// ── Number Stats ──
#[tauri::command]
fn get_number_stats(state: State<Arc<AppState>>) -> Result<Vec<NumberStat>, String> {
    state.db.get_all_number_stats()
}

#[tauri::command]
fn get_dynamic_dashboard_stats(state: State<Arc<AppState>>, last_n: Option<i64>, game_type: Option<String>) -> Result<DynamicDashboardStats, String> {
    let gt = game_type.as_deref().unwrap_or("megasena");
    let all_contests = state.db.get_all_sorted_numbers_for_game(gt)?;
    let total_all = all_contests.len();
    if total_all == 0 {
        return Ok(DynamicDashboardStats::empty());
    }

    let contests: Vec<&(i64, Vec<i32>)> = if let Some(n) = last_n {
        let skip = if total_all as i64 > n { total_all - n as usize } else { 0 };
        all_contests.iter().skip(skip).collect()
    } else {
        all_contests.iter().collect()
    };

    let count = contests.len() as i64;
    let first_contest = contests.first().map(|(cn, _)| *cn).unwrap_or(0);
    let last_contest = contests.last().map(|(cn, _)| *cn).unwrap_or(0);

    // Per-number stats
    let config = registry::get_lottery_config(gt);
    let pool_size = config.as_ref().map(|c| c.numbers_pool_size).unwrap_or(60) as usize;
    let num_start = if pool_size == 100 { 0usize } else { 1usize };
    let num_end = num_start + pool_size;
    let vec_size = num_end + 1;

    let mut freq = vec![0i32; vec_size];
    let mut last_seen = vec![0usize; vec_size];
    let mut sums: Vec<i32> = vec![];
    let mut even_total = 0i64;
    let mut odd_total = 0i64;

    for (i, (_cn, nums)) in contests.iter().enumerate() {
        let s: i32 = nums.iter().sum();
        sums.push(s);
        for &n in nums.iter() {
            let idx = n as usize;
            if idx < vec_size {
                freq[idx] += 1;
                last_seen[idx] = i;
                if n % 2 == 0 { even_total += 1; } else { odd_total += 1; }
            }
        }
    }

    let total_drawn = (even_total + odd_total) as f64;
    let even_pct = if total_drawn > 0.0 { (even_total as f64 / total_drawn) * 100.0 } else { 0.0 };
    let odd_pct = 100.0 - even_pct;
    let avg_sum = if !sums.is_empty() { sums.iter().sum::<i32>() as f64 / sums.len() as f64 } else { 0.0 };

    let contest_count = contests.len();
    let number_data: Vec<DashboardNumberData> = (num_start..num_end).map(|n| {
        if n >= vec_size { return DashboardNumberData { number: n as i32, frequency: 0, delay: 0 }; }
        let delay = if freq[n] > 0 {
            contest_count.saturating_sub(1).saturating_sub(last_seen[n]) as i32
        } else {
            contest_count as i32
        };
        DashboardNumberData {
            number: n as i32,
            frequency: freq[n],
            delay,
        }
    }).collect();

    // Sum distribution (dynamic buckets based on actual data)
    let sum_buckets: Vec<SumBucket> = if sums.is_empty() { vec![] } else {
        let min_s = *sums.iter().min().unwrap_or(&0);
        let max_s = *sums.iter().max().unwrap_or(&0);
        let bucket_size = ((max_s - min_s) as f64 / 7.0).ceil().max(1.0) as i32;
        let mut buckets = vec![];
        let mut lo = (min_s / bucket_size) * bucket_size;
        while lo <= max_s {
            let hi = lo + bucket_size - 1;
            buckets.push(SumBucket {
                label: format!("{}-{}", lo, hi),
                count: sums.iter().filter(|&&s| s >= lo && s <= hi).count() as i32,
            });
            lo += bucket_size;
            if buckets.len() >= 10 { break; }
        }
        buckets
    };

    // Range distribution (dynamic based on pool)
    let range_bucket_size = (pool_size as f64 / 6.0).ceil() as i32;
    let range_start = if pool_size == 100 { 0 } else { 1 };
    let range_dist: Vec<RangeDist> = {
        let mut rd = vec![];
        let mut lo = range_start;
        for _ in 0..6 {
            let hi = (lo + range_bucket_size - 1).min(range_start + pool_size as i32 - 1);
            if lo > range_start + pool_size as i32 - 1 { break; }
            let total: i32 = (lo..=hi).filter(|&n| (n as usize) < vec_size).map(|n| freq[n as usize]).sum();
            rd.push(RangeDist { label: format!("{:02}-{:02}", lo, hi), total });
            lo = hi + 1;
        }
        rd
    };

    Ok(DynamicDashboardStats {
        contest_count: count,
        first_contest,
        last_contest,
        avg_sum,
        even_pct,
        odd_pct,
        number_data,
        sum_distribution: sum_buckets,
        range_distribution: range_dist,
    })
}

// ── Special field stats (Time do Coração, Mês da Sorte) ──
#[tauri::command]
fn get_special_field_stats(state: State<Arc<AppState>>, game_type: String, last_n: Option<i64>) -> Result<Vec<models::SpecialFieldStat>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;

    // Use dedicated columns first (fast), fallback to raw_json parsing
    let column = if game_type == "timemania" { "time_coracao" } else if game_type == "diadesorte" { "mes_sorte" } else { return Ok(vec![]) };

    // Try dedicated column first
    let query = if let Some(n) = last_n {
        format!("SELECT {col}, raw_json FROM contests WHERE game_type = ?1 ORDER BY contest_number DESC LIMIT {n}", col=column, n=n)
    } else {
        format!("SELECT {col}, raw_json FROM contests WHERE game_type = ?1 ORDER BY contest_number ASC", col=column)
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows: Vec<(Option<String>, String)> = stmt.query_map(rusqlite::params![game_type], |row| {
        Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let mut counts: std::collections::HashMap<String, i32> = std::collections::HashMap::new();

    for (dedicated, raw) in &rows {
        // Use dedicated column if available
        if let Some(val) = dedicated {
            if !val.is_empty() {
                *counts.entry(val.clone()).or_insert(0) += 1;
                continue;
            }
        }
        // Fallback to raw_json parsing
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(raw) {
            let field_names = if game_type == "timemania" {
                vec!["timeCoracao", "nomeTimeCoracao"]
            } else {
                vec!["mesSorte", "nomesMesDaSorte"]
            };
            for field in &field_names {
                if let Some(v) = json.get(field).and_then(|v| v.as_str()) {
                    if !v.is_empty() {
                        *counts.entry(v.to_string()).or_insert(0) += 1;
                        break;
                    }
                }
            }
        }
    }

    let mut result: Vec<models::SpecialFieldStat> = counts.into_iter()
        .map(|(label, count)| models::SpecialFieldStat { label, count })
        .collect();
    result.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(result)
}

// ── Trevo stats (+Milionária) ──
#[tauri::command]
fn get_trevo_stats(state: State<Arc<AppState>>, last_n: Option<i64>) -> Result<Vec<models::SpecialFieldStat>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;

    let query = if let Some(n) = last_n {
        format!("SELECT trevos_json, raw_json FROM contests WHERE game_type = 'maismilionaria' ORDER BY contest_number DESC LIMIT {}", n)
    } else {
        "SELECT trevos_json, raw_json FROM contests WHERE game_type = 'maismilionaria' ORDER BY contest_number ASC".to_string()
    };

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows: Vec<(Option<String>, String)> = stmt.query_map([], |row| {
        Ok((row.get::<_, Option<String>>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();

    let mut counts: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();

    for (trevos_col, raw) in &rows {
        let mut trevos: Vec<i32> = vec![];
        // Try dedicated trevos_json column first
        if let Some(tj) = trevos_col {
            if let Ok(parsed) = serde_json::from_str::<Vec<serde_json::Value>>(tj) {
                trevos = parsed.iter().filter_map(|v| {
                    v.as_i64().map(|n| n as i32)
                        .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
                }).collect();
            }
        }
        // Fallback to raw_json
        if trevos.is_empty() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(raw) {
                if let Some(arr) = json.get("trevosSorteados").or_else(|| json.get("trevos")).and_then(|v| v.as_array()) {
                    trevos = arr.iter().filter_map(|v| {
                        v.as_i64().map(|n| n as i32)
                            .or_else(|| v.as_str().and_then(|s| s.parse::<i32>().ok()))
                    }).collect();
                }
            }
        }
        for t in trevos {
            *counts.entry(t).or_insert(0) += 1;
        }
    }

    let mut result: Vec<models::SpecialFieldStat> = counts.into_iter()
        .map(|(num, count)| models::SpecialFieldStat {
            label: format!("Trevo {:02}", num),
            count,
        })
        .collect();
    result.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(result)
}

// ── Export/Import ──
#[tauri::command]
fn export_contests_csv(state: State<Arc<AppState>>) -> Result<String, String> {
    let all = state.db.get_all_sorted_numbers()?;
    let mut csv = String::from("concurso,dezena1,dezena2,dezena3,dezena4,dezena5,dezena6\n");
    for (cn, nums) in &all {
        let nums_str: Vec<String> = nums.iter().map(|n| format!("{:02}", n)).collect();
        csv.push_str(&format!("{},{}\n", cn, nums_str.join(",")));
    }
    Ok(csv)
}

#[tauri::command]
fn export_saved_games_csv(state: State<Arc<AppState>>) -> Result<String, String> {
    let games = state.db.list_saved_games()?;
    let mut csv = String::from("id,nome,dezena1,dezena2,dezena3,dezena4,dezena5,dezena6,estrategia,favorito,apostado,criado_em\n");
    for g in &games {
        let nums_str: Vec<String> = g.numbers.iter().map(|n| format!("{:02}", n)).collect();
        csv.push_str(&format!("{},{},{},{},{},{},{}\n",
            g.id,
            g.name.as_deref().unwrap_or(""),
            nums_str.join(","),
            g.strategy_label,
            if g.is_favorite { "sim" } else { "nao" },
            if g.is_bet { "sim" } else { "nao" },
            g.created_at
        ));
    }
    Ok(csv)
}

#[tauri::command]
fn export_full_database_sql(state: State<Arc<AppState>>) -> Result<String, String> {
    analytics::track_export("sql_backup");
    state.db.export_as_sql()
}

#[tauri::command]
fn import_database_sql(state: State<Arc<AppState>>, sql: String) -> Result<String, String> {
    analytics::track_import("sql_backup");
    state.db.import_from_sql(&sql)?;
    services::stats::recalculate_all_stats(&state.db)?;
    let total = state.db.get_total_contests()?;
    Ok(format!("Importado com sucesso! {} concursos na base.", total))
}

#[tauri::command]
fn get_table_counts(state: State<Arc<AppState>>) -> Result<Vec<(String, i64)>, String> {
    state.db.get_table_counts()
}

#[tauri::command]
async fn download_and_import_sql(state: State<'_, Arc<AppState>>, url: String, game_type: String) -> Result<String, String> {
    // Download SQL from URL using reqwest (bypasses CORS)
    let resp = reqwest::get(&url).await
        .map_err(|e| format!("Erro de rede: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Erro HTTP {}: {}", resp.status(), url));
    }

    let sql = resp.text().await
        .map_err(|e| format!("Erro ao ler resposta: {}", e))?;

    if sql.trim().is_empty() {
        return Err("Arquivo SQL vazio.".to_string());
    }

    // Import the SQL
    state.db.import_from_sql(&sql)?;

    // Recalculate stats for this game type
    services::stats::recalculate_stats_for_game(&state.db, &game_type).ok();

    // Count contests for this game type
    let count = state.db.get_total_contests_for_game(&game_type)?;
    Ok(format!("{} concursos importados para {}.", count, game_type))
}

#[tauri::command]
async fn check_for_new_contests(state: State<'_, Arc<AppState>>) -> Result<String, String> {
    let latest = api::fetch_latest().await?;
    let local_last = state.db.get_last_imported_contest()?;
    let remote_last = latest.concurso;
    if local_last >= remote_last {
        Ok(format!("Base atualizada! Você tem todos os {} concursos.", local_last))
    } else {
        let missing = remote_last - local_last;
        Ok(format!("Faltam {} concursos. Último na API: {}, último local: {}.", missing, remote_last, local_last))
    }
}

#[tauri::command]
async fn check_game_status(state: State<'_, Arc<AppState>>, game_type: String) -> Result<GameSyncInfo, String> {
    let config = registry::get_lottery_config(&game_type)
        .ok_or_else(|| format!("Loteria desconhecida: {}", game_type))?;

    let base_url = format!("https://loteriascaixa-api.herokuapp.com/api/{}", config.api_path);

    // Fetch latest contest from the game's specific API endpoint
    let latest_resp = reqwest::get(format!("{}/latest", base_url)).await
        .map_err(|e| format!("Erro de rede: {}", e))?;
    let latest: models::ApiContest = latest_resp.json().await
        .map_err(|e| format!("Erro ao ler resposta: {}", e))?;
    let remote_latest = latest.concurso;

    // Get local latest for this specific game type
    let local_latest = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let n: i64 = conn.query_row(
            "SELECT COALESCE(MAX(contest_number), 0) FROM contests WHERE game_type = ?1",
            rusqlite::params![game_type], |row| row.get(0)
        ).unwrap_or(0);
        n
    };

    let missing_count = (remote_latest - local_latest).max(0);

    Ok(GameSyncInfo {
        game_type,
        remote_latest,
        local_latest,
        missing_count,
    })
}

#[tauri::command]
fn generate_games_pdf_html(state: State<Arc<AppState>>) -> Result<String, String> {
    let games = state.db.list_saved_games()?;
    let mut html = String::from(r#"<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #111; padding: 40px; }
  h1 { font-size: 24px; margin-bottom: 8px; }
  .subtitle { color: #666; font-size: 13px; margin-bottom: 32px; }
  .game { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid #e5e5e5; }
  .game-num { font-weight: 700; color: #888; font-size: 13px; width: 50px; }
  .balls { display: flex; gap: 8px; }
  .ball { width: 40px; height: 40px; border-radius: 50%; background: #16a34a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; font-family: monospace; }
  .meta { color: #888; font-size: 12px; margin-left: 16px; }
  .footer { margin-top: 40px; color: #aaa; font-size: 11px; text-align: center; }
  @media print { body { padding: 20px; } }
</style></head><body>
<h1>MEUS JOGOS</h1>
<div class="subtitle">Gerado pelo LotoLogic</div>
"#);
    for (i, g) in games.iter().enumerate() {
        html.push_str(&format!(r#"<div class="game"><div class="game-num">Jogo {}</div><div class="balls">"#, i + 1));
        for n in &g.numbers {
            html.push_str(&format!(r#"<div class="ball">{:02}</div>"#, n));
        }
        html.push_str(&format!(r#"</div><div class="meta">{} · {}</div></div>"#, g.strategy_label, g.created_at.split('T').next().unwrap_or(&g.created_at)));
    }
    html.push_str(r#"<div class="footer">LotoLogic — dantetesta.com.br</div></body></html>"#);
    Ok(html)
}

// ── Onboarding & Settings ──
#[tauri::command]
fn get_all_lotteries() -> Result<Vec<registry::LotteryConfig>, String> {
    Ok(registry::get_all_lotteries())
}

#[tauri::command]
fn get_games_catalog(state: State<Arc<AppState>>) -> Result<Vec<registry::LotteryConfig>, String> {
    state.db.get_all_games_catalog()
}

#[tauri::command]
fn is_onboarding_done(state: State<Arc<AppState>>) -> Result<bool, String> {
    state.db.is_onboarding_done()
}

#[tauri::command]
fn get_enabled_games(state: State<Arc<AppState>>) -> Result<Vec<String>, String> {
    state.db.get_enabled_games()
}

#[tauri::command]
fn get_primary_game(state: State<Arc<AppState>>) -> Result<Option<String>, String> {
    state.db.get_primary_game()
}

#[tauri::command]
fn complete_onboarding(state: State<Arc<AppState>>, game_types: Vec<String>, primary: String) -> Result<(), String> {
    state.db.enable_games(&game_types, &primary)
}

#[tauri::command]
fn get_bet_price(state: State<Arc<AppState>>, game_type: String, pick_count: i32) -> Result<Option<f64>, String> {
    state.db.get_bet_price(&game_type, pick_count)
}

#[tauri::command]
fn update_bet_price(state: State<Arc<AppState>>, game_type: String, pick_count: i32, price: f64) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT OR REPLACE INTO bet_price_rules (game_type, pick_count, price_value, is_default) VALUES (?1, ?2, ?3, 0)",
        rusqlite::params![game_type, pick_count, price]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_contests_count_per_game(state: State<Arc<AppState>>) -> Result<Vec<(String, i64)>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT game_type, COUNT(*) FROM contests GROUP BY game_type ORDER BY game_type").map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, i64>(1)?))).map_err(|e| e.to_string())?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

#[tauri::command]
fn run_manual_seed_import(state: State<Arc<AppState>>, app: tauri::AppHandle) -> Result<String, String> {
    if let Ok(resource_path) = app.path().resolve("resources/seed-data.sql.gz", tauri::path::BaseDirectory::Resource) {
        if resource_path.exists() {
            use std::io::Read;
            let file = std::fs::File::open(&resource_path).map_err(|e| e.to_string())?;
            let mut decoder = flate2::read::GzDecoder::new(file);
            let mut sql = String::new();
            decoder.read_to_string(&mut sql).map_err(|e| e.to_string())?;
            let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
            conn.execute_batch(&sql).map_err(|e| e.to_string())?;
            drop(conn);
            let total = state.db.get_total_contests()?;
            return Ok(format!("Importação concluída! {} concursos na base.", total));
        }
    }
    Err("Arquivo seed não encontrado.".to_string())
}

#[tauri::command]
fn get_lottery_config(game_type: String) -> Result<Option<registry::LotteryConfig>, String> {
    Ok(registry::get_lottery_config(&game_type))
}

#[tauri::command]
fn factory_reset(state: State<Arc<AppState>>) -> Result<String, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("
        DELETE FROM contest_prizes;
        DELETE FROM contest_derived_stats;
        DELETE FROM number_stats;
        DELETE FROM saved_game_analysis;
        DELETE FROM saved_games;
        DELETE FROM contests;
        DELETE FROM sync_logs;
        DELETE FROM sync_state;
        UPDATE games_catalog SET is_enabled = 0, is_primary = 0;
    ").map_err(|e| e.to_string())?;
    Ok("Sistema resetado para configuração de fábrica!".to_string())
}

// ── Multi-game sync ──
#[tauri::command]
async fn sync_game(state: State<'_, Arc<AppState>>, game_type: String) -> Result<String, String> {
    analytics::track_sync(&game_type);
    // Allow parallel syncs for different game types (no global lock)
    let config = registry::get_lottery_config(&game_type)
        .ok_or_else(|| format!("Loteria desconhecida: {}", game_type))?;

    // Ensure sync_state row exists for this game
    {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT OR IGNORE INTO sync_state (game_type, last_imported_contest, sync_status) VALUES (?1, 0, 'idle')",
            rusqlite::params![game_type]
        ).ok();
    }

    *state.sync_message.lock().map_err(|e| e.to_string())? = format!("Buscando {} mais recente...", config.display_name);

    let base_url = format!("https://loteriascaixa-api.herokuapp.com/api/{}", config.api_path);

    // Get latest
    let latest_resp = reqwest::get(format!("{}/latest", base_url)).await
        .map_err(|e| { state.is_syncing.store(false, Ordering::Relaxed); format!("Erro de rede: {}", e) })?;
    let latest: models::ApiContest = latest_resp.json().await
        .map_err(|e| { state.is_syncing.store(false, Ordering::Relaxed); format!("Erro ao ler resposta: {}", e) })?;
    let latest_number = latest.concurso;

    let last_imported = {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        let n: i64 = conn.query_row(
            "SELECT COALESCE(last_imported_contest, 0) FROM sync_state WHERE game_type = ?1",
            rusqlite::params![game_type], |row| row.get(0)
        ).unwrap_or(0);
        n
    };

    let start_from = last_imported + 1;
    if start_from > latest_number {
        state.is_syncing.store(false, Ordering::Relaxed);
        *state.sync_message.lock().map_err(|e| e.to_string())? = format!("{} já atualizada!", config.display_name);
        return Ok(format!("{} já está atualizada.", config.display_name));
    }

    let total = latest_number - start_from + 1;
    state.sync_total.store(total, Ordering::Relaxed);
    state.sync_current.store(0, Ordering::Relaxed);

    let mut imported = 0i64;
    let mut last_success = last_imported;

    for n in start_from..=latest_number {
        *state.sync_message.lock().map_err(|e| e.to_string())? =
            format!("{}: concurso {} de {}...", config.display_name, n, latest_number);

        let url = format!("{}/{}", base_url, n);
        match reqwest::get(&url).await {
            Ok(resp) => {
                if let Ok(contest) = resp.json::<models::ApiContest>().await {
                    // Insert with the correct game_type
                    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
                    let mut numbers_sorted: Vec<i32> = contest.dezenas.iter()
                        .filter_map(|d| d.parse::<i32>().ok()).collect();
                    numbers_sorted.sort();
                    let numbers_draw_order: Vec<i32> = contest.dezenas_ordem_sorteio.as_ref()
                        .unwrap_or(&contest.dezenas).iter()
                        .filter_map(|d| d.parse::<i32>().ok()).collect();
                    let numbers_text = numbers_sorted.iter().map(|n| format!("{:02}", n)).collect::<Vec<_>>().join(", ");
                    let raw_json_str = serde_json::to_string(&contest).unwrap_or_default();

                    // Extract special fields directly from deserialized model
                    let trevos_json: Option<String> = contest.trevos.as_ref()
                        .filter(|t| !t.is_empty())
                        .and_then(|t| serde_json::to_string(t).ok());
                    let time_coracao: Option<String> = contest.time_coracao.clone()
                        .filter(|s| !s.is_empty());
                    let mes_sorte: Option<String> = contest.mes_sorte.clone()
                        .filter(|s| !s.is_empty());

                    conn.execute(
                        "INSERT OR IGNORE INTO contests (game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                        rusqlite::params![
                            game_type,
                            contest.concurso,
                            contest.data.as_deref().unwrap_or(""),
                            contest.local_sorteio,
                            serde_json::to_string(&numbers_draw_order).unwrap_or_default(),
                            serde_json::to_string(&numbers_sorted).unwrap_or_default(),
                            numbers_text,
                            contest.acumulou.unwrap_or(false) as i32,
                            contest.proximo_concurso,
                            contest.data_proximo_concurso,
                            contest.valor_estimado_proximo_concurso,
                            contest.valor_arrecadado,
                            raw_json_str,
                            trevos_json,
                            time_coracao,
                            mes_sorte,
                        ]
                    ).ok();

                    // Insert prizes if available
                    if let Some(premiacoes) = &contest.premiacoes {
                        // Get the contest ID we just inserted
                        let contest_id: Option<i64> = conn.query_row(
                            "SELECT id FROM contests WHERE game_type = ?1 AND contest_number = ?2",
                            rusqlite::params![game_type, contest.concurso],
                            |row| row.get(0)
                        ).ok();
                        if let Some(cid) = contest_id {
                            for prize in premiacoes {
                                conn.execute(
                                    "INSERT OR IGNORE INTO contest_prizes (contest_id, description, range_number, winners_count, prize_value) VALUES (?1, ?2, ?3, ?4, ?5)",
                                    rusqlite::params![
                                        cid,
                                        prize.descricao,
                                        prize.faixa,
                                        prize.ganhadores,
                                        prize.valor_premio,
                                    ]
                                ).ok();
                            }
                        }
                    }

                    drop(conn);
                    last_success = n;
                    imported += 1;
                }
            }
            Err(e) => { log::warn!("Erro concurso {} {}: {}", game_type, n, e); }
        }
        state.sync_current.store(imported, Ordering::Relaxed);
    }

    // Update sync state
    {
        let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_state SET last_imported_contest = ?1, last_synced_at = datetime('now'), sync_status = 'idle' WHERE game_type = ?2",
            rusqlite::params![last_success, game_type]
        ).ok();
    }

    // Recalculate stats for this specific game type
    if imported > 0 {
        *state.sync_message.lock().map_err(|e| e.to_string())? = format!("{}: Calculando estatísticas...", config.display_name);
        services::stats::recalculate_stats_for_game(&state.db, &game_type).ok();
    }

    *state.sync_message.lock().map_err(|e| e.to_string())? = format!("{}: {} concursos importados!", config.display_name, imported);

    Ok(format!("{}: {} concursos importados.", config.display_name, imported))
}

// ── Credits ──
#[tauri::command]
fn get_credits_data() -> Result<CreditsData, String> {
    Ok(CreditsData {
        author: "Dante Testa".to_string(),
        pix_key: "Dante.testa@gmail.com".to_string(),
        website: "https://lotologic.com.br".to_string(),
        github_url: "https://github.com/dantetesta/LotoLogic".to_string(),
        academy_website: "https://academy.dantetesta.com.br".to_string(),
        phone: String::new(),
        whatsapp: String::new(),
        email: String::new(),
        api_credit: "Dados consultados via loterias-api de guto-alves".to_string(),
        app_version: "4.0.0".to_string(),
        message_headline: "Créditos".to_string(),
        message_body: "O LotoLogic foi idealizado e desenvolvido por Dante Testa. Se este aplicativo te ajudou a organizar melhor seus jogos, analisar resultados ou até mudar sua sorte, lembre com carinho de quem construiu essa ferramenta para você.".to_string(),
        pix_note: "Quer agradecer de forma espontânea? Meu Pix está logo abaixo.".to_string(),
    })
}

// ═══ LotoCore Engine ═══
#[tauri::command]
fn generate_lotocore(state: State<Arc<AppState>>, config: lotocore::LotoCoreConfig) -> Result<lotocore::LotoCoreResult, String> {
    analytics::track_generate(&config.game_type, config.num_games, &config.mode);
    if config.xray_enabled {
        lotocore::generate_lotocore_xray(&state.db, &config)
    } else {
        lotocore::generate_lotocore(&state.db, &config)
    }
}

// ═══ AI Assistant ═══
#[tauri::command]
async fn ai_chat(state: State<'_, Arc<AppState>>, config: ai::AiConfig, messages: Vec<ai::AiMessage>, game_type: Option<String>) -> Result<ai::AiResponse, String> {
    analytics::track_ai_chat(&config.provider);
    // Build database context for the active lottery
    let gt = game_type.as_deref().unwrap_or("megasena");
    let db_context = ai::build_db_context(&state.db, gt);

    // Inject database context as a system-level data message before the conversation
    let mut enriched_messages = Vec::with_capacity(messages.len() + 1);
    enriched_messages.push(ai::AiMessage {
        role: "user".to_string(),
        content: format!("{}\n\n(Contexto automatico — use esses dados para responder com precisao. Nao mencione que recebeu dados automaticamente.)", db_context),
    });
    enriched_messages.push(ai::AiMessage {
        role: "assistant".to_string(),
        content: "Entendido! Tenho os dados da base carregados. Como posso te ajudar?".to_string(),
    });
    enriched_messages.extend(messages);

    ai::chat(&config, enriched_messages, "").await
}

#[tauri::command]
fn ai_query_db(state: State<Arc<AppState>>, sql: String) -> Result<String, String> {
    ai::execute_safe_query(&state.db, &sql)
}

#[tauri::command]
fn track_page(page: String) {
    analytics::track_event("page_view", serde_json::json!({
        "page_title": page,
        "app_version": env!("CARGO_PKG_VERSION"),
    }));
}

#[tauri::command]
fn track_first_install_cmd() {
    analytics::track_first_install();
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
fn import_lunar_calendar(state: State<Arc<AppState>>, json_data: String) -> Result<String, String> {
    #[derive(serde::Deserialize)]
    struct LunarEntry {
        data: String,
        idade_lua: f64,
        iluminacao: f64,
        fase: String,
    }

    let entries: Vec<LunarEntry> = serde_json::from_str(&json_data)
        .map_err(|e| format!("Erro ao parsear JSON lunar: {}", e))?;

    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM lunar_calendar", []).ok();

    let mut count = 0i64;
    for entry in &entries {
        conn.execute(
            "INSERT OR IGNORE INTO lunar_calendar (data, idade_lua, iluminacao, fase) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![entry.data, entry.idade_lua, entry.iluminacao, entry.fase]
        ).ok();
        count += 1;
    }

    Ok(format!("{} dias lunares importados com sucesso!", count))
}

#[tauri::command]
fn get_lunar_calendar_count(state: State<Arc<AppState>>) -> Result<i64, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row("SELECT COUNT(*) FROM lunar_calendar", [], |r| r.get(0))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_ai_config(state: State<Arc<AppState>>) -> Result<Option<ai::AiConfig>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let result = conn.query_row(
        "SELECT provider, api_key, model FROM ai_config LIMIT 1",
        [],
        |row| Ok(ai::AiConfig {
            provider: row.get(0)?,
            api_key: row.get(1)?,
            model: row.get(2)?,
        })
    );
    match result {
        Ok(cfg) => Ok(Some(cfg)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn save_ai_config(state: State<Arc<AppState>>, config: ai::AiConfig) -> Result<(), String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS ai_config (id INTEGER PRIMARY KEY, provider TEXT NOT NULL, api_key TEXT NOT NULL, model TEXT NOT NULL);").map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM ai_config", []).ok();
    conn.execute(
        "INSERT INTO ai_config (provider, api_key, model) VALUES (?1, ?2, ?3)",
        rusqlite::params![config.provider, config.api_key, config.model]
    ).map_err(|e| e.to_string())?;
    Ok(())
}

// ═══ Data Management ═══
#[tauri::command]
fn audit_storage(state: State<Arc<AppState>>, app: tauri::AppHandle) -> Result<datamanager::StorageAudit, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::audit_storage(&app_dir, &state.db)
}

#[tauri::command]
fn clear_cache(app: tauri::AppHandle) -> Result<datamanager::CleanupResult, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::clear_cache(&app_dir)
}

#[tauri::command]
fn clear_temp(app: tauri::AppHandle) -> Result<datamanager::CleanupResult, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::clear_temp(&app_dir)
}

#[tauri::command]
fn clear_logs(app: tauri::AppHandle) -> Result<datamanager::CleanupResult, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::clear_logs(&app_dir)
}

#[tauri::command]
fn backup_database(app: tauri::AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::backup_database(&app_dir)
}

#[tauri::command]
fn safe_reset(state: State<Arc<AppState>>, app: tauri::AppHandle) -> Result<datamanager::CleanupResult, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::safe_reset(&app_dir, &state.db)
}

#[tauri::command]
fn auto_cleanup(app: tauri::AppHandle) -> Result<datamanager::CleanupResult, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    datamanager::auto_cleanup(&app_dir)
}

// ── Banners / Ads ──
#[tauri::command]
async fn get_banners(app: tauri::AppHandle) -> Result<Vec<banners::LocalBanner>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    banners::load_local_banners(&app_dir)
}

#[tauri::command]
async fn sync_banners_cmd(app: tauri::AppHandle) -> Result<Vec<banners::LocalBanner>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    banners::sync_banners(&app_dir).await
}

// ── SuperLab commands ──
#[tauri::command]
fn superlab_backtest_games(state: State<Arc<AppState>>, games: Vec<Vec<i32>>, game_type: String) -> Result<Vec<BacktestSummary>, String> {
    superlab::backtest_games(&state.db, &games, &game_type)
}

#[tauri::command]
fn superlab_get_cooccurrence(state: State<Arc<AppState>>, game_type: String, top_n: Option<usize>) -> Result<Vec<CooccurrenceEntry>, String> {
    superlab::get_cooccurrence(&state.db, &game_type, top_n.unwrap_or(200))
}

#[tauri::command]
fn superlab_generate_filtered(state: State<Arc<AppState>>, params: SuperLabFilterParams) -> Result<Vec<Vec<i32>>, String> {
    superlab::generate_filtered(&state.db, &params)
}

#[tauri::command]
fn superlab_score_portfolio(_state: State<Arc<AppState>>, games: Vec<Vec<i32>>, game_type: String) -> Result<PortfolioScore, String> {
    Ok(superlab::score_portfolio(&games, &game_type))
}

#[tauri::command]
fn superlab_advanced_analytics(state: State<Arc<AppState>>, game_type: String, last_n: Option<usize>) -> Result<AdvancedAnalytics, String> {
    superlab::advanced_analytics(&state.db, &game_type, last_n)
}

#[tauri::command]
fn superlab_monte_carlo(state: State<Arc<AppState>>, game: Vec<i32>, game_type: String, iterations: Option<usize>) -> Result<MonteCarloResult, String> {
    superlab::monte_carlo(&game, &game_type, iterations.unwrap_or(10_000))
}

#[tauri::command]
fn superlab_greedy_cover(state: State<Arc<AppState>>, base_numbers: Vec<i32>, game_type: String) -> Result<SetCoverResult, String> {
    superlab::greedy_set_cover(&base_numbers, &game_type)
}

#[tauri::command]
fn superlab_generate_diverse(state: State<Arc<AppState>>, game_type: String, count: i32, min_distance: Option<f64>) -> Result<Vec<Vec<i32>>, String> {
    superlab::generate_diverse_portfolio(&state.db, &game_type, count, min_distance)
}

#[tauri::command]
fn superlab_save_strategy(state: State<Arc<AppState>>, params: SuperLabSaveStrategyParams) -> Result<i64, String> {
    superlab::save_strategy(&state.db, &params)
}

#[tauri::command]
fn superlab_list_strategies(state: State<Arc<AppState>>, game_type: String) -> Result<Vec<SuperLabStrategy>, String> {
    superlab::list_strategies(&state.db, &game_type)
}

#[tauri::command]
fn superlab_delete_strategy(state: State<Arc<AppState>>, id: i64) -> Result<(), String> {
    superlab::delete_strategy(&state.db, id)
}

#[tauri::command]
fn superlab_multi_objective(
    state: State<Arc<AppState>>,
    game_type: String,
    portfolio_size: Option<i32>,
    candidates: Option<usize>,
    w_frequency: Option<f64>,
    w_diversity: Option<f64>,
    w_coverage: Option<f64>,
) -> Result<MultiObjectiveResult, String> {
    superlab::multi_objective_optimize(
        &state.db,
        &game_type,
        portfolio_size.unwrap_or(5),
        candidates.unwrap_or(200),
        w_frequency.unwrap_or(1.0),
        w_diversity.unwrap_or(1.0),
        w_coverage.unwrap_or(1.0),
    )
}

#[tauri::command]
fn superlab_distribution_analysis(state: State<Arc<AppState>>, game_type: String, last_n: Option<usize>) -> Result<DistributionAnalysis, String> {
    superlab::distribution_analysis(&state.db, &game_type, last_n)
}

#[tauri::command]
fn superlab_triple_cooccurrence(state: State<Arc<AppState>>, game_type: String, top_n: Option<usize>, last_n: Option<usize>) -> Result<Vec<TripleEntry>, String> {
    superlab::triple_cooccurrence(&state.db, &game_type, top_n.unwrap_or(50), last_n)
}

#[tauri::command]
fn superlab_period_compare(state: State<Arc<AppState>>, game_type: String, window_a: Option<usize>, window_b: Option<usize>) -> Result<PeriodCompareResult, String> {
    superlab::period_compare(&state.db, &game_type, window_a.unwrap_or(100), window_b.unwrap_or(500))
}

#[tauri::command]
fn superlab_genetic_optimize(
    state: State<Arc<AppState>>,
    game_type: String,
    portfolio_size: Option<i32>,
    pop_size: Option<usize>,
    generations: Option<usize>,
    w_frequency: Option<f64>,
    w_diversity: Option<f64>,
    w_coverage: Option<f64>,
) -> Result<GeneticResult, String> {
    superlab::genetic_optimize(
        &state.db, &game_type,
        portfolio_size.unwrap_or(5),
        pop_size.unwrap_or(30),
        generations.unwrap_or(50),
        w_frequency.unwrap_or(1.0),
        w_diversity.unwrap_or(1.0),
        w_coverage.unwrap_or(1.0),
    )
}

#[tauri::command]
fn superlab_simulated_annealing(
    state: State<Arc<AppState>>,
    game_type: String,
    portfolio_size: Option<i32>,
    max_iterations: Option<usize>,
    w_frequency: Option<f64>,
    w_diversity: Option<f64>,
    w_coverage: Option<f64>,
) -> Result<SAResult, String> {
    superlab::simulated_annealing(
        &state.db, &game_type,
        portfolio_size.unwrap_or(5),
        max_iterations.unwrap_or(2000),
        w_frequency.unwrap_or(1.0),
        w_diversity.unwrap_or(1.0),
        w_coverage.unwrap_or(1.0),
    )
}

#[tauri::command]
fn superlab_reduce_redundancy(_state: State<Arc<AppState>>, games: Vec<Vec<i32>>, max_similarity: Option<f64>) -> Result<RedundancyResult, String> {
    Ok(superlab::reduce_redundancy(games, max_similarity.unwrap_or(0.5)))
}

#[tauri::command]
fn superlab_probability_engine(_state: State<Arc<AppState>>, game_type: String, pick_count: Option<i32>) -> Result<ProbabilityResult, String> {
    superlab::probability_engine(&game_type, pick_count)
}

#[tauri::command]
fn superlab_compare_portfolios(state: State<Arc<AppState>>, games: Vec<Vec<i32>>, names: Vec<String>, game_type: String) -> Result<PortfolioCompareResult, String> {
    superlab::compare_portfolios(&state.db, &games, &names, &game_type)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            let database = Database::new(app_dir.clone()).expect("failed to init database");

            // Lightweight catalog + prices seed (fast INSERT OR IGNORE)
            database.seed_games_catalog(&registry::get_all_lotteries()).ok();
            database.seed_default_prices(&registry::get_default_prices()).ok();

            // No automatic seed data import — user controls data via Settings (sync or import)

            // Lunar calendar import is deferred to background thread (see below)

            let state = Arc::new(AppState {
                db: database,
                is_syncing: AtomicBool::new(false),
                sync_current: AtomicI64::new(0),
                sync_total: AtomicI64::new(0),
                sync_message: std::sync::Mutex::new(String::new()),
            });

            // Clone state for background lunar import before managing
            let state_for_lunar = state.clone();

            app.manage(state);

            // Track app open
            analytics::track_app_open();

            // Sync banners on startup (fire and forget — background thread)
            {
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    let rt = tokio::runtime::Runtime::new().unwrap();
                    rt.block_on(async {
                        let app_dir = app_handle.path().app_data_dir().unwrap_or_default();
                        banners::sync_banners(&app_dir).await.ok();
                    });
                });
            }

            // Auto-import lunar calendar in background thread (fire and forget)
            // Uses short-lived lock batches to avoid blocking the UI
            {
                let app_handle = app.handle().clone();
                let state_clone = state_for_lunar;
                std::thread::spawn(move || {
                    // Brief delay to let the UI load first
                    std::thread::sleep(std::time::Duration::from_secs(3));

                    let lunar_count: i64 = state_clone.db.conn.lock().unwrap()
                        .query_row("SELECT COUNT(*) FROM lunar_calendar", [], |r| r.get(0))
                        .unwrap_or(0);
                    if lunar_count == 0 {
                        if let Ok(resource_path) = app_handle.path().resolve("resources/calendario_lunar_1960_2050.json", tauri::path::BaseDirectory::Resource) {
                            if resource_path.exists() {
                                if let Ok(json_data) = std::fs::read_to_string(&resource_path) {
                                    #[derive(serde::Deserialize)]
                                    struct LunarEntry { data: String, idade_lua: f64, iluminacao: f64, fase: String }
                                    if let Ok(entries) = serde_json::from_str::<Vec<LunarEntry>>(&json_data) {
                                        // Insert in batches of 500, releasing the lock between batches
                                        for chunk in entries.chunks(500) {
                                            let conn = state_clone.db.conn.lock().unwrap();
                                            conn.execute_batch("BEGIN").ok();
                                            for entry in chunk {
                                                conn.execute(
                                                    "INSERT OR IGNORE INTO lunar_calendar (data, idade_lua, iluminacao, fase) VALUES (?1, ?2, ?3, ?4)",
                                                    rusqlite::params![entry.data, entry.idade_lua, entry.iluminacao, entry.fase]
                                                ).ok();
                                            }
                                            conn.execute_batch("COMMIT").ok();
                                            drop(conn); // Release lock between batches
                                            std::thread::sleep(std::time::Duration::from_millis(50));
                                        }
                                        log::info!("Calendario lunar importado em background: {} dias", entries.len());
                                    }
                                }
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_dashboard_summary,
            get_sync_status,
            start_full_sync,
            start_incremental_sync,
            search_contests,
            get_contest_details,
            generate_game,
            generate_portfolio,
            analyze_game_cmd,
            save_game,
            list_saved_games,
            delete_saved_game,
            toggle_favorite_game,
            mark_game_as_bet,
            format_game_for_clipboard,
            format_all_games_for_clipboard,
            get_number_stats,
            get_credits_data,
            export_contests_csv,
            export_saved_games_csv,
            export_full_database_sql,
            import_database_sql,
            get_table_counts,
            download_and_import_sql,
            check_for_new_contests,
            check_game_status,
            get_special_field_stats,
            get_trevo_stats,
            generate_games_pdf_html,
            toggle_bet_game,
            check_bet_results,
            check_bet_results_for_contest,
            check_historical_wins,
            get_dynamic_dashboard_stats,
            update_bet_price,
            get_contests_count_per_game,
            run_manual_seed_import,
            get_all_lotteries,
            get_games_catalog,
            is_onboarding_done,
            get_enabled_games,
            get_primary_game,
            complete_onboarding,
            get_bet_price,
            get_lottery_config,
            sync_game,
            factory_reset,
            // LotoCore Engine
            generate_lotocore,
            // AI Assistant
            ai_chat,
            ai_query_db,
            track_page,
            track_first_install_cmd,
            open_url,
            get_ai_config,
            save_ai_config,
            ai_save_games,
            // Lunar Calendar
            import_lunar_calendar,
            get_lunar_calendar_count,
            // Data Management
            audit_storage,
            clear_cache,
            clear_temp,
            clear_logs,
            backup_database,
            safe_reset,
            auto_cleanup,
            // Banners / Ads
            get_banners,
            sync_banners_cmd,
            // SuperLab
            superlab_backtest_games,
            superlab_get_cooccurrence,
            superlab_generate_filtered,
            superlab_score_portfolio,
            superlab_advanced_analytics,
            superlab_monte_carlo,
            superlab_greedy_cover,
            superlab_generate_diverse,
            superlab_save_strategy,
            superlab_list_strategies,
            superlab_delete_strategy,
            superlab_multi_objective,
            superlab_distribution_analysis,
            superlab_triple_cooccurrence,
            superlab_period_compare,
            superlab_genetic_optimize,
            superlab_simulated_annealing,
            superlab_reduce_redundancy,
            superlab_probability_engine,
            superlab_compare_portfolios,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
