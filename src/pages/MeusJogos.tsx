import { useState, useEffect } from 'react'
import { api, type SavedGame, type GameAnalysis, type BetCheckResult } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import NumberBall from '@/components/NumberBall'
import GameXray from '@/components/GameXray'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Star, Trash2, Copy, BarChart3, Ticket, ClipboardList, Download, Trophy, PlusCircle, DollarSign } from 'lucide-react'
import GameCreator from '@/components/GameCreator'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

function SuperSeteColumnBalls({ numbers, size = 'md' }: { numbers: number[]; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <div className={cn('flex flex-wrap items-end', size === 'sm' ? 'gap-1' : 'gap-1')}>
      {numbers.map((n, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span className={cn('font-bold text-primary/70', size === 'sm' ? 'text-[8px]' : 'text-[9px]')}>C{i + 1}</span>
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
  useEffect(() => { load(); setBetResults(null); setPriceMap({}) }, [activeGame])

  useEffect(() => {
    if (games.length === 0) return
    const counts = [...new Set(games.map(g => g.numbers.length))]
    const newMap: Record<number, number> = {}
    Promise.all(counts.map(c => api.getBetPrice(activeGame, c).then(p => { if (p) newMap[c] = p }).catch(() => {}))).then(() => setPriceMap(newMap))
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

  const handleCheckBets = async () => {
    setCheckingBets(true)
    try {
      const allResults = await api.checkBetResults(activeGame)
      const currentGameBets = games.filter(g => g.is_bet).map(g => g.id)
      const filteredResults = allResults.filter(r => currentGameBets.includes(r.game_id))
      setBetResults(filteredResults)
      if (filteredResults.length > 0) setContestInput(String(filteredResults[0].contest_number))
      if (filteredResults.length === 0) showToast(`Nenhuma aposta marcada para ${enabledGames.find(g => g.game_type === activeGame)?.display_name || activeGame}.`, 'info')
    } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setCheckingBets(false) }
  }

  const handleConsultContest = async () => {
    const num = parseInt(contestInput)
    if (!num || num <= 0) { showToast('Informe um numero de concurso valido.', 'error'); return }
    setConsultingContest(true)
    try {
      const results = await api.checkBetResultsForContest(activeGame, num)
      setBetResults(results)
      if (results.length === 0) showToast(`Nenhuma aposta marcada para ${enabledGames.find(g => g.game_type === activeGame)?.display_name || activeGame}.`, 'info')
    } catch (e: any) { showToast(e?.toString() || 'Erro ao consultar concurso', 'error') }
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
  const totalBetValue = betsCount > 0 ? games.filter(g => g.is_bet).reduce((sum, g) => sum + (getGamePrice(g) ?? 0), 0) || null : null

  return (
    <div className="h-full overflow-auto px-10 py-8">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Meus Jogos</h2>
            <p className="text-sm text-muted-foreground mt-1">{games.length} jogo{games.length !== 1 ? 's' : ''} salvo{games.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setShowCreator(true)} className="gap-1.5"><PlusCircle size={14} /> Criar jogo</Button>
          {games.length > 0 && (
            <>
              {hasBets && <Button variant="secondary" size="sm" onClick={handleCheckBets} disabled={checkingBets} className="gap-1.5"><Trophy size={13} /> {checkingBets ? 'Conferindo...' : `Conferir`}</Button>}
              <Button variant="outline" size="sm" className="gap-1.5" onClick={async () => { try { const t = await api.formatAllGamesForClipboard(filtered.map(g => g.numbers)); await writeText(t); showToast('Copiados!', 'success') } catch {} }}><Copy size={13} /> Copiar</Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportCsv}><Download size={13} /> CSV</Button>
            </>
          )}
        </div>
      </div>

      {/* Lottery tabs */}
      {enabledGames.length > 0 && <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />}

      {/* Bet check results */}
      {betResults && betResults.length > 0 && (
        <Card className="mt-4 mb-5 border-secondary/20 bg-gradient-to-br from-secondary/10 to-card">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3.5 flex-wrap">
              <Trophy size={18} className="text-secondary" />
              <span className="text-[13px] font-bold text-secondary">Resultado - {currentGameName} - Concurso</span>
              <Input
                type="number"
                value={contestInput}
                onChange={e => setContestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConsultContest()}
                className="w-[90px] text-center font-mono font-bold text-secondary border-secondary/40"
              />
              <Button variant="outline" size="sm" onClick={handleConsultContest} disabled={consultingContest} className="text-secondary border-secondary/30">
                {consultingContest ? 'Consultando...' : 'Consultar'}
              </Button>
              <button onClick={() => setBetResults(null)} className="ml-auto bg-transparent border-none cursor-pointer text-muted-foreground text-[11px]">Fechar</button>
            </div>
            <div className="flex gap-1.5 mb-3.5 flex-wrap items-center">
              <span className="text-[11px] text-muted-foreground">Dezenas sorteadas:</span>
              {betResults[0].contest_numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}
            </div>
            <div className="flex flex-col gap-2">
              {betResults.map(r => (
                <Card key={r.game_id}>
                  <CardContent className="px-4 py-3.5 flex items-center gap-3.5">
                    <div className="flex gap-1 shrink-0">
                      {r.game_numbers.map(n => (
                        <span key={n} className={cn(
                          'w-8 h-8 rounded-full inline-flex items-center justify-center text-[11px] font-bold font-mono',
                          r.hits.includes(n)
                            ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)]'
                            : 'bg-muted text-muted-foreground',
                        )}>{String(n).padStart(2, '0')}</span>
                      ))}
                    </div>
                    <div className="flex-1">
                      <span className={cn('text-[15px] font-extrabold', r.hit_count >= 4 ? 'text-secondary' : 'text-foreground')}>{r.prize_label}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {betResults && betResults.length === 0 && (
        <Card className="mt-4 mb-5">
          <CardContent className="p-5 text-center">
            <p className="text-[13px] text-muted-foreground">Nenhum jogo marcado como apostado para {currentGameName}.</p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      {games.length > 0 && (
        <div className="flex gap-2 mb-4 mt-4">
          {(['all', 'favorites', 'bets'] as const).map(f => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
              className={cn(filter === f ? '' : 'text-muted-foreground')}
            >
              {f === 'all' ? `Todos (${games.length})` : f === 'favorites' ? `Favoritos` : `Apostados`}
            </Button>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && games.length === 0 && (
        <Card className="py-16 text-center">
          <CardContent className="flex flex-col items-center p-0">
            <ClipboardList size={40} className="text-muted-foreground mb-4" />
            <h3 className="text-lg font-bold mb-2">Nenhum jogo salvo.</h3>
            <p className="text-sm text-muted-foreground mb-5">Crie um jogo personalizado ou use o Gerador.</p>
            <Button onClick={() => setShowCreator(true)} className="gap-2"><PlusCircle size={16} /> Criar meu jogo</Button>
          </CardContent>
        </Card>
      )}

      {/* Bet value summary */}
      {hasBets && Object.keys(priceMap).length > 0 && (
        <Card className="mb-3 border-secondary/15 bg-secondary/8">
          <CardContent className="px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <DollarSign size={15} className="text-secondary" />
              <span><strong>{betsCount}</strong> aposta{betsCount > 1 ? 's' : ''} marcada{betsCount > 1 ? 's' : ''}</span>
            </div>
            {totalBetValue && <span className="text-base font-extrabold text-secondary">Total: {fmtPrice(totalBetValue)}</span>}
          </CardContent>
        </Card>
      )}

      {/* Games */}
      <div className="flex flex-col gap-2">
        {filtered.map((game) => {
          const isExp = expandedXray === game.id
          const analysis = xrayCache[game.id]
          const displayName = game.name && game.name.trim() ? game.name : null
          const manyNums = game.numbers.length > 10
          return (
            <Card key={game.id}>
              <CardContent className="px-5 py-3.5">
                <div className="flex items-center gap-3.5">
                  {!manyNums && (activeGame === 'supersete'
                    ? <SuperSeteColumnBalls numbers={game.numbers} size="md" />
                    : <div className="flex gap-1 shrink-0">{game.numbers.map(n => <NumberBall key={n} number={n} size="md" />)}</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {displayName && <span className="text-[13px] font-bold text-foreground">{displayName}</span>}
                      <span className={cn('text-xs', displayName ? 'font-medium text-muted-foreground' : 'font-bold text-primary')}>{game.strategy_label}</span>
                      {game.is_bet && <Badge variant="secondary" className="text-[9px] py-0 uppercase">Apostado</Badge>}
                      {game.is_bet && getGamePrice(game) && <span className="text-[11px] font-bold text-secondary">{fmtPrice(getGamePrice(game))}</span>}
                      {game.notes?.startsWith('Mes da Sorte:') && <Badge className="bg-amber-400/12 text-amber-400 text-[10px]">{game.notes.replace('Mes da Sorte: ', '')}</Badge>}
                      {game.notes?.startsWith('Time do Coracao:') && <Badge className="bg-emerald-400/12 text-emerald-400 text-[10px]">{game.notes.replace('Time do Coracao: ', '')}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{new Date(game.created_at).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-0 shrink-0">
                    <Btn icon={<Star size={14} fill={game.is_favorite ? 'currentColor' : 'none'} />} tip="Fav" color={game.is_favorite ? 'var(--secondary)' : undefined} onClick={() => api.toggleFavoriteGame(game.id).then(() => load())} />
                    <Btn icon={<Ticket size={14} />} tip={game.is_bet ? 'Desapostar' : 'Apostar'} color={game.is_bet ? 'var(--primary)' : undefined} onClick={() => api.toggleBetGame(game.id).then(() => load())} />
                    <Btn icon={<BarChart3 size={14} />} tip="X-Ray" color={isExp ? '#5b9bd5' : undefined} loading={analyzingId === game.id} onClick={() => handleXray(game)} />
                    <Btn icon={<Copy size={14} />} tip="Copiar" onClick={async () => { const t = await api.formatGameForClipboard(game.numbers); await writeText(t); showToast('Copiado!', 'success') }} />
                    <Btn icon={<Trash2 size={14} />} tip="Excluir" danger onClick={() => api.deleteSavedGame(game.id).then(() => { showToast('Excluido.', 'info'); if (expandedXray === game.id) setExpandedXray(null); load() })} />
                  </div>
                </div>
                {manyNums && (activeGame === 'supersete'
                  ? <div className="mt-2.5"><SuperSeteColumnBalls numbers={game.numbers} size="sm" /></div>
                  : <div className="flex gap-1 flex-wrap mt-2.5">{game.numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}</div>
                )}
              </CardContent>
              {isExp && analysis && (
                <div className="px-5 pb-5">
                  <GameXray analysis={analysis} compact gameType={activeGame} />
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {showCreator && <GameCreator onClose={() => setShowCreator(false)} onSaved={() => { load(); setShowCreator(false) }} />}
    </div>
  )
}

function Btn({ icon, tip, onClick, color, danger, loading: ld }: { icon: React.ReactNode; tip: string; onClick: () => void; color?: string; danger?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-lg border-none cursor-pointer transition-all duration-150 hover:bg-accent',
        danger ? 'text-destructive hover:bg-destructive/10' : !color && 'text-muted-foreground',
      )}
      style={color ? { color } : undefined}
    >
      {ld ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
    </button>
  )
}
