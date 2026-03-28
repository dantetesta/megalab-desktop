import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api, type LotteryConfig } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import { useSyncStore, type GameSyncState } from '@/stores/syncStore'
import { cn } from '@/lib/utils'
import {
  Loader2, Star, RefreshCw, Pencil, Save, X,
  CheckCircle, Download, AlertCircle, Trash2, Square, Play,
  Search, StopCircle, RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export default function Settings() {
  const { showToast } = useAppStore()
  const reloadLotteryStore = useLotteryStore(s => s.load)
  const [catalog, setCatalog] = useState<LotteryConfig[]>([])
  const [enabledGames, setEnabledGames] = useState<string[]>([])
  const [primaryGame, setPrimaryGame] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [resetting, setResetting] = useState(false)

  const syncGames = useSyncStore(s => s.games)
  const checkGameStatus = useSyncStore(s => s.checkGameStatus)
  const checkAllGames = useSyncStore(s => s.checkAllGames)
  const startSync = useSyncStore(s => s.startSync)
  const syncAllEnabled = useSyncStore(s => s.syncAllEnabled)
  const stopSync = useSyncStore(s => s.stopSync)
  const stopAll = useSyncStore(s => s.stopAll)
  const getGameState = useSyncStore(s => s.getGameState)

  const loadData = useCallback(async () => {
    try {
      const [cat, enabled, primary, cnts] = await Promise.all([api.getGamesCatalog(), api.getEnabledGames(), api.getPrimaryGame(), api.getContestsCountPerGame()])
      setCatalog(cat.filter(c => c.game_type !== 'federal'))
      setEnabledGames(enabled)
      setPrimaryGame(primary || enabled[0] || '')
      const cm: Record<string, number> = {}
      cnts.forEach(([gt, c]) => { cm[gt] = c })
      setCounts(cm)
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      console.error('Erro ao carregar configuracoes:', e)
      setError(errMsg)
      showToast(errMsg, 'error')
      setCatalog([])
      setEnabledGames([])
    }
    finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { loadData() }, [loadData])

  const saveAndReload = async (ne: string[], np: string) => {
    try { await api.completeOnboarding(ne, np); await reloadLotteryStore() } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
  }

  const toggleGame = async (gt: string) => {
    const isOn = enabledGames.includes(gt)
    if (isOn) {
      if (gt === primaryGame) { showToast('Defina outra como principal primeiro.', 'error'); return }
      if (enabledGames.length <= 1) { showToast('Pelo menos uma deve estar habilitada.', 'error'); return }
      const ne = enabledGames.filter(g => g !== gt); setEnabledGames(ne); await saveAndReload(ne, primaryGame)
      showToast(`${catalog.find(c => c.game_type === gt)?.display_name} desabilitada.`, 'info')
    } else {
      const ne = [...enabledGames, gt]; setEnabledGames(ne); await saveAndReload(ne, primaryGame)
      const name = catalog.find(c => c.game_type === gt)?.display_name || gt
      showToast(`${name} habilitada! Sincronizando...`, 'success')
      startSync(gt).then(() => { loadData() })
    }
  }

  const handleSetPrimary = async (gt: string) => {
    if (!enabledGames.includes(gt)) { showToast('Habilite a loteria primeiro.', 'error'); return }
    setPrimaryGame(gt); await saveAndReload(enabledGames, gt)
    showToast(`${catalog.find(c => c.game_type === gt)?.display_name} e a principal!`, 'success')
  }

  const anySyncing = Object.values(syncGames).some(g => g.status === 'syncing' || g.status === 'checking')
  const enabledGameTypes = catalog.filter(c => enabledGames.includes(c.game_type)).map(c => c.game_type)

  const handleSyncAll = async () => { await syncAllEnabled(enabledGameTypes); loadData() }
  const handleCheckAll = async () => { await checkAllGames(enabledGameTypes) }
  const handleSyncSingle = async (gt: string) => { await startSync(gt); loadData() }

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 size={32} className="animate-spin text-primary" /></div>

  if (error) return (
    <div className="h-full flex items-center justify-center flex-col gap-4 p-10">
      <p className="text-lg text-destructive font-semibold">Erro ao carregar</p>
      <p className="text-sm text-muted-foreground text-center max-w-[400px]">{error}</p>
      <Button onClick={() => { setError(null); setLoading(true); loadData() }}>Tentar novamente</Button>
    </div>
  )

  return (
    <div className="h-full overflow-auto px-10 py-8">
      <div className="max-w-[820px] mx-auto">
        <h1 className="text-2xl font-extrabold mb-1 text-foreground">Configuracoes</h1>
        <p className="text-sm text-muted-foreground mb-7">Gerencie loterias, valores e dados.</p>

        {/* Loterias header */}
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[15px] font-bold">Loterias</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCheckAll} disabled={anySyncing} className="gap-1.5">
              <Search size={13} /> Verificar todas
            </Button>
            {anySyncing ? (
              <Button variant="destructive" size="sm" onClick={stopAll} className="gap-1.5">
                <StopCircle size={13} /> Parar todas
              </Button>
            ) : (
              <Button size="sm" onClick={handleSyncAll} className="gap-1.5">
                <Play size={13} /> Sincronizar todas
              </Button>
            )}
          </div>
        </div>

        {/* Lottery cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {catalog.map(l => {
            const isOn = enabledGames.includes(l.game_type)
            const isPri = primaryGame === l.game_type
            const cnt = counts[l.game_type] || 0
            const gameState: GameSyncState = getGameState(l.game_type)

            return (
              <LotteryCard
                key={l.game_type}
                lottery={l}
                isEnabled={isOn}
                isPrimary={isPri}
                contestCount={cnt}
                gameState={gameState}
                syncGames={syncGames}
                onToggle={() => toggleGame(l.game_type)}
                onSetPrimary={() => handleSetPrimary(l.game_type)}
                onSync={() => handleSyncSingle(l.game_type)}
                onCheck={() => checkGameStatus(l.game_type)}
                onStop={() => stopSync(l.game_type)}
              />
            )
          })}
        </div>

        {/* Importacao */}
        <h2 className="text-[15px] font-bold mb-3.5">Importacao base de dados</h2>
        <p className="text-xs text-muted-foreground mb-3.5">
          Baixe os dados de cada loteria individualmente a partir do servidor. Total atual: {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString('pt-BR')} concursos.
        </p>
        <SqlImportList catalog={catalog} counts={counts} onImported={loadData} />

        {/* Valores das apostas */}
        <div className="flex items-center justify-between mb-3.5">
          <h2 className="text-[15px] font-bold">Valores das apostas</h2>
        </div>
        <div className="flex flex-col gap-3.5 mb-8">
          {catalog.filter(c => enabledGames.includes(c.game_type)).map(l => <BetPriceEditor key={l.game_type} lottery={l} />)}
        </div>

        {/* Lunar Calendar */}
        <LunarCalendarSection />

        {/* Factory Reset */}
        <h2 className="text-[15px] font-bold mb-3.5 text-destructive">Zona perigosa</h2>
        <Card className="mb-8 border-destructive/20 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-3.5">
              <Trash2 size={20} className="text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-foreground">Resetar de fabrica</p>
                <p className="text-[11px] text-muted-foreground">Apaga TODOS os dados: concursos, jogos salvos, estatisticas e configuracoes. Acao irreversivel.</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger>
                  <Button variant="outline" size="sm" className="text-destructive border-destructive gap-1.5">
                    <Trash2 size={14} /> Resetar sistema
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar reset de fabrica?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Essa acao ira apagar TODOS os dados: concursos, jogos salvos, estatisticas e configuracoes. Essa acao e irreversivel.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={async () => {
                        setResetting(true)
                        try {
                          const r = await api.factoryReset()
                          showToast(r, 'success')
                          await reloadLotteryStore()
                          window.location.reload()
                        } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
                        finally { setResetting(false) }
                      }}
                      disabled={resetting}
                    >
                      {resetting ? <Loader2 size={14} className="animate-spin mr-2" /> : <Trash2 size={14} className="mr-2" />}
                      {resetting ? 'Resetando...' : 'Confirmar reset'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* Lunar Calendar Section */
function LunarCalendarSection() {
  const { showToast } = useAppStore()
  const [lunarCount, setLunarCount] = useState(0)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getLunarCalendarCount().then(setLunarCount).catch(() => setLunarCount(0))
  }, [])

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      const text = await file.text()
      const result = await api.importLunarCalendar(text)
      showToast(result, 'success')
      const count = await api.getLunarCalendarCount()
      setLunarCount(count)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : String(err), 'error')
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="mb-8">
      <h2 className="text-[15px] font-bold mb-3.5">Calendario Lunar</h2>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
              🌙
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-foreground">Base lunar 1960–2050</p>
              <p className="text-[11px] text-muted-foreground">
                {lunarCount > 0
                  ? `${lunarCount.toLocaleString('pt-BR')} dias carregados. O Assistente IA pode cruzar fases lunares com sorteios.`
                  : 'Importe o calendario lunar para o Assistente IA usar em analises de fases da lua.'}
              </p>
            </div>
            <div>
              <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
              <Button
                variant={lunarCount > 0 ? 'outline' : 'default'}
                size="sm"
                disabled={importing}
                onClick={() => fileRef.current?.click()}
                className="gap-1.5"
              >
                {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {lunarCount > 0 ? 'Reimportar' : 'Importar JSON'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* Lottery Card */
function LotteryCard({
  lottery: l, isEnabled: isOn, isPrimary: isPri, contestCount: cnt, gameState,
  syncGames: _syncGames, onToggle, onSetPrimary, onSync, onCheck, onStop,
}: {
  lottery: LotteryConfig; isEnabled: boolean; isPrimary: boolean; contestCount: number;
  gameState: GameSyncState; syncGames: Record<string, GameSyncState>;
  onToggle: () => void; onSetPrimary: () => void; onSync: () => void; onCheck: () => void; onStop: () => void;
}) {
  const isSyncing = gameState.status === 'syncing'
  const isChecking = gameState.status === 'checking'
  const isDone = gameState.status === 'done'
  const isError = gameState.status === 'error'
  const isPaused = gameState.status === 'paused'
  const isBusy = isSyncing || isChecking
  const anyBusy = Object.values(_syncGames).some(g => g.status === 'syncing' || g.status === 'checking')

  return (
    <Card className={cn(
      'transition-all',
      !isOn && 'opacity-50',
      isPri && 'ring-2',
    )} style={isPri ? { borderColor: l.color, '--tw-ring-color': l.color } as React.CSSProperties : undefined}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: l.color }} />
          <span className="text-sm font-bold flex-1 text-foreground">{l.display_name}</span>
          <button onClick={onSetPrimary} title="Principal" className={cn('bg-transparent border-none cursor-pointer p-0.5 flex transition-opacity', isPri ? 'opacity-100' : 'opacity-30 text-muted-foreground')} style={isPri ? { color: l.color } : undefined}>
            <Star size={15} fill={isPri ? 'currentColor' : 'none'} />
          </button>
          <Switch checked={isOn} onCheckedChange={onToggle} disabled={isBusy} />
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon status={gameState.status} color={l.color} />
            <span className="text-[11px] font-medium text-muted-foreground">{isOn ? 'Habilitada' : 'Desabilitada'}</span>
          </div>
          {cnt > 0 && <span className="text-[10px] text-muted-foreground">{cnt.toLocaleString('pt-BR')} concursos</span>}
        </div>

        {/* Progress bar */}
        {isSyncing && (
          <div className="mb-2">
            <div className="w-full h-1 rounded bg-muted overflow-hidden">
              <div className="h-full rounded animate-pulse" style={{ background: l.color, width: '100%' }} />
            </div>
          </div>
        )}

        {/* Status message */}
        {gameState.message && isOn && (
          <div className={cn(
            'text-[11px] mb-2 font-semibold leading-snug',
            isError && 'text-destructive',
            isDone && !isError && '',
            isPaused && 'text-amber-500',
            !isError && !isDone && !isPaused && 'text-muted-foreground',
          )} style={isDone && !isError ? { color: l.color } : undefined}>
            {gameState.message}
          </div>
        )}

        {/* Error detail */}
        {isError && gameState.error && isOn && (
          <div className="text-[10px] mb-2 px-2 py-1.5 rounded-md bg-destructive/10 text-destructive leading-snug">
            {gameState.error}
          </div>
        )}

        {/* Missing count */}
        {gameState.missing > 0 && !isSyncing && isOn && (
          <div className="text-[11px] text-muted-foreground mb-2 font-medium">{gameState.missing} concursos faltando</div>
        )}

        {/* Action buttons */}
        {isOn && (
          <div className="flex gap-1.5">
            {cnt === 0 && !isSyncing ? (
              <div className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 text-muted-foreground text-[11px] font-semibold">
                <AlertCircle size={13} /> Importe os dados primeiro
              </div>
            ) : isSyncing ? (
              <Button variant="destructive" size="sm" onClick={onStop} className="flex-1 gap-1.5">
                <Square size={12} /> Parar
              </Button>
            ) : isDone && gameState.missing === 0 ? (
              <div className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold" style={{ background: `color-mix(in srgb, ${l.color} 12%, transparent)`, color: l.color }}>
                <CheckCircle size={13} /> Atualizado
              </div>
            ) : isError ? (
              <Button size="sm" variant="destructive" onClick={onSync} disabled={anyBusy} className="flex-1 gap-1.5">
                <RotateCcw size={12} /> Tentar novamente
              </Button>
            ) : (
              <>
                <Button size="sm" onClick={onSync} disabled={anyBusy} className="flex-1 gap-1.5" style={{ background: l.color }}>
                  <RefreshCw size={12} /> Sincronizar
                </Button>
                <Button variant="outline" size="sm" onClick={onCheck} disabled={anyBusy} title="Verificar status">
                  {isChecking ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* Status Icon */
function StatusIcon({ status, color }: { status: GameSyncState['status']; color: string }) {
  switch (status) {
    case 'checking': return <Loader2 size={12} className="animate-spin" style={{ color }} />
    case 'syncing': return <Loader2 size={12} className="animate-spin" style={{ color }} />
    case 'done': return <CheckCircle size={12} style={{ color }} />
    case 'error': return <AlertCircle size={12} className="text-destructive" />
    case 'paused': return <Square size={12} className="text-amber-500" />
    default: return null
  }
}

/* BetPriceEditor */
function BetPriceEditor({ lottery }: { lottery: LotteryConfig }) {
  const { showToast } = useAppStore()
  const [prices, setPrices] = useState<Record<number, number | null>>({})
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState<Record<number, string>>({})

  useEffect(() => { loadPrices() }, [lottery.game_type])

  const loadPrices = async () => {
    const r: Record<number, number | null> = {}
    for (let p = lottery.min_pick_count; p <= lottery.max_pick_count; p++) {
      try { r[p] = await api.getBetPrice(lottery.game_type, p) } catch { r[p] = null }
    }
    setPrices(r)
  }

  const startEditing = () => {
    const ev: Record<number, string> = {}
    for (let p = lottery.min_pick_count; p <= lottery.max_pick_count; p++) {
      ev[p] = prices[p] && typeof prices[p] === 'number' ? (prices[p] as number).toFixed(2) : ''
    }
    setEditValues(ev)
    setEditing(true)
  }

  const saveEdits = async () => {
    try {
      for (const [pick, val] of Object.entries(editValues)) {
        const n = parseFloat(val.replace(',', '.'))
        if (!isNaN(n) && n > 0) await api.updateBetPrice(lottery.game_type, parseInt(pick), n)
      }
      showToast('Valores salvos!', 'success')
      setEditing(false)
      loadPrices()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
  }

  const picks = []; for (let i = lottery.min_pick_count; i <= lottery.max_pick_count; i++) picks.push(i)
  const fmt = (v: number | null | undefined) => v && typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : '--'

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-2 h-2 rounded-full" style={{ background: lottery.color }} />
          <span className="text-[13px] font-bold flex-1">{lottery.display_name}</span>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={startEditing} className="gap-1 text-[11px] font-semibold text-primary h-7 px-2">
              <Pencil size={12} /> Editar
            </Button>
          ) : (
            <div className="flex gap-1.5">
              <Button variant="ghost" size="sm" onClick={saveEdits} className="gap-1 text-[11px] font-semibold text-primary h-7 px-2"><Save size={12} /> Salvar</Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)} className="gap-1 text-[11px] font-semibold text-destructive h-7 px-2"><X size={12} /> Cancelar</Button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2">
          {picks.map(p => (
            <div key={p} className="flex items-center justify-between bg-muted rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">{p} num.</span>
              {editing ? (
                <Input
                  type="text"
                  value={editValues[p] || ''}
                  onChange={e => setEditValues(prev => ({ ...prev, [p]: e.target.value }))}
                  className="w-[70px] text-right text-[13px] font-bold h-7 px-1.5"
                  style={{ borderColor: lottery.color }}
                  placeholder="0.00"
                />
              ) : (
                <span className={cn('text-xs font-bold', prices[p] !== null ? 'text-foreground' : 'text-muted-foreground')}>{fmt(prices[p])}</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/* SQL Import List */
const SQL_FILES: { game_type: string; label: string; file: string }[] = [
  { game_type: 'megasena', label: 'Mega-Sena', file: 'megasena.sql' },
  { game_type: 'lotofacil', label: 'Lotofacil', file: 'lotofacil.sql' },
  { game_type: 'lotomania', label: 'Lotomania', file: 'lotomania.sql' },
  { game_type: 'timemania', label: 'Timemania', file: 'timemania.sql' },
  { game_type: 'quina', label: 'Quina', file: 'quina.sql' },
  { game_type: 'duplasena', label: 'Dupla Sena', file: 'duplasena.sql' },
  { game_type: 'diadesorte', label: 'Dia de Sorte', file: 'diadesorte.sql' },
  { game_type: 'supersete', label: 'Super Sete', file: 'supersete.sql' },
  { game_type: 'maismilionaria', label: '+Milionaria', file: 'maismilionaria.sql' },
]

function SqlImportList({ catalog, counts, onImported }: { catalog: LotteryConfig[]; counts: Record<string, number>; onImported: () => void }) {
  const { showToast } = useAppStore()
  const [downloading, setDownloading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [successes, setSuccesses] = useState<Record<string, boolean>>({})

  const handleDownload = async (item: typeof SQL_FILES[number]) => {
    setDownloading(prev => ({ ...prev, [item.game_type]: true }))
    setErrors(prev => { const n = { ...prev }; delete n[item.game_type]; return n })
    setSuccesses(prev => { const n = { ...prev }; delete n[item.game_type]; return n })
    try {
      const url = `https://dantetesta.com.br/lotolab/loterias/${item.file}`
      const result = await api.downloadAndImportSql(url, item.game_type)
      setSuccesses(prev => ({ ...prev, [item.game_type]: true }))
      showToast(`${item.label}: ${result}`, 'success')
      onImported()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setErrors(prev => ({ ...prev, [item.game_type]: msg }))
      showToast(`${item.label}: ${msg}`, 'error')
    } finally {
      setDownloading(prev => ({ ...prev, [item.game_type]: false }))
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {SQL_FILES.map(item => {
        const isLoading = downloading[item.game_type] || false
        const error = errors[item.game_type]
        const success = successes[item.game_type]
        const catItem = catalog.find(c => c.game_type === item.game_type)
        const color = catItem?.color || 'var(--primary)'
        const cnt = counts[item.game_type] || 0

        return (
          <Card key={item.game_type} className={cn('transition-all', success && 'ring-1')} style={success ? { borderColor: color } : undefined}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                <span className="text-[13px] font-bold flex-1 text-foreground">{item.label}</span>
                {cnt > 0 && <span className="text-[10px] text-muted-foreground">{cnt.toLocaleString('pt-BR')}</span>}
              </div>

              {error && (
                <div className="flex items-start gap-1.5 mb-2 px-2 py-1.5 rounded-lg bg-destructive/10">
                  <AlertCircle size={13} className="text-destructive shrink-0 mt-0.5" />
                  <span className="text-[11px] text-destructive leading-snug">{error}</span>
                </div>
              )}

              {success && !isLoading && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-lg" style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
                  <CheckCircle size={13} style={{ color }} className="shrink-0" />
                  <span className="text-[11px] font-semibold" style={{ color }}>Importado com sucesso!</span>
                </div>
              )}

              <Button
                onClick={() => handleDownload(item)}
                disabled={isLoading}
                className="w-full gap-1.5"
                style={!isLoading ? { background: color } : undefined}
                variant={isLoading ? 'secondary' : 'default'}
              >
                {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {isLoading ? 'Baixando e importando...' : 'Baixar e importar'}
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
