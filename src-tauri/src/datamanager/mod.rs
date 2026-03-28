use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::db::Database;

// ── Structs ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StorageAudit {
    pub db_size_bytes: u64,
    pub db_path: String,
    pub cache_size_bytes: u64,
    pub log_size_bytes: u64,
    pub temp_size_bytes: u64,
    pub total_size_bytes: u64,
    pub contests_count: i64,
    pub saved_games_count: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CleanupResult {
    pub freed_bytes: u64,
    pub actions: Vec<String>,
}

// ── Helper functions ──

/// Ensure standard subdirectories exist under app_dir.
fn ensure_subdirs(app_dir: &Path) -> Result<(), String> {
    for sub in &["cache", "temp", "logs"] {
        let dir = app_dir.join(sub);
        if !dir.exists() {
            std::fs::create_dir_all(&dir)
                .map_err(|e| format!("Erro ao criar diretório '{}': {}", dir.display(), e))?;
        }
    }
    Ok(())
}

/// Calculate the total size of all files inside a directory (non-recursive by default,
/// recursive when `recursive` is true).
fn dir_size(dir: &Path, recursive: bool) -> u64 {
    if !dir.exists() {
        return 0;
    }
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    let mut total: u64 = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            total += path.metadata().map(|m| m.len()).unwrap_or(0);
        } else if recursive && path.is_dir() {
            total += dir_size(&path, true);
        }
    }
    total
}

/// Delete all files inside a directory. Returns total bytes freed.
fn clear_dir_files(dir: &Path) -> Result<u64, String> {
    if !dir.exists() {
        return Ok(0);
    }
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    let mut freed: u64 = 0;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            let size = path.metadata().map(|m| m.len()).unwrap_or(0);
            if std::fs::remove_file(&path).is_ok() {
                freed += size;
            }
        }
    }
    Ok(freed)
}

/// Get the size of a single file. Returns 0 if the file doesn't exist.
fn file_size(path: &Path) -> u64 {
    if path.exists() {
        path.metadata().map(|m| m.len()).unwrap_or(0)
    } else {
        0
    }
}

/// Generate a timestamp string suitable for filenames (e.g., "20260328_143022").
fn timestamp_for_filename() -> String {
    let now = chrono::Local::now();
    now.format("%Y%m%d_%H%M%S").to_string()
}

// ── Public API ──

/// Audit storage usage: database size, cache, logs, temp, and record counts.
pub fn audit_storage(app_dir: &Path, db: &Database) -> Result<StorageAudit, String> {
    ensure_subdirs(app_dir)?;

    let db_path = app_dir.join("megalab.db");
    let db_size = file_size(&db_path);

    // Also count WAL and SHM files (SQLite journal)
    let wal_size = file_size(&app_dir.join("megalab.db-wal"));
    let shm_size = file_size(&app_dir.join("megalab.db-shm"));
    let total_db_size = db_size + wal_size + shm_size;

    let cache_size = dir_size(&app_dir.join("cache"), true);
    let log_size = dir_size(&app_dir.join("logs"), true);
    let temp_size = dir_size(&app_dir.join("temp"), true);

    let total_size = total_db_size + cache_size + log_size + temp_size;

    // Query record counts from the database
    let contests_count = db.get_total_contests().unwrap_or(0);
    let saved_games_count = db.get_saved_games_count().unwrap_or(0);

    Ok(StorageAudit {
        db_size_bytes: total_db_size,
        db_path: db_path.to_string_lossy().to_string(),
        cache_size_bytes: cache_size,
        log_size_bytes: log_size,
        temp_size_bytes: temp_size,
        total_size_bytes: total_size,
        contests_count,
        saved_games_count,
    })
}

/// Clear all cached files.
pub fn clear_cache(app_dir: &Path) -> Result<CleanupResult, String> {
    ensure_subdirs(app_dir)?;

    let cache_dir = app_dir.join("cache");
    let freed = clear_dir_files(&cache_dir)?;

    let mut actions = Vec::new();
    if freed > 0 {
        actions.push(format!("Cache limpo: {} bytes liberados.", freed));
    } else {
        actions.push("Cache já estava vazio.".to_string());
    }

    Ok(CleanupResult { freed_bytes: freed, actions })
}

/// Clear all temporary files.
pub fn clear_temp(app_dir: &Path) -> Result<CleanupResult, String> {
    ensure_subdirs(app_dir)?;

    let temp_dir = app_dir.join("temp");
    let freed = clear_dir_files(&temp_dir)?;

    let mut actions = Vec::new();
    if freed > 0 {
        actions.push(format!("Temp limpo: {} bytes liberados.", freed));
    } else {
        actions.push("Diretório temp já estava vazio.".to_string());
    }

    Ok(CleanupResult { freed_bytes: freed, actions })
}

/// Clear all log files.
pub fn clear_logs(app_dir: &Path) -> Result<CleanupResult, String> {
    ensure_subdirs(app_dir)?;

    let logs_dir = app_dir.join("logs");
    let freed = clear_dir_files(&logs_dir)?;

    let mut actions = Vec::new();
    if freed > 0 {
        actions.push(format!("Logs limpos: {} bytes liberados.", freed));
    } else {
        actions.push("Diretório de logs já estava vazio.".to_string());
    }

    Ok(CleanupResult { freed_bytes: freed, actions })
}

/// Create a backup copy of the database file.
/// Returns the full path of the backup file.
pub fn backup_database(app_dir: &Path) -> Result<String, String> {
    let db_path = app_dir.join("megalab.db");
    if !db_path.exists() {
        return Err("Arquivo de banco de dados não encontrado.".to_string());
    }

    let backup_name = format!("megalab_backup_{}.db", timestamp_for_filename());
    let backup_path = app_dir.join(&backup_name);

    std::fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Erro ao criar backup: {}", e))?;

    // Also copy WAL if it exists (to ensure backup consistency)
    let wal_path = app_dir.join("megalab.db-wal");
    if wal_path.exists() {
        let wal_backup = app_dir.join(format!("megalab_backup_{}.db-wal", timestamp_for_filename()));
        std::fs::copy(&wal_path, &wal_backup).ok();
    }

    log::info!("Backup criado: {}", backup_path.display());

    Ok(backup_path.to_string_lossy().to_string())
}

/// Perform a safe reset: backup first, then VACUUM the database and clear
/// derived/computed tables (stats, analysis), preserving raw contest data
/// and saved games.
pub fn safe_reset(app_dir: &Path, db: &Database) -> Result<CleanupResult, String> {
    let mut actions = Vec::new();
    let mut freed: u64 = 0;

    // Step 1: Backup
    let backup_path = backup_database(app_dir)?;
    actions.push(format!("Backup criado: {}", backup_path));

    // Step 2: Get DB size before VACUUM
    let db_size_before = file_size(&app_dir.join("megalab.db"))
        + file_size(&app_dir.join("megalab.db-wal"))
        + file_size(&app_dir.join("megalab.db-shm"));

    // Step 3: Clear derived tables
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch(
            "
            DELETE FROM contest_derived_stats;
            DELETE FROM number_stats;
            DELETE FROM saved_game_analysis;
            DELETE FROM sync_logs;
            "
        ).map_err(|e| format!("Erro ao limpar tabelas derivadas: {}", e))?;
        actions.push("Tabelas derivadas limpas (stats, analysis, sync_logs).".to_string());
    }

    // Step 4: VACUUM the database to reclaim space
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute_batch("VACUUM;")
            .map_err(|e| format!("Erro ao executar VACUUM: {}", e))?;
        actions.push("VACUUM executado no banco de dados.".to_string());
    }

    // Step 5: Calculate freed space
    let db_size_after = file_size(&app_dir.join("megalab.db"))
        + file_size(&app_dir.join("megalab.db-wal"))
        + file_size(&app_dir.join("megalab.db-shm"));
    let db_freed = db_size_before.saturating_sub(db_size_after);
    freed += db_freed;

    // Step 6: Clear cache and temp as well
    let cache_freed = clear_dir_files(&app_dir.join("cache")).unwrap_or(0);
    if cache_freed > 0 {
        freed += cache_freed;
        actions.push(format!("Cache limpo: {} bytes.", cache_freed));
    }

    let temp_freed = clear_dir_files(&app_dir.join("temp")).unwrap_or(0);
    if temp_freed > 0 {
        freed += temp_freed;
        actions.push(format!("Temp limpo: {} bytes.", temp_freed));
    }

    actions.push(format!("Total liberado: {} bytes.", freed));
    actions.push("NOTA: Execute recálculo de estatísticas para regenerar dados derivados.".to_string());

    Ok(CleanupResult { freed_bytes: freed, actions })
}

/// Automatic cleanup:
/// - Delete temp files older than 3 days
/// - Keep only the last 5 log files (by modification time), delete older ones
pub fn auto_cleanup(app_dir: &Path) -> Result<CleanupResult, String> {
    ensure_subdirs(app_dir)?;

    let mut actions = Vec::new();
    let mut freed: u64 = 0;

    // ── Temp cleanup: delete files older than 3 days ──
    let temp_dir = app_dir.join("temp");
    let three_days_secs: u64 = 3 * 24 * 60 * 60;
    let now = std::time::SystemTime::now();

    if temp_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&temp_dir) {
            let mut temp_deleted = 0u32;
            let mut temp_freed: u64 = 0;

            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let is_old = path
                    .metadata()
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|mod_time| now.duration_since(mod_time).ok())
                    .map(|age| age.as_secs() > three_days_secs)
                    .unwrap_or(false);

                if is_old {
                    let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                    if std::fs::remove_file(&path).is_ok() {
                        temp_freed += size;
                        temp_deleted += 1;
                    }
                }
            }

            if temp_deleted > 0 {
                freed += temp_freed;
                actions.push(format!(
                    "Temp: {} arquivo(s) antigo(s) removido(s), {} bytes liberados.",
                    temp_deleted, temp_freed
                ));
            } else {
                actions.push("Temp: nenhum arquivo com mais de 3 dias.".to_string());
            }
        }
    }

    // ── Log rotation: keep only the last 5 log files ──
    let logs_dir = app_dir.join("logs");
    if logs_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&logs_dir) {
            let mut log_files: Vec<(std::path::PathBuf, std::time::SystemTime)> = Vec::new();

            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let mod_time = path
                        .metadata()
                        .ok()
                        .and_then(|m| m.modified().ok())
                        .unwrap_or(std::time::UNIX_EPOCH);
                    log_files.push((path, mod_time));
                }
            }

            // Sort by modification time, newest first
            log_files.sort_by(|a, b| b.1.cmp(&a.1));

            if log_files.len() > 5 {
                let to_delete = &log_files[5..];
                let mut log_deleted = 0u32;
                let mut log_freed: u64 = 0;

                for (path, _) in to_delete {
                    let size = path.metadata().map(|m| m.len()).unwrap_or(0);
                    if std::fs::remove_file(path).is_ok() {
                        log_freed += size;
                        log_deleted += 1;
                    }
                }

                if log_deleted > 0 {
                    freed += log_freed;
                    actions.push(format!(
                        "Logs: {} arquivo(s) antigo(s) removido(s), mantidos os 5 mais recentes ({} bytes liberados).",
                        log_deleted, log_freed
                    ));
                }
            } else {
                actions.push(format!(
                    "Logs: {} arquivo(s) — nenhum excedente para remover.",
                    log_files.len()
                ));
            }
        }
    }

    if actions.is_empty() {
        actions.push("Nenhuma limpeza necessária.".to_string());
    }

    Ok(CleanupResult { freed_bytes: freed, actions })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_ensure_subdirs() {
        let tmp = std::env::temp_dir().join("lotolab_test_subdirs");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        ensure_subdirs(&tmp).unwrap();

        assert!(tmp.join("cache").exists());
        assert!(tmp.join("temp").exists());
        assert!(tmp.join("logs").exists());

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_dir_size() {
        let tmp = std::env::temp_dir().join("lotolab_test_dirsize");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        fs::write(tmp.join("a.txt"), "hello").unwrap();
        fs::write(tmp.join("b.txt"), "world!").unwrap();

        let size = dir_size(&tmp, false);
        assert!(size >= 11); // "hello" (5) + "world!" (6)

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_clear_dir_files() {
        let tmp = std::env::temp_dir().join("lotolab_test_cleardir");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        fs::write(tmp.join("a.txt"), "data1234").unwrap();
        fs::write(tmp.join("b.txt"), "data5678").unwrap();

        let freed = clear_dir_files(&tmp).unwrap();
        assert!(freed >= 16);

        // Directory should now be empty of files
        let count = fs::read_dir(&tmp).unwrap().count();
        assert_eq!(count, 0);

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn test_timestamp_format() {
        let ts = timestamp_for_filename();
        // Should be like "20260328_143022" — 15 chars
        assert_eq!(ts.len(), 15);
        assert!(ts.contains('_'));
    }

    #[test]
    fn test_dir_size_nonexistent() {
        let size = dir_size(Path::new("/nonexistent/path/xyz"), false);
        assert_eq!(size, 0);
    }

    #[test]
    fn test_clear_dir_files_empty() {
        let tmp = std::env::temp_dir().join("lotolab_test_cleardir_empty");
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        let freed = clear_dir_files(&tmp).unwrap();
        assert_eq!(freed, 0);

        let _ = fs::remove_dir_all(&tmp);
    }
}
