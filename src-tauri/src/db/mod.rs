use rusqlite::{Connection, params};
use std::path::PathBuf;
use std::sync::Mutex;
use crate::models::*;

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("megalab.db");
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        let db = Database { conn: Mutex::new(conn) };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL DEFAULT 'megasena',
                last_imported_contest INTEGER DEFAULT 0,
                last_synced_at TEXT,
                sync_status TEXT DEFAULT 'idle',
                last_error TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS contests (
                id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL DEFAULT 'megasena',
                contest_number INTEGER NOT NULL UNIQUE,
                contest_date TEXT NOT NULL,
                location TEXT,
                numbers_draw_order_json TEXT NOT NULL,
                numbers_sorted_json TEXT NOT NULL,
                numbers_sorted_text TEXT NOT NULL,
                accumulated INTEGER DEFAULT 0,
                next_contest_number INTEGER,
                next_contest_date TEXT,
                estimated_next_prize REAL,
                amount_collected REAL,
                raw_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_contests_game_type ON contests(game_type);
            CREATE INDEX IF NOT EXISTS idx_contests_date ON contests(contest_date);
            CREATE INDEX IF NOT EXISTS idx_contests_number ON contests(contest_number);

            CREATE TABLE IF NOT EXISTS contest_prizes (
                id INTEGER PRIMARY KEY,
                contest_id INTEGER NOT NULL,
                description TEXT,
                range_number INTEGER,
                winners_count INTEGER,
                prize_value REAL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (contest_id) REFERENCES contests(id)
            );

            CREATE TABLE IF NOT EXISTS contest_derived_stats (
                id INTEGER PRIMARY KEY,
                contest_id INTEGER NOT NULL UNIQUE,
                sum_total INTEGER,
                even_count INTEGER,
                odd_count INTEGER,
                range_01_10 INTEGER,
                range_11_20 INTEGER,
                range_21_30 INTEGER,
                range_31_40 INTEGER,
                range_41_50 INTEGER,
                range_51_60 INTEGER,
                repeated_from_previous_count INTEGER,
                has_sequence INTEGER,
                max_sequence_length INTEGER,
                dispersion_score REAL,
                parity_signature TEXT,
                range_signature TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (contest_id) REFERENCES contests(id)
            );

            CREATE TABLE IF NOT EXISTS number_stats (
                id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL DEFAULT 'megasena',
                number_value INTEGER NOT NULL,
                historical_frequency INTEGER DEFAULT 0,
                recent_frequency_30 INTEGER DEFAULT 0,
                recent_frequency_60 INTEGER DEFAULT 0,
                recent_frequency_100 INTEGER DEFAULT 0,
                current_delay INTEGER DEFAULT 0,
                average_gap REAL DEFAULT 0,
                gap_std_dev REAL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(game_type, number_value)
            );

            CREATE TABLE IF NOT EXISTS saved_games (
                id INTEGER PRIMARY KEY,
                name TEXT,
                numbers_json TEXT NOT NULL,
                numbers_text TEXT NOT NULL,
                strategy_id TEXT NOT NULL,
                strategy_label TEXT NOT NULL,
                notes TEXT,
                is_favorite INTEGER DEFAULT 0,
                is_bet INTEGER DEFAULT 0,
                target_contest_number INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS saved_game_analysis (
                id INTEGER PRIMARY KEY,
                saved_game_id INTEGER NOT NULL UNIQUE,
                sum_total INTEGER,
                even_count INTEGER,
                odd_count INTEGER,
                range_01_10 INTEGER,
                range_11_20 INTEGER,
                range_21_30 INTEGER,
                range_31_40 INTEGER,
                range_41_50 INTEGER,
                range_51_60 INTEGER,
                repeats_from_last_contest INTEGER,
                historical_exact_match_count INTEGER,
                historical_same_parity_signature_count INTEGER,
                historical_same_range_signature_count INTEGER,
                avg_frequency REAL,
                avg_recent_frequency REAL,
                avg_delay REAL,
                affinity_score REAL,
                dispersion_score REAL,
                structural_score REAL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (saved_game_id) REFERENCES saved_games(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS sync_logs (
                id INTEGER PRIMARY KEY,
                operation_type TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                started_at TEXT NOT NULL DEFAULT (datetime('now')),
                finished_at TEXT,
                metadata_json TEXT
            );

            INSERT OR IGNORE INTO sync_state (id, game_type) VALUES (1, 'megasena');

            CREATE TABLE IF NOT EXISTS games_catalog (
                id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL UNIQUE,
                display_name TEXT NOT NULL,
                is_enabled INTEGER DEFAULT 0,
                is_primary INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                numbers_pool_size INTEGER DEFAULT 0,
                min_pick_count INTEGER DEFAULT 0,
                max_pick_count INTEGER DEFAULT 0,
                default_pick_count INTEGER DEFAULT 0,
                has_trevos INTEGER DEFAULT 0,
                has_time_coracao INTEGER DEFAULT 0,
                has_mes_sorte INTEGER DEFAULT 0,
                color TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS bet_price_rules (
                id INTEGER PRIMARY KEY,
                game_type TEXT NOT NULL,
                pick_count INTEGER NOT NULL,
                price_value REAL NOT NULL,
                is_default INTEGER DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(game_type, pick_count)
            );
            "
        ).map_err(|e| e.to_string())?;

        // ALTER TABLE additions - use .ok() to silently ignore if columns already exist
        let conn_ref = &*conn;
        conn_ref.execute("ALTER TABLE contests ADD COLUMN trevos_json TEXT", []).ok();
        conn_ref.execute("ALTER TABLE contests ADD COLUMN time_coracao TEXT", []).ok();
        conn_ref.execute("ALTER TABLE contests ADD COLUMN mes_sorte TEXT", []).ok();
        conn_ref.execute("ALTER TABLE saved_games ADD COLUMN game_type TEXT DEFAULT 'megasena'", []).ok();
        conn_ref.execute("ALTER TABLE saved_games ADD COLUMN bet_price_value REAL", []).ok();

        // AI Config table for LotoCore v4.0
        conn_ref.execute_batch(
            "CREATE TABLE IF NOT EXISTS ai_config (
                id INTEGER PRIMARY KEY,
                provider TEXT NOT NULL DEFAULT 'gemini',
                api_key TEXT NOT NULL DEFAULT '',
                model TEXT NOT NULL DEFAULT 'gemini-2.0-flash'
            );"
        ).ok();

        // Lunar calendar table
        conn_ref.execute_batch(
            "CREATE TABLE IF NOT EXISTS lunar_calendar (
                data TEXT PRIMARY KEY,
                idade_lua REAL,
                iluminacao REAL,
                fase TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_lunar_fase ON lunar_calendar(fase);
            CREATE INDEX IF NOT EXISTS idx_lunar_data ON lunar_calendar(data);"
        ).ok();

        // Migration: Fix contest_number UNIQUE constraint to be per-game_type
        // Check if the old UNIQUE index exists on contest_number alone
        let needs_migration: bool = conn_ref.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='sqlite_autoindex_contests_1'",
            [], |row| row.get::<_, i64>(0)
        ).unwrap_or(0) > 0;

        if needs_migration {
            // Check if we actually have multi-game data (would fail with old constraint)
            // Recreate table with correct UNIQUE(game_type, contest_number)
            conn_ref.execute_batch("
                CREATE TABLE IF NOT EXISTS contests_new (
                    id INTEGER PRIMARY KEY,
                    game_type TEXT NOT NULL DEFAULT 'megasena',
                    contest_number INTEGER NOT NULL,
                    contest_date TEXT NOT NULL,
                    location TEXT,
                    numbers_draw_order_json TEXT NOT NULL,
                    numbers_sorted_json TEXT NOT NULL,
                    numbers_sorted_text TEXT NOT NULL,
                    accumulated INTEGER DEFAULT 0,
                    next_contest_number INTEGER,
                    next_contest_date TEXT,
                    estimated_next_prize REAL,
                    amount_collected REAL,
                    raw_json TEXT NOT NULL,
                    trevos_json TEXT,
                    time_coracao TEXT,
                    mes_sorte TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                    UNIQUE(game_type, contest_number)
                );
                INSERT OR IGNORE INTO contests_new SELECT id, game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte, created_at, updated_at FROM contests;
                DROP TABLE contests;
                ALTER TABLE contests_new RENAME TO contests;
                CREATE INDEX IF NOT EXISTS idx_contests_game_type ON contests(game_type);
                CREATE INDEX IF NOT EXISTS idx_contests_date ON contests(contest_date);
                CREATE INDEX IF NOT EXISTS idx_contests_number ON contests(contest_number);
                CREATE UNIQUE INDEX IF NOT EXISTS idx_contests_game_contest ON contests(game_type, contest_number);
            ").ok();
            log::info!("Migration: Fixed contest_number UNIQUE constraint to be per game_type");
        }

        // Ensure unique index exists (for fresh installs too)
        conn_ref.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_contests_game_contest ON contests(game_type, contest_number)", []).ok();

        // Make sync_state unique per game_type
        conn_ref.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_state_game ON sync_state(game_type)", []).ok();

        Ok(())
    }

    // ── Sync State ──
    pub fn get_last_imported_contest(&self) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let n: i64 = conn.query_row(
            "SELECT COALESCE(last_imported_contest, 0) FROM sync_state WHERE id = 1",
            [], |row| row.get(0)
        ).unwrap_or(0);
        Ok(n)
    }

    pub fn update_sync_state(&self, last_contest: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_state SET last_imported_contest = ?1, last_synced_at = datetime('now'), sync_status = 'idle', updated_at = datetime('now') WHERE id = 1",
            params![last_contest]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_last_sync_at(&self) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let r: Option<String> = conn.query_row(
            "SELECT last_synced_at FROM sync_state WHERE id = 1",
            [], |row| row.get(0)
        ).unwrap_or(None);
        Ok(r)
    }

    // ── Contest CRUD ──
    pub fn insert_contest(&self, api: &ApiContest) -> Result<i64, String> {
        self.insert_contest_for_game(api, "megasena")
    }

    pub fn insert_contest_for_game(&self, api: &ApiContest, game_type: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let mut numbers_sorted: Vec<i32> = api.dezenas.iter()
            .filter_map(|d| d.parse::<i32>().ok())
            .collect();
        numbers_sorted.sort();

        let numbers_draw_order: Vec<i32> = api.dezenas_ordem_sorteio.as_ref()
            .unwrap_or(&api.dezenas)
            .iter()
            .filter_map(|d| d.parse::<i32>().ok())
            .collect();

        let numbers_text = numbers_sorted.iter()
            .map(|n| format!("{:02}", n))
            .collect::<Vec<_>>()
            .join(", ");

        let raw_json = serde_json::to_string(api).unwrap_or_default();

        // Extract special fields
        let trevos_json: Option<String> = api.trevos.as_ref()
            .filter(|t| !t.is_empty())
            .and_then(|t| serde_json::to_string(t).ok());
        let time_coracao: Option<&str> = api.time_coracao.as_deref().filter(|s| !s.is_empty());
        let mes_sorte: Option<&str> = api.mes_sorte.as_deref().filter(|s| !s.is_empty());

        conn.execute(
            "INSERT OR IGNORE INTO contests (game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                game_type,
                api.concurso,
                api.data.as_deref().unwrap_or(""),
                api.local_sorteio,
                serde_json::to_string(&numbers_draw_order).unwrap_or_default(),
                serde_json::to_string(&numbers_sorted).unwrap_or_default(),
                numbers_text,
                api.acumulou.unwrap_or(false) as i32,
                api.proximo_concurso,
                api.data_proximo_concurso,
                api.valor_estimado_proximo_concurso,
                api.valor_arrecadado,
                raw_json,
                trevos_json,
                time_coracao,
                mes_sorte,
            ]
        ).map_err(|e| e.to_string())?;

        let contest_id = conn.last_insert_rowid();
        if contest_id > 0 {
            if let Some(prizes) = &api.premiacoes {
                for p in prizes {
                    conn.execute(
                        "INSERT OR IGNORE INTO contest_prizes (contest_id, description, range_number, winners_count, prize_value) VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![contest_id, p.descricao, p.faixa, p.ganhadores, p.valor_premio]
                    ).ok();
                }
            }
        }
        Ok(contest_id)
    }

    pub fn get_total_contests(&self) -> Result<i64, String> {
        self.get_total_contests_for_game("megasena")
    }

    pub fn get_game_types_with_contests(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT DISTINCT game_type FROM contests").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    }

    pub fn get_total_contests_for_game(&self, game_type: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let n: i64 = conn.query_row(
            "SELECT COUNT(*) FROM contests WHERE game_type = ?1",
            params![game_type], |row| row.get(0)
        ).unwrap_or(0);
        Ok(n)
    }

    pub fn get_last_contest(&self) -> Result<Option<Contest>, String> {
        self.get_last_contest_for_game("megasena")
    }

    pub fn get_last_contest_for_game(&self, game_type: &str) -> Result<Option<Contest>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte
             FROM contests WHERE game_type = ?1 ORDER BY contest_number DESC LIMIT 1"
        ).map_err(|e| e.to_string())?;

        let contest = stmt.query_row(params![game_type], |row| {
            Ok(Contest {
                id: row.get(0)?,
                contest_number: row.get(1)?,
                contest_date: row.get(2)?,
                location: row.get(3)?,
                numbers_draw_order: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
                numbers_sorted: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
                numbers_sorted_text: row.get(6)?,
                accumulated: row.get::<_, i32>(7)? != 0,
                next_contest_number: row.get(8)?,
                next_contest_date: row.get(9)?,
                estimated_next_prize: row.get(10)?,
                amount_collected: row.get(11)?,
                prizes: vec![],
                raw_json: Some(row.get(12)?),
                trevos_json: row.get(13).ok(),
                time_coracao: row.get(14).ok(),
                mes_sorte: row.get(15).ok(),
            })
        }).ok();

        if let Some(mut c) = contest {
            c.prizes = self.get_contest_prizes_inner(&conn, c.id)?;
            Ok(Some(c))
        } else {
            Ok(None)
        }
    }

    fn get_contest_prizes_inner(&self, conn: &Connection, contest_id: i64) -> Result<Vec<Prize>, String> {
        let mut stmt = conn.prepare(
            "SELECT description, range_number, winners_count, prize_value FROM contest_prizes WHERE contest_id = ?1"
        ).map_err(|e| e.to_string())?;
        let prizes = stmt.query_map(params![contest_id], |row| {
            Ok(Prize {
                description: row.get(0)?,
                range_number: row.get(1)?,
                winners_count: row.get(2)?,
                prize_value: row.get(3)?,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(prizes)
    }

    pub fn search_contests(&self, params: &ContestSearchParams) -> Result<ContestSearchResult, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;

        let gt = params.game_type.as_deref().unwrap_or("megasena");
        let mut where_clauses = vec![format!("game_type = ?1")];
        let mut bind_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(gt.to_string())];

        if let Some(n) = params.search_number {
            where_clauses.push(format!("contest_number = ?{}", bind_values.len() + 1));
            bind_values.push(Box::new(n));
        }
        // Dates: API stores "dd/mm/yyyy", HTML sends "yyyy-mm-dd"
        // Normalize contest_date to yyyy-mm-dd for comparison
        if let Some(ref d) = params.date_from {
            where_clauses.push(format!(
                "(substr(contest_date,7,4)||'-'||substr(contest_date,4,2)||'-'||substr(contest_date,1,2)) >= ?{}", bind_values.len() + 1
            ));
            bind_values.push(Box::new(d.clone()));
        }
        if let Some(ref d) = params.date_to {
            where_clauses.push(format!(
                "(substr(contest_date,7,4)||'-'||substr(contest_date,4,2)||'-'||substr(contest_date,1,2)) <= ?{}", bind_values.len() + 1
            ));
            bind_values.push(Box::new(d.clone()));
        }

        let where_sql = where_clauses.join(" AND ");

        let count_sql = format!("SELECT COUNT(*) FROM contests WHERE {}", where_sql);
        let total: i64 = {
            let mut stmt = conn.prepare(&count_sql).map_err(|e| e.to_string())?;
            let refs: Vec<&dyn rusqlite::types::ToSql> = bind_values.iter().map(|b| b.as_ref()).collect();
            stmt.query_row(refs.as_slice(), |row| row.get(0)).unwrap_or(0)
        };

        let offset = (params.page - 1) * params.per_page;
        let query_sql = format!(
            "SELECT id, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte
             FROM contests WHERE {} ORDER BY contest_number DESC LIMIT ?{} OFFSET ?{}",
            where_sql, bind_values.len() + 1, bind_values.len() + 2
        );

        bind_values.push(Box::new(params.per_page));
        bind_values.push(Box::new(offset));

        let mut stmt = conn.prepare(&query_sql).map_err(|e| e.to_string())?;
        let refs: Vec<&dyn rusqlite::types::ToSql> = bind_values.iter().map(|b| b.as_ref()).collect();
        let contests: Vec<Contest> = stmt.query_map(refs.as_slice(), |row| {
            Ok(Contest {
                id: row.get(0)?,
                contest_number: row.get(1)?,
                contest_date: row.get(2)?,
                location: row.get(3)?,
                numbers_draw_order: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
                numbers_sorted: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
                numbers_sorted_text: row.get(6)?,
                accumulated: row.get::<_, i32>(7)? != 0,
                next_contest_number: row.get(8)?,
                next_contest_date: row.get(9)?,
                estimated_next_prize: row.get(10)?,
                amount_collected: row.get(11)?,
                prizes: vec![],
                raw_json: Some(row.get(12)?),
                trevos_json: row.get(13).ok(),
                time_coracao: row.get(14).ok(),
                mes_sorte: row.get(15).ok(),
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        let total_pages = if total == 0 { 0 } else { (total + params.per_page - 1) / params.per_page };

        Ok(ContestSearchResult {
            contests,
            total,
            page: params.page,
            per_page: params.per_page,
            total_pages,
        })
    }

    pub fn get_contest_by_number(&self, number: i64) -> Result<Option<Contest>, String> {
        self.get_contest_by_number_for_game(number, "megasena")
    }

    pub fn get_contest_by_number_for_game(&self, number: i64, game_type: &str) -> Result<Option<Contest>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte
             FROM contests WHERE contest_number = ?1 AND game_type = ?2"
        ).map_err(|e| e.to_string())?;

        let contest = stmt.query_row(params![number, game_type], |row| {
            Ok(Contest {
                id: row.get(0)?,
                contest_number: row.get(1)?,
                contest_date: row.get(2)?,
                location: row.get(3)?,
                numbers_draw_order: serde_json::from_str(&row.get::<_, String>(4)?).unwrap_or_default(),
                numbers_sorted: serde_json::from_str(&row.get::<_, String>(5)?).unwrap_or_default(),
                numbers_sorted_text: row.get(6)?,
                accumulated: row.get::<_, i32>(7)? != 0,
                next_contest_number: row.get(8)?,
                next_contest_date: row.get(9)?,
                estimated_next_prize: row.get(10)?,
                amount_collected: row.get(11)?,
                prizes: vec![],
                raw_json: Some(row.get(12)?),
                trevos_json: row.get(13).ok(),
                time_coracao: row.get(14).ok(),
                mes_sorte: row.get(15).ok(),
            })
        }).ok();

        if let Some(mut c) = contest {
            c.prizes = self.get_contest_prizes_inner(&conn, c.id)?;
            Ok(Some(c))
        } else {
            Ok(None)
        }
    }

    // ── All sorted numbers for stats ──
    pub fn get_all_sorted_numbers_for_game(&self, game_type: &str) -> Result<Vec<(i64, Vec<i32>)>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT contest_number, numbers_sorted_json FROM contests WHERE game_type = ?1 ORDER BY contest_number ASC"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<(i64, Vec<i32>)> = stmt.query_map(params![game_type], |row| {
            let num: i64 = row.get(0)?;
            let json: String = row.get(1)?;
            let nums: Vec<i32> = serde_json::from_str(&json).unwrap_or_default();
            Ok((num, nums))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(rows)
    }

    pub fn get_all_sorted_numbers(&self) -> Result<Vec<(i64, Vec<i32>)>, String> {
        self.get_all_sorted_numbers_for_game("megasena")
    }

    // ── Number Stats ──
    pub fn upsert_number_stat(&self, stat: &NumberStat) -> Result<(), String> {
        self.upsert_number_stat_for_game(stat, "megasena")
    }

    pub fn upsert_number_stat_for_game(&self, stat: &NumberStat, game_type: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO number_stats (game_type, number_value, historical_frequency, recent_frequency_30, recent_frequency_60, recent_frequency_100, current_delay, average_gap, gap_std_dev, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
             ON CONFLICT(game_type, number_value) DO UPDATE SET
                historical_frequency = ?3, recent_frequency_30 = ?4, recent_frequency_60 = ?5, recent_frequency_100 = ?6, current_delay = ?7, average_gap = ?8, gap_std_dev = ?9, updated_at = datetime('now')",
            params![game_type, stat.number_value, stat.historical_frequency, stat.recent_frequency_30, stat.recent_frequency_60, stat.recent_frequency_100, stat.current_delay, stat.average_gap, stat.gap_std_dev]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all_number_stats(&self) -> Result<Vec<NumberStat>, String> {
        self.get_all_number_stats_for_game("megasena")
    }

    pub fn get_all_number_stats_for_game(&self, game_type: &str) -> Result<Vec<NumberStat>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT number_value, historical_frequency, recent_frequency_30, recent_frequency_60, recent_frequency_100, current_delay, average_gap, gap_std_dev FROM number_stats WHERE game_type = ?1 ORDER BY number_value"
        ).map_err(|e| e.to_string())?;
        let stats = stmt.query_map(params![game_type], |row| {
            Ok(NumberStat {
                number_value: row.get(0)?,
                historical_frequency: row.get(1)?,
                recent_frequency_30: row.get(2)?,
                recent_frequency_60: row.get(3)?,
                recent_frequency_100: row.get(4)?,
                current_delay: row.get(5)?,
                average_gap: row.get(6)?,
                gap_std_dev: row.get(7)?,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(stats)
    }

    // ── Saved Games ──
    pub fn save_game(&self, params: &SaveGameParams) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let numbers_json = serde_json::to_string(&params.numbers).unwrap_or_default();
        let numbers_text = params.numbers.iter()
            .map(|n| format!("{:02}", n))
            .collect::<Vec<_>>()
            .join(", ");
        let gt = params.game_type.as_deref().unwrap_or("megasena");

        conn.execute(
            "INSERT INTO saved_games (name, numbers_json, numbers_text, strategy_id, strategy_label, notes, target_contest_number, game_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![params.name, numbers_json, numbers_text, params.strategy_id, params.strategy_label, params.notes, params.target_contest_number, gt]
        ).map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_saved_games(&self) -> Result<Vec<SavedGame>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, name, numbers_json, numbers_text, strategy_id, strategy_label, notes, is_favorite, is_bet, target_contest_number, created_at, updated_at, game_type
             FROM saved_games ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let games = stmt.query_map([], |row| {
            Ok(SavedGame {
                id: row.get(0)?,
                name: row.get(1)?,
                numbers: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default(),
                numbers_text: row.get(3)?,
                strategy_id: row.get(4)?,
                strategy_label: row.get(5)?,
                notes: row.get(6)?,
                is_favorite: row.get::<_, i32>(7)? != 0,
                is_bet: row.get::<_, i32>(8)? != 0,
                target_contest_number: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                game_type: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(games)
    }

    pub fn list_saved_games_for_game(&self, game_type: &str) -> Result<Vec<SavedGame>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT id, name, numbers_json, numbers_text, strategy_id, strategy_label, notes, is_favorite, is_bet, target_contest_number, created_at, updated_at, game_type
             FROM saved_games WHERE game_type = ?1 ORDER BY created_at DESC"
        ).map_err(|e| e.to_string())?;
        let games = stmt.query_map(params![game_type], |row| {
            Ok(SavedGame {
                id: row.get(0)?,
                name: row.get(1)?,
                numbers: serde_json::from_str(&row.get::<_, String>(2)?).unwrap_or_default(),
                numbers_text: row.get(3)?,
                strategy_id: row.get(4)?,
                strategy_label: row.get(5)?,
                notes: row.get(6)?,
                is_favorite: row.get::<_, i32>(7)? != 0,
                is_bet: row.get::<_, i32>(8)? != 0,
                target_contest_number: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                game_type: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
        Ok(games)
    }

    pub fn delete_saved_game(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM saved_games WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn toggle_favorite(&self, id: i64) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let current: i32 = conn.query_row(
            "SELECT is_favorite FROM saved_games WHERE id = ?1", params![id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        let new_val = if current == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE saved_games SET is_favorite = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![new_val, id]
        ).map_err(|e| e.to_string())?;
        Ok(new_val == 1)
    }

    pub fn mark_as_bet(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE saved_games SET is_bet = 1, updated_at = datetime('now') WHERE id = ?1",
            params![id]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn toggle_bet(&self, id: i64) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let current: i32 = conn.query_row(
            "SELECT is_bet FROM saved_games WHERE id = ?1", params![id], |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        let new_val = if current == 0 { 1 } else { 0 };
        conn.execute(
            "UPDATE saved_games SET is_bet = ?1, updated_at = datetime('now') WHERE id = ?2",
            params![new_val, id]
        ).map_err(|e| e.to_string())?;
        Ok(new_val == 1)
    }

    pub fn get_saved_games_count(&self) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM saved_games", [], |row| row.get(0))
            .unwrap_or(0);
        Ok(n)
    }

    // ── Pair frequency for affinity ──
    pub fn get_pair_frequencies(&self) -> Result<std::collections::HashMap<(i32, i32), i32>, String> {
        let all = self.get_all_sorted_numbers()?;
        let mut map: std::collections::HashMap<(i32, i32), i32> = std::collections::HashMap::new();
        for (_cn, nums) in &all {
            for i in 0..nums.len() {
                for j in (i+1)..nums.len() {
                    *map.entry((nums[i], nums[j])).or_insert(0) += 1;
                }
            }
        }
        Ok(map)
    }

    // ── Contest count for parity/range signature matching ──
    pub fn count_parity_signature_matches(&self, sig: &str) -> Result<i32, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let n: i32 = conn.query_row(
            "SELECT COUNT(*) FROM contest_derived_stats WHERE parity_signature = ?1",
            params![sig], |row| row.get(0)
        ).unwrap_or(0);
        Ok(n)
    }

    pub fn count_range_signature_matches(&self, sig: &str) -> Result<i32, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let n: i32 = conn.query_row(
            "SELECT COUNT(*) FROM contest_derived_stats WHERE range_signature = ?1",
            params![sig], |row| row.get(0)
        ).unwrap_or(0);
        Ok(n)
    }

    pub fn count_exact_number_matches(&self, numbers: &[i32]) -> Result<i32, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let text = numbers.iter().map(|n| format!("{:02}", n)).collect::<Vec<_>>().join(", ");
        let n: i32 = conn.query_row(
            "SELECT COUNT(*) FROM contests WHERE numbers_sorted_text = ?1",
            params![text], |row| row.get(0)
        ).unwrap_or(0);
        Ok(n)
    }

    // ── Export/Import ──
    pub fn export_as_sql(&self) -> Result<String, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut sql = String::from("-- MegaLab Desktop Database Export\n-- Generated at: ");
        let now: String = conn.query_row("SELECT datetime('now')", [], |row| row.get(0)).unwrap_or_default();
        sql.push_str(&now);
        sql.push_str("\n\n");

        // Export contests (including special fields)
        let mut stmt = conn.prepare(
            "SELECT game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte FROM contests ORDER BY game_type, contest_number"
        ).map_err(|e| e.to_string())?;
        let rows: Vec<String> = stmt.query_map([], |row| {
            let game_type: String = row.get(0)?;
            let cn: i64 = row.get(1)?;
            let date: String = row.get(2)?;
            let loc: Option<String> = row.get(3)?;
            let draw_json: String = row.get(4)?;
            let sorted_json: String = row.get(5)?;
            let sorted_text: String = row.get(6)?;
            let acc: i32 = row.get(7)?;
            let next_cn: Option<i64> = row.get(8)?;
            let next_date: Option<String> = row.get(9)?;
            let est_prize: Option<f64> = row.get(10)?;
            let amount: Option<f64> = row.get(11)?;
            let raw: String = row.get(12)?;
            let trevos: Option<String> = row.get(13)?;
            let time_c: Option<String> = row.get(14)?;
            let mes_s: Option<String> = row.get(15)?;
            Ok(format!(
                "INSERT OR IGNORE INTO contests (game_type, contest_number, contest_date, location, numbers_draw_order_json, numbers_sorted_json, numbers_sorted_text, accumulated, next_contest_number, next_contest_date, estimated_next_prize, amount_collected, raw_json, trevos_json, time_coracao, mes_sorte) VALUES ('{}', {}, '{}', {}, '{}', '{}', '{}', {}, {}, {}, {}, {}, '{}', {}, {}, {});",
                game_type.replace('\'', "''"), cn,
                date.replace('\'', "''"),
                loc.map(|l| format!("'{}'", l.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                draw_json.replace('\'', "''"),
                sorted_json.replace('\'', "''"),
                sorted_text.replace('\'', "''"),
                acc,
                next_cn.map(|n| n.to_string()).unwrap_or("NULL".to_string()),
                next_date.map(|d| format!("'{}'", d.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                est_prize.map(|p| p.to_string()).unwrap_or("NULL".to_string()),
                amount.map(|a| a.to_string()).unwrap_or("NULL".to_string()),
                raw.replace('\'', "''"),
                trevos.map(|t| format!("'{}'", t.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                time_c.map(|t| format!("'{}'", t.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                mes_s.map(|m| format!("'{}'", m.replace('\'', "''"))).unwrap_or("NULL".to_string()),
            ))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        for row in rows {
            sql.push_str(&row);
            sql.push('\n');
        }

        // Export saved games (including game_type and bet_price_value)
        sql.push_str("\n-- Saved Games\n");
        let mut stmt2 = conn.prepare(
            "SELECT name, numbers_json, numbers_text, strategy_id, strategy_label, notes, is_favorite, is_bet, target_contest_number, game_type, bet_price_value FROM saved_games"
        ).map_err(|e| e.to_string())?;
        let saved: Vec<String> = stmt2.query_map([], |row| {
            let name: Option<String> = row.get(0)?;
            let nums_json: String = row.get(1)?;
            let nums_text: String = row.get(2)?;
            let sid: String = row.get(3)?;
            let slabel: String = row.get(4)?;
            let notes: Option<String> = row.get(5)?;
            let fav: i32 = row.get(6)?;
            let bet: i32 = row.get(7)?;
            let target: Option<i64> = row.get(8)?;
            let game_type: Option<String> = row.get(9)?;
            let bet_price: Option<f64> = row.get(10)?;
            Ok(format!(
                "INSERT INTO saved_games (name, numbers_json, numbers_text, strategy_id, strategy_label, notes, is_favorite, is_bet, target_contest_number, game_type, bet_price_value) VALUES ({}, '{}', '{}', '{}', '{}', {}, {}, {}, {}, {}, {});",
                name.map(|n| format!("'{}'", n.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                nums_json.replace('\'', "''"),
                nums_text.replace('\'', "''"),
                sid.replace('\'', "''"),
                slabel.replace('\'', "''"),
                notes.map(|n| format!("'{}'", n.replace('\'', "''"))).unwrap_or("NULL".to_string()),
                fav, bet,
                target.map(|t| t.to_string()).unwrap_or("NULL".to_string()),
                game_type.map(|g| format!("'{}'", g.replace('\'', "''"))).unwrap_or("'megasena'".to_string()),
                bet_price.map(|p| p.to_string()).unwrap_or("NULL".to_string()),
            ))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        for row in saved {
            sql.push_str(&row);
            sql.push('\n');
        }

        // Export bet_price_rules (user's custom prices)
        sql.push_str("\n-- Bet Price Rules\n");
        let mut price_stmt = conn.prepare(
            "SELECT game_type, pick_count, price_value, is_default FROM bet_price_rules"
        ).map_err(|e| e.to_string())?;
        let prices: Vec<String> = price_stmt.query_map([], |row| {
            let game_type: String = row.get(0)?;
            let pick_count: i32 = row.get(1)?;
            let price_value: f64 = row.get(2)?;
            let is_default: i32 = row.get(3)?;
            Ok(format!(
                "INSERT OR REPLACE INTO bet_price_rules (game_type, pick_count, price_value, is_default) VALUES ('{}', {}, {}, {});",
                game_type.replace('\'', "''"), pick_count, price_value, is_default,
            ))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        for row in prices {
            sql.push_str(&row);
            sql.push('\n');
        }

        // Export games_catalog enabled/primary state
        sql.push_str("\n-- Games Catalog State\n");
        let mut cat_stmt = conn.prepare(
            "SELECT game_type, is_enabled, is_primary FROM games_catalog"
        ).map_err(|e| e.to_string())?;
        let catalog_rows: Vec<String> = cat_stmt.query_map([], |row| {
            let game_type: String = row.get(0)?;
            let is_enabled: i32 = row.get(1)?;
            let is_primary: i32 = row.get(2)?;
            Ok(format!(
                "UPDATE games_catalog SET is_enabled = {}, is_primary = {} WHERE game_type = '{}';",
                is_enabled, is_primary, game_type.replace('\'', "''"),
            ))
        }).map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

        for row in catalog_rows {
            sql.push_str(&row);
            sql.push('\n');
        }

        // Update sync state per game type
        sql.push_str("\n-- Sync state per game type\n");
        let mut sync_stmt = conn.prepare("SELECT DISTINCT game_type FROM contests").map_err(|e| e.to_string())?;
        let game_types: Vec<String> = sync_stmt.query_map([], |row| row.get::<_, String>(0)).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        for gt in &game_types {
            let last: i64 = conn.query_row("SELECT COALESCE(MAX(contest_number), 0) FROM contests WHERE game_type = ?1", params![gt], |row| row.get(0)).unwrap_or(0);
            sql.push_str(&format!("INSERT OR IGNORE INTO sync_state (game_type, last_imported_contest, sync_status) VALUES ('{}', 0, 'idle');\n", gt));
            sql.push_str(&format!("UPDATE sync_state SET last_imported_contest = {}, last_synced_at = datetime('now') WHERE game_type = '{}';\n", last, gt));
        }

        Ok(sql)
    }

    pub fn import_from_sql(&self, sql: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // Pre-process: ensure contest inserts use INSERT OR IGNORE to prevent duplicates
        let safe_sql = sql
            .replace("INSERT INTO contests ", "INSERT OR IGNORE INTO contests ")
            .replace("INSERT OR IGNORE OR IGNORE", "INSERT OR IGNORE");
        conn.execute_batch(&safe_sql).map_err(|e| format!("Erro ao importar SQL: {}", e))?;
        Ok(())
    }

    // ── Derived Stats ──
    pub fn upsert_derived_stats(&self, stats: &ContestDerivedStats) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO contest_derived_stats (contest_id, sum_total, even_count, odd_count, range_01_10, range_11_20, range_21_30, range_31_40, range_41_50, range_51_60, repeated_from_previous_count, has_sequence, max_sequence_length, dispersion_score, parity_signature, range_signature)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
             ON CONFLICT(contest_id) DO UPDATE SET sum_total=?2, even_count=?3, odd_count=?4, range_01_10=?5, range_11_20=?6, range_21_30=?7, range_31_40=?8, range_41_50=?9, range_51_60=?10, repeated_from_previous_count=?11, has_sequence=?12, max_sequence_length=?13, dispersion_score=?14, parity_signature=?15, range_signature=?16, updated_at=datetime('now')",
            params![stats.contest_id, stats.sum_total, stats.even_count, stats.odd_count, stats.range_01_10, stats.range_11_20, stats.range_21_30, stats.range_31_40, stats.range_41_50, stats.range_51_60, stats.repeated_from_previous_count, stats.has_sequence as i32, stats.max_sequence_length, stats.dispersion_score, stats.parity_signature, stats.range_signature]
        ).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ── Games Catalog & Onboarding ──
    pub fn seed_games_catalog(&self, configs: &[crate::registry::LotteryConfig]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        for c in configs {
            conn.execute(
                "INSERT OR IGNORE INTO games_catalog (game_type, display_name, is_enabled, is_primary, sort_order, numbers_pool_size, min_pick_count, max_pick_count, default_pick_count, has_trevos, has_time_coracao, has_mes_sorte, color) VALUES (?1, ?2, 0, 0, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![c.game_type, c.display_name, c.sort_order, c.numbers_pool_size, c.min_pick_count, c.max_pick_count, c.default_pick_count, c.has_trevos as i32, c.has_time_coracao as i32, c.has_mes_sorte as i32, c.color]
            ).map_err(|e| e.to_string())?;
            // Always update colors and display config
            conn.execute(
                "UPDATE games_catalog SET color = ?1, display_name = ?2, numbers_pool_size = ?3, min_pick_count = ?4, max_pick_count = ?5, default_pick_count = ?6 WHERE game_type = ?7",
                params![c.color, c.display_name, c.numbers_pool_size, c.min_pick_count, c.max_pick_count, c.default_pick_count, c.game_type]
            ).ok();
        }
        Ok(())
    }

    pub fn seed_default_prices(&self, prices: &[(String, i32, f64)]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        for (game_type, pick_count, price) in prices {
            conn.execute(
                "INSERT OR IGNORE INTO bet_price_rules (game_type, pick_count, price_value, is_default) VALUES (?1, ?2, ?3, 1)",
                params![game_type, pick_count, price]
            ).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_enabled_games(&self) -> Result<Vec<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT game_type FROM games_catalog WHERE is_enabled = 1 ORDER BY sort_order").map_err(|e| e.to_string())?;
        let games = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        Ok(games)
    }

    pub fn get_primary_game(&self) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let r: Option<String> = conn.query_row("SELECT game_type FROM games_catalog WHERE is_primary = 1 LIMIT 1", [], |row| row.get(0)).ok();
        Ok(r)
    }

    pub fn enable_games(&self, game_types: &[String], primary: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE games_catalog SET is_enabled = 0, is_primary = 0", []).map_err(|e| e.to_string())?;
        for gt in game_types {
            conn.execute("UPDATE games_catalog SET is_enabled = 1 WHERE game_type = ?1", params![gt]).map_err(|e| e.to_string())?;
            // Ensure sync_state exists for this game
            conn.execute("INSERT OR IGNORE INTO sync_state (game_type) VALUES (?1)", params![gt]).map_err(|e| e.to_string())?;
        }
        conn.execute("UPDATE games_catalog SET is_primary = 1 WHERE game_type = ?1", params![primary]).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn is_onboarding_done(&self) -> Result<bool, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM games_catalog WHERE is_enabled = 1", [], |row| row.get(0)).unwrap_or(0);
        Ok(count > 0)
    }

    pub fn get_bet_price(&self, game_type: &str, pick_count: i32) -> Result<Option<f64>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let r: Option<f64> = conn.query_row(
            "SELECT price_value FROM bet_price_rules WHERE game_type = ?1 AND pick_count = ?2",
            params![game_type, pick_count], |row| row.get(0)
        ).ok();
        Ok(r)
    }

    pub fn get_all_games_catalog(&self) -> Result<Vec<crate::registry::LotteryConfig>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare(
            "SELECT game_type, display_name, is_enabled, is_primary, sort_order, numbers_pool_size, min_pick_count, max_pick_count, default_pick_count, has_trevos, has_time_coracao, has_mes_sorte, color FROM games_catalog ORDER BY sort_order"
        ).map_err(|e| e.to_string())?;
        let games = stmt.query_map([], |row| {
            Ok(crate::registry::LotteryConfig {
                game_type: row.get(0)?,
                display_name: row.get(1)?,
                api_path: row.get::<_, String>(0)?, // same as game_type
                numbers_pool_size: row.get(5)?,
                min_pick_count: row.get(6)?,
                max_pick_count: row.get(7)?,
                default_pick_count: row.get(8)?,
                has_trevos: row.get::<_, i32>(9)? != 0,
                trevo_pool_size: 0,
                trevo_pick_count: 0,
                has_time_coracao: row.get::<_, i32>(10)? != 0,
                has_mes_sorte: row.get::<_, i32>(11)? != 0,
                sort_order: row.get(4)?,
                color: row.get(12)?,
            })
        }).map_err(|e| e.to_string())?.filter_map(|r| r.ok()).collect();
        Ok(games)
    }
}
