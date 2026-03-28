import { useState, useEffect } from 'react'
import { api, type SavedGame, type GameAnalysis, type BetCheckResult } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import NumberBall from '../components/NumberBall'
import GameXray from '../components/GameXray'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Star, Trash2, Copy, BarChart3, Ticket, ClipboardList, Download, Trophy, PlusCircle, DollarSign } from 'lucide-react'
import GameCreator from '../components/GameCreator'
import { useLotteryStore } from '../stores/lotteryStore'
import LotteryTabs from '../components/LotteryTabs'

function SuperSeteColumnBalls({ numbers, size = 'md' }: { numbers: number[]; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div style={{ display: 'flex', gap: size === 'sm' ? 3 : 4, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {numbers.map((n, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: size === 'sm' ? 8 : 9, fontWeight: 700, color: 'var(--ml-primary)', opacity: 0.7 }}>C{i + 1}</span>
          <NumberBall number={n} size={size} />
        </div>
      ))}
    </div>
  )
}

export default function MeusJogos() {
  const { showToast } = useAppStore()
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const [showCreator, setShowCreator] = useState(false)
  const [games, setGames] = useState<SavedGame[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'favorites' | 'bets'>('all')
  const [expandedXray, setExpandedXray] = useState<number | null>(null)
  const [xrayCache, setXrayCache] = useState<Record<number, GameAnalysis>>({})
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [betResults, setBetResults] = useState<BetCheckResult[] | null>(null)
  const [checkingBets, setCheckingBets] = useState(false)
  const [contestInput, setContestInput] = useState<string>('')
  const [consultingContest, setConsultingContest] = useState(false)
  const [priceMap, setPriceMap] = useState<Record<number, number>>({})

  const load = async () => { setLoading(true); try { setGames(await api.listSavedGames(activeGame)) } catch {} finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  useEffect(() => {
    load(); setBetResults(null); setPriceMap({})
  }, [activeGame])

  // Build a price map keyed by number count for all distinct pick counts in current games
  useEffect(() => {
    if (games.length === 0) return
    const counts = [...new Set(games.map(g => g.numbers.length))]
    const newMap: Record<number, number> = {}
    Promise.all(counts.map(c =>
      api.getBetPrice(activeGame, c).then(p => { if (p) newMap[c] = p }).catch(() => {})
    )).then(() => setPriceMap(newMap))
  }, [games, activeGame])

  const filtered = games.filter(g => filter === 'favorites' ? g.is_favorite : filter === 'bets' ? g.is_bet : true)

  const handleXray = async (game: SavedGame) => {
    if (expandedXray === game.id) { setExpandedXray(null); return }
    if (xrayCache[game.id]) { setExpandedXray(game.id); return }
    setAnalyzingId(game.id)
    try { const a = await api.analyzeGame(game.numbers, activeGame); setXrayCache(p => ({ ...p, [game.id]: a })); setExpandedXray(game.id) }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setAnalyzingId(null) }
  }

  // Per-tab bet checking - only checks bets for the active game type
  const handleCheckBets = async () => {
    setCheckingBets(true)
    try {
      const allResults = await api.checkBetResults(activeGame)
      // Filter results to only show bets that belong to games of the current activeGame type
      const currentGameBets = games.filter(g => g.is_bet).map(g => g.id)
      const filteredResults = allResults.filter(r => currentGameBets.includes(r.game_id))
      setBetResults(filteredResults)
      if (filteredResults.length > 0) {
        setContestInput(String(filteredResults[0].contest_number))
      }
      if (filteredResults.length === 0) {
        showToast(`Nenhuma aposta marcada para ${enabledGames.find(g => g.game_type === activeGame)?.display_name || activeGame}.`, 'info')
      }
    }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setCheckingBets(false) }
  }

  const handleConsultContest = async () => {
    const num = parseInt(contestInput)
    if (!num || num <= 0) { showToast('Informe um número de concurso válido.', 'error'); return }
    setConsultingContest(true)
    try {
      const results = await api.checkBetResultsForContest(activeGame, num)
      setBetResults(results)
      if (results.length === 0) {
        showToast(`Nenhuma aposta marcada para ${enabledGames.find(g => g.game_type === activeGame)?.display_name || activeGame}.`, 'info')
      }
    }
    catch (e: any) { showToast(e?.toString() || 'Erro ao consultar concurso', 'error') }
    finally { setConsultingContest(false) }
  }

  const exportCsv = async () => {
    try { const c = await api.exportSavedGamesCsv(); const b = new Blob([c], { type: 'text/csv' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `meus_jogos.csv`; a.click(); URL.revokeObjectURL(u); showToast('CSV exportado!', 'success') }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  const hasBets = games.some(g => g.is_bet)
  const currentGameName = enabledGames.find(g => g.game_type === activeGame)?.display_name || ''
  const fmtPrice = (v: number | null | undefined) => v && typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : null
  const betsCount = games.filter(g => g.is_bet).length
  const getGamePrice = (g: SavedGame) => priceMap[g.numbers.length] ?? null
  const totalBetValue = betsCount > 0
    ? games.filter(g => g.is_bet).reduce((sum, g) => sum + (getGamePrice(g) ?? 0), 0) || null
    : null

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Meus Jogos</h2>
          <p style={{ fontSize: 14, color: 'var(--ml-on-surface-variant)', marginTop: 4 }}>{games.length} jogo{games.length !== 1 ? 's' : ''} salvo{games.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }} onClick={() => setShowCreator(true)}>
            <PlusCircle size={14} /> Criar jogo
          </button>
          {games.length > 0 && (
            <>
              {hasBets && <button className="btn-secondary" style={{ fontSize: 11, padding: '8px 12px' }} onClick={handleCheckBets} disabled={checkingBets}><Trophy size={13} /> {checkingBets ? 'Conferindo...' : `Conferir ${currentGameName}`}</button>}
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={async () => { try { const t = await api.formatAllGamesForClipboard(filtered.map(g => g.numbers)); await writeText(t); showToast('Copiados!', 'success') } catch {} }}><Copy size={13} /> Copiar</button>
              <button className="btn-ghost" style={{ fontSize: 11 }} onClick={exportCsv}><Download size={13} /> CSV</button>
            </>
          )}
        </div>
      </div>

      {/* Lottery tabs */}
      {enabledGames.length > 0 && (
        <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />
      )}

      {/* Bet check results */}
      {betResults && betResults.length > 0 && (
        <div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ml-secondary) 10%, var(--ml-surface-low)), var(--ml-surface-low))', borderRadius: 16, padding: 20, marginTop: 15, marginBottom: 20, border: '1px solid color-mix(in srgb, var(--ml-secondary) 20%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <Trophy size={18} style={{ color: 'var(--ml-secondary)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-secondary)' }}>Resultado — {currentGameName} — Concurso</span>
            <input
              type="number"
              value={contestInput}
              onChange={e => setContestInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConsultContest()}
              style={{
                width: 90, fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
                padding: '4px 8px', borderRadius: 8, border: '1px solid color-mix(in srgb, var(--ml-secondary) 40%, transparent)',
                background: 'var(--ml-surface-container)', color: 'var(--ml-secondary)',
                textAlign: 'center', outline: 'none',
              }}
            />
            <button
              onClick={handleConsultContest}
              disabled={consultingContest}
              style={{
                fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
                border: '1px solid color-mix(in srgb, var(--ml-secondary) 30%, transparent)',
                background: 'color-mix(in srgb, var(--ml-secondary) 12%, transparent)',
                color: 'var(--ml-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >{consultingContest ? 'Consultando...' : 'Consultar'}</button>
            <button onClick={() => setBetResults(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ml-on-surface-variant)', fontSize: 11 }}>Fechar</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)' }}>Dezenas sorteadas:</span>
            {betResults[0].contest_numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {betResults.map(r => (
              <div key={r.game_id} style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {r.game_numbers.map(n => (
                    <span key={n} style={{
                      width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
                      background: r.hits.includes(n) ? 'linear-gradient(145deg, var(--ml-primary), var(--ml-primary-container))' : 'var(--ml-surface-highest)',
                      color: r.hits.includes(n) ? 'var(--ml-on-primary)' : 'var(--ml-on-surface-variant)',
                      boxShadow: r.hits.includes(n) ? 'inset 0 1px 3px rgba(255,255,255,0.3)' : 'none',
                    }}>{String(n).padStart(2, '0')}</span>
                  ))}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: r.hit_count >= 4 ? 'var(--ml-secondary)' : 'var(--ml-on-surface)' }}>{r.prize_label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {betResults && betResults.length === 0 && (
        <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: 20, marginTop: 15, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>Nenhum jogo marcado como apostado para {currentGameName}.</p>
        </div>
      )}

      {/* Filters */}
      {games.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, marginTop: 15 }}>
          {(['all', 'favorites', 'bets'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit', minHeight: 36,
              background: filter === f ? 'color-mix(in srgb, var(--ml-primary) 12%, transparent)' : 'var(--ml-surface-high)',
              color: filter === f ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
            }}>{f === 'all' ? 'Todos' : f === 'favorites' ? 'Favoritos' : 'Apostados'}</button>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && games.length === 0 && (
        <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: 60, textAlign: 'center' }}>
          <ClipboardList size={40} style={{ color: 'var(--ml-on-surface-variant)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nenhum jogo salvo.</h3>
          <p style={{ fontSize: 14, color: 'var(--ml-on-surface-variant)', marginBottom: 20 }}>Crie um jogo personalizado ou use o Gerador.</p>
          <button className="btn-primary" onClick={() => setShowCreator(true)} style={{ fontSize: 14 }}>
            <PlusCircle size={16} /> Criar meu jogo
          </button>
        </div>
      )}

      {/* Bet value summary */}
      {hasBets && Object.keys(priceMap).length > 0 && (
        <div style={{ background: 'color-mix(in srgb, var(--ml-secondary) 8%, var(--ml-surface-low))', borderRadius: 12, padding: '12px 18px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: '1px solid color-mix(in srgb, var(--ml-secondary) 15%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>
            <DollarSign size={15} style={{ color: 'var(--ml-secondary)' }} />
            <span><strong>{betsCount}</strong> aposta{betsCount > 1 ? 's' : ''} marcada{betsCount > 1 ? 's' : ''}</span>
          </div>
          {totalBetValue && (
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ml-secondary)' }}>
              Total: {fmtPrice(totalBetValue)}
            </span>
          )}
        </div>
      )}

      {/* Games */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((game) => {
          const isExp = expandedXray === game.id
          const analysis = xrayCache[game.id]
          const displayName = game.name && game.name.trim() ? game.name : null
          const manyNums = game.numbers.length > 10
          return (
            <div key={game.id} style={{ background: 'var(--ml-surface-low)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {!manyNums && (activeGame === 'supersete'
                    ? <SuperSeteColumnBalls numbers={game.numbers} size="md" />
                    : <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        {game.numbers.map(n => <NumberBall key={n} number={n} size="md" />)}
                      </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {displayName && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-on-surface)' }}>{displayName}</span>}
                      <span style={{ fontSize: 12, fontWeight: displayName ? 500 : 700, color: displayName ? 'var(--ml-on-surface-variant)' : 'var(--ml-primary)' }}>{game.strategy_label}</span>
                      {game.is_bet && <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 99, background: 'color-mix(in srgb, var(--ml-secondary) 15%, transparent)', color: 'var(--ml-secondary)' }}>Apostado</span>}
                      {game.is_bet && getGamePrice(game) && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-secondary)' }}>{fmtPrice(getGamePrice(game))}</span>}
                      {game.notes?.startsWith('Mês da Sorte:') && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#FBBF24', background: 'color-mix(in srgb, #FBBF24 12%, transparent)', padding: '2px 8px', borderRadius: 8 }}>
                          📅 {game.notes.replace('Mês da Sorte: ', '')}
                        </span>
                      )}
                      {game.notes?.startsWith('Time do Coração:') && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#34D399', background: 'color-mix(in srgb, #34D399 12%, transparent)', padding: '2px 8px', borderRadius: 8 }}>
                          💚 {game.notes.replace('Time do Coração: ', '')}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{new Date(game.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                    <Btn icon={<Star size={14} fill={game.is_favorite ? 'currentColor' : 'none'} />} tip="Fav" color={game.is_favorite ? 'var(--ml-secondary)' : undefined} onClick={() => api.toggleFavoriteGame(game.id).then(() => load())} />
                    <Btn icon={<Ticket size={14} />} tip={game.is_bet ? 'Desapostar' : 'Apostar'} color={game.is_bet ? 'var(--ml-primary)' : undefined} onClick={() => api.toggleBetGame(game.id).then(() => load())} />
                    <Btn icon={<BarChart3 size={14} />} tip="X-Ray" color={isExp ? 'var(--ml-info)' : undefined} loading={analyzingId === game.id} onClick={() => handleXray(game)} />
                    <Btn icon={<Copy size={14} />} tip="Copiar" onClick={async () => { const t = await api.formatGameForClipboard(game.numbers); await writeText(t); showToast('Copiado!', 'success') }} />
                    <Btn icon={<Trash2 size={14} />} tip="Excluir" danger onClick={() => api.deleteSavedGame(game.id).then(() => { showToast('Excluído.', 'info'); if (expandedXray === game.id) setExpandedXray(null); load() })} />
                  </div>
                </div>
                {manyNums && (activeGame === 'supersete'
                  ? <div style={{ marginTop: 10 }}><SuperSeteColumnBalls numbers={game.numbers} size="sm" /></div>
                  : <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 10 }}>
                      {game.numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}
                    </div>
                )}
              </div>
              {isExp && analysis && (
                <div style={{ padding: '0 20px 20px' }}>
                  <GameXray analysis={analysis} compact gameType={activeGame} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Game Creator Modal */}
      {showCreator && (
        <GameCreator
          onClose={() => setShowCreator(false)}
          onSaved={() => { load(); setShowCreator(false) }}
        />
      )}
    </div>
  )
}

function Btn({ icon, tip, onClick, color, danger, loading: ld }: { icon: React.ReactNode; tip: string; onClick: () => void; color?: string; danger?: boolean; loading?: boolean }) {
  return (
    <button onClick={onClick} title={tip} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
      padding: '5px 7px', borderRadius: 8, border: 'none', cursor: 'pointer',
      background: 'transparent', fontFamily: 'inherit',
      color: color || (danger ? 'var(--ml-error)' : 'var(--ml-on-surface-variant)'),
      minWidth: 38, transition: 'all 0.15s ease',
    }}>
      {ld ? <div style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : icon}
      <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{tip}</span>
    </button>
  )
}
