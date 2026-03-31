import React from 'react'
import { type GameAnalysis } from '@/lib/tauri'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import NumberBall from '@/components/NumberBall'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  analysis: GameAnalysis
  compact?: boolean
  gameType?: string
}

const tooltipStyle = {
  background: '#1e1e2e',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  color: '#e0e0e0',
  fontSize: 11,
  fontFamily: 'Inter',
  padding: '6px 10px',
}

const getSumRange = (gameType?: string): { min: number; max: number } | null => {
  switch (gameType) {
    case 'megasena': return { min: 140, max: 220 }
    case 'lotofacil': return { min: 170, max: 220 }
    case 'quina': return { min: 130, max: 260 }
    case 'lotomania': return { min: 2200, max: 2700 }
    case 'diadesorte': return { min: 80, max: 145 }
    case 'timemania': return { min: 270, max: 470 }
    case 'duplasena': return { min: 100, max: 180 }
    case 'maismilionaria': return { min: 120, max: 200 }
    case 'supersete': return null
    default: return null
  }
}

export default function GameXray({ analysis, compact = false, gameType }: Props) {
  const rangeDataAll = [
    { faixa: '01-10', qtd: analysis.range_01_10 },
    { faixa: '11-20', qtd: analysis.range_11_20 },
    { faixa: '21-30', qtd: analysis.range_21_30 },
    { faixa: '31-40', qtd: analysis.range_31_40 },
    { faixa: '41-50', qtd: analysis.range_41_50 },
    { faixa: '51-60', qtd: analysis.range_51_60 },
  ]
  const rangeData = rangeDataAll.filter(d => d.qtd > 0 || rangeDataAll.length <= 6)

  const scoreLabel = (s: number) => s >= 70 ? { t: 'Excelente', c: 'var(--primary)' } : s >= 50 ? { t: 'Bom', c: 'var(--accent-gold)' } : { t: 'Regular', c: 'var(--destructive)' }
  const sc = scoreLabel(analysis.structural_score)

  return (
    <div className="mt-3 flex flex-col gap-2.5 animate-expand">
      {/* Header */}
      <div className="flex items-center gap-1.5">
        <div className="w-[3px] h-4 rounded bg-gradient-to-b from-primary to-primary/60" />
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-primary">Raio-X do Jogo</h4>
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-3 gap-1.5">
        <ScoreCard label="Score Estrutural" value={analysis.structural_score.toFixed(0)} sub={sc.t} color={sc.c} />
        <ScoreCard label="Afinidade Historica" value={analysis.affinity_score.toFixed(1)} sub="pontos" color="#5b9bd5" />
        <ScoreCard label="Dispersao" value={analysis.dispersion_score.toFixed(1)} sub="desvio padrao" />
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-1.5">
        <Metric label="Soma total" value={String(analysis.sum_total)} hint={(() => {
          const range = getSumRange(gameType)
          if (!range) return undefined
          const inRange = analysis.sum_total >= range.min && analysis.sum_total <= range.max
          return inRange ? `Faixa ideal (${range.min}-${range.max})` : `Fora da faixa ideal (${range.min}-${range.max})`
        })()} ok={(() => {
          const range = getSumRange(gameType)
          if (!range) return undefined
          return analysis.sum_total >= range.min && analysis.sum_total <= range.max
        })()} />
        <Metric label="Pares / Impares" value={`${analysis.even_count}P / ${analysis.odd_count}I`} hint={analysis.even_count >= 2 && analysis.even_count <= 4 ? 'Equilibrado' : 'Desequilibrado'} ok={analysis.even_count >= 2 && analysis.even_count <= 4} />
        <Metric label="Sequencia maxima" value={`${analysis.max_sequence_length} consecutivo${analysis.max_sequence_length > 1 ? 's' : ''}`} hint={analysis.max_sequence_length < 3 ? 'Boa dispersao' : 'Sequencia longa'} ok={analysis.max_sequence_length < 3} />
        <Metric label="Distancia media" value={`${analysis.avg_distance.toFixed(1)} posicoes`} />
        <Metric label="Repete do ultimo" value={`${analysis.repeats_from_last} dezena${analysis.repeats_from_last !== 1 ? 's' : ''}`} />
        <Metric label="Combinacao ja saiu?" value={analysis.exact_match_count > 0 ? `Sim (${analysis.exact_match_count}x)` : 'Nunca - Inedita!'} ok={analysis.exact_match_count === 0} hint={analysis.exact_match_count > 0 ? 'Repetida no historico' : 'Combinacao original'} />
      </div>

      {/* Distribution chart */}
      <Card>
        <CardContent className="p-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Distribuicao por faixas de dezenas</p>
          <ResponsiveContainer width="100%" height={compact ? 80 : 90}>
            <BarChart data={rangeData} barCategoryGap="20%">
              <XAxis dataKey="faixa" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={18} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(110, 219, 166, 0.05)' }} />
              <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
                {rangeData.map((_e: { faixa: string; qtd: number }, i: number) => <Cell key={i} fill={_e.qtd > 0 ? 'var(--primary)' : 'var(--muted)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Number details */}
      {analysis.number_details.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Detalhes por dezena</p>
          <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(analysis.number_details.length, 6)}, 1fr)` }}>
            {analysis.number_details.map((d) => (
              <Card key={d.number}>
                <CardContent className="p-1.5 text-center flex flex-col items-center">
                  {gameType === 'supersete' && (
                    <span className="text-[9px] font-bold text-primary/70 mb-0.5">C{analysis.number_details.indexOf(d) + 1}</span>
                  )}
                  <div className="mb-1.5"><NumberBall number={d.number} size="md" /></div>
                  <StatLine label="Frequencia" value={d.historical_frequency} />
                  <StatLine label="Recente" value={d.recent_frequency} />
                  <StatLine label="Atraso" value={d.current_delay} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Signature matches */}
      <div className="grid grid-cols-2 gap-1.5">
        <Card>
          <CardContent className="p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Mesma paridade no historico</p>
            <p className="text-base font-extrabold">{analysis.same_parity_count} <span className="text-[10px] font-medium text-muted-foreground">concursos</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Mesma dist. de faixas no historico</p>
            <p className="text-base font-extrabold">{analysis.same_range_count} <span className="text-[10px] font-medium text-muted-foreground">concursos</span></p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ScoreCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <Card style={color ? { '--c': color } as React.CSSProperties : undefined}>
      <CardContent className="p-2.5 text-center">
        <p className="text-[9px] font-semibold text-muted-foreground mb-1">{label}</p>
        <p className={cn('text-xl font-extrabold leading-none', color ? '[color:var(--c)]' : 'text-foreground')}>{value}</p>
        <p className={cn('text-[9px] font-semibold mt-0.5', color ? '[color:var(--c)]' : 'text-muted-foreground')}>{sub}</p>
      </CardContent>
    </Card>
  )
}

function Metric({ label, value, hint, ok }: { label: string; value: string; hint?: string; ok?: boolean }) {
  return (
    <Card>
      <CardContent className="p-2.5">
        <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-extrabold">{value}</p>
        {hint && <p className={cn('text-[9px] mt-0.5 font-semibold', ok ? 'text-primary' : 'text-accent-gold')}>{hint}</p>}
      </CardContent>
    </Card>
  )
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-0.5 w-full">
      <span className="text-[9px] text-muted-foreground">{label}</span>
      <span className="text-[11px] font-bold text-foreground">{value}</span>
    </div>
  )
}
