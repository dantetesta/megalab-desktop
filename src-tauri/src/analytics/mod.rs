use serde::Serialize;
use std::sync::OnceLock;

const MEASUREMENT_ID: &str = "G-FRWPJBPDMY";
const API_SECRET: &str = "GTKJcHX6Tfy-DuP3c8HuDw";
const ENDPOINT: &str = "https://www.google-analytics.com/mp/collect";

static CLIENT_ID: OnceLock<String> = OnceLock::new();

fn get_client_id() -> &'static str {
    CLIENT_ID.get_or_init(|| {
        let app_dir = dirs::data_dir().unwrap_or_default().join("com.dantetesta.lotolab");
        let cid_file = app_dir.join(".analytics_cid");
        if let Ok(cid) = std::fs::read_to_string(&cid_file) {
            if !cid.trim().is_empty() {
                return cid.trim().to_string();
            }
        }
        let cid = format!("{}.{}", rand::random::<u32>(), std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs());
        std::fs::create_dir_all(&app_dir).ok();
        std::fs::write(&cid_file, &cid).ok();
        cid
    })
}

#[derive(Serialize)]
struct GaPayload {
    client_id: String,
    events: Vec<GaEvent>,
}

#[derive(Serialize)]
struct GaEvent {
    name: String,
    params: serde_json::Value,
}

/// Send an event to GA4 via Measurement Protocol (fire-and-forget, non-blocking)
pub fn track_event(event_name: &str, params: serde_json::Value) {
    let cid = get_client_id().to_string();
    let name = event_name.to_string();

    // Use std::thread to avoid tokio runtime dependency
    std::thread::spawn(move || {
        let payload = GaPayload {
            client_id: cid,
            events: vec![GaEvent { name, params }],
        };

        let url = format!("{}?measurement_id={}&api_secret={}", ENDPOINT, MEASUREMENT_ID, API_SECRET);

        // Blocking HTTP call in a dedicated thread
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build();

        if let Ok(client) = client {
            client.post(&url).json(&payload).send().ok();
        }
    });
}

pub fn track_app_open() {
    let os_version = os_info::get();
    track_event("app_open", serde_json::json!({
        "app_version": "4.0.0",
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "os_version": os_version.to_string(),
        "language": std::env::var("LANG").unwrap_or_default(),
    }));
}

pub fn track_generate(game_type: &str, num_games: i32, mode: &str) {
    track_event("generate_games", serde_json::json!({
        "game_type": game_type,
        "num_games": num_games,
        "mode": mode,
    }));
}

pub fn track_ai_chat(provider: &str) {
    track_event("ai_chat", serde_json::json!({
        "provider": provider,
    }));
}

pub fn track_sync(game_type: &str) {
    track_event("sync_data", serde_json::json!({
        "game_type": game_type,
    }));
}

pub fn track_save_game(game_type: &str, strategy: &str) {
    track_event("save_game", serde_json::json!({
        "game_type": game_type,
        "strategy": strategy,
    }));
}

pub fn track_export(export_type: &str) {
    track_event("export_data", serde_json::json!({
        "type": export_type,
    }));
}

pub fn track_import(import_type: &str) {
    track_event("import_data", serde_json::json!({
        "type": import_type,
    }));
}

pub fn track_check_bets(game_type: &str) {
    track_event("check_bets", serde_json::json!({
        "game_type": game_type,
    }));
}
