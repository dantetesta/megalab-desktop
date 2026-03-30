use crate::db::Database;
use rand::seq::SliceRandom;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

// ═══ LotoCore Engine v4.0 ═══

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LotoCoreConfig {
    pub game_type: String,
    pub pick_count: i32,
    pub pool_size: i32,
    pub num_games: i32,
    pub simulation_depth: i32,
    pub mode: String,
    pub weights: AlgorithmWeights,
    pub enabled_algorithms: EnabledAlgorithms,
    #[serde(default)]
    pub xray_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlgorithmWeights {
    pub frequency: f64,
    pub entropy: f64,
    pub patterns: f64,
    pub genetic: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EnabledAlgorithms {
    pub monte_carlo: bool,
    pub frequency: bool,
    pub delay: bool,
    pub entropy: bool,
    pub pattern_avoidance: bool,
    pub bayesian: bool,
    pub markov: bool,
    pub genetic: bool,
    pub annealing: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedGame {
    pub numbers: Vec<i32>,
    pub score: f64,
    pub algorithm_scores: AlgorithmScores,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AlgorithmScores {
    pub entropy: f64,
    pub frequency: f64,
    pub delay: f64,
    pub bayesian: f64,
    pub markov: f64,
    pub pattern: f64,
    pub balance: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LotoCoreResult {
    pub games: Vec<GeneratedGame>,
    pub generation_time_ms: u64,
    pub algorithms_used: Vec<String>,
    pub total_candidates_evaluated: u64,
    pub xray: Option<XRayPipelineSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XRayStep {
    pub step_index: u32,
    pub total_steps: u32,
    pub algorithm_name: String,
    pub algorithm_key: String,
    pub status: String,
    pub duration_ms: u64,
    pub candidates_generated: u64,
    pub candidates_sample: Vec<XRaySample>,
    pub score_min: f64,
    pub score_max: f64,
    pub score_avg: f64,
    pub numbers_heatmap: Vec<(i32, u32)>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XRaySample {
    pub numbers: Vec<i32>,
    pub score: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct XRayPipelineSummary {
    pub steps: Vec<XRayStep>,
    pub total_duration_ms: u64,
    pub total_candidates: u64,
    pub final_count: u64,
}

struct HistoricalData {
    all_contests: Vec<Vec<i32>>,
    total_contests: usize,
    freq_map: HashMap<i32, f64>,
    delay_map: HashMap<i32, i32>,
    transition_matrix: HashMap<i32, HashMap<i32, f64>>,
    bayesian_weights: HashMap<i32, f64>,
}

// ═══ Main entry point ═══

pub fn generate_lotocore(db: &Database, config: &LotoCoreConfig) -> Result<LotoCoreResult, String> {
    let start = std::time::Instant::now();
    let pool_start = if config.pool_size == 100 { 0 } else { 1 };
    let pool_end = if config.pool_size == 100 { 99 } else { config.pool_size };
    let pool: Vec<i32> = (pool_start..=pool_end).collect();
    let hist = precompute_historical(db, &config.game_type, &pool)?;

    let mut algorithms_used = Vec::new();
    let ea = &config.enabled_algorithms;
    if ea.monte_carlo { algorithms_used.push("Monte Carlo".into()); }
    if ea.frequency { algorithms_used.push("Frequência".into()); }
    if ea.delay { algorithms_used.push("Atraso".into()); }
    if ea.entropy { algorithms_used.push("Entropia".into()); }
    if ea.pattern_avoidance { algorithms_used.push("Anti-Padrão".into()); }
    if ea.bayesian { algorithms_used.push("Bayesiano".into()); }
    if ea.markov { algorithms_used.push("Markov".into()); }
    if ea.genetic { algorithms_used.push("Genético".into()); }
    if ea.annealing { algorithms_used.push("Simulated Annealing".into()); }

    let mut total_evaluated: u64 = 0;
    let candidates = generate_candidates(config, &pool, &hist, &mut total_evaluated)?;

    let mut sorted = candidates;
    sorted.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));

    let mut final_games: Vec<GeneratedGame> = Vec::new();
    let mut seen: HashSet<Vec<i32>> = HashSet::new();
    for game in sorted {
        if seen.insert(game.numbers.clone()) {
            final_games.push(game);
            if final_games.len() >= config.num_games as usize { break; }
        }
    }

    Ok(LotoCoreResult {
        games: final_games,
        generation_time_ms: start.elapsed().as_millis() as u64,
        algorithms_used,
        total_candidates_evaluated: total_evaluated,
        xray: None,
    })
}

pub fn generate_lotocore_xray(db: &Database, config: &LotoCoreConfig) -> Result<LotoCoreResult, String> {
    let start = std::time::Instant::now();
    let pool_start = if config.pool_size == 100 { 0 } else { 1 };
    let pool_end = if config.pool_size == 100 { 99 } else { config.pool_size };
    let pool: Vec<i32> = (pool_start..=pool_end).collect();
    let hist = precompute_historical(db, &config.game_type, &pool)?;

    let mut rng = rand::thread_rng();
    let ea = &config.enabled_algorithms;
    let n = config.num_games.max(1) as usize;

    let algorithms: Vec<(&str, &str, bool)> = vec![
        ("Frequencia", "frequency", ea.frequency),
        ("Atraso", "delay", ea.delay),
        ("Tendencia Recente", "bayesian", ea.bayesian),
        ("Analise de Sequencia", "markov", ea.markov),
        ("Simulacao Massiva", "monte_carlo", ea.monte_carlo),
        ("Distribuicao Inteligente", "entropy", ea.entropy),
        ("Evitar Padroes", "pattern_avoidance", ea.pattern_avoidance),
        ("Evolucao de Jogos", "genetic", ea.genetic),
        ("Otimizacao Final", "annealing", ea.annealing),
    ];

    let total_steps = algorithms.iter().filter(|(_, _, e)| *e).count() as u32;
    let mut step_index = 0u32;
    let mut all_candidates: Vec<GeneratedGame> = Vec::new();
    let mut xray_steps: Vec<XRayStep> = Vec::new();
    let mut total_evaluated: u64 = 0;
    let mut algorithms_used: Vec<String> = Vec::new();

    for (name, key, enabled) in &algorithms {
        if !*enabled {
            continue;
        }
        algorithms_used.push(name.to_string());
        let step_start = std::time::Instant::now();
        let mut step_candidates: Vec<GeneratedGame> = Vec::new();
        let mut step_eval: u64 = 0;

        match *key {
            "frequency" => {
                for _ in 0..n {
                    let nums = gen_freq(&pool, config.pick_count as usize, &hist, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "delay" => {
                for _ in 0..n {
                    let nums = gen_delay(&pool, config.pick_count as usize, &hist, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "bayesian" => {
                for _ in 0..n {
                    let nums = gen_bayesian(&pool, config.pick_count as usize, &hist, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "markov" => {
                for _ in 0..n {
                    let nums = gen_markov(&pool, config.pick_count as usize, &hist, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "monte_carlo" => {
                let mc_iter = config.simulation_depth.max(100) as usize;
                for _ in 0..mc_iter {
                    let nums = rand_combo(&pool, config.pick_count as usize, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
                // Sort and keep top n
                step_candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
                step_candidates.truncate(n);
            }
            "entropy" | "pattern_avoidance" => {
                for _ in 0..n {
                    let nums = rand_combo(&pool, config.pick_count as usize, &mut rng);
                    step_eval += 1;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "genetic" => {
                let gs = run_genetic(config, &pool, &hist, &mut rng)?;
                step_eval += (gs.len() * 50) as u64;
                for nums in gs {
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            "annealing" => {
                for _ in 0..n.min(4) {
                    let nums = run_annealing(config, &pool, &hist, &mut rng)?;
                    step_eval += 200;
                    let s = score_game(&nums, config, &hist);
                    step_candidates.push(GeneratedGame {
                        numbers: nums,
                        score: composite_score(&s, &config.weights),
                        algorithm_scores: s,
                    });
                }
            }
            _ => {}
        }

        let duration_ms = step_start.elapsed().as_millis() as u64;

        // Compute score stats
        let (score_min, score_max, score_avg) = if step_candidates.is_empty() {
            (0.0, 0.0, 0.0)
        } else {
            let min = step_candidates.iter().map(|g| g.score).fold(f64::INFINITY, f64::min);
            let max = step_candidates.iter().map(|g| g.score).fold(f64::NEG_INFINITY, f64::max);
            let avg = step_candidates.iter().map(|g| g.score).sum::<f64>() / step_candidates.len() as f64;
            (min, max, avg)
        };

        // Build heatmap
        let mut heatmap: HashMap<i32, u32> = HashMap::new();
        for game in &step_candidates {
            for &num in &game.numbers {
                *heatmap.entry(num).or_insert(0) += 1;
            }
        }
        let mut heatmap_vec: Vec<(i32, u32)> = heatmap.into_iter().collect();
        heatmap_vec.sort_by(|a, b| b.1.cmp(&a.1));
        heatmap_vec.truncate(20);

        // Sample top 3 candidates
        let mut sorted_step = step_candidates.clone();
        sorted_step.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        let candidates_sample: Vec<XRaySample> = sorted_step.iter().take(3).map(|g| XRaySample {
            numbers: g.numbers.clone(),
            score: g.score,
        }).collect();

        let candidates_generated = step_candidates.len() as u64;
        total_evaluated += step_eval;

        xray_steps.push(XRayStep {
            step_index,
            total_steps,
            algorithm_name: name.to_string(),
            algorithm_key: key.to_string(),
            status: "completed".to_string(),
            duration_ms,
            candidates_generated,
            candidates_sample,
            score_min,
            score_max,
            score_avg,
            numbers_heatmap: heatmap_vec,
            message: format!("{} gerou {} candidatos em {}ms", name, candidates_generated, duration_ms),
        });

        all_candidates.extend(step_candidates);
        step_index += 1;
    }

    // Sort, deduplicate, take top N
    all_candidates.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    let mut final_games: Vec<GeneratedGame> = Vec::new();
    let mut seen: HashSet<Vec<i32>> = HashSet::new();
    for game in all_candidates {
        if seen.insert(game.numbers.clone()) {
            final_games.push(game);
            if final_games.len() >= n {
                break;
            }
        }
    }

    let total_duration_ms = start.elapsed().as_millis() as u64;
    let final_count = final_games.len() as u64;

    let xray_summary = XRayPipelineSummary {
        steps: xray_steps,
        total_duration_ms,
        total_candidates: total_evaluated,
        final_count,
    };

    Ok(LotoCoreResult {
        games: final_games,
        generation_time_ms: total_duration_ms,
        algorithms_used,
        total_candidates_evaluated: total_evaluated,
        xray: Some(xray_summary),
    })
}

fn precompute_historical(db: &Database, game_type: &str, pool: &[i32]) -> Result<HistoricalData, String> {
    let raw = db.get_all_sorted_numbers_for_game(game_type).unwrap_or_default();
    let all_contests: Vec<Vec<i32>> = raw.into_iter().map(|(_, nums)| nums).collect();
    let total = all_contests.len();

    let mut freq_count: HashMap<i32, u32> = HashMap::new();
    for contest in &all_contests {
        for &n in contest { *freq_count.entry(n).or_insert(0) += 1; }
    }
    let freq_map: HashMap<i32, f64> = pool.iter().map(|&n| {
        (n, if total > 0 { *freq_count.get(&n).unwrap_or(&0) as f64 / total as f64 } else { 0.0 })
    }).collect();

    let mut last_seen: HashMap<i32, usize> = HashMap::new();
    for (i, contest) in all_contests.iter().enumerate() {
        for &n in contest { last_seen.insert(n, i); }
    }
    let delay_map: HashMap<i32, i32> = pool.iter().map(|&n| {
        (n, match last_seen.get(&n) { Some(&idx) => (total.saturating_sub(1).saturating_sub(idx)) as i32, None => total as i32 })
    }).collect();

    let mut transitions: HashMap<i32, HashMap<i32, u32>> = HashMap::new();
    let mut from_counts: HashMap<i32, u32> = HashMap::new();
    for w in all_contests.windows(2) {
        for &pi in &w[0] {
            *from_counts.entry(pi).or_insert(0) += 1;
            for &ci in &w[1] { *transitions.entry(pi).or_default().entry(ci).or_insert(0) += 1; }
        }
    }
    let transition_matrix: HashMap<i32, HashMap<i32, f64>> = transitions.into_iter().map(|(from, to_map)| {
        let t = *from_counts.get(&from).unwrap_or(&1) as f64;
        (from, to_map.into_iter().map(|(to, c)| (to, c as f64 / t)).collect())
    }).collect();

    let recent_start = if total > 30 { total - 30 } else { 0 };
    let mut recent_count: HashMap<i32, u32> = HashMap::new();
    for contest in &all_contests[recent_start..] {
        for &n in contest { *recent_count.entry(n).or_insert(0) += 1; }
    }
    let rt = all_contests[recent_start..].len().max(1) as f64;
    let prior = 1.0 / pool.len().max(1) as f64;
    let bayesian_weights: HashMap<i32, f64> = pool.iter().map(|&n| {
        (n, prior * (*recent_count.get(&n).unwrap_or(&0) as f64 / rt + 0.01))
    }).collect();

    Ok(HistoricalData { all_contests, total_contests: total, freq_map, delay_map, transition_matrix, bayesian_weights })
}

fn generate_candidates(config: &LotoCoreConfig, pool: &[i32], hist: &HistoricalData, total_evaluated: &mut u64) -> Result<Vec<GeneratedGame>, String> {
    let mut rng = rand::thread_rng();
    let ea = &config.enabled_algorithms;
    let n = config.num_games.max(1) as usize;
    let mut candidates: Vec<GeneratedGame> = Vec::new();

    if ea.genetic {
        let gs = run_genetic(config, pool, hist, &mut rng)?;
        *total_evaluated += (gs.len() * 50) as u64;
        for nums in gs {
            let scores = score_game(&nums, config, hist);
            candidates.push(GeneratedGame { numbers: nums, score: composite_score(&scores, &config.weights), algorithm_scores: scores });
        }
    }
    if ea.annealing {
        for _ in 0..n.min(4) {
            let nums = run_annealing(config, pool, hist, &mut rng)?;
            *total_evaluated += 200;
            let scores = score_game(&nums, config, hist);
            candidates.push(GeneratedGame { numbers: nums, score: composite_score(&scores, &config.weights), algorithm_scores: scores });
        }
    }
    if ea.frequency {
        for _ in 0..n { let nums = gen_freq(pool, config.pick_count as usize, hist, &mut rng); *total_evaluated += 1; let s = score_game(&nums, config, hist); candidates.push(GeneratedGame { numbers: nums, score: composite_score(&s, &config.weights), algorithm_scores: s }); }
    }
    if ea.delay {
        for _ in 0..n { let nums = gen_delay(pool, config.pick_count as usize, hist, &mut rng); *total_evaluated += 1; let s = score_game(&nums, config, hist); candidates.push(GeneratedGame { numbers: nums, score: composite_score(&s, &config.weights), algorithm_scores: s }); }
    }
    if ea.bayesian {
        for _ in 0..n { let nums = gen_bayesian(pool, config.pick_count as usize, hist, &mut rng); *total_evaluated += 1; let s = score_game(&nums, config, hist); candidates.push(GeneratedGame { numbers: nums, score: composite_score(&s, &config.weights), algorithm_scores: s }); }
    }
    if ea.markov {
        for _ in 0..n { let nums = gen_markov(pool, config.pick_count as usize, hist, &mut rng); *total_evaluated += 1; let s = score_game(&nums, config, hist); candidates.push(GeneratedGame { numbers: nums, score: composite_score(&s, &config.weights), algorithm_scores: s }); }
    }

    let mc_iter = config.simulation_depth.max(100) as usize;
    let mc_remaining = mc_iter.saturating_sub(candidates.len());
    if ea.monte_carlo || candidates.is_empty() {
        for _ in 0..mc_remaining {
            let nums = rand_combo(pool, config.pick_count as usize, &mut rng);
            *total_evaluated += 1;
            let s = score_game(&nums, config, hist);
            candidates.push(GeneratedGame { numbers: nums, score: composite_score(&s, &config.weights), algorithm_scores: s });
        }
    }

    Ok(candidates)
}

fn rand_combo(pool: &[i32], pick: usize, rng: &mut impl Rng) -> Vec<i32> {
    let mut s = pool.to_vec(); s.shuffle(rng);
    let mut r: Vec<i32> = s[..pick.min(s.len())].to_vec(); r.sort(); r
}

fn weighted_sel(pool: &[i32], pick: usize, rng: &mut impl Rng, wf: impl Fn(i32) -> f64) -> Vec<i32> {
    let mut w: Vec<(i32, f64)> = pool.iter().map(|&n| (n, wf(n))).collect();
    w.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let top = (pick * 3).min(w.len());
    let mut cands = w[..top].to_vec();
    let mut sel: Vec<i32> = Vec::with_capacity(pick);
    while sel.len() < pick && !cands.is_empty() {
        let tw: f64 = cands.iter().map(|(_, w)| w.max(0.001)).sum();
        let mut r = rng.gen::<f64>() * tw;
        let mut idx = 0;
        for (i, (_, w)) in cands.iter().enumerate() { r -= w.max(0.001); if r <= 0.0 { idx = i; break; } }
        let (n, _) = cands.remove(idx); sel.push(n);
    }
    sel.sort(); sel
}

fn gen_freq(pool: &[i32], pick: usize, hist: &HistoricalData, rng: &mut impl Rng) -> Vec<i32> {
    // Pre-compute weights with noise to avoid borrow conflicts
    let noise: Vec<f64> = (0..pool.len()).map(|_| rng.gen::<f64>() * 0.05).collect();
    let freq = hist.freq_map.clone();
    weighted_sel(pool, pick, rng, |n| *freq.get(&n).unwrap_or(&0.01) + noise[n as usize % noise.len()])
}
fn gen_delay(pool: &[i32], pick: usize, hist: &HistoricalData, rng: &mut impl Rng) -> Vec<i32> {
    let noise: Vec<f64> = (0..pool.len()).map(|_| rng.gen::<f64>() * 2.0).collect();
    let delays = hist.delay_map.clone();
    weighted_sel(pool, pick, rng, |n| (*delays.get(&n).unwrap_or(&0) as f64).sqrt() + noise[n as usize % noise.len()])
}
fn gen_bayesian(pool: &[i32], pick: usize, hist: &HistoricalData, rng: &mut impl Rng) -> Vec<i32> {
    let noise: Vec<f64> = (0..pool.len()).map(|_| rng.gen::<f64>() * 0.005).collect();
    let bw = hist.bayesian_weights.clone();
    weighted_sel(pool, pick, rng, |n| *bw.get(&n).unwrap_or(&0.01) + noise[n as usize % noise.len()])
}

fn gen_markov(pool: &[i32], pick: usize, hist: &HistoricalData, rng: &mut impl Rng) -> Vec<i32> {
    if hist.all_contests.is_empty() { return rand_combo(pool, pick, rng); }
    let last = hist.all_contests.last().unwrap();
    let pool_set: HashSet<i32> = pool.iter().copied().collect();
    let mut sel: HashSet<i32> = HashSet::new();
    if let Some(&seed) = last.choose(rng) { sel.insert(seed); }
    let mut attempts = 0;
    while sel.len() < pick && attempts < pick * 10 {
        attempts += 1;
        let current: Vec<i32> = sel.iter().copied().collect();
        let &anchor = current.choose(rng).unwrap_or(&pool[0]);
        if let Some(tr) = hist.transition_matrix.get(&anchor) {
            let cs: Vec<(i32, f64)> = tr.iter().filter(|(&n, _)| pool_set.contains(&n) && !sel.contains(&n)).map(|(&n, &p)| (n, p)).collect();
            if !cs.is_empty() {
                let tw: f64 = cs.iter().map(|(_, w)| w).sum();
                let mut r = rng.gen::<f64>() * tw;
                for (n, w) in &cs { r -= w; if r <= 0.0 { sel.insert(*n); break; } }
                continue;
            }
        }
        let av: Vec<i32> = pool.iter().filter(|n| !sel.contains(n)).copied().collect();
        if let Some(&n) = av.choose(rng) { sel.insert(n); }
    }
    let mut av: Vec<i32> = pool.iter().filter(|n| !sel.contains(n)).copied().collect();
    av.shuffle(rng);
    for &n in &av { if sel.len() >= pick { break; } sel.insert(n); }
    let mut r: Vec<i32> = sel.into_iter().collect(); r.sort(); r.truncate(pick); r
}

// ═══ Genetic Algorithm ═══

fn run_genetic(config: &LotoCoreConfig, pool: &[i32], hist: &HistoricalData, rng: &mut impl Rng) -> Result<Vec<Vec<i32>>, String> {
    let pop_size = 50; let gens = 40; let mut_rate = 0.15; let pick = config.pick_count as usize;
    let mut pop: Vec<Vec<i32>> = (0..pop_size).map(|_| rand_combo(pool, pick, rng)).collect();

    for _ in 0..gens {
        let mut scored: Vec<(Vec<i32>, f64)> = pop.iter().map(|nums| {
            let s = score_game(nums, config, hist);
            (nums.clone(), composite_score(&s, &config.weights))
        }).collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));

        let mut new_pop: Vec<Vec<i32>> = scored.iter().take(5).map(|(g, _)| g.clone()).collect();
        while new_pop.len() < pop_size {
            let p1 = tourn(&scored, rng); let p2 = tourn(&scored, rng);
            let mut child = xover(&p1, &p2, pick, pool, rng);
            if rng.gen::<f64>() < mut_rate { mutate(&mut child, pool, rng); }
            child.sort(); child.dedup();
            while child.len() < pick {
                let av: Vec<i32> = pool.iter().filter(|n| !child.contains(n)).copied().collect();
                if let Some(&n) = av.choose(rng) { child.push(n); } else { break; }
            }
            child.sort(); child.truncate(pick); new_pop.push(child);
        }
        pop = new_pop;
    }

    let mut final_s: Vec<(Vec<i32>, f64)> = pop.iter().map(|nums| {
        let s = score_game(nums, config, hist);
        (nums.clone(), composite_score(&s, &config.weights))
    }).collect();
    final_s.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    Ok(final_s.into_iter().take(config.num_games as usize).map(|(g, _)| g).collect())
}

fn tourn(scored: &[(Vec<i32>, f64)], rng: &mut impl Rng) -> Vec<i32> {
    let mut best: Option<&(Vec<i32>, f64)> = None;
    for _ in 0..3 { let c = &scored[rng.gen_range(0..scored.len())]; if best.is_none() || c.1 > best.unwrap().1 { best = Some(c); } }
    best.unwrap().0.clone()
}

fn xover(p1: &[i32], p2: &[i32], pick: usize, pool: &[i32], rng: &mut impl Rng) -> Vec<i32> {
    let mut s: HashSet<i32> = HashSet::new();
    for &n in p1.iter().take(pick / 2) { s.insert(n); }
    for &n in p2 { if s.len() >= pick { break; } s.insert(n); }
    let mut av: Vec<i32> = pool.iter().filter(|n| !s.contains(n)).copied().collect();
    av.shuffle(rng);
    for &n in &av { if s.len() >= pick { break; } s.insert(n); }
    let mut r: Vec<i32> = s.into_iter().collect(); r.sort(); r.truncate(pick); r
}

fn mutate(game: &mut Vec<i32>, pool: &[i32], rng: &mut impl Rng) {
    if game.is_empty() { return; }
    let idx = rng.gen_range(0..game.len());
    let gs: HashSet<i32> = game.iter().copied().collect();
    let av: Vec<i32> = pool.iter().filter(|n| !gs.contains(n)).copied().collect();
    if let Some(&r) = av.choose(rng) { game[idx] = r; }
}

// ═══ Simulated Annealing ═══

fn run_annealing(config: &LotoCoreConfig, pool: &[i32], hist: &HistoricalData, rng: &mut impl Rng) -> Result<Vec<i32>, String> {
    let pick = config.pick_count as usize;
    let mut current = rand_combo(pool, pick, rng);
    let mut cs = composite_score(&score_game(&current, config, hist), &config.weights);
    let mut best = current.clone(); let mut bs = cs;
    let mut temp = 1.0f64;

    for _ in 0..200 {
        let mut neighbor = current.clone();
        mutate(&mut neighbor, pool, rng); neighbor.sort();
        let ns = composite_score(&score_game(&neighbor, config, hist), &config.weights);
        let delta = ns - cs;
        if delta > 0.0 || rng.gen::<f64>() < (delta / temp).exp() { current = neighbor; cs = ns; }
        if cs > bs { best = current.clone(); bs = cs; }
        temp *= 0.97;
    }
    Ok(best)
}

// ═══ Scoring ═══

fn score_game(numbers: &[i32], config: &LotoCoreConfig, hist: &HistoricalData) -> AlgorithmScores {
    let ea = &config.enabled_algorithms;
    AlgorithmScores {
        entropy: if ea.entropy { entropy_score(numbers, config.pool_size) } else { 0.5 },
        frequency: if ea.frequency { frequency_score(numbers, hist) } else { 0.5 },
        delay: if ea.delay { delay_score(numbers, hist) } else { 0.5 },
        bayesian: if ea.bayesian { bayesian_score(numbers, hist) } else { 0.5 },
        markov: if ea.markov { markov_score(numbers, hist) } else { 0.5 },
        pattern: if ea.pattern_avoidance { pattern_score(numbers) } else { 0.5 },
        balance: balance_score(numbers, config.pool_size),
    }
}

fn composite_score(s: &AlgorithmScores, w: &AlgorithmWeights) -> f64 {
    let tw = w.frequency + w.entropy + w.patterns + w.genetic + 1.0;
    if tw == 0.0 { return 0.5; }
    let ws = s.frequency * w.frequency + s.entropy * w.entropy + s.pattern * w.patterns + s.balance * 1.0 + s.delay * (w.frequency * 0.5) + s.bayesian * (w.genetic * 0.5) + s.markov * (w.genetic * 0.5);
    (ws / tw).clamp(0.0, 1.0)
}

fn entropy_score(numbers: &[i32], pool_size: i32) -> f64 {
    let pick = numbers.len() as f64; let pool = pool_size as f64;
    let gaps: Vec<f64> = numbers.windows(2).map(|w| (w[1] - w[0]) as f64).collect();
    if gaps.is_empty() { return 0.5; }
    let mean = gaps.iter().sum::<f64>() / gaps.len() as f64;
    let var: f64 = gaps.iter().map(|g| (g - mean).powi(2)).sum::<f64>() / gaps.len() as f64;
    let cv = if mean > 0.0 { var.sqrt() / mean } else { 1.0 };
    let spread = (1.0 - cv).clamp(0.0, 1.0);
    let ideal = pool / pick;
    let dev = (mean - ideal).abs() / ideal;
    let bonus = (1.0 - dev).clamp(0.0, 1.0);
    ((spread + bonus) / 2.0).clamp(0.0, 1.0)
}

fn frequency_score(numbers: &[i32], hist: &HistoricalData) -> f64 {
    if hist.total_contests == 0 { return 0.5; }
    let avg: f64 = numbers.iter().map(|n| *hist.freq_map.get(n).unwrap_or(&0.0)).sum::<f64>() / numbers.len().max(1) as f64;
    (avg * 3.0).clamp(0.0, 1.0)
}

fn delay_score(numbers: &[i32], hist: &HistoricalData) -> f64 {
    if hist.total_contests == 0 { return 0.5; }
    let delays: Vec<f64> = numbers.iter().map(|n| *hist.delay_map.get(n).unwrap_or(&0) as f64).collect();
    let fresh = delays.iter().filter(|&&d| d < 5.0).count() as f64;
    let delayed = delays.iter().filter(|&&d| d > 15.0).count() as f64;
    let t = delays.len() as f64;
    (fresh / t * 0.6 + delayed / t * 0.4).clamp(0.0, 1.0)
}

fn bayesian_score(numbers: &[i32], hist: &HistoricalData) -> f64 {
    let avg: f64 = numbers.iter().map(|n| *hist.bayesian_weights.get(n).unwrap_or(&0.01)).sum::<f64>() / numbers.len().max(1) as f64;
    (avg * 50.0).clamp(0.0, 1.0)
}

fn markov_score(numbers: &[i32], hist: &HistoricalData) -> f64 {
    if hist.all_contests.is_empty() { return 0.5; }
    let last = hist.all_contests.last().unwrap();
    let mut tp = 0.0f64; let mut c = 0u32;
    for &prev in last {
        if let Some(tr) = hist.transition_matrix.get(&prev) {
            for &n in numbers { if let Some(&p) = tr.get(&n) { tp += p; c += 1; } }
        }
    }
    if c == 0 { return 0.5; }
    (tp / c as f64 * 10.0).clamp(0.0, 1.0)
}

fn pattern_score(numbers: &[i32]) -> f64 {
    if numbers.is_empty() { return 0.5; }
    let pick = numbers.len() as f64;
    let mut penalty = 0.0f64;
    let mut max_seq = 1i32; let mut cur = 1i32;
    for w in numbers.windows(2) { if w[1] == w[0] + 1 { cur += 1; if cur > max_seq { max_seq = cur; } } else { cur = 1; } }
    if max_seq >= 4 { penalty += 0.3; } else if max_seq >= 3 { penalty += 0.15; }
    let even = numbers.iter().filter(|&&n| n % 2 == 0).count() as f64 / pick;
    if even < 0.15 || even > 0.85 { penalty += 0.25; } else if even < 0.25 || even > 0.75 { penalty += 0.1; }
    let third = numbers.last().unwrap_or(&60) / 3;
    let low = numbers.iter().filter(|&&n| n <= third).count() as f64 / pick;
    let high = numbers.iter().filter(|&&n| n > third * 2).count() as f64 / pick;
    if low > 0.8 || high > 0.8 { penalty += 0.2; }
    (1.0 - penalty).clamp(0.0, 1.0)
}

fn balance_score(numbers: &[i32], pool_size: i32) -> f64 {
    if numbers.is_empty() { return 0.5; }
    let pick = numbers.len() as f64; let pool = pool_size as f64;
    let ideal_gap = pool / (pick + 1.0);
    let gaps: Vec<f64> = numbers.windows(2).map(|w| (w[1] - w[0]) as f64).collect();
    if gaps.is_empty() { return 0.5; }
    let dev: f64 = gaps.iter().map(|g| (g - ideal_gap).abs() / ideal_gap).sum::<f64>() / gaps.len() as f64;
    let even = numbers.iter().filter(|&&n| n % 2 == 0).count() as f64;
    let parity = 1.0 - (even / pick - 0.5).abs() * 2.0;
    let sum: f64 = numbers.iter().map(|&n| n as f64).sum();
    let exp_sum = pick * (pool + 1.0) / 2.0 / pool * pool;
    let sum_s = (1.0 - (sum - exp_sum).abs() / exp_sum.max(1.0)).clamp(0.0, 1.0);
    let spread = (1.0 - dev).clamp(0.0, 1.0);
    (spread * 0.4 + parity * 0.3 + sum_s * 0.3).clamp(0.0, 1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entropy() {
        let good = vec![5, 15, 25, 35, 45, 55];
        let bad = vec![1, 2, 3, 4, 5, 6];
        assert!(entropy_score(&good, 60) > entropy_score(&bad, 60));
    }

    #[test]
    fn test_pattern() {
        let seq = vec![1, 2, 3, 4, 5, 6];
        let spread = vec![3, 15, 22, 38, 47, 56];
        assert!(pattern_score(&spread) > pattern_score(&seq));
    }

    #[test]
    fn test_balance() {
        let bal = vec![5, 15, 25, 35, 45, 55];
        let clust = vec![1, 2, 3, 58, 59, 60];
        assert!(balance_score(&bal, 60) > balance_score(&clust, 60));
    }

    #[test]
    fn test_rand_combo() {
        let pool: Vec<i32> = (1..=60).collect();
        let mut rng = rand::thread_rng();
        let c = rand_combo(&pool, 6, &mut rng);
        assert_eq!(c.len(), 6);
        assert!(c.windows(2).all(|w| w[0] < w[1]));
    }
}
