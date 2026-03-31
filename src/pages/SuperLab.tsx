import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useLotteryStore } from '@/stores/lotteryStore'
import { useAppStore } from '@/stores/appStore'
import { api } from '@/lib/tauri'
import LotteryTabs from '@/components/LotteryTabs'
import BannerCarousel from '@/components/BannerCarousel'
import type {
  SuperLabBacktestSummary,
  SuperLabCooccurrenceEntry,
  SuperLabPortfolioScore,
  SuperLabAdvancedAnalytics,
  SuperLabMonteCarloResult,
  SuperLabSetCoverResult,
  SuperLabStrategy,
  SuperLabOptimizedPortfolio,
  SuperLabMultiObjectiveResult,
  SuperLabDistributionAnalysis,
  SuperLabTripleEntry,
  SuperLabPeriodCompareResult,
  SuperLabGeneticResult,
  SuperLabSAResult,
  SuperLabRedundancyResult,
  SuperLabProbabilityResult,
  SuperLabPortfolioCompareResult,
} from '@/lib/tauri'
import { cn } from '@/lib/utils'
import {
  FlaskConical, Zap, Search, BarChart3, Save, Loader2,
  TrendingUp, Shield, Target, Layers, ChevronRight,
  Activity, Atom, BookOpen, Trash2, Crosshair, RefreshCw,
  ThermometerSun, ThermometerSnowflake, Copy, ExternalLink, Download,
  Percent, GitCompare, Dna, Thermometer, Minus,
} from 'lucide-react'

// ── Tabs ──
const TABS = [
  { id: 'analytics',     label: 'Análise',       icon: Activity },
  { id: 'backtest',      label: 'Backtest',       icon: Search },
  { id: 'montecarlo',    label: 'Monte Carlo',    icon: Atom },
  { id: 'pares',         label: 'Pares',          icon: BarChart3 },
  { id: 'filtros',       label: 'Gerar',          icon: Zap },
  { id: 'cobertura',     label: 'Cobertura',      icon: Crosshair },
  { id: 'otimizar',      label: 'Otimizar',       icon: TrendingUp },
  { id: 'probabilidade', label: 'Probabilidade',  icon: Percent },
  { id: 'comparar',      label: 'Comparar',       icon: GitCompare },
  { id: 'estrategias',   label: 'Estratégias',    icon: BookOpen },
] as const
type Tab = typeof TABS[number]['id']

// ── Atoms ──
function Ball({ n, hot, cold }: { n: number; hot?: boolean; cold?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-extrabold font-mono tabular-nums shrink-0',
      hot  ? 'bg-amber-500 text-white shadow-[0_2px_8px_rgba(245,158,11,0.4)]'
           : cold ? 'bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.4)]'
           : 'bg-muted text-foreground',
    )}>
      {String(n).padStart(2, '0')}
    </span>
  )
}

function HitBall({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-extrabold font-mono bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(0,0,0,0.4)] shrink-0">
      {String(n).padStart(2, '0')}
    </span>
  )
}

function SectionHead({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div>
        <h3 className="text-[17px] font-[800] tracking-tight">{title}</h3>
        {sub && <p className="text-[13px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <div className="text-[26px] font-[900] tabular-nums leading-tight text-foreground">{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mt-1">{label}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function RunButton({ onClick, loading, label, loadingLabel, icon: Icon = Loader2 }: {
  onClick: () => void; loading: boolean; label: string; loadingLabel: string; icon?: React.ElementType
}) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[14px] font-bold disabled:opacity-50 hover:opacity-90 active:scale-[0.98] transition-all">
      {loading ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
      {loading ? loadingLabel : label}
    </button>
  )
}

function SubTabBar<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-0.5 p-1 rounded-xl bg-muted w-fit mb-6">
      {options.map(o => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className={cn('px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap',
            value === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── WeightControl — replaces all broken <input type="range"> sliders ──
// Precision instrument: 5 clickable step segments + gradient fill bar
function WeightControl({ label, description, value, onChange }: {
  label: string; description?: string; value: number; onChange: (v: number) => void
}) {
  const steps = [0, 0.5, 1.0, 1.5, 2.0] as const
  const labels = ['Off', '×0.5', '×1.0', '×1.5', '×2.0'] as const
  const fillPct = (value / 2) * 100
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 hover:border-primary/30 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className="text-[14px] font-semibold text-foreground">{label}</span>
          {description && <p className="text-[12px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        <span className={cn(
          'text-[22px] font-black tabular-nums leading-none transition-colors',
          value === 0 ? 'text-muted-foreground' : 'text-primary'
        )}>{value === 0 ? 'Off' : `×${value.toFixed(1)}`}</span>
      </div>
      {/* Gradient fill bar */}
      <div className="relative h-2 rounded-full bg-muted/80 mb-3 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
          style={{
            width: `${fillPct}%`,
            background: value === 0 ? 'transparent' : 'linear-gradient(90deg, hsl(var(--primary)/0.5), hsl(var(--primary)))'
          }}
        />
        {/* Tick marks */}
        {steps.map(s => (
          <div key={s} className="absolute top-1/2 w-0.5 h-3 -translate-y-1/2 -translate-x-1/2 bg-background/40 rounded-full"
            style={{ left: `${(s / 2) * 100}%` }} />
        ))}
      </div>
      {/* Step buttons */}
      <div className="flex gap-1.5">
        {steps.map((step, i) => (
          <button key={step} onClick={() => onChange(step)}
            className={cn(
              'flex-1 py-2 rounded-lg text-[12px] font-bold border transition-all',
              value === step
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            )}>
            {labels[i]}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Hybrid lottery domain badge ──
function HybridDomainBadge({ config }: { config: { has_trevos: boolean; has_time_coracao: boolean; has_mes_sorte: boolean; display_name: string } | undefined }) {
  if (!config) return null
  const domains: { label: string; color: string }[] = []
  if (config.has_time_coracao) domains.push({ label: 'Time do Coração', color: 'text-green-400 bg-green-400/10 border-green-400/20' })
  if (config.has_mes_sorte) domains.push({ label: 'Mês da Sorte', color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' })
  if (config.has_trevos) domains.push({ label: 'Trevos', color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20' })
  if (!domains.length) return null
  return (
    <div className="mb-5 rounded-xl border border-border bg-card/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide">Domínios especiais desta loteria</span>
      </div>
      <div className="flex flex-wrap gap-2 mb-2">
        {domains.map(d => (
          <span key={d.label} className={cn('px-2.5 py-1 rounded-lg text-[12px] font-semibold border', d.color)}>{d.label}</span>
        ))}
      </div>
      <p className="text-[12px] text-muted-foreground">
        Esta loteria possui campos especiais além das dezenas. A análise estatística das dezenas está disponível acima.
        {config.has_time_coracao && ' O Time do Coração é sorteado independentemente e segue regras próprias de premiação.'}
        {config.has_mes_sorte && ' O Mês da Sorte é um campo adicional com 12 opções e prêmio próprio.'}
        {config.has_trevos && ' Os Trevos (1–6) são sorteados em paralelo e multiplicam o prêmio principal.'}
      </p>
    </div>
  )
}

// ── JSON export helper ──
function exportJSON(games: number[][], filename: string) {
  const data = { games: games.map((g, i) => ({ jogo: i + 1, numeros: g, soma: g.reduce((a, b) => a + b, 0) })) }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Shared helpers ──
function useCopyGames(showToast: (msg: string, type: 'success' | 'error' | 'info') => void) {
  return useCallback((games: number[][]) => {
    const text = games.map(g => g.map(n => String(n).padStart(2, '0')).join(' ')).join('\n')
    navigator.clipboard.writeText(text)
      .then(() => showToast('Jogos copiados!', 'success'))
      .catch(() => showToast('Erro ao copiar', 'error'))
  }, [showToast])
}

function useSendToMeusJogos(gameType: string, showToast: (msg: string, type: 'success' | 'error' | 'info') => void) {
  return useCallback(async (games: number[][], label = 'Apostado') => {
    let ok = 0
    for (const g of games) {
      try { await api.saveGame({ numbers: g, strategy_id: 'apostado', strategy_label: label, game_type: gameType }); ok++ }
      catch { /* skip individual errors */ }
    }
    showToast(`${ok} jogo${ok !== 1 ? 's' : ''} salvo${ok !== 1 ? 's' : ''} em Meus Jogos!`, 'success')
  }, [gameType, showToast])
}

function exportCSV(games: number[][], filename: string) {
  const cols = Math.max(...games.map(g => g.length), 1)
  const header = ['jogo', ...Array.from({ length: cols }, (_, i) => `n${i + 1}`)].join(',')
  const rows = games.map((g, i) => [i + 1, ...g].join(','))
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Distribuição sub-tab ──
function DistribuicaoSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [lastN, setLastN] = useState<number | null>(null)
  const [data, setData] = useState<SuperLabDistributionAnalysis | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    try { setData(await api.superlabDistributionAnalysis(gameType, lastN ?? undefined)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, lastN, showToast])

  const ranges = data ? [
    { label: '01–10', val: data.range_01_10 },
    { label: '11–20', val: data.range_11_20 },
    { label: '21–30', val: data.range_21_30 },
    { label: '31–40', val: data.range_31_40 },
    { label: '41–50', val: data.range_41_50 },
    { label: '51–60', val: data.range_51_60 },
  ].filter(r => r.val > 0) : []
  const maxRange = Math.max(...ranges.map(r => r.val), 1)

  return (
    <div>
      <SectionHead icon={BarChart3} title="Análise de Distribuição" sub="Dezenas por faixa, paridade, primos, fibonacci, soma e repetições." />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Últimos</label>
          <select value={lastN ?? ''} onChange={e => setLastN(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            <option value="">Todos</option>
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-[11px] font-semibold text-muted-foreground">concursos</label>
        </div>
        <RunButton onClick={run} loading={loading} label="Analisar" loadingLabel="Calculando..." icon={BarChart3} />
      </div>
      {data && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard label="Concursos" value={data.total_contests.toLocaleString()} />
            <StatCard label="Soma média" value={data.avg_sum.toFixed(1)} />
            <StatCard label="Pares/sorteio" value={data.avg_even.toFixed(2)} />
            <StatCard label="Repetições" value={data.avg_repeats_from_last.toFixed(2)} sub="vs último" />
          </div>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="Primos/sorteio" value={data.avg_primes.toFixed(2)} />
            <StatCard label="Fibonacci/sorteio" value={data.avg_fibonacci.toFixed(2)} />
            {data.moldura_miolo && (
              <StatCard label="Moldura/Miolo" value={`${data.moldura_miolo.avg_moldura.toFixed(1)} / ${data.moldura_miolo.avg_miolo.toFixed(1)}`} sub="Lotofácil 5×5" />
            )}
          </div>
          {ranges.length > 0 && (
            <div className="mb-5">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Dezenas por faixa (média/sorteio)</div>
              <div className="flex flex-col gap-1.5">
                {ranges.map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold w-12 shrink-0">{r.label}</span>
                    <div className="flex-1 h-6 rounded bg-muted relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded bg-primary/40" style={{ width: `${(r.val / maxRange) * 100}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[12px] font-bold">{r.val.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.sum_histogram.length > 0 && (
            <div className="mb-5">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Histograma de Somas</div>
              <div className="flex flex-col gap-1">
                {data.sum_histogram.map(b => (
                  <div key={b.range_label} className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-muted-foreground w-16 shrink-0">{b.range_label}</span>
                    <div className="flex-1 h-5 rounded bg-muted relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded bg-primary/30" style={{ width: `${b.pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold">{b.count} ({b.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.repeats_distribution.length > 0 && (
            <div>
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Repetições do último sorteio</div>
              <div className="flex flex-col gap-1">
                {data.repeats_distribution.map(b => (
                  <div key={b.repeats} className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-muted-foreground w-16 shrink-0">{b.repeats} repet.</span>
                    <div className="flex-1 h-5 rounded bg-muted relative overflow-hidden">
                      <div className="absolute inset-y-0 left-0 rounded bg-amber-500/30" style={{ width: `${b.pct}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[11px] font-bold">{b.count} ({b.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Comparar Períodos sub-tab ──
function PeriodosSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [windowA, setWindowA] = useState(50)
  const [windowB, setWindowB] = useState(100)
  const [data, setData] = useState<SuperLabPeriodCompareResult | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    try { setData(await api.superlabPeriodCompare(gameType, windowA, windowB)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, windowA, windowB, showToast])

  return (
    <div>
      <SectionHead icon={GitCompare} title="Comparar Períodos" sub="Ganhos e perdas de frequência/score entre dois períodos históricos." />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Período A</label>
          <select value={windowA} onChange={e => setWindowA(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            {[20, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Período B</label>
          <select value={windowB} onChange={e => setWindowB(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <RunButton onClick={run} loading={loading} label="Comparar" loadingLabel="Calculando..." icon={GitCompare} />
      </div>
      {data && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} className="text-green-500" />
              <span className="text-[12px] font-bold text-green-500 uppercase tracking-wide">Maiores Ganhos</span>
              <span className="text-[11px] text-muted-foreground ml-1">(A vs B)</span>
            </div>
            <div className="flex flex-col gap-1">
              {data.top_gainers.map(d => (
                <div key={d.number} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted">
                  <Ball n={d.number} hot />
                  <div className="flex-1 text-[12px] font-mono text-green-400">
                    score +{d.score_delta.toFixed(3)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Δatr {d.delay_delta > 0 ? '+' : ''}{d.delay_delta}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Minus size={14} className="text-red-500" />
              <span className="text-[12px] font-bold text-red-500 uppercase tracking-wide">Maiores Perdas</span>
            </div>
            <div className="flex flex-col gap-1">
              {data.top_losers.map(d => (
                <div key={d.number} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted">
                  <Ball n={d.number} cold />
                  <div className="flex-1 text-[12px] font-mono text-red-400">
                    score {d.score_delta.toFixed(3)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">Δatr {d.delay_delta > 0 ? '+' : ''}{d.delay_delta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Análise Avançada
// ═══════════════════════════════════════════════════════
const ANALYTICS_SUBTABS = [
  { id: 'freq' as const, label: 'Frequência' },
  { id: 'distrib' as const, label: 'Distribuição' },
  { id: 'periodos' as const, label: 'Períodos' },
]

function FrequenciaSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const enabledGames = useLotteryStore(s => s.enabledGames)
  const currentConfig = enabledGames.find(g => g.game_type === gameType)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SuperLabAdvancedAnalytics | null>(null)
  const [window, setWindow] = useState<number | null>(null)
  const [view, setView] = useState<'freq' | 'delay' | 'score'>('freq')

  const run = useCallback(async () => {
    setLoading(true)
    try { setData(await api.superlabAdvancedAnalytics(gameType, window ?? undefined)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, window, showToast])

  const sorted = useMemo(() => {
    if (!data) return []
    const arr = [...data.numbers]
    if (view === 'freq') return arr.sort((a, b) => b.frequency - a.frequency)
    if (view === 'delay') return arr.sort((a, b) => b.delay - a.delay)
    return arr.sort((a, b) => b.score - a.score)
  }, [data, view])

  const maxBarVal = useMemo(() => sorted[0]
    ? view === 'freq' ? sorted[0].frequency : view === 'delay' ? sorted[0].delay : 100
    : 1, [sorted, view])

  return (
    <div>
      <SectionHead icon={Activity} title="Análise Avançada" sub="Frequência, atraso, entropia, pares quentes, insights — por janela de concursos." />
      <HybridDomainBadge config={currentConfig} />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Últimos</label>
          <select value={window ?? ''} onChange={e => setWindow(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            <option value="">Todos</option>
            {[30, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <label className="text-[11px] font-semibold text-muted-foreground">concursos</label>
        </div>
        <RunButton onClick={run} loading={loading} label="Analisar" loadingLabel="Calculando..." icon={Activity} />
      </div>

      {data && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard label="Concursos" value={data.total_contests.toLocaleString()} sub={window ? `Janela: ${data.window}` : undefined} />
            <StatCard label="Soma média" value={data.sum_avg.toFixed(1)} />
            <StatCard label="Pares/sorteio" value={data.even_avg.toFixed(1)} />
            <StatCard label="Entropia" value={data.entropy.toFixed(2)} sub="Shannon" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThermometerSun size={14} className="text-amber-500" />
                <span className="text-[12px] font-bold text-amber-500 uppercase tracking-wide">Mais frequentes</span>
              </div>
              <div className="flex flex-wrap gap-1">{data.top_hot.map(n => <Ball key={n} n={n} hot />)}</div>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ThermometerSnowflake size={14} className="text-blue-500" />
                <span className="text-[12px] font-bold text-blue-500 uppercase tracking-wide">Mais atrasadas</span>
              </div>
              <div className="flex flex-wrap gap-1">{data.top_cold.map(n => <Ball key={n} n={n} cold />)}</div>
            </div>
          </div>

          {data.insights.length > 0 && (
            <div className="mb-5 rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col gap-1.5">
              {data.insights.map((ins, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-primary mt-px">•</span>
                  <span className="text-[11px] text-foreground">{ins}</span>
                </div>
              ))}
            </div>
          )}

          {data.top_pairs.length > 0 && (
            <div className="mb-5">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Pares mais frequentes</div>
              <div className="flex flex-wrap gap-2">
                {data.top_pairs.map((p, i) => (
                  <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted">
                    <Ball n={p.num_a} /><Ball n={p.num_b} />
                    <span className="text-[12px] font-bold text-muted-foreground ml-1">{p.frequency}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-3">
            {(['freq', 'delay', 'score'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1 rounded-md text-[11px] font-semibold transition-colors',
                  view === v ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {v === 'freq' ? 'Frequência' : v === 'delay' ? 'Atraso' : 'Score'}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-1">
            {sorted.map(n => {
              const barVal = view === 'freq' ? n.frequency : view === 'delay' ? n.delay : Math.round(n.score * 100)
              const barW = Math.max(2, (barVal / maxBarVal) * 100)
              const isHot = data.top_hot.includes(n.number)
              const isCold = data.top_cold.includes(n.number)
              return (
                <div key={n.number} className="flex items-center gap-2">
                  <span className={cn('w-7 text-right text-[11px] font-mono font-bold shrink-0',
                    isHot ? 'text-amber-500' : isCold ? 'text-blue-500' : 'text-foreground')}>
                    {String(n.number).padStart(2, '0')}
                  </span>
                  <div className="flex-1 h-5 rounded bg-muted overflow-hidden relative">
                    <div className={cn('absolute inset-y-0 left-0 rounded transition-all',
                      isHot ? 'bg-amber-500/40' : isCold ? 'bg-blue-500/40' : 'bg-primary/30')}
                      style={{ width: `${barW}%` }} />
                    <span className="absolute inset-0 flex items-center px-2 text-[12px] font-bold text-foreground">
                      {view === 'freq' ? `${barVal}× (${n.freq_pct.toFixed(1)}%)` : view === 'delay' ? `${barVal} atraso` : `score ${barVal}`}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground w-16 text-right shrink-0">
                    {view !== 'delay' ? `atr:${n.delay}` : `freq:${n.frequency}`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function AnalyticsTab({ gameType }: { gameType: string }) {
  const [subTab, setSubTab] = useState<'freq' | 'distrib' | 'periodos'>('freq')
  return (
    <div>
      <SubTabBar options={ANALYTICS_SUBTABS} value={subTab} onChange={setSubTab} />
      {subTab === 'freq'     && <FrequenciaSubTab   gameType={gameType} />}
      {subTab === 'distrib'  && <DistribuicaoSubTab  gameType={gameType} />}
      {subTab === 'periodos' && <PeriodosSubTab      gameType={gameType} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Backtesting
// ═══════════════════════════════════════════════════════
function BacktestTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [input, setInput] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<SuperLabBacktestSummary[]>([])

  const parseGames = (text: string): number[][] =>
    text.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => l.replace(/[^0-9\s,;]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b))
      .filter(g => g.length >= 5)

  const run = useCallback(async () => {
    const games = parseGames(input)
    if (!games.length) { showToast('Insira ao menos 1 jogo (mín. 5 números por linha)', 'error'); return }
    if (games.length > 20) { showToast('Máximo 20 jogos por vez', 'error'); return }
    setRunning(true)
    try { setResults(await api.superlabBacktestGames(games, gameType)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setRunning(false) }
  }, [input, gameType, showToast])

  const save = useCallback(async (game: number[], name: string) => {
    try {
      await api.superlabSaveStrategy({ name, game_type: gameType, strategy_type: 'backtest', config_json: '{}', games: [game], notes: null })
      showToast('Salvo nas Estratégias!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [gameType, showToast])

  return (
    <div>
      <SectionHead icon={Search} title="Backtesting Histórico" sub="Cole jogos (um por linha) e veja desempenho histórico completo." />
      <textarea value={input} onChange={e => setInput(e.target.value)}
        className="w-full h-[110px] rounded-xl border border-border bg-card px-4 py-3 text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
        placeholder={"01 05 12 23 34 45\n03 07 14 28 36 51"} />
      <div className="mt-3"><RunButton onClick={run} loading={running} label="Analisar jogos" loadingLabel="Analisando..." icon={Search} /></div>
      {results.length > 0 && (
        <div className="mt-6 flex flex-col gap-4">
          {results.map((r, i) => <BacktestCard key={i} summary={r} onSave={name => save(r.game, name)} />)}
        </div>
      )}
    </div>
  )
}

function BacktestCard({ summary, onSave }: { summary: SuperLabBacktestSummary; onSave: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const hitRate = summary.total_contests > 0 ? (summary.hits.length / Number(summary.total_contests) * 100).toFixed(2) : '0.00'
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap flex-1">{summary.game.map(n => <Ball key={n} n={n} />)}</div>
        <button onClick={() => onSave(`Backtest ${summary.game.join('-')}`)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition-colors shrink-0">
          <Save size={11} /> Salvar
        </button>
      </div>
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        {[['Concursos', summary.total_contests.toLocaleString()], ['Premiações', summary.hits.length], ['Taxa', `${hitRate}%`], ['Máx acertos', summary.max_hits]].map(([l, v]) => (
          <div key={l} className="text-center">
            <div className="text-[18px] font-[900] tabular-nums text-foreground leading-tight">{v}</div>
            <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mt-px">{l}</div>
          </div>
        ))}
      </div>
      {summary.hits.length > 0 && (
        <>
          <button onClick={() => setExpanded(p => !p)}
            className="w-full flex items-center justify-between px-4 py-2.5 border-t border-border text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors">
            <span>Ver {summary.hits.length} premiação{summary.hits.length !== 1 ? 'ões' : ''}</span>
            <ChevronRight size={14} className={cn('transition-transform', expanded && 'rotate-90')} />
          </button>
          {expanded && (
            <div className="px-4 pb-4 flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
              {summary.hits.map((h, i) => (
                <div key={i} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-[12px] font-mono text-muted-foreground w-14 shrink-0">#{h.contest_number}</span>
                  <span className="text-[12px] text-muted-foreground w-20 shrink-0">{h.contest_date}</span>
                  <div className="flex gap-0.5 flex-1 flex-wrap">{h.hits.map(n => <HitBall key={n} n={n} />)}</div>
                  <span className={cn('text-[11px] font-bold shrink-0', h.hit_count >= 6 ? 'text-yellow-400' : h.hit_count >= 5 ? 'text-purple-400' : h.hit_count >= 4 ? 'text-blue-400' : 'text-primary')}>
                    {h.hit_count}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Monte Carlo
// ═══════════════════════════════════════════════════════
function MonteCarloTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [input, setInput] = useState('')
  const [iters, setIters] = useState(10000)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuperLabMonteCarloResult | null>(null)

  const run = useCallback(async () => {
    const nums = input.replace(/[^0-9\s,;]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b)
    if (nums.length < 5) { showToast('Insira pelo menos 5 números', 'error'); return }
    setLoading(true)
    try { setResult(await api.superlabMonteCarlo(nums, gameType, iters)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [input, gameType, iters, showToast])

  const hitLabels = result ? Array.from({ length: result.hit_counts.length }, (_, i) => `${result.min_prize_hits + i} acertos`) : []

  return (
    <div>
      <SectionHead icon={Atom} title="Simulação Monte Carlo" sub="Simula N sorteios sintéticos e estima a distribuição de acertos do seu jogo." />
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Números do jogo (ex: 01 05 12 23 34 45)"
          className="flex-1 min-w-[200px] rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50" />
        <select value={iters} onChange={e => setIters(Number(e.target.value))}
          className="rounded-xl border border-border bg-card px-3 py-2.5 text-[12px] focus:outline-none">
          {[1000, 5000, 10000, 50000, 100000].map(n => <option key={n} value={n}>{n.toLocaleString()} iterações</option>)}
        </select>
      </div>
      <RunButton onClick={run} loading={loading} label="Simular" loadingLabel="Simulando..." icon={Atom} />

      {result && (
        <div className="mt-6">
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="Iterações" value={result.iterations.toLocaleString()} />
            <StatCard label="Premiações" value={result.hit_counts.reduce((a, b) => a + b, 0).toLocaleString()} />
            <StatCard label="Concursos p/ prêmio" value={result.expected_contests_to_prize == null || !isFinite(result.expected_contests_to_prize) ? '∞' : result.expected_contests_to_prize.toFixed(0)} />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">Distribuição de acertos premiáveis</div>
            <div className="flex flex-col gap-2">
              {result.hit_counts.map((count, i) => {
                const pct = result.hit_pcts[i]
                const color = i === result.hit_counts.length - 1 ? 'bg-yellow-500/40' : i >= result.hit_counts.length - 2 ? 'bg-purple-500/40' : 'bg-primary/30'
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-bold w-20 shrink-0 text-foreground">{hitLabels[i]}</span>
                    <div className="flex-1 h-6 rounded bg-muted relative overflow-hidden">
                      <div className={cn('absolute inset-y-0 left-0 rounded', color)} style={{ width: `${Math.max(0.5, pct)}%` }} />
                      <span className="absolute inset-0 flex items-center px-2 text-[12px] font-bold text-foreground">
                        {count.toLocaleString()} ({pct.toFixed(3)}%)
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
            ⚠ Simulação probabilística usando sorteios sintéticos. Não representa previsão de sorteios reais.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Trios sub-tab ──
function TriosSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [topN, setTopN] = useState(30)
  const [lastN, setLastN] = useState<number | null>(null)
  const [data, setData] = useState<SuperLabTripleEntry[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.superlabTripleCooccurrence(gameType, topN, lastN ?? undefined)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, topN, lastN, showToast])

  const maxFreq = data[0]?.frequency ?? 1
  return (
    <div>
      <SectionHead icon={BarChart3} title="Trios Mais Frequentes" sub="Top trios de dezenas que aparecem juntos com maior frequência." />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Top</label>
          <select value={topN} onChange={e => setTopN(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            {[20, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Últimos</label>
          <select value={lastN ?? ''} onChange={e => setLastN(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            <option value="">Todos</option>
            {[100, 200, 500].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <RunButton onClick={load} loading={loading} label="Calcular trios" loadingLabel="Calculando..." icon={BarChart3} />
      </div>
      {data.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {data.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] font-mono text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
              <Ball n={e.num_a} /><Ball n={e.num_b} /><Ball n={e.num_c} />
              <div className="flex-1 h-[20px] rounded bg-muted relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded bg-primary/30" style={{ width: `${e.frequency / maxFreq * 100}%` }} />
                <span className="absolute inset-0 flex items-center px-2 text-[12px] font-bold">{e.frequency}×</span>
              </div>
              <span className="text-[12px] font-mono text-muted-foreground w-12 text-right shrink-0">{e.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const PARES_SUBTABS = [
  { id: 'pares' as const, label: 'Pares' },
  { id: 'trios' as const, label: 'Trios' },
]

// ═══════════════════════════════════════════════════════
// Tab: Pares
// ═══════════════════════════════════════════════════════
function ParesSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SuperLabCooccurrenceEntry[]>([])
  const [topN, setTopN] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await api.superlabGetCooccurrence(gameType, 200)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, showToast])

  const maxFreq = data[0]?.frequency ?? 1
  const visible = data.slice(0, topN)

  return (
    <div>
      <SectionHead icon={BarChart3} title="Pares Mais Frequentes" sub="Coocorrência histórica de pares de dezenas." />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <RunButton onClick={load} loading={loading} label={data.length > 0 ? 'Recalcular' : 'Calcular pares'} loadingLabel="Calculando..." icon={BarChart3} />
        {data.length > 0 && (
          <>
            {[20, 50, 100, 200].map(n => (
              <button key={n} onClick={() => setTopN(n)}
                className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors', topN === n ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}>
                Top {n}
              </button>
            ))}
            <span className="text-[12px] text-muted-foreground ml-auto">{data.length.toLocaleString()} pares</span>
          </>
        )}
      </div>
      {data.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {visible.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[12px] font-mono text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
              <Ball n={e.num_a} /><Ball n={e.num_b} />
              <div className="flex-1 h-[20px] rounded bg-muted relative overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded bg-primary/30" style={{ width: `${e.frequency / maxFreq * 100}%` }} />
                <span className="absolute inset-0 flex items-center px-2 text-[12px] font-bold">{e.frequency}×</span>
              </div>
              <span className="text-[12px] font-mono text-muted-foreground w-12 text-right shrink-0">{e.pct.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ParesTab({ gameType }: { gameType: string }) {
  const [subTab, setSubTab] = useState<'pares' | 'trios'>('pares')
  return (
    <div>
      <SubTabBar options={PARES_SUBTABS} value={subTab} onChange={setSubTab} />
      {subTab === 'pares' && <ParesSubTab  gameType={gameType} />}
      {subTab === 'trios' && <TriosSubTab  gameType={gameType} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Gerar Filtrado + Diverso
// ═══════════════════════════════════════════════════════
function FiltrosTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const cfg = useLotteryStore(s => s.enabledGames).find(l => l.game_type === gameType)
  const poolSize = cfg?.numbers_pool_size ?? 60
  const pickCount = cfg?.default_pick_count ?? 6
  const midSum = Math.round(poolSize * pickCount / 2)

  const [mode, setMode] = useState<'filtered' | 'diverse'>('filtered')
  const [sumMin, setSumMin] = useState<number | null>(Math.round(midSum * 0.8))
  const [sumMax, setSumMax] = useState<number | null>(Math.round(midSum * 1.2))
  const [evenMin, setEvenMin] = useState<number | null>(null)
  const [evenMax, setEvenMax] = useState<number | null>(null)
  const [repeatsMax, setRepeatsMax] = useState<number | null>(null)
  const [strategy, setStrategy] = useState('hibrido')
  const [count, setCount] = useState(6)
  const [minDist, setMinDist] = useState(0.45)
  const [loading, setLoading] = useState(false)
  const [games, setGames] = useState<number[][]>([])
  const [score, setScore] = useState<SuperLabPortfolioScore | null>(null)

  const copyGames = useCopyGames(showToast)
  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)

  const generate = useCallback(async () => {
    setLoading(true)
    try {
      let result: number[][]
      if (mode === 'filtered') {
        result = await api.superlabGenerateFiltered({ game_type: gameType, count, sum_min: sumMin, sum_max: sumMax, even_min: evenMin, even_max: evenMax, repeats_max: repeatsMax, strategy_id: strategy })
      } else {
        result = await api.superlabGenerateDiverse(gameType, count, minDist)
      }
      setGames(result)
      if (result.length > 0) setScore(await api.superlabScorePortfolio(result, gameType))
      if (result.length < count) showToast(`Gerados ${result.length}/${count}. Tente ampliar os filtros.`, 'info')
    } catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, mode, count, sumMin, sumMax, evenMin, evenMax, repeatsMax, strategy, minDist, showToast])

  const saveAll = useCallback(async () => {
    if (!games.length) return
    try {
      await api.superlabSaveStrategy({ name: `${mode === 'diverse' ? 'Diverso' : 'Filtrado'} ${new Date().toLocaleDateString('pt-BR')}`, game_type: gameType, strategy_type: mode, config_json: JSON.stringify({ sumMin, sumMax, evenMin, evenMax, strategy }), games, notes: null })
      showToast(`${games.length} jogos salvos nas Estratégias!`, 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [games, gameType, mode, sumMin, sumMax, evenMin, evenMax, strategy, showToast])

  const Num = ({ label, value, onChange, min, max }: { label: string; value: number | null; onChange: (v: number | null) => void; min?: number; max?: number }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">{label}</label>
      <input type="number" min={min} max={max} placeholder="Auto" value={value ?? ''}
        onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="rounded-lg border border-border bg-muted px-3 py-2 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40" />
    </div>
  )

  return (
    <div>
      <SectionHead icon={Zap} title="Geração Inteligente" sub="Filtros estatísticos ou carteira de máxima diversidade." />

      <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit mb-4">
        {(['filtered', 'diverse'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={cn('px-4 py-1.5 rounded-md text-[12px] font-semibold transition-colors', mode === m ? 'bg-card text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {m === 'filtered' ? 'Com Filtros' : 'Máx. Diversidade'}
          </button>
        ))}
      </div>

      {mode === 'filtered' ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Num label="Soma mín." value={sumMin} onChange={setSumMin} min={pickCount} max={poolSize * pickCount} />
          <Num label="Soma máx." value={sumMax} onChange={setSumMax} min={pickCount} max={poolSize * pickCount} />
          <Num label="Pares mín." value={evenMin} onChange={setEvenMin} min={0} max={pickCount} />
          <Num label="Pares máx." value={evenMax} onChange={setEvenMax} min={0} max={pickCount} />
          <Num label="Repetições máx. (último)" value={repeatsMax} onChange={setRepeatsMax} min={0} max={pickCount} />
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">Estratégia</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value)}
              className="rounded-lg border border-border bg-muted px-3 py-2 text-[13px] focus:outline-none">
              <option value="hibrido">Híbrido</option>
              <option value="frequencia_historica">Frequência histórica</option>
              <option value="frequencia_recente">Frequência recente</option>
              <option value="atrasadas">Atrasadas</option>
              <option value="balanceado">Balanceado</option>
              <option value="aleatorio_puro">Aleatório puro</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-semibold text-muted-foreground uppercase tracking-[0.06em]">Dist. mínima (Jaccard)</label>
            <input type="number" min={0.1} max={0.9} step={0.05} value={minDist}
              onChange={e => setMinDist(Number(e.target.value))}
              className="rounded-lg border border-border bg-muted px-3 py-2 text-[13px] font-mono focus:outline-none" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-muted-foreground">Qtd:</label>
          <select value={count} onChange={e => setCount(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] focus:outline-none">
            {[1, 3, 5, 6, 10, 15, 20].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <RunButton onClick={generate} loading={loading} label="Gerar jogos" loadingLabel="Gerando..." icon={Zap} />
        {games.length > 0 && (
          <>
            <button onClick={saveAll} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => copyGames(games)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Copy size={14} /> Copiar
            </button>
            <button onClick={() => sendToMeusJogos(games)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <ExternalLink size={14} /> Meus Jogos
            </button>
            <button onClick={() => exportCSV(games, `jogos_${gameType}_${new Date().toISOString().slice(0,10)}.csv`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportJSON(games, `jogos_${gameType}_${new Date().toISOString().slice(0,10)}.json`)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> JSON
            </button>
          </>
        )}
      </div>

      {score && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4 grid grid-cols-4 gap-2">
          {[
            { label: 'Cobertura', value: `${score.coverage_pct.toFixed(0)}%`, icon: Target },
            { label: 'Únicas', value: score.distinct_numbers, icon: Layers },
            { label: 'Overlap', value: score.avg_overlap.toFixed(1), icon: Shield },
            { label: 'Diversidade', value: `${score.diversity_score.toFixed(0)}% — ${score.quality_label}`, icon: TrendingUp },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center">
              <Icon size={13} className="mx-auto text-primary mb-1" />
              <div className="text-[14px] font-[900] tabular-nums">{value}</div>
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {games.length > 0 && (
        <div className="flex flex-col gap-2">
          {games.map((g, i) => (
            <div key={i} className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-card">
              <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
              <div className="flex gap-1 flex-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
              <div className="flex gap-2 text-[12px] font-mono text-muted-foreground shrink-0">
                <span>Σ{g.reduce((a, b) => a + b, 0)}</span>
                <span>{g.filter(n => n % 2 === 0).length}P/{g.length - g.filter(n => n % 2 === 0).length}I</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Cobertura de Pares
// ═══════════════════════════════════════════════════════
function CoberturaTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuperLabSetCoverResult | null>(null)

  const copyGames = useCopyGames(showToast)
  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)

  const run = useCallback(async () => {
    const nums = input.replace(/[^0-9\s,;]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b)
    const unique = [...new Set(nums)]
    if (unique.length < 6) { showToast('Insira pelo menos 6 dezenas base', 'error'); return }
    if (unique.length > 25) { showToast('Máximo 25 dezenas base', 'error'); return }
    setLoading(true)
    try { setResult(await api.superlabGreedyCover(unique, gameType)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [input, gameType, showToast])

  const saveResult = useCallback(async () => {
    if (!result) return
    try {
      await api.superlabSaveStrategy({ name: `Cobertura ${result.coverage_pct.toFixed(0)}% — ${new Date().toLocaleDateString('pt-BR')}`, game_type: gameType, strategy_type: 'coverage', config_json: JSON.stringify({ coverage_pct: result.coverage_pct, total_pairs: result.total_pairs }), games: result.tickets, notes: null })
      showToast('Cobertura salva nas Estratégias!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [result, gameType, showToast])

  return (
    <div>
      <SectionHead icon={Crosshair} title="Cobertura de Pares" sub="Encontra o menor conjunto de jogos que cobre todos os pares das dezenas base escolhidas." />

      <div className="mb-4 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
        Informe de <strong>6 a 25 dezenas</strong> base. O algoritmo guloso gera jogos que cobrem todos os pares possíveis com o menor número de apostas.
      </div>

      <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ex: 01 05 07 12 15 18 23 27 30 35"
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[13px] font-mono focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 mb-4" />

      <div className="flex gap-2 flex-wrap">
        <RunButton onClick={run} loading={loading} label="Calcular cobertura" loadingLabel="Calculando..." icon={Crosshair} />
        {result && (
          <>
            <button onClick={saveResult} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => copyGames(result.tickets)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Copy size={14} /> Copiar
            </button>
            <button onClick={() => sendToMeusJogos(result.tickets, 'Cobertura SuperLab')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <ExternalLink size={14} /> Meus Jogos
            </button>
            <button onClick={() => exportCSV(result.tickets, `cobertura_${gameType}.csv`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportJSON(result.tickets, `cobertura_${gameType}.json`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> JSON
            </button>
          </>
        )}
      </div>

      {result && (
        <div className="mt-5">
          <div className="grid grid-cols-4 gap-2 mb-4">
            <StatCard label="Jogos gerados" value={result.tickets.length} />
            <StatCard label="Pares cobertos" value={result.covered_pairs.toLocaleString()} />
            <StatCard label="Total pares" value={result.total_pairs.toLocaleString()} />
            <StatCard label="Cobertura" value={`${result.coverage_pct.toFixed(1)}%`} />
          </div>
          <div className="mb-3">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${result.coverage_pct}%` }} />
            </div>
          </div>
          <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto">
            {result.tickets.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card">
                <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex gap-1 flex-wrap">{t.map(n => <Ball key={n} n={n} />)}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">
            ⚠ Cobertura teórica de pares. Não garante prêmio em sorteios reais. Algoritmo guloso — resultado é aproximado.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Genético sub-tab ──
function GeneticoSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [portfolioSize, setPortfolioSize] = useState(5)
  const [popSize, setPopSize] = useState(20)
  const [generations, setGenerations] = useState(40)
  const [wFreq, setWFreq] = useState(1)
  const [wDiv, setWDiv] = useState(1)
  const [wCov, setWCov] = useState(1)
  const [result, setResult] = useState<SuperLabGeneticResult | null>(null)

  const copyGames = useCopyGames(showToast)
  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)

  const run = useCallback(async () => {
    setLoading(true)
    try { setResult(await api.superlabGeneticOptimize(gameType, portfolioSize, popSize, generations, wFreq, wDiv, wCov)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, portfolioSize, popSize, generations, wFreq, wDiv, wCov, showToast])

  const saveResult = useCallback(async () => {
    if (!result) return
    try {
      await api.superlabSaveStrategy({ name: `GA ${new Date().toLocaleDateString('pt-BR')}`, game_type: gameType, strategy_type: 'optimized', config_json: JSON.stringify({ algo: 'genetic', popSize, generations }), games: result.best_portfolio, notes: `Score: ${(result.final_score * 100).toFixed(1)}% | Gerações: ${result.generations_run}` })
      showToast('Portfólio GA salvo!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [result, gameType, popSize, generations, showToast])

  return (
    <div>
      <SectionHead icon={Dna} title="Algoritmo Genético" sub="Evolui portfólios por seleção, cruzamento e mutação. Máx 40 pop × 80 gerações." />
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[['Jogos/portfólio', portfolioSize, setPortfolioSize, [2, 3, 5, 6, 8, 10]], ['Pop. inicial', popSize, setPopSize, [10, 20, 30, 40]], ['Gerações', generations, setGenerations, [20, 40, 60, 80]] as [string, number, React.Dispatch<React.SetStateAction<number>>, number[]]].map(([lbl, val, setter, opts]) => (
            <div key={lbl as string} className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{lbl as string}</label>
              <select value={val as number} onChange={e => (setter as React.Dispatch<React.SetStateAction<number>>)(Number(e.target.value))}
                className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] focus:outline-none">
                {(opts as number[]).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <WeightControl label="Frequência" description="Prioriza números que saíram mais vezes" value={wFreq} onChange={setWFreq} />
          <WeightControl label="Diversidade" description="Mantém jogos distintos entre si (Jaccard)" value={wDiv} onChange={setWDiv} />
          <WeightControl label="Cobertura" description="Maximiza pares cobertos pelo portfólio" value={wCov} onChange={setWCov} />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <RunButton onClick={run} loading={loading} label="Evoluir" loadingLabel="Evoluindo..." icon={Dna} />
      </div>
      {result && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard label="Score final" value={`${(result.final_score * 100).toFixed(1)}%`} />
            <StatCard label="Gerações" value={result.generations_run} />
            <StatCard label="Freq score" value={`${(result.frequency_score * 100).toFixed(0)}%`} />
            <StatCard label="Div score" value={`${(result.diversity_score * 100).toFixed(0)}%`} />
          </div>
          {result.score_history.length > 1 && (
            <div className="mb-5 rounded-xl border border-border bg-card p-3">
              <div className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Evolução do score</div>
              <div className="flex items-end gap-px h-16 overflow-hidden">
                {result.score_history.map((s, i) => {
                  const maxS = Math.max(...result.score_history)
                  const h = maxS > 0 ? Math.max(4, (s / maxS) * 64) : 4
                  return <div key={i} className="flex-1 bg-primary/40 rounded-sm" style={{ height: `${h}px` }} />
                })}
              </div>
              <div className="flex justify-between text-[11px] font-mono text-muted-foreground mt-1">
                <span>G1: {(result.score_history[0] * 100).toFixed(1)}%</span>
                <span>Gf: {(result.score_history[result.score_history.length - 1] * 100).toFixed(1)}%</span>
              </div>
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <button onClick={saveResult} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => copyGames(result.best_portfolio)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Copy size={14} /> Copiar
            </button>
            <button onClick={() => sendToMeusJogos(result.best_portfolio, 'GA')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <ExternalLink size={14} /> Meus Jogos
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {result.best_portfolio.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card">
                <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex gap-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
                <span className="text-[11px] font-mono text-muted-foreground ml-auto">Σ{g.reduce((a, b) => a + b, 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Recocimento sub-tab ──
function RecocimentoSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [portfolioSize, setPortfolioSize] = useState(5)
  const [maxIter, setMaxIter] = useState(1500)
  const [wFreq, setWFreq] = useState(1)
  const [wDiv, setWDiv] = useState(1)
  const [wCov, setWCov] = useState(1)
  const [result, setResult] = useState<SuperLabSAResult | null>(null)

  const copyGames = useCopyGames(showToast)
  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)

  const run = useCallback(async () => {
    setLoading(true)
    try { setResult(await api.superlabSimulatedAnnealing(gameType, portfolioSize, maxIter, wFreq, wDiv, wCov)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, portfolioSize, maxIter, wFreq, wDiv, wCov, showToast])

  const saveResult = useCallback(async () => {
    if (!result) return
    try {
      await api.superlabSaveStrategy({ name: `SA ${new Date().toLocaleDateString('pt-BR')}`, game_type: gameType, strategy_type: 'optimized', config_json: JSON.stringify({ algo: 'annealing', maxIter }), games: result.best_portfolio, notes: `Score: ${(result.final_score * 100).toFixed(1)}% | Melhoras: ${result.improvements}` })
      showToast('Portfólio SA salvo!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [result, gameType, maxIter, showToast])

  return (
    <div>
      <SectionHead icon={Thermometer} title="Recocimento Simulado" sub="Otimização por analogia termodinâmica. Aceita soluções piores com P(T) para escapar de mínimos locais." />
      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Jogos/portfólio</label>
            <select value={portfolioSize} onChange={e => setPortfolioSize(Number(e.target.value))}
              className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] focus:outline-none">
              {[2, 3, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Max. iterações</label>
            <select value={maxIter} onChange={e => setMaxIter(Number(e.target.value))}
              className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] focus:outline-none">
              {[500, 1000, 1500, 2000, 3000].map(n => <option key={n} value={n}>{n.toLocaleString()}</option>)}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <WeightControl label="Frequência" description="Prioriza números que saíram mais vezes" value={wFreq} onChange={setWFreq} />
          <WeightControl label="Diversidade" description="Mantém jogos distintos entre si (Jaccard)" value={wDiv} onChange={setWDiv} />
          <WeightControl label="Cobertura" description="Maximiza pares cobertos pelo portfólio" value={wCov} onChange={setWCov} />
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <RunButton onClick={run} loading={loading} label="Resfriar" loadingLabel="Resfriando..." icon={Thermometer} />
      </div>
      {result && (
        <>
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatCard label="Score inicial" value={`${(result.initial_score * 100).toFixed(1)}%`} />
            <StatCard label="Score final" value={`${(result.final_score * 100).toFixed(1)}%`} />
            <StatCard label="Iterações" value={result.iterations_run.toLocaleString()} />
            <StatCard label="Melhoras" value={result.improvements.toLocaleString()} />
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={saveResult} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => copyGames(result.best_portfolio)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Copy size={14} /> Copiar
            </button>
            <button onClick={() => sendToMeusJogos(result.best_portfolio, 'SA')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <ExternalLink size={14} /> Meus Jogos
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {result.best_portfolio.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card">
                <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex gap-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
                <span className="text-[11px] font-mono text-muted-foreground ml-auto">Σ{g.reduce((a, b) => a + b, 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Redutor de Redundância sub-tab ──
function RedutorSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [maxSim, setMaxSim] = useState(0.5)
  const [result, setResult] = useState<SuperLabRedundancyResult | null>(null)

  const copyGames = useCopyGames(showToast)
  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)

  const parseGames = (text: string): number[][] =>
    text.split('\n').map(l => l.trim()).filter(Boolean)
      .map(l => l.replace(/[^0-9\s,;]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b))
      .filter(g => g.length >= 4)

  const run = useCallback(async () => {
    const games = parseGames(input)
    if (games.length < 2) { showToast('Cole pelo menos 2 jogos (um por linha)', 'error'); return }
    setLoading(true)
    try { setResult(await api.superlabReduceRedundancy(games, maxSim)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [input, maxSim, showToast])

  const saveResult = useCallback(async () => {
    if (!result) return
    try {
      await api.superlabSaveStrategy({ name: `Reduzido ${new Date().toLocaleDateString('pt-BR')}`, game_type: gameType, strategy_type: 'custom', config_json: JSON.stringify({ max_similarity: maxSim }), games: result.portfolio, notes: `${result.original_count} → ${result.reduced_count} jogos. Removidos: ${result.removed_count}` })
      showToast('Portfólio reduzido salvo!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [result, gameType, maxSim, showToast])

  return (
    <div>
      <SectionHead icon={Layers} title="Redutor de Redundância" sub="Remove jogos similares entre si usando distância de Jaccard." />
      <textarea value={input} onChange={e => setInput(e.target.value)}
        className="w-full h-[120px] rounded-xl border border-border bg-card px-4 py-3 text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 mb-4"
        placeholder={"Cole jogos aqui (um por linha):\n01 05 12 23 34 45\n03 07 14 28 36 51"} />
      <div className="flex items-center gap-4 mb-4">
        <div className="flex flex-col gap-1 flex-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Similaridade máxima (Jaccard)</label>
            <span className="text-[12px] font-mono font-bold">{maxSim.toFixed(2)}</span>
          </div>
          <input type="range" min={0.1} max={0.9} step={0.05} value={maxSim} onChange={e => setMaxSim(Number(e.target.value))}
            className="w-full accent-primary h-1.5 rounded-full" />
          <div className="text-[11px] text-muted-foreground">Menor valor = mais agressivo (remove mais)</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-5">
        <RunButton onClick={run} loading={loading} label="Reduzir" loadingLabel="Reduzindo..." icon={Minus} />
      </div>
      {result && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="Original" value={result.original_count} />
            <StatCard label="Reduzido" value={result.reduced_count} />
            <StatCard label="Removidos" value={result.removed_count} />
          </div>
          <div className="grid grid-cols-2 gap-2 mb-5">
            <StatCard label="Sim. média antes" value={`${(result.avg_similarity_before * 100).toFixed(1)}%`} />
            <StatCard label="Sim. média depois" value={`${(result.avg_similarity_after * 100).toFixed(1)}%`} />
          </div>
          <div className="flex gap-2 mb-3">
            <button onClick={saveResult} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-primary/40 text-primary text-[12px] font-bold hover:bg-primary/10 transition-colors">
              <Save size={14} /> Salvar
            </button>
            <button onClick={() => copyGames(result.portfolio)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Copy size={14} /> Copiar
            </button>
            <button onClick={() => sendToMeusJogos(result.portfolio, 'Reduzido')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <ExternalLink size={14} /> Meus Jogos
            </button>
            <button onClick={() => exportCSV(result.portfolio, `reduzido_${gameType}.csv`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> CSV
            </button>
            <button onClick={() => exportJSON(result.portfolio, `reduzido_${gameType}.json`)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-muted-foreground text-[12px] font-bold hover:text-foreground transition-colors">
              <Download size={14} /> JSON
            </button>
          </div>
          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
            {result.portfolio.map((g, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card">
                <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <div className="flex gap-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
                <span className="text-[11px] font-mono text-muted-foreground ml-auto">Σ{g.reduce((a, b) => a + b, 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const OTIMIZAR_SUBTABS = [
  { id: 'multi' as const, label: 'Multi-objetivo' },
  { id: 'genetico' as const, label: 'Genético' },
  { id: 'recocimento' as const, label: 'Recocimento' },
  { id: 'redutor' as const, label: 'Redutor' },
]

// ═══════════════════════════════════════════════════════
// Tab: Otimizador Multi-objetivo (Phase 7)
// ═══════════════════════════════════════════════════════
function MultiObjetivoSubTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [portfolioSize, setPortfolioSize] = useState(5)
  const [wFreq, setWFreq] = useState(1)
  const [wDiv, setWDiv] = useState(1)
  const [wCov, setWCov] = useState(1)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SuperLabMultiObjectiveResult | null>(null)

  // Limpar resultados ao mudar quantidade ou loteria
  useEffect(() => { setResult(null) }, [portfolioSize, gameType])

  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)
  const copyGames = useCopyGames(showToast)
  const allWeightsOff = wFreq === 0 && wDiv === 0 && wCov === 0

  const run = useCallback(async () => {
    if (allWeightsOff) { showToast('Ative pelo menos um critério de peso antes de otimizar.', 'error'); return }
    setLoading(true)
    try { setResult(await api.superlabMultiObjective(gameType, portfolioSize, 200, wFreq, wDiv, wCov)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, portfolioSize, wFreq, wDiv, wCov, showToast, allWeightsOff])

  const savePortfolio = useCallback(async (p: SuperLabOptimizedPortfolio) => {
    try {
      await api.superlabSaveStrategy({
        name: `Otimizado #${p.rank} — ${new Date().toLocaleDateString('pt-BR')}`,
        game_type: gameType,
        strategy_type: 'optimized',
        config_json: JSON.stringify({ w_freq: wFreq, w_div: wDiv, w_cov: wCov }),
        games: p.games,
        notes: `Score: ${(p.composite_score * 100).toFixed(1)}% | Freq: ${(p.frequency_score * 100).toFixed(0)}% Div: ${(p.diversity_score * 100).toFixed(0)}% Cob: ${(p.coverage_score * 100).toFixed(0)}%`,
      })
      showToast('Portfólio salvo nas Estratégias!', 'success')
    } catch (e) { showToast(String(e), 'error') }
  }, [gameType, wFreq, wDiv, wCov, showToast])

  return (
    <div>
      <SectionHead icon={TrendingUp} title="Otimizador Multi-objetivo" sub="Gera portfólios otimizando frequência histórica, diversidade Jaccard e cobertura de pares." />

      <div className="rounded-xl border border-border bg-card p-4 mb-4">
        <div className="text-[13px] font-bold text-muted-foreground uppercase tracking-wide mb-4">Pesos dos critérios</div>
        <div className="flex flex-col gap-3">
          <WeightControl label="Frequência histórica" description="Prioriza números que saíram mais vezes" value={wFreq} onChange={setWFreq} />
          <WeightControl label="Diversidade (Jaccard)" description="Mantém jogos distintos entre si" value={wDiv} onChange={setWDiv} />
          <WeightControl label="Cobertura de pares" description="Maximiza pares cobertos pelo portfólio" value={wCov} onChange={setWCov} />
        </div>
        {allWeightsOff && (
          <div className="mt-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-[12px] text-yellow-400">
            Ative pelo menos um critério de peso para otimizar.
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-border/50 text-[12px] text-muted-foreground">
          Gera 200 portfólios aleatórios e retorna os 10 melhores pelo score ponderado. Portfólios <strong>Pareto-ótimos</strong> não são dominados em nenhuma dimensão.
        </div>
      </div>

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[12px] font-semibold text-muted-foreground">Jogos/portfólio:</label>
          <select value={portfolioSize} onChange={e => setPortfolioSize(Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[13px] focus:outline-none">
            {[2, 3, 5, 6, 8, 10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <RunButton onClick={run} loading={loading} label="Otimizar" loadingLabel="Otimizando..." icon={TrendingUp} />
      </div>

      {result && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="Candidatos" value={result.total_candidates.toLocaleString()} />
            <StatCard label="Pareto-ótimos" value={result.pareto_count} sub="Não dominados" />
            <StatCard label="Top retornados" value={result.portfolios.length} />
          </div>

          <div className="flex flex-col gap-4">
            {result.portfolios.map(p => (
              <div key={p.rank} className={cn('rounded-2xl border bg-card overflow-hidden', p.is_pareto ? 'border-primary/50' : 'border-border')}>
                {/* Header com score e botões */}
                <div className="px-4 pt-3 pb-2 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[13px] font-bold text-foreground">#{p.rank}</span>
                      {p.is_pareto && <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold uppercase tracking-wide">Pareto</span>}
                      <span className="text-[12px] text-muted-foreground ml-1">{p.games.length} jogos · {p.games[0]?.length} dezenas</span>
                      <span className="text-[13px] font-bold text-primary ml-auto">{(p.composite_score * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex gap-4">
                      {[['Freq', p.frequency_score], ['Div', p.diversity_score], ['Cob', p.coverage_score]].map(([lbl, val]) => (
                        <div key={lbl as string} className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground font-semibold">{lbl}</span>
                          <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${(val as number) * 100}%` }} />
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground">{((val as number) * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => savePortfolio(p)}
                      className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors" title="Salvar estratégia">
                      <Save size={13} />
                    </button>
                    <button onClick={() => copyGames(p.games)}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Copiar">
                      <Copy size={13} />
                    </button>
                    <button onClick={() => sendToMeusJogos(p.games, `Otimizado #${p.rank}`)}
                      className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Salvar em Meus Jogos">
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
                {/* Jogos — sempre visíveis, sem colapso */}
                <div className="px-4 pb-3 border-t border-border/50 flex flex-col gap-0">
                  {p.games.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 py-2 border-b border-border/30 last:border-0">
                      <span className="text-[11px] font-mono text-muted-foreground/60 w-5 shrink-0">{i + 1}.</span>
                      <div className="flex gap-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
                      <span className="text-[11px] font-mono text-muted-foreground/60 ml-auto shrink-0">Σ{g.reduce((a, b) => a + b, 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function OtimizadorTab({ gameType }: { gameType: string }) {
  const [subTab, setSubTab] = useState<'multi' | 'genetico' | 'recocimento' | 'redutor'>('multi')
  return (
    <div>
      <SubTabBar options={OTIMIZAR_SUBTABS} value={subTab} onChange={setSubTab} />
      {subTab === 'multi'       && <MultiObjetivoSubTab gameType={gameType} />}
      {subTab === 'genetico'    && <GeneticoSubTab      gameType={gameType} />}
      {subTab === 'recocimento' && <RecocimentoSubTab   gameType={gameType} />}
      {subTab === 'redutor'     && <RedutorSubTab       gameType={gameType} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Probabilidade
// ═══════════════════════════════════════════════════════
function ProbabilidadeTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const cfg = useLotteryStore(s => s.enabledGames).find(l => l.game_type === gameType)
  const [loading, setLoading] = useState(false)
  const [pickCount, setPickCount] = useState<number | null>(null)
  const [result, setResult] = useState<SuperLabProbabilityResult | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    try { setResult(await api.superlabProbabilityEngine(gameType, pickCount ?? undefined)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, pickCount, showToast])

  const maxProb = result ? Math.max(...result.tiers.map(t => t.probability)) : 1

  return (
    <div>
      <SectionHead icon={Percent} title="Motor de Probabilidade" sub="Cálculo exato de probabilidade por faixa de premiação usando combinatória." />
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-semibold text-muted-foreground">Dezenas apostadas</label>
          <select value={pickCount ?? ''} onChange={e => setPickCount(e.target.value === '' ? null : Number(e.target.value))}
            className="rounded-lg border border-border bg-muted px-2 py-1.5 text-[12px] focus:outline-none">
            <option value="">Padrão ({cfg?.default_pick_count ?? 6})</option>
            {Array.from({ length: (cfg?.max_pick_count ?? 10) - (cfg?.min_pick_count ?? 6) + 1 }, (_, i) => (cfg?.min_pick_count ?? 6) + i).map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <RunButton onClick={run} loading={loading} label="Calcular" loadingLabel="Calculando..." icon={Percent} />
      </div>
      {result && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <StatCard label="Dezenas apostadas" value={result.pick_count} />
            <StatCard label="Pool" value={result.pool_size} />
            <StatCard label="Combinações" value={result.total_combinations.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} />
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border bg-muted/50 grid grid-cols-4 gap-2">
              {['Faixa', 'Acertos', 'Probabilidade', '1 em X'].map(h => (
                <div key={h} className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{h}</div>
              ))}
            </div>
            {result.tiers.map((tier, i) => (
              <div key={i} className={cn('px-4 py-3 grid grid-cols-4 gap-2 items-center border-b border-border/40 last:border-0', i === 0 ? 'bg-yellow-500/5' : '')}>
                <div className="text-[12px] font-bold">{tier.name}</div>
                <div className="text-[12px] font-mono">{tier.hits_required}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${(tier.probability / maxProb) * 100}%` }} />
                  </div>
                  <span className="text-[12px] font-mono text-muted-foreground w-16 text-right">{(tier.probability * 100).toFixed(6)}%</span>
                </div>
                <div className="text-[12px] font-mono text-muted-foreground">
                  {tier.one_in >= 1e9 ? `1 em ${(tier.one_in / 1e6).toFixed(1)}M` :
                   tier.one_in >= 1e6 ? `1 em ${(tier.one_in / 1e6).toFixed(2)}M` :
                   tier.one_in >= 1e3 ? `1 em ${(tier.one_in / 1e3).toFixed(1)}K` :
                   `1 em ${tier.one_in.toFixed(0)}`}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            ⚠ Probabilidades teóricas assumindo sorteio uniforme. Cálculo exato por coeficiente binomial C(n,k).
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Comparar Portfólios
// ═══════════════════════════════════════════════════════
function CompararTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [result, setResult] = useState<SuperLabPortfolioCompareResult | null>(null)

  const parsePortfolios = (text: string): { games: number[][]; name: string }[] => {
    const portfolios: { games: number[][]; name: string }[] = []
    let current: { games: number[][]; name: string } | null = null
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      if (trimmed.startsWith('#')) {
        if (current && current.games.length > 0) portfolios.push(current)
        current = { games: [], name: trimmed.slice(1).trim() || `Portfólio ${portfolios.length + 1}` }
      } else {
        const nums = trimmed.replace(/[^0-9\s,;]/g, ' ').split(/[\s,;]+/).filter(Boolean).map(Number).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b)
        if (nums.length >= 4) {
          if (!current) current = { games: [], name: `Portfólio ${portfolios.length + 1}` }
          current.games.push(nums)
        }
      }
    }
    if (current && current.games.length > 0) portfolios.push(current)
    return portfolios
  }

  const run = useCallback(async () => {
    const portfolios = parsePortfolios(input)
    if (portfolios.length < 1) { showToast('Cole ao menos 1 portfólio. Use # Nome para separar.', 'error'); return }
    const games = portfolios.flatMap(p => p.games)
    const names = portfolios.flatMap(p => p.games.map(() => p.name))
    if (games.length > 30) { showToast('Máximo 30 jogos no total', 'error'); return }
    setLoading(true)
    try { setResult(await api.superlabComparePortfolios(games, names, gameType)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [input, gameType, showToast])

  return (
    <div>
      <SectionHead icon={GitCompare} title="Comparar Portfólios" sub="Compare jogos/portfólios por desempenho histórico. Use # Nome para separar grupos." />
      <div className="mb-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground">
        Use <strong># Nome do Portfólio</strong> como cabeçalho, depois os jogos (um por linha). Ex:<br/>
        <span className="font-mono text-foreground/80"># Minha Aposta<br/>01 05 12 23 34 45<br/># Outra Carteira<br/>07 14 21 30 42 57</span>
      </div>
      <textarea value={input} onChange={e => setInput(e.target.value)}
        className="w-full h-[140px] rounded-xl border border-border bg-card px-4 py-3 text-[13px] font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50 mb-4"
        placeholder={"# Portfólio A\n01 05 12 23 34 45\n# Portfólio B\n03 07 14 28 36 51"} />
      <RunButton onClick={run} loading={loading} label="Comparar" loadingLabel="Analisando..." icon={GitCompare} />
      {result && result.strategies.length > 0 && (
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-3">
              <div className="text-[11px] font-bold text-green-500 uppercase tracking-wide mb-1">Melhor taxa de prêmios</div>
              <div className="text-[13px] font-bold">{result.strategies[result.best_by_prize_rate_idx]?.name}</div>
              <div className="text-[12px] text-muted-foreground">{result.strategies[result.best_by_prize_rate_idx]?.prize_rate_pct.toFixed(2)}%</div>
            </div>
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <div className="text-[11px] font-bold text-primary uppercase tracking-wide mb-1">Maior acerto</div>
              <div className="text-[13px] font-bold">{result.strategies[result.best_by_max_hits_idx]?.name}</div>
              <div className="text-[12px] text-muted-foreground">{result.strategies[result.best_by_max_hits_idx]?.max_hits} acertos máx.</div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2 border-b border-border bg-muted/50 grid grid-cols-6 gap-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wide">
              <div className="col-span-2">Portfólio</div>
              <div>Prêmios</div>
              <div>Taxa%</div>
              <div>Máx.</div>
              <div>4+ / 5+</div>
            </div>
            {result.strategies.map((s, i) => (
              <div key={i} className={cn('px-4 py-3 grid grid-cols-6 gap-2 items-center border-b border-border/40 last:border-0',
                i === result.best_by_prize_rate_idx ? 'bg-green-500/5' : i === result.best_by_max_hits_idx ? 'bg-primary/5' : '')}>
                <div className="col-span-2">
                  <div className="text-[11px] font-bold truncate">{s.name}</div>
                  <div className="flex gap-0.5 mt-1">{s.game.slice(0, 6).map(n => <Ball key={n} n={n} />)}</div>
                </div>
                <div className="text-[12px] font-mono font-bold">{s.prize_count}</div>
                <div className="text-[11px] font-mono">{s.prize_rate_pct.toFixed(2)}%</div>
                <div className={cn('text-[12px] font-bold', s.max_hits >= 6 ? 'text-yellow-400' : s.max_hits >= 5 ? 'text-purple-400' : 'text-foreground')}>{s.max_hits}</div>
                <div className="text-[12px] font-mono text-muted-foreground">{s.count_4plus} / {s.count_5plus}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Tab: Estratégias Salvas
// ═══════════════════════════════════════════════════════
function EstrategiasTab({ gameType }: { gameType: string }) {
  const showToast = useAppStore(s => s.showToast)
  const [loading, setLoading] = useState(false)
  const [strategies, setStrategies] = useState<SuperLabStrategy[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  const sendToMeusJogos = useSendToMeusJogos(gameType, showToast)
  const copyGames = useCopyGames(showToast)

  const load = useCallback(async () => {
    setLoading(true)
    try { setStrategies(await api.superlabListStrategies(gameType)) }
    catch (e) { showToast(String(e), 'error') }
    finally { setLoading(false) }
  }, [gameType, showToast])

  const del = useCallback(async (id: number) => {
    try {
      await api.superlabDeleteStrategy(id)
      setStrategies(prev => prev.filter(s => s.id !== id))
      showToast('Estratégia removida', 'info')
    } catch (e) { showToast(String(e), 'error') }
  }, [showToast])

  const typeLabel: Record<string, string> = {
    backtest: 'Backtest', filtered: 'Filtrado', diverse: 'Diverso',
    coverage: 'Cobertura', optimized: 'Otimizado', custom: 'Custom',
  }

  return (
    <div>
      <SectionHead icon={BookOpen} title="Estratégias Salvas" sub="Carteiras, jogos filtrados, coberturas e portfólios otimizados." />
      <div className="flex gap-2 mb-5">
        <RunButton onClick={load} loading={loading} label="Carregar" loadingLabel="Carregando..." icon={RefreshCw} />
      </div>

      {strategies.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <BookOpen size={36} className="opacity-20 mb-3" />
          <p className="text-[13px]">Nenhuma estratégia salva ainda.</p>
          <p className="text-[11px] opacity-70 mt-1">Salve jogos do Gerador, Cobertura ou Otimizador.</p>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {strategies.map(s => {
          const games: number[][] = (() => { try { return JSON.parse(s.games_json) } catch { return [] } })()
          const isExp = expanded === s.id
          return (
            <div key={s.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-bold text-foreground truncate">{s.name}</span>
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold shrink-0">
                      {typeLabel[s.strategy_type] ?? s.strategy_type}
                    </span>
                  </div>
                  <span className="text-[12px] text-muted-foreground">{games.length} jogo{games.length !== 1 ? 's' : ''} · {s.created_at.slice(0, 10)}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {games.length > 0 && (
                    <>
                      <button onClick={() => sendToMeusJogos(games, s.name)} title="Enviar para Meus Jogos"
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <ExternalLink size={13} />
                      </button>
                      <button onClick={() => copyGames(games)} title="Copiar jogos"
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Copy size={13} />
                      </button>
                      <button onClick={() => exportCSV(games, `${s.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`)} title="Exportar CSV"
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Download size={13} />
                      </button>
                      <button onClick={() => exportJSON(games, `${s.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`)} title="Exportar JSON"
                        className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                        <Download size={13} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setExpanded(isExp ? null : s.id)}
                    className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight size={13} className={cn('transition-transform', isExp && 'rotate-90')} />
                  </button>
                  <button onClick={() => del(s.id)}
                    className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              {s.notes && (
                <div className="px-4 pb-2 text-[12px] text-muted-foreground">{s.notes}</div>
              )}
              {isExp && games.length > 0 && (
                <div className="px-4 pb-4 flex flex-col gap-2 max-h-[300px] overflow-y-auto border-t border-border">
                  {games.map((g, i) => (
                    <div key={i} className="flex items-center gap-2 py-2 border-b border-border/40 last:border-0">
                      <span className="text-[12px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                      <div className="flex gap-1 flex-wrap">{g.map(n => <Ball key={n} n={n} />)}</div>
                      <span className="text-[11px] font-mono text-muted-foreground ml-auto shrink-0">Σ{g.reduce((a, b) => a + b, 0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// Main SuperLab page
// ═══════════════════════════════════════════════════════
export default function SuperLab() {
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const currentConfig = enabledGames.find(g => g.game_type === activeGame)
  const [tab, setTab] = useState<Tab>('analytics')

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="mb-4 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 shrink-0">
          <FlaskConical size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-[24px] font-[900] tracking-tight leading-tight">SuperLab</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Análise avançada · Backtesting · Monte Carlo · Cobertura · Otimizador</p>
        </div>
      </div>

      {/* Lottery Tabs — mesmo padrão do Gerador */}
      {enabledGames.length > 0 && (
        <div className="mb-4">
          <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />
        </div>
      )}

      {/* Active lottery info pill */}
      {currentConfig && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border w-fit text-[13px]"
          style={{ '--c': currentConfig.color } as React.CSSProperties}>
          <div className="w-2 h-2 rounded-full [background:var(--c)]" />
          <span className="font-bold text-foreground">{currentConfig.display_name}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{currentConfig.default_pick_count} de {currentConfig.numbers_pool_size === 100 ? '00–99' : `01–${String(currentConfig.numbers_pool_size).padStart(2, '0')}`}</span>
          {currentConfig.has_trevos && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">+ trevos</span></>}
          {currentConfig.has_time_coracao && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">+ time do coração</span></>}
          {currentConfig.has_mes_sorte && <><span className="text-muted-foreground">·</span><span className="text-muted-foreground">+ mês da sorte</span></>}
        </div>
      )}

      {/* Feature tabs */}
      <div className="flex gap-0.5 mb-5 p-1 rounded-xl bg-muted overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn('flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[13px] font-semibold transition-all whitespace-nowrap',
                tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Icon size={14} />{t.label}
            </button>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border bg-card/50 p-6">
        {tab === 'analytics'     && <AnalyticsTab     gameType={activeGame} />}
        {tab === 'backtest'      && <BacktestTab       gameType={activeGame} />}
        {tab === 'montecarlo'    && <MonteCarloTab     gameType={activeGame} />}
        {tab === 'pares'         && <ParesTab          gameType={activeGame} />}
        {tab === 'filtros'       && <FiltrosTab        gameType={activeGame} />}
        {tab === 'cobertura'     && <CoberturaTab      gameType={activeGame} />}
        {tab === 'otimizar'      && <OtimizadorTab     gameType={activeGame} />}
        {tab === 'probabilidade' && <ProbabilidadeTab  gameType={activeGame} />}
        {tab === 'comparar'      && <CompararTab       gameType={activeGame} />}
        {tab === 'estrategias'   && <EstrategiasTab    gameType={activeGame} />}

        <BannerCarousel position="internal" className="mt-8" />
      </div>
    </div>
  )
}
