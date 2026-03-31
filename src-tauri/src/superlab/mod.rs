use crate::db::Database;
use crate::models::*;
use crate::generators;
use crate::registry;
use rand::seq::SliceRandom;

// ── Prize helpers (duplicated from lib.rs to keep module self-contained) ──
fn prize_label(game_type: &str, hits: i32, pick_count: i32) -> String {
    match game_type {
        "megasena" | "duplasena" => match hits {
            6 => "SENA! Prêmio principal!".into(),
            5 => "QUINA! Segundo prêmio!".into(),
            4 => "QUADRA! Terceiro prêmio!".into(),
            _ => format!("{} acertos", hits),
        },
        "lotofacil" => match hits {
            15 => "15 ACERTOS! Prêmio principal!".into(),
            14 => "14 acertos! Segundo prêmio!".into(),
            13 => "13 acertos! Terceiro prêmio!".into(),
            12 => "12 acertos! Quarto prêmio!".into(),
            11 => "11 acertos! Quinto prêmio!".into(),
            _ => format!("{} acertos", hits),
        },
        "quina" => match hits {
            5 => "QUINA! Prêmio principal!".into(),
            4 => "QUADRA! Segundo prêmio!".into(),
            3 => "TERNO! Terceiro prêmio!".into(),
            2 => "DUQUE! Quarto prêmio!".into(),
            _ => format!("{} acertos", hits),
        },
        "lotomania" => match hits {
            20 => "20 ACERTOS! Prêmio principal!".into(),
            0 => "0 ACERTOS! Prêmio especial!".into(),
            _ if hits >= 15 => format!("{} acertos! Premiado!", hits),
            _ => format!("{} acertos", hits),
        },
        "timemania" => match hits {
            7 => "7 ACERTOS! Prêmio principal!".into(),
            _ if hits >= 3 => format!("{} acertos! Premiado!", hits),
            _ => format!("{} acertos", hits),
        },
        "diadesorte" => match hits {
            7 => "7 ACERTOS! Prêmio principal!".into(),
            _ if hits >= 4 => format!("{} acertos! Premiado!", hits),
            _ => format!("{} acertos", hits),
        },
        "supersete" => {
            if hits >= 3 { format!("{} acertos! Premiado!", hits) }
            else { format!("{} acertos", hits) }
        },
        "maismilionaria" => match hits {
            6 => "+MILIONÁRIA! Prêmio principal!".into(),
            5 => "5 acertos! Premiado!".into(),
            _ if hits >= 2 => format!("{} acertos! Premiado!", hits),
            _ => format!("{} acertos", hits),
        },
        _ => {
            if hits == pick_count { format!("{} acertos! Prêmio principal!", hits) }
            else if hits >= pick_count - 1 { format!("{} acertos! Premiado!", hits) }
            else { format!("{} acertos", hits) }
        }
    }
}

pub fn min_prize_hits(game_type: &str) -> i32 {
    match game_type {
        "megasena" | "duplasena" => 4,
        "quina" => 2,
        "lotofacil" => 11,
        "lotomania" => 15,
        "timemania" => 3,
        "diadesorte" => 4,
        "supersete" => 3,
        "maismilionaria" => 2,
        _ => 4,
    }
}

fn is_prize(label: &str) -> bool { label.contains('!') }

// ── Fetch helpers ──
fn fetch_contests_with_dates(db: &Database, game_type: &str) -> Result<Vec<(i64, String, Vec<i32>)>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT contest_number, contest_date, numbers_sorted_json FROM contests WHERE game_type = ?1 ORDER BY contest_number ASC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String, Vec<i32>)> = stmt.query_map(rusqlite::params![game_type], |row| {
        let cn: i64 = row.get(0)?;
        let date: String = row.get(1)?;
        let json: String = row.get(2)?;
        let nums: Vec<i32> = serde_json::from_str(&json).unwrap_or_default();
        Ok((cn, date, nums))
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(rows)
}

fn fetch_numbers_only(db: &Database, game_type: &str) -> Result<Vec<Vec<i32>>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT numbers_sorted_json FROM contests WHERE game_type = ?1 ORDER BY contest_number ASC"
    ).map_err(|e| e.to_string())?;
    let rows: Vec<Vec<i32>> = stmt.query_map(rusqlite::params![game_type], |row| {
        let json: String = row.get(0)?;
        Ok(serde_json::from_str::<Vec<i32>>(&json).unwrap_or_default())
    }).map_err(|e| e.to_string())?
    .filter_map(|r| r.ok())
    .collect();
    Ok(rows)
}

// ── Phase 1: Backtesting ──────────────────────────────────────────────────
pub fn backtest_games(
    db: &Database,
    games: &[Vec<i32>],
    game_type: &str,
) -> Result<Vec<BacktestSummary>, String> {
    let all = fetch_contests_with_dates(db, game_type)?;
    let total_contests = all.len() as i64;
    let config = registry::get_lottery_config(game_type);
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6);
    let min_hits = min_prize_hits(game_type);

    let mut summaries: Vec<BacktestSummary> = vec![];
    for game in games {
        let mut hits_list: Vec<BacktestHit> = vec![];
        let mut max_hits = 0i32;
        let mut count_4plus = 0i32;
        let mut count_5plus = 0i32;
        let mut count_6plus = 0i32;

        for (cn, date, drawn) in &all {
            let hits: Vec<i32> = game.iter().filter(|n| drawn.contains(n)).copied().collect();
            let hc = hits.len() as i32;
            let lbl = prize_label(game_type, hc, pick_count);
            if hc >= min_hits && is_prize(&lbl) {
                if hc > max_hits { max_hits = hc; }
                if hc >= 4 { count_4plus += 1; }
                if hc >= 5 { count_5plus += 1; }
                if hc >= 6 { count_6plus += 1; }
                hits_list.push(BacktestHit { contest_number: *cn, contest_date: date.clone(), hits, hit_count: hc, prize_label: lbl });
            }
        }
        hits_list.sort_by(|a, b| b.hit_count.cmp(&a.hit_count).then(b.contest_number.cmp(&a.contest_number)));
        hits_list.truncate(100);
        summaries.push(BacktestSummary { game: game.clone(), total_contests, hits: hits_list, max_hits, count_4plus, count_5plus, count_6plus });
    }
    Ok(summaries)
}

// ── Phase 1: Cooccurrence top-N ─────────────────────────────────────────
pub fn get_cooccurrence(db: &Database, game_type: &str, top_n: usize) -> Result<Vec<CooccurrenceEntry>, String> {
    let all = fetch_numbers_only(db, game_type)?;
    Ok(cooccurrence_from_slice(&all, top_n))
}

fn cooccurrence_from_slice(all: &[Vec<i32>], top_n: usize) -> Vec<CooccurrenceEntry> {
    let total = all.len();
    if total == 0 { return vec![]; }
    let mut freq: std::collections::HashMap<(i32, i32), i32> = std::collections::HashMap::new();
    for nums in all {
        for i in 0..nums.len() {
            for j in (i + 1)..nums.len() {
                *freq.entry((nums[i], nums[j])).or_insert(0) += 1;
            }
        }
    }
    let tf = total as f64;
    let mut entries: Vec<CooccurrenceEntry> = freq.into_iter()
        .map(|((a, b), f)| CooccurrenceEntry { num_a: a, num_b: b, frequency: f, pct: f as f64 / tf * 100.0 })
        .collect();
    entries.sort_by(|a, b| b.frequency.cmp(&a.frequency));
    entries.truncate(top_n);
    entries
}

// ── Phase 1: Filtered generation ────────────────────────────────────────
pub fn generate_filtered(db: &Database, params: &SuperLabFilterParams) -> Result<Vec<Vec<i32>>, String> {
    let config = registry::get_lottery_config(&params.game_type)
        .ok_or_else(|| format!("Loteria não encontrada: {}", params.game_type))?;
    let strategy = params.strategy_id.as_deref().unwrap_or("hibrido");
    let last_nums: Vec<i32> = if params.repeats_max.is_some() {
        db.get_last_contest_for_game(&params.game_type)?.map(|c| c.numbers_sorted).unwrap_or_default()
    } else { vec![] };

    let mut result: Vec<Vec<i32>> = vec![];
    let mut attempts = 0;
    while result.len() < params.count as usize && attempts < params.count * 300 {
        attempts += 1;
        let game = match generators::generate_game(db, &params.game_type, strategy, config.numbers_pool_size, config.default_pick_count) {
            Ok(g) => g, Err(_) => continue,
        };
        let sum: i32 = game.iter().sum();
        let evens = game.iter().filter(|&&n| n % 2 == 0).count() as i32;
        if let Some(mn) = params.sum_min { if sum < mn { continue; } }
        if let Some(mx) = params.sum_max { if sum > mx { continue; } }
        if let Some(mn) = params.even_min { if evens < mn { continue; } }
        if let Some(mx) = params.even_max { if evens > mx { continue; } }
        if let Some(rmax) = params.repeats_max {
            if game.iter().filter(|n| last_nums.contains(n)).count() as i32 > rmax { continue; }
        }
        if !result.contains(&game) { result.push(game); }
    }
    Ok(result)
}

// ── Phase 1: Portfolio score ─────────────────────────────────────────────
pub fn score_portfolio(games: &[Vec<i32>], game_type: &str) -> PortfolioScore {
    let pool_size = registry::get_lottery_config(game_type).map(|c| c.numbers_pool_size).unwrap_or(60);
    let total_games = games.len() as i32;
    if total_games == 0 {
        return PortfolioScore { total_games: 0, distinct_numbers: 0, pool_size, coverage_pct: 0.0, avg_overlap: 0.0, diversity_score: 0.0, quality_label: "Vazia".into() };
    }
    let mut all_set: std::collections::HashSet<i32> = std::collections::HashSet::new();
    for g in games { for &n in g { all_set.insert(n); } }
    let distinct = all_set.len() as i32;
    let coverage = distinct as f64 / pool_size as f64 * 100.0;
    let mut total_overlap = 0.0f64;
    let mut pairs = 0;
    for i in 0..games.len() {
        for j in (i + 1)..games.len() {
            total_overlap += games[i].iter().filter(|n| games[j].contains(n)).count() as f64;
            pairs += 1;
        }
    }
    let avg_overlap = if pairs > 0 { total_overlap / pairs as f64 } else { 0.0 };
    let pick = games.first().map(|g| g.len()).unwrap_or(6) as f64;
    let raw = (coverage / 100.0) * (1.0 - (avg_overlap / pick) * 0.6);
    let diversity_score = (raw * 100.0_f64).clamp(0.0, 100.0);
    let quality_label = if diversity_score >= 80.0 { "Excelente" } else if diversity_score >= 60.0 { "Boa" } else if diversity_score >= 40.0 { "Regular" } else { "Baixa" }.into();
    PortfolioScore { total_games, distinct_numbers: distinct, pool_size, coverage_pct: coverage, avg_overlap, diversity_score, quality_label }
}

// ── Phase 2: Advanced Analytics ──────────────────────────────────────────
pub fn advanced_analytics(db: &Database, game_type: &str, last_n: Option<usize>) -> Result<AdvancedAnalytics, String> {
    let raw = fetch_numbers_only(db, game_type)?;
    let total_all = raw.len();
    let contests: Vec<Vec<i32>> = if let Some(n) = last_n {
        if n < total_all { raw[total_all - n..].to_vec() } else { raw }
    } else { raw };

    let window = contests.len();
    if window == 0 { return Err("Sem dados para análise".into()); }

    let config = registry::get_lottery_config(game_type);
    let pool_size = config.as_ref().map(|c| c.numbers_pool_size).unwrap_or(60);
    let num_start: i32 = if pool_size == 100 { 0 } else { 1 };
    let num_end: i32 = if pool_size == 100 { 99 } else { pool_size };
    let tf = window as f64;

    // Sum/even averages
    let sum_avg = contests.iter().map(|nums| nums.iter().sum::<i32>() as f64).sum::<f64>() / tf;
    let even_avg = contests.iter().map(|nums| nums.iter().filter(|&&n| n % 2 == 0).count() as f64).sum::<f64>() / tf;

    // Shannon entropy
    let mut app_count: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
    for nums in &contests { for &n in nums { *app_count.entry(n).or_insert(0) += 1; } }
    let total_drawn: f64 = app_count.values().sum::<usize>() as f64;
    let entropy: f64 = app_count.values().map(|&c| {
        let p = c as f64 / total_drawn;
        if p > 0.0 { -p * p.ln() } else { 0.0 }
    }).sum();

    // Per-number analytics
    let mut numbers: Vec<NumberAnalytics> = vec![];
    for num in num_start..=num_end {
        let mut appearances: Vec<usize> = vec![];
        for (i, nums) in contests.iter().enumerate() {
            if nums.contains(&num) { appearances.push(i); }
        }
        let frequency = appearances.len() as i32;
        let freq_pct = frequency as f64 / tf * 100.0;
        let delay = if let Some(&last_idx) = appearances.last() {
            (window.saturating_sub(1).saturating_sub(last_idx)) as i32
        } else { window as i32 };
        let avg_gap = if appearances.len() >= 2 {
            let gaps: Vec<f64> = appearances.windows(2).map(|w| (w[1] - w[0]) as f64).collect();
            gaps.iter().sum::<f64>() / gaps.len() as f64
        } else { window as f64 };
        let last_30 = if window > 30 { window - 30 } else { 0 };
        let last_100 = if window > 100 { window - 100 } else { 0 };
        let recent_30 = appearances.iter().filter(|&&i| i >= last_30).count() as i32;
        let recent_100 = appearances.iter().filter(|&&i| i >= last_100).count() as i32;
        let score = (freq_pct / 100.0 * 0.5
            + recent_30 as f64 / tf.min(30.0) * 0.3
            - delay as f64 / tf * 0.2)
            .max(0.0_f64);
        numbers.push(NumberAnalytics { number: num, frequency, freq_pct, delay, avg_gap, recent_30, recent_100, score });
    }

    let mut by_freq = numbers.clone();
    by_freq.sort_by(|a, b| b.frequency.cmp(&a.frequency));
    let top_hot: Vec<i32> = by_freq.iter().take(10).map(|n| n.number).collect();

    let mut by_delay = numbers.clone();
    by_delay.sort_by(|a, b| b.delay.cmp(&a.delay));
    let top_cold: Vec<i32> = by_delay.iter().take(10).map(|n| n.number).collect();

    let top_pairs = cooccurrence_from_slice(&contests, 10);

    // Insights
    let mut insights: Vec<String> = vec![];
    if let Some(cold) = by_delay.first() {
        if cold.delay > (window / 10) as i32 {
            insights.push(format!("Dezena {} está ausente há {} concursos (atraso acima da média)", cold.number, cold.delay));
        }
    }
    if let Some(hot) = by_freq.first() {
        insights.push(format!("Dezena {} é a mais frequente: {:.1}% de aparições no período", hot.number, hot.freq_pct));
    }
    if let Some(pair) = top_pairs.first() {
        insights.push(format!("Par mais frequente: {} + {} apareceram juntos {} vezes ({:.1}%)", pair.num_a, pair.num_b, pair.frequency, pair.pct));
    }
    let ideal_even = by_freq.first().map(|_| {
        let pick = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6) as f64;
        pick / 2.0
    }).unwrap_or(3.0);
    if (even_avg - ideal_even).abs() > 0.5 {
        insights.push(format!("Média de pares por sorteio: {:.1} (equilíbrio esperado: {:.0})", even_avg, ideal_even));
    }

    Ok(AdvancedAnalytics {
        game_type: game_type.into(),
        total_contests: total_all as i64,
        window: window as i64,
        numbers,
        sum_avg,
        even_avg,
        entropy,
        top_hot,
        top_cold,
        top_pairs,
        insights,
    })
}

// ── Phase 4: Monte Carlo Simulation ─────────────────────────────────────
pub fn monte_carlo(game: &[i32], game_type: &str, iterations: usize) -> Result<MonteCarloResult, String> {
    let config = registry::get_lottery_config(game_type)
        .ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pool_size = config.numbers_pool_size;
    let pick_count = config.default_pick_count as usize;
    let num_start: i32 = if pool_size == 100 { 0 } else { 1 };
    let num_end: i32 = if pool_size == 100 { 99 } else { pool_size };
    let pool: Vec<i32> = (num_start..=num_end).collect();

    let min_hits = min_prize_hits(game_type) as usize;
    let max_possible = game.len().min(pick_count);
    let mut rng = rand::thread_rng();
    let capped = iterations.min(100_000);

    let mut buckets: Vec<i32> = vec![0i32; max_possible + 1];
    for _ in 0..capped {
        let mut draw = pool.clone();
        draw.shuffle(&mut rng);
        let hits = draw[..pick_count].iter().filter(|n| game.contains(n)).count();
        if hits < buckets.len() { buckets[hits] += 1; }
    }

    let total = capped as f64;
    let hit_counts: Vec<i32> = (min_hits..=max_possible).map(|h| if h < buckets.len() { buckets[h] } else { 0 }).collect();
    let hit_pcts: Vec<f64> = hit_counts.iter().map(|&c| c as f64 / total * 100.0).collect();
    let prize_total = hit_counts.iter().sum::<i32>();
    let expected = if prize_total > 0 { total / prize_total as f64 } else { f64::INFINITY };

    Ok(MonteCarloResult {
        game: game.to_vec(),
        iterations: capped as i32,
        min_prize_hits: min_hits as i32,
        hit_counts,
        hit_pcts,
        expected_contests_to_prize: expected,
    })
}

// ── Phase 5: Greedy Set Cover ────────────────────────────────────────────
pub fn greedy_set_cover(base_numbers: &[i32], game_type: &str) -> Result<SetCoverResult, String> {
    if base_numbers.len() > 25 {
        return Err("Máximo 25 dezenas base para cobertura de pares".into());
    }
    let config = registry::get_lottery_config(game_type)
        .ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pick_count = config.default_pick_count as usize;
    if base_numbers.len() < pick_count {
        return Err(format!("Forneça ao menos {} dezenas base", pick_count));
    }

    // All pairs that need to be covered
    let mut remaining: std::collections::HashSet<(i32, i32)> = std::collections::HashSet::new();
    for i in 0..base_numbers.len() {
        for j in (i + 1)..base_numbers.len() {
            remaining.insert((base_numbers[i], base_numbers[j]));
        }
    }
    let total_pairs = remaining.len();
    let mut tickets: Vec<Vec<i32>> = vec![];
    let max_tickets = 150;
    let mut rng = rand::thread_rng();

    while !remaining.is_empty() && tickets.len() < max_tickets {
        // Sample 400 candidate tickets, pick the one covering most remaining pairs
        let mut best_ticket: Option<Vec<i32>> = None;
        let mut best_cover = 0usize;

        for _ in 0..400 {
            let mut pool = base_numbers.to_vec();
            pool.shuffle(&mut rng);
            let mut candidate: Vec<i32> = pool[..pick_count].to_vec();
            candidate.sort();
            let cover = remaining.iter().filter(|&&(a, b)| candidate.contains(&a) && candidate.contains(&b)).count();
            if cover > best_cover {
                best_cover = cover;
                best_ticket = Some(candidate);
            }
        }

        if let Some(t) = best_ticket {
            let to_remove: Vec<(i32, i32)> = remaining.iter()
                .filter(|&&(a, b)| t.contains(&a) && t.contains(&b))
                .cloned().collect();
            for p in to_remove { remaining.remove(&p); }
            if !tickets.contains(&t) { tickets.push(t); }
        } else { break; }
    }

    let covered = total_pairs - remaining.len();
    let coverage_pct = if total_pairs > 0 { covered as f64 / total_pairs as f64 * 100.0 } else { 100.0 };
    Ok(SetCoverResult { tickets, covered_pairs: covered, total_pairs, coverage_pct })
}

// ── Phase 5: Diversity-aware portfolio ──────────────────────────────────
pub fn generate_diverse_portfolio(
    db: &Database,
    game_type: &str,
    count: i32,
    min_distance: Option<f64>,
) -> Result<Vec<Vec<i32>>, String> {
    let config = registry::get_lottery_config(game_type)
        .ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let min_dist = min_distance.unwrap_or(0.45);

    let candidate_count = (count * 60).min(600) as usize;
    let mut candidates: Vec<Vec<i32>> = vec![];
    for _ in 0..candidate_count {
        if let Ok(g) = generators::generate_game(db, game_type, "hibrido", config.numbers_pool_size, config.default_pick_count) {
            if !candidates.contains(&g) { candidates.push(g); }
        }
    }
    if candidates.is_empty() { return Ok(vec![]); }

    // Greedy: always pick next candidate with max min-distance to current portfolio
    let mut portfolio: Vec<Vec<i32>> = vec![candidates.remove(0)];
    while portfolio.len() < count as usize && !candidates.is_empty() {
        let best = candidates.iter().enumerate()
            .max_by(|(_, a), (_, b)| {
                let da = portfolio.iter().map(|p| jaccard_dist(a, p)).fold(f64::INFINITY, f64::min);
                let db_ = portfolio.iter().map(|p| jaccard_dist(b, p)).fold(f64::INFINITY, f64::min);
                da.partial_cmp(&db_).unwrap_or(std::cmp::Ordering::Equal)
            })
            .map(|(i, _)| i);
        if let Some(idx) = best {
            let c = candidates.remove(idx);
            let md = portfolio.iter().map(|p| jaccard_dist(&c, p)).fold(f64::INFINITY, f64::min);
            if md >= min_dist || portfolio.len() < 2 { portfolio.push(c); }
        } else { break; }
    }
    Ok(portfolio)
}

fn jaccard_dist(a: &[i32], b: &[i32]) -> f64 {
    let inter = a.iter().filter(|n| b.contains(n)).count();
    let union = a.len() + b.len() - inter;
    if union == 0 { 0.0 } else { 1.0 - inter as f64 / union as f64 }
}

// ── Phase 3: Strategy persistence (delegates to DB) ─────────────────────
pub fn save_strategy(db: &Database, params: &SuperLabSaveStrategyParams) -> Result<i64, String> {
    db.save_superlab_strategy(params)
}

pub fn list_strategies(db: &Database, game_type: &str) -> Result<Vec<SuperLabStrategy>, String> {
    db.list_superlab_strategies(game_type)
}

pub fn delete_strategy(db: &Database, id: i64) -> Result<(), String> {
    db.delete_superlab_strategy(id)
}

// ── Phase 7: Multi-objective portfolio optimizer ─────────────────────────
pub fn multi_objective_optimize(
    db: &Database,
    game_type: &str,
    portfolio_size: i32,
    candidate_count: usize,
    w_frequency: f64,
    w_diversity: f64,
    w_coverage: f64,
) -> Result<MultiObjectiveResult, String> {
    let config = registry::get_lottery_config(game_type)
        .ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pool_size = config.numbers_pool_size;
    let pick_count = config.default_pick_count as usize;

    let contests = fetch_numbers_only(db, game_type)?;
    if contests.is_empty() { return Err("Sem dados históricos".into()); }

    // Build frequency rank map (0-1)
    let mut freq_map: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    for contest in &contests {
        for &n in contest { *freq_map.entry(n).or_insert(0.0) += 1.0; }
    }
    let max_freq = freq_map.values().cloned().fold(0.0_f64, f64::max).max(1.0);
    let freq_rank: std::collections::HashMap<i32, f64> =
        freq_map.iter().map(|(&n, &f)| (n, f / max_freq)).collect();

    let mut rng = rand::thread_rng();
    let all_numbers: Vec<i32> = (1..=pool_size).collect();
    let capped = candidate_count.min(300);

    struct Scored { games: Vec<Vec<i32>>, freq: f64, div: f64, cov: f64, composite: f64 }

    // Generate and score candidate portfolios
    let mut scored_raw: Vec<Scored> = (0..capped).map(|_| {
        let portfolio: Vec<Vec<i32>> = (0..portfolio_size).map(|_| {
            let mut nums = all_numbers.clone();
            nums.shuffle(&mut rng);
            let mut game: Vec<i32> = nums[..pick_count].to_vec();
            game.sort();
            game
        }).collect();

        let all_nums: Vec<i32> = portfolio.iter().flat_map(|g| g.iter().cloned()).collect();
        let freq_s = if all_nums.is_empty() { 0.0 } else {
            all_nums.iter().map(|n| freq_rank.get(n).cloned().unwrap_or(0.0)).sum::<f64>() / all_nums.len() as f64
        };

        let div_s = if portfolio.len() < 2 { 0.0 } else {
            let mut sum = 0.0_f64; let mut cnt = 0usize;
            for i in 0..portfolio.len() {
                for j in (i + 1)..portfolio.len() {
                    sum += jaccard_dist(&portfolio[i], &portfolio[j]);
                    cnt += 1;
                }
            }
            if cnt > 0 { sum / cnt as f64 } else { 0.0 }
        };

        let unique_pairs: std::collections::HashSet<(i32, i32)> = portfolio.iter()
            .flat_map(|g| {
                let mut pairs = vec![];
                for i in 0..g.len() { for j in (i + 1)..g.len() { pairs.push((g[i], g[j])); } }
                pairs
            }).collect();
        let max_pairs = (portfolio_size as usize * pick_count * (pick_count - 1) / 2).max(1);
        let cov_s = unique_pairs.len() as f64 / max_pairs as f64;

        Scored { games: portfolio, freq: freq_s, div: div_s, cov: cov_s, composite: 0.0 }
    }).collect();

    // Normalize then compute composite
    let max_f = scored_raw.iter().map(|s| s.freq).fold(0.0_f64, f64::max).max(1e-9);
    let max_d = scored_raw.iter().map(|s| s.div).fold(0.0_f64, f64::max).max(1e-9);
    let max_c = scored_raw.iter().map(|s| s.cov).fold(0.0_f64, f64::max).max(1e-9);
    let total_w = (w_frequency + w_diversity + w_coverage).max(1e-9);

    for s in &mut scored_raw {
        s.freq /= max_f;
        s.div /= max_d;
        s.cov /= max_c;
        s.composite = (w_frequency * s.freq + w_diversity * s.div + w_coverage * s.cov) / total_w;
    }

    scored_raw.sort_by(|a, b| b.composite.partial_cmp(&a.composite).unwrap_or(std::cmp::Ordering::Equal));
    let top: Vec<Scored> = scored_raw.into_iter().take(10).collect();
    let total_candidates = capped;

    let top_scores: Vec<(f64, f64, f64)> = top.iter().map(|s| (s.freq, s.div, s.cov)).collect();
    let pareto_count = top_scores.iter().filter(|&&(f1, d1, c1)| {
        !top_scores.iter().any(|&(f2, d2, c2)| f2 >= f1 && d2 >= d1 && c2 >= c1 && (f2 > f1 || d2 > d1 || c2 > c1))
    }).count();

    let portfolios: Vec<OptimizedPortfolio> = top.into_iter().enumerate().map(|(rank, s)| {
        let (f1, d1, c1) = (s.freq, s.div, s.cov);
        let is_pareto = !top_scores.iter().any(|&(f2, d2, c2)| {
            f2 >= f1 && d2 >= d1 && c2 >= c1 && (f2 > f1 || d2 > d1 || c2 > c1)
        });
        OptimizedPortfolio {
            rank: rank + 1,
            games: s.games,
            frequency_score: f1,
            diversity_score: d1,
            coverage_score: c1,
            composite_score: s.composite,
            is_pareto,
        }
    }).collect();

    Ok(MultiObjectiveResult { portfolios, pareto_count, total_candidates, w_frequency, w_diversity, w_coverage })
}

// ── Distribution Analysis ────────────────────────────────
pub fn distribution_analysis(db: &Database, game_type: &str, last_n: Option<usize>) -> Result<DistributionAnalysis, String> {
    let raw = fetch_numbers_only(db, game_type)?;
    let total_all = raw.len();
    let contests: Vec<Vec<i32>> = if let Some(n) = last_n {
        if n < total_all { raw[total_all - n..].to_vec() } else { raw }
    } else { raw };
    let window = contests.len();
    if window == 0 { return Err("Sem dados".into()); }
    let tf = window as f64;
    let pool = registry::get_lottery_config(game_type).map(|c| c.numbers_pool_size).unwrap_or(60);
    let pick = registry::get_lottery_config(game_type).map(|c| c.default_pick_count).unwrap_or(6);

    // Range averages (01-10, 11-20, 21-30, 31-40, 41-50, 51-60)
    let range_bounds: [(i32, i32); 6] = [(1,10),(11,20),(21,30),(31,40),(41,50),(51,60)];
    let range_avgs: Vec<f64> = range_bounds.iter().map(|&(lo, hi)| {
        let hi_c = hi.min(pool);
        if lo > pool { return 0.0; }
        contests.iter().map(|c| c.iter().filter(|&&n| n >= lo && n <= hi_c).count() as f64).sum::<f64>() / tf
    }).collect();

    let avg_even = contests.iter().map(|c| c.iter().filter(|&&n| n % 2 == 0).count() as f64).sum::<f64>() / tf;
    let avg_odd = pick as f64 - avg_even;

    let all_primes: Vec<i32> = vec![2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97];
    let primes: Vec<i32> = all_primes.into_iter().filter(|&p| p <= pool).collect();
    let avg_primes = contests.iter().map(|c| c.iter().filter(|n| primes.contains(n)).count() as f64).sum::<f64>() / tf;

    let all_fibs: Vec<i32> = vec![1,2,3,5,8,13,21,34,55,89];
    let fibs: Vec<i32> = all_fibs.into_iter().filter(|&f| f <= pool).collect();
    let avg_fibonacci = contests.iter().map(|c| c.iter().filter(|n| fibs.contains(n)).count() as f64).sum::<f64>() / tf;

    let sums: Vec<i32> = contests.iter().map(|c| c.iter().sum()).collect();
    let avg_sum = sums.iter().sum::<i32>() as f64 / tf;
    let min_sum = *sums.iter().min().unwrap_or(&0);
    let max_sum = *sums.iter().max().unwrap_or(&0);
    let bucket_size = ((max_sum - min_sum) / 10).max(1);
    let mut bucket_counts: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();
    for &s in &sums { let b = (s - min_sum) / bucket_size; *bucket_counts.entry(b).or_insert(0) += 1; }
    let mut sum_histogram: Vec<SumHistogramBucket> = bucket_counts.into_iter().map(|(b, cnt)| {
        let lo = min_sum + b * bucket_size;
        let hi = lo + bucket_size - 1;
        SumHistogramBucket { range_label: format!("{}-{}", lo, hi), count: cnt, pct: cnt as f64 / tf * 100.0 }
    }).collect();
    sum_histogram.sort_by(|a, b| a.range_label.cmp(&b.range_label));

    let mut repeat_map: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();
    for i in 1..contests.len() {
        let r = contests[i].iter().filter(|n| contests[i-1].contains(n)).count() as i32;
        *repeat_map.entry(r).or_insert(0) += 1;
    }
    let avg_repeats = if window > 1 {
        (1..window).map(|i| contests[i].iter().filter(|n| contests[i-1].contains(n)).count() as f64).sum::<f64>() / (window - 1) as f64
    } else { 0.0 };
    let total_windows = (window - 1).max(1) as f64;
    let mut repeats_distribution: Vec<RepeatsBucket> = repeat_map.into_iter()
        .map(|(r, cnt)| RepeatsBucket { repeats: r, count: cnt, pct: cnt as f64 / total_windows * 100.0 })
        .collect();
    repeats_distribution.sort_by_key(|b| b.repeats);

    let moldura_miolo = if game_type == "lotofacil" {
        let moldura: Vec<i32> = vec![1,2,3,4,5,6,10,11,15,16,20,21,22,23,24,25];
        let miolo: Vec<i32> = vec![7,8,9,12,13,14,17,18,19];
        let am = contests.iter().map(|c| c.iter().filter(|n| moldura.contains(n)).count() as f64).sum::<f64>() / tf;
        let ami = contests.iter().map(|c| c.iter().filter(|n| miolo.contains(n)).count() as f64).sum::<f64>() / tf;
        Some(MolduraMioloStats { avg_moldura: am, avg_miolo: ami })
    } else { None };

    Ok(DistributionAnalysis {
        game_type: game_type.into(), total_contests: total_all as i64, window: window as i64,
        range_01_10: range_avgs[0], range_11_20: range_avgs[1], range_21_30: range_avgs[2],
        range_31_40: range_avgs[3], range_41_50: range_avgs[4], range_51_60: range_avgs[5],
        avg_even, avg_odd, avg_primes, avg_fibonacci, avg_sum,
        sum_histogram, repeats_distribution, avg_repeats_from_last: avg_repeats, moldura_miolo,
    })
}

// ── Triple Cooccurrence ──────────────────────────────────
pub fn triple_cooccurrence(db: &Database, game_type: &str, top_n: usize, last_n: Option<usize>) -> Result<Vec<TripleEntry>, String> {
    let raw = fetch_numbers_only(db, game_type)?;
    let total_all = raw.len();
    let contests: Vec<Vec<i32>> = if let Some(n) = last_n {
        if n < total_all { raw[total_all - n..].to_vec() } else { raw }
    } else { raw };
    let total = contests.len();
    if total == 0 { return Ok(vec![]); }
    let tf = total as f64;
    let mut freq: std::collections::HashMap<(i32,i32,i32), i32> = std::collections::HashMap::new();
    for nums in &contests {
        for i in 0..nums.len() {
            for j in (i+1)..nums.len() {
                for k in (j+1)..nums.len() {
                    *freq.entry((nums[i], nums[j], nums[k])).or_insert(0) += 1;
                }
            }
        }
    }
    let mut entries: Vec<TripleEntry> = freq.into_iter()
        .map(|((a,b,c), f)| TripleEntry { num_a: a, num_b: b, num_c: c, frequency: f, pct: f as f64 / tf * 100.0 })
        .collect();
    entries.sort_by(|a, b| b.frequency.cmp(&a.frequency));
    entries.truncate(top_n);
    Ok(entries)
}

// ── Period Comparison ────────────────────────────────────
pub fn period_compare(db: &Database, game_type: &str, window_a: usize, window_b: usize) -> Result<PeriodCompareResult, String> {
    let pa = advanced_analytics(db, game_type, Some(window_a))?;
    let pb = advanced_analytics(db, game_type, Some(window_b))?;
    let mut deltas: Vec<NumberDelta> = pa.numbers.iter().filter_map(|na| {
        pb.numbers.iter().find(|nb| nb.number == na.number).map(|nb| NumberDelta {
            number: na.number,
            freq_delta: na.freq_pct - nb.freq_pct,
            delay_delta: na.delay - nb.delay,
            score_delta: na.score - nb.score,
        })
    }).collect();
    deltas.sort_by(|a, b| b.freq_delta.partial_cmp(&a.freq_delta).unwrap_or(std::cmp::Ordering::Equal));
    let top_gainers: Vec<NumberDelta> = deltas.iter().take(10).cloned().collect();
    let mut by_loss = deltas.clone();
    by_loss.sort_by(|a, b| a.freq_delta.partial_cmp(&b.freq_delta).unwrap_or(std::cmp::Ordering::Equal));
    let top_losers: Vec<NumberDelta> = by_loss.iter().take(10).cloned().collect();
    Ok(PeriodCompareResult { window_a: window_a as i64, window_b: window_b as i64, top_gainers, top_losers, deltas })
}

// ── Genetic Portfolio Optimizer ──────────────────────────
fn portfolio_score_ga(
    portfolio: &[Vec<i32>],
    freq_rank: &std::collections::HashMap<i32, f64>,
    portfolio_size: i32,
    pick_count: usize,
    w_freq: f64, w_div: f64, w_cov: f64,
) -> f64 {
    let all_nums: Vec<i32> = portfolio.iter().flat_map(|g| g.iter().cloned()).collect();
    let freq_s = if all_nums.is_empty() { 0.0 } else {
        all_nums.iter().map(|n| freq_rank.get(n).cloned().unwrap_or(0.0)).sum::<f64>() / all_nums.len() as f64
    };
    let div_s = if portfolio.len() < 2 { 0.0 } else {
        let mut sum = 0.0_f64; let mut cnt = 0usize;
        for i in 0..portfolio.len() { for j in (i+1)..portfolio.len() { sum += jaccard_dist(&portfolio[i], &portfolio[j]); cnt += 1; } }
        if cnt > 0 { sum / cnt as f64 } else { 0.0 }
    };
    let unique_pairs: std::collections::HashSet<(i32,i32)> = portfolio.iter().flat_map(|g| {
        let mut p = vec![]; for i in 0..g.len() { for j in (i+1)..g.len() { p.push((g[i], g[j])); } } p
    }).collect();
    let max_pairs = (portfolio_size as usize * pick_count * (pick_count - 1) / 2).max(1);
    let cov_s = unique_pairs.len() as f64 / max_pairs as f64;
    let tw = (w_freq + w_div + w_cov).max(1e-9);
    (w_freq * freq_s + w_div * div_s + w_cov * cov_s) / tw
}

pub fn genetic_optimize(
    db: &Database,
    game_type: &str,
    portfolio_size: i32,
    pop_size: usize,
    generations: usize,
    w_frequency: f64,
    w_diversity: f64,
    w_coverage: f64,
) -> Result<GeneticResult, String> {
    use rand::Rng;
    let config = registry::get_lottery_config(game_type).ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pool_size = config.numbers_pool_size;
    let pick_count = config.default_pick_count as usize;
    let contests = fetch_numbers_only(db, game_type)?;
    if contests.is_empty() { return Err("Sem dados históricos".into()); }
    let mut freq_map: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    for c in &contests { for &n in c { *freq_map.entry(n).or_insert(0.0) += 1.0; } }
    let max_f = freq_map.values().cloned().fold(0.0_f64, f64::max).max(1.0);
    let freq_rank: std::collections::HashMap<i32, f64> = freq_map.iter().map(|(&n, &f)| (n, f / max_f)).collect();
    let all_numbers: Vec<i32> = (1..=pool_size).collect();
    let mut rng = rand::thread_rng();
    let pop_cap = pop_size.min(40);
    let gen_cap = generations.min(80);

    // Generate initial population
    let mut population: Vec<Vec<Vec<i32>>> = (0..pop_cap).map(|_| {
        (0..portfolio_size).map(|_| {
            let mut nums = all_numbers.clone(); nums.shuffle(&mut rng);
            let mut g: Vec<i32> = nums[..pick_count].to_vec(); g.sort(); g
        }).collect()
    }).collect();

    let mut score_history: Vec<f64> = Vec::with_capacity(gen_cap);

    for _gen in 0..gen_cap {
        let mut scored: Vec<(f64, Vec<Vec<i32>>)> = population.into_iter()
            .map(|p| (portfolio_score_ga(&p, &freq_rank, portfolio_size, pick_count, w_frequency, w_diversity, w_coverage), p))
            .collect();
        scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        score_history.push(scored[0].0);
        let elite_n = (pop_cap / 5).max(1);
        let mut new_pop: Vec<Vec<Vec<i32>>> = scored.iter().take(elite_n).map(|(_, p)| p.clone()).collect();
        while new_pop.len() < pop_cap {
            let pa = &scored[rng.gen_range(0..elite_n)].1;
            let pb = &scored[rng.gen_range(0..scored.len())].1;
            let mut child: Vec<Vec<i32>> = pa.iter().zip(pb.iter())
                .map(|(ga, gb)| if rng.gen::<f64>() < 0.5 { ga.clone() } else { gb.clone() })
                .collect();
            if rng.gen::<f64>() < 0.25 {
                let idx = rng.gen_range(0..child.len());
                let mut nums = all_numbers.clone(); nums.shuffle(&mut rng);
                let mut g: Vec<i32> = nums[..pick_count].to_vec(); g.sort();
                child[idx] = g;
            }
            new_pop.push(child);
        }
        population = new_pop;
    }

    let mut final_scored: Vec<(f64, Vec<Vec<i32>>)> = population.into_iter()
        .map(|p| (portfolio_score_ga(&p, &freq_rank, portfolio_size, pick_count, w_frequency, w_diversity, w_coverage), p))
        .collect();
    final_scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    let best = &final_scored[0].1;
    let final_score = final_scored[0].0;

    let all_nums: Vec<i32> = best.iter().flat_map(|g| g.iter().cloned()).collect();
    let frequency_score = if all_nums.is_empty() { 0.0 } else {
        all_nums.iter().map(|n| freq_rank.get(n).cloned().unwrap_or(0.0)).sum::<f64>() / all_nums.len() as f64
    };
    let diversity_score = if best.len() < 2 { 0.0 } else {
        let mut sum = 0.0_f64; let mut cnt = 0usize;
        for i in 0..best.len() { for j in (i+1)..best.len() { sum += jaccard_dist(&best[i], &best[j]); cnt += 1; } }
        if cnt > 0 { sum / cnt as f64 } else { 0.0 }
    };
    let unique_pairs: std::collections::HashSet<(i32,i32)> = best.iter().flat_map(|g| {
        let mut p = vec![]; for i in 0..g.len() { for j in (i+1)..g.len() { p.push((g[i], g[j])); } } p
    }).collect();
    let max_pairs = (portfolio_size as usize * pick_count * (pick_count - 1) / 2).max(1);
    let coverage_score = unique_pairs.len() as f64 / max_pairs as f64;

    Ok(GeneticResult {
        best_portfolio: best.clone(), score_history, final_score,
        frequency_score, diversity_score, coverage_score, generations_run: gen_cap,
    })
}

// ── Simulated Annealing ──────────────────────────────────
pub fn simulated_annealing(
    db: &Database,
    game_type: &str,
    portfolio_size: i32,
    max_iterations: usize,
    w_frequency: f64,
    w_diversity: f64,
    w_coverage: f64,
) -> Result<SAResult, String> {
    use rand::Rng;
    let config = registry::get_lottery_config(game_type).ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pool_size = config.numbers_pool_size;
    let pick_count = config.default_pick_count as usize;
    let contests = fetch_numbers_only(db, game_type)?;
    if contests.is_empty() { return Err("Sem dados históricos".into()); }
    let mut freq_map: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
    for c in &contests { for &n in c { *freq_map.entry(n).or_insert(0.0) += 1.0; } }
    let max_f = freq_map.values().cloned().fold(0.0_f64, f64::max).max(1.0);
    let freq_rank: std::collections::HashMap<i32, f64> = freq_map.iter().map(|(&n, &f)| (n, f / max_f)).collect();
    let all_numbers: Vec<i32> = (1..=pool_size).collect();
    let mut rng = rand::thread_rng();
    let cap = max_iterations.min(3000);

    // Initial portfolio
    let mut current: Vec<Vec<i32>> = (0..portfolio_size).map(|_| {
        let mut nums = all_numbers.clone(); nums.shuffle(&mut rng);
        let mut g: Vec<i32> = nums[..pick_count].to_vec(); g.sort(); g
    }).collect();
    let initial_score = portfolio_score_ga(&current, &freq_rank, portfolio_size, pick_count, w_frequency, w_diversity, w_coverage);
    let mut best = current.clone();
    let mut best_score = initial_score;
    let mut temperature = 1.0_f64;
    let cooling = 0.995_f64;
    let mut improvements = 0usize;

    for _iter in 0..cap {
        let idx = rng.gen_range(0..current.len());
        let old_game = current[idx].clone();
        let mut nums = all_numbers.clone(); nums.shuffle(&mut rng);
        let mut new_game: Vec<i32> = nums[..pick_count].to_vec(); new_game.sort();
        current[idx] = new_game;
        let new_score = portfolio_score_ga(&current, &freq_rank, portfolio_size, pick_count, w_frequency, w_diversity, w_coverage);
        let delta = new_score - best_score;
        if delta > 0.0 || rng.gen::<f64>() < (delta / temperature).exp() {
            if new_score > best_score { best = current.clone(); best_score = new_score; improvements += 1; }
        } else {
            current[idx] = old_game;
        }
        temperature *= cooling;
    }

    let all_nums: Vec<i32> = best.iter().flat_map(|g| g.iter().cloned()).collect();
    let frequency_score = if all_nums.is_empty() { 0.0 } else {
        all_nums.iter().map(|n| freq_rank.get(n).cloned().unwrap_or(0.0)).sum::<f64>() / all_nums.len() as f64
    };
    let diversity_score = if best.len() < 2 { 0.0 } else {
        let mut sum = 0.0_f64; let mut cnt = 0usize;
        for i in 0..best.len() { for j in (i+1)..best.len() { sum += jaccard_dist(&best[i], &best[j]); cnt += 1; } }
        if cnt > 0 { sum / cnt as f64 } else { 0.0 }
    };
    let unique_pairs: std::collections::HashSet<(i32,i32)> = best.iter().flat_map(|g| {
        let mut p = vec![]; for i in 0..g.len() { for j in (i+1)..g.len() { p.push((g[i], g[j])); } } p
    }).collect();
    let max_pairs = (portfolio_size as usize * pick_count * (pick_count - 1) / 2).max(1);
    let coverage_score = unique_pairs.len() as f64 / max_pairs as f64;

    Ok(SAResult {
        best_portfolio: best, initial_score, final_score: best_score,
        iterations_run: cap, improvements, frequency_score, diversity_score, coverage_score,
    })
}

// ── Greedy Redundancy Reducer ────────────────────────────
pub fn reduce_redundancy(games: Vec<Vec<i32>>, max_similarity: f64) -> RedundancyResult {
    let original_count = games.len();
    if original_count == 0 { return RedundancyResult { original_count: 0, reduced_count: 0, removed_count: 0, portfolio: vec![], avg_similarity_before: 0.0, avg_similarity_after: 0.0 }; }

    let avg_sim_before = if original_count > 1 {
        let mut sum = 0.0_f64; let mut cnt = 0usize;
        for i in 0..games.len() { for j in (i+1)..games.len() { sum += 1.0 - jaccard_dist(&games[i], &games[j]); cnt += 1; } }
        if cnt > 0 { sum / cnt as f64 } else { 0.0 }
    } else { 0.0 };

    let mut portfolio = games.clone();
    let mut changed = true;
    while changed && portfolio.len() > 1 {
        changed = false;
        let mut to_remove: Option<usize> = None;
        'outer: for i in 0..portfolio.len() {
            for j in (i+1)..portfolio.len() {
                let sim = 1.0 - jaccard_dist(&portfolio[i], &portfolio[j]);
                if sim > max_similarity {
                    to_remove = Some(j); changed = true; break 'outer;
                }
            }
        }
        if let Some(idx) = to_remove { portfolio.remove(idx); }
    }

    let reduced_count = portfolio.len();
    let avg_sim_after = if reduced_count > 1 {
        let mut sum = 0.0_f64; let mut cnt = 0usize;
        for i in 0..portfolio.len() { for j in (i+1)..portfolio.len() { sum += 1.0 - jaccard_dist(&portfolio[i], &portfolio[j]); cnt += 1; } }
        if cnt > 0 { sum / cnt as f64 } else { 0.0 }
    } else { 0.0 };

    RedundancyResult {
        original_count, reduced_count, removed_count: original_count - reduced_count,
        portfolio, avg_similarity_before: avg_sim_before, avg_similarity_after: avg_sim_after,
    }
}

// ── Probability Engine ───────────────────────────────────
fn binom_f64(n: u64, k: u64) -> f64 {
    if k > n { return 0.0; }
    if k == 0 || k == n { return 1.0; }
    let k = k.min(n - k);
    let mut result = 1.0_f64;
    for i in 0..k { result = result * (n - i) as f64 / (i + 1) as f64; }
    result
}

pub fn probability_engine(game_type: &str, pick_count_override: Option<i32>) -> Result<ProbabilityResult, String> {
    let config = registry::get_lottery_config(game_type).ok_or_else(|| format!("Loteria não encontrada: {}", game_type))?;
    let pool = config.numbers_pool_size as u64;
    let drawn = config.default_pick_count as u64;
    let pick = pick_count_override.unwrap_or(config.default_pick_count) as u64;
    let total_combs = binom_f64(pool, pick);
    let min_hits = min_prize_hits(game_type) as u64;

    let max_prize_hits = drawn.min(pick);
    let mut tiers: Vec<PrizeTier> = vec![];
    for hits in min_hits..=max_prize_hits {
        let ways_hit = binom_f64(drawn, hits);
        let ways_miss = binom_f64(pool - drawn, pick - hits);
        let favorable = ways_hit * ways_miss;
        let probability = if total_combs > 0.0 { favorable / total_combs } else { 0.0 };
        let one_in = if probability > 0.0 { 1.0 / probability } else { f64::INFINITY };
        let name = prize_label(game_type, hits as i32, drawn as i32);
        tiers.push(PrizeTier { name, hits_required: hits as i32, probability, one_in, expected_tickets_to_win: one_in });
    }

    Ok(ProbabilityResult {
        game_type: game_type.into(),
        pick_count: pick as i32,
        pool_size: pool as i32,
        total_combinations: total_combs,
        tiers,
    })
}

// ── Portfolio Comparison ─────────────────────────────────
pub fn compare_portfolios(db: &Database, games: &[Vec<i32>], names: &[String], game_type: &str) -> Result<PortfolioCompareResult, String> {
    let all = fetch_contests_with_dates(db, game_type)?;
    let total_contests = all.len() as i64;
    let config = registry::get_lottery_config(game_type);
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6);
    let min_hits = min_prize_hits(game_type);

    let mut strategies: Vec<StrategyCompareEntry> = vec![];
    for (i, game) in games.iter().enumerate() {
        let name = names.get(i).cloned().unwrap_or_else(|| format!("Jogo {}", i + 1));
        let mut prize_count = 0i32; let mut max_hits = 0i32;
        let mut c4 = 0i32; let mut c5 = 0i32; let mut c6 = 0i32;
        for (_, _, drawn) in &all {
            let hits: i32 = game.iter().filter(|n| drawn.contains(n)).count() as i32;
            let lbl = prize_label(game_type, hits, pick_count);
            if hits >= min_hits && is_prize(&lbl) {
                prize_count += 1;
                if hits > max_hits { max_hits = hits; }
                if hits >= 4 { c4 += 1; }
                if hits >= 5 { c5 += 1; }
                if hits >= 6 { c6 += 1; }
            }
        }
        let prize_rate_pct = if total_contests > 0 { prize_count as f64 / total_contests as f64 * 100.0 } else { 0.0 };
        strategies.push(StrategyCompareEntry { name, game: game.clone(), total_contests, prize_count, prize_rate_pct, max_hits, count_4plus: c4, count_5plus: c5, count_6plus: c6 });
    }

    let best_rate = strategies.iter().enumerate().max_by(|(_, a), (_, b)| a.prize_rate_pct.partial_cmp(&b.prize_rate_pct).unwrap_or(std::cmp::Ordering::Equal)).map(|(i, _)| i).unwrap_or(0);
    let best_hits = strategies.iter().enumerate().max_by_key(|(_, s)| s.max_hits).map(|(i, _)| i).unwrap_or(0);

    Ok(PortfolioCompareResult { strategies, best_by_prize_rate_idx: best_rate, best_by_max_hits_idx: best_hits })
}
