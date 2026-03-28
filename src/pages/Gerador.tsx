import { useState, useEffect } from 'react'
import { api, type GeneratedGame } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useLotteryStore } from '../stores/lotteryStore'
import LotteryTabs from '../components/LotteryTabs'
import NumberBall from '../components/NumberBall'
import GameXray from '../components/GameXray'
import { Dices, Save, RefreshCw, Briefcase, Loader2, ChevronDown, ChevronUp, Minus, Plus, DollarSign, Shuffle, TrendingUp, Clock, Hourglass, Scale, Sparkles, Heart, Copy } from 'lucide-react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

function SuperSeteColumnBalls({ numbers, size = 'md', animated = false }: { numbers: number[]; size?: 'sm' | 'md' | 'lg'; animated?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: size === 'sm' ? 4 : size === 'md' ? 6 : 12, flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center' }}>
      {numbers.map((n, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <span style={{ fontSize: size === 'sm' ? 8 : size === 'md' ? 9 : 10, fontWeight: 700, color: 'var(--ml-primary)', opacity: 0.7 }}>C{i + 1}</span>
          <NumberBall number={n} size={size} animated={animated} delay={animated ? i * 100 : 0} />
        </div>
      ))}
    </div>
  )
}

const strategies = [
  { id: 'aleatorio_puro', label: 'Aleatório puro', desc: 'Geração randômica uniforme', icon: Shuffle },
  { id: 'frequencia_historica', label: 'Frequência histórica', desc: 'Dezenas mais frequentes no histórico', icon: TrendingUp },
  { id: 'frequencia_recente', label: 'Frequência recente', desc: 'Pesa mais concursos recentes', icon: Clock },
  { id: 'atrasadas', label: 'Dezenas atrasadas', desc: 'Dezenas há mais tempo sem sair', icon: Hourglass },
  { id: 'balanceado', label: 'Balanceado', desc: 'Distribuição estrutural equilibrada', icon: Scale },
  { id: 'hibrido', label: 'Híbrido', desc: 'Combina frequência, recência e atraso', icon: Sparkles },
  { id: 'afinidade_historica', label: 'Afinidade histórica', desc: 'Pares que saíram juntas', icon: Heart },
]

export default function Gerador() {
  const { showToast } = useAppStore()
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const currentConfig = enabledGames.find(g => g.game_type === activeGame)
  const [sel, setSel] = useState('hibrido')
  const [game, setGame] = useState<GeneratedGame | null>(null)
  const [portfolio, setPortfolio] = useState<GeneratedGame[]>([])
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [showXray, setShowXray] = useState(false)
  const [history, setHistory] = useState<GeneratedGame[]>([])
  const [showHist, setShowHist] = useState(false)
  const [betPrice, setBetPrice] = useState<number | null>(null)
  const [priceMap, setPriceMap] = useState<Record<number, number>>({})

  // Load default bet price when game type changes
  useEffect(() => {
    if (currentConfig) {
      api.getBetPrice(activeGame, currentConfig.default_pick_count)
        .then(p => setBetPrice(p))
        .catch(() => setBetPrice(null))
    }
  }, [activeGame, currentConfig])

  // Build price map for all distinct pick counts in generated games
  useEffect(() => {
    const allGames = [...portfolio, ...(game ? [game] : [])]
    if (allGames.length === 0) return
    const counts = [...new Set(allGames.map(g => g.numbers.length))]
    const newMap: Record<number, number> = {}
    Promise.all(counts.map(c =>
      api.getBetPrice(activeGame, c).then(p => { if (p) newMap[c] = p }).catch(() => {})
    )).then(() => setPriceMap(newMap))
  }, [game, portfolio, activeGame])

  const fmtPrice = (v: number | null | undefined) => v && typeof v === 'number' ? `R$ ${v.toFixed(2).replace('.', ',')}` : null
  const getGeneratedGamePrice = (g: GeneratedGame) => priceMap[g.numbers.length] ?? betPrice

  const gen = async () => {
    setLoading(true)
    try { const g = await api.generateGame(sel, activeGame); setGame(g); setPortfolio([]); setShowXray(false); setHistory(p => [g, ...p].slice(0, 20)) }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  const genPortfolio = async () => {
    setLoading(true)
    try { const gs = await api.generatePortfolio(count, activeGame); setPortfolio(gs); setGame(null); setShowXray(false) }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setLoading(false) }
  }

  const save = async (g: GeneratedGame) => {
    const noteParts: string[] = []
    if (g.mes_sorte) noteParts.push(`Mês da Sorte: ${g.mes_sorte}`)
    if (g.time_coracao) noteParts.push(`Time do Coração: ${g.time_coracao}`)
    if (g.trevos && g.trevos.length > 0) noteParts.push(`Trevos: ${g.trevos.map(t => String(t).padStart(2, '0')).join(', ')}`)
    const specialNotes = noteParts.length > 0 ? noteParts.join(' | ') : undefined
    try { await api.saveGame({ numbers: g.numbers, strategy_id: g.strategy_id, strategy_label: g.strategy_label, game_type: activeGame, notes: specialNotes }); showToast('Jogo salvo!', 'success') }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  const saveAll = async () => {
    try {
      for (const g of portfolio) {
        const noteParts: string[] = []
        if (g.mes_sorte) noteParts.push(`Mês da Sorte: ${g.mes_sorte}`)
        if (g.time_coracao) noteParts.push(`Time do Coração: ${g.time_coracao}`)
        if (g.trevos && g.trevos.length > 0) noteParts.push(`Trevos: ${g.trevos.map(t => String(t).padStart(2, '0')).join(', ')}`)
        const specialNotes = noteParts.length > 0 ? noteParts.join(' | ') : undefined
        await api.saveGame({ numbers: g.numbers, strategy_id: g.strategy_id, strategy_label: g.strategy_label, game_type: activeGame, notes: specialNotes })
      }
      showToast(`${portfolio.length} jogos salvos!`, 'success')
    } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  const priceStr = game ? fmtPrice(getGeneratedGamePrice(game)) : fmtPrice(betPrice)
  const totalPortfolio = portfolio.length > 0
    ? fmtPrice(portfolio.reduce((sum, g) => sum + (getGeneratedGamePrice(g) ?? 0), 0) || null)
    : null

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '32px 40px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 4 }}>Gerador de Jogos</h2>
      <p style={{ fontSize: 14, color: 'var(--ml-on-surface-variant)', marginBottom: 16 }}>Gere jogos com base em estratégias estatísticas</p>

      {/* Lottery tabs */}
      {enabledGames.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />
        </div>
      )}

      {/* Active lottery info + price */}
      {currentConfig && (
        <div style={{ background: 'var(--ml-surface-low)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: currentConfig.color }} />
          <span style={{ fontWeight: 600, color: 'var(--ml-on-surface)' }}>{currentConfig.display_name}</span>
          <span style={{ color: 'var(--ml-on-surface-variant)' }}>·</span>
          <span style={{ color: 'var(--ml-on-surface-variant)' }}>{currentConfig.default_pick_count} números de {currentConfig.numbers_pool_size === 100 ? '00-99' : `01-${String(currentConfig.numbers_pool_size).padStart(2, '0')}`}</span>
          {currentConfig.has_trevos && <span style={{ color: 'var(--ml-on-surface-variant)' }}>+ trevos</span>}
          {currentConfig.has_time_coracao && <span style={{ color: 'var(--ml-on-surface-variant)' }}>+ time do coração</span>}
          {currentConfig.has_mes_sorte && <span style={{ color: 'var(--ml-on-surface-variant)' }}>+ mês da sorte</span>}
          {priceStr && (
            <>
              <span style={{ color: 'var(--ml-on-surface-variant)' }}>·</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700, color: currentConfig.color }}>
                <DollarSign size={11} /> {priceStr}
              </span>
            </>
          )}
        </div>
      )}

      {/* Strategy grid */}
      <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Escolha a estratégia</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {strategies.map(s => {
          const isActive = sel === s.id
          return (
            <button key={s.id} onClick={() => setSel(s.id)} style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', minHeight: 60, transition: 'all 0.15s ease',
              display: 'flex', alignItems: 'center', gap: 12,
              background: isActive ? 'color-mix(in srgb, var(--ml-primary) 12%, transparent)' : 'var(--ml-surface-low)',
              boxShadow: isActive ? 'inset 0 0 0 2px color-mix(in srgb, var(--ml-primary) 30%, transparent)' : 'none',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: isActive ? 'color-mix(in srgb, var(--ml-primary) 18%, transparent)' : 'var(--ml-surface-high)',
              }}>
                <s.icon size={17} style={{ color: isActive ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)' }} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: isActive ? 'var(--ml-primary)' : 'var(--ml-on-surface)' }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{s.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 28 }}>
        <button className="btn-primary" onClick={gen} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />} Gerar 1 jogo
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--ml-surface-high)', borderRadius: 12, padding: '6px 14px', minHeight: 44 }}>
          <button onClick={() => setCount(c => Math.max(2, c - 1))} style={{
            width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ml-outline-variant)', background: 'var(--ml-surface-low)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ml-on-surface)', flexShrink: 0,
          }}><Minus size={14} /></button>
          <span style={{ width: 28, textAlign: 'center', fontSize: 14, fontWeight: 700, color: 'var(--ml-on-surface)', fontFamily: 'inherit', userSelect: 'none' }}>{count}</span>
          <button onClick={() => setCount(c => Math.min(20, c + 1))} style={{
            width: 28, height: 28, borderRadius: '50%', border: '1px solid var(--ml-outline-variant)', background: 'var(--ml-surface-low)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--ml-on-surface)', flexShrink: 0,
          }}><Plus size={14} /></button>
          <button onClick={genPortfolio} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ml-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Briefcase size={15} /> Gerar carteira
          </button>
        </div>
      </div>

      {/* Single game result */}
      {game && (
        <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: 28, marginBottom: 24 }} className="animate-scale-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-primary)' }}>{game.strategy_label}</span>
              {priceStr && (
                <span style={{ fontSize: 12, fontWeight: 700, color: currentConfig?.color || 'var(--ml-secondary)', background: 'color-mix(in srgb, var(--ml-secondary) 10%, transparent)', padding: '3px 10px', borderRadius: 8 }}>
                  {priceStr}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setShowXray(!showXray)}>{showXray ? 'Ocultar Raio-X' : 'Ver Raio-X'}</button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={async () => { try { const t = await api.formatGameForClipboard(game.numbers); await writeText(t); showToast('Copiado!', 'success') } catch {} }}><Copy size={13} /> Copiar</button>
              <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={() => save(game)}><Save size={13} /> Salvar</button>
              <button className="btn-ghost" style={{ fontSize: 12 }} onClick={gen}><RefreshCw size={13} /> Novo</button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: game.numbers.length > 15 ? 4 : game.numbers.length > 8 ? 6 : 12, justifyContent: 'center', flexWrap: 'wrap', padding: '16px 0', alignItems: 'center' }}>
            {activeGame === 'supersete'
              ? <SuperSeteColumnBalls numbers={game.numbers} size={game.numbers.length > 15 ? 'sm' : game.numbers.length > 8 ? 'md' : 'lg'} animated />
              : game.numbers.map((n, i) => <NumberBall key={n} number={n} size={game.numbers.length > 15 ? 'sm' : game.numbers.length > 8 ? 'md' : 'lg'} animated delay={i * (game.numbers.length > 20 ? 30 : 100)} />)}
            {game.trevos && game.trevos.length > 0 && (
              <>
                <span style={{ width: 2, height: 32, background: 'var(--ml-outline-variant)', borderRadius: 2, margin: '0 8px' }} />
                {game.trevos.map((t, i) => (
                  <span key={`trevo-${t}`} className="animate-ball-pop" style={{
                    width: 48, height: 48, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(145deg, #f59e0b, #d97706)', color: '#fff', fontSize: 17, fontWeight: 800,
                    fontFamily: "'Manrope', monospace", letterSpacing: '-0.3px',
                    boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.3), 0 3px 8px rgba(0,0,0,0.25)',
                    animationDelay: `${(game.numbers.length + i) * 100}ms`, animationFillMode: 'both',
                  }}>{String(t).padStart(2, '0')}</span>
                ))}
              </>
            )}
          </div>
          {game.trevos && game.trevos.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#f59e0b', background: 'color-mix(in srgb, #f59e0b 12%, transparent)', padding: '6px 16px', borderRadius: 10 }}>
                🍀 Trevos: {game.trevos.map(t => String(t).padStart(2, '0')).join(', ')}
              </span>
            </div>
          )}
          {game.mes_sorte && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#FBBF24', background: 'color-mix(in srgb, #FBBF24 12%, transparent)', padding: '6px 16px', borderRadius: 10 }}>
                📅 Mês da Sorte: {game.mes_sorte}
              </span>
            </div>
          )}
          {game.time_coracao && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4, marginBottom: 4 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#34D399', background: 'color-mix(in srgb, #34D399 12%, transparent)', padding: '6px 16px', borderRadius: 10 }}>
                💚 Time do Coração: {game.time_coracao}
              </span>
            </div>
          )}
          {showXray && <GameXray analysis={game.analysis} gameType={activeGame} />}
        </div>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>Carteira inteligente <span style={{ fontWeight: 400, fontSize: 14, color: 'var(--ml-on-surface-variant)' }}>({portfolio.length} jogos)</span></h3>
              {totalPortfolio && (
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-secondary)', background: 'color-mix(in srgb, var(--ml-secondary) 12%, transparent)', padding: '4px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <DollarSign size={13} /> Total: {totalPortfolio}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={async () => {
                try {
                  const t = await api.formatAllGamesForClipboard(portfolio.map(g => g.numbers))
                  await writeText(t)
                  showToast('Jogos copiados!', 'success')
                } catch {}
              }}><Copy size={13} /> Copiar todos</button>
              <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={saveAll}><Save size={13} /> Salvar todos</button>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {portfolio.map((g, i) => {
              const manyNums = g.numbers.length > 10
              return (
                <div key={i} style={{ background: 'var(--ml-surface-low)', borderRadius: 12, padding: '14px 20px' }} className="animate-slide-up">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: manyNums ? 8 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--ml-on-surface-variant)', width: 28, flexShrink: 0 }}>#{i+1}</span>
                      {!manyNums && (activeGame === 'supersete'
                        ? <SuperSeteColumnBalls numbers={g.numbers} size="md" />
                        : <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{g.numbers.map(n => <NumberBall key={n} number={n} size="md" />)}</div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      {fmtPrice(getGeneratedGamePrice(g)) && <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ml-on-surface-variant)' }}>{fmtPrice(getGeneratedGamePrice(g))}</span>}
                      <button className="btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => save(g)}><Save size={13} /> Salvar</button>
                    </div>
                  </div>
                  {manyNums && (activeGame === 'supersete'
                    ? <div style={{ paddingLeft: 40 }}><SuperSeteColumnBalls numbers={g.numbers} size="sm" /></div>
                    : <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', paddingLeft: 40 }}>{g.numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}</div>
                  )}
                  {g.trevos && g.trevos.length > 0 && (
                    <div style={{ paddingLeft: 40, marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {g.trevos.map((t) => (
                        <span key={`trevo-${t}`} style={{
                          width: 32, height: 32, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: 'linear-gradient(145deg, #f59e0b, #d97706)', color: '#fff', fontSize: 11, fontWeight: 800,
                          fontFamily: "'Manrope', monospace",
                          boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.2)',
                        }}>{String(t).padStart(2, '0')}</span>
                      ))}
                      <span style={{ fontSize: 10, fontWeight: 600, color: '#f59e0b' }}>🍀 Trevos</span>
                    </div>
                  )}
                  {g.mes_sorte && (
                    <div style={{ paddingLeft: 40, marginTop: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#FBBF24', background: 'color-mix(in srgb, #FBBF24 12%, transparent)', padding: '3px 10px', borderRadius: 8 }}>
                        📅 {g.mes_sorte}
                      </span>
                    </div>
                  )}
                  {g.time_coracao && (
                    <div style={{ paddingLeft: 40, marginTop: 6 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#34D399', background: 'color-mix(in srgb, #34D399 12%, transparent)', padding: '3px 10px', borderRadius: 8 }}>
                        💚 {g.time_coracao}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* History toggle */}
      {history.length > 1 && (
        <div style={{ marginBottom: 20 }}>
          <button onClick={() => setShowHist(!showHist)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'var(--ml-on-surface-variant)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {showHist ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Histórico ({history.length - 1})
          </button>
          {showHist && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {history.slice(1).map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, background: 'var(--ml-surface-low)', borderRadius: 8, padding: '8px 14px', color: 'var(--ml-on-surface-variant)' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--ml-primary)' }}>{g.strategy_label}</span>
                  <span style={{ fontFamily: 'monospace' }}>{g.numbers.map(n => String(n).padStart(2,'0')).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--ml-on-surface-variant)', opacity: 0.5, fontWeight: 500, paddingTop: 8 }}>
        As análises são baseadas em histórico e estatística. Não garantem resultados futuros.
      </p>
    </div>
  )
}
