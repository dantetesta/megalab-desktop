import { useState, useCallback, useMemo } from 'react'
import { api, type LotoCoreConfig, type LotoCoreResult, type LotoCoreGame, type AlgorithmWeights, type EnabledAlgorithms, type AlgorithmScores } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Loader2,
  Cpu,
  Zap,
  BarChart3,
  Timer,
  Dna,
  Sparkles,
  Shield,
  TrendingUp,
  Clock,
  Shuffle,
  Flame,
  Target,
  ChevronRight,
  Save,
  Copy,
  Info,
  Activity,
} from 'lucide-react'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'

// ═══ Algorithm metadata with friendly labels ═══

interface AlgorithmMeta {
  key: keyof EnabledAlgorithms
  label: string
  description: string
  icon: React.ElementType
  weightKey?: keyof AlgorithmWeights
  slow?: boolean
}

const ALGORITHMS: AlgorithmMeta[] = [
  { key: 'monte_carlo', label: 'Simulacao Massiva', description: 'Milhares de simulacoes para encontrar padroes ocultos', icon: Shuffle },
  { key: 'frequency', label: 'Frequencia', description: 'Analisa as dezenas mais sorteadas no historico', icon: TrendingUp, weightKey: 'frequency' },
  { key: 'delay', label: 'Atraso', description: 'Identifica dezenas que estao "devendo" aparecer', icon: Clock },
  { key: 'entropy', label: 'Distribuicao Inteligente', description: 'Garante diversidade e cobertura no jogo', icon: BarChart3, weightKey: 'entropy' },
  { key: 'pattern_avoidance', label: 'Evitar Padroes Humanos', description: 'Remove combinacoes tipicas de apostadores', icon: Shield, weightKey: 'patterns' },
  { key: 'bayesian', label: 'Tendencia Recente', description: 'Pesa mais os resultados dos ultimos sorteios', icon: Target },
  { key: 'markov', label: 'Analise de Sequencia', description: 'Preve numeros com base em transicoes historicas', icon: Activity },
  { key: 'genetic', label: 'Evolucao de Jogos', description: 'Evolui jogos como organismos para encontrar os melhores', icon: Dna, weightKey: 'genetic', slow: true },
  { key: 'annealing', label: 'Otimizacao Final', description: 'Refinamento avancado para maximizar a qualidade', icon: Flame, slow: true },
]

// Score breakdown labels
const SCORE_LABELS: Record<keyof AlgorithmScores, { label: string; color: string }> = {
  entropy: { label: 'Distribuicao', color: '#60A5FA' },
  frequency: { label: 'Frequencia', color: '#4ADE80' },
  delay: { label: 'Atraso', color: '#FBBF24' },
  bayesian: { label: 'Tendencia', color: '#F472B6' },
  markov: { label: 'Sequencia', color: '#A78BFA' },
  pattern: { label: 'Anti-Padrao', color: '#34D399' },
  balance: { label: 'Equilibrio', color: '#FB923C' },
}

// ═══ Default configuration ═══

const DEFAULT_WEIGHTS: AlgorithmWeights = {
  frequency: 0.5,
  entropy: 0.5,
  patterns: 0.5,
  genetic: 0.5,
}

const DEFAULT_ENABLED: EnabledAlgorithms = {
  monte_carlo: true,
  frequency: true,
  delay: true,
  entropy: true,
  pattern_avoidance: true,
  bayesian: true,
  markov: true,
  genetic: false,
  annealing: false,
}

// ═══ Main Component ═══

export default function LotoCore() {
  const { showToast } = useAppStore()
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const currentConfig = enabledGames.find(g => g.game_type === activeGame)

  // Config state
  const [numGames, setNumGames] = useState(6)
  const [simulationDepth, setSimulationDepth] = useState(500)
  const [mode, setMode] = useState('combined')
  const [weights, setWeights] = useState<AlgorithmWeights>({ ...DEFAULT_WEIGHTS })
  const [enabledAlgorithms, setEnabledAlgorithms] = useState<EnabledAlgorithms>({ ...DEFAULT_ENABLED })

  // Result state
  const [result, setResult] = useState<LotoCoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedGameIdx, setSelectedGameIdx] = useState<number>(0)

  // Derived
  const enabledCount = useMemo(() =>
    Object.values(enabledAlgorithms).filter(Boolean).length,
    [enabledAlgorithms]
  )

  const selectedGame: LotoCoreGame | null = useMemo(() =>
    result && result.games.length > 0 ? result.games[selectedGameIdx] ?? result.games[0] : null,
    [result, selectedGameIdx]
  )

  // ═══ Handlers ═══

  const toggleAlgorithm = useCallback((key: keyof EnabledAlgorithms) => {
    setEnabledAlgorithms(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const updateWeight = useCallback((key: keyof AlgorithmWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!currentConfig) {
      showToast('Selecione uma loteria primeiro', 'error')
      return
    }

    if (enabledCount === 0) {
      showToast('Ative pelo menos um algoritmo', 'error')
      return
    }

    setLoading(true)
    setResult(null)
    setSelectedGameIdx(0)

    try {
      const config: LotoCoreConfig = {
        game_type: activeGame,
        pick_count: currentConfig.default_pick_count,
        pool_size: currentConfig.numbers_pool_size,
        num_games: numGames,
        simulation_depth: simulationDepth,
        mode,
        weights,
        enabled_algorithms: enabledAlgorithms,
      }

      const res = await api.generateLotoCore(config)
      setResult(res)

      if (res.games.length === 0) {
        showToast('Nenhum jogo gerado. Tente ajustar os parametros.', 'info')
      }
    } catch (e: any) {
      console.error('LotoCore generation error:', e)
      showToast(e?.toString() || 'Erro ao gerar jogos', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeGame, currentConfig, numGames, simulationDepth, mode, weights, enabledAlgorithms, enabledCount, showToast])

  const handleSaveGame = useCallback(async (game: LotoCoreGame) => {
    try {
      await api.saveGame({
        numbers: game.numbers,
        strategy_id: 'lotocore_v4',
        strategy_label: `LotoCore (${mode})`,
        game_type: activeGame,
        notes: `Score: ${game.score.toFixed(3)} | Modo: ${mode}`,
      })
      showToast('Jogo salvo com sucesso!', 'success')
    } catch (e: any) {
      showToast(e?.toString() || 'Erro ao salvar', 'error')
    }
  }, [activeGame, mode, showToast])

  const handleSaveAll = useCallback(async () => {
    if (!result) return
    try {
      for (const game of result.games) {
        await api.saveGame({
          numbers: game.numbers,
          strategy_id: 'lotocore_v4',
          strategy_label: `LotoCore (${mode})`,
          game_type: activeGame,
          notes: `Score: ${game.score.toFixed(3)} | Modo: ${mode}`,
        })
      }
      showToast(`${result.games.length} jogos salvos!`, 'success')
    } catch (e: any) {
      showToast(e?.toString() || 'Erro ao salvar', 'error')
    }
  }, [result, activeGame, mode, showToast])

  const handleCopyGame = useCallback(async (game: LotoCoreGame) => {
    try {
      const text = await api.formatGameForClipboard(game.numbers)
      await writeText(text)
      showToast('Jogo copiado!', 'success')
    } catch {
      showToast('Erro ao copiar', 'error')
    }
  }, [showToast])

  const handleCopyAll = useCallback(async () => {
    if (!result) return
    try {
      const text = await api.formatAllGamesForClipboard(result.games.map(g => g.numbers))
      await writeText(text)
      showToast('Todos os jogos copiados!', 'success')
    } catch {
      showToast('Erro ao copiar', 'error')
    }
  }, [result, showToast])

  // ═══ Score helpers ═══

  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#4ADE80'
    if (score >= 0.6) return '#FBBF24'
    if (score >= 0.4) return '#FB923C'
    return '#F87171'
  }

  const getScoreLabel = (score: number): string => {
    if (score >= 0.8) return 'Excelente'
    if (score >= 0.6) return 'Bom'
    if (score >= 0.4) return 'Regular'
    return 'Fraco'
  }

  // ═══ Render ═══

  return (
    <TooltipProvider delayDuration={300}>
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Cpu size={18} style={{ color: 'var(--primary-foreground)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                LotoCore Engine
              </h2>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 1 }}>
                Motor avancado de geracao com algoritmos matematicos
              </p>
            </div>
            {result && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                <Button variant="ghost" size="sm" onClick={handleCopyAll}>
                  <Copy size={14} /> Copiar todos
                </Button>
                <Button variant="default" size="sm" onClick={handleSaveAll}>
                  <Save size={14} /> Salvar todos
                </Button>
              </div>
            )}
          </div>

          {/* Lottery Tabs */}
          {enabledGames.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={(gt) => { setActiveGame(gt); setResult(null) }} />
            </div>
          )}
        </div>

        {/* ── 3-Panel Layout ── */}
        <div style={{ flex: 1, display: 'flex', gap: 0, overflow: 'hidden', marginTop: 12, minHeight: 0 }}>

          {/* ═══ LEFT PANEL - Controls ═══ */}
          <ScrollArea className="h-full" style={{ width: 260, minWidth: 260, maxWidth: 260, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 16px 24px' }}>

              {/* Active game info */}
              {currentConfig && (
                <div className={cn('lottery-' + activeGame)} style={{
                  background: 'var(--accent)',
                  borderRadius: 10, padding: '8px 12px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11,
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: currentConfig.color, flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, color: 'var(--foreground)' }}>{currentConfig.display_name}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>
                    {currentConfig.default_pick_count}/{currentConfig.numbers_pool_size}
                  </span>
                </div>
              )}

              {/* Section: Algorithms */}
              <div style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--muted-foreground)',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Zap size={12} /> Algoritmos ({enabledCount}/9)
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {ALGORITHMS.map((algo) => {
                    const Icon = algo.icon
                    const isEnabled = enabledAlgorithms[algo.key]
                    return (
                      <div key={algo.key} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', borderRadius: 8,
                        background: isEnabled ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                        transition: 'background 0.15s ease',
                      }}>
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleAlgorithm(algo.key)}
                        />
                        <Icon size={13} style={{
                          color: isEnabled ? 'var(--primary)' : 'var(--muted-foreground)',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span className={isEnabled ? 'text-foreground' : 'text-muted-foreground'} style={{
                              fontSize: 11.5, fontWeight: 600,
                            }}>
                              {algo.label}
                            </span>
                            {algo.slow && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                lento
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
                              <Info size={12} style={{ color: 'var(--muted-foreground)', opacity: 0.6 }} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-[200px]">
                            <p className="text-xs">{algo.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    )
                  })}
                </div>
              </div>

              <Separator className="my-3" />

              {/* Section: Weights */}
              <div style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--muted-foreground)',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Sparkles size={12} /> Pesos dos Algoritmos
                </p>

                {([
                  { key: 'frequency' as const, label: 'Frequencia' },
                  { key: 'entropy' as const, label: 'Distribuicao' },
                  { key: 'patterns' as const, label: 'Anti-Padrao' },
                  { key: 'genetic' as const, label: 'Evolucao' },
                ] as const).map(({ key, label }) => (
                  <div key={key} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <Label className="text-[11px] text-muted-foreground">{label}</Label>
                      <span style={{
                        fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                        color: 'var(--primary)', minWidth: 32, textAlign: 'right',
                      }}>
                        {(weights[key] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[weights[key]]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => updateWeight(key, v)}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              {/* Section: Parameters */}
              <div style={{ marginBottom: 16 }}>
                <p style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.08em', color: 'var(--muted-foreground)',
                  marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Timer size={12} /> Parametros
                </p>

                {/* Num games */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Label className="text-[11px] text-muted-foreground">Quantidade de jogos</Label>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{numGames}</span>
                  </div>
                  <Slider
                    value={[numGames]}
                    min={1}
                    max={20}
                    step={1}
                    onValueChange={([v]) => setNumGames(v)}
                  />
                </div>

                {/* Simulation depth */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Label className="text-[11px] text-muted-foreground">Profundidade</Label>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>{simulationDepth}</span>
                  </div>
                  <Slider
                    value={[simulationDepth]}
                    min={100}
                    max={2000}
                    step={100}
                    onValueChange={([v]) => setSimulationDepth(v)}
                  />
                </div>

                {/* Mode */}
                <div style={{ marginBottom: 12 }}>
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block">Modo de geracao</Label>
                  <Select value={mode} onValueChange={setMode}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="combined">Combinado</SelectItem>
                      <SelectItem value="weighted">Ponderado</SelectItem>
                      <SelectItem value="single">Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                className="w-full h-11 text-sm font-bold gap-2"
                onClick={handleGenerate}
                disabled={loading || !currentConfig || enabledCount === 0}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Cpu size={16} />
                    Gerar Jogos
                  </>
                )}
              </Button>

              {enabledCount === 0 && (
                <p style={{ fontSize: 10, color: 'var(--destructive)', textAlign: 'center', marginTop: 6 }}>
                  Ative pelo menos um algoritmo
                </p>
              )}
            </div>
          </ScrollArea>

          {/* ═══ CENTER PANEL - Results ═══ */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* Generation stats bar */}
            {result && (
              <div className="animate-slide-down" style={{
                padding: '8px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
                background: 'color-mix(in srgb, var(--primary) 4%, transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Timer size={13} style={{ color: 'var(--primary)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Tempo:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
                    {result.generation_time_ms < 1000
                      ? `${result.generation_time_ms}ms`
                      : `${(result.generation_time_ms / 1000).toFixed(1)}s`
                    }
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Target size={13} style={{ color: 'var(--secondary)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Candidatos:</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--foreground)' }}>
                    {result.total_candidates_evaluated.toLocaleString('pt-BR')}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <Zap size={13} style={{ color: 'var(--chart-3)' }} />
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Algoritmos:</span>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {result.algorithms_used.map(a => (
                      <Badge key={a} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Results area */}
            <ScrollArea className="flex-1">
              <div style={{ padding: '16px 20px 24px' }}>

                {/* Empty state */}
                {!result && !loading && (
                  <div className="animate-fade-in" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: 400, textAlign: 'center',
                    padding: '40px 20px',
                  }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: 20,
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 15%, transparent), color-mix(in srgb, var(--secondary) 10%, transparent))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 20,
                    }}>
                      <Cpu size={32} style={{ color: 'var(--primary)' }} className="animate-float" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--foreground)' }}>
                      Motor LotoCore pronto
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--muted-foreground)', maxWidth: 380, lineHeight: 1.6, marginBottom: 20 }}>
                      Configure os algoritmos no painel esquerdo e clique em
                      <strong style={{ color: 'var(--primary)' }}> Gerar Jogos</strong> para
                      criar combinacoes otimizadas matematicamente.
                    </p>
                    <div style={{
                      display: 'flex', gap: 20, fontSize: 11, color: 'var(--muted-foreground)',
                    }}>
                      {[
                        { icon: Shuffle, text: '9 algoritmos' },
                        { icon: BarChart3, text: 'Scores detalhados' },
                        { icon: Shield, text: 'Anti-padrao' },
                      ].map(({ icon: Ic, text }, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Ic size={13} style={{ color: 'var(--primary)', opacity: 0.7 }} />
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {loading && (
                  <div className="animate-fade-in" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', minHeight: 400, textAlign: 'center',
                    padding: '40px 20px',
                  }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 18,
                      background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 20,
                    }}>
                      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    </div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: 'var(--foreground)' }}>
                      Processando algoritmos...
                    </h3>
                    <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginBottom: 16 }}>
                      Avaliando milhares de combinacoes com {enabledCount} algoritmos
                    </p>
                    <div className="animate-shimmer" style={{ width: 200, height: 4, borderRadius: 4 }} />
                  </div>
                )}

                {/* Game cards */}
                {result && result.games.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="stagger-children">
                    {result.games.map((game, idx) => {
                      const isSelected = idx === selectedGameIdx
                      const scoreColor = getScoreColor(game.score)
                      const scoreLabel = getScoreLabel(game.score)

                      return (
                        <Card
                          key={idx}
                          className={cn(
                            'cursor-pointer transition-all duration-200 border',
                            isSelected
                              ? 'border-primary/40 bg-primary/[0.04] shadow-md'
                              : 'border-border/50 hover:border-primary/20 hover:bg-accent/30'
                          )}
                          onClick={() => setSelectedGameIdx(idx)}
                        >
                          <CardContent className="p-4">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {/* Index */}
                              <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: isSelected ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 12, fontWeight: 800,
                                color: isSelected ? 'var(--primary)' : 'var(--muted-foreground)',
                                fontVariantNumeric: 'tabular-nums', flexShrink: 0,
                              }}>
                                {String(idx + 1).padStart(2, '0')}
                              </div>

                              {/* Numbers */}
                              <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                                {game.numbers.map((n, ni) => (
                                  <NumberBall
                                    key={n}
                                    number={n}
                                    size={game.numbers.length > 10 ? 'sm' : 'md'}
                                    animated={isSelected}
                                    delay={ni * 40}
                                  />
                                ))}
                              </div>

                              {/* Score badge */}
                              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 56 }}>
                                <div style={{
                                  fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
                                  color: scoreColor, lineHeight: 1,
                                }}>
                                  {(game.score * 100).toFixed(0)}
                                </div>
                                <div style={{
                                  fontSize: 9, fontWeight: 600, color: scoreColor,
                                  textTransform: 'uppercase', letterSpacing: '0.04em',
                                  marginTop: 2,
                                }}>
                                  {scoreLabel}
                                </div>
                              </div>

                              {/* Actions */}
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleCopyGame(game) }}>
                                      <Copy size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Copiar</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleSaveGame(game) }}>
                                      <Save size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Salvar</p></TooltipContent>
                                </Tooltip>
                              </div>

                              {/* Arrow indicator */}
                              {isSelected && (
                                <ChevronRight size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                              )}
                            </div>

                            {/* Mini score bar */}
                            <div style={{ marginTop: 8, display: 'flex', gap: 2, height: 3, borderRadius: 2, overflow: 'hidden' }}>
                              {(Object.entries(game.algorithm_scores) as [keyof AlgorithmScores, number][]).map(([key, val]) => (
                                <div
                                  key={key}
                                  style={{
                                    flex: val,
                                    background: SCORE_LABELS[key]?.color || 'var(--muted)',
                                    borderRadius: 1,
                                    minWidth: val > 0 ? 2 : 0,
                                    opacity: 0.7,
                                  }}
                                />
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* ═══ RIGHT PANEL - Math Sidebar ═══ */}
          <div style={{ width: 280, minWidth: 280, maxWidth: 280, flexShrink: 0, borderLeft: '1px solid var(--border)', overflowY: 'auto', overflowX: 'hidden' }}>
            <div style={{ padding: '12px 14px 24px' }}>

              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.08em', color: 'var(--muted-foreground)',
                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <BarChart3 size={12} /> Analise Matematica
              </p>

              {/* No selection */}
              {!selectedGame && (
                <div style={{
                  textAlign: 'center', padding: '40px 12px',
                  color: 'var(--muted-foreground)', fontSize: 12,
                }}>
                  <BarChart3 size={28} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p>Gere jogos e selecione um para ver a analise detalhada</p>
                </div>
              )}

              {/* Selected game detail */}
              {selectedGame && (
                <div className="animate-fade-in">

                  {/* Overall score */}
                  <Card className="mb-3 border-primary/20">
                    <CardContent className="p-3 text-center">
                      <div style={{
                        fontSize: 32, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                        color: getScoreColor(selectedGame.score),
                        lineHeight: 1, marginBottom: 4,
                      }}>
                        {(selectedGame.score * 100).toFixed(1)}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: getScoreColor(selectedGame.score),
                      }}>
                        Score {getScoreLabel(selectedGame.score)}
                      </div>
                      <Progress
                        value={selectedGame.score * 100}
                        className="h-1.5 mt-3"
                      />
                    </CardContent>
                  </Card>

                  {/* Numbers preview */}
                  <Card className="mb-3">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Jogo #{selectedGameIdx + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {selectedGame.numbers.map((n) => (
                          <NumberBall key={n} number={n} size="sm" />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Score breakdown */}
                  <Card className="mb-3">
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Scores por Algoritmo
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {(Object.entries(selectedGame.algorithm_scores) as [keyof AlgorithmScores, number][]).map(([key, value]) => {
                          const meta = SCORE_LABELS[key]
                          if (!meta) return null
                          const pct = value * 100

                          return (
                            <div key={key}>
                              <div style={{
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: 3, gap: 4,
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                                  <div style={{
                                    width: 8, height: 8, borderRadius: 2,
                                    background: meta.color, flexShrink: 0,
                                  }} />
                                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--foreground)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {meta.label}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                                  color: meta.color, flexShrink: 0, minWidth: 30, textAlign: 'right',
                                }}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div style={{
                                height: 4, borderRadius: 2, overflow: 'hidden',
                                background: 'var(--muted)',
                              }}>
                                <div style={{
                                  width: `${pct}%`, height: '100%',
                                  background: meta.color, borderRadius: 2,
                                  transition: 'width 0.5s ease-out',
                                }} />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Radar-like summary */}
                  <Card>
                    <CardHeader className="p-3 pb-2">
                      <CardTitle className="text-[11px] text-muted-foreground uppercase tracking-wide">
                        Diagnostico Rapido
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(() => {
                          const scores = selectedGame.algorithm_scores
                          const diagnostics: { label: string; status: 'good' | 'ok' | 'warn'; text: string }[] = []

                          // Entropy
                          if (scores.entropy >= 0.7) diagnostics.push({ label: 'Distribuicao', status: 'good', text: 'Numeros bem distribuidos' })
                          else if (scores.entropy >= 0.4) diagnostics.push({ label: 'Distribuicao', status: 'ok', text: 'Distribuicao aceitavel' })
                          else diagnostics.push({ label: 'Distribuicao', status: 'warn', text: 'Numeros concentrados' })

                          // Pattern
                          if (scores.pattern >= 0.7) diagnostics.push({ label: 'Padrao', status: 'good', text: 'Foge de padroes comuns' })
                          else if (scores.pattern >= 0.4) diagnostics.push({ label: 'Padrao', status: 'ok', text: 'Alguns padroes detectados' })
                          else diagnostics.push({ label: 'Padrao', status: 'warn', text: 'Parece uma aposta tipica' })

                          // Balance
                          if (scores.balance >= 0.7) diagnostics.push({ label: 'Equilibrio', status: 'good', text: 'Pares/impares equilibrados' })
                          else if (scores.balance >= 0.4) diagnostics.push({ label: 'Equilibrio', status: 'ok', text: 'Razoavelmente equilibrado' })
                          else diagnostics.push({ label: 'Equilibrio', status: 'warn', text: 'Desequilibrado' })

                          // Frequency
                          if (scores.frequency >= 0.7) diagnostics.push({ label: 'Historico', status: 'good', text: 'Alinhado com frequencias' })
                          else if (scores.frequency >= 0.4) diagnostics.push({ label: 'Historico', status: 'ok', text: 'Parcialmente alinhado' })
                          else diagnostics.push({ label: 'Historico', status: 'warn', text: 'Fora do padrao historico' })

                          const statusColors = { good: '#4ADE80', ok: '#FBBF24', warn: '#F87171' }
                          const statusIcons = { good: '●', ok: '◐', warn: '○' }

                          return diagnostics.map((d, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              fontSize: 11, padding: '4px 0',
                            }}>
                              <span style={{ color: statusColors[d.status], fontSize: 10, flexShrink: 0 }}>
                                {statusIcons[d.status]}
                              </span>
                              <span style={{ fontWeight: 600, color: 'var(--foreground)', minWidth: 64, flexShrink: 0, fontSize: 10 }}>
                                {d.label}
                              </span>
                              <span style={{ color: 'var(--muted-foreground)', fontSize: 9, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {d.text}
                              </span>
                            </div>
                          ))
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Footer disclaimer */}
              <p style={{
                fontSize: 9, textAlign: 'center', marginTop: 20,
                color: 'var(--muted-foreground)', opacity: 0.5, fontWeight: 500,
                lineHeight: 1.5,
              }}>
                Analises baseadas em algoritmos matematicos e dados historicos. Nao garantem resultados futuros.
              </p>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
