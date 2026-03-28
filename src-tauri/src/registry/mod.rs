use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LotteryConfig {
    pub game_type: String,
    pub display_name: String,
    pub api_path: String,
    pub numbers_pool_size: i32,
    pub min_pick_count: i32,
    pub max_pick_count: i32,
    pub default_pick_count: i32,
    pub has_trevos: bool,
    pub trevo_pool_size: i32,
    pub trevo_pick_count: i32,
    pub has_time_coracao: bool,
    pub has_mes_sorte: bool,
    pub sort_order: i32,
    pub color: String,
}

pub fn get_all_lotteries() -> Vec<LotteryConfig> {
    vec![
        LotteryConfig {
            game_type: "megasena".into(),
            display_name: "Mega-Sena".into(),
            api_path: "megasena".into(),
            numbers_pool_size: 60,
            min_pick_count: 6, max_pick_count: 20, default_pick_count: 6,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 1, color: "#4ADE80".into(),
        },
        LotteryConfig {
            game_type: "lotofacil".into(),
            display_name: "Lotofácil".into(),
            api_path: "lotofacil".into(),
            numbers_pool_size: 25,
            min_pick_count: 15, max_pick_count: 20, default_pick_count: 15,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 2, color: "#E879F9".into(),
        },
        LotteryConfig {
            game_type: "quina".into(),
            display_name: "Quina".into(),
            api_path: "quina".into(),
            numbers_pool_size: 80,
            min_pick_count: 5, max_pick_count: 15, default_pick_count: 5,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 3, color: "#A78BFA".into(),
        },
        LotteryConfig {
            game_type: "lotomania".into(),
            display_name: "Lotomania".into(),
            api_path: "lotomania".into(),
            numbers_pool_size: 100,
            min_pick_count: 50, max_pick_count: 50, default_pick_count: 50,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 4, color: "#FB923C".into(),
        },
        LotteryConfig {
            game_type: "maismilionaria".into(),
            display_name: "+Milionária".into(),
            api_path: "maismilionaria".into(),
            numbers_pool_size: 50,
            min_pick_count: 6, max_pick_count: 12, default_pick_count: 6,
            has_trevos: true, trevo_pool_size: 6, trevo_pick_count: 2,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 5, color: "#60A5FA".into(),
        },
        LotteryConfig {
            game_type: "duplasena".into(),
            display_name: "Dupla Sena".into(),
            api_path: "duplasena".into(),
            numbers_pool_size: 50,
            min_pick_count: 6, max_pick_count: 15, default_pick_count: 6,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 6, color: "#F87171".into(),
        },
        LotteryConfig {
            game_type: "timemania".into(),
            display_name: "Timemania".into(),
            api_path: "timemania".into(),
            numbers_pool_size: 80,
            min_pick_count: 10, max_pick_count: 10, default_pick_count: 10,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: true, has_mes_sorte: false,
            sort_order: 7, color: "#34D399".into(),
        },
        LotteryConfig {
            game_type: "diadesorte".into(),
            display_name: "Dia de Sorte".into(),
            api_path: "diadesorte".into(),
            numbers_pool_size: 31,
            min_pick_count: 7, max_pick_count: 15, default_pick_count: 7,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: true,
            sort_order: 8, color: "#FBBF24".into(),
        },
        LotteryConfig {
            game_type: "supersete".into(),
            display_name: "Super Sete".into(),
            api_path: "supersete".into(),
            numbers_pool_size: 10,
            min_pick_count: 7, max_pick_count: 21, default_pick_count: 7,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 9, color: "#BEF264".into(),
        },
        LotteryConfig {
            game_type: "federal".into(),
            display_name: "Federal".into(),
            api_path: "federal".into(),
            numbers_pool_size: 0,
            min_pick_count: 0, max_pick_count: 0, default_pick_count: 0,
            has_trevos: false, trevo_pool_size: 0, trevo_pick_count: 0,
            has_time_coracao: false, has_mes_sorte: false,
            sort_order: 10, color: "#93C5FD".into(),
        },
    ]
}

pub fn get_lottery_config(game_type: &str) -> Option<LotteryConfig> {
    get_all_lotteries().into_iter().find(|l| l.game_type == game_type)
}

pub const MESES_DA_SORTE: &[&str] = &[
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

pub const TIMES_TIMEMANIA: &[&str] = &[
    "ABC/RN", "Águia de Marabá/PA", "Aparecidense/GO", "Atlético/AC",
    "Atlético/GO", "Atlético/MG", "Atlético/PR", "Avaí/SC",
    "Bahia/BA", "Barueri/SP", "Botafogo/PB", "Botafogo/RJ",
    "Brasiliense/DF", "Brusque/SC", "CSA/AL", "CRB/AL",
    "Campinense/PB", "Ceará/CE", "Chapecoense/SC", "Cianorte/PR",
    "Coritiba/PR", "Corinthians/SP", "Criciúma/SC", "Cruzeiro/MG",
    "Cuiabá/MT", "Desportiva Ferroviária/ES", "Fast Clube/AM",
    "Figueirense/SC", "Flamengo/RJ", "Fluminense/RJ", "Fortaleza/CE",
    "Goiás/GO", "Grêmio/RS", "Guarani/SP", "Inter de Limeira/SP",
    "Internacional/RS", "Ituano/SP", "Ji-Paraná/RO", "Joinville/SC",
    "Juventude/RS", "Londrina/PR", "Luverdense/MT", "Manaus/AM",
    "Marília/SP", "Mirassol/SP", "Mixto/MT", "Moto Club/MA",
    "Nacional/AM", "Náutico/PE", "Novorizontino/SP", "Operário/MS",
    "Operário/PR", "Paysandu/PA", "Palmeiras/SP", "Paraná Clube/PR",
    "Ponte Preta/SP", "Portugal/RJ", "Remo/PA", "River/PI",
    "Sampaio Corrêa/MA", "Santa Cruz/PE", "Santos/SP", "Sport/PE",
    "São Bento/SP", "São Caetano/SP", "São Paulo/SP", "São Raimundo/AM",
    "Tombense/MG", "Treze/PB", "Tupi/MG", "Vila Nova/GO",
    "Vitória/BA", "Vitória/ES", "Volta Redonda/RJ",
    "XV de Piracicaba/SP",
];

/// Default bet prices per lottery and pick count
pub fn get_default_prices() -> Vec<(String, i32, f64)> {
    let mut prices = vec![];
    // Mega-Sena
    let ms = [(6, 5.00), (7, 35.00), (8, 140.00), (9, 420.00), (10, 1050.00), (11, 2310.00), (12, 4620.00), (13, 8580.00), (14, 15015.00), (15, 25025.00), (16, 40040.00), (17, 61880.00), (18, 92820.00), (19, 135660.00), (20, 193800.00)];
    for (n, p) in ms { prices.push(("megasena".into(), n, p)); }
    // Lotofácil
    let lf = [(15, 3.00), (16, 48.00), (17, 408.00), (18, 2448.00), (19, 11628.00), (20, 46512.00)];
    for (n, p) in lf { prices.push(("lotofacil".into(), n, p)); }
    // Quina
    let q = [(5, 2.50), (6, 15.00), (7, 52.50), (8, 150.00), (9, 375.00), (10, 850.00), (11, 1787.50), (12, 3525.00), (13, 6600.00), (14, 11825.00), (15, 20387.50)];
    for (n, p) in q { prices.push(("quina".into(), n, p)); }
    // Lotomania
    prices.push(("lotomania".into(), 50, 3.00));
    // +Milionária
    let mm = [(6, 6.00), (7, 42.00), (8, 168.00), (9, 504.00), (10, 1260.00), (11, 2772.00), (12, 5544.00)];
    for (n, p) in mm { prices.push(("maismilionaria".into(), n, p)); }
    // Dupla Sena
    let ds = [(6, 2.50), (7, 17.50), (8, 70.00), (9, 210.00), (10, 525.00), (11, 1155.00), (12, 2310.00), (13, 4290.00), (14, 7507.50), (15, 12512.50)];
    for (n, p) in ds { prices.push(("duplasena".into(), n, p)); }
    // Timemania
    prices.push(("timemania".into(), 10, 3.50));
    // Dia de Sorte
    let dds = [(7, 2.50), (8, 20.00), (9, 90.00), (10, 315.00), (11, 945.00), (12, 2520.00), (13, 6006.00), (14, 13013.00), (15, 25740.00)];
    for (n, p) in dds { prices.push(("diadesorte".into(), n, p)); }
    // Super Sete
    let ss = [(7, 2.50), (8, 5.00), (9, 10.00), (10, 20.00), (11, 40.00), (12, 80.00), (13, 160.00), (14, 320.00), (15, 640.00)];
    for (n, p) in ss { prices.push(("supersete".into(), n, p)); }

    prices
}
