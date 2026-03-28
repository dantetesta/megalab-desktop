use crate::db::Database;
use crate::models::{GameAnalysis, NumberDetail};

pub fn analyze_game(db: &Database, numbers: &[i32], game_type: &str) -> Result<GameAnalysis, String> {
    let mut sorted = numbers.to_vec();
    sorted.sort();

    let pick_count = sorted.len() as i32;
    let sum_total: i32 = sorted.iter().sum();
    let even_count = sorted.iter().filter(|&&n| n % 2 == 0).count() as i32;
    let odd_count = pick_count - even_count;

    let range_01_10 = sorted.iter().filter(|&&n| n >= 1 && n <= 10).count() as i32;
    let range_11_20 = sorted.iter().filter(|&&n| n >= 11 && n <= 20).count() as i32;
    let range_21_30 = sorted.iter().filter(|&&n| n >= 21 && n <= 30).count() as i32;
    let range_31_40 = sorted.iter().filter(|&&n| n >= 31 && n <= 40).count() as i32;
    let range_41_50 = sorted.iter().filter(|&&n| n >= 41 && n <= 50).count() as i32;
    let range_51_60 = sorted.iter().filter(|&&n| n >= 51 && n <= 60).count() as i32;

    // Sequences
    let mut max_seq = 1i32;
    let mut cur_seq = 1i32;
    let mut consecutive_count = 0i32;
    for i in 1..sorted.len() {
        if sorted[i] == sorted[i-1] + 1 {
            cur_seq += 1;
            consecutive_count += 1;
            if cur_seq > max_seq { max_seq = cur_seq; }
        } else {
            cur_seq = 1;
        }
    }

    // Average distance
    let distances: Vec<f64> = sorted.windows(2).map(|w| (w[1] - w[0]) as f64).collect();
    let avg_distance = if !distances.is_empty() {
        distances.iter().sum::<f64>() / distances.len() as f64
    } else { 0.0 };

    // ── Compute number details from contest data for this game type ──
    let all_contests = db.get_all_sorted_numbers_for_game(game_type)?;
    let total_contests = all_contests.len();

    let number_details: Vec<NumberDetail> = sorted.iter().map(|&num| {
        let mut appearances: Vec<usize> = vec![];
        for (i, (_cn, nums)) in all_contests.iter().enumerate() {
            if nums.contains(&num) {
                appearances.push(i);
            }
        }

        let historical_frequency = appearances.len() as i32;
        let last_30_start = if total_contests > 30 { total_contests - 30 } else { 0 };
        let recent_frequency = appearances.iter().filter(|&&i| i >= last_30_start).count() as i32;
        let current_delay = if let Some(&last_idx) = appearances.last() {
            (total_contests.saturating_sub(1).saturating_sub(last_idx)) as i32
        } else {
            total_contests as i32
        };

        NumberDetail { number: num, historical_frequency, recent_frequency, current_delay }
    }).collect();

    // Repeats from last contest of this game type
    let last_contest = db.get_last_contest_for_game(game_type)?;
    let repeats_from_last = if let Some(lc) = &last_contest {
        sorted.iter().filter(|n| lc.numbers_sorted.contains(n)).count() as i32
    } else { 0 };

    // Exact match count
    let exact_match_count = db.count_exact_number_matches(&sorted)?;

    // Parity/range signature matches from contest data
    let parity_sig = format!("{}P{}I", even_count, odd_count);
    let range_sig = format!("{}-{}-{}-{}-{}-{}", range_01_10, range_11_20, range_21_30, range_31_40, range_41_50, range_51_60);

    let mut same_parity_count = 0i32;
    let mut same_range_count = 0i32;
    for (_cn, nums) in &all_contests {
        let ec = nums.iter().filter(|&&n| n % 2 == 0).count() as i32;
        let oc = nums.len() as i32 - ec;
        if format!("{}P{}I", ec, oc) == parity_sig { same_parity_count += 1; }

        let r1 = nums.iter().filter(|&&n| n >= 1 && n <= 10).count() as i32;
        let r2 = nums.iter().filter(|&&n| n >= 11 && n <= 20).count() as i32;
        let r3 = nums.iter().filter(|&&n| n >= 21 && n <= 30).count() as i32;
        let r4 = nums.iter().filter(|&&n| n >= 31 && n <= 40).count() as i32;
        let r5 = nums.iter().filter(|&&n| n >= 41 && n <= 50).count() as i32;
        let r6 = nums.iter().filter(|&&n| n >= 51 && n <= 60).count() as i32;
        if format!("{}-{}-{}-{}-{}-{}", r1, r2, r3, r4, r5, r6) == range_sig { same_range_count += 1; }
    }

    // Dispersion score
    let dispersion = if !distances.is_empty() {
        let avg = distances.iter().sum::<f64>() / distances.len() as f64;
        let var = distances.iter().map(|d| (d - avg).powi(2)).sum::<f64>() / distances.len() as f64;
        var.sqrt()
    } else { 0.0 };

    // Affinity score (pair frequency based)
    let pair_freqs = db.get_pair_frequencies()?;
    let tc = total_contests as f64;
    let affinity_score = if tc > 0.0 {
        let mut pair_sum = 0.0;
        let mut pair_count = 0;
        for i in 0..sorted.len() {
            for j in (i+1)..sorted.len() {
                let freq = pair_freqs.get(&(sorted[i], sorted[j])).copied().unwrap_or(0);
                pair_sum += freq as f64 / tc;
                pair_count += 1;
            }
        }
        if pair_count > 0 { (pair_sum / pair_count as f64) * 100.0 } else { 0.0 }
    } else { 0.0 };

    // Structural score (0-100) - adaptive to pick count
    let mut structural = 50.0f64;
    let ideal_even_min = (pick_count as f64 * 0.3).ceil() as i32;
    let ideal_even_max = (pick_count as f64 * 0.7).floor() as i32;
    if even_count >= ideal_even_min && even_count <= ideal_even_max { structural += 10.0; }
    let ranges = [range_01_10, range_11_20, range_21_30, range_31_40, range_41_50, range_51_60];
    let max_in_range = *ranges.iter().max().unwrap_or(&0);
    let ideal_max_per_range = (pick_count as f64 / 3.0).ceil() as i32;
    if max_in_range <= ideal_max_per_range { structural += 10.0; }
    if max_seq >= 3 { structural -= 10.0; }
    // Adaptive sum range based on pick count and pool
    let avg_num = 30.0; // rough middle
    let ideal_sum_low = (avg_num * pick_count as f64 * 0.7) as i32;
    let ideal_sum_high = (avg_num * pick_count as f64 * 1.3) as i32;
    if sum_total >= ideal_sum_low && sum_total <= ideal_sum_high { structural += 10.0; }
    if dispersion < 5.0 { structural += 10.0; }
    structural = structural.clamp(0.0, 100.0);

    Ok(GameAnalysis {
        numbers: sorted,
        sum_total,
        even_count,
        odd_count,
        range_01_10,
        range_11_20,
        range_21_30,
        range_31_40,
        range_41_50,
        range_51_60,
        max_sequence_length: max_seq,
        consecutive_count,
        avg_distance,
        number_details,
        repeats_from_last,
        exact_match_count,
        same_parity_count,
        same_range_count,
        dispersion_score: dispersion,
        affinity_score,
        structural_score: structural,
    })
}
