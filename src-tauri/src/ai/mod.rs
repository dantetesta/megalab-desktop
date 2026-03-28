use serde::{Deserialize, Serialize};

// ── AI Configuration ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiConfig {
    pub provider: String,  // "openai" or "gemini"
    pub api_key: String,
    pub model: String,     // "gpt-4o-mini" or "gemini-2.0-flash"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiMessage {
    pub role: String,      // "user", "assistant", "system"
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AiResponse {
    pub message: String,
    pub config_json: Option<String>,
    pub sql_query: Option<String>, // SQL query the AI wants to execute
}

// ── Default system prompt (pt-BR) ──

const DEFAULT_SYSTEM_PROMPT: &str = r#"Voce e o LotoLab AI — assistente inteligente do aplicativo LotoLab, especializado em loterias brasileiras da CAIXA.

## QUEM VOCE E
Voce e um professor de estatistica simpatico, um estrategista de jogos lotéricos e um companheiro de analises. Voce fala de forma simples, direta, bem-humorada e acessivel. Nada de linguagem rebuscada — seus usuarios sao pessoas comuns que querem entender melhor seus jogos.

## O QUE VOCE PODE FAZER
- Consultar e analisar dados reais do banco de dados do LotoLab (concursos, dezenas, frequencias, atrasos, estatisticas)
- Ensinar conceitos de probabilidade, estatistica e matematica aplicada a loterias
- Sugerir estrategias de jogo baseadas em dados historicos
- Analisar jogos do usuario e dar feedback construtivo
- Configurar o motor LotoCore para gerar jogos otimizados
- Cruzar dados com conceitos de numerologia, astrologia e esoterismo quando o usuario pedir (desde que com logica matematica aplicada)
- Responder sobre sorte, intuicao, padroes e curiosidades do universo lotérico
- Fazer perguntas ao usuario para entender melhor o que ele quer antes de responder

## COMO VOCE RESPONDE
- Sempre em portugues do Brasil (pt-BR)
- Tom simpatico, educado, prestativo e levemente bem-humorado
- Frases curtas e claras — evite paragrafos longos
- Use analogias simples para explicar conceitos complexos
- Quando nao entender o pedido, pergunte antes de assumir
- Se o usuario for vago, sugira opcoes relacionadas
- Use emojis com moderacao para tornar a conversa agradavel
- Use formatacao Markdown: **negrito**, listas com - ou 1., tabelas quando mostrar dados tabulares
- NUNCA mostre codigo JSON, SQL ou qualquer linguagem de programacao na resposta ao usuario. Blocos de codigo sao processados internamente pelo sistema — o usuario nao precisa ve-los.
- Se precisar gerar uma configuracao para o motor, inclua o JSON em um bloco ```json``` mas NAO repita o conteudo do JSON em texto. Apenas explique o que voce configurou em linguagem simples.
- Se precisar consultar o banco, inclua o SQL em um bloco ```sql``` mas NAO mencione a query ao usuario. Apenas diga que esta consultando os dados.

## ACESSO AO BANCO DE DADOS
Voce tem acesso direto ao banco SQLite do LotoLab. Voce recebe automaticamente um resumo dos dados, mas pode pedir MAIS dados quando precisar.

COMO PEDIR MAIS DADOS: Quando precisar consultar o banco, inclua um bloco SQL na sua resposta:
```sql
SELECT ... FROM ... WHERE ... LIMIT ...
```
O sistema vai executar a query e te devolver os resultados. Ai voce responde com base nos dados reais.

TABELAS DISPONIVEIS:
- contests (id, game_type TEXT, contest_number INTEGER, contest_date TEXT, numbers_sorted_json TEXT, numbers_sorted_text TEXT, accumulated INTEGER, estimated_next_prize REAL, amount_collected REAL, trevos_json TEXT, time_coracao TEXT, mes_sorte TEXT)
- number_stats (game_type TEXT, number_value INTEGER, historical_frequency INTEGER, recent_frequency_30 INTEGER, recent_frequency_60 INTEGER, recent_frequency_100 INTEGER, current_delay INTEGER, average_gap REAL, gap_std_dev REAL)
- contest_derived_stats (contest_id INTEGER, sum_total INTEGER, even_count INTEGER, odd_count INTEGER, range_01_10 INTEGER, range_11_20 INTEGER, range_21_30 INTEGER, range_31_40 INTEGER, range_41_50 INTEGER, range_51_60 INTEGER, max_sequence_length INTEGER, dispersion_score REAL)
- contest_prizes (contest_id INTEGER, description TEXT, winners_count INTEGER, prize_value REAL)
- saved_games (id, name TEXT, numbers_json TEXT, numbers_text TEXT, strategy_id TEXT, strategy_label TEXT, is_favorite INTEGER, is_bet INTEGER, game_type TEXT)
- lunar_calendar (data TEXT PRIMARY KEY, idade_lua REAL, iluminacao REAL, fase TEXT) — calendario lunar de 1960 a 2050, com 33.238 dias. Fases: Lua Nova, Lua Crescente, Quarto Crescente, Gibosa Crescente, Lua Cheia, Gibosa Minguante, Quarto Minguante, Lua Minguante

GAME TYPES: megasena, lotofacil, quina, lotomania, maismilionaria, duplasena, timemania, diadesorte, supersete

EXEMPLOS DE QUERIES UTEIS COM CALENDARIO LUNAR:
- Fase lunar de um concurso: SELECT c.contest_number, c.contest_date, l.fase, l.iluminacao FROM contests c JOIN lunar_calendar l ON c.contest_date = l.data WHERE c.game_type = 'megasena' ORDER BY c.contest_number DESC LIMIT 10
- Contagem de sorteios por fase: SELECT l.fase, COUNT(*) as total FROM contests c JOIN lunar_calendar l ON c.contest_date = l.data WHERE c.game_type = 'megasena' GROUP BY l.fase ORDER BY total DESC
- Numeros mais sorteados na Lua Cheia: Faca JOIN contests+lunar_calendar, filtre por fase, parse numbers_sorted_json e conte frequencias
- Fase lunar de hoje: SELECT fase, iluminacao FROM lunar_calendar WHERE data = date('now')

REGRAS DE SQL:
- Apenas SELECT. Nada de INSERT/UPDATE/DELETE/DROP.
- Sempre use LIMIT (max 100 linhas).
- Use game_type = 'xxx' nos filtros.
- numbers_sorted_json e um JSON array tipo "[1,5,12,30,45,55]"

Quando receber dados com prefixo [DADOS DO BANCO], use-os como base factual. Esses dados sao reais.
Quando receber dados com prefixo [RESULTADO DA QUERY], sao resultados da query SQL que voce pediu. Use para responder o usuario.

## CONFIGURACAO DO MOTOR (quando aplicavel)
Se o usuario pedir para gerar jogos ou configurar filtros, retorne um bloco JSON:
```json
{
  "strategy_id": "string",
  "game_type": "string",
  "pick_count": number,
  "filters": {
    "min_sum": number, "max_sum": number,
    "min_even": number, "max_even": number,
    "include_numbers": [number],
    "exclude_numbers": [number]
  }
}
```

## REGRAS INVIOLAVEIS
1. NUNCA prometa premios, ganhos ou resultados. Loteria e jogo de azar e nenhuma analise garante vitoria.
2. NUNCA responda sobre: sexo, drogas, programacao, hacking, ofensas, discriminacao, legislacao ou qualquer tema fora do universo loteria/matematica/estatistica/jogos/sorte/numeros.
3. Se alguem perguntar algo proibido, responda educadamente: "Desculpa, so posso te ajudar com assuntos relacionados a loterias, estatistica e estrategias de jogo! Em que posso te ajudar nesse universo?"
4. Ao sugerir jogos, SEMPRE inclua o aviso: "Lembrando: loteria e imprevisivel e nenhuma estrategia garante premio."
5. Numerologia/astrologia: aceite como filtro criativo, mas deixe claro que nao tem base cientifica comprovada — e apenas uma forma divertida de personalizar escolhas.
6. NUNCA invente dados. Use APENAS os dados fornecidos pelo banco. Se nao tiver dados suficientes, diga: "Nao tenho dados suficientes para essa analise. Que tal sincronizar os concursos nas Configuracoes?"
7. Se o usuario for vago demais, faca perguntas: "Qual loteria voce quer analisar?", "Quantos jogos quer gerar?", "Prefere numeros quentes ou frios?"

## EXCECOES PERMITIDAS
- Numerologia: aceitar numeros da sorte, data de nascimento, signos como filtros criativos
- Astrologia: cruzar elementos astrologicos com faixas numericas quando pedido
- Esoterismo: sonhos, intuicoes — tratar com respeito e traduzir em filtros numericos quando possivel
- Curiosidades: fatos sobre loterias, maiores premios, estatisticas curiosas do historico"#;

// ── Database context builder for AI ──

use crate::db::Database;

/// Build a context string from the database for the AI to use.
/// Runs safe read-only queries and formats results as text.
pub fn build_db_context(db: &Database, game_type: &str) -> String {
    let mut ctx = String::new();
    ctx.push_str("[DADOS DO BANCO]\n\n");

    let conn = match db.conn.lock() {
        Ok(c) => c,
        Err(_) => return ctx,
    };

    // 1. Total contests and date range
    let total: i64 = conn.query_row(
        "SELECT COUNT(*) FROM contests WHERE game_type = ?1", rusqlite::params![game_type], |r| r.get(0)
    ).unwrap_or(0);
    let last_number: i64 = conn.query_row(
        "SELECT COALESCE(MAX(contest_number), 0) FROM contests WHERE game_type = ?1", rusqlite::params![game_type], |r| r.get(0)
    ).unwrap_or(0);
    let first_date: String = conn.query_row(
        "SELECT COALESCE(MIN(contest_date), '?') FROM contests WHERE game_type = ?1", rusqlite::params![game_type], |r| r.get(0)
    ).unwrap_or_else(|_| "?".into());
    let last_date: String = conn.query_row(
        "SELECT COALESCE(MAX(contest_date), '?') FROM contests WHERE game_type = ?1", rusqlite::params![game_type], |r| r.get(0)
    ).unwrap_or_else(|_| "?".into());

    ctx.push_str(&format!("Loteria: {}\nTotal de concursos: {}\nUltimo concurso: #{}\nPeriodo: {} a {}\n\n", game_type, total, last_number, first_date, last_date));

    if total == 0 {
        ctx.push_str("(Sem dados para esta loteria. Sugira ao usuario sincronizar nas Configuracoes.)\n");
        return ctx;
    }

    // 2. Top 15 numbers by frequency
    ctx.push_str("TOP 15 NUMEROS MAIS FREQUENTES:\n");
    if let Ok(mut stmt) = conn.prepare(
        "SELECT number_value, historical_frequency, recent_frequency_30, current_delay FROM number_stats WHERE game_type = ?1 ORDER BY historical_frequency DESC LIMIT 15"
    ) {
        if let Ok(rows) = stmt.query_map(rusqlite::params![game_type], |r| {
            Ok((r.get::<_, i32>(0)?, r.get::<_, i32>(1)?, r.get::<_, i32>(2)?, r.get::<_, i32>(3)?))
        }) {
            for row in rows.flatten() {
                ctx.push_str(&format!("  Num {:02}: freq={}, ultimos30={}, atraso={}\n", row.0, row.1, row.2, row.3));
            }
        }
    }

    // 3. Top 10 most delayed numbers
    ctx.push_str("\nTOP 10 NUMEROS MAIS ATRASADOS:\n");
    if let Ok(mut stmt) = conn.prepare(
        "SELECT number_value, current_delay, historical_frequency FROM number_stats WHERE game_type = ?1 ORDER BY current_delay DESC LIMIT 10"
    ) {
        if let Ok(rows) = stmt.query_map(rusqlite::params![game_type], |r| {
            Ok((r.get::<_, i32>(0)?, r.get::<_, i32>(1)?, r.get::<_, i32>(2)?))
        }) {
            for row in rows.flatten() {
                ctx.push_str(&format!("  Num {:02}: atraso={} concursos, freq.total={}\n", row.0, row.1, row.2));
            }
        }
    }

    // 4. Last 20 contest results
    ctx.push_str("\nULTIMOS 20 CONCURSOS:\n");
    if let Ok(mut stmt) = conn.prepare(
        "SELECT contest_number, contest_date, numbers_sorted_text, accumulated FROM contests WHERE game_type = ?1 ORDER BY contest_number DESC LIMIT 20"
    ) {
        if let Ok(rows) = stmt.query_map(rusqlite::params![game_type], |r| {
            Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, i32>(3)?))
        }) {
            for row in rows.flatten() {
                let acum = if row.3 == 1 { " (ACUMULOU)" } else { "" };
                ctx.push_str(&format!("  #{} ({}): [{}]{}\n", row.0, row.1, row.2, acum));
            }
        }
    }

    // 5. Average sum and parity stats from last 100 contests
    ctx.push_str("\nESTATISTICAS (ultimos 100 concursos):\n");
    if let Ok(mut stmt) = conn.prepare(
        "SELECT AVG(ds.sum_total), AVG(ds.even_count), AVG(ds.odd_count), AVG(ds.max_sequence_length) FROM contest_derived_stats ds JOIN contests c ON ds.contest_id = c.id WHERE c.game_type = ?1 ORDER BY c.contest_number DESC LIMIT 100"
    ) {
        if let Ok(row) = stmt.query_row(rusqlite::params![game_type], |r| {
            Ok((r.get::<_, f64>(0).unwrap_or(0.0), r.get::<_, f64>(1).unwrap_or(0.0), r.get::<_, f64>(2).unwrap_or(0.0), r.get::<_, f64>(3).unwrap_or(0.0)))
        }) {
            ctx.push_str(&format!("  Soma media: {:.0}\n  Media pares: {:.1}\n  Media impares: {:.1}\n  Sequencia media: {:.1}\n", row.0, row.1, row.2, row.3));
        }
    }

    // 6. Saved games count
    let saved: i64 = conn.query_row(
        "SELECT COUNT(*) FROM saved_games WHERE game_type = ?1", rusqlite::params![game_type], |r| r.get(0)
    ).unwrap_or(0);
    if saved > 0 {
        ctx.push_str(&format!("\nJOGOS SALVOS DO USUARIO: {}\n", saved));
    }

    // 7. Lunar calendar info (if available)
    let lunar_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM lunar_calendar", [], |r| r.get(0)
    ).unwrap_or(0);
    if lunar_count > 0 {
        ctx.push_str("\nCALENDARIO LUNAR: Disponivel (1960-2050).\n");
        // Today's lunar phase
        if let Ok(row) = conn.query_row(
            "SELECT fase, iluminacao, idade_lua FROM lunar_calendar WHERE data = date('now')",
            [], |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, f64>(2)?))
        ) {
            ctx.push_str(&format!("Fase lunar HOJE: {} (iluminacao: {:.1}%, idade: {:.1} dias)\n", row.0, row.1, row.2));
        }
        // Lunar phases of last 5 contests
        ctx.push_str("Fases lunares dos ultimos 5 concursos:\n");
        if let Ok(mut stmt) = conn.prepare(
            "SELECT c.contest_number, c.contest_date, COALESCE(l.fase, '?') FROM contests c LEFT JOIN lunar_calendar l ON c.contest_date = l.data WHERE c.game_type = ?1 ORDER BY c.contest_number DESC LIMIT 5"
        ) {
            if let Ok(rows) = stmt.query_map(rusqlite::params![game_type], |r| {
                Ok((r.get::<_, i64>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?))
            }) {
                for row in rows.flatten() {
                    ctx.push_str(&format!("  #{} ({}): {}\n", row.0, row.1, row.2));
                }
            }
        }
    }

    ctx
}

/// Execute a safe read-only SQL query and return results as formatted text.
/// Only allows SELECT statements for security.
pub fn execute_safe_query(db: &Database, sql: &str) -> Result<String, String> {
    let trimmed = sql.trim().to_uppercase();
    if !trimmed.starts_with("SELECT") {
        return Err("Apenas consultas SELECT sao permitidas.".to_string());
    }
    // Block dangerous keywords
    for keyword in &["DROP", "DELETE", "UPDATE", "INSERT", "ALTER", "CREATE", "PRAGMA", "ATTACH", "DETACH"] {
        if trimmed.contains(keyword) {
            return Err(format!("Operacao '{}' nao permitida. Apenas leitura.", keyword));
        }
    }

    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(sql).map_err(|e| format!("Erro na query: {}", e))?;
    let col_count = stmt.column_count();
    let col_names: Vec<String> = (0..col_count).map(|i| stmt.column_name(i).unwrap_or("?").to_string()).collect();

    let mut result = col_names.join(" | ");
    result.push('\n');
    result.push_str(&"-".repeat(result.len()));
    result.push('\n');

    let mut rows_found = 0u32;
    let mut rows = stmt.query([]).map_err(|e| e.to_string())?;
    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        if rows_found >= 50 { result.push_str("... (limitado a 50 linhas)\n"); break; }
        let vals: Vec<String> = (0..col_count).map(|i| {
            row.get::<_, String>(i)
                .or_else(|_| row.get::<_, i64>(i).map(|v| v.to_string()))
                .or_else(|_| row.get::<_, f64>(i).map(|v| format!("{:.2}", v)))
                .unwrap_or_else(|_| "NULL".into())
        }).collect();
        result.push_str(&vals.join(" | "));
        result.push('\n');
        rows_found += 1;
    }

    if rows_found == 0 {
        result.push_str("(nenhum resultado)\n");
    }

    Ok(result)
}

// ── OpenAI API types ──

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<OpenAiMessage>,
    temperature: f64,
    max_tokens: u32,
}

#[derive(Serialize)]
struct OpenAiMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    choices: Option<Vec<OpenAiChoice>>,
    error: Option<OpenAiError>,
}

#[derive(Deserialize)]
struct OpenAiChoice {
    message: Option<OpenAiRespMessage>,
}

#[derive(Deserialize)]
struct OpenAiRespMessage {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAiError {
    message: Option<String>,
}

// ── Gemini API types ──

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiGenerationConfig,
}

#[derive(Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Serialize)]
struct GeminiGenerationConfig {
    temperature: f64,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: u32,
}

#[derive(Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
    error: Option<GeminiError>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiRespContent>,
}

#[derive(Deserialize)]
struct GeminiRespContent {
    parts: Option<Vec<GeminiRespPart>>,
}

#[derive(Deserialize)]
struct GeminiRespPart {
    text: Option<String>,
}

#[derive(Deserialize)]
struct GeminiError {
    message: Option<String>,
}

// ── Public API ──

/// Send a chat request to the configured AI provider.
/// Combines the system prompt with user messages and returns the AI response.
pub async fn chat(
    config: &AiConfig,
    messages: Vec<AiMessage>,
    system_prompt: &str,
) -> Result<AiResponse, String> {
    let prompt = if system_prompt.is_empty() {
        DEFAULT_SYSTEM_PROMPT
    } else {
        system_prompt
    };

    match config.provider.as_str() {
        "openai" => chat_openai(config, messages, prompt).await,
        "gemini" => chat_gemini(config, messages, prompt).await,
        other => Err(format!("Provedor de IA desconhecido: '{}'. Use 'openai' ou 'gemini'.", other)),
    }
}

/// Return the built-in default system prompt.
pub fn get_default_system_prompt() -> &'static str {
    DEFAULT_SYSTEM_PROMPT
}

// ── OpenAI implementation ──

async fn chat_openai(
    config: &AiConfig,
    messages: Vec<AiMessage>,
    system_prompt: &str,
) -> Result<AiResponse, String> {
    if config.api_key.is_empty() {
        return Err("Chave de API da OpenAI não configurada.".to_string());
    }

    let model = if config.model.is_empty() {
        "gpt-4o-mini".to_string()
    } else {
        config.model.clone()
    };

    // Build message list: system prompt + conversation history
    let mut api_messages = vec![OpenAiMessage {
        role: "system".to_string(),
        content: system_prompt.to_string(),
    }];
    for msg in &messages {
        api_messages.push(OpenAiMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    let request_body = OpenAiRequest {
        model,
        messages: api_messages,
        temperature: 0.7,
        max_tokens: 2000,
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao chamar OpenAI: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Erro ao ler resposta da OpenAI: {}", e))?;

    if !status.is_success() {
        // Try to parse error message from response body
        if let Ok(err_resp) = serde_json::from_str::<OpenAiResponse>(&body) {
            if let Some(err) = err_resp.error {
                return Err(format!(
                    "OpenAI API erro ({}): {}",
                    status,
                    err.message.unwrap_or_else(|| "Erro desconhecido".to_string())
                ));
            }
        }
        return Err(format!("OpenAI API erro HTTP {}: {}", status, body));
    }

    let parsed: OpenAiResponse =
        serde_json::from_str(&body).map_err(|e| format!("Erro ao parsear resposta da OpenAI: {}", e))?;

    let content = parsed
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message)
        .and_then(|m| m.content)
        .unwrap_or_default();

    Ok(parse_ai_content(&content))
}

// ── Gemini implementation ──

async fn chat_gemini(
    config: &AiConfig,
    messages: Vec<AiMessage>,
    system_prompt: &str,
) -> Result<AiResponse, String> {
    if config.api_key.is_empty() {
        return Err("Chave de API do Gemini não configurada.".to_string());
    }

    let model = if config.model.is_empty() {
        "gemini-2.0-flash".to_string()
    } else {
        config.model.clone()
    };

    // Gemini uses a single "contents" array. We combine the system prompt and
    // conversation history into a multi-turn format.
    // The system instruction is prepended to the first user message since
    // Gemini v1beta generateContent doesn't have a dedicated system role for
    // all model variants.
    let mut combined_text = String::new();

    // Prepend system prompt as context
    combined_text.push_str("[Instruções do sistema]\n");
    combined_text.push_str(system_prompt);
    combined_text.push_str("\n\n[Conversa]\n");

    for msg in &messages {
        let role_label = match msg.role.as_str() {
            "user" => "Usuário",
            "assistant" => "Assistente",
            "system" => "Sistema",
            other => other,
        };
        combined_text.push_str(&format!("{}: {}\n", role_label, msg.content));
    }

    combined_text.push_str("\nAssistente:");

    let request_body = GeminiRequest {
        contents: vec![GeminiContent {
            parts: vec![GeminiPart {
                text: combined_text,
            }],
        }],
        generation_config: GeminiGenerationConfig {
            temperature: 0.7,
            max_output_tokens: 2000,
        },
    };

    let url = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
        model, config.api_key
    );

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Erro de rede ao chamar Gemini: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("Erro ao ler resposta do Gemini: {}", e))?;

    if !status.is_success() {
        if let Ok(err_resp) = serde_json::from_str::<GeminiResponse>(&body) {
            if let Some(err) = err_resp.error {
                return Err(format!(
                    "Gemini API erro ({}): {}",
                    status,
                    err.message.unwrap_or_else(|| "Erro desconhecido".to_string())
                ));
            }
        }
        return Err(format!("Gemini API erro HTTP {}: {}", status, body));
    }

    let parsed: GeminiResponse =
        serde_json::from_str(&body).map_err(|e| format!("Erro ao parsear resposta do Gemini: {}", e))?;

    let content = parsed
        .candidates
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.content)
        .and_then(|c| c.parts)
        .and_then(|p| p.into_iter().next())
        .and_then(|p| p.text)
        .unwrap_or_default();

    Ok(parse_ai_content(&content))
}

// ── Response parsing ──

/// Parse AI response content, extracting any JSON config block if present.
/// Looks for ```json ... ``` or a raw JSON object containing "strategy_id".
fn parse_ai_content(content: &str) -> AiResponse {
    let trimmed = content.trim();
    let mut config_json: Option<String> = None;
    let mut sql_query: Option<String> = None;
    let mut message = trimmed.to_string();

    // Extract SQL query from ```sql ... ``` blocks
    if let Some(sql) = extract_sql_block(trimmed) {
        let clean_sql = sql.trim().to_string();
        if clean_sql.to_uppercase().starts_with("SELECT") {
            sql_query = Some(clean_sql);
            message = remove_code_block(trimmed, "sql");
        }
    }

    // Extract JSON config from ```json ... ``` blocks
    if let Some(json_str) = extract_json_block(trimmed) {
        if is_engine_config(&json_str) {
            config_json = Some(json_str);
            message = remove_code_block(&message, "json");
        }
    }

    // Try raw JSON object
    if config_json.is_none() {
        if let Some(json_str) = extract_raw_json_object(&message) {
            if is_engine_config(&json_str) {
                config_json = Some(json_str.clone());
                message = message.replace(&json_str, "");
            }
        }
    }

    let final_message = message.trim().to_string();

    AiResponse {
        message: if final_message.is_empty() && config_json.is_some() {
            "Configuracao gerada com sucesso.".to_string()
        } else if final_message.is_empty() && sql_query.is_some() {
            "Consultando dados...".to_string()
        } else {
            final_message
        },
        config_json,
        sql_query,
    }
}

/// Extract content from ```sql ... ``` code fences.
fn extract_sql_block(text: &str) -> Option<String> {
    let markers = ["```sql", "```SQL"];
    for marker in markers {
        if let Some(start_idx) = text.find(marker) {
            let content_start = start_idx + marker.len();
            if let Some(end_idx) = text[content_start..].find("```") {
                let sql = text[content_start..content_start + end_idx].trim().to_string();
                if !sql.is_empty() {
                    return Some(sql);
                }
            }
        }
    }
    None
}

/// Remove a code block with a specific language marker from text.
fn remove_code_block(text: &str, lang: &str) -> String {
    let markers = [format!("```{}", lang), format!("```{}", lang.to_uppercase()), "```".to_string()];
    let mut result = text.to_string();
    for marker in &markers {
        if let Some(start_idx) = result.find(marker.as_str()) {
            let content_start = start_idx + marker.len();
            if let Some(end_idx) = result[content_start..].find("```") {
                let block_end = content_start + end_idx + 3;
                result = format!("{}{}", &result[..start_idx], &result[block_end..]);
                break;
            }
        }
    }
    result
}

/// Extract content from ```json ... ``` code fences.
fn extract_json_block(text: &str) -> Option<String> {
    // Match ```json ... ``` or ``` ... ```
    let markers = ["```json", "```JSON", "```"];
    for marker in markers {
        if let Some(start_idx) = text.find(marker) {
            let content_start = start_idx + marker.len();
            if let Some(end_idx) = text[content_start..].find("```") {
                let json_str = text[content_start..content_start + end_idx].trim().to_string();
                if !json_str.is_empty() {
                    return Some(json_str);
                }
            }
        }
    }
    None
}

/// Remove ```json ... ``` code fences from text, leaving surrounding content.
fn remove_json_block(text: &str) -> String {
    let markers = ["```json", "```JSON", "```"];
    let mut result = text.to_string();
    for marker in markers {
        if let Some(start_idx) = result.find(marker) {
            let content_start = start_idx + marker.len();
            if let Some(end_idx) = result[content_start..].find("```") {
                let block_end = content_start + end_idx + 3;
                result = format!("{}{}", &result[..start_idx], &result[block_end..]);
                break;
            }
        }
    }
    result
}

/// Try to extract a raw JSON object {...} from text.
fn extract_raw_json_object(text: &str) -> Option<String> {
    let start = text.find('{')?;
    let mut depth = 0i32;
    let mut end = start;
    for (i, ch) in text[start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    end = start + i + 1;
                    break;
                }
            }
            _ => {}
        }
    }
    if depth == 0 && end > start {
        let candidate = &text[start..end];
        // Verify it's valid JSON
        if serde_json::from_str::<serde_json::Value>(candidate).is_ok() {
            return Some(candidate.to_string());
        }
    }
    None
}

/// Check if a JSON string looks like a LotoCore engine config.
fn is_engine_config(json_str: &str) -> bool {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
        // Must have at least one of these engine-config keys
        val.get("strategy_id").is_some()
            || val.get("game_type").is_some()
            || val.get("filters").is_some()
            || val.get("pick_count").is_some()
    } else {
        false
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_plain_text() {
        let resp = parse_ai_content("Olá! Como posso ajudar?");
        assert_eq!(resp.message, "Olá! Como posso ajudar?");
        assert!(resp.config_json.is_none());
    }

    #[test]
    fn test_parse_with_json_block() {
        let content = r#"Aqui está a configuração:

```json
{"strategy_id": "frequencia", "game_type": "megasena", "pick_count": 6}
```

Use essa configuração para gerar seus jogos."#;
        let resp = parse_ai_content(content);
        assert!(resp.config_json.is_some());
        let config = resp.config_json.unwrap();
        assert!(config.contains("strategy_id"));
        assert!(config.contains("frequencia"));
    }

    #[test]
    fn test_parse_with_raw_json() {
        let content = r#"Configuração: {"strategy_id": "equilibrado", "pick_count": 6}"#;
        let resp = parse_ai_content(content);
        assert!(resp.config_json.is_some());
    }

    #[test]
    fn test_parse_no_engine_config() {
        let content = r#"O resultado: {"total": 42, "items": []}"#;
        let resp = parse_ai_content(content);
        // This JSON does not contain engine-config keys
        assert!(resp.config_json.is_none());
    }

    #[test]
    fn test_extract_json_block() {
        let text = "```json\n{\"a\": 1}\n```";
        assert_eq!(extract_json_block(text), Some("{\"a\": 1}".to_string()));
    }

    #[test]
    fn test_extract_json_block_none() {
        assert_eq!(extract_json_block("no json here"), None);
    }

    #[test]
    fn test_is_engine_config() {
        assert!(is_engine_config(r#"{"strategy_id": "test"}"#));
        assert!(is_engine_config(r#"{"game_type": "megasena"}"#));
        assert!(is_engine_config(r#"{"filters": {}}"#));
        assert!(!is_engine_config(r#"{"total": 42}"#));
        assert!(!is_engine_config("not json"));
    }
}
