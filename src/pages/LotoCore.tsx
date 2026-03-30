import { useState, useCallback, useMemo, useRef } from 'react'
import { api, type LotoCoreConfig, type LotoCoreResult, type LotoCoreGame, type AlgorithmWeights, type EnabledAlgorithms, type AlgorithmScores, type XRayStep, type XRayPipelineSummary } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

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
  Scan,
  Scale,
  GitBranch,
  Thermometer,
  Merge,
  Dice1 as Dice,
  ShieldBan,
  Maximize,
  Equal,
  Moon,
  Calculator,
  Wallet,
  Rocket,
  Atom,
  ArrowUpDown,
  X,
} from 'lucide-react'
import XRayPanel from '@/components/XRayPanel'
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

// ═══ Preset Icons Mapping ═══

const PRESET_ICONS: Record<string, React.ElementType> = { Zap, Scale, Shield, Flame, BarChart3, TrendingUp, GitBranch, Dna, Thermometer, Merge, Dice, ShieldBan, Maximize, Equal, Moon, Calculator, Wallet, Target, Rocket, Atom }

// ═══ Algorithm Presets ═══

interface PresetConfig {
  numGames: number
  simulationDepth: number
  mode: string
  minScore: number
  weights: AlgorithmWeights
  algorithms: EnabledAlgorithms
}

interface Preset {
  id: string
  name: string
  desc: string
  icon: string
  config: PresetConfig
}

const PRESETS: Preset[] = [
  // Basicos
  { id: 'rapido', name: 'Rapido', desc: 'Geracao rapida sem filtros', icon: 'Zap',
    config: { numGames: 6, simulationDepth: 200, mode: 'combined', minScore: 0,
      weights: { frequency: 0.5, entropy: 0.5, patterns: 0.5, genetic: 0 },
      algorithms: { monte_carlo: true, frequency: true, delay: false, entropy: true, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'equilibrado', name: 'Equilibrado', desc: 'Todos os algoritmos em harmonia', icon: 'Scale',
    config: { numGames: 10, simulationDepth: 1000, mode: 'combined', minScore: 60,
      weights: { frequency: 0.5, entropy: 0.5, patterns: 0.5, genetic: 0.5 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: true, pattern_avoidance: true, bayesian: true, markov: true, genetic: false, annealing: false }
    }},
  { id: 'conservador', name: 'Conservador', desc: 'Numeros quentes e frequentes', icon: 'Shield',
    config: { numGames: 6, simulationDepth: 500, mode: 'combined', minScore: 50,
      weights: { frequency: 0.9, entropy: 0.3, patterns: 0.6, genetic: 0.1 },
      algorithms: { monte_carlo: true, frequency: true, delay: false, entropy: false, pattern_avoidance: true, bayesian: true, markov: false, genetic: false, annealing: false }
    }},
  { id: 'arrojado', name: 'Arrojado', desc: 'Numeros atrasados e improvaveis', icon: 'Flame',
    config: { numGames: 10, simulationDepth: 800, mode: 'combined', minScore: 40,
      weights: { frequency: 0.2, entropy: 0.8, patterns: 0.3, genetic: 0.5 },
      algorithms: { monte_carlo: true, frequency: false, delay: true, entropy: true, pattern_avoidance: false, bayesian: false, markov: true, genetic: false, annealing: false }
    }},
  { id: 'frequentista', name: 'Frequentista', desc: 'Baseado 100% em frequencia historica', icon: 'BarChart3',
    config: { numGames: 6, simulationDepth: 500, mode: 'single', minScore: 0,
      weights: { frequency: 1, entropy: 0, patterns: 0.5, genetic: 0 },
      algorithms: { monte_carlo: false, frequency: true, delay: false, entropy: false, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'bayesiano', name: 'Tendencia Recente', desc: 'Foco nos ultimos 30 concursos', icon: 'TrendingUp',
    config: { numGames: 8, simulationDepth: 600, mode: 'single', minScore: 50,
      weights: { frequency: 0.3, entropy: 0.4, patterns: 0.5, genetic: 0.6 },
      algorithms: { monte_carlo: false, frequency: false, delay: false, entropy: false, pattern_avoidance: true, bayesian: true, markov: false, genetic: false, annealing: false }
    }},
  { id: 'markov', name: 'Cadeia de Sequencia', desc: 'Analise de transicoes entre sorteios', icon: 'GitBranch',
    config: { numGames: 8, simulationDepth: 800, mode: 'single', minScore: 45,
      weights: { frequency: 0.4, entropy: 0.5, patterns: 0.4, genetic: 0.5 },
      algorithms: { monte_carlo: false, frequency: false, delay: false, entropy: false, pattern_avoidance: true, bayesian: false, markov: true, genetic: false, annealing: false }
    }},
  { id: 'genetico', name: 'Evolucao Genetica', desc: 'Algoritmo genetico com 50 geracoes', icon: 'Dna',
    config: { numGames: 10, simulationDepth: 2000, mode: 'single', minScore: 65,
      weights: { frequency: 0.5, entropy: 0.5, patterns: 0.7, genetic: 0.9 },
      algorithms: { monte_carlo: false, frequency: false, delay: false, entropy: false, pattern_avoidance: true, bayesian: false, markov: false, genetic: true, annealing: false }
    }},
  { id: 'annealing', name: 'Otimizacao Maxima', desc: 'Simulated Annealing para refinar jogos', icon: 'Thermometer',
    config: { numGames: 6, simulationDepth: 3000, mode: 'single', minScore: 70,
      weights: { frequency: 0.6, entropy: 0.6, patterns: 0.8, genetic: 0.7 },
      algorithms: { monte_carlo: false, frequency: false, delay: false, entropy: false, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: true }
    }},
  { id: 'hibrido_quente_frio', name: 'Quentes + Frios', desc: 'Mix de frequentes e atrasados', icon: 'Merge',
    config: { numGames: 10, simulationDepth: 1000, mode: 'combined', minScore: 55,
      weights: { frequency: 0.7, entropy: 0.5, patterns: 0.6, genetic: 0.3 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: false, pattern_avoidance: true, bayesian: true, markov: false, genetic: false, annealing: false }
    }},
  { id: 'montecarlo_puro', name: 'Monte Carlo Puro', desc: 'Simulacao massiva de 10.000 combinacoes', icon: 'Dice',
    config: { numGames: 10, simulationDepth: 10000, mode: 'single', minScore: 0,
      weights: { frequency: 0.5, entropy: 0.5, patterns: 0.5, genetic: 0.5 },
      algorithms: { monte_carlo: true, frequency: false, delay: false, entropy: false, pattern_avoidance: false, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'anti_padrao', name: 'Anti-Padrao Total', desc: 'Evita padroes humanos ao maximo', icon: 'ShieldBan',
    config: { numGames: 8, simulationDepth: 2000, mode: 'combined', minScore: 60,
      weights: { frequency: 0.3, entropy: 0.9, patterns: 1.0, genetic: 0.4 },
      algorithms: { monte_carlo: true, frequency: false, delay: false, entropy: true, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'dispersao', name: 'Dispersao Maxima', desc: 'Numeros bem espalhados no volante', icon: 'Maximize',
    config: { numGames: 8, simulationDepth: 1500, mode: 'combined', minScore: 65,
      weights: { frequency: 0.3, entropy: 1.0, patterns: 0.8, genetic: 0.3 },
      algorithms: { monte_carlo: true, frequency: false, delay: false, entropy: true, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'paridade_perfeita', name: 'Paridade Perfeita', desc: 'Equilibrio exato pares/impares', icon: 'Equal',
    config: { numGames: 10, simulationDepth: 2000, mode: 'combined', minScore: 70,
      weights: { frequency: 0.5, entropy: 0.5, patterns: 1.0, genetic: 0.5 },
      algorithms: { monte_carlo: true, frequency: true, delay: false, entropy: true, pattern_avoidance: true, bayesian: false, markov: false, genetic: false, annealing: false }
    }},
  { id: 'lunar_cheio', name: 'Lua Cheia', desc: 'Numeros dos sorteios em lua cheia', icon: 'Moon',
    config: { numGames: 6, simulationDepth: 500, mode: 'combined', minScore: 50,
      weights: { frequency: 0.7, entropy: 0.4, patterns: 0.5, genetic: 0.3 },
      algorithms: { monte_carlo: true, frequency: true, delay: false, entropy: false, pattern_avoidance: true, bayesian: true, markov: false, genetic: false, annealing: false }
    }},
  { id: 'soma_ideal', name: 'Soma Ideal', desc: 'Foca na faixa de soma mais premiada', icon: 'Calculator',
    config: { numGames: 8, simulationDepth: 1500, mode: 'combined', minScore: 60,
      weights: { frequency: 0.5, entropy: 0.6, patterns: 0.7, genetic: 0.4 },
      algorithms: { monte_carlo: true, frequency: true, delay: false, entropy: true, pattern_avoidance: true, bayesian: true, markov: false, genetic: false, annealing: false }
    }},
  { id: 'carteira_segura', name: 'Carteira Segura', desc: '20 jogos diversificados para cobertura maxima', icon: 'Wallet',
    config: { numGames: 20, simulationDepth: 5000, mode: 'combined', minScore: 55,
      weights: { frequency: 0.6, entropy: 0.7, patterns: 0.8, genetic: 0.5 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: true, pattern_avoidance: true, bayesian: true, markov: true, genetic: false, annealing: false }
    }},
  { id: 'sniper', name: 'Sniper', desc: '3 jogos de altissima qualidade', icon: 'Target',
    config: { numGames: 3, simulationDepth: 10000, mode: 'weighted', minScore: 80,
      weights: { frequency: 0.8, entropy: 0.8, patterns: 0.9, genetic: 0.8 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: true, pattern_avoidance: true, bayesian: true, markov: true, genetic: true, annealing: true }
    }},
  { id: 'full_power', name: 'Full Power', desc: 'Todos algoritmos no maximo', icon: 'Rocket',
    config: { numGames: 10, simulationDepth: 20000, mode: 'weighted', minScore: 75,
      weights: { frequency: 1, entropy: 1, patterns: 1, genetic: 1 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: true, pattern_avoidance: true, bayesian: true, markov: true, genetic: true, annealing: true }
    }},
  // SPECIAL: Quantum Entropy
  { id: 'quantum', name: 'Entropia Quantica', desc: 'Loop ate encontrar score 85+', icon: 'Atom',
    config: { numGames: 6, simulationDepth: 5000, mode: 'weighted', minScore: 85,
      weights: { frequency: 1, entropy: 1, patterns: 1, genetic: 1 },
      algorithms: { monte_carlo: true, frequency: true, delay: true, entropy: true, pattern_avoidance: true, bayesian: true, markov: true, genetic: true, annealing: true }
    }},
]

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
  const [minScore, setMinScore] = useState(0)

  // Preset state
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [presetToast, setPresetToast] = useState<string | null>(null)

  // Result state
  const [result, setResult] = useState<LotoCoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedGameIdx, setSelectedGameIdx] = useState<number>(0)
  const [filterMessage, setFilterMessage] = useState<string | null>(null)

  // Sort & batch save state
  const [sortAsc, setSortAsc] = useState(false)
  const [saveMinScore, setSaveMinScore] = useState(60)

  // Loop state
  const [loopMode, setLoopMode] = useState(false)
  const [loopMax, setLoopMax] = useState(100)
  const [loopResults, setLoopResults] = useState<LotoCoreGame[]>([])
  const [loopRunning, setLoopRunning] = useState(false)
  const [loopIteration, setLoopIteration] = useState(0)

  // X-Ray state
  const [xrayEnabled, setXrayEnabled] = useState(false)
  const [xraySteps, setXraySteps] = useState<XRayStep[]>([])
  const [xraySummary, setXraySummary] = useState<XRayPipelineSummary | null>(null)
  const [xrayOpen, setXrayOpen] = useState(false)

  // Cancel ref for loop mode
  const cancelRef = useRef(false)

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

  const applyPreset = useCallback((presetId: string) => {
    const preset = PRESETS.find(p => p.id === presetId)
    if (!preset) return
    setNumGames(preset.config.numGames)
    setSimulationDepth(preset.config.simulationDepth)
    setMode(preset.config.mode)
    setMinScore(preset.config.minScore)
    setWeights({ ...preset.config.weights })
    setEnabledAlgorithms({ ...preset.config.algorithms })
    setActivePreset(presetId)
    setPresetToast(preset.name)
    setTimeout(() => setPresetToast(null), 2000)
    if (presetId === 'quantum') {
      setLoopMode(true)
      setLoopMax(200)
    } else {
      setLoopMode(false)
    }
  }, [])

  const toggleAlgorithm = useCallback((key: keyof EnabledAlgorithms) => {
    setEnabledAlgorithms(prev => ({ ...prev, [key]: !prev[key] }))
    setActivePreset(null)
  }, [])

  const updateWeight = useCallback((key: keyof AlgorithmWeights, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }))
    setActivePreset(null)
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

    cancelRef.current = false
    setLoading(true)
    setResult(null)
    setSelectedGameIdx(0)
    setXraySteps([])
    setXraySummary(null)
    setFilterMessage(null)
    if (xrayEnabled) setXrayOpen(true)

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
        xray_enabled: xrayEnabled,
      }

      // Loop mode: keep generating batches until enough high-score games found
      if (loopMode && minScore > 0) {
        setLoopRunning(true)
        setLoopResults([])
        setLoopIteration(0)
        const collected: LotoCoreGame[] = []
        const targetCount = numGames

        for (let i = 0; i < loopMax && collected.length < targetCount; i++) {
          if (cancelRef.current) break
          setLoopIteration(i + 1)
          try {
            const res = await api.generateLotoCore(config)
            // Capture xray on every iteration so the panel shows real-time changes
            if (res.xray && xrayEnabled) {
              setXraySteps([...res.xray.steps])
              setXraySummary({ ...res.xray })
            }
            // Small yield to allow React to re-render the UI
            await new Promise(r => setTimeout(r, 10))
            const good = res.games.filter(g => Math.round(g.score * 100) >= minScore)
            for (const g of good) {
              if (collected.length < targetCount) {
                const isDup = collected.some(c => c.numbers.join(',') === g.numbers.join(','))
                if (!isDup) collected.push(g)
              }
            }
            setLoopResults([...collected])
          } catch { break }
        }

        collected.sort((a, b) => b.score - a.score)
        setResult({ games: collected, generation_time_ms: 0, algorithms_used: [], total_candidates_evaluated: 0, xray: null })
        setLoopRunning(false)
        setLoopIteration(0)
        // Auto-close X-Ray panel after loop completes
        if (xrayEnabled) setTimeout(() => setXrayOpen(false), 800)
        if (collected.length < targetCount) {
          setFilterMessage(`Loop: ${collected.length} de ${targetCount} jogos com score >= ${minScore} em ${loopMax} tentativas.`)
        } else {
          setFilterMessage('')
          showToast(`${collected.length} jogos encontrados com score >= ${minScore}!`, 'success')
        }
        setLoading(false)
        return
      }

      const res = await api.generateLotoCore(config)

      // Apply minimum score filter on frontend
      let filteredGames = res.games
      if (minScore > 0) {
        filteredGames = res.games.filter(g => Math.round(g.score * 100) >= minScore)
      }
      if (filteredGames.length < numGames && minScore > 0) {
        setFilterMessage(`${filteredGames.length} de ${numGames} jogos atingiram score >= ${minScore}. Aumente simulacoes ou reduza o score.`)
      } else {
        setFilterMessage('')
      }
      res.games = filteredGames

      setResult(res)

      if (res.xray) {
        setXraySteps(res.xray.steps)
        setXraySummary(res.xray)
      }

      if (res.games.length === 0) {
        showToast('Nenhum jogo gerado. Tente ajustar os parametros.', 'info')
      }
    } catch (e: any) {
      console.error('LotoCore generation error:', e)
      showToast(e?.toString() || 'Erro ao gerar jogos', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeGame, currentConfig, numGames, simulationDepth, mode, weights, enabledAlgorithms, enabledCount, xrayEnabled, minScore, showToast, loopMode, loopMax])

  const handleCancel = useCallback(() => {
    cancelRef.current = true
  }, [])

  const handleSaveGame = useCallback(async (game: LotoCoreGame) => {
    if (!game.numbers || game.numbers.length === 0) { showToast('Jogo sem numeros', 'error'); return }
    if (!activeGame) { showToast('Selecione uma loteria', 'error'); return }
    try {
      await api.saveGame({
        name: null,
        numbers: game.numbers,
        strategy_id: 'lotocore_v4',
        strategy_label: `LotoCore (${mode})`,
        game_type: activeGame,
        notes: `Score: ${Math.round(game.score * 100)} | Modo: ${mode}`,
        target_contest_number: null,
      })
      showToast('Jogo salvo!', 'success')
    } catch (e: any) {
      console.error('Save error:', e)
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

  const handleSortByScore = useCallback(() => {
    if (!result) return
    const sorted = [...result.games].sort((a, b) => sortAsc ? a.score - b.score : b.score - a.score)
    setResult({ ...result, games: sorted })
    setSortAsc(!sortAsc)
    setSelectedGameIdx(0)
  }, [result, sortAsc])

  const handleSaveFiltered = useCallback(async () => {
    if (!result) return
    const threshold = saveMinScore / 100
    const filtered = result.games.filter(g => g.score >= threshold)
    if (filtered.length === 0) {
      showToast(`Nenhum jogo com score >= ${saveMinScore}`, 'info')
      return
    }
    try {
      for (const game of filtered) {
        await api.saveGame({
          numbers: game.numbers,
          strategy_id: 'lotocore_v4',
          strategy_label: `LotoCore (${mode})`,
          game_type: activeGame,
          notes: `Score: ${game.score.toFixed(3)} | Modo: ${mode}`,
        })
      }
      showToast(`${filtered.length} jogos com score >= ${saveMinScore} salvos!`, 'success')
    } catch (e: any) {
      showToast(e?.toString() || 'Erro ao salvar', 'error')
    }
  }, [result, saveMinScore, activeGame, mode, showToast])

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
    <TooltipProvider delay={300}>
      <div className="h-full flex flex-col overflow-hidden">

        {/* ── Header ── */}
        <div className="px-6 pt-5 shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-[10px] bg-gradient-to-br from-primary to-[var(--accent-gold)] flex items-center justify-center">
              <Cpu size={18} className="text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-[1.35rem] font-[800] tracking-tight leading-tight">
                LotoCore Engine
              </h2>
              <p className="text-xs text-muted-foreground mt-px">
                Motor avancado de geracao com algoritmos matematicos
              </p>
            </div>
            {result && (
              <div className="ml-auto flex gap-1.5">
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
            <div className="mt-3">
              <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={(gt) => { setActiveGame(gt); setResult(null) }} />
            </div>
          )}
        </div>

        {/* ── 3-Panel Layout ── */}
        <div className="flex-1 flex gap-0 overflow-hidden mt-3 min-h-0">

          {/* ═══ LEFT PANEL - Controls ═══ */}
          <div className="h-full w-[260px] min-w-[260px] max-w-[260px] shrink-0 border-r border-border flex flex-col">
            <div className="flex-1 overflow-y-auto px-4 pt-3 pb-3">

              {/* Active game info */}
              {currentConfig && (
                <div className={cn('lottery-' + activeGame, 'bg-accent rounded-[10px] py-2 px-3 mb-3.5 flex items-center gap-2 text-[11px]')}>
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ background: currentConfig.color }} />
                  <span className="font-bold text-foreground">{currentConfig.display_name}</span>
                  <span className="text-muted-foreground">
                    {currentConfig.default_pick_count}/{currentConfig.numbers_pool_size}
                  </span>
                </div>
              )}

              {/* Section: Presets */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={12} /> Presets
                </p>

                <div className="grid grid-cols-2 gap-1.5 max-h-[280px] overflow-y-auto pr-0.5">
                  {PRESETS.map((preset) => {
                    const Icon = PRESET_ICONS[preset.icon] || Zap
                    const isActive = activePreset === preset.id
                    const isQuantum = preset.id === 'quantum'
                    return (
                      <Tooltip key={preset.id}>
                        <TooltipTrigger>
                          <button
                            onClick={() => applyPreset(preset.id)}
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-[6px] rounded-lg text-left transition-all duration-200 border cursor-pointer bg-transparent w-full',
                              isActive
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-transparent hover:bg-accent/50 hover:border-border/50',
                              isQuantum && !isActive && 'border-[var(--accent-gold)]/30 bg-[var(--accent-gold)]/[0.04]',
                              isQuantum && isActive && 'border-[var(--accent-gold)] bg-[var(--accent-gold)]/15 shadow-[0_0_12px_rgba(255,215,0,0.15)]'
                            )}
                          >
                            <Icon
                              size={12}
                              className={cn(
                                'shrink-0',
                                isActive ? 'text-primary' : 'text-muted-foreground',
                                isQuantum && 'text-[var(--accent-gold)]'
                              )}
                            />
                            <span className={cn(
                              'text-[10px] font-semibold truncate',
                              isActive ? 'text-foreground' : 'text-muted-foreground',
                              isQuantum && 'text-[var(--accent-gold)]'
                            )}>
                              {preset.name}
                            </span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[200px]">
                          <p className="text-xs font-semibold">{preset.name}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{preset.desc}</p>
                        </TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>

                {presetToast && (
                  <div className="mt-2 px-2 py-1.5 rounded-md bg-primary/10 border border-primary/20 text-center animate-fade-in">
                    <span className="text-[10px] font-semibold text-primary">Preset: {presetToast} aplicado</span>
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              {/* Section: Algorithms */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Zap size={12} /> Algoritmos ({enabledCount}/9)
                </p>

                <div className="flex flex-col gap-1.5">
                  {ALGORITHMS.map((algo) => {
                    const Icon = algo.icon
                    const isEnabled = enabledAlgorithms[algo.key]
                    return (
                      <div
                        key={algo.key}
                        className={cn(
                          'flex items-center gap-2 py-[7px] px-2.5 rounded-lg transition-colors duration-150',
                          isEnabled ? 'bg-primary/[0.08]' : 'bg-transparent'
                        )}
                      >
                        <Switch
                          checked={isEnabled}
                          onCheckedChange={() => toggleAlgorithm(algo.key)}
                        />
                        <Icon
                          size={13}
                          className={cn('shrink-0', isEnabled ? 'text-primary' : 'text-muted-foreground')}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className={cn('text-[11.5px] font-semibold', isEnabled ? 'text-foreground' : 'text-muted-foreground')}>
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
                          <TooltipTrigger>
                            <button className="bg-transparent border-none cursor-pointer p-0.5 shrink-0">
                              <Info size={12} className="text-muted-foreground opacity-60" />
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
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Sparkles size={12} /> Pesos dos Algoritmos
                </p>

                {([
                  { key: 'frequency' as const, label: 'Frequencia' },
                  { key: 'entropy' as const, label: 'Distribuicao' },
                  { key: 'patterns' as const, label: 'Anti-Padrao' },
                  { key: 'genetic' as const, label: 'Evolucao' },
                ] as const).map(({ key, label }) => (
                  <div key={key} className="mb-2.5">
                    <div className="flex justify-between items-center mb-1">
                      <Label className="text-[11px] text-muted-foreground">{label}</Label>
                      <span className="text-[11px] font-bold tabular-nums text-primary min-w-[32px] text-right">
                        {(weights[key] * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Slider
                      value={[weights[key]]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={(v) => updateWeight(key, Array.isArray(v) ? v[0] : v)}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-3" />

              {/* Section: Parameters */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-2.5 flex items-center gap-1.5">
                  <Timer size={12} /> Parametros
                </p>

                {/* Num games */}
                <div className="mb-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-[11px] text-muted-foreground">Quantidade de jogos</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={numGames === 0 ? '' : numGames}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        if (raw === '') { setNumGames(0); setActivePreset(null); return }
                        setNumGames(Math.min(1000, parseInt(raw)))
                        setActivePreset(null)
                      }}
                      onBlur={() => { if (numGames < 1) setNumGames(1) }}
                      placeholder="1-1000"
                      className="w-20 h-8 text-sm text-center"
                    />
                  </div>
                </div>

                {/* Simulation depth */}
                <div className="mb-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-[11px] text-muted-foreground">Simulacoes</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={simulationDepth === 0 ? '' : simulationDepth}
                      onChange={e => {
                        const raw = e.target.value.replace(/\D/g, '')
                        if (raw === '') { setSimulationDepth(0); setActivePreset(null); return }
                        const val = Math.min(1000000, parseInt(raw))
                        setSimulationDepth(val)
                        setActivePreset(null)
                      }}
                      onBlur={() => { if (simulationDepth < 100) setSimulationDepth(100) }}
                      placeholder="min 100"
                      className="w-24 h-8 text-sm text-center"
                    />
                  </div>
                  {simulationDepth > 0 && simulationDepth < 100 && (
                    <p className="text-[10px] text-orange-400 mt-0.5">Minimo: 100 simulacoes</p>
                  )}
                  {simulationDepth > 100000 && (
                    <p className="text-[10px] text-orange-400 mt-0.5">Valores altos podem demorar. Recomendado: ate 50.000</p>
                  )}
                </div>

                {/* Minimum score filter */}
                <div className="mb-2.5">
                  <div className="flex justify-between items-center mb-1">
                    <Label className="text-[11px] text-muted-foreground">Score minimo (0 = sem filtro)</Label>
                    <Input
                      type="number"
                      value={minScore}
                      onChange={e => { setMinScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0))); setActivePreset(null) }}
                      min={0}
                      max={100}
                      className="w-20 h-8 text-sm text-center"
                    />
                  </div>
                </div>

                {/* Mode */}
                <div className="mb-3">
                  <Label className="text-[11px] text-muted-foreground mb-1.5 block">Modo de geracao</Label>
                  <Select value={mode} onValueChange={(v) => { if (v) { setMode(v); setActivePreset(null) } }}>
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

            </div>

            {/* FIXED at bottom */}
            <div className="shrink-0 px-4 py-3 border-t border-border">
              <div className={cn(
                'flex items-center justify-between py-[7px] px-2.5 rounded-lg mb-2',
                xrayEnabled ? 'bg-[color-mix(in_srgb,var(--chart-3)_15%,transparent)]' : 'bg-transparent'
              )}>
                <div className="flex items-center gap-2">
                  <Scan size={14} className={xrayEnabled ? 'text-[var(--chart-3)]' : 'text-muted-foreground'} />
                  <span className={cn('text-xs font-semibold', xrayEnabled ? 'text-foreground' : 'text-muted-foreground')}>X-Ray Algoritmico</span>
                </div>
                <Switch checked={xrayEnabled} onCheckedChange={setXrayEnabled} />
              </div>
              {xrayEnabled && (
                <p className="text-[10px] text-muted-foreground px-2.5 pb-2 leading-snug">
                  Visualize o pipeline de cada algoritmo. A geracao sera um pouco mais lenta.
                </p>
              )}

              {/* Loop Mode Toggle */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Switch checked={loopMode} onCheckedChange={setLoopMode} />
                  <span className="text-[11px] font-semibold">Modo Loop</span>
                </div>
                {loopMode && (
                  <Input type="text" inputMode="numeric" value={loopMax || ''}
                    onChange={e => setLoopMax(Math.min(1000, parseInt(e.target.value.replace(/\D/g,'')) || 0))}
                    onBlur={() => { if (loopMax < 1) setLoopMax(10) }}
                    placeholder="max tentativas" className="w-16 h-7 text-xs text-center" />
                )}
              </div>

              {/* Generate / Cancel Button */}
              {(loading || loopRunning) ? (
                <Button variant="destructive" className="w-full h-11 text-sm font-bold gap-2" onClick={handleCancel}>
                  <X size={16} /> Cancelar
                </Button>
              ) : (
                <Button
                  className="w-full h-11 text-sm font-bold gap-2"
                  onClick={handleGenerate}
                  disabled={!currentConfig || enabledCount === 0 || numGames < 1}
                >
                  <Cpu size={16} />
                  Gerar Jogos
                </Button>
              )}

              {enabledCount === 0 && (
                <p className="text-[10px] text-destructive text-center mt-1.5">
                  Ative pelo menos um algoritmo
                </p>
              )}
            </div>
          </div>

          {/* ═══ CENTER PANEL - Results ═══ */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">

            {/* Generation stats bar */}
            {result && (
              <div className="animate-slide-down px-5 py-2 border-b border-border flex items-center gap-4 shrink-0 bg-primary/[0.04]">
                <div className="flex items-center gap-1.5">
                  <Timer size={13} className="text-primary" />
                  <span className="text-[11px] text-muted-foreground">Tempo:</span>
                  <span className="text-[11px] font-bold text-foreground">
                    {result.generation_time_ms < 1000
                      ? `${result.generation_time_ms}ms`
                      : `${(result.generation_time_ms / 1000).toFixed(1)}s`
                    }
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5">
                  <Target size={13} className="text-[var(--accent-gold)]" />
                  <span className="text-[11px] text-muted-foreground">Candidatos:</span>
                  <span className="text-[11px] font-bold text-foreground">
                    {result.total_candidates_evaluated.toLocaleString('pt-BR')}
                  </span>
                </div>
                <Separator orientation="vertical" className="h-4" />
                <div className="flex items-center gap-1.5 flex-1">
                  <Zap size={13} className="text-[var(--chart-3)]" />
                  <span className="text-[11px] text-muted-foreground">Algoritmos:</span>
                  <div className="flex gap-[3px] flex-wrap">
                    {result.algorithms_used.map(a => (
                      <Badge key={a} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Filter message */}
            {filterMessage && (
              <div className="px-5 py-2 border-b border-border bg-[var(--accent-gold)]/10 text-[var(--accent-gold)] text-xs font-medium">
                {filterMessage}
              </div>
            )}

            {/* Results area */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-5 pt-4 pb-6">

                {/* Empty state */}
                {!result && !loading && (
                  <div className="animate-fade-in flex flex-col items-center justify-center min-h-[400px] text-center px-5 py-10">
                    <div className="w-[72px] h-[72px] rounded-[20px] bg-gradient-to-br from-primary/15 to-[var(--accent-gold)]/10 flex items-center justify-center mb-5">
                      <Cpu size={32} className="text-primary animate-float" />
                    </div>
                    <h3 className="text-lg font-bold mb-2 text-foreground">
                      Motor LotoCore pronto
                    </h3>
                    <p className="text-[13px] text-muted-foreground max-w-[380px] leading-relaxed mb-5">
                      Configure os algoritmos no painel esquerdo e clique em
                      <strong className="text-primary"> Gerar Jogos</strong> para
                      criar combinacoes otimizadas matematicamente.
                    </p>
                    <div className="flex gap-5 text-[11px] text-muted-foreground">
                      {[
                        { icon: Shuffle, text: '9 algoritmos' },
                        { icon: BarChart3, text: 'Scores detalhados' },
                        { icon: Shield, text: 'Anti-padrao' },
                      ].map(({ icon: Ic, text }, i) => (
                        <div key={i} className="flex items-center gap-[5px]">
                          <Ic size={13} className="text-primary opacity-70" />
                          <span>{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {loading && (
                  <div className="animate-fade-in flex flex-col items-center justify-center min-h-[400px] text-center px-5 py-10">
                    <div className="w-16 h-16 rounded-[18px] bg-primary/10 flex items-center justify-center mb-5">
                      <Loader2 size={28} className="animate-spin text-primary" />
                    </div>
                    <h3 className="text-base font-bold mb-1.5 text-foreground">
                      Processando algoritmos...
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Avaliando milhares de combinacoes com {enabledCount} algoritmos
                    </p>
                    <div className="animate-shimmer w-[200px] h-1 rounded" />
                    {loopRunning && (
                      <div className="text-center py-4">
                        <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                        <p className="text-sm text-muted-foreground">
                          Tentativa {loopIteration} de {loopMax} — {loopResults.length} jogos encontrados
                        </p>
                        <div className="flex gap-1 flex-wrap justify-center mt-2">
                          {loopResults.slice(-5).map((g, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">
                              Score: {Math.round(g.score * 100)}
                            </Badge>
                          ))}
                        </div>
                        {loopResults.length > 0 && (
                          <div className="mt-4 space-y-2 text-left">
                            <p className="text-xs font-bold text-primary mb-2">Jogos encontrados ({loopResults.length}):</p>
                            {loopResults.map((g, ri) => (
                              <div key={ri} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border">
                                <span className="text-[10px] font-bold text-muted-foreground w-5">#{ri+1}</span>
                                <div className="flex gap-1 flex-wrap flex-1">
                                  {g.numbers.map(n => (
                                    <span key={n} className="w-7 h-7 rounded-full bg-primary/20 text-primary text-[11px] font-bold flex items-center justify-center">
                                      {String(n).padStart(2,'0')}
                                    </span>
                                  ))}
                                </div>
                                <span className="text-xs font-bold text-primary tabular-nums">{Math.round(g.score * 100)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sort & batch save toolbar */}
                {result && result.games.length > 0 && (
                  <div className="flex items-center gap-3 mb-3">
                    <Button size="sm" variant="outline" onClick={handleSortByScore} className="gap-1.5">
                      <ArrowUpDown size={13} /> Ordenar por Score
                    </Button>
                    <Button size="sm" onClick={handleSaveAll} className="gap-1.5">
                      <Save size={13} /> Salvar todos
                    </Button>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-muted-foreground">Salvar score &gt;=</span>
                      <Input
                        type="number"
                        value={saveMinScore}
                        onChange={e => setSaveMinScore(Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                        className="w-16 h-7 text-xs"
                        min={0}
                        max={100}
                      />
                      <Button size="sm" variant="secondary" onClick={handleSaveFiltered} className="gap-1.5">
                        Salvar
                      </Button>
                    </div>
                  </div>
                )}

                {/* Game cards */}
                {result && result.games.length > 0 && (
                  <div className="flex flex-col gap-2.5 stagger-children">
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
                            <div className="flex items-center gap-3">
                              {/* Index */}
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-[800] tabular-nums shrink-0',
                                  isSelected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {String(idx + 1).padStart(2, '0')}
                              </div>

                              {/* Numbers */}
                              <div className="flex-1 flex gap-1 flex-wrap justify-center">
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
                              <div className="text-center shrink-0 min-w-[56px]">
                                <div className="text-lg font-[800] tabular-nums leading-none" style={{ color: scoreColor }}>
                                  {(game.score * 100).toFixed(0)}
                                </div>
                                <div className="text-[9px] font-semibold uppercase tracking-[0.04em] mt-0.5" style={{ color: scoreColor }}>
                                  {scoreLabel}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex gap-1 shrink-0">
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleCopyGame(game) }}>
                                      <Copy size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Copiar</p></TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); handleSaveGame(game) }}>
                                      <Save size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Salvar</p></TooltipContent>
                                </Tooltip>
                              </div>

                              {/* Arrow indicator */}
                              {isSelected && (
                                <ChevronRight size={16} className="text-primary shrink-0" />
                              )}
                            </div>

                            {/* Mini score bar */}
                            <div className="mt-2 flex gap-0.5 h-[3px] rounded-sm overflow-hidden">
                              {(Object.entries(game.algorithm_scores) as [keyof AlgorithmScores, number][]).map(([key, val]) => (
                                <div
                                  key={key}
                                  className="rounded-[1px] opacity-70"
                                  style={{
                                    flex: val,
                                    background: SCORE_LABELS[key]?.color || 'var(--muted)',
                                    minWidth: val > 0 ? 2 : 0,
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
            </div>
          </div>

          {/* ═══ RIGHT PANEL - Math Sidebar ═══ */}
          <div className="w-[280px] min-w-[280px] max-w-[280px] shrink-0 border-l border-border overflow-y-auto overflow-x-hidden">
            <div className="px-3.5 pt-3 pb-6">

              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground mb-3 flex items-center gap-1.5">
                <BarChart3 size={12} /> Analise Matematica
              </p>

              {/* No selection */}
              {!selectedGame && (
                <div className="text-center px-3 py-10 text-muted-foreground text-xs">
                  <BarChart3 size={28} className="mx-auto mb-3 opacity-30" />
                  <p>Gere jogos e selecione um para ver a analise detalhada</p>
                </div>
              )}

              {/* Selected game detail */}
              {selectedGame && (
                <div className="animate-fade-in">

                  {/* Overall score */}
                  <Card className="mb-3 border-primary/20">
                    <CardContent className="p-3 text-center">
                      <div className="text-[32px] font-black tabular-nums leading-none mb-1" style={{ color: getScoreColor(selectedGame.score) }}>
                        {(selectedGame.score * 100).toFixed(1)}
                      </div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.05em]" style={{ color: getScoreColor(selectedGame.score) }}>
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
                      <div className="flex gap-[3px] flex-wrap justify-center">
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
                      <div className="flex flex-col gap-2">
                        {(Object.entries(selectedGame.algorithm_scores) as [keyof AlgorithmScores, number][]).map(([key, value]) => {
                          const meta = SCORE_LABELS[key]
                          if (!meta) return null
                          const pct = value * 100

                          return (
                            <div key={key}>
                              <div className="flex justify-between items-center mb-[3px] gap-1">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: meta.color }} />
                                  <span className="text-[10px] font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis">
                                    {meta.label}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold tabular-nums shrink-0 min-w-[30px] text-right" style={{ color: meta.color }}>
                                  {pct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="h-1 rounded-sm overflow-hidden bg-muted">
                                <div className="h-full rounded-sm transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: meta.color }} />
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
                      <div className="flex flex-col gap-1.5">
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
                            <div key={i} className="flex items-center gap-2 text-[11px] py-1">
                              <span className="text-[10px] shrink-0" style={{ color: statusColors[d.status] }}>
                                {statusIcons[d.status]}
                              </span>
                              <span className="font-semibold text-foreground min-w-[64px] shrink-0 text-[10px]">
                                {d.label}
                              </span>
                              <span className="text-muted-foreground text-[9px] leading-snug overflow-hidden text-ellipsis whitespace-nowrap">
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
              <p className="text-[9px] text-center mt-5 text-muted-foreground opacity-50 font-medium leading-normal">
                Analises baseadas em algoritmos matematicos e dados historicos. Nao garantem resultados futuros.
              </p>
            </div>
          </div>
        </div>
      </div>

      <XRayPanel
        open={xrayOpen}
        onClose={() => setXrayOpen(false)}
        steps={xraySteps}
        summary={xraySummary}
        loading={loading || loopRunning}
        loopIteration={loopIteration}
        loopMax={loopMax}
      />

      {xraySteps.length > 0 && !xrayOpen && !loading && (
        <button
          onClick={() => setXrayOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 px-4 py-2 rounded-[20px] bg-primary text-primary-foreground border-none cursor-pointer text-xs font-semibold shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
        >
          <Scan size={14} /> X-Ray
        </button>
      )}
    </TooltipProvider>
  )
}
