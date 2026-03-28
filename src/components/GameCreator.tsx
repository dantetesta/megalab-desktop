import { useState } from 'react'
import { api } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import { cn } from '@/lib/utils'
import { Grid3X3, FileText, Save, Trash2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface Props {
  onClose: () => void
  onSaved: () => void
}

const FOOTBALL_TEAMS = [
  'ABC/RN', 'AMERICA/MG', 'AMERICA/RN', 'ATHLETICO/PR', 'ATLETICO/GO',
  'ATLETICO/MG', 'AVAI/SC', 'BAHIA/BA', 'BOTAFOGO/PB', 'BOTAFOGO/RJ',
  'BRAGANTINO/SP', 'CEARA/CE', 'CHAPECOENSE/SC', 'CORINTHIANS/SP', 'CORITIBA/PR',
  'CRB/AL', 'CRICIUMA/SC', 'CRUZEIRO/MG', 'CSA/AL', 'CUIABA/MT',
  'FIGUEIRENSE/SC', 'FLAMENGO/RJ', 'FLUMINENSE/RJ', 'FORTALEZA/CE', 'GOIAS/GO',
  'GREMIO/RS', 'GUARANI/SP', 'INTERNACIONAL/RS', 'ITUANO/SP', 'JOINVILLE/SC',
  'JUVENTUDE/RS', 'LONDRINA/PR', 'NAUTICO/PE', 'OPERARIO/PR', 'PALMEIRAS/SP',
  'PAYSANDU/PA', 'PONTE PRETA/SP', 'PORTUGUESA/SP', 'REMO/PA', 'SAMPAIO CORREA/MA',
  'SANTOS/SP', 'SAO PAULO/SP', 'SPORT/PE', 'VASCO/RJ', 'VILA NOVA/GO', 'VITORIA/BA',
]

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getGridCols(poolSize: number): number {
  if (poolSize <= 25) return 5
  if (poolSize <= 31) return 8
  if (poolSize <= 50) return 10
  if (poolSize <= 80) return 10
  return 10
}

function getCellSize(poolSize: number): number {
  if (poolSize > 50) return 32
  if (poolSize >= 25) return 36
  return 40
}

// Super Sete UI
interface SuperSeteUIProps {
  columns: number[][]
  onToggle: (col: number, num: number) => void
  onClear: () => void
}

function SuperSeteUI({ columns, onToggle, onClear }: SuperSeteUIProps) {
  const totalSelected = columns.reduce((sum, col) => sum + col.length, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Selecione de 1 a 3 numeros por coluna (7 colunas).
        </p>
        <div className="flex items-center gap-2">
          <span className={cn('text-lg font-extrabold', totalSelected >= 7 ? 'text-primary' : 'text-muted-foreground')}>
            {totalSelected}
          </span>
          <span className="text-[11px] text-muted-foreground">selecionados</span>
          {totalSelected > 0 && (
            <button onClick={onClear} className="bg-transparent border-none cursor-pointer text-destructive flex items-center gap-1 text-[11px]">
              <Trash2 size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 justify-center mb-4">
        {columns.map((colSelected, colIdx) => (
          <div key={colIdx} className="flex flex-col items-center gap-1">
            <div className="text-[11px] font-bold text-primary bg-primary/12 rounded-md px-2 py-0.5 mb-0.5">
              Col {colIdx + 1}
            </div>
            {Array.from({ length: 10 }, (_, d) => {
              const isSelected = colSelected.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => onToggle(colIdx, d)}
                  className={cn(
                    'w-[38px] h-[38px] rounded-lg border-none cursor-pointer',
                    'flex items-center justify-center text-sm font-bold font-mono transition-all duration-150',
                    isSelected
                      ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[0_2px_8px_rgba(110,219,166,0.3)] scale-105'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {d}
                </button>
              )
            })}
            <div className={cn('text-[10px] font-bold mt-0.5', colSelected.length === 0 ? 'text-muted-foreground' : 'text-primary')}>
              {colSelected.length}/3
            </div>
          </div>
        ))}
      </div>

      {totalSelected > 0 && (
        <Card className="mb-4">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Selecao por coluna</p>
            <div className="flex gap-2 flex-wrap">
              {columns.map((col, i) => (
                <div key={i} className="flex flex-col items-center gap-0.5 bg-muted rounded-lg px-2.5 py-1.5 min-w-[40px]">
                  <span className="text-[9px] text-muted-foreground font-semibold">C{i + 1}</span>
                  <span className={cn('text-[13px] font-mono font-bold', col.length > 0 ? 'text-primary' : 'text-muted-foreground')}>
                    {col.length > 0 ? col.join(',') : '-'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Number Grid
interface NumberGridProps {
  numberStart: number
  numberEnd: number
  selected: number[]
  onToggle: (n: number) => void
  label?: string
  accent?: string
}

function NumberGrid({ numberStart, numberEnd, selected, onToggle, label, accent }: NumberGridProps) {
  const totalNumbers = numberEnd - numberStart + 1
  const gridCols = getGridCols(totalNumbers)
  const cellSize = getCellSize(totalNumbers)
  const fontSize = totalNumbers > 60 ? 10 : totalNumbers > 30 ? 12 : 13

  return (
    <div>
      {label && (
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
      )}
      <div
        className="grid justify-center mb-3"
        style={{
          gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
          gap: totalNumbers > 60 ? 3 : 4,
        }}
      >
        {Array.from({ length: totalNumbers }, (_, i) => numberStart + i).map(num => {
          const isSelected = selected.includes(num)
          return (
            <button
              key={num}
              onClick={() => onToggle(num)}
              className={cn(
                'rounded-full border-none cursor-pointer flex items-center justify-center font-bold font-mono transition-all duration-150',
                isSelected
                  ? 'text-primary-foreground shadow-[0_2px_8px_rgba(110,219,166,0.25)] scale-[1.08]'
                  : 'bg-muted text-muted-foreground',
              )}
              style={{
                width: cellSize,
                height: cellSize,
                fontSize,
                background: isSelected ? (accent || 'linear-gradient(145deg, var(--primary), color-mix(in srgb, var(--primary) 70%, transparent))') : undefined,
              }}
            >
              {String(num).padStart(2, '0')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Main Component
export default function GameCreator({ onClose, onSaved }: Props) {
  const { showToast } = useAppStore()
  const { activeGame, enabledGames } = useLotteryStore()
  const config = enabledGames.find(g => g.game_type === activeGame)

  const poolSize = config?.numbers_pool_size ?? 60
  const minPick = config?.min_pick_count ?? 6
  const maxPick = config?.max_pick_count ?? 20
  const startsAtZero = poolSize === 100
  const numberStart = startsAtZero ? 0 : 1
  const numberEnd = startsAtZero ? poolSize - 1 : poolSize

  const isSuperSete = activeGame === 'supersete'
  const isMilionaria = activeGame === 'milionaria' || (config?.has_trevos ?? false)
  const hasTimCoracao = config?.has_time_coracao ?? false
  const hasMesSorte = config?.has_mes_sorte ?? false

  const trevoPoolSize = config?.trevo_pool_size ?? 6
  const trevoMin = 2
  const trevoMax = config?.trevo_pick_count ?? 6

  const isFixedPick = minPick === maxPick
  const pickLabel = isFixedPick ? `Exatamente ${minPick}` : `${minPick}-${maxPick}`

  const [tab, setTab] = useState<'visual' | 'bulk'>('visual')
  const [selected, setSelected] = useState<number[]>([])
  const [gameName, setGameName] = useState('')
  const [surpresinhaPick, setSurpresinhaPick] = useState(config?.default_pick_count ?? minPick)
  const [superSeteColumns, setSuperSeteColumns] = useState<number[][]>(Array.from({ length: 7 }, () => []))
  const [selectedTrevos, setSelectedTrevos] = useState<number[]>([])
  const [timeCoracao, setTimeCoracao] = useState<string>('')
  const [mesSorte, setMesSorte] = useState<string>('')
  const [bulkText, setBulkText] = useState('')

  const toggleNumber = (n: number) => {
    setSelected(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))
  }

  const toggleTrevo = (n: number) => {
    setSelectedTrevos(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b))
  }

  const toggleSuperSete = (col: number, digit: number) => {
    setSuperSeteColumns(prev => {
      const next = prev.map(c => [...c])
      if (next[col].includes(digit)) {
        next[col] = next[col].filter(d => d !== digit)
      } else if (next[col].length < 3) {
        next[col] = [...next[col], digit].sort((a, b) => a - b)
      }
      return next
    })
  }

  const clearSuperSete = () => setSuperSeteColumns(Array.from({ length: 7 }, () => []))

  const clearAll = () => {
    setSelected([])
    setSelectedTrevos([])
    clearSuperSete()
    setTimeCoracao('')
    setMesSorte('')
  }

  const handleSurpresinha = () => {
    if (isSuperSete) {
      setSuperSeteColumns(Array.from({ length: 7 }, () => [Math.floor(Math.random() * 10)]))
      return
    }
    const pool = Array.from({ length: numberEnd - numberStart + 1 }, (_, i) => numberStart + i)
    const shuffled = pool.sort(() => Math.random() - 0.5)
    setSelected(shuffled.slice(0, surpresinhaPick).sort((a, b) => a - b))

    if (isMilionaria) {
      const trevoPool = Array.from({ length: trevoPoolSize }, (_, i) => i + 1)
      setSelectedTrevos(trevoPool.sort(() => Math.random() - 0.5).slice(0, trevoMin).sort((a, b) => a - b))
    }
    if (hasTimCoracao) {
      setTimeCoracao(FOOTBALL_TEAMS[Math.floor(Math.random() * FOOTBALL_TEAMS.length)])
    }
    if (hasMesSorte) {
      setMesSorte(MONTHS[Math.floor(Math.random() * MONTHS.length)])
    }
  }

  const isSuperSeteValid = () => superSeteColumns.every(col => col.length >= 1)
  const isMainValid = () => {
    if (isSuperSete) return isSuperSeteValid()
    if (isFixedPick) return selected.length === minPick
    return selected.length >= minPick && selected.length <= maxPick
  }
  const isTrevoValid = () => !isMilionaria || (selectedTrevos.length >= trevoMin && selectedTrevos.length <= trevoMax)
  const isTimeValid = () => !hasTimCoracao || timeCoracao.trim() !== ''
  const isMesValid = () => !hasMesSorte || mesSorte.trim() !== ''
  const isFormValid = isMainValid() && isTrevoValid() && isTimeValid() && isMesValid()

  const saveVisualGame = async () => {
    if (!isMainValid()) {
      if (isSuperSete) showToast('Selecione ao menos 1 numero em cada coluna.', 'error')
      else if (isFixedPick) showToast(`Selecione exatamente ${minPick} dezenas.`, 'error')
      else showToast(`Selecione de ${minPick} a ${maxPick} dezenas.`, 'error')
      return
    }
    if (!isTrevoValid()) { showToast(`Selecione de ${trevoMin} a ${trevoMax} trevos.`, 'error'); return }
    if (!isTimeValid()) { showToast('Selecione o Time do Coracao.', 'error'); return }
    if (!isMesValid()) { showToast('Selecione o Mes da Sorte.', 'error'); return }

    try {
      let numbers: number[]
      let strategyLabel: string
      let notes: string | null = null

      if (isSuperSete) {
        numbers = superSeteColumns.map(col => col[0] ?? 0)
        const colStr = superSeteColumns.map((col, i) => `C${i + 1}:[${col.join(',')}]`).join(' ')
        strategyLabel = `Manual Super Sete`
        notes = colStr
      } else {
        numbers = selected
        strategyLabel = `Manual (${selected.length} dez.)`
        const extras: string[] = []
        if (isMilionaria && selectedTrevos.length > 0) extras.push(`Trevos: ${selectedTrevos.map(t => String(t).padStart(2, '0')).join(', ')}`)
        if (hasTimCoracao && timeCoracao) extras.push(`Time do Coracao: ${timeCoracao}`)
        if (hasMesSorte && mesSorte) extras.push(`Mes da Sorte: ${mesSorte}`)
        if (extras.length > 0) notes = extras.join(' | ')
      }

      await api.saveGame({ name: gameName || null, numbers, strategy_id: 'manual', strategy_label: strategyLabel, notes, game_type: activeGame })
      showToast(`Jogo salvo com sucesso!`, 'success')
      clearAll()
      setGameName('')
      onSaved()
    } catch (e: any) {
      showToast(e?.toString() || 'Erro ao salvar', 'error')
    }
  }

  const parseBulkGames = (): number[][] => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    const games: number[][] = []
    for (const line of lines) {
      const nums = line.replace(/[;\-\s]+/g, ',').split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n >= numberStart && n <= numberEnd)
      const unique = [...new Set(nums)].sort((a, b) => a - b)
      if (unique.length >= minPick) games.push(unique)
    }
    return games
  }

  const bulkParsed = tab === 'bulk' ? parseBulkGames() : []

  const saveBulkGames = async () => {
    if (bulkParsed.length === 0) { showToast(`Nenhum jogo valido. Cada linha precisa ter pelo menos ${minPick} numeros de ${numberStart} a ${numberEnd}.`, 'error'); return }
    try {
      for (const nums of bulkParsed) {
        await api.saveGame({ numbers: nums, strategy_id: 'manual', strategy_label: `Manual (${nums.length} dez.)`, game_type: activeGame })
      }
      showToast(`${bulkParsed.length} jogo${bulkParsed.length > 1 ? 's' : ''} importado${bulkParsed.length > 1 ? 's' : ''}!`, 'success')
      setBulkText('')
      onSaved()
    } catch (e: any) {
      showToast(e?.toString() || 'Erro', 'error')
    }
  }

  const hasSpecialFields = isSuperSete || isMilionaria || hasTimCoracao || hasMesSorte

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[min(95vw,1000px)] max-h-[90vh] overflow-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            Criar jogo personalizado
            {config && <span className="text-xs font-medium text-muted-foreground">({config.display_name})</span>}
          </DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="px-6 pt-4 flex gap-1.5">
          <Button
            variant={tab === 'visual' ? 'default' : 'secondary'}
            className="gap-2"
            onClick={() => setTab('visual')}
          >
            <Grid3X3 size={15} /> Volante visual
          </Button>
          {!hasSpecialFields && (
            <Button
              variant={tab === 'bulk' ? 'default' : 'secondary'}
              className="gap-2"
              onClick={() => setTab('bulk')}
            >
              <FileText size={15} /> Importar em massa
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-6">
          {/* Visual Tab */}
          {tab === 'visual' && (
            <div className="flex gap-6">
              {/* LEFT - Number grid */}
              <div className="flex-[0_0_60%] min-w-0">
                {isSuperSete ? (
                  <SuperSeteUI columns={superSeteColumns} onToggle={toggleSuperSete} onClear={clearSuperSete} />
                ) : (
                  <>
                    <div className="flex justify-between items-center mb-3">
                      <p className="text-xs text-muted-foreground">
                        {isFixedPick ? `Selecione exatamente ${minPick} dezenas.` : `Selecione de ${minPick} a ${maxPick} dezenas.`}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xl font-extrabold', isMainValid() ? 'text-primary' : 'text-muted-foreground')}>
                          {selected.length}
                        </span>
                        <span className="text-[11px] text-muted-foreground">/ {pickLabel}</span>
                        {selected.length > 0 && (
                          <button onClick={() => setSelected([])} className="bg-transparent border-none cursor-pointer text-destructive flex items-center gap-1 text-[11px]">
                            <Trash2 size={12} /> Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    <NumberGrid numberStart={numberStart} numberEnd={numberEnd} selected={selected} onToggle={toggleNumber} />

                    {/* Trevos */}
                    {isMilionaria && (
                      <Card className="mb-3.5 mt-1">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center mb-2.5">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Trevos (01-{String(trevoPoolSize).padStart(2, '0')})</p>
                            <span className={cn('text-[13px] font-extrabold', isTrevoValid() ? 'text-primary' : 'text-muted-foreground')}>
                              {selectedTrevos.length} / {trevoMin}-{trevoMax}
                            </span>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            {Array.from({ length: trevoPoolSize }, (_, i) => i + 1).map(t => {
                              const isSel = selectedTrevos.includes(t)
                              return (
                                <button
                                  key={t}
                                  onClick={() => toggleTrevo(t)}
                                  className={cn(
                                    'w-11 h-11 rounded-full border-none cursor-pointer flex items-center justify-center',
                                    'text-sm font-extrabold font-mono transition-all duration-150',
                                    isSel ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-[0_2px_10px_rgba(245,158,11,0.4)] scale-110' : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {String(t).padStart(2, '0')}
                                </button>
                              )
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Time do Coracao */}
                    {hasTimCoracao && (
                      <div className="mb-3.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Time do Coracao</label>
                        <select
                          value={timeCoracao}
                          onChange={e => setTimeCoracao(e.target.value)}
                          className={cn(
                            'w-full px-3.5 py-2.5 rounded-[10px] text-sm bg-muted text-foreground outline-none cursor-pointer transition-colors border-2',
                            timeCoracao ? 'border-primary' : 'border-muted',
                          )}
                        >
                          <option value="">-- Selecione o time --</option>
                          {FOOTBALL_TEAMS.map(team => <option key={team} value={team}>{team}</option>)}
                        </select>
                      </div>
                    )}

                    {/* Mes da Sorte */}
                    {hasMesSorte && (
                      <div className="mb-3.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">Mes da Sorte</label>
                        <select
                          value={mesSorte}
                          onChange={e => setMesSorte(e.target.value)}
                          className={cn(
                            'w-full px-3.5 py-2.5 rounded-[10px] text-sm bg-muted text-foreground outline-none cursor-pointer transition-colors border-2',
                            mesSorte ? 'border-primary' : 'border-muted',
                          )}
                        >
                          <option value="">-- Selecione o mes --</option>
                          {MONTHS.map(mes => <option key={mes} value={mes}>{mes}</option>)}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT - Name, Surpresinha, Preview, Save */}
              <div className="flex-[0_0_38%] min-w-0 flex flex-col gap-3.5">
                <Input
                  type="text"
                  placeholder="Nome do jogo (opcional)"
                  value={gameName}
                  onChange={e => setGameName(e.target.value)}
                  className="w-full"
                />

                {/* Surpresinha */}
                <Card>
                  <CardContent className="p-3.5 flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground">Surpresinha</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Sorteia aleatoriamente</p>
                    </div>
                    {!isSuperSete && (
                      <select
                        value={surpresinhaPick}
                        onChange={e => setSurpresinhaPick(Number(e.target.value))}
                        className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-muted text-foreground border border-border outline-none cursor-pointer max-w-[80px]"
                      >
                        {Array.from({ length: maxPick - minPick + 1 }, (_, i) => minPick + i).map(n => (
                          <option key={n} value={n}>{n} Num</option>
                        ))}
                      </select>
                    )}
                    <button
                      onClick={handleSurpresinha}
                      title="Gerar Surpresinha"
                      className="w-9 h-9 rounded-full border-none cursor-pointer flex items-center justify-center bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-base shadow-[0_2px_8px_rgba(110,219,166,0.3)] transition-transform hover:scale-110 shrink-0"
                    >
                      🎁
                    </button>
                  </CardContent>
                </Card>

                {/* Preview */}
                {!isSuperSete && selected.length > 0 && (
                  <Card>
                    <CardContent className="px-3.5 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Suas dezenas</p>
                      <p className="font-mono text-sm font-bold text-primary tracking-wide leading-relaxed break-words">
                        {selected.map(n => String(n).padStart(2, '0')).join(' - ')}
                      </p>
                      {isMilionaria && selectedTrevos.length > 0 && (
                        <p className="font-mono text-xs font-semibold text-amber-500 mt-1.5">
                          Trevos: {selectedTrevos.map(t => String(t).padStart(2, '0')).join(' - ')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                )}

                <div className="flex-1" />

                <Button onClick={saveVisualGame} disabled={!isFormValid} className="w-full justify-center gap-2">
                  <Save size={16} />
                  {isSuperSete ? `Salvar jogo Super Sete` : `Salvar jogo (${selected.length} dezenas)`}
                </Button>
              </div>
            </div>
          )}

          {/* Bulk Tab */}
          {tab === 'bulk' && (
            <div>
              <p className="text-[13px] text-muted-foreground mb-3 leading-relaxed">
                Cole seus jogos abaixo. <strong>Uma linha por jogo</strong>, numeros separados por virgula.
                Aceita de {minPick} a {maxPick} dezenas por linha.
                Numeros fora de {numberStart}-{numberEnd} sao ignorados.
              </p>

              <Card className="mb-3">
                <CardContent className="p-3.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Exemplo:</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    04, 15, 22, 33, 41, 58<br />
                    07, 11, 19, 28, 35, 47<br />
                    02, 13, 24, 36, 45, 53, 60
                  </p>
                </CardContent>
              </Card>

              <Textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Cole seus jogos aqui, um por linha..."
                className="min-h-[160px] resize-y font-mono text-sm leading-[1.8]"
              />

              {bulkText.trim() && (
                <Card className="mt-3 mb-3">
                  <CardContent className="p-4">
                    <p className={cn('text-[11px] font-bold mb-2', bulkParsed.length > 0 ? 'text-primary' : 'text-destructive')}>
                      {bulkParsed.length > 0
                        ? `${bulkParsed.length} jogo${bulkParsed.length > 1 ? 's' : ''} reconhecido${bulkParsed.length > 1 ? 's' : ''}:`
                        : `Nenhum jogo valido. Cada linha precisa de pelo menos ${minPick} numeros.`}
                    </p>
                    {bulkParsed.slice(0, 10).map((nums, i) => (
                      <div key={i} className="flex items-center gap-2 py-1">
                        <span className="text-[11px] font-bold text-muted-foreground font-mono w-6">#{i + 1}</span>
                        <span className="text-[13px] font-mono font-semibold text-foreground">{nums.map(n => String(n).padStart(2, '0')).join(', ')}</span>
                        <span className="text-[10px] text-muted-foreground">({nums.length} dez.)</span>
                      </div>
                    ))}
                    {bulkParsed.length > 10 && (
                      <p className="text-[11px] text-muted-foreground mt-1">...e mais {bulkParsed.length - 10} jogos</p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button onClick={saveBulkGames} disabled={bulkParsed.length === 0} className="w-full justify-center gap-2 mt-2">
                <Plus size={16} /> Importar {bulkParsed.length} jogo{bulkParsed.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
