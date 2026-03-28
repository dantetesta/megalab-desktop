import { useState } from 'react'
import { X } from 'lucide-react'

interface NumberData {
  number: number
  frequency: number
  delay: number
}

interface Props {
  data: NumberData[]
  highlighted?: number[]
  columns?: number
}

function getHeatColor(intensity: number): string {
  const stops = [
    { at: 0.0, r: 55, g: 100, b: 190 },
    { at: 0.2, r: 70, g: 145, b: 200 },
    { at: 0.4, r: 80, g: 185, b: 160 },
    { at: 0.55, r: 120, g: 200, b: 80 },
    { at: 0.7, r: 230, g: 200, b: 50 },
    { at: 0.85, r: 240, g: 130, b: 40 },
    { at: 1.0, r: 220, g: 50, b: 40 },
  ]
  const t = Math.max(0, Math.min(1, intensity))
  let lo = stops[0], hi = stops[stops.length - 1]
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i].at && t <= stops[i + 1].at) { lo = stops[i]; hi = stops[i + 1]; break }
  }
  const range = hi.at - lo.at || 1
  const f = (t - lo.at) / range
  return `rgb(${Math.round(lo.r + (hi.r - lo.r) * f)},${Math.round(lo.g + (hi.g - lo.g) * f)},${Math.round(lo.b + (hi.b - lo.b) * f)})`
}

export default function HeatMap({ data, highlighted = [], columns = 10 }: Props) {
  const [selectedNumber, setSelectedNumber] = useState<NumberData | null>(null)

  if (!data || data.length === 0) return null
  const freqs = data.map(d => d.frequency)
  const maxFreq = Math.max(...freqs, 1)
  const minFreq = Math.min(...freqs, 0)
  const range = maxFreq - minFreq || 1

  const cols = data.length <= 10 ? data.length : data.length <= 31 ? 8 : columns
  // Bigger cells
  const cellSize = data.length <= 10 ? 52 : data.length <= 31 ? 48 : data.length <= 60 ? 46 : 38

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: data.length > 60 ? 5 : 6 }}>
        {data.map(d => {
          const intensity = (d.frequency - minFreq) / range
          const bg = getHeatColor(intensity)
          const isHL = highlighted.includes(d.number)
          const textColor = intensity > 0.5 ? '#1a1a1a' : '#ffffff'
          const freqColor = intensity > 0.5 ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.7)'
          return (
            <div
              key={d.number}
              onClick={() => setSelectedNumber(d)}
              style={{
                width: cellSize, height: cellSize, borderRadius: '50%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: bg, color: textColor, transition: 'all 0.2s ease', cursor: 'pointer',
                boxShadow: isHL
                  ? '0 0 0 3px #fff, 0 0 0 5px var(--ml-primary), 0 0 16px rgba(110,219,166,0.5)'
                  : '0 2px 5px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.2), inset 0 -2px 3px rgba(0,0,0,0.1)',
                transform: isHL ? 'scale(1.12)' : 'scale(1)',
                zIndex: isHL ? 2 : 1, position: 'relative',
              }}>
              <span style={{ fontSize: cellSize > 42 ? 14 : cellSize > 36 ? 12 : 11, fontWeight: 800, fontFamily: 'monospace', lineHeight: 1 }}>
                {String(d.number).padStart(2, '0')}
              </span>
              <span style={{ fontSize: cellSize > 42 ? 9 : 8, fontWeight: 700, color: freqColor, lineHeight: 1, marginTop: 2 }}>
                {d.frequency}x
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)' }}>Frio</span>
        <div style={{ flex: 1, maxWidth: 200, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, rgb(55,100,190), rgb(80,185,160), rgb(120,200,80), rgb(230,200,50), rgb(240,130,40), rgb(220,50,40))', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)' }}>Quente</span>
        <span style={{ fontSize: 9, color: 'var(--ml-on-surface-variant)', marginLeft: 6 }}>({minFreq}x – {maxFreq}x)</span>
      </div>

      {/* Offcanvas detail for selected number */}
      {selectedNumber && (
        <NumberDetailPanel
          number={selectedNumber}
          allData={data}
          maxFreq={maxFreq}
          minFreq={minFreq}
          onClose={() => setSelectedNumber(null)}
        />
      )}
    </div>
  )
}

function NumberDetailPanel({ number, allData, maxFreq, minFreq, onClose }: {
  number: NumberData
  allData: NumberData[]
  maxFreq: number
  minFreq: number
  onClose: () => void
}) {
  const range = maxFreq - minFreq || 1
  const intensity = (number.frequency - minFreq) / range
  const pctRank = allData.filter(d => d.frequency <= number.frequency).length / allData.length * 100

  // Classify
  const freqLabel = intensity >= 0.7 ? 'Muito quente' : intensity >= 0.4 ? 'Normal' : 'Fria'
  const freqColor = intensity >= 0.7 ? 'var(--ml-error)' : intensity >= 0.4 ? 'var(--ml-secondary)' : 'var(--ml-info)'
  const delayLabel = number.delay === 0 ? 'Saiu no último concurso' : number.delay <= 3 ? 'Recente' : number.delay <= 10 ? 'Moderado' : 'Atrasada'
  const delayColor = number.delay <= 3 ? 'var(--ml-primary)' : number.delay <= 10 ? 'var(--ml-secondary)' : 'var(--ml-error)'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200, backdropFilter: 'blur(2px)' }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 380, zIndex: 201,
        background: 'var(--ml-surface)', boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column', overflow: 'auto',
      }} className="animate-slide-up">
        {/* Header */}
        <div style={{ padding: '24px 24px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--ml-outline-variant)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: getHeatColor(intensity), color: intensity > 0.5 ? '#1a1a1a' : '#fff',
              fontSize: 22, fontWeight: 800, fontFamily: 'monospace',
              boxShadow: 'inset 0 3px 6px rgba(255,255,255,0.3), inset 0 -3px 6px rgba(0,0,0,0.2), 0 4px 12px rgba(0,0,0,0.3)',
            }}>
              {String(number.number).padStart(2, '0')}
            </div>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'var(--ml-on-surface)' }}>Dezena {String(number.number).padStart(2, '0')}</h3>
              <p style={{ fontSize: 12, color: freqColor, fontWeight: 700, marginTop: 2 }}>{freqLabel}</p>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'var(--ml-surface-high)', border: 'none', borderRadius: 8,
            width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--ml-on-surface-variant)',
          }}><X size={16} /></button>
        </div>

        {/* Stats */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <DetailCard label="Frequência total" value={`${number.frequency}x`} sub={`${pctRank.toFixed(0)}° percentil`} color="var(--ml-primary)" />
            <DetailCard label="Atraso atual" value={`${number.delay}`} sub={`concurso${number.delay !== 1 ? 's' : ''} sem sair`} color={delayColor} />
          </div>

          {/* Status */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 12 }}>Status da dezena</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <StatusRow label="Classificação" value={freqLabel} color={freqColor} />
              <StatusRow label="Situação de atraso" value={delayLabel} color={delayColor} />
              <StatusRow label="Posição no ranking" value={`#${allData.filter(d => d.frequency > number.frequency).length + 1} de ${allData.length}`} />
            </div>
          </div>

          {/* Frequency bar */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 12 }}>Frequência relativa</p>
            <div style={{ height: 12, borderRadius: 6, background: 'var(--ml-surface-high)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 6, transition: 'width 0.5s ease',
                width: `${(intensity * 100).toFixed(1)}%`,
                background: `linear-gradient(90deg, ${getHeatColor(0)}, ${getHeatColor(intensity)})`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--ml-on-surface-variant)' }}>
              <span>Mín: {minFreq}x</span>
              <span style={{ fontWeight: 700, color: 'var(--ml-on-surface)' }}>{number.frequency}x</span>
              <span>Máx: {maxFreq}x</span>
            </div>
          </div>

          {/* Tip */}
          <div style={{ background: 'color-mix(in srgb, var(--ml-info) 8%, transparent)', borderRadius: 12, padding: '12px 16px', border: '1px solid color-mix(in srgb, var(--ml-info) 15%, transparent)' }}>
            <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', lineHeight: 1.6 }}>
              {number.delay > 10
                ? `A dezena ${String(number.number).padStart(2, '0')} está atrasada há ${number.delay} concursos. Pode ser uma boa candidata para jogos baseados em atraso.`
                : intensity >= 0.7
                ? `A dezena ${String(number.number).padStart(2, '0')} é uma das mais frequentes. Apareceu ${number.frequency} vezes no histórico analisado.`
                : `A dezena ${String(number.number).padStart(2, '0')} tem frequência dentro da média. Atraso atual de ${number.delay} concurso${number.delay !== 1 ? 's' : ''}.`
              }
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

function DetailCard({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: 16, textAlign: 'center' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, margin: 0, lineHeight: 1, color: color || 'var(--ml-on-surface)' }}>{value}</p>
      <p style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)', marginTop: 4, fontWeight: 500 }}>{sub}</p>
    </div>
  )
}

function StatusRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: color || 'var(--ml-on-surface)' }}>{value}</span>
    </div>
  )
}
