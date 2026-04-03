import React, { useState, useEffect, useRef } from 'react'
import { api, type LotteryConfig } from '@/lib/tauri'
import { cn } from '@/lib/utils'
import { Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

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

  useEffect(() => {
    api.getGamesCatalog().then(cat => {
      setCatalog(cat.filter(c => c.game_type !== 'federal'))
    }).catch(e => { console.error('Failed to load catalog:', e) })
  }, [])

  const getColor = (gameType: string): string => {
    const fromCatalog = catalog.find(c => c.game_type === gameType)
    if (fromCatalog) return fromCatalog.color
    return LOTTERY_LIST.find(l => l.game_type === gameType)?.fallbackColor || 'var(--primary)'
  }

  const toggleSelection = (gameType: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(gameType)) next.delete(gameType)
      else next.add(gameType)
      return next
    })
  }

  useEffect(() => {
    if (step !== 3 || hasStartedDownload.current) return
    hasStartedDownload.current = true

    const selectedTypes = Array.from(selected)
    const initialState: Record<string, DownloadState> = {}
    selectedTypes.forEach(gt => { initialState[gt] = { status: 'pending', message: 'Aguardando...' } })
    setDownloads(initialState)

    const runDownloads = async () => {
      const results: Record<string, DownloadState> = { ...initialState }
      for (const gt of selectedTypes) {
        results[gt] = { status: 'downloading', message: 'Baixando e importando...' }
        setDownloads({ ...results })
        try {
          const item = LOTTERY_LIST.find(l => l.game_type === gt)
          if (!item) throw new Error('Loteria nao encontrada')
          const url = `https://github.com/dantetesta/LotoLogic/releases/download/data/${item.file}`
          const result = await api.downloadAndImportSql(url, gt)
          results[gt] = { status: 'done', message: result }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e)
          results[gt] = { status: 'error', message: msg }
        }
        setDownloads({ ...results })
      }
      setAllDone(true)
      setTimeout(async () => {
        setFinishing(true)
        try {
          const primaryType = selectedTypes[0] || 'megasena'
          await api.completeOnboarding(selectedTypes, primaryType)
          onComplete(selectedTypes)
        } catch (e) {
          console.error('Onboarding completion error:', e)
          onComplete(selectedTypes)
        }
      }, 1500)
    }
    runDownloads()
  }, [step, selected, onComplete])

  // Step 1: Welcome
  if (step === 1) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background p-10">
        <div className="flex flex-col items-center text-center max-w-[520px] gap-6 animate-scale-in">
          <div className="rounded-2xl overflow-hidden max-w-[420px] w-full">
            <img src="/lotologic-image-start.jpg" alt="LotoLogic" className="w-full block" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-[28px] font-extrabold text-foreground">Bem-vindo ao LotoLogic!</h1>
            <p className="text-sm leading-relaxed text-muted-foreground max-w-[400px]">
              Sua ferramenta completa de analise para loterias CAIXA.
            </p>
          </div>
          <Button size="lg" onClick={() => { api.trackFirstInstall(); setStep(2) }} className="text-base px-12 py-4">Iniciar</Button>
        </div>
      </div>
    )
  }

  // Step 2: Lottery Selection
  if (step === 2) {
    return (
      <div className="h-screen flex flex-col items-center bg-background px-10 pt-10 pb-8 overflow-auto">
        <div className="flex flex-col items-center max-w-[600px] w-full gap-6 animate-scale-in">
          <div className="text-center">
            <h1 className="text-2xl font-extrabold text-foreground mb-2">Escolha suas loterias</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Selecione as loterias que deseja acompanhar. Os dados serao baixados automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 w-full">
            {LOTTERY_LIST.map(item => {
              const isSelected = selected.has(item.game_type)
              const color = getColor(item.game_type)
              return (
                <button
                  key={item.game_type}
                  onClick={() => toggleSelection(item.game_type)}
                  className={cn(
                    'flex items-center gap-2.5 px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-150 text-left border-2',
                    isSelected ? 'lottery-select-active' : 'border-border bg-card',
                  )}
                  style={{ '--c': color } as React.CSSProperties}
                >
                  <div className="w-3 h-3 rounded-full shrink-0 [background:var(--c)]" />
                  <span className="text-[13px] font-bold text-foreground flex-1">{item.label}</span>
                  <div
                    className={cn('w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all', isSelected ? 'lottery-btn [background:var(--c)]' : 'border-2 border-border')}
                  >
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

          <p className="text-[13px] text-muted-foreground">
            {selected.size} {selected.size === 1 ? 'loteria selecionada' : 'loterias selecionadas'}
          </p>

          <Button size="lg" onClick={() => setStep(3)} disabled={selected.size === 0} className="text-base px-12 py-4">
            Continuar
          </Button>
        </div>
      </div>
    )
  }

  // Step 3: Downloading
  const selectedTypes = Array.from(selected)
  const doneCount = selectedTypes.filter(gt => downloads[gt]?.status === 'done').length
  const errorCount = selectedTypes.filter(gt => downloads[gt]?.status === 'error').length
  const totalCount = selectedTypes.length
  const progressPct = totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0

  return (
    <div className="h-screen flex flex-col items-center bg-background px-10 pt-10 pb-8 overflow-auto">
      <div className="flex flex-col items-center max-w-[520px] w-full gap-6 animate-scale-in">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-foreground mb-2">
            {allDone ? 'Concluido!' : 'Baixando dados...'}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {allDone
              ? (errorCount > 0
                ? `${doneCount} de ${totalCount} importados. Voce pode reimportar depois em Configuracoes.`
                : 'Todos os dados foram importados com sucesso!')
              : `Importando dados das loterias selecionadas (${doneCount}/${totalCount})...`
            }
          </p>
        </div>

        {/* Progress bar */}
        <Progress value={progressPct} className="w-full" />

        {/* Per-lottery status */}
        <div className="flex flex-col gap-2 w-full">
          {selectedTypes.map(gt => {
            const item = LOTTERY_LIST.find(l => l.game_type === gt)
            if (!item) return null
            const color = getColor(gt)
            const state = downloads[gt]
            const status = state?.status || 'pending'

            return (
              <Card
                key={gt}
                className={cn('transition-all', status === 'error' && 'border-destructive', status === 'done' && '[border-color:var(--c)]')}
                style={{ '--c': color } as React.CSSProperties}
              >
                <CardContent className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0 [background:var(--c)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-bold text-foreground">{item.label}</div>
                    {state?.message && (
                      <div className={cn(
                        'text-[11px] mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap',
                        status === 'error' ? 'text-destructive' : status === 'done' ? 'font-semibold [color:var(--c)]' : 'text-muted-foreground',
                      )}>
                        {state.message}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-border" />}
                    {status === 'downloading' && <Loader2 size={20} className="animate-spin [color:var(--c)]" />}
                    {status === 'done' && <CheckCircle size={20} className="[color:var(--c)]" />}
                    {status === 'error' && <AlertCircle size={20} className="text-destructive" />}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Finishing */}
        {allDone && (
          <div className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-card border border-border animate-fade-in">
            {finishing ? (
              <>
                <Loader2 size={18} className="animate-spin text-primary" />
                <span className="text-sm font-semibold text-primary">Entrando no LotoLogic...</span>
              </>
            ) : (
              <>
                <Download size={18} className="text-primary" />
                <span className="text-sm font-semibold text-primary">Finalizando...</span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
