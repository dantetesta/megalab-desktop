import React, { useState, useCallback, useMemo } from 'react'
import { useLotteryStore } from '@/stores/lotteryStore'
import { useAppStore } from '@/stores/appStore'
import { api, type LotteryConfig } from '@/lib/tauri'
import LotteryTabs from '@/components/LotteryTabs'
import BannerCarousel from '@/components/BannerCarousel'
import { cn } from '@/lib/utils'
import {
  Layers, Save, Download, Copy, Loader2, RefreshCw,
  Info, Zap, ChevronRight, Shuffle, Star, Trophy,
} from 'lucide-react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

// ═══════════════════════════════════════════════════════
// ALGORITMO — Greedy Covering Design (Desdobramento)
// ═══════════════════════════════════════════════════════

function getCombinations<T>(arr: T[], k: number): T[][] {
  const result: T[][] = []
  function recurse(start: number, combo: T[]) {
    if (combo.length === k) { result.push([...combo]); return }
    for (let i = start; i <= arr.length - (k - combo.length); i++) {
      combo.push(arr[i])
      recurse(i + 1, combo)
      combo.pop()
    }
  }
  recurse(0, [])
  return result
}

function greedyCoveringDesign(
  numbers: number[],
  pickSize: number,
  coverSize: number,
): number[][] {
  const allTickets = getCombinations(numbers, pickSize)
  const allCoverSets = getCombinations(numbers, coverSize)

  const remaining = new Set<string>(allCoverSets.map(s => s.join('-')))
  if (remaining.size === 0) return []

  const ticketData = allTickets.map(ticket => ({
    ticket,
    covers: getCombinations(ticket, coverSize).map(s => s.join('-')),
  }))

  const selected: number[][] = []

  while (remaining.size > 0) {
    let best = -1
    let bestScore = 0
    for (let i = 0; i < ticketData.length; i++) {
      let score = 0
      for (const key of ticketData[i].covers) {
        if (remaining.has(key)) score++
      }
      if (score > bestScore) { bestScore = score; best = i }
    }
    if (best === -1 || bestScore === 0) break
    selected.push(ticketData[best].ticket)
    for (const key of ticketData[best].covers) remaining.delete(key)
  }

  return selected
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

const INCOMPATIBLE = ['lotomania', 'supersete', 'loteca', 'federal']
function isCompatible(g: LotteryConfig) {
  return !INCOMPATIBLE.some(x => g.game_type.toLowerCase().includes(x))
}

function getMaxPool(config: LotteryConfig): number {
  const p = config.default_pick_count
  const extra = p <= 6 ? 8 : p <= 7 ? 5 : p <= 10 ? 4 : 3
  return Math.min(config.numbers_pool_size, p + extra)
}

function getGarantias(pickSize: number): { label: string; coverSize: number }[] {
  if (pickSize <= 5) return [
    { label: `${pickSize - 2} acertos garantidos`, coverSize: pickSize - 2 },
    { label: `${pickSize - 1} acertos garantidos`, coverSize: pickSize - 1 },
  ]
  if (pickSize === 6) return [
    { label: 'Quadra garantida (4 acertos)', coverSize: 4 },
    { label: 'Quina garantida (5 acertos)',  coverSize: 5 },
  ]
  if (pickSize === 7) return [
    { label: '4 acertos garantidos', coverSize: 4 },
    { label: '5 acertos garantidos', coverSize: 5 },
    { label: '6 acertos garantidos', coverSize: 6 },
  ]
  if (pickSize <= 10) return Array.from({ length: 4 }, (_, i) => ({
    label: `${pickSize - 4 + i} acertos garantidos`,
    coverSize: pickSize - 4 + i,
  })).filter(g => g.coverSize >= 3)
  // Lotofácil e similares (pick ≥ 11)
  return [
    { label: `${pickSize - 3} pontos garantidos`, coverSize: pickSize - 3 },
    { label: `${pickSize - 2} pontos garantidos`, coverSize: pickSize - 2 },
    { label: `${pickSize - 1} pontos garantidos`, coverSize: pickSize - 1 },
  ]
}

// Preços de referência por bilhete simples (R$)
const TICKET_PRICE: Record<string, number> = {
  megasena: 5.00, quina: 1.50, duplasena: 2.50, lotofacil: 3.00,
  diadesorte: 2.50, timemania: 4.50, maismilionaria: 6.00,
}
function ticketPrice(gameType: string): number {
  const key = Object.keys(TICKET_PRICE).find(k => gameType.toLowerCase().includes(k))
  return key ? TICKET_PRICE[key] : 3.00
}

// Presets clássicos de desdobramento — apenas para jogos de 6 dezenas
const TAUFIC_PRESETS = [
  { label: '8 dez / Quina',  pool: 8,  coverSize: 5, note: '≈10 cartões' },
  { label: '10 dez / Quadra', pool: 10, coverSize: 4, note: '≈24 cartões' },
  { label: '12 dez / Quadra', pool: 12, coverSize: 4, note: '≈37 cartões' },
]

function exportCSV(games: number[][], filename: string) {
  const cols = Math.max(...games.map(g => g.length), 1)
  const header = ['cartao', ...Array.from({ length: cols }, (_, i) => `n${i + 1}`)].join(',')
  const rows = games.map((g, i) => [i + 1, ...g].join(','))
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function exportJSON(games: number[][], filename: string) {
  const data = { cartoes: games.map((g, i) => ({ cartao: i + 1, dezenas: g, soma: g.reduce((a, b) => a + b, 0) })) }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ═══════════════════════════════════════════════════════
// ATOMS
// ═══════════════════════════════════════════════════════

function Ball({ n, selected, onClick }: { n: number; selected?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-extrabold font-mono tabular-nums shrink-0 transition-colors',
        onClick ? 'cursor-pointer' : 'cursor-default',
        selected
          ? 'bg-primary text-primary-foreground ring-2 ring-primary/50 ring-offset-1 ring-offset-background'
          : onClick
            ? 'bg-muted text-muted-foreground hover:bg-primary/20 hover:text-foreground'
            : 'bg-muted text-foreground',
      )}
    >
      {String(n).padStart(2, '0')}
    </button>
  )
}

function StatCard({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-4 text-center', accent ? 'border-primary/30 bg-primary/5' : 'border-border bg-card')}>
      <div className={cn('text-[26px] font-[900] tabular-nums leading-tight', accent ? 'text-primary' : 'text-foreground')}>{value}</div>
      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mt-1">{label}</div>
      {sub && <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════

export default function Desdobramento() {
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const showToast = useAppStore(s => s.showToast)

  const compatibleGames = useMemo(() => enabledGames.filter(isCompatible), [enabledGames])

  // Se o activeGame atual não é compatível, usa o primeiro compatível
  const currentGameType = useMemo(
    () => compatibleGames.find(g => g.game_type === activeGame)
      ? activeGame
      : (compatibleGames[0]?.game_type ?? ''),
    [compatibleGames, activeGame],
  )
  const config = useMemo(
    () => compatibleGames.find(g => g.game_type === currentGameType),
    [compatibleGames, currentGameType],
  )

  const maxPool = config ? getMaxPool(config) : 12
  const garantias = useMemo(() => config ? getGarantias(config.default_pick_count) : [], [config])

  const [poolSize, setPoolSize] = useState(config ? Math.min(8, maxPool) : 8)
  const [coverSize, setCoverSize] = useState(() => garantias[0]?.coverSize ?? 4)
  const [selected, setSelected] = useState<number[]>([])
  const [tickets, setTickets] = useState<number[][]>([])
  const [loading, setLoading] = useState(false)
  const [autoLoading, setAutoLoading] = useState(false)
  const [savingMode, setSavingMode] = useState<null | 'normal' | 'apostado' | 'favorito'>(null)

  // Reset quando troca de loteria
  const handleSelectGame = useCallback((gt: string) => {
    setActiveGame(gt)
    setSelected([])
    setTickets([])
  }, [setActiveGame])

  // Recomputa quando troca de loteria
  const pickSize = config?.default_pick_count ?? 6
  const poolSizeClamped = Math.min(poolSize, maxPool)

  const toggleNumber = useCallback((n: number) => {
    setSelected(prev => {
      if (prev.includes(n)) return prev.filter(x => x !== n)
      if (prev.length >= poolSizeClamped) return prev
      return [...prev, n].sort((a, b) => a - b)
    })
    setTickets([])
  }, [poolSizeClamped])

  const generate = useCallback(async () => {
    if (!config || selected.length < poolSizeClamped) return
    setLoading(true)
    try {
      // Executa em próximo tick para não bloquear UI
      await new Promise(r => setTimeout(r, 20))
      const result = greedyCoveringDesign(selected, pickSize, coverSize)
      setTickets(result)
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setLoading(false)
    }
  }, [config, selected, poolSizeClamped, pickSize, coverSize, showToast])

  // Auto-seleciona dezenas usando o gerador do app
  const autoSelect = useCallback(async () => {
    if (!config) return
    setAutoLoading(true)
    try {
      const game = await api.generateGame('balanced', config.game_type, poolSizeClamped)
      setSelected(game.numbers.slice(0, poolSizeClamped).sort((a, b) => a - b))
      setTickets([])
    } catch {
      // fallback: seleção aleatória
      const pool = Array.from({ length: config.numbers_pool_size }, (_, i) => i + 1)
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]]
      }
      setSelected(pool.slice(0, poolSizeClamped).sort((a, b) => a - b))
      setTickets([])
    } finally {
      setAutoLoading(false)
    }
  }, [config, poolSizeClamped])

  const saveAll = useCallback(async (mode: 'normal' | 'apostado' | 'favorito') => {
    if (!tickets.length || !config) return
    setSavingMode(mode)
    let ok = 0
    try {
      for (const t of tickets) {
        const id = await api.saveGame({
          numbers: t,
          game_type: config.game_type,
          strategy_id: mode === 'apostado' ? 'apostado' : 'desdobramento',
          strategy_label: mode === 'apostado' ? 'Apostado' : 'Desdobramento',
          notes: `Desdobramento de ${poolSizeClamped} dezenas — garantia ${coverSize} acertos`,
        })
        if (mode === 'favorito') await api.toggleFavoriteGame(id)
        ok++
      }
      const label = mode === 'apostado' ? 'apostados' : mode === 'favorito' ? 'favoritados' : 'salvos'
      showToast(`${ok} cartão${ok !== 1 ? 'ões' : ''} ${label} em Meus Jogos!`, 'success')
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setSavingMode(null)
    }
  }, [tickets, config, poolSizeClamped, coverSize, showToast])

  const copyAll = useCallback(async () => {
    const text = tickets.map((t, i) => `Cartão ${i + 1}: ${t.map(n => String(n).padStart(2, '0')).join(' ')}`).join('\n')
    await writeText(text)
    showToast('Cartões copiados!', 'success')
  }, [tickets, showToast])

  const applyPreset = useCallback((preset: typeof TAUFIC_PRESETS[0]) => {
    if (!config) return
    const newPool = Math.min(preset.pool, maxPool)
    setPoolSize(newPool)
    setCoverSize(preset.coverSize)
    setSelected([])
    setTickets([])
  }, [config, maxPool])

  const price = config ? ticketPrice(config.game_type) : 3.00
  const totalCost = tickets.length * price

  if (compatibleGames.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Layers size={40} className="opacity-20 mb-4" />
        <p className="text-[14px]">Nenhuma loteria compatível habilitada.</p>
        <p className="text-[12px] opacity-70 mt-1">Habilite Mega-Sena, Quina, Lotofácil ou similar nas Configurações.</p>
      </div>
    )
  }

  const poolNumbers = config
    ? Array.from({ length: config.numbers_pool_size }, (_, i) => i + 1)
    : []

  const needsMore = selected.length < poolSizeClamped
  const canGenerate = !needsMore && config !== undefined

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="mb-5 flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 shrink-0">
          <Layers size={22} className="text-primary" />
        </div>
        <div>
          <h1 className="text-[24px] font-[900] tracking-tight leading-tight">Desdobramento Matemático</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Distribua dezenas em cartões mínimos com garantia matemática de acertos</p>
        </div>
      </div>

      {/* Lottery selector */}
      <div className="mb-5">
        <LotteryTabs
          games={compatibleGames}
          activeGame={currentGameType}
          onSelect={handleSelectGame}
        />
      </div>

      {config && (
        <>
          {/* Config card */}
          <div className="rounded-2xl border border-border bg-card p-6 mb-5">
            {/* Modo Taufic — presets rápidos só para jogos de 6 dezenas */}
            {pickSize === 6 && (
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <Zap size={14} className="text-primary" />
                  <span className="text-[13px] font-bold text-foreground">Presets de Desdobramento</span>
                  <span className="text-[11px] text-muted-foreground">(configurações clássicas recomendadas)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {TAUFIC_PRESETS.filter(p => p.pool <= maxPool).map(p => (
                    <button
                      key={p.label}
                      onClick={() => applyPreset(p)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2 rounded-xl border text-[13px] font-semibold transition-all',
                        poolSizeClamped === p.pool && coverSize === p.coverSize
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-transparent border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      <span>{p.label}</span>
                      <span className="text-[11px] opacity-70">{p.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pool size + garantia */}
            <div className="grid grid-cols-2 gap-4 mb-5">
              <div>
                <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                  Quantas dezenas desdobrar
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: maxPool - pickSize }, (_, i) => pickSize + 1 + i).map(n => (
                    <button
                      key={n}
                      onClick={() => { setPoolSize(n); setSelected([]); setTickets([]) }}
                      className={cn(
                        'w-9 h-9 rounded-lg text-[13px] font-bold border transition-all',
                        poolSizeClamped === n
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[12px] font-bold text-muted-foreground uppercase tracking-wide block mb-2">
                  Garantia mínima
                </label>
                <div className="flex flex-col gap-1.5">
                  {garantias.map(g => (
                    <button
                      key={g.coverSize}
                      onClick={() => { setCoverSize(g.coverSize); setTickets([]) }}
                      className={cn(
                        'flex items-center justify-between px-4 py-2.5 rounded-xl border text-[13px] font-semibold transition-all text-left',
                        coverSize === g.coverSize
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground',
                      )}
                    >
                      <span>{g.label}</span>
                      {coverSize === g.coverSize && <ChevronRight size={14} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Instrução */}
            <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15 mb-5">
              <Info size={14} className="text-primary mt-0.5 shrink-0" />
              <p className="text-[12px] text-muted-foreground">
                Selecione exatamente <strong className="text-foreground">{poolSizeClamped} dezenas</strong> abaixo.
                O algoritmo gerará o menor número de cartões de <strong className="text-foreground">{pickSize} dezenas</strong> que
                garante <strong className="text-foreground">{coverSize} acertos</strong> em pelo menos um cartão,
                caso as dezenas sorteadas estejam entre as suas escolhidas.
              </p>
            </div>

            {/* Grade de números */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-foreground">
                  {config.display_name} — escolha {poolSizeClamped} dezenas
                </span>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'text-[13px] font-bold tabular-nums',
                    selected.length === poolSizeClamped ? 'text-primary' : 'text-muted-foreground',
                  )}>
                    {selected.length}/{poolSizeClamped} selecionadas
                  </span>
                  <button
                    onClick={autoSelect}
                    disabled={autoLoading}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[12px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {autoLoading ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                    Sugerir
                  </button>
                  {selected.length > 0 && (
                    <button onClick={() => { setSelected([]); setTickets([]) }}
                      className="text-[12px] text-muted-foreground hover:text-foreground transition-colors underline">
                      Limpar
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                {poolNumbers.map(n => (
                  <Ball
                    key={n}
                    n={n}
                    selected={selected.includes(n)}
                    onClick={() => toggleNumber(n)}
                  />
                ))}
              </div>
            </div>

            {/* Botão gerar */}
            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={generate}
                disabled={!canGenerate || loading}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold transition-all',
                  canGenerate && !loading
                    ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed',
                )}
              >
                {loading
                  ? <><Loader2 size={16} className="animate-spin" /> Calculando...</>
                  : <><Layers size={16} /> Gerar cartões</>}
              </button>
              {needsMore && (
                <span className="text-[12px] text-muted-foreground">
                  Selecione mais {poolSizeClamped - selected.length} dezena{poolSizeClamped - selected.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Resultados */}
          {tickets.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-6 mb-5">
              {/* Resumo */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <StatCard label="Cartões gerados" value={tickets.length} accent />
                <StatCard label="Garantia" value={`${coverSize} pts`} sub={`se ${poolSizeClamped} na lista`} />
                <StatCard label="Custo estimado" value={`R$\u00a0${totalCost.toFixed(2).replace('.', ',')}`} sub={`${tickets.length} × R$\u00a0${price.toFixed(2).replace('.', ',')}`} />
              </div>

              {/* Dezenas selecionadas */}
              <div className="mb-5 p-3 rounded-xl bg-muted/40 border border-border">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                  Suas {poolSizeClamped} dezenas
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selected.map(n => <Ball key={n} n={n} selected />)}
                </div>
              </div>

              {/* Lista de cartões */}
              <div className="mb-5">
                <div className="text-[13px] font-bold text-foreground mb-3">
                  {tickets.length} cartão{tickets.length !== 1 ? 'ões' : ''} para apostas
                </div>
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
                  {tickets.map((ticket, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 px-3 rounded-xl bg-muted/30 border border-border/50">
                      <span className="text-[12px] font-mono text-muted-foreground w-8 shrink-0 text-right">
                        #{i + 1}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {ticket.map(n => <Ball key={n} n={n} />)}
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground ml-auto shrink-0">
                        Σ{ticket.reduce((a, b) => a + b, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex flex-wrap gap-2">
                {/* Salvar normal */}
                <button
                  onClick={() => saveAll('normal')}
                  disabled={savingMode !== null}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  {savingMode === 'normal' ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {savingMode === 'normal' ? 'Salvando...' : `Salvar ${tickets.length} cartões`}
                </button>
                {/* Salvar + Apostar */}
                <button
                  onClick={() => saveAll('apostado')}
                  disabled={savingMode !== null}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500/90 text-white text-[13px] font-bold disabled:opacity-50 hover:opacity-90 transition-all"
                >
                  {savingMode === 'apostado' ? <Loader2 size={14} className="animate-spin" /> : <Trophy size={14} />}
                  {savingMode === 'apostado' ? 'Salvando...' : 'Salvar + Apostar'}
                </button>
                {/* Salvar nos favoritos */}
                <button
                  onClick={() => saveAll('favorito')}
                  disabled={savingMode !== null}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 text-[13px] font-bold disabled:opacity-50 hover:bg-yellow-500/30 transition-all"
                >
                  {savingMode === 'favorito' ? <Loader2 size={14} className="animate-spin" /> : <Star size={14} />}
                  {savingMode === 'favorito' ? 'Salvando...' : 'Salvar Favoritos'}
                </button>
                <button
                  onClick={copyAll}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-[13px] font-bold hover:text-foreground transition-colors"
                >
                  <Copy size={14} /> Copiar
                </button>
                <button
                  onClick={() => exportCSV(tickets, `desdobramento_${currentGameType}_${poolSizeClamped}d.csv`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-[13px] font-bold hover:text-foreground transition-colors"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={() => exportJSON(tickets, `desdobramento_${currentGameType}_${poolSizeClamped}d.json`)}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-[13px] font-bold hover:text-foreground transition-colors"
                >
                  <Download size={14} /> JSON
                </button>
                <button
                  onClick={() => { setTickets([]); setSelected([]) }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-muted-foreground text-[13px] font-bold hover:text-foreground transition-colors ml-auto"
                >
                  <RefreshCw size={14} /> Recomeçar
                </button>
              </div>
            </div>
          )}

          {/* Info — Método Taufic */}
          <div className="rounded-2xl border border-border bg-card/40 p-5 mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-primary" />
              <span className="text-[13px] font-bold text-foreground">Como funciona o Desdobramento Matemático</span>
            </div>
            <div className="text-[12px] text-muted-foreground space-y-2">
              <p>
                O <strong className="text-foreground">Desdobramento Matemático</strong> distribui um grupo maior de dezenas
                em múltiplos cartões de aposta simples usando <strong className="text-foreground">Cobertura de Conjuntos (Greedy Covering Design)</strong>.
                A matemática garante que, se as dezenas sorteadas estiverem entre as suas escolhidas,
                pelo menos um dos seus cartões atingirá a faixa de premiação definida.
              </p>
              <p>
                Exemplo clássico: <strong className="text-foreground">8 dezenas → ~10 cartões de 6</strong> com garantia de Quina (5 acertos).
                Em vez de pagar pelo cartão de 8 dezenas (R$&nbsp;110,00 na Mega-Sena),
                você joga os 10 cartões simples por apenas R$&nbsp;50,00.
              </p>
              <p className="text-amber-400/80">
                ⚠️ Este método <strong>não garante lucro</strong>. Aumenta a probabilidade de acertos menores dentro do universo das dezenas escolhidas.
                Jogue com responsabilidade.
              </p>
            </div>
          </div>
        </>
      )}

      {/* Banner carrossel 6:1 */}
      <BannerCarousel position="internal" className="mt-4" />
    </div>
  )
}
