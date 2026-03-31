import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'


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
  const cellSize = data.length <= 10 ? 52 : data.length <= 31 ? 48 : data.length <= 60 ? 46 : 38

  return (
    <div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: data.length > 60 ? 5 : 6,
        }}
      >
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
              className={cn(
                'rounded-full flex flex-col items-center justify-center cursor-pointer transition-all duration-200 relative',
                isHL && 'z-[2] scale-[1.12]',
              )}
              style={{
                width: cellSize,
                height: cellSize,
                background: bg,
                color: textColor,
                boxShadow: isHL
                  ? '0 0 0 3px #fff, 0 0 0 5px var(--primary), 0 0 16px rgba(110,219,166,0.5)'
                  : '0 2px 5px rgba(0,0,0,0.25), inset 0 2px 3px rgba(255,255,255,0.2), inset 0 -2px 3px rgba(0,0,0,0.1)',
              }}
            >
              <span
                className="font-extrabold font-mono leading-none"
                style={{ fontSize: cellSize > 42 ? 14 : cellSize > 36 ? 12 : 11 }}
              >
                {String(d.number).padStart(2, '0')}
              </span>
              <span
                className="font-bold leading-none mt-0.5"
                style={{ fontSize: cellSize > 42 ? 9 : 8, color: freqColor }}
              >
                {d.frequency}x
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2.5 mt-3.5">
        <span className="text-[10px] font-semibold text-muted-foreground">Frio</span>
        <div className="flex-1 max-w-[200px] h-2.5 rounded-full shadow-sm bg-[linear-gradient(90deg,rgb(55,100,190),rgb(80,185,160),rgb(120,200,80),rgb(230,200,50),rgb(240,130,40),rgb(220,50,40))]" />
        <span className="text-[10px] font-semibold text-muted-foreground">Quente</span>
        <span className="text-[9px] text-muted-foreground ml-1.5">({minFreq}x - {maxFreq}x)</span>
      </div>

      {/* Offcanvas detail */}
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

  const freqLabel = intensity >= 0.7 ? 'Muito quente' : intensity >= 0.4 ? 'Normal' : 'Fria'
  const freqColor = intensity >= 0.7 ? 'text-destructive' : intensity >= 0.4 ? 'text-accent-gold' : 'text-blue-400'
  const delayLabel = number.delay === 0 ? 'Saiu no ultimo concurso' : number.delay <= 3 ? 'Recente' : number.delay <= 10 ? 'Moderado' : 'Atrasada'
  const delayColorStyle = number.delay <= 3 ? 'var(--primary)' : number.delay <= 10 ? 'var(--accent-gold)' : 'var(--destructive)'

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-black/40 z-[200] backdrop-blur-sm" />
      {/* Panel */}
      <div className="animate-slide-up fixed top-0 right-0 bottom-0 w-[380px] z-[201] bg-background shadow-[-8px_0_32px_rgba(0,0,0,0.3)] flex flex-col overflow-auto">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-[22px] font-extrabold font-mono shadow-[inset_0_3px_6px_rgba(255,255,255,0.3),inset_0_-3px_6px_rgba(0,0,0,0.2),0_4px_12px_rgba(0,0,0,0.3)]"
              style={{
                background: getHeatColor(intensity),
                color: intensity > 0.5 ? '#1a1a1a' : '#fff',
              }}
            >
              {String(number.number).padStart(2, '0')}
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-foreground">Dezena {String(number.number).padStart(2, '0')}</h3>
              <p className={cn('text-xs font-bold mt-0.5', freqColor)}>{freqLabel}</p>
            </div>
          </div>
          <Button variant="secondary" size="icon" onClick={onClose} className="w-8 h-8">
            <X size={16} />
          </Button>
        </div>

        {/* Stats */}
        <div className="p-6 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2.5">
            <DetailCard label="Frequencia total" value={`${number.frequency}x`} sub={`${pctRank.toFixed(0)} percentil`} color="var(--primary)" />
            <DetailCard label="Atraso atual" value={`${number.delay}`} sub={`concurso${number.delay !== 1 ? 's' : ''} sem sair`} color={delayColorStyle} />
          </div>

          {/* Status */}
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Status da dezena</p>
              <div className="flex flex-col gap-2.5">
                <StatusRow label="Classificacao" value={freqLabel} color={intensity >= 0.7 ? 'var(--destructive)' : intensity >= 0.4 ? 'var(--accent-gold)' : '#60a5fa'} />
                <StatusRow label="Situacao de atraso" value={delayLabel} color={delayColorStyle} />
                <StatusRow label="Posicao no ranking" value={`#${allData.filter(d => d.frequency > number.frequency).length + 1} de ${allData.length}`} />
              </div>
            </CardContent>
          </Card>

          {/* Frequency bar */}
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Frequencia relativa</p>
              <div className="h-3 rounded-md bg-muted overflow-hidden">
                <div
                  className="h-full rounded-md transition-all duration-500"
                  style={{ width: `${(intensity * 100).toFixed(1)}%`, background: `linear-gradient(90deg, ${getHeatColor(0)}, ${getHeatColor(intensity)})` }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                <span>Min: {minFreq}x</span>
                <span className="font-bold text-foreground">{number.frequency}x</span>
                <span>Max: {maxFreq}x</span>
              </div>
            </CardContent>
          </Card>

          {/* Tip */}
          <div className="bg-blue-500/8 rounded-xl px-4 py-3 border border-blue-500/15">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {number.delay > 10
                ? `A dezena ${String(number.number).padStart(2, '0')} esta atrasada ha ${number.delay} concursos. Pode ser uma boa candidata para jogos baseados em atraso.`
                : intensity >= 0.7
                ? `A dezena ${String(number.number).padStart(2, '0')} e uma das mais frequentes. Apareceu ${number.frequency} vezes no historico analisado.`
                : `A dezena ${String(number.number).padStart(2, '0')} tem frequencia dentro da media. Atraso atual de ${number.delay} concurso${number.delay !== 1 ? 's' : ''}.`
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
    <Card>
      <CardContent className="p-4 text-center">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">{label}</p>
        <p className={cn('text-[26px] font-extrabold leading-none', !color && 'text-foreground')} style={color ? { color } : undefined}>{value}</p>
        <p className="text-[10px] text-muted-foreground mt-1 font-medium">{sub}</p>
      </CardContent>
    </Card>
  )
}

function StatusRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn('text-[13px] font-bold', !color && 'text-foreground')} style={color ? { color } : undefined}>{value}</span>
    </div>
  )
}
