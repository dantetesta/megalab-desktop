use crate::db::Database;
use rand::seq::SliceRandom;
use rand::Rng;
use std::collections::HashSet;

/// Generate a game for ANY lottery given pool_size and pick_count
pub fn generate_game(db: &Database, game_type: &str, strategy_id: &str, pool_size: i32, pick_count: i32) -> Result<Vec<i32>, String> {
    match strategy_id {
        "aleatorio_puro" => random_pure(pool_size, pick_count),
        "frequencia_historica" => frequency_based(db, game_type, pool_size, pick_count, false),
        "frequencia_recente" => frequency_based(db, game_type, pool_size, pick_count, true),
        "atrasadas" => delayed_numbers(db, game_type, pool_size, pick_count),
        "balanceado" => balanced(pool_size, pick_count),
        "hibrido" => hybrid(db, game_type, pool_size, pick_count),
        _ => random_pure(pool_size, pick_count),
    }
}

pub fn generate_portfolio(db: &Database, game_type: &str, count: i32, pool_size: i32, pick_count: i32) -> Result<Vec<Vec<i32>>, String> {
    let mut games: Vec<Vec<i32>> = vec![];
    let mut all_used: HashSet<i32> = HashSet::new();
    let strategies = ["frequencia_historica", "frequencia_recente", "atrasadas", "balanceado", "hibrido", "aleatorio_puro"];

    for i in 0..count {
        let mut best_game: Option<Vec<i32>> = None;
        let mut best_overlap = i32::MAX;
        let strategy = strategies[i as usize % strategies.len()];

        for _ in 0..20 {
            if let Ok(game) = generate_game(db, game_type, strategy, pool_size, pick_count) {
                let overlap = game.iter().filter(|n| all_used.contains(n)).count() as i32;
                if overlap < best_overlap { best_overlap = overlap; best_game = Some(game); }
                if overlap == 0 { break; }
            }
        }
        if let Some(game) = best_game {
            for &n in &game { all_used.insert(n); }
            games.push(game);
        }
    }
    Ok(games)
}

fn random_pure(pool_size: i32, pick_count: i32) -> Result<Vec<i32>, String> {
    let mut rng = rand::thread_rng();
    let start = if pool_size == 100 { 0 } else { 1 }; // Lotomania starts at 0
    let mut pool: Vec<i32> = (start..=(start + pool_size - 1)).collect();
    pool.shuffle(&mut rng);
    let mut nums: Vec<i32> = pool[..pick_count as usize].to_vec();
    nums.sort();
    Ok(nums)
}

fn get_contest_numbers_for_game(db: &Database, game_type: &str) -> Vec<Vec<i32>> {
    db.get_all_sorted_numbers_for_game(game_type).unwrap_or_default()
        .into_iter().map(|(_, nums)| nums).collect()
}

fn frequency_based(db: &Database, game_type: &str, pool_size: i32, pick_count: i32, recent: bool) -> Result<Vec<i32>, String> {
    let contests = get_contest_numbers_for_game(db, game_type);
    if contests.is_empty() { return random_pure(pool_size, pick_count); }

    let start = if pool_size == 100 { 0 } else { 1 };
    let end = start + pool_size - 1;
    let window = if recent { contests.len().min(30) } else { contests.len() };
    let slice = &contests[contests.len().saturating_sub(window)..];

    let mut freq = std::collections::HashMap::new();
    for nums in slice { for &n in nums { *freq.entry(n).or_insert(0i32) += 1; } }

    let max_f = freq.values().copied().max().unwrap_or(1) as f64;
    let weights: Vec<(i32, f64)> = (start..=end).map(|n| {
        let f = *freq.get(&n).unwrap_or(&0) as f64;
        (n, f / max_f + 0.05)
    }).collect();

    Ok(weighted_pick(&weights, pick_count as usize))
}

fn delayed_numbers(db: &Database, game_type: &str, pool_size: i32, pick_count: i32) -> Result<Vec<i32>, String> {
    let contests = get_contest_numbers_for_game(db, game_type);
    if contests.is_empty() { return random_pure(pool_size, pick_count); }

    let start = if pool_size == 100 { 0 } else { 1 };
    let end = start + pool_size - 1;
    let total = contests.len();

    let mut last_seen: std::collections::HashMap<i32, usize> = std::collections::HashMap::new();
    for (i, nums) in contests.iter().enumerate() { for &n in nums { last_seen.insert(n, i); } }

    let weights: Vec<(i32, f64)> = (start..=end).map(|n| {
        let delay = total.saturating_sub(last_seen.get(&n).copied().unwrap_or(0) + 1) as f64;
        (n, delay / total as f64 + 0.05)
    }).collect();

    Ok(weighted_pick(&weights, pick_count as usize))
}

fn balanced(pool_size: i32, pick_count: i32) -> Result<Vec<i32>, String> {
    for _ in 0..500 {
        let game = random_pure(pool_size, pick_count)?;
        let even = game.iter().filter(|&&n| n % 2 == 0).count();
        let ratio = even as f64 / pick_count as f64;
        if ratio >= 0.3 && ratio <= 0.7 { return Ok(game); }
    }
    random_pure(pool_size, pick_count)
}

fn hybrid(db: &Database, game_type: &str, pool_size: i32, pick_count: i32) -> Result<Vec<i32>, String> {
    let contests = get_contest_numbers_for_game(db, game_type);
    if contests.is_empty() { return balanced(pool_size, pick_count); }

    let start = if pool_size == 100 { 0 } else { 1 };
    let end = start + pool_size - 1;
    let total = contests.len();

    let mut freq = std::collections::HashMap::new();
    let mut last_seen = std::collections::HashMap::new();
    let recent_start = total.saturating_sub(30);
    let mut recent_freq = std::collections::HashMap::new();

    for (i, nums) in contests.iter().enumerate() {
        for &n in nums {
            *freq.entry(n).or_insert(0i32) += 1;
            last_seen.insert(n, i);
            if i >= recent_start { *recent_freq.entry(n).or_insert(0i32) += 1; }
        }
    }

    let max_f = freq.values().copied().max().unwrap_or(1) as f64;
    let max_r = recent_freq.values().copied().max().unwrap_or(1) as f64;
    let mut rng = rand::thread_rng();

    for _ in 0..300 {
        let weights: Vec<(i32, f64)> = (start..=end).map(|n| {
            let f = *freq.get(&n).unwrap_or(&0) as f64 / max_f;
            let r = *recent_freq.get(&n).unwrap_or(&0) as f64 / max_r.max(1.0);
            let d = total.saturating_sub(last_seen.get(&n).copied().unwrap_or(0) + 1) as f64 / total as f64;
            let rand_c: f64 = rng.gen::<f64>() * 0.1;
            (n, 0.30 * f + 0.25 * r + 0.20 * d + 0.15 * 0.5 + 0.10 * rand_c + 0.01)
        }).collect();

        let game = weighted_pick(&weights, pick_count as usize);
        let even = game.iter().filter(|&&n| n % 2 == 0).count();
        let ratio = even as f64 / pick_count as f64;
        if ratio >= 0.3 && ratio <= 0.7 { return Ok(game); }
    }
    balanced(pool_size, pick_count)
}

fn weighted_pick(weights: &[(i32, f64)], count: usize) -> Vec<i32> {
    let mut rng = rand::thread_rng();
    let safe_count = count.min(weights.len()); // SAFETY: never pick more than available
    let total_weight: f64 = weights.iter().map(|(_, w)| w).sum();
    if total_weight <= 0.0 || safe_count == 0 {
        // Fallback: just take first N
        return weights.iter().take(safe_count).map(|(n, _)| *n).collect();
    }
    let mut selected: HashSet<i32> = HashSet::new();
    let mut attempts = 0u32;
    let max_attempts = (safe_count as u32) * 200;

    while selected.len() < safe_count && attempts < max_attempts {
        attempts += 1;
        let mut r = rng.gen::<f64>() * total_weight;
        for (num, weight) in weights {
            r -= weight;
            if r <= 0.0 { selected.insert(*num); break; }
        }
    }
    // If still not enough (extremely unlikely), fill randomly
    if selected.len() < safe_count {
        for (num, _) in weights {
            if selected.len() >= safe_count { break; }
            selected.insert(*num);
        }
    }
    let mut result: Vec<i32> = selected.into_iter().collect();
    result.sort();
    result
}

pub fn get_strategy_label(id: &str) -> &str {
    match id {
        "aleatorio_puro" => "Aleatório puro",
        "frequencia_historica" => "Frequência histórica",
        "frequencia_recente" => "Frequência recente",
        "atrasadas" => "Dezenas atrasadas",
        "balanceado" => "Balanceado",
        "hibrido" => "Híbrido",
        "carteira_inteligente" => "Carteira inteligente",
        _ => "Manual",
    }
}
