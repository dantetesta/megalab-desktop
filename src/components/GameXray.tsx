import { type GameAnalysis } from '../lib/tauri'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import NumberBall from './NumberBall'

interface Props {
  analysis: GameAnalysis
  compact?: boolean
  gameType?: string
}

const tooltipStyle = {
  background: '#1a2024',
  border: 'none',
  borderRadius: 10,
  color: '#e0e8ec',
  fontSize: 12,
  fontFamily: 'Manrope',
  padding: '8px 12px',
}

// Dynamic ideal sum ranges per lottery type based on number count and pool
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
    case 'supersete': return null // Super Sete uses columns, not sum ranges
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

  const scoreLabel = (s: number) => s >= 70 ? { t: 'Excelente', c: 'var(--ml-primary)' } : s >= 50 ? { t: 'Bom', c: 'var(--ml-secondary)' } : { t: 'Regular', c: 'var(--ml-error)' }
  const sc = scoreLabel(analysis.structural_score)

  return (
    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-expand">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 3, height: 20, borderRadius: 4, background: 'linear-gradient(to bottom, var(--ml-primary), var(--ml-primary-container))' }} />
        <h4 style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-primary)', margin: 0 }}>Raio-X do Jogo</h4>
      </div>

      {/* Score cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <ScoreCard label="Score Estrutural" value={analysis.structural_score.toFixed(0)} sub={sc.t} color={sc.c} />
        <ScoreCard label="Afinidade Histórica" value={analysis.affinity_score.toFixed(1)} sub="pontos" color="var(--ml-info)" />
        <ScoreCard label="Dispersão" value={analysis.dispersion_score.toFixed(1)} sub="desvio padrão" />
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
        <Metric label="Pares / Ímpares" value={`${analysis.even_count}P / ${analysis.odd_count}I`} hint={analysis.even_count >= 2 && analysis.even_count <= 4 ? 'Equilibrado' : 'Desequilibrado'} ok={analysis.even_count >= 2 && analysis.even_count <= 4} />
        <Metric label="Sequência máxima" value={`${analysis.max_sequence_length} consecutivo${analysis.max_sequence_length > 1 ? 's' : ''}`} hint={analysis.max_sequence_length < 3 ? 'Boa dispersão' : 'Sequência longa'} ok={analysis.max_sequence_length < 3} />
        <Metric label="Distância média" value={`${analysis.avg_distance.toFixed(1)} posições`} />
        <Metric label="Repete do último" value={`${analysis.repeats_from_last} dezena${analysis.repeats_from_last !== 1 ? 's' : ''}`} />
        <Metric label="Combinação já saiu?" value={analysis.exact_match_count > 0 ? `Sim (${analysis.exact_match_count}x)` : 'Nunca — Inédita!'} ok={analysis.exact_match_count === 0} hint={analysis.exact_match_count > 0 ? 'Repetida no histórico' : 'Combinação original'} />
      </div>

      {/* Distribution chart */}
      <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 12 }}>Distribuição por faixas de dezenas</p>
        <ResponsiveContainer width="100%" height={compact ? 100 : 120}>
          <BarChart data={rangeData} barCategoryGap="20%">
            <XAxis dataKey="faixa" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 10, fontFamily: 'Manrope' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} width={18} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(110, 219, 166, 0.05)' }} />
            <Bar dataKey="qtd" radius={[6, 6, 0, 0]}>
              {rangeData.map((_e: { faixa: string; qtd: number }, i: number) => <Cell key={i} fill={_e.qtd > 0 ? 'var(--ml-primary)' : 'var(--ml-surface-highest)'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Number details */}
      {analysis.number_details.length > 0 && (
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Detalhes por dezena</p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(analysis.number_details.length, 6)}, 1fr)`, gap: 8 }}>
            {analysis.number_details.map((d) => (
              <div key={d.number} style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 10, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {gameType === 'supersete' && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ml-primary)', opacity: 0.7, marginBottom: 2 }}>C{analysis.number_details.indexOf(d) + 1}</span>
                )}
                <div style={{ marginBottom: 6 }}><NumberBall number={d.number} size="md" /></div>
                <StatLine label="Frequência" value={d.historical_frequency} />
                <StatLine label="Recente" value={d.recent_frequency} />
                <StatLine label="Atraso" value={d.current_delay} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signature matches */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginBottom: 4 }}>Mesma paridade no histórico</p>
          <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{analysis.same_parity_count} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ml-on-surface-variant)' }}>concursos</span></p>
        </div>
        <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginBottom: 4 }}>Mesma dist. de faixas no histórico</p>
          <p style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{analysis.same_range_count} <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ml-on-surface-variant)' }}>concursos</span></p>
        </div>
      </div>
    </div>
  )
}

function ScoreCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 14, textAlign: 'center' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1, color: color || 'var(--ml-on-surface)' }}>{value}</p>
      <p style={{ fontSize: 10, fontWeight: 600, marginTop: 4, color: color || 'var(--ml-on-surface-variant)' }}>{sub}</p>
    </div>
  )
}

function Metric({ label, value, hint, ok }: { label: string; value: string; hint?: string; ok?: boolean }) {
  return (
    <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 14 }}>
      <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{value}</p>
      {hint && <p style={{ fontSize: 10, marginTop: 4, fontWeight: 600, color: ok ? 'var(--ml-primary)' : 'var(--ml-secondary)' }}>{hint}</p>}
    </div>
  )
}

function StatLine({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
      <span style={{ fontSize: 9, color: 'var(--ml-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface)' }}>{value}</span>
    </div>
  )
}
