import { useState } from 'react'
import { api } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useLotteryStore } from '../stores/lotteryStore'
import { X, Grid3X3, FileText, Save, Trash2, Plus } from 'lucide-react'

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
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Derive grid columns based on pool size (wider layout)
function getGridCols(poolSize: number): number {
  if (poolSize <= 25) return 5
  if (poolSize <= 31) return 8 // Dia de Sorte: 31 numbers
  if (poolSize <= 50) return 10 // Dupla Sena / +Milionária
  if (poolSize <= 80) return 10
  return 10 // 100
}

// Cell size: smaller for larger pools
function getCellSize(poolSize: number): number {
  if (poolSize > 50) return 32
  if (poolSize >= 25) return 36
  return 40
}

// ── Super Sete UI ────────────────────────────────────────────────────────────
interface SuperSeteUIProps {
  columns: number[][] // 7 columns, each containing selected numbers (0-9)
  onToggle: (col: number, num: number) => void
  onClear: () => void
}

function SuperSeteUI({ columns, onToggle, onClear }: SuperSeteUIProps) {
  const totalSelected = columns.reduce((sum, col) => sum + col.length, 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)', lineHeight: 1.5 }}>
          Selecione de 1 a 3 números por coluna (7 colunas).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: totalSelected >= 7 ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)' }}>
            {totalSelected}
          </span>
          <span style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)' }}>selecionados</span>
          {totalSelected > 0 && (
            <button onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ml-error)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontFamily: 'inherit' }}>
              <Trash2 size={12} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* 7 column grid */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
        {columns.map((colSelected, colIdx) => (
          <div key={colIdx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {/* Column label */}
            <div style={{
              fontSize: 11, fontWeight: 700, color: 'var(--ml-primary)',
              background: 'color-mix(in srgb, var(--ml-primary) 12%, transparent)',
              borderRadius: 6, padding: '3px 8px', marginBottom: 2,
            }}>
              Col {colIdx + 1}
            </div>
            {/* Digits 0-9 */}
            {Array.from({ length: 10 }, (_, d) => {
              const isSelected = colSelected.includes(d)
              return (
                <button
                  key={d}
                  onClick={() => onToggle(colIdx, d)}
                  style={{
                    width: 38, height: 38, borderRadius: 8, border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
                    transition: 'all 0.15s ease',
                    background: isSelected
                      ? 'linear-gradient(145deg, var(--ml-primary), var(--ml-primary-container))'
                      : 'var(--ml-surface-high)',
                    color: isSelected ? 'var(--ml-on-primary)' : 'var(--ml-on-surface-variant)',
                    boxShadow: isSelected ? '0 2px 8px rgba(110,219,166,0.3)' : 'none',
                    transform: isSelected ? 'scale(1.05)' : 'scale(1)',
                  }}
                >
                  {d}
                </button>
              )
            })}
            {/* Selection count indicator */}
            <div style={{
              fontSize: 10, fontWeight: 700, marginTop: 2,
              color: colSelected.length === 0 ? 'var(--ml-on-surface-variant)' : 'var(--ml-primary)',
            }}>
              {colSelected.length}/3
            </div>
          </div>
        ))}
      </div>

      {/* Preview */}
      {totalSelected > 0 && (
        <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>
            Seleção por coluna
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {columns.map((col, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'var(--ml-surface-high)', borderRadius: 8, padding: '6px 10px', minWidth: 40,
              }}>
                <span style={{ fontSize: 9, color: 'var(--ml-on-surface-variant)', fontWeight: 600 }}>C{i + 1}</span>
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: col.length > 0 ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)' }}>
                  {col.length > 0 ? col.join(',') : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Number Grid ──────────────────────────────────────────────────────────────
interface NumberGridProps {
  numberStart: number
  numberEnd: number
  selected: number[]
  onToggle: (n: number) => void
  label?: string
  accent?: string // CSS color override for selected
}

function NumberGrid({ numberStart, numberEnd, selected, onToggle, label, accent }: NumberGridProps) {
  const totalNumbers = numberEnd - numberStart + 1
  const gridCols = getGridCols(totalNumbers)
  const cellSize = getCellSize(totalNumbers)
  const fontSize = totalNumbers > 60 ? 10 : totalNumbers > 30 ? 12 : 13

  return (
    <div>
      {label && (
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>
          {label}
        </p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
        gap: totalNumbers > 60 ? 3 : 4,
        justifyContent: 'center',
        marginBottom: 12,
      }}>
        {Array.from({ length: totalNumbers }, (_, i) => numberStart + i).map(num => {
          const isSelected = selected.includes(num)
          return (
            <button
              key={num}
              onClick={() => onToggle(num)}
              style={{
                width: cellSize, height: cellSize, borderRadius: '50%', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize, fontWeight: 700, fontFamily: 'monospace',
                transition: 'all 0.12s ease',
                background: isSelected
                  ? (accent ? accent : 'linear-gradient(145deg, var(--ml-primary), var(--ml-primary-container))')
                  : 'var(--ml-surface-high)',
                color: isSelected ? 'var(--ml-on-primary)' : 'var(--ml-on-surface-variant)',
                boxShadow: isSelected ? '0 2px 8px rgba(110,219,166,0.25)' : 'none',
                transform: isSelected ? 'scale(1.08)' : 'scale(1)',
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

// ── Main Component ───────────────────────────────────────────────────────────
export default function GameCreator({ onClose, onSaved }: Props) {
  const { showToast } = useAppStore()
  const { activeGame, enabledGames } = useLotteryStore()
  const config = enabledGames.find(g => g.game_type === activeGame)

  const poolSize = config?.numbers_pool_size ?? 60
  const minPick = config?.min_pick_count ?? 6
  const maxPick = config?.max_pick_count ?? 20
  const startsAtZero = poolSize === 100 // Lotomania: 00-99
  const numberStart = startsAtZero ? 0 : 1
  const numberEnd = startsAtZero ? poolSize - 1 : poolSize

  const isSuperSete = activeGame === 'supersete'
  const isMilionaria = activeGame === 'milionaria' || (config?.has_trevos ?? false)
  const hasTimCoracao = config?.has_time_coracao ?? false
  const hasMesSorte = config?.has_mes_sorte ?? false

  const trevoPoolSize = config?.trevo_pool_size ?? 6
  const trevoMin = 2
  const trevoMax = config?.trevo_pick_count ?? 6

  // Lotomania: fixed 50
  const isFixedPick = minPick === maxPick
  const pickLabel = isFixedPick ? `Exatamente ${minPick}` : `${minPick}-${maxPick}`

  const [tab, setTab] = useState<'visual' | 'bulk'>('visual')

  // Visual mode state
  const [selected, setSelected] = useState<number[]>([])
  const [gameName, setGameName] = useState('')

  // Surpresinha state
  const [surpresinhaPick, setSurpresinhaPick] = useState(config?.default_pick_count ?? minPick)

  // Super Sete: 7 columns, each an array of selected digits
  const [superSeteColumns, setSuperSeteColumns] = useState<number[][]>(
    Array.from({ length: 7 }, () => [])
  )

  // +Milionária trevos
  const [selectedTrevos, setSelectedTrevos] = useState<number[]>([])

  // Timemania: Time do Coração
  const [timeCoracao, setTimeCoracao] = useState<string>('')

  // Dia de Sorte: Mês da Sorte
  const [mesSorte, setMesSorte] = useState<string>('')

  // Bulk mode
  const [bulkText, setBulkText] = useState('')

  // ── Helpers ────────────────────────────────────────────────────────────────
  const toggleNumber = (n: number) => {
    setSelected(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b)
    )
  }

  const toggleTrevo = (n: number) => {
    setSelectedTrevos(prev =>
      prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n].sort((a, b) => a - b)
    )
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

  // ── Surpresinha ──────────────────────────────────────────────────────────
  const handleSurpresinha = () => {
    if (isSuperSete) {
      // Fill each column with a random digit 0-9
      setSuperSeteColumns(Array.from({ length: 7 }, () => [Math.floor(Math.random() * 10)]))
      return
    }
    const pool = Array.from({ length: numberEnd - numberStart + 1 }, (_, i) => numberStart + i)
    const shuffled = pool.sort(() => Math.random() - 0.5)
    setSelected(shuffled.slice(0, surpresinhaPick).sort((a, b) => a - b))

    // Special fields
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

  // ── Validation ─────────────────────────────────────────────────────────────
  const isSuperSeteValid = () => {
    return superSeteColumns.every(col => col.length >= 1) // at least 1 per column
  }

  const isMainValid = () => {
    if (isSuperSete) return isSuperSeteValid()
    if (isFixedPick) return selected.length === minPick
    return selected.length >= minPick && selected.length <= maxPick
  }

  const isTrevoValid = () => {
    if (!isMilionaria) return true
    return selectedTrevos.length >= trevoMin && selectedTrevos.length <= trevoMax
  }

  const isTimeValid = () => {
    if (!hasTimCoracao) return true
    return timeCoracao.trim() !== ''
  }

  const isMesValid = () => {
    if (!hasMesSorte) return true
    return mesSorte.trim() !== ''
  }

  const isFormValid = isMainValid() && isTrevoValid() && isTimeValid() && isMesValid()

  // ── Save Visual ────────────────────────────────────────────────────────────
  const saveVisualGame = async () => {
    if (!isMainValid()) {
      if (isSuperSete) {
        showToast('Selecione ao menos 1 número em cada coluna.', 'error')
      } else if (isFixedPick) {
        showToast(`Selecione exatamente ${minPick} dezenas.`, 'error')
      } else {
        showToast(`Selecione de ${minPick} a ${maxPick} dezenas.`, 'error')
      }
      return
    }
    if (!isTrevoValid()) {
      showToast(`Selecione de ${trevoMin} a ${trevoMax} trevos.`, 'error')
      return
    }
    if (!isTimeValid()) {
      showToast('Selecione o Time do Coração.', 'error')
      return
    }
    if (!isMesValid()) {
      showToast('Selecione o Mês da Sorte.', 'error')
      return
    }

    try {
      let numbers: number[]
      let strategyLabel: string
      let notes: string | null = null

      if (isSuperSete) {
        // Flatten: encode as column data — store all digits per col
        // numbers[] = col0_digit, col1_digit... (first of each col for compatibility; real data in notes)
        numbers = superSeteColumns.map(col => col[0] ?? 0)
        const colStr = superSeteColumns.map((col, i) => `C${i + 1}:[${col.join(',')}]`).join(' ')
        strategyLabel = `Manual Super Sete`
        notes = colStr
      } else {
        numbers = selected
        strategyLabel = `Manual (${selected.length} dez.)`
        const extras: string[] = []
        if (isMilionaria && selectedTrevos.length > 0) {
          extras.push(`Trevos: ${selectedTrevos.map(t => String(t).padStart(2, '0')).join(', ')}`)
        }
        if (hasTimCoracao && timeCoracao) {
          extras.push(`Time do Coração: ${timeCoracao}`)
        }
        if (hasMesSorte && mesSorte) {
          extras.push(`Mês da Sorte: ${mesSorte}`)
        }
        if (extras.length > 0) notes = extras.join(' | ')
      }

      await api.saveGame({
        name: gameName || null,
        numbers,
        strategy_id: 'manual',
        strategy_label: strategyLabel,
        notes,
        game_type: activeGame,
      })
      showToast(`Jogo salvo com sucesso!`, 'success')
      clearAll()
      setGameName('')
      onSaved()
    } catch (e: any) {
      showToast(e?.toString() || 'Erro ao salvar', 'error')
    }
  }

  // ── Bulk ───────────────────────────────────────────────────────────────────
  const parseBulkGames = (): number[][] => {
    const lines = bulkText.trim().split('\n').filter(l => l.trim())
    const games: number[][] = []
    for (const line of lines) {
      const nums = line.replace(/[;\-\s]+/g, ',').split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= numberStart && n <= numberEnd)
      const unique = [...new Set(nums)].sort((a, b) => a - b)
      if (unique.length >= minPick) {
        games.push(unique)
      }
    }
    return games
  }

  const bulkParsed = tab === 'bulk' ? parseBulkGames() : []

  const saveBulkGames = async () => {
    if (bulkParsed.length === 0) {
      showToast(`Nenhum jogo válido. Cada linha precisa ter pelo menos ${minPick} números de ${numberStart} a ${numberEnd}.`, 'error')
      return
    }
    try {
      for (const nums of bulkParsed) {
        await api.saveGame({
          numbers: nums,
          strategy_id: 'manual',
          strategy_label: `Manual (${nums.length} dez.)`,
          game_type: activeGame,
        })
      }
      showToast(`${bulkParsed.length} jogo${bulkParsed.length > 1 ? 's' : ''} importado${bulkParsed.length > 1 ? 's' : ''}!`, 'success')
      setBulkText('')
      onSaved()
    } catch (e: any) {
      showToast(e?.toString() || 'Erro', 'error')
    }
  }

  // ── Modal width ────────────────────────────────────────────────────────────
  const modalWidth = 'min(95vw, 1000px)'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: modalWidth, maxHeight: 'min(90vh, auto)',
        background: 'var(--ml-surface-low)', borderRadius: 20, padding: 0,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }} className="animate-scale-in">

        {/* Header */}
        <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ml-on-surface)' }}>
            Criar jogo personalizado
            {config && (
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ml-on-surface-variant)', marginLeft: 8 }}>
                ({config.display_name})
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'var(--ml-surface-high)', border: 'none', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--ml-on-surface-variant)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tabs - hide bulk import for lotteries with special fields */}
        {(() => {
          const hasSpecialFields = isSuperSete || isMilionaria || hasTimCoracao || hasMesSorte
          return (
            <div style={{ padding: '16px 24px 0', display: 'flex', gap: 6 }}>
              <button
                onClick={() => setTab('visual')}
                style={{
                  padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', gap: 8, minHeight: 42,
                  background: tab === 'visual' ? 'color-mix(in srgb, var(--ml-primary) 15%, transparent)' : 'var(--ml-surface-high)',
                  color: tab === 'visual' ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
                }}
              >
                <Grid3X3 size={15} /> Volante visual
              </button>
              {!hasSpecialFields && (
                <button
                  onClick={() => setTab('bulk')}
                  style={{
                    padding: '10px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 8, minHeight: 42,
                    background: tab === 'bulk' ? 'color-mix(in srgb, var(--ml-primary) 15%, transparent)' : 'var(--ml-surface-high)',
                    color: tab === 'bulk' ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
                  }}
                >
                  <FileText size={15} /> Importar em massa
                </button>
              )}
            </div>
          )
        })()}

        {/* Content */}
        <div style={{ padding: '20px 24px 24px' }}>

          {/* ── VISUAL TAB ──────────────────────────────────────────── */}
          {tab === 'visual' && (
            <div style={{ display: 'flex', gap: 24 }}>
              {/* LEFT COLUMN (60%) — Number grid + special fields */}
              <div style={{ flex: '0 0 60%', minWidth: 0 }}>
                {/* ── SUPER SETE ── */}
                {isSuperSete ? (
                  <SuperSeteUI
                    columns={superSeteColumns}
                    onToggle={toggleSuperSete}
                    onClear={clearSuperSete}
                  />
                ) : (
                  <>
                    {/* Info bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)', margin: 0 }}>
                        {isFixedPick
                          ? `Selecione exatamente ${minPick} dezenas.`
                          : `Selecione de ${minPick} a ${maxPick} dezenas.`}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 20, fontWeight: 800,
                          color: isMainValid() ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
                        }}>
                          {selected.length}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)' }}>
                          / {pickLabel}
                        </span>
                        {selected.length > 0 && (
                          <button
                            onClick={() => setSelected([])}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ml-error)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontFamily: 'inherit' }}
                          >
                            <Trash2 size={12} /> Limpar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Main number grid */}
                    <NumberGrid
                      numberStart={numberStart}
                      numberEnd={numberEnd}
                      selected={selected}
                      onToggle={toggleNumber}
                    />

                    {/* ── +Milionária: Trevos ── */}
                    {isMilionaria && (
                      <div style={{
                        background: 'var(--ml-surface-container)', borderRadius: 14, padding: '14px 16px',
                        marginBottom: 14, marginTop: 4,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', margin: 0 }}>
                            Trevos (01-{String(trevoPoolSize).padStart(2, '0')})
                          </p>
                          <span style={{
                            fontSize: 13, fontWeight: 800,
                            color: isTrevoValid() ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
                          }}>
                            {selectedTrevos.length} / {trevoMin}-{trevoMax}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {Array.from({ length: trevoPoolSize }, (_, i) => i + 1).map(t => {
                            const isSel = selectedTrevos.includes(t)
                            return (
                              <button
                                key={t}
                                onClick={() => toggleTrevo(t)}
                                style={{
                                  width: 44, height: 44, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 14, fontWeight: 800, fontFamily: 'monospace',
                                  transition: 'all 0.15s ease',
                                  background: isSel
                                    ? 'linear-gradient(145deg, #f59e0b, #d97706)'
                                    : 'var(--ml-surface-high)',
                                  color: isSel ? '#fff' : 'var(--ml-on-surface-variant)',
                                  boxShadow: isSel ? '0 2px 10px rgba(245,158,11,0.4)' : 'none',
                                  transform: isSel ? 'scale(1.1)' : 'scale(1)',
                                }}
                              >
                                {String(t).padStart(2, '0')}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Timemania: Time do Coração ── */}
                    {hasTimCoracao && (
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', display: 'block', marginBottom: 6 }}>
                          Time do Coração
                        </label>
                        <select
                          value={timeCoracao}
                          onChange={e => setTimeCoracao(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                            background: 'var(--ml-surface-highest)', color: 'var(--ml-on-surface)',
                            border: `2px solid ${timeCoracao ? 'var(--ml-primary)' : 'var(--ml-surface-high)'}`,
                            outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                            transition: 'border-color 0.2s',
                          }}
                        >
                          <option value="">-- Selecione o time --</option>
                          {FOOTBALL_TEAMS.map(team => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* ── Dia de Sorte: Mês da Sorte ── */}
                    {hasMesSorte && (
                      <div style={{ marginBottom: 14 }}>
                        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', display: 'block', marginBottom: 6 }}>
                          Mês da Sorte
                        </label>
                        <select
                          value={mesSorte}
                          onChange={e => setMesSorte(e.target.value)}
                          style={{
                            width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14,
                            background: 'var(--ml-surface-highest)', color: 'var(--ml-on-surface)',
                            border: `2px solid ${mesSorte ? 'var(--ml-primary)' : 'var(--ml-surface-high)'}`,
                            outline: 'none', fontFamily: 'inherit', cursor: 'pointer',
                            transition: 'border-color 0.2s',
                          }}
                        >
                          <option value="">-- Selecione o mes --</option>
                          {MONTHS.map(mes => (
                            <option key={mes} value={mes}>{mes}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT COLUMN (40%) — Name, Surpresinha, Preview, Save */}
              <div style={{ flex: '0 0 38%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Name input */}
                <input
                  type="text"
                  placeholder="Nome do jogo (opcional)"
                  value={gameName}
                  onChange={e => setGameName(e.target.value)}
                  className="input-filled"
                  style={{ width: '100%', fontSize: 14, boxSizing: 'border-box' }}
                />

                {/* ── Surpresinha bar ── */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'var(--ml-surface-container)', borderRadius: 12,
                  padding: '10px 14px',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0, color: 'var(--ml-on-surface)' }}>Surpresinha</p>
                    <p style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)', margin: 0, marginTop: 2 }}>Sorteia aleatoriamente</p>
                  </div>
                  {!isSuperSete && (
                    <select
                      value={surpresinhaPick}
                      onChange={e => setSurpresinhaPick(Number(e.target.value))}
                      style={{
                        padding: '6px 8px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'var(--ml-surface-highest)', color: 'var(--ml-on-surface)',
                        border: '1px solid var(--ml-outline-variant)', outline: 'none',
                        fontFamily: 'inherit', cursor: 'pointer', maxWidth: 80,
                      }}
                    >
                      {Array.from({ length: maxPick - minPick + 1 }, (_, i) => minPick + i).map(n => (
                        <option key={n} value={n}>{n} Num</option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={handleSurpresinha}
                    title="Gerar Surpresinha"
                    style={{
                      width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'linear-gradient(145deg, var(--ml-primary), var(--ml-primary-container))',
                      color: 'var(--ml-on-primary)', fontSize: 16,
                      boxShadow: '0 2px 8px rgba(110,219,166,0.3)',
                      transition: 'transform 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    🎁
                  </button>
                </div>

                {/* Selected preview */}
                {!isSuperSete && selected.length > 0 && (
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '12px 14px' }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>
                      Suas dezenas
                    </p>
                    <p style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--ml-primary)', letterSpacing: '0.5px', lineHeight: 1.6, wordBreak: 'break-word' }}>
                      {selected.map(n => String(n).padStart(2, '0')).join(' — ')}
                    </p>
                    {isMilionaria && selectedTrevos.length > 0 && (
                      <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#f59e0b', marginTop: 6 }}>
                        Trevos: {selectedTrevos.map(t => String(t).padStart(2, '0')).join(' — ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Spacer to push save button down */}
                <div style={{ flex: 1 }} />

                {/* Save button */}
                <button
                  className="btn-primary"
                  onClick={saveVisualGame}
                  disabled={!isFormValid}
                  style={{
                    width: '100%', justifyContent: 'center', fontSize: 14,
                    padding: '14px 20px', opacity: isFormValid ? 1 : 0.4,
                  }}
                >
                  <Save size={16} />
                  {isSuperSete
                    ? `Salvar jogo Super Sete`
                    : `Salvar jogo (${selected.length} dezenas)`}
                </button>
              </div>
            </div>
          )}

          {/* ── BULK TAB ────────────────────────────────────────────── */}
          {tab === 'bulk' && (
            <div>
              <p style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)', marginBottom: 12, lineHeight: 1.6 }}>
                Cole seus jogos abaixo. <strong>Uma linha por jogo</strong>, números separados por vírgula.
                Aceita de {minPick} a {maxPick} dezenas por linha.
                Números fora de {numberStart}–{numberEnd} são ignorados.
              </p>

              {/* Example */}
              <div style={{
                background: 'var(--ml-surface-container)', borderRadius: 10,
                padding: '10px 14px', marginBottom: 12,
                fontSize: 12, fontFamily: 'monospace', color: 'var(--ml-on-surface-variant)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 600, marginBottom: 4, fontFamily: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exemplo:</p>
                04, 15, 22, 33, 41, 58<br />
                07, 11, 19, 28, 35, 47<br />
                02, 13, 24, 36, 45, 53, 60
              </div>

              {/* Textarea */}
              <textarea
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
                placeholder="Cole seus jogos aqui, um por linha..."
                style={{
                  width: '100%', minHeight: 160, resize: 'vertical',
                  background: 'var(--ml-surface-highest)', color: 'var(--ml-on-surface)',
                  border: '2px solid transparent', borderRadius: 12,
                  padding: '14px 16px', fontSize: 14, fontFamily: 'monospace',
                  lineHeight: 1.8, outline: 'none', transition: 'border-color 0.2s',
                  boxSizing: 'border-box',
                }}
                onFocus={e => { e.target.style.borderColor = 'var(--ml-primary)' }}
                onBlur={e => { e.target.style.borderColor = 'transparent' }}
              />

              {/* Parse preview */}
              {bulkText.trim() && (
                <div style={{
                  background: 'var(--ml-surface-container)', borderRadius: 12,
                  padding: '14px 16px', marginTop: 12, marginBottom: 12,
                }}>
                  <p style={{
                    fontSize: 11, fontWeight: 700, marginBottom: 8,
                    color: bulkParsed.length > 0 ? 'var(--ml-primary)' : 'var(--ml-error)',
                  }}>
                    {bulkParsed.length > 0
                      ? `${bulkParsed.length} jogo${bulkParsed.length > 1 ? 's' : ''} reconhecido${bulkParsed.length > 1 ? 's' : ''}:`
                      : `Nenhum jogo válido. Cada linha precisa de pelo menos ${minPick} números.`}
                  </p>
                  {bulkParsed.slice(0, 10).map((nums, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', fontFamily: 'monospace', width: 24 }}>
                        #{i + 1}
                      </span>
                      <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: 'var(--ml-on-surface)' }}>
                        {nums.map(n => String(n).padStart(2, '0')).join(', ')}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)' }}>({nums.length} dez.)</span>
                    </div>
                  ))}
                  {bulkParsed.length > 10 && (
                    <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 4 }}>
                      ...e mais {bulkParsed.length - 10} jogos
                    </p>
                  )}
                </div>
              )}

              {/* Save button */}
              <button
                className="btn-primary"
                onClick={saveBulkGames}
                disabled={bulkParsed.length === 0}
                style={{
                  width: '100%', justifyContent: 'center', fontSize: 14,
                  padding: '14px 20px', marginTop: 8,
                  opacity: bulkParsed.length === 0 ? 0.4 : 1,
                }}
              >
                <Plus size={16} /> Importar {bulkParsed.length} jogo{bulkParsed.length !== 1 ? 's' : ''}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
