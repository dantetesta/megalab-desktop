use crate::db::Database;
use crate::models::{NumberStat, ContestDerivedStats};
use crate::registry;

/// Recalculate stats for ALL game types that have contests
pub fn recalculate_all_stats(db: &Database) -> Result<(), String> {
    // Get all distinct game_types that have contests
    let game_types = db.get_game_types_with_contests()?;
    for gt in &game_types {
        recalculate_stats_for_game(db, gt)?;
    }
    Ok(())
}

/// Recalculate stats for a specific game type
pub fn recalculate_stats_for_game(db: &Database, game_type: &str) -> Result<(), String> {
    let all_contests = db.get_all_sorted_numbers_for_game(game_type)?;
    let total = all_contests.len();
    if total == 0 { return Ok(()); }

    // Determine number pool from registry
    let config = registry::get_lottery_config(game_type);
    let pool_size = config.as_ref().map(|c| c.numbers_pool_size).unwrap_or(60) as i32;
    let num_start: i32 = if pool_size == 100 { 0 } else { 1 };
    let num_end: i32 = if pool_size == 100 { 99 } else { pool_size };

    // Number-level stats
    for num in num_start..=num_end {
        let mut appearances: Vec<usize> = vec![];
        for (i, (_cn, nums)) in all_contests.iter().enumerate() {
            if nums.contains(&num) {
                appearances.push(i);
            }
        }

        let historical_frequency = appearances.len() as i32;

        let last_30_start = if total > 30 { total - 30 } else { 0 };
        let last_60_start = if total > 60 { total - 60 } else { 0 };
        let last_100_start = if total > 100 { total - 100 } else { 0 };

        let recent_30 = appearances.iter().filter(|&&i| i >= last_30_start).count() as i32;
        let recent_60 = appearances.iter().filter(|&&i| i >= last_60_start).count() as i32;
        let recent_100 = appearances.iter().filter(|&&i| i >= last_100_start).count() as i32;

        let current_delay = if let Some(&last_idx) = appearances.last() {
            (total - 1 - last_idx) as i32
        } else {
            total as i32
        };

        let (average_gap, gap_std_dev) = if appearances.len() >= 2 {
            let gaps: Vec<f64> = appearances.windows(2)
                .map(|w| (w[1] - w[0]) as f64)
                .collect();
            let avg = gaps.iter().sum::<f64>() / gaps.len() as f64;
            let variance = gaps.iter().map(|g| (g - avg).powi(2)).sum::<f64>() / gaps.len() as f64;
            (avg, variance.sqrt())
        } else {
            (0.0, 0.0)
        };

        db.upsert_number_stat_for_game(&NumberStat {
            number_value: num,
            historical_frequency,
            recent_frequency_30: recent_30,
            recent_frequency_60: recent_60,
            recent_frequency_100: recent_100,
            current_delay,
            average_gap,
            gap_std_dev,
        }, game_type)?;
    }

    // Contest-level derived stats
    let pick_count = config.as_ref().map(|c| c.default_pick_count).unwrap_or(6) as i32;
    for (i, (cn, nums)) in all_contests.iter().enumerate() {
        let prev_nums: Option<&Vec<i32>> = if i > 0 { Some(&all_contests[i-1].1) } else { None };
        let stats = compute_contest_stats(*cn, nums, prev_nums, pick_count);

        if let Ok(Some(c)) = db.get_contest_by_number_for_game(*cn, game_type) {
            let derived = ContestDerivedStats {
                contest_id: c.id,
                ..stats
            };
            db.upsert_derived_stats(&derived)?;
        }
    }

    Ok(())
}

pub fn compute_contest_stats(_contest_number: i64, nums: &[i32], prev_nums: Option<&Vec<i32>>, pick_count: i32) -> ContestDerivedStats {
    let sum_total: i32 = nums.iter().sum();
    let even_count = nums.iter().filter(|&&n| n % 2 == 0).count() as i32;
    let odd_count = pick_count - even_count;

    let range_01_10 = nums.iter().filter(|&&n| n >= 1 && n <= 10).count() as i32;
    let range_11_20 = nums.iter().filter(|&&n| n >= 11 && n <= 20).count() as i32;
    let range_21_30 = nums.iter().filter(|&&n| n >= 21 && n <= 30).count() as i32;
    let range_31_40 = nums.iter().filter(|&&n| n >= 31 && n <= 40).count() as i32;
    let range_41_50 = nums.iter().filter(|&&n| n >= 41 && n <= 50).count() as i32;
    let range_51_60 = nums.iter().filter(|&&n| n >= 51 && n <= 60).count() as i32;

    let repeated = if let Some(prev) = prev_nums {
        nums.iter().filter(|n| prev.contains(n)).count() as i32
    } else { 0 };

    let mut sorted = nums.to_vec();
    sorted.sort();
    let mut max_seq = 1i32;
    let mut cur_seq = 1i32;
    for i in 1..sorted.len() {
        if sorted[i] == sorted[i-1] + 1 {
            cur_seq += 1;
            if cur_seq > max_seq { max_seq = cur_seq; }
        } else {
            cur_seq = 1;
        }
    }
    let has_sequence = max_seq >= 2;

    let gaps: Vec<f64> = sorted.windows(2).map(|w| (w[1] - w[0]) as f64).collect();
    let dispersion = if !gaps.is_empty() {
        let avg = gaps.iter().sum::<f64>() / gaps.len() as f64;
        let var = gaps.iter().map(|g| (g - avg).powi(2)).sum::<f64>() / gaps.len() as f64;
        var.sqrt()
    } else { 0.0 };

    let parity_sig = format!("{}P{}I", even_count, odd_count);
    let range_sig = format!("{}-{}-{}-{}-{}-{}", range_01_10, range_11_20, range_21_30, range_31_40, range_41_50, range_51_60);

    ContestDerivedStats {
        contest_id: 0,
        sum_total,
        even_count,
        odd_count,
        range_01_10,
        range_11_20,
        range_21_30,
        range_31_40,
        range_41_50,
        range_51_60,
        repeated_from_previous_count: repeated,
        has_sequence,
        max_sequence_length: max_seq,
        dispersion_score: dispersion,
        parity_signature: parity_sig,
        range_signature: range_sig,
    }
}
