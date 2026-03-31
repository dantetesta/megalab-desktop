import { useMemo } from 'react'
import { X, History, Trophy, Medal, Star, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HistoricalWinResult } from '@/lib/tauri'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  results: HistoricalWinResult[]
  gameName: string
  gameNames: Record<number, string>
}

// ── Prize tier config ──
function getTier(hitCount: number, prizeLabel: string): {
  color: string
  tierName: string
  Icon: React.ElementType
} {
  const label = prizeLabel.toLowerCase()
  if (label.includes('sena') || label.includes('6 acertos') || hitCount >= 6)
    return { color: '#FBBF24', tierName: 'Sena', Icon: Star }
  if (label.includes('quina') || label.includes('5 acertos') || hitCount === 5)
    return { color: '#A78BFA', tierName: 'Quina', Icon: Trophy }
  if (label.includes('quadra') || label.includes('4 acertos') || hitCount === 4)
    return { color: '#60A5FA', tierName: 'Quadra', Icon: Medal }
  return { color: 'var(--primary)', tierName: `${hitCount} acertos`, Icon: TrendingUp }
}

// ── Single result card ──
function WinCard({ result, gameName, isLast }: {
  result: HistoricalWinResult
  gameName: string
  isLast: boolean
}) {
  const tier = getTier(result.hit_count, result.prize_label)
  const Icon = tier.Icon

  const formattedDate = useMemo(() => {
    if (!result.contest_date) return ''
    const parts = result.contest_date.split('/')
    if (parts.length === 3) return result.contest_date
    return result.contest_date
  }, [result.contest_date])

  return (
    <div
      className="relative flex gap-0 group"
      style={{ '--tier': tier.color } as React.CSSProperties}
    >
      {/* Timeline left column */}
      <div className="flex flex-col items-center w-8 shrink-0">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in srgb, ${tier.color} 18%, transparent)`,
            border: `1.5px solid color-mix(in srgb, ${tier.color} 50%, transparent)`,
          }}
        >
          <Icon size={13} style={{ color: tier.color }} />
        </div>
        {!isLast && (
          <div
            className="flex-1 w-px min-h-[12px] mt-1 rounded-[1px]"
            style={{ background: `linear-gradient(to bottom, ${tier.color}60, var(--border))` }}
          />
        )}
      </div>

      {/* Card */}
      <div
        className={cn(
          'flex-1 ml-3 rounded-[10px] border border-border',
          isLast ? 'mb-0' : 'mb-1.5',
        )}
        style={{ background: `color-mix(in srgb, var(--card) 85%, transparent)` }}
      >
        {/* Prize tier accent bar — inside its own rounded container so it doesn't clip card content */}
        <div
          className="h-[3px] w-full rounded-t-[10px]"
          style={{ background: `linear-gradient(90deg, ${tier.color}, transparent 70%)` }}
        />

        <div className="px-3.5 pt-2.5 pb-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <span className="text-[11px] font-bold text-foreground truncate">{gameName}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] text-muted-foreground font-mono">#{result.contest_number}</span>
              <span className="text-[9px] text-muted-foreground">{formattedDate}</span>
            </div>
          </div>

          {/* Number balls */}
          {result.game_numbers && result.game_numbers.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2.5">
              {result.game_numbers.map((n) => {
                const isHit = result.hits?.includes(n)
                return (
                  <span
                    key={n}
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-extrabold font-mono tabular-nums transition-all',
                      isHit
                        ? 'text-white shadow-[0_2px_8px_rgba(0,0,0,0.4),inset_0_1px_2px_rgba(255,255,255,0.25)]'
                        : 'bg-muted text-muted-foreground',
                    )}
                    style={isHit ? {
                      background: `linear-gradient(135deg, ${tier.color}, color-mix(in srgb, ${tier.color} 70%, #000))`,
                    } : undefined}
                  >
                    {String(n).padStart(2, '0')}
                  </span>
                )
              })}
            </div>
          )}

          {/* Drawn numbers */}
          {result.contest_numbers && result.contest_numbers.length > 0 && (
            <div className="flex gap-1 items-center mb-2 flex-wrap">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-[0.06em] mr-0.5">
                Sorteio:
              </span>
              {result.contest_numbers.map((n) => (
                <span
                  key={n}
                  className="text-[9px] font-mono font-bold text-muted-foreground"
                >
                  {String(n).padStart(2, '0')}
                </span>
              ))}
            </div>
          )}

          {/* Prize row */}
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-extrabold"
              style={{ color: tier.color }}
            >
              {result.hit_count} acerto{result.hit_count !== 1 ? 's' : ''} — {result.prize_label.replace('!', '').trim()}
            </span>
            {result.prize_value != null && result.prize_value > 0 && (
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: tier.color }}
              >
                {result.prize_value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main panel ──
export default function HistoricalWinsPanel({ open, onClose, results, gameName, gameNames }: Props) {
  if (!open) return null

  // Summary stats
  const totalPrize = results.reduce((s, r) => s + (r.prize_value ?? 0), 0)
  const bestHit = results.length > 0 ? Math.max(...results.map(r => r.hit_count)) : 0
  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    results.forEach(r => {
      const tier = getTier(r.hit_count, r.prize_label).tierName
      counts[tier] = (counts[tier] ?? 0) + 1
    })
    return counts
  }, [results])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-[49] bg-black/30 backdrop-blur-[2px] animate-fade-in"
      />

      {/* Panel */}
      <div className="xray-panel-enter fixed right-0 top-0 h-screen w-[460px] z-50 flex flex-col border-l border-border shadow-[-8px_0_40px_rgba(0,0,0,0.3)] xray-panel-glass">

        {/* Header */}
        <div className="px-5 py-4 shrink-0 border-b border-border flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 30%, transparent), color-mix(in srgb, #FBBF24 20%, transparent))' }}
          >
            <History size={16} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-[800] tracking-tight leading-tight">
              Acertos Históricos
            </h3>
            <p className="text-[10px] text-muted-foreground mt-px truncate">{gameName}</p>
          </div>
          <Badge variant="secondary" className="text-[9px] px-2 py-0.5 shrink-0">
            {results.length} premiado{results.length !== 1 ? 's' : ''}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Summary bar */}
        {results.length > 0 && (
          <div className="px-5 py-3 shrink-0 border-b border-border flex gap-3 flex-wrap">
            {Object.entries(tierCounts).map(([tier, count]) => {
              const { color } = getTier(
                results.find(r => getTier(r.hit_count, r.prize_label).tierName === tier)?.hit_count ?? 0,
                results.find(r => getTier(r.hit_count, r.prize_label).tierName === tier)?.prize_label ?? '',
              )
              return (
                <div key={tier} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] font-bold" style={{ color }}>
                    {count}× {tier}
                  </span>
                </div>
              )
            })}
            {totalPrize > 0 && (
              <div className="ml-auto text-[10px] font-bold text-accent-gold">
                Total: {totalPrize.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            )}
          </div>
        )}

        {/* Scrollable results */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-4">
          {results.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[300px] text-center">
              <History size={40} className="text-muted-foreground opacity-20 mb-4" />
              <p className="text-[13px] text-muted-foreground">
                Nenhum resultado premiado encontrado
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-0">
              {results.map((r, idx) => (
                <WinCard
                  key={`${r.game_id}-${r.contest_number}-${idx}`}
                  result={r}
                  gameName={gameNames[r.game_id] ?? `Jogo #${r.game_id}`}
                  isLast={idx === results.length - 1}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <div className="px-5 py-3.5 shrink-0 border-t border-border xray-footer-tint">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Melhor resultado: <strong className="text-foreground">{bestHit} acerto{bestHit !== 1 ? 's' : ''}</strong></span>
              <span>{results.length} premiação{results.length !== 1 ? 'ões' : ''} no histórico</span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
