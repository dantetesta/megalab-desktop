use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const API_URL: &str = "https://dantetesta.com.br/lotolab/anuncios.php";
const BEARER_TOKEN: &str = "LotoLabAPI";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BannerData {
    pub updated_at: String,
    pub banners: Vec<Banner>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Banner {
    pub id: String,
    pub position: String, // "sidebar", "dashboard", "internal"
    pub image_url: String,
    pub link_url: String,
    pub title: String,
    pub duration_seconds: u32,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalBanner {
    pub id: String,
    pub position: String,
    pub local_image_path: String,
    pub image_url: String, // original remote URL as fallback
    pub link_url: String,
    pub title: String,
    pub duration_seconds: u32,
}

/// Fetch banner data from the API
pub async fn fetch_banners() -> Result<BannerData, String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(API_URL)
        .header("Authorization", format!("Bearer {}", BEARER_TOKEN))
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao buscar anuncios: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("API anuncios retornou status {}", resp.status()));
    }

    let data: BannerData = resp
        .json()
        .await
        .map_err(|e| format!("Erro ao parsear anuncios: {}", e))?;

    Ok(data)
}

/// Get the banners directory inside app data
fn banners_dir(app_dir: &Path) -> PathBuf {
    app_dir.join("banners")
}

/// Get the cached metadata file path
fn cache_file(app_dir: &Path) -> PathBuf {
    app_dir.join("banners").join("_cache.json")
}

/// Load cached banner data
fn load_cache(app_dir: &Path) -> Option<BannerData> {
    let path = cache_file(app_dir);
    if path.exists() {
        let data = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str(&data).ok()
    } else {
        None
    }
}

/// Save banner data to cache
fn save_cache(app_dir: &Path, data: &BannerData) {
    let dir = banners_dir(app_dir);
    std::fs::create_dir_all(&dir).ok();
    let path = cache_file(app_dir);
    if let Ok(json) = serde_json::to_string_pretty(data) {
        std::fs::write(path, json).ok();
    }
}

/// Download a single image and return the local path
async fn download_image(url: &str, save_path: &Path) -> Result<(), String> {
    let resp = reqwest::get(url)
        .await
        .map_err(|e| format!("Erro ao baixar imagem: {}", e))?;

    if !resp.status().is_success() {
        return Err(format!("Imagem retornou status {}", resp.status()));
    }

    let bytes = resp
        .bytes()
        .await
        .map_err(|e| format!("Erro ao ler imagem: {}", e))?;

    std::fs::write(save_path, &bytes).map_err(|e| format!("Erro ao salvar imagem: {}", e))?;

    Ok(())
}

/// Sync banners: fetch from API, compare with cache, download new images, cleanup old
pub async fn sync_banners(app_dir: &Path) -> Result<Vec<LocalBanner>, String> {
    let dir = banners_dir(app_dir);
    std::fs::create_dir_all(&dir).ok();

    // Try to fetch from API
    let api_data = match fetch_banners().await {
        Ok(data) => data,
        Err(e) => {
            log::warn!("Falha ao buscar anuncios: {}. Usando cache.", e);
            // Fall back to cache
            return load_local_banners(app_dir);
        }
    };

    // Check if we need to update
    let cached = load_cache(app_dir);
    let needs_update = match &cached {
        Some(c) => c.updated_at != api_data.updated_at,
        None => true,
    };

    if needs_update {
        // Cleanup old images (keep _cache.json)
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file()
                    && path
                        .file_name()
                        .map(|n| n != "_cache.json")
                        .unwrap_or(false)
                {
                    std::fs::remove_file(&path).ok();
                }
            }
        }

        // Download new images
        for banner in &api_data.banners {
            let ext = banner.image_url.rsplit('.').next().unwrap_or("jpg");
            let filename = format!("{}.{}", banner.id, ext);
            let save_path = dir.join(&filename);

            if let Err(e) = download_image(&banner.image_url, &save_path).await {
                log::warn!("Falha ao baixar banner {}: {}", banner.id, e);
            }
        }

        // Save new cache
        save_cache(app_dir, &api_data);
        log::info!("Anuncios atualizados: {} banners", api_data.banners.len());
    } else {
        log::info!("Anuncios em cache ainda validos.");
    }

    // Build local banner list
    load_local_banners(app_dir)
}

/// Load banners from local cache + images
pub fn load_local_banners(app_dir: &Path) -> Result<Vec<LocalBanner>, String> {
    let cached = load_cache(app_dir).unwrap_or(BannerData {
        updated_at: String::new(),
        banners: vec![],
    });
    let dir = banners_dir(app_dir);

    let mut local_banners = vec![];
    for banner in &cached.banners {
        let ext = banner.image_url.rsplit('.').next().unwrap_or("jpg");
        let filename = format!("{}.{}", banner.id, ext);
        let local_path = dir.join(&filename);

        local_banners.push(LocalBanner {
            id: banner.id.clone(),
            position: banner.position.clone(),
            local_image_path: if local_path.exists() { local_path.to_string_lossy().to_string() } else { String::new() },
            image_url: banner.image_url.clone(),
            link_url: banner.link_url.clone(),
            title: banner.title.clone(),
            duration_seconds: banner.duration_seconds,
        });
    }

    Ok(local_banners)
}
