#!/usr/bin/env node

/**
 * generate-seed.js
 *
 * Downloads ALL historical contest data from every supported Caixa lottery
 * via the loteriascaixa-api and generates a seed-data.sql file with
 * INSERT OR IGNORE statements for the contests table plus sync_state updates.
 *
 * Usage:  node tools/generate-seed.js
 * Requires: Node 18+ (native fetch)
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE = "https://loteriascaixa-api.herokuapp.com/api";

const LOTTERIES = [
  "megasena",
  "lotofacil",
  "quina",
  "lotomania",
  "maismilionaria",
  "duplasena",
  "timemania",
  "diadesorte",
  "supersete",
];

const BATCH_SIZE = 20; // concurrent requests per lottery
const OUTPUT_FILE = path.join(__dirname, "seed-data.sql");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeSql(value) {
  if (value === null || value === undefined) return "NULL";
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function padTwo(n) {
  return String(n).padStart(2, "0");
}

async function fetchJson(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      // wait a bit before retrying
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

// ---------------------------------------------------------------------------
// Download all contests for one lottery
// ---------------------------------------------------------------------------

async function downloadLottery(lottery) {
  // 1. Get latest contest number
  const latestUrl = `${API_BASE}/${lottery}/latest`;
  let latest;
  try {
    latest = await fetchJson(latestUrl);
  } catch (err) {
    console.error(`  [${lottery}] ERROR fetching latest: ${err.message}`);
    return [];
  }

  const totalContests = latest.concurso;
  console.log(`  [${lottery}] Latest contest: ${totalContests}. Downloading...`);

  const results = [];
  // Include the latest itself
  results.push(latest);

  // Build list of contest numbers to fetch (1 .. totalContests-1, since we already have latest)
  const toFetch = [];
  for (let i = 1; i < totalContests; i++) {
    toFetch.push(i);
  }

  let downloaded = 1; // we already have the latest
  let errors = 0;

  // Process in batches
  for (let batchStart = 0; batchStart < toFetch.length; batchStart += BATCH_SIZE) {
    const batch = toFetch.slice(batchStart, batchStart + BATCH_SIZE);
    const promises = batch.map(async (contestNum) => {
      try {
        const data = await fetchJson(`${API_BASE}/${lottery}/${contestNum}`);
        return data;
      } catch (err) {
        errors++;
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r && r.concurso) {
        results.push(r);
        downloaded++;
      }
    }

    // Progress every 100 contests
    if ((batchStart + BATCH_SIZE) % 100 < BATCH_SIZE || batchStart + BATCH_SIZE >= toFetch.length) {
      const pct = Math.min(100, Math.round(((batchStart + BATCH_SIZE) / toFetch.length) * 100));
      process.stdout.write(
        `\r  [${lottery}] ${downloaded}/${totalContests} downloaded (${pct}%)${errors > 0 ? ` | ${errors} errors` : ""}   `
      );
    }
  }

  console.log(
    `\n  [${lottery}] DONE: ${downloaded} contests downloaded, ${errors} errors.`
  );

  return results;
}

// ---------------------------------------------------------------------------
// Build SQL for one contest record
// ---------------------------------------------------------------------------

function contestToSql(lottery, contest) {
  const gameType = lottery;
  const contestNumber = contest.concurso;
  const contestDate = contest.data || null;
  const location = contest.local || null;

  // dezenasOrdemSorteio may not exist for all lotteries
  const drawOrder = contest.dezenasOrdemSorteio || contest.dezenas || [];
  const dezenas = contest.dezenas || [];

  // Sort numerically and pad to 2 digits
  const sorted = [...dezenas].sort((a, b) => Number(a) - Number(b));
  const sortedPadded = sorted.map((d) => padTwo(Number(d)));

  const numbersDrawOrderJson = JSON.stringify(drawOrder);
  const numbersSortedJson = JSON.stringify(sorted);
  const numbersSortedText = sortedPadded.join(", ");

  const accumulated = contest.acumulou ? 1 : 0;

  const nextContestNumber = contest.proximoConcurso || null;
  const nextContestDate = contest.dataProximoConcurso || null;
  const estimatedNextPrize = contest.valorEstimadoProximoConcurso ?? null;
  const amountCollected = contest.valorArrecadado ?? null;

  const rawJson = JSON.stringify(contest);

  return (
    `INSERT OR IGNORE INTO contests (game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json) VALUES (` +
    `${escapeSql(gameType)}, ` +
    `${contestNumber}, ` +
    `${escapeSql(contestDate)}, ` +
    `${escapeSql(location)}, ` +
    `${escapeSql(numbersDrawOrderJson)}, ` +
    `${escapeSql(numbersSortedJson)}, ` +
    `${escapeSql(numbersSortedText)}, ` +
    `${accumulated}, ` +
    `${nextContestNumber !== null ? nextContestNumber : "NULL"}, ` +
    `${escapeSql(nextContestDate)}, ` +
    `${estimatedNextPrize !== null ? estimatedNextPrize : "NULL"}, ` +
    `${amountCollected !== null ? amountCollected : "NULL"}, ` +
    `${escapeSql(rawJson)}` +
    `);`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== MegaLab Seed Data Generator ===\n");
  console.log(`Lotteries: ${LOTTERIES.join(", ")}`);
  console.log(`Batch size: ${BATCH_SIZE} concurrent requests per lottery`);
  console.log(`Output: ${OUTPUT_FILE}\n`);

  const startTime = Date.now();

  // Download ALL lotteries in parallel
  console.log("Starting parallel download of all lotteries...\n");

  const allResults = await Promise.all(
    LOTTERIES.map(async (lottery) => {
      const contests = await downloadLottery(lottery);
      return { lottery, contests };
    })
  );

  console.log("\n--- Download complete. Generating SQL... ---\n");

  // Build SQL
  const sqlLines = [];
  sqlLines.push("-- MegaLab Seed Data");
  sqlLines.push(`-- Generated at ${new Date().toISOString()}`);
  sqlLines.push("-- This file contains INSERT OR IGNORE statements for the contests table.");
  sqlLines.push("");
  sqlLines.push("BEGIN TRANSACTION;");
  sqlLines.push("");

  let totalRecords = 0;

  for (const { lottery, contests } of allResults) {
    if (contests.length === 0) continue;

    sqlLines.push(`-- ${lottery}: ${contests.length} contests`);

    // Sort by contest number
    contests.sort((a, b) => a.concurso - b.concurso);

    for (const contest of contests) {
      try {
        sqlLines.push(contestToSql(lottery, contest));
        totalRecords++;
      } catch (err) {
        console.error(`  Error building SQL for ${lottery} #${contest.concurso}: ${err.message}`);
      }
    }

    sqlLines.push("");
  }

  // sync_state updates
  sqlLines.push("-- Sync state updates");
  for (const { lottery, contests } of allResults) {
    if (contests.length === 0) continue;
    const lastContest = Math.max(...contests.map((c) => c.concurso));
    sqlLines.push(
      `INSERT OR REPLACE INTO sync_state (game_type, last_imported_contest, last_synced_at, sync_status) VALUES (${escapeSql(lottery)}, ${lastContest}, datetime('now'), 'idle');`
    );
  }

  sqlLines.push("");
  sqlLines.push("COMMIT;");

  // Write file
  fs.writeFileSync(OUTPUT_FILE, sqlLines.join("\n"), "utf-8");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("=== Summary ===");
  for (const { lottery, contests } of allResults) {
    console.log(`  ${lottery}: ${contests.length} contests`);
  }
  console.log(`\nTotal records: ${totalRecords}`);
  console.log(`SQL file: ${OUTPUT_FILE}`);
  console.log(`File size: ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Time elapsed: ${elapsed}s`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
