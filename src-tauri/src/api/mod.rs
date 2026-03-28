use crate::models::ApiContest;

const BASE_URL: &str = "https://loteriascaixa-api.herokuapp.com/api/megasena";

pub async fn fetch_latest() -> Result<ApiContest, String> {
    let url = format!("{}/latest", BASE_URL);
    let resp = reqwest::get(&url).await.map_err(|e| format!("Erro de rede: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("API retornou status {}", resp.status()));
    }
    let contest: ApiContest = resp.json().await.map_err(|e| format!("Erro ao processar resposta: {}", e))?;
    Ok(contest)
}

pub async fn fetch_contest(number: i64) -> Result<ApiContest, String> {
    let url = format!("{}/{}", BASE_URL, number);
    let resp = reqwest::get(&url).await.map_err(|e| format!("Erro de rede: {}", e))?;
    if !resp.status().is_success() {
        return Err(format!("API retornou status {} para concurso {}", resp.status(), number));
    }
    let contest: ApiContest = resp.json().await.map_err(|e| format!("Erro ao processar resposta: {}", e))?;
    Ok(contest)
}
