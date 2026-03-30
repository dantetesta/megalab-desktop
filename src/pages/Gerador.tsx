import { useState, useEffect } from 'react'
import { api, type GeneratedGame } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import GameXray from '@/components/GameXray'
import BannerCarousel from '@/components/BannerCarousel'
import { cn } from '@/lib/utils'
import { Dices, Save, RefreshCw, Briefcase, Loader2, ChevronDown, ChevronUp, Minus, Plus, DollarSign, Shuffle, TrendingUp, Clock, Hourglass, Scale, Sparkles, Heart, Copy } from 'lucide-react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function SuperSeteColumnBalls({ numbers, size = 'md', animated = false }: { numbers: number[]; size?: 'sm' | 'md' | 'lg'; animated?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-center', size === 'sm' ? 'gap-1' : size === 'md' ? 'gap-1.5' : 'gap-3')}>
      {numbers.map((n, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <span className={cn('font-bold text-primary/70', size === 'sm' ? 'text-[8px]' : size === 'md' ? 'text-[9px]' : 'text-[10px]')}>C{i + 1}</span>
          <NumberBall number={n} size={size} animated={animated} delay={animated ? i * 100 : 0} />
        </div>
      ))}
    </div>
  )
}

const strategies = [
  { id: 'aleatorio_puro', label: 'Aleatorio puro', desc: 'Geracao randomica uniforme', icon: Shuffle },
  { id: 'frequencia_historica', label: 'Frequencia historica', desc: 'Dezenas mais frequentes no historico', icon: TrendingUp },
  { id: 'frequencia_recente', label: 'Frequencia recente', desc: 'Pesa mais concursos recentes', icon: Clock },
  { id: 'atrasadas', label: 'Dezenas atrasadas', desc: 'Dezenas ha mais tempo sem sair', icon: Hourglass },
  { id: 'balanceado', label: 'Balanceado', desc: 'Distribuicao estrutural equilibrada', icon: Scale },
  { id: 'hibrido', label: 'Hibrido', desc: 'Combina frequencia, recencia e atraso', icon: Sparkles },
  { id: 'afinidade_historica', label: 'Afinidade historica', desc: 'Pares que sairam juntas', icon: Heart },
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

  useEffect(() => {
    if (currentConfig) {
      api.getBetPrice(activeGame, currentConfig.default_pick_count).then(p => setBetPrice(p)).catch(() => setBetPrice(null))
    }
  }, [activeGame, currentConfig])

  useEffect(() => {
    const allGames = [...portfolio, ...(game ? [game] : [])]
    if (allGames.length === 0) return
    const counts = [...new Set(allGames.map(g => g.numbers.length))]
    const newMap: Record<number, number> = {}
    Promise.all(counts.map(c => api.getBetPrice(activeGame, c).then(p => { if (p) newMap[c] = p }).catch(() => {}))).then(() => setPriceMap(newMap))
  }, [game, portfolio, activeGame])

  const fmtPrice = (v: number | null | undefined) => v && typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : null
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
    if (g.mes_sorte) noteParts.push(`Mes da Sorte: ${g.mes_sorte}`)
    if (g.time_coracao) noteParts.push(`Time do Coracao: ${g.time_coracao}`)
    if (g.trevos && g.trevos.length > 0) noteParts.push(`Trevos: ${g.trevos.map(t => String(t).padStart(2, '0')).join(', ')}`)
    const specialNotes = noteParts.length > 0 ? noteParts.join(' | ') : undefined
    try { await api.saveGame({ numbers: g.numbers, strategy_id: g.strategy_id, strategy_label: g.strategy_label, game_type: activeGame, notes: specialNotes }); showToast('Jogo salvo!', 'success') }
    catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
  }

  const saveAll = async () => {
    try {
      for (const g of portfolio) {
        const noteParts: string[] = []
        if (g.mes_sorte) noteParts.push(`Mes da Sorte: ${g.mes_sorte}`)
        if (g.time_coracao) noteParts.push(`Time do Coracao: ${g.time_coracao}`)
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
    <div>
      <h2 className="text-2xl font-bold tracking-tight mb-1">Gerador de Jogos</h2>
      <p className="text-sm text-muted-foreground mb-4">Gere jogos com base em estrategias estatisticas</p>

      {enabledGames.length > 0 && <div className="mb-5"><LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} /></div>}

      {/* Active lottery info */}
      {currentConfig && (
        <Card className="mb-5">
          <CardContent className="px-4 py-2.5 flex items-center gap-2.5 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ background: currentConfig.color }} />
            <span className="font-semibold text-foreground">{currentConfig.display_name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{currentConfig.default_pick_count} numeros de {currentConfig.numbers_pool_size === 100 ? '00-99' : `01-${String(currentConfig.numbers_pool_size).padStart(2, '0')}`}</span>
            {currentConfig.has_trevos && <span className="text-muted-foreground">+ trevos</span>}
            {currentConfig.has_time_coracao && <span className="text-muted-foreground">+ time do coracao</span>}
            {currentConfig.has_mes_sorte && <span className="text-muted-foreground">+ mes da sorte</span>}
            {priceStr && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1 font-bold lottery-text-on-tint" style={{ color: currentConfig.color }}>
                  <DollarSign size={11} /> {priceStr}
                </span>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Strategy grid */}
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Escolha a estrategia</p>
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {strategies.map(s => {
          const isActive = sel === s.id
          return (
            <button
              key={s.id}
              onClick={() => setSel(s.id)}
              className={cn(
                'text-left px-4 py-3.5 rounded-xl border-none cursor-pointer min-h-[60px] transition-all duration-150',
                'flex items-center gap-3',
                isActive
                  ? 'bg-primary/12 ring-2 ring-primary/30'
                  : 'bg-card hover:bg-accent',
              )}
            >
              <div className={cn(
                'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
                isActive ? 'bg-primary/18' : 'bg-muted',
              )}>
                <s.icon size={17} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
              </div>
              <div>
                <div className={cn('text-[13px] font-semibold', isActive ? 'text-primary' : 'text-foreground')}>{s.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{s.desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-3 items-center flex-wrap mb-7">
        <Button onClick={gen} disabled={loading} className="gap-2">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Dices size={16} />} Gerar 1 jogo
        </Button>
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3.5 py-1.5 min-h-[44px]">
          <button onClick={() => setCount(c => Math.max(2, c - 1))} className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center cursor-pointer text-foreground shrink-0"><Minus size={14} /></button>
          <span className="w-7 text-center text-sm font-bold text-foreground select-none">{count}</span>
          <button onClick={() => setCount(c => Math.min(20, c + 1))} className="w-7 h-7 rounded-full border border-border bg-card flex items-center justify-center cursor-pointer text-foreground shrink-0"><Plus size={14} /></button>
        </div>
        <Button variant="secondary" onClick={genPortfolio} disabled={loading} className="gap-1.5">
          <Briefcase size={15} /> Gerar {count} jogos
        </Button>
      </div>

      {/* Single game result */}
      {game && (
        <Card className="mb-6 animate-scale-in">
          <CardContent className="p-7">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-primary">{game.strategy_label}</span>
                {priceStr && <Badge variant="secondary" className="font-bold">{priceStr}</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowXray(!showXray)}>{showXray ? 'Ocultar Raio-X' : 'Ver Raio-X'}</Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={async () => { try { const t = await api.formatGameForClipboard(game.numbers); await writeText(t); showToast('Copiado!', 'success') } catch {} }}><Copy size={13} /> Copiar</Button>
                <Button size="sm" className="gap-1" onClick={() => save(game)}><Save size={13} /> Salvar</Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={gen}><RefreshCw size={13} /> Novo</Button>
              </div>
            </div>
            <div className={cn('flex justify-center flex-wrap py-4 items-center', game.numbers.length > 15 ? 'gap-1' : game.numbers.length > 8 ? 'gap-1.5' : 'gap-3')}>
              {activeGame === 'supersete'
                ? <SuperSeteColumnBalls numbers={game.numbers} size={game.numbers.length > 15 ? 'sm' : game.numbers.length > 8 ? 'md' : 'lg'} animated />
                : game.numbers.map((n, i) => <NumberBall key={n} number={n} size={game.numbers.length > 15 ? 'sm' : game.numbers.length > 8 ? 'md' : 'lg'} animated delay={i * (game.numbers.length > 20 ? 30 : 100)} />)}
              {game.trevos && game.trevos.length > 0 && (
                <>
                  <span className="w-0.5 h-8 bg-border rounded mx-2" />
                  {game.trevos.map((t, i) => (
                    <span key={`trevo-${t}`} className="animate-ball-pop w-12 h-12 rounded-full inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[17px] font-extrabold font-[Manrope,monospace] tracking-tight shadow-[inset_0_3px_6px_rgba(255,255,255,0.3),0_3px_8px_rgba(0,0,0,0.25)]" style={{ animationDelay: `${(game.numbers.length + i) * 100}ms`, animationFillMode: 'both' }}>{String(t).padStart(2, '0')}</span>
                  ))}
                </>
              )}
            </div>
            {game.trevos && game.trevos.length > 0 && (
              <div className="flex justify-center mt-1 mb-1">
                <Badge className="bg-amber-500/12 text-amber-500 gap-1.5">Trevos: {game.trevos.map(t => String(t).padStart(2, '0')).join(', ')}</Badge>
              </div>
            )}
            {game.mes_sorte && (
              <div className="flex justify-center mt-1 mb-1">
                <Badge className="bg-amber-400/12 text-amber-400 gap-1.5">Mes da Sorte: {game.mes_sorte}</Badge>
              </div>
            )}
            {game.time_coracao && (
              <div className="flex justify-center mt-1 mb-1">
                <Badge className="bg-emerald-400/12 text-emerald-400 gap-1.5">Time do Coracao: {game.time_coracao}</Badge>
              </div>
            )}
            {showXray && <GameXray analysis={game.analysis} gameType={activeGame} />}
          </CardContent>
        </Card>
      )}

      {/* Portfolio */}
      {portfolio.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold">Carteira inteligente <span className="font-normal text-sm text-muted-foreground">({portfolio.length} jogos)</span></h3>
              {totalPortfolio && <Badge variant="secondary" className="gap-1"><DollarSign size={13} /> Total: {totalPortfolio}</Badge>}
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="gap-1" onClick={async () => { try { const t = await api.formatAllGamesForClipboard(portfolio.map(g => g.numbers)); await writeText(t); showToast('Jogos copiados!', 'success') } catch {} }}><Copy size={13} /> Copiar todos</Button>
              <Button size="sm" className="gap-1" onClick={saveAll}><Save size={13} /> Salvar todos</Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {portfolio.map((g, i) => {
              const manyNums = g.numbers.length > 10
              return (
                <Card key={i} className="animate-slide-up">
                  <CardContent className="px-5 py-3.5">
                    <div className={cn('flex items-center justify-between', manyNums && 'mb-2')}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-mono font-bold text-[13px] text-muted-foreground w-7 shrink-0">#{i+1}</span>
                        {!manyNums && (activeGame === 'supersete'
                          ? <SuperSeteColumnBalls numbers={g.numbers} size="md" />
                          : <div className="flex gap-1 flex-wrap">{g.numbers.map(n => <NumberBall key={n} number={n} size="md" />)}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        {fmtPrice(getGeneratedGamePrice(g)) && <span className="text-[11px] font-semibold text-muted-foreground">{fmtPrice(getGeneratedGamePrice(g))}</span>}
                        <Button size="sm" className="gap-1" onClick={() => save(g)}><Save size={13} /> Salvar</Button>
                      </div>
                    </div>
                    {manyNums && (activeGame === 'supersete'
                      ? <div className="pl-10"><SuperSeteColumnBalls numbers={g.numbers} size="sm" /></div>
                      : <div className="flex gap-1 flex-wrap pl-10">{g.numbers.map(n => <NumberBall key={n} number={n} size="sm" />)}</div>
                    )}
                    {g.trevos && g.trevos.length > 0 && (
                      <div className="pl-10 mt-1.5 flex items-center gap-1.5">
                        {g.trevos.map((t) => (
                          <span key={`trevo-${t}`} className="w-8 h-8 rounded-full inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[11px] font-extrabold font-[Manrope,monospace] shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.2)]">{String(t).padStart(2, '0')}</span>
                        ))}
                        <span className="text-[10px] font-semibold text-amber-500">Trevos</span>
                      </div>
                    )}
                    {g.mes_sorte && <div className="pl-10 mt-1.5"><Badge className="bg-amber-400/12 text-amber-400 text-[11px]">{g.mes_sorte}</Badge></div>}
                    {g.time_coracao && <div className="pl-10 mt-1.5"><Badge className="bg-emerald-400/12 text-emerald-400 text-[11px]">{g.time_coracao}</Badge></div>}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* History toggle */}
      {history.length > 1 && (
        <div className="mb-5">
          <button onClick={() => setShowHist(!showHist)} className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground bg-transparent border-none cursor-pointer">
            {showHist ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Historico ({history.length - 1})
          </button>
          {showHist && (
            <div className="mt-2 flex flex-col gap-1">
              {history.slice(1).map((g, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[13px] bg-card rounded-lg px-3.5 py-2 text-muted-foreground">
                  <span className="text-[11px] font-semibold text-primary">{g.strategy_label}</span>
                  <span className="font-mono">{g.numbers.map(n => String(n).padStart(2,'0')).join(', ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-center text-muted-foreground/50 font-medium pt-2">
        As analises sao baseadas em historico e estatistica. Nao garantem resultados futuros.
      </p>

      <BannerCarousel position="internal" className="mt-6" />
    </div>
  )
}
