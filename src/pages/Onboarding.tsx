import { useState, useEffect, useRef } from 'react'
import { api, type LotteryConfig } from '../lib/tauri'
import { Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'

interface OnboardingProps {
  onComplete: (selectedGames?: string[]) => void
}

const LOTTERY_LIST: { game_type: string; label: string; file: string; fallbackColor: string }[] = [
  { game_type: 'megasena', label: 'Mega-Sena', file: 'megasena.sql', fallbackColor: '#209869' },
  { game_type: 'lotofacil', label: 'Lotofacil', file: 'lotofacil.sql', fallbackColor: '#930089' },
  { game_type: 'quina', label: 'Quina', file: 'quina.sql', fallbackColor: '#260085' },
  { game_type: 'lotomania', label: 'Lotomania', file: 'lotomania.sql', fallbackColor: '#F78100' },
  { game_type: 'timemania', label: 'Timemania', file: 'timemania.sql', fallbackColor: '#00FF48' },
  { game_type: 'duplasena', label: 'Dupla Sena', file: 'duplasena.sql', fallbackColor: '#A61324' },
  { game_type: 'diadesorte', label: 'Dia de Sorte', file: 'diadesorte.sql', fallbackColor: '#CB7B18' },
  { game_type: 'supersete', label: 'Super Sete', file: 'supersete.sql', fallbackColor: '#A8CF45' },
  { game_type: 'maismilionaria', label: '+Milionaria', file: 'maismilionaria.sql', fallbackColor: '#091F5E' },
]

const PRE_SELECTED = ['megasena', 'lotofacil', 'quina']

type DownloadStatus = 'pending' | 'downloading' | 'done' | 'error'

interface DownloadState {
  status: DownloadStatus
  message: string
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selected, setSelected] = useState<Set<string>>(new Set(PRE_SELECTED))
  const [catalog, setCatalog] = useState<LotteryConfig[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({})
  const [allDone, setAllDone] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const hasStartedDownload = useRef(false)

  // Load catalog for colors on mount
  useEffect(() => {
    api.getGamesCatalog().then(cat => {
      setCatalog(cat.filter(c => c.game_type !== 'federal'))
    }).catch(e => {
      console.error('Failed to load catalog:', e)
    })
  }, [])

  const getColor = (gameType: string): string => {
    const fromCatalog = catalog.find(c => c.game_type === gameType)
    if (fromCatalog) return fromCatalog.color
    return LOTTERY_LIST.find(l => l.game_type === gameType)?.fallbackColor || 'var(--ml-primary)'
  }

  const toggleSelection = (gameType: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(gameType)) {
        next.delete(gameType)
      } else {
        next.add(gameType)
      }
      return next
    })
  }

  // Step 1 -> Step 2
  const handleIniciar = () => {
    setStep(2)
  }

  // Step 2 -> Step 3
  const handleContinuar = () => {
    setStep(3)
  }

  // Step 3: Run downloads
  useEffect(() => {
    if (step !== 3 || hasStartedDownload.current) return
    hasStartedDownload.current = true

    const selectedTypes = Array.from(selected)
    const initialState: Record<string, DownloadState> = {}
    selectedTypes.forEach(gt => {
      initialState[gt] = { status: 'pending', message: 'Aguardando...' }
    })
    setDownloads(initialState)

    const runDownloads = async () => {
      const results: Record<string, DownloadState> = { ...initialState }

      for (const gt of selectedTypes) {
        // Mark as downloading
        results[gt] = { status: 'downloading', message: 'Baixando e importando...' }
        setDownloads({ ...results })

        try {
          const item = LOTTERY_LIST.find(l => l.game_type === gt)
          if (!item) throw new Error('Loteria nao encontrada')
          const url = `https://dantetesta.com.br/lotolab/loterias/${item.file}`
          const result = await api.downloadAndImportSql(url, gt)
          results[gt] = { status: 'done', message: result }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          results[gt] = { status: 'error', message: msg }
        }

        setDownloads({ ...results })
      }

      // All downloads finished
      setAllDone(true)

      // Wait a moment then complete onboarding
      setTimeout(async () => {
        setFinishing(true)
        try {
          const primaryType = selectedTypes[0] || 'megasena'
          await api.completeOnboarding(selectedTypes, primaryType)
          onComplete(selectedTypes)
        } catch (e) {
          console.error('Onboarding completion error:', e)
          // Still try to enter the app
          onComplete(selectedTypes)
        }
      }, 1500)
    }

    runDownloads()
  }, [step, selected, onComplete])

  // ─── STEP 1: Welcome ───
  if (step === 1) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--ml-surface)',
        padding: 40,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          maxWidth: 520,
          gap: 24,
        }} className="animate-scale-in">
          <div style={{ borderRadius: 20, overflow: 'hidden', maxWidth: 420, width: '100%' }}>
            <img src="/author.png" alt="LotoLab" style={{ width: '100%', display: 'block' }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--ml-on-surface)', margin: 0 }}>
              Bem-vindo ao LotoLab!
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ml-on-surface-variant)', maxWidth: 400, margin: 0 }}>
              Sua ferramenta completa de analise para loterias CAIXA.
            </p>
          </div>

          <button
            onClick={handleIniciar}
            className="btn-primary"
            style={{
              fontSize: 16,
              padding: '16px 48px',
            }}
          >
            Iniciar
          </button>
        </div>
      </div>
    )
  }

  // ─── STEP 2: Lottery Selection ───
  if (step === 2) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'var(--ml-surface)',
        padding: '40px 40px 32px',
        overflow: 'auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: 600,
          width: '100%',
          gap: 24,
        }} className="animate-scale-in">
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ml-on-surface)', margin: '0 0 8px' }}>
              Escolha suas loterias
            </h1>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ml-on-surface-variant)', margin: 0 }}>
              Selecione as loterias que deseja acompanhar. Os dados serao baixados automaticamente.
            </p>
          </div>

          {/* Lottery grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 10,
            width: '100%',
          }}>
            {LOTTERY_LIST.map(item => {
              const isSelected = selected.has(item.game_type)
              const color = getColor(item.game_type)

              return (
                <button
                  key={item.game_type}
                  onClick={() => toggleSelection(item.game_type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: isSelected ? `2px solid ${color}` : '2px solid var(--ml-outline-variant)',
                    background: isSelected ? `color-mix(in srgb, ${color} 8%, var(--ml-surface-low))` : 'var(--ml-surface-low)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                  }}
                >
                  {/* Colored dot */}
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: color,
                    flexShrink: 0,
                  }} />

                  {/* Name */}
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ml-on-surface)',
                    flex: 1,
                  }}>
                    {item.label}
                  </span>

                  {/* Checkbox */}
                  <div style={{
                    width: 20,
                    height: 20,
                    borderRadius: 6,
                    border: isSelected ? 'none' : '2px solid var(--ml-outline-variant)',
                    background: isSelected ? color : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}>
                    {isSelected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Selected count */}
          <p style={{
            fontSize: 13,
            color: 'var(--ml-on-surface-variant)',
            margin: 0,
          }}>
            {selected.size} {selected.size === 1 ? 'loteria selecionada' : 'loterias selecionadas'}
          </p>

          {/* Continue button */}
          <button
            onClick={handleContinuar}
            disabled={selected.size === 0}
            className="btn-primary"
            style={{
              fontSize: 16,
              padding: '16px 48px',
              opacity: selected.size === 0 ? 0.5 : 1,
              cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            Continuar
          </button>
        </div>
      </div>
    )
  }

  // ─── STEP 3: Downloading ───
  const selectedTypes = Array.from(selected)
  const doneCount = selectedTypes.filter(gt => downloads[gt]?.status === 'done').length
  const errorCount = selectedTypes.filter(gt => downloads[gt]?.status === 'error').length
  const totalCount = selectedTypes.length

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: 'var(--ml-surface)',
      padding: '40px 40px 32px',
      overflow: 'auto',
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        maxWidth: 520,
        width: '100%',
        gap: 24,
      }} className="animate-scale-in">
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--ml-on-surface)', margin: '0 0 8px' }}>
            {allDone ? 'Concluido!' : 'Baixando dados...'}
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--ml-on-surface-variant)', margin: 0 }}>
            {allDone
              ? (errorCount > 0
                ? `${doneCount} de ${totalCount} importados. Voce pode reimportar depois em Configuracoes.`
                : 'Todos os dados foram importados com sucesso!')
              : `Importando dados das loterias selecionadas (${doneCount}/${totalCount})...`
            }
          </p>
        </div>

        {/* Overall progress bar */}
        <div style={{ width: '100%' }}>
          <div style={{
            width: '100%',
            height: 6,
            borderRadius: 3,
            background: 'var(--ml-surface-high)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: 3,
              background: allDone ? 'var(--ml-primary)' : 'var(--ml-primary)',
              width: totalCount > 0 ? `${((doneCount + errorCount) / totalCount) * 100}%` : '0%',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Per-lottery status cards */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
        }}>
          {selectedTypes.map(gt => {
            const item = LOTTERY_LIST.find(l => l.game_type === gt)
            if (!item) return null
            const color = getColor(gt)
            const state = downloads[gt]
            const status = state?.status || 'pending'

            return (
              <div
                key={gt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: 'var(--ml-surface-low)',
                  border: status === 'done'
                    ? `1px solid ${color}`
                    : status === 'error'
                      ? '1px solid var(--ml-error)'
                      : '1px solid var(--ml-outline-variant)',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Color dot */}
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                }} />

                {/* Name + message */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--ml-on-surface)',
                  }}>
                    {item.label}
                  </div>
                  {state?.message && (
                    <div style={{
                      fontSize: 11,
                      color: status === 'error'
                        ? 'var(--ml-error)'
                        : status === 'done'
                          ? color
                          : 'var(--ml-on-surface-variant)',
                      fontWeight: status === 'done' ? 600 : 400,
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {state.message}
                    </div>
                  )}
                </div>

                {/* Status icon */}
                <div style={{ flexShrink: 0 }}>
                  {status === 'pending' && (
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: '2px solid var(--ml-outline-variant)',
                    }} />
                  )}
                  {status === 'downloading' && (
                    <Loader2 size={20} className="animate-spin" style={{ color }} />
                  )}
                  {status === 'done' && (
                    <CheckCircle size={20} style={{ color }} />
                  )}
                  {status === 'error' && (
                    <AlertCircle size={20} style={{ color: 'var(--ml-error)' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Finishing indicator */}
        {allDone && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 24px',
            borderRadius: 12,
            background: 'color-mix(in srgb, var(--ml-primary) 10%, var(--ml-surface-low))',
          }} className="animate-fade-in">
            {finishing ? (
              <>
                <Loader2 size={18} className="animate-spin" style={{ color: 'var(--ml-primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ml-primary)' }}>
                  Entrando no LotoLab...
                </span>
              </>
            ) : (
              <>
                <Download size={18} style={{ color: 'var(--ml-primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ml-primary)' }}>
                  Finalizando...
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
