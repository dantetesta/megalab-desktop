import { useState, useEffect, useCallback } from 'react'
import { api, type LotteryConfig } from '../lib/tauri.ts'
import { useAppStore } from '../stores/appStore.ts'
import { useLotteryStore } from '../stores/lotteryStore.ts'
import { useSyncStore, type GameSyncState } from '../stores/syncStore.ts'
import {
  Loader2, Star, RefreshCw, Pencil, Save, X,
  CheckCircle, Download, AlertCircle, Trash2, Square, Play,
  Search, StopCircle, RotateCcw,
} from 'lucide-react'

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
  const [confirmReset, setConfirmReset] = useState(false)

  // Sync store (global, persists across navigation)
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
      console.error('Erro ao carregar configurações:', e)
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
    showToast(`${catalog.find(c => c.game_type === gt)?.display_name} é a principal!`, 'success')
  }


  const anySyncing = Object.values(syncGames).some(g => g.status === 'syncing' || g.status === 'checking')
  const enabledGameTypes = catalog.filter(c => enabledGames.includes(c.game_type)).map(c => c.game_type)

  const handleSyncAll = async () => {
    await syncAllEnabled(enabledGameTypes)
    loadData()
  }

  const handleCheckAll = async () => {
    await checkAllGames(enabledGameTypes)
  }

  const handleSyncSingle = async (gt: string) => {
    await startSync(gt)
    loadData()
  }

  if (loading) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--ml-primary)' }} /></div>

  if (error) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 40 }}><p style={{ fontSize: 18, color: 'var(--ml-error)', fontWeight: 600 }}>Erro ao carregar</p><p style={{ fontSize: 14, color: 'var(--ml-on-surface-variant)', textAlign: 'center', maxWidth: 400 }}>{error}</p><button onClick={() => { setError(null); setLoading(true); loadData() }} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--ml-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Tentar novamente</button></div>

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Configurações</h1>
        <p style={{ fontSize: 14, color: 'var(--ml-on-surface-variant)', marginBottom: 28 }}>Gerencie loterias, valores e dados.</p>

        {/* Loterias header with bulk actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Loterias</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCheckAll}
              disabled={anySyncing}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 8, border: '1px solid var(--ml-outline-variant)',
                background: 'var(--ml-surface)', color: 'var(--ml-on-surface-variant)',
                fontSize: 11, fontWeight: 600, cursor: anySyncing ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: anySyncing ? 0.5 : 1,
              }}
            >
              <Search size={13} /> Verificar todas
            </button>
            {anySyncing ? (
              <button
                onClick={stopAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: 'var(--ml-error)', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <StopCircle size={13} /> Parar todas
              </button>
            ) : (
              <button
                onClick={handleSyncAll}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: 'var(--ml-primary)', color: '#fff',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                <Play size={13} /> Sincronizar todas
              </button>
            )}
          </div>
        </div>

        {/* Lottery cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 32 }}>
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

        {/* Importação de base de dados via URL */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Importação base de dados</h2>
        <p style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)', marginBottom: 14 }}>
          Baixe os dados de cada loteria individualmente a partir do servidor. Total atual: {Object.values(counts).reduce((a, b) => a + b, 0).toLocaleString('pt-BR')} concursos.
        </p>
        <SqlImportList catalog={catalog} counts={counts} onImported={loadData} />

        {/* Valores das apostas */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Valores das apostas</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
          {catalog.filter(c => enabledGames.includes(c.game_type)).map(l => <BetPriceEditor key={l.game_type} lottery={l} />)}
        </div>

        {/* Factory Reset */}
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: 'var(--ml-error)' }}>Zona perigosa</h2>
        <div style={{ background: 'color-mix(in srgb, var(--ml-error) 6%, var(--ml-surface-low))', borderRadius: 14, padding: 18, marginBottom: 32, border: '1px solid color-mix(in srgb, var(--ml-error) 20%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Trash2 size={20} style={{ color: 'var(--ml-error)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ml-on-surface)' }}>Resetar de fábrica</p>
              <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)' }}>Apaga TODOS os dados: concursos, jogos salvos, estatísticas e configurações. Ação irreversível.</p>
            </div>
            {!confirmReset ? (
              <button onClick={() => setConfirmReset(true)} style={{
                fontSize: 12, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--ml-error)',
                background: 'transparent', color: 'var(--ml-error)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <Trash2 size={14} /> Resetar sistema
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmReset(false)} style={{
                  fontSize: 12, padding: '8px 14px', borderRadius: 10, border: 'none',
                  background: 'var(--ml-surface-high)', color: 'var(--ml-on-surface-variant)', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  Cancelar
                </button>
                <button onClick={async () => {
                  setResetting(true)
                  try {
                    const r = await api.factoryReset()
                    showToast(r, 'success')
                    setConfirmReset(false)
                    await reloadLotteryStore()
                    window.location.reload()
                  } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
                  finally { setResetting(false) }
                }} disabled={resetting} style={{
                  fontSize: 12, padding: '8px 16px', borderRadius: 10, border: 'none',
                  background: 'var(--ml-error)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 6, opacity: resetting ? 0.6 : 1,
                }}>
                  {resetting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {resetting ? 'Resetando...' : 'Confirmar reset'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ───────── Lottery Card Component ───────── */

function LotteryCard({
  lottery: l,
  isEnabled: isOn,
  isPrimary: isPri,
  contestCount: cnt,
  gameState,
  syncGames: _syncGames,
  onToggle,
  onSetPrimary,
  onSync,
  onCheck,
  onStop,
}: {
  lottery: LotteryConfig
  isEnabled: boolean
  isPrimary: boolean
  contestCount: number
  gameState: GameSyncState
  syncGames: Record<string, GameSyncState>
  onToggle: () => void
  onSetPrimary: () => void
  onSync: () => void
  onCheck: () => void
  onStop: () => void
}) {
  const isSyncing = gameState.status === 'syncing'
  const isChecking = gameState.status === 'checking'
  const isDone = gameState.status === 'done'
  const isError = gameState.status === 'error'
  const isPaused = gameState.status === 'paused'
  const isBusy = isSyncing || isChecking

  // Check if any game is syncing globally (to disable certain actions)
  const anyBusy = Object.values(_syncGames).some(g => g.status === 'syncing' || g.status === 'checking')

  return (
    <div style={{
      background: isOn ? 'var(--ml-surface-low)' : 'var(--ml-surface)',
      borderRadius: 14,
      padding: '14px 16px',
      border: isPri ? `2px solid ${l.color}` : '1px solid var(--ml-outline-variant)',
      opacity: isOn ? 1 : 0.5,
      transition: 'all 0.2s',
    }}>
      {/* Header row: name, star, toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>{l.display_name}</span>
        <button onClick={onSetPrimary} title="Principal" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', color: isPri ? l.color : 'var(--ml-on-surface-variant)', opacity: isPri ? 1 : 0.3 }}>
          <Star size={15} fill={isPri ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onToggle} disabled={isBusy} style={{
          width: 42, height: 24, borderRadius: 12, border: 'none', cursor: isBusy ? 'default' : 'pointer',
          background: isOn ? l.color : 'var(--ml-outline-variant)', position: 'relative', padding: 0,
          transition: 'background 0.2s', opacity: isBusy ? 0.5 : 1,
        }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: isOn ? 21 : 3, transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
        </button>
      </div>

      {/* Info row: status + count */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <StatusIcon status={gameState.status} color={l.color} />
          <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ml-on-surface-variant)' }}>
            {isOn ? 'Habilitada' : 'Desabilitada'}
          </span>
        </div>
        {cnt > 0 && (
          <span style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)' }}>
            {cnt.toLocaleString('pt-BR')} concursos
          </span>
        )}
      </div>

      {/* Progress bar when syncing */}
      {isSyncing && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            width: '100%', height: 4, borderRadius: 2,
            background: 'var(--ml-surface-high)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: l.color,
              width: '100%',
              animation: 'syncPulse 1.5s ease-in-out infinite',
            }} />
          </div>
          <style>{`@keyframes syncPulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }`}</style>
        </div>
      )}

      {/* Status message */}
      {gameState.message && isOn && (
        <div style={{
          fontSize: 11, marginBottom: 8, fontWeight: 600, lineHeight: 1.3,
          color: isError ? 'var(--ml-error)' : isDone ? l.color : isPaused ? 'var(--ml-warning, #f59e0b)' : 'var(--ml-on-surface-variant)',
        }}>
          {gameState.message}
        </div>
      )}

      {/* Error detail */}
      {isError && gameState.error && isOn && (
        <div style={{
          fontSize: 10, marginBottom: 8, padding: '6px 8px', borderRadius: 6,
          background: 'color-mix(in srgb, var(--ml-error) 10%, transparent)',
          color: 'var(--ml-error)', lineHeight: 1.3,
        }}>
          {gameState.error}
        </div>
      )}

      {/* Missing count */}
      {gameState.missing > 0 && !isSyncing && isOn && (
        <div style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginBottom: 8, fontWeight: 500 }}>
          {gameState.missing} concursos faltando
        </div>
      )}

      {/* Action buttons */}
      {isOn && (
        <div style={{ display: 'flex', gap: 6 }}>
          {cnt === 0 && !isSyncing ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8,
              background: 'color-mix(in srgb, var(--ml-on-surface-variant) 8%, transparent)',
              color: 'var(--ml-on-surface-variant)', fontSize: 11, fontWeight: 600,
            }}>
              <AlertCircle size={13} /> Importe os dados primeiro
            </div>
          ) : isSyncing ? (
            <button onClick={onStop} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--ml-error)', color: '#fff',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}>
              <Square size={12} /> Parar
            </button>
          ) : isDone && gameState.missing === 0 ? (
            <div style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8,
              background: `color-mix(in srgb, ${l.color} 12%, transparent)`,
              color: l.color, fontSize: 11, fontWeight: 600,
            }}>
              <CheckCircle size={13} /> Atualizado
            </div>
          ) : isError ? (
            <button onClick={onSync} disabled={anyBusy} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '7px 10px', borderRadius: 8, border: 'none', cursor: anyBusy ? 'default' : 'pointer',
              background: 'var(--ml-error)', color: '#fff',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit', opacity: anyBusy ? 0.5 : 1,
            }}>
              <RotateCcw size={12} /> Tentar novamente
            </button>
          ) : (
            <>
              <button onClick={onSync} disabled={anyBusy} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                padding: '7px 10px', borderRadius: 8, border: 'none', cursor: anyBusy ? 'default' : 'pointer',
                background: l.color, color: '#fff',
                fontSize: 11, fontWeight: 600, fontFamily: 'inherit', opacity: anyBusy ? 0.5 : 1,
              }}>
                <RefreshCw size={12} /> Sincronizar
              </button>
              <button onClick={onCheck} disabled={anyBusy} title="Verificar status" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '7px 10px', borderRadius: 8, border: '1px solid var(--ml-outline-variant)',
                background: 'var(--ml-surface)', cursor: anyBusy ? 'default' : 'pointer',
                color: 'var(--ml-on-surface-variant)', opacity: anyBusy ? 0.5 : 1,
              }}>
                {isChecking ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────── Status Icon ───────── */

function StatusIcon({ status, color }: { status: GameSyncState['status']; color: string }) {
  switch (status) {
    case 'checking':
      return <Loader2 size={12} className="animate-spin" style={{ color }} />
    case 'syncing':
      return <Loader2 size={12} className="animate-spin" style={{ color }} />
    case 'done':
      return <CheckCircle size={12} style={{ color }} />
    case 'error':
      return <AlertCircle size={12} style={{ color: 'var(--ml-error)' }} />
    case 'paused':
      return <Square size={12} style={{ color: 'var(--ml-warning, #f59e0b)' }} />
    default:
      return null
  }
}

/* ───────── BetPriceEditor (unchanged) ───────── */

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
        if (!isNaN(n) && n > 0) {
          await api.updateBetPrice(lottery.game_type, parseInt(pick), n)
        }
      }
      showToast('Valores salvos!', 'success')
      setEditing(false)
      loadPrices()
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : String(e), 'error') }
  }

  const picks = []; for (let i = lottery.min_pick_count; i <= lottery.max_pick_count; i++) picks.push(i)
  const fmt = (v: number | null | undefined) => v && typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : '--'

  return (
    <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: lottery.color }} />
        <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{lottery.display_name}</span>
        {!editing ? (
          <button onClick={startEditing} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--ml-primary)', fontFamily: 'inherit' }}>
            <Pencil size={12} /> Editar
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={saveEdits} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--ml-primary)', fontFamily: 'inherit' }}>
              <Save size={12} /> Salvar
            </button>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: 'var(--ml-error)', fontFamily: 'inherit' }}>
              <X size={12} /> Cancelar
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6 }}>
        {picks.map(p => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ml-surface)', borderRadius: 8, padding: '6px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ml-on-surface-variant)' }}>{p} num.</span>
            {editing ? (
              <input type="text" value={editValues[p] || ''} onChange={e => setEditValues(prev => ({ ...prev, [p]: e.target.value }))}
                style={{ width: 70, textAlign: 'right', fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: 'var(--ml-on-surface)', background: 'var(--ml-surface-high)', border: `1px solid ${lottery.color}`, borderRadius: 6, padding: '3px 6px', outline: 'none' }}
                placeholder="0.00" />
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: prices[p] !== null ? 'var(--ml-on-surface)' : 'var(--ml-on-surface-variant)' }}>{fmt(prices[p])}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────── SQL Import List (unchanged) ───────── */

const SQL_FILES: { game_type: string; label: string; file: string }[] = [
  { game_type: 'megasena', label: 'Mega-Sena', file: 'megasena.sql' },
  { game_type: 'lotofacil', label: 'Lotofácil', file: 'lotofacil.sql' },
  { game_type: 'lotomania', label: 'Lotomania', file: 'lotomania.sql' },
  { game_type: 'timemania', label: 'Timemania', file: 'timemania.sql' },
  { game_type: 'quina', label: 'Quina', file: 'quina.sql' },
  { game_type: 'duplasena', label: 'Dupla Sena', file: 'duplasena.sql' },
  { game_type: 'diadesorte', label: 'Dia de Sorte', file: 'diadesorte.sql' },
  { game_type: 'supersete', label: 'Super Sete', file: 'supersete.sql' },
  { game_type: 'maismilionaria', label: '+Milionária', file: 'maismilionaria.sql' },
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
      // Download via Rust backend (bypasses CORS)
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10, marginBottom: 24 }}>
      {SQL_FILES.map(item => {
        const isLoading = downloading[item.game_type] || false
        const error = errors[item.game_type]
        const success = successes[item.game_type]
        const catItem = catalog.find(c => c.game_type === item.game_type)
        const color = catItem?.color || 'var(--ml-primary)'
        const cnt = counts[item.game_type] || 0

        return (
          <div key={item.game_type} style={{
            background: 'var(--ml-surface-low)', borderRadius: 14, padding: '14px 16px',
            border: success ? `1px solid ${color}` : '1px solid var(--ml-outline-variant)',
            transition: 'all 0.2s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1, color: 'var(--ml-on-surface)' }}>{item.label}</span>
              {cnt > 0 && <span style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)' }}>{cnt.toLocaleString('pt-BR')}</span>}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: 'color-mix(in srgb, var(--ml-error) 10%, transparent)' }}>
                <AlertCircle size={13} style={{ color: 'var(--ml-error)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: 'var(--ml-error)', lineHeight: 1.3 }}>{error}</span>
              </div>
            )}

            {success && !isLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '6px 8px', borderRadius: 8, background: `color-mix(in srgb, ${color} 10%, transparent)` }}>
                <CheckCircle size={13} style={{ color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color, fontWeight: 600 }}>Importado com sucesso!</span>
              </div>
            )}

            <button
              onClick={() => handleDownload(item)}
              disabled={isLoading}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 12px', borderRadius: 10, border: 'none', cursor: isLoading ? 'default' : 'pointer',
                background: isLoading ? 'var(--ml-surface-container)' : color,
                color: isLoading ? 'var(--ml-on-surface-variant)' : '#fff',
                fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                opacity: isLoading ? 0.7 : 1, transition: 'all 0.2s',
              }}
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isLoading ? 'Baixando e importando...' : 'Baixar e importar'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
