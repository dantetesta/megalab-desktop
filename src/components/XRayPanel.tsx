import { useMemo } from 'react'
import type { XRayStep, XRayPipelineSummary } from '@/lib/tauri'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  X,
  Scan,
  TrendingUp,
  Clock,
  Brain,
  GitBranch,
  Dice5,
  Shuffle,
  ShieldCheck,
  Dna,
  Flame,
  Timer,
  Layers,
  ChevronDown,
} from 'lucide-react'

// ═══ Algorithm icon mapping ═══

const ALGORITHM_ICONS: Record<string, React.ElementType> = {
  frequency: TrendingUp,
  delay: Clock,
  bayesian: Brain,
  markov: GitBranch,
  monte_carlo: Dice5,
  entropy: Shuffle,
  pattern_avoidance: ShieldCheck,
  genetic: Dna,
  annealing: Flame,
}

const ALGORITHM_COLORS: Record<string, string> = {
  frequency: '#4ADE80',
  delay: '#FBBF24',
  bayesian: '#F472B6',
  markov: '#A78BFA',
  monte_carlo: '#60A5FA',
  entropy: '#34D399',
  pattern_avoidance: '#FB923C',
  genetic: '#E879F9',
  annealing: '#F87171',
}

// ═══ Props ═══

interface XRayPanelProps {
  open: boolean
  onClose: () => void
  steps: XRayStep[]
  summary: XRayPipelineSummary | null
  loading: boolean
  loopIteration?: number
  loopMax?: number
}

// ═══ Sub-components ═══

function SkeletonStep({ index }: { index: number }) {
  return (
    <div className="flex gap-3 opacity-40">
      {/* Connector */}
      <div className="flex flex-col items-center w-8 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded bg-muted-foreground opacity-30" />
        </div>
        <div className="flex-1 w-0.5 bg-border mt-1" />
      </div>
      {/* Card skeleton */}
      <div
        className="flex-1 rounded-[10px] p-3.5 bg-muted min-h-[80px] animate-pulse"
        style={{ animationDelay: `${index * 150}ms` }}
      />
    </div>
  )
}

function StepCard({ step, isLast }: { step: XRayStep; isLast: boolean }) {
  const Icon = ALGORITHM_ICONS[step.algorithm_key] || Shuffle
  const color = ALGORITHM_COLORS[step.algorithm_key] || 'var(--primary)'

  const scoreRange = step.score_max - step.score_min
  const avgPosition = scoreRange > 0 ? ((step.score_avg - step.score_min) / scoreRange) * 100 : 50
  const minPct = 0
  const maxPct = 100

  const topHeatmap = useMemo(() => {
    return [...step.numbers_heatmap]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
  }, [step.numbers_heatmap])

  const maxHeat = useMemo(() => {
    if (topHeatmap.length === 0) return 1
    return Math.max(...topHeatmap.map(h => h[1]))
  }, [topHeatmap])

  const topCandidates = step.candidates_sample.slice(0, 3)

  return (
    <div className="flex gap-3">
      {/* Pipeline connector */}
      <div className="flex flex-col items-center w-8 shrink-0">
        {/* Icon circle */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${color} 20%, transparent)`,
            border: `1.5px solid ${color}`,
          }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        {/* Vertical line */}
        {!isLast && (
          <div
            className="xray-flow-line flex-1 w-0.5 min-h-[16px] mt-1 rounded-[1px]"
            style={{ background: `linear-gradient(to bottom, ${color}, var(--border))` }}
          />
        )}
      </div>

      {/* Step card */}
      <div
        className="flex-1 rounded-[10px] p-3.5 border border-border"
        style={{
          background: 'color-mix(in srgb, var(--card) 80%, transparent)',
          marginBottom: isLast ? 0 : 4,
        }}
      >
        {/* Header: name + duration + candidates */}
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs font-bold text-foreground flex-1">
            {step.algorithm_name}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
            {step.duration_ms}ms
          </span>
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
            {step.candidates_generated.toLocaleString('pt-BR')} cand.
          </Badge>
        </div>

        {/* Score range bar */}
        {step.score_max > 0 && (
          <div className="mb-2.5">
            <div className="flex justify-between items-center text-[9px] text-muted-foreground mb-1">
              <span>Score min: {step.score_min.toFixed(2)}</span>
              <span className="font-bold" style={{ color }}>avg: {step.score_avg.toFixed(2)}</span>
              <span>max: {step.score_max.toFixed(2)}</span>
            </div>
            <div className="h-1.5 rounded-[3px] overflow-hidden bg-muted relative">
              {/* Range bar (min to max) */}
              <div
                className="xray-score-bar absolute h-full rounded-[3px]"
                style={{
                  left: `${minPct}%`,
                  width: `${maxPct - minPct}%`,
                  background: `linear-gradient(90deg, color-mix(in srgb, ${color} 30%, transparent), ${color})`,
                }}
              />
              {/* Avg marker */}
              <div
                className="absolute w-[3px] h-2 rounded-[1px] bg-foreground -top-px"
                style={{
                  left: `${avgPosition}%`,
                  transform: 'translateX(-50%)',
                  boxShadow: `0 0 4px ${color}`,
                }}
              />
            </div>
          </div>
        )}

        {/* Top 3 candidates */}
        {topCandidates.length > 0 && (
          <div className="mb-2.5">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.06em] block mb-[5px]">
              Top candidatos
            </span>
            <div className="flex flex-col gap-1">
              {topCandidates.map((cand, ci) => (
                <div key={ci} className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground w-3 text-right shrink-0">
                    {ci + 1}.
                  </span>
                  <div className="flex gap-0.5 flex-wrap flex-1">
                    {cand.numbers.map((n) => (
                      <span
                        key={n}
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[8px] font-[800] tabular-nums"
                        style={{
                          background: `color-mix(in srgb, ${color} 20%, transparent)`,
                          color: color,
                          border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
                        }}
                      >
                        {String(n).padStart(2, '0')}
                      </span>
                    ))}
                  </div>
                  <span className="text-[9px] font-bold tabular-nums shrink-0" style={{ color }}>
                    {(cand.score * 100).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Heatmap: top 10 numbers */}
        {topHeatmap.length > 0 && (
          <div>
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.06em] block mb-[5px]">
              Heatmap (top 10)
            </span>
            <div className="flex gap-[3px] flex-wrap">
              {topHeatmap.map(([num, count]) => {
                const intensity = count / maxHeat
                return (
                  <span
                    key={num}
                    className="inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums"
                    style={{
                      background: `color-mix(in srgb, ${color} ${Math.round(intensity * 50 + 10)}%, transparent)`,
                      color: intensity > 0.5 ? color : 'var(--muted-foreground)',
                      border: `1px solid color-mix(in srgb, ${color} ${Math.round(intensity * 40 + 10)}%, transparent)`,
                    }}
                  >
                    {String(num).padStart(2, '0')}
                    <span className="text-[7px] ml-0.5 opacity-70">x{count}</span>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Message */}
        {step.message && (
          <p className="text-[9px] text-muted-foreground mt-2 leading-snug italic">
            {step.message}
          </p>
        )}
      </div>
    </div>
  )
}

// ═══ Main Panel ═══

export default function XRayPanel({ open, onClose, steps, summary, loading, loopIteration, loopMax }: XRayPanelProps) {
  if (!open) return null

  const remainingSkeletons = loading
    ? Math.max(0, (steps.length > 0 ? steps[0].total_steps : 9) - steps.length)
    : 0

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[49] bg-black/30 backdrop-blur-[2px] animate-fade-in"
      />

      {/* Panel */}
      <div className="xray-panel-enter fixed right-0 top-0 h-screen w-[480px] z-50 flex flex-col border-l border-border shadow-[-8px_0_40px_rgba(0,0,0,0.3)]"
        style={{
          background: 'color-mix(in srgb, var(--card) 95%, transparent)',
          backdropFilter: 'blur(24px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 shrink-0 border-b border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--chart-3)] to-primary flex items-center justify-center">
            <Scan size={16} className="text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="text-[15px] font-[800] tracking-tight leading-tight">
              X-Ray Algoritmico
            </h3>
            <p className="text-[10px] text-muted-foreground mt-px">
              Pipeline de geracao em tempo real
            </p>
          </div>
          {loading && (
            <Badge variant="secondary" className="text-[9px] px-2 py-0.5 animate-pulse">
              Processando...
            </Badge>
          )}
          {loopIteration && loopMax && loopIteration > 0 ? (
            <Badge variant="outline" className="text-[10px] px-2 py-0.5 tabular-nums">
              Loop {loopIteration}/{loopMax}
            </Badge>
          ) : null}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {/* Steps */}
          <div className="stagger-children flex flex-col gap-1">
            {steps.map((step, idx) => (
              <StepCard
                key={`${step.algorithm_key}-${step.step_index}`}
                step={step}
                isLast={idx === steps.length - 1 && remainingSkeletons === 0}
              />
            ))}

            {/* Skeleton placeholders for remaining steps */}
            {Array.from({ length: remainingSkeletons }).map((_, idx) => (
              <SkeletonStep key={`skeleton-${idx}`} index={idx} />
            ))}
          </div>

          {/* Empty state */}
          {steps.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center px-5 py-10">
              <Scan size={40} className="text-muted-foreground opacity-20 mb-4" />
              <p className="text-[13px] text-muted-foreground">
                Gere jogos com o X-Ray ativado para visualizar o pipeline
              </p>
            </div>
          )}
        </div>

        {/* Summary footer */}
        {summary && (
          <div
            className="px-5 py-3.5 shrink-0 border-t border-border"
            style={{ background: 'color-mix(in srgb, var(--primary) 4%, transparent)' }}
          >
            {/* Funnel visualization */}
            <div className="mb-3">
              <span className="text-[9px] font-bold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-[5px] mb-2">
                <ChevronDown size={10} /> Funil de Selecao
              </span>
              {/* Wide bar = total candidates */}
              <div className="h-1.5 rounded-[3px] overflow-hidden bg-muted mb-1 relative">
                <div className="xray-score-bar w-full h-full rounded-[3px] bg-gradient-to-r from-[var(--chart-3)] to-primary" />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mb-1.5">
                <span>{summary.total_candidates.toLocaleString('pt-BR')} candidatos</span>
                <span>100%</span>
              </div>
              {/* Narrow bar = final selection */}
              <div className="h-1.5 rounded-[3px] overflow-hidden bg-muted relative">
                <div
                  className="xray-score-bar h-full rounded-[3px] bg-primary"
                  style={{
                    width: `${summary.total_candidates > 0 ? Math.max(2, (summary.final_count / summary.total_candidates) * 100) : 0}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                <span className="font-bold text-primary">
                  {summary.final_count} selecionados
                </span>
                <span>
                  {summary.total_candidates > 0
                    ? ((summary.final_count / summary.total_candidates) * 100).toFixed(2)
                    : 0
                  }%
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4">
              <div className="flex items-center gap-[5px]">
                <Timer size={12} className="text-primary" />
                <span className="text-[10px] text-muted-foreground">Tempo total:</span>
                <span className="text-[10px] font-bold text-foreground tabular-nums">
                  {summary.total_duration_ms < 1000
                    ? `${summary.total_duration_ms}ms`
                    : `${(summary.total_duration_ms / 1000).toFixed(1)}s`
                  }
                </span>
              </div>
              <div className="flex items-center gap-[5px]">
                <Layers size={12} className="text-[var(--chart-3)]" />
                <span className="text-[10px] text-muted-foreground">Etapas:</span>
                <span className="text-[10px] font-bold text-foreground">
                  {summary.steps.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
