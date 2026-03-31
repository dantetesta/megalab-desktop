import React, { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import HeatMap from '@/components/HeatMap'
import { api, type DynamicDashboardStats, type SpecialFieldStat } from '@/lib/tauri'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { Database, RefreshCw, Dices, Search, FolderHeart, Loader2, Download, Upload, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import BannerCarousel from '@/components/BannerCarousel'


const PERIOD_OPTIONS = [
  { label: 'Todos', value: null },
  { label: 'Ultimos 10', value: 10 },
  { label: 'Ultimos 20', value: 20 },
  { label: 'Ultimos 50', value: 50 },
  { label: 'Ultimos 100', value: 100 },
  { label: 'Ultimos 500', value: 500 },
  { label: 'Ultimos 1000', value: 1000 },
]

const LOTTERY_ODDS: Record<string, { prize: string, odds: string, formula: string }[]> = {
  megasena: [
    { prize: 'Sena (6 acertos)', odds: '1 em 50.063.860', formula: 'C(60,6)' },
    { prize: 'Quina (5 acertos)', odds: '1 em 154.518', formula: 'C(6,5)×C(54,1)' },
    { prize: 'Quadra (4 acertos)', odds: '1 em 2.332', formula: 'C(6,4)×C(54,2)' },
  ],
  lotofacil: [
    { prize: '15 acertos', odds: '1 em 3.268.760', formula: 'C(25,15)' },
    { prize: '14 acertos', odds: '1 em 21.792', formula: '' },
    { prize: '13 acertos', odds: '1 em 691', formula: '' },
    { prize: '12 acertos', odds: '1 em 59', formula: '' },
    { prize: '11 acertos', odds: '1 em 11', formula: '' },
  ],
  quina: [
    { prize: 'Quina (5 acertos)', odds: '1 em 24.040.016', formula: 'C(80,5)' },
    { prize: 'Quadra (4 acertos)', odds: '1 em 64.106', formula: '' },
    { prize: 'Terno (3 acertos)', odds: '1 em 866', formula: '' },
    { prize: 'Duque (2 acertos)', odds: '1 em 36', formula: '' },
  ],
  lotomania: [
    { prize: '20 acertos', odds: '1 em 11.372.635', formula: 'C(100,20)/(C(80,0))' },
    { prize: '0 acertos', odds: '1 em 11.372.635', formula: '' },
    { prize: '19 acertos', odds: '1 em 568.632', formula: '' },
    { prize: '18 acertos', odds: '1 em 37.909', formula: '' },
    { prize: '17 acertos', odds: '1 em 3.312', formula: '' },
    { prize: '16 acertos', odds: '1 em 374', formula: '' },
    { prize: '15 acertos', odds: '1 em 54', formula: '' },
  ],
  duplasena: [
    { prize: 'Sena (6 acertos)', odds: '1 em 15.890.700', formula: 'C(50,6)' },
    { prize: 'Quina (5 acertos)', odds: '1 em 60.192', formula: '' },
    { prize: 'Quadra (4 acertos)', odds: '1 em 1.120', formula: '' },
  ],
  timemania: [
    { prize: '7 acertos', odds: '1 em 26.472.637', formula: 'C(80,7)' },
    { prize: '6 acertos', odds: '1 em 216.040', formula: '' },
    { prize: '5 acertos', odds: '1 em 5.765', formula: '' },
    { prize: '4 acertos', odds: '1 em 282', formula: '' },
    { prize: '3 acertos', odds: '1 em 24', formula: '' },
  ],
  diadesorte: [
    { prize: '7 acertos', odds: '1 em 2.629.575', formula: 'C(31,7)' },
    { prize: '6 acertos', odds: '1 em 21.913', formula: '' },
    { prize: '5 acertos', odds: '1 em 600', formula: '' },
    { prize: '4 acertos', odds: '1 em 30', formula: '' },
  ],
  maismilionaria: [
    { prize: '6+2 acertos', odds: '1 em 238.360.500', formula: 'C(50,6)×C(6,2)' },
    { prize: '6+1 acerto', odds: '1 em 29.795.063', formula: '' },
    { prize: '6+0 acertos', odds: '1 em 59.590.125', formula: '' },
    { prize: '5+2 acertos', odds: '1 em 1.084.584', formula: '' },
    { prize: '5+1 acerto', odds: '1 em 135.573', formula: '' },
  ],
  supersete: [
    { prize: '7 acertos', odds: '1 em 10.000.000', formula: '10^7' },
    { prize: '6 acertos', odds: '1 em 476.190', formula: '' },
    { prize: '5 acertos', odds: '1 em 10.101', formula: '' },
    { prize: '4 acertos', odds: '1 em 457', formula: '' },
    { prize: '3 acertos', odds: '1 em 42', formula: '' },
  ],
}

interface DashboardProps {
  pendingSyncGames?: string[]
  onSyncComplete?: () => void
}

export default function Dashboard({ }: DashboardProps) {
  const { dashboard, loadDashboard, setCurrentPage, showToast } = useAppStore()
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const [syncingAll, setSyncingAll] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [period, setPeriod] = useState<number | null>(null)
  const [dstats, setDstats] = useState<DynamicDashboardStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [specialStats, setSpecialStats] = useState<SpecialFieldStat[]>([])
  const [trevoStats, setTrevoStats] = useState<SpecialFieldStat[]>([])

  useEffect(() => { loadDashboard() }, [])

  useEffect(() => {
    if (dashboard && !dashboard.db_is_empty) {
      setLoadingStats(true)
      api.getDynamicDashboardStats(period, activeGame).then(setDstats).catch(() => {}).finally(() => setLoadingStats(false))
      if (activeGame === 'timemania' || activeGame === 'diadesorte') {
        api.getSpecialFieldStats(activeGame, period).then(setSpecialStats).catch(() => setSpecialStats([]))
      } else { setSpecialStats([]) }
      if (activeGame === 'maismilionaria') {
        api.getTrevoStats(period).then(setTrevoStats).catch(() => setTrevoStats([]))
      } else { setTrevoStats([]) }
    }
  }, [dashboard, period, activeGame])

  const [syncProgress, setSyncProgress] = useState('')
  const syncCancelRef = useRef(false)

  const handleSyncAll = async () => {
    setSyncingAll(true)
    syncCancelRef.current = false
    try {
      const gameTypes = enabledGames.map(g => g.game_type)
      let completed = 0
      for (const gt of gameTypes) {
        if (syncCancelRef.current) break
        const displayName = enabledGames.find(g => g.game_type === gt)?.display_name || gt
        setSyncProgress(`Sincronizando ${displayName}...`)
        try { await api.syncGame(gt); completed++ } catch (e: unknown) { console.warn(`Sync ${gt}:`, e) }
      }
      if (!syncCancelRef.current) {
        showToast(`${completed} loteria${completed > 1 ? 's' : ''} sincronizada${completed > 1 ? 's' : ''}!`, 'success')
      } else {
        showToast('Sincronizacao cancelada.', 'info')
      }
      loadDashboard()
    } catch (e: unknown) { showToast(String(e) || 'Erro', 'error') }
    finally { setSyncingAll(false); setSyncProgress('') }
  }

  const [lastBackupDate, setLastBackupDate] = useState<string | null>(localStorage.getItem('lotolab_last_backup'))
  const [importPending, setImportPending] = useState<File | null>(null)
  const [showImportConfirm, setShowImportConfirm] = useState(false)
  const [tableCounts, setTableCounts] = useState<[string, number][] | null>(null)
  const [checkingIntegrity, setCheckingIntegrity] = useState(false)

  const handleExportSql = async () => { try { const s = await api.exportFullDatabaseSql(); const b = new Blob([s], { type: 'text/sql' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); const d = new Date(); const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; a.href = u; a.download = `lotolab_backup_${dateStr}.sql`; a.click(); URL.revokeObjectURL(u); const ts = d.toLocaleString('pt-BR'); localStorage.setItem('lotolab_last_backup', ts); setLastBackupDate(ts); showToast('Backup exportado!', 'success') } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') } }
  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setImportPending(f); setShowImportConfirm(true); if (fileInputRef.current) fileInputRef.current.value = '' }
  const handleImportConfirm = async () => { if (!importPending) return; setShowImportConfirm(false); try { const r = await api.importDatabaseSql(await importPending.text()); showToast(r, 'success'); await loadDashboard() } catch (err: any) { showToast(err?.toString() || 'Erro', 'error') } finally { setImportPending(null) } }
  const handleCheckIntegrity = async () => { setCheckingIntegrity(true); try { const counts = await api.getTableCounts(); setTableCounts(counts) } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') } finally { setCheckingIntegrity(false) } }

  if (!dashboard) return <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-primary" /></div>

  const top10 = dstats ? [...dstats.number_data].sort((a, b) => b.frequency - a.frequency).slice(0, 10) : []
  const delayed10 = dstats ? [...dstats.number_data].sort((a, b) => b.delay - a.delay).slice(0, 10) : []
  const activeConfig = enabledGames.find(g => g.game_type === activeGame)
  const tooltipStyle = { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12, color: '#e0e0e0', fontFamily: 'Inter' }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[1.4rem] font-bold tracking-tight">Inicio</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">Visao geral do seu LotoLab</p>
        </div>
        {!dashboard.db_is_empty && (
          <Button size="sm" onClick={handleSyncAll} disabled={syncingAll} className="gap-1.5">
            {syncingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sincronizar todas
          </Button>
        )}
      </div>

      {/* Lottery tabs */}
      {enabledGames.length > 0 && <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />}

      {/* Sync progress */}
      {syncingAll && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-card">
          <CardContent className="p-4 flex items-center gap-2.5">
            <Loader2 size={16} className="animate-spin text-primary" />
            <div className="flex-1">
              <span className="text-[13px] font-semibold">{syncProgress || 'Sincronizando loterias habilitadas...'}</span>
              <p className="text-[10px] text-muted-foreground mt-0.5">Baixando apenas concursos faltantes da API.</p>
            </div>
            <Button size="sm" variant="destructive" onClick={() => syncCancelRef.current = true} className="shrink-0">
              Cancelar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {dashboard.db_is_empty && (
        <Card className="py-12 px-10 text-center">
          <CardContent className="flex flex-col items-center p-0">
            <Database size={40} className="text-primary mb-4" />
            <h3 className="text-xl font-bold mb-2.5">Bem-vindo ao LotoLab!</h3>
            <p className="text-muted-foreground max-w-[440px] mb-6 leading-relaxed">
              Para comecar, importe a base de dados em <strong>Configuracoes</strong> ou restaure um backup existente.
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setCurrentPage('settings')} className="gap-2">
                <Database size={16} /> Ir para Configuracoes
              </Button>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
                <Upload size={16} /> Restaurar Backup
              </Button>
            </div>
            <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportFileSelect} className="hidden" />
          </CardContent>
        </Card>
      )}

      {!dashboard.db_is_empty && (
        <>
          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { id: 'gerador', icon: Dices, label: 'Gerar Jogo', color: 'var(--primary)' },
              { id: 'concursos', icon: Search, label: 'Consultar Concursos', color: '#5b9bd5' },
              { id: 'meus_jogos', icon: FolderHeart, label: 'Meus Jogos', color: 'var(--accent-gold)' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className="bg-card rounded-xl px-4 py-4 border-none cursor-pointer flex items-center gap-3 min-h-[56px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
                style={{ '--c': item.color } as React.CSSProperties}
              >
                <div className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0 action-icon-bg">
                  <item.icon size={18} className="[color:var(--c)]" />
                </div>
                <span className="text-sm font-bold text-foreground">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Probabilidades + Banner */}
          {activeGame && LOTTERY_ODDS[activeGame] && (
            <div className="flex gap-3">
              <div className="flex-[3]">
                <Card>
                  <CardContent className="p-5">
                    <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
                      <Target size={16} className="text-primary" />
                      Suas chances - {activeConfig?.display_name}
                    </h3>
                    <div className="space-y-3">
                      {LOTTERY_ODDS[activeGame].map((row, i) => {
                        // Calculate visual width (inverse log scale)
                        const oddsNum = parseInt(row.odds.replace(/\D/g, ''))
                        const maxLog = Math.log10(oddsNum)
                        const barPct = Math.max(3, 100 - (maxLog * 12))
                        const difficulty = maxLog > 7 ? 'Quase impossivel' : maxLog > 5 ? 'Muito dificil' : maxLog > 3 ? 'Dificil' : maxLog > 1 ? 'Possivel' : 'Provavel'
                        const color = maxLog > 7 ? '#ef4444' : maxLog > 5 ? '#f97316' : maxLog > 3 ? '#eab308' : '#22c55e'

                        return (
                          <div key={i} style={{ '--c': color } as React.CSSProperties}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[13px] font-medium">{row.prize}</span>
                              <span className="text-[13px] font-bold tabular-nums [color:var(--c)]">{row.odds}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden bg-muted">
                              <div className="h-full rounded-full transition-all duration-500 [background:var(--c)]" style={{ width: `${barPct}%` }} />
                            </div>
                            <p className="text-[10px] mt-0.5 [color:var(--c)]">{difficulty}</p>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4 italic">
                      Probabilidades matematicas fixas por jogo simples. Quanto menor a barra, mais dificil.
                    </p>
                  </CardContent>
                </Card>
              </div>
              <div className="flex-1 min-w-[200px]">
                <BannerCarousel position="dashboard" />
              </div>
            </div>
          )}

          {/* Period filter + stats */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Estatisticas - {activeConfig?.display_name || ''}
                </p>
                <div className="flex gap-1 flex-wrap">
                  {PERIOD_OPTIONS.map(p => (
                    <button
                      key={p.label}
                      onClick={() => setPeriod(p.value)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg border-none cursor-pointer text-[11px] font-semibold transition-all',
                        period === p.value ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                      )}
                    >{p.label}</button>
                  ))}
                </div>
              </div>

              {loadingStats && <div className="text-center py-5"><Loader2 size={20} className="animate-spin text-primary mx-auto" /></div>}

              {dstats && !loadingStats && (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-4 gap-2.5 mb-5">
                    <MiniCard label="Intervalo" value={`#${dstats.first_contest} ao #${dstats.last_contest}`} />
                    <MiniCard label="Total de Sorteios" value={String(dstats.contest_count)} accent />
                    <MiniCard label="Media da Soma" value={dstats.avg_sum.toFixed(1)} />
                    <Card>
                      <CardContent className="p-3.5 text-center">
                        <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Paridade</p>
                        <div className="flex justify-center gap-3">
                          <span className="text-base font-extrabold text-primary">{dstats.even_pct.toFixed(1)}%</span>
                          <span className="text-base font-extrabold text-orange-400">{dstats.odd_pct.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-center gap-3 text-[9px] text-muted-foreground">
                          <span>Pares</span><span>Impares</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Top frequent + delayed */}
                  <div className="grid grid-cols-2 gap-2.5 mb-5">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-primary mb-2.5">Mais Frequentes</p>
                        <div className="flex flex-wrap gap-1.5">
                          {top10.map(d => (
                            <div key={d.number} className="text-center">
                              <NumberBall number={d.number} size="md" />
                              <p className="text-[9px] text-muted-foreground mt-0.5 font-semibold">{d.frequency}x</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-orange-400 mb-2.5">Mais Atrasados</p>
                        <div className="flex flex-wrap gap-1.5">
                          {delayed10.map(d => (
                            <div key={d.number} className="text-center">
                              <NumberBall number={d.number} size="md" variant="gold" />
                              <p className="text-[9px] text-muted-foreground mt-0.5 font-semibold">{d.delay} conc.</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Heat Map + Special Stats */}
                  <div className={cn('grid gap-4 mb-5', (specialStats.length > 0 || trevoStats.length > 0) ? 'grid-cols-2' : 'grid-cols-1')}>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Mapa de Calor - Volante</p>
                      <HeatMap data={dstats.number_data} highlighted={dashboard.last_contest_numbers || []} />
                    </div>

                    {specialStats.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                          {activeGame === 'timemania' ? 'Times do Coracao - Frequencia' : 'Meses da Sorte - Frequencia'}
                        </p>
                        <Card>
                          <CardContent className="p-4">
                            <ResponsiveContainer width="100%" height={Math.max(200, specialStats.slice(0, 20).length * 28)}>
                              <BarChart data={specialStats.slice(0, 20)} layout="vertical" barCategoryGap="15%">
                                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="label" width={activeGame === 'timemania' ? 140 : 90} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill={activeConfig?.color || 'var(--primary)'}>
                                  {specialStats.slice(0, 20).map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? 'var(--accent-gold)' : i < 3 ? activeConfig?.color || 'var(--primary)' : 'var(--muted)'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <p className="text-[10px] text-muted-foreground mt-2 text-center">
                              {specialStats.length} {activeGame === 'timemania' ? 'times' : 'meses'} encontrados - Top 20
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    )}

                    {trevoStats.length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Trevos - Frequencia</p>
                        <Card>
                          <CardContent className="p-4">
                            <ResponsiveContainer width="100%" height={Math.max(160, trevoStats.length * 32)}>
                              <BarChart data={trevoStats} layout="vertical" barCategoryGap="20%">
                                <XAxis type="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="label" width={80} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                  {trevoStats.map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? '#f59e0b' : i < 3 ? '#d97706' : 'var(--muted)'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                            <p className="text-[10px] text-muted-foreground mt-2 text-center">{trevoStats.length} trevos encontrados</p>
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>

                  {/* Charts: Frequency + Delay */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-muted-foreground mb-2.5">Frequencia dos Numeros</p>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={dstats.number_data}>
                            <XAxis dataKey="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
                            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                            <Bar dataKey="frequency" radius={[2, 2, 0, 0]} fill={activeConfig?.color || 'var(--primary)'} />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-muted-foreground mb-2.5">Atraso dos Numeros</p>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={dstats.number_data}>
                            <XAxis dataKey="number" tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
                            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                            <Bar dataKey="delay" radius={[2, 2, 0, 0]} fill="var(--accent-gold)" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts row 2 */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <p className="text-[11px] font-bold text-muted-foreground mb-1.5">Paridade</p>
                        <ResponsiveContainer width="100%" height={130}>
                          <PieChart>
                            <Pie data={[{ name: 'Pares', value: dstats.even_pct }, { name: 'Impares', value: dstats.odd_pct }]} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                              <Cell fill="var(--primary)" />
                              <Cell fill="var(--accent-gold)" />
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-3.5 text-[10px] text-muted-foreground">
                          <span><span className="text-primary font-bold">&#9679;</span> Pares</span>
                          <span><span className="text-accent-gold font-bold">&#9679;</span> Impares</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-muted-foreground mb-2.5">Distribuicao por Dezenas</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={dstats.range_distribution}>
                            <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                            <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                              {dstats.range_distribution.map((_, i) => <Cell key={i} fill={['#6edba6', '#30a373', '#7ec8e3', '#e9c349', '#f0a040', '#e06030'][i]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <p className="text-[11px] font-bold text-muted-foreground mb-2.5">Soma dos Numeros</p>
                        <ResponsiveContainer width="100%" height={140}>
                          <BarChart data={dstats.sum_distribution}>
                            <XAxis dataKey="label" tick={{ fill: 'var(--muted-foreground)', fontSize: 8 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#e0e0e0' }} labelStyle={{ color: '#e0e0e0', fontWeight: 600 }} />
                            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#5b9bd5" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Backup */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[13px] font-bold text-foreground">Backup completo</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleCheckIntegrity} disabled={checkingIntegrity} className="gap-1.5 text-[11px]">
                    {checkingIntegrity ? <Loader2 size={12} className="animate-spin" /> : <Database size={12} />} Verificar integridade
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportSql} className="gap-1.5 text-[11px]"><Download size={12} /> Exportar SQL</Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-[11px]"><Upload size={12} /> Importar SQL</Button>
                </div>
              </div>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                <span>Inclui todos os concursos, jogos salvos, configuracoes e estatisticas</span>
                {lastBackupDate && (
                  <span className="shrink-0 text-[10px] bg-muted px-2 py-0.5 rounded-md">Ultimo backup: {lastBackupDate}</span>
                )}
              </div>
              {tableCounts && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[11px] font-bold mb-2 text-foreground">Integridade do banco de dados</p>
                  <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                    {tableCounts.map(([table, count]) => (
                      <div key={table} className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">{table}</span>
                        <span className={cn('font-bold tabular-nums', count > 0 ? 'text-green-500' : 'text-muted-foreground')}>{count.toLocaleString('pt-BR')}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">
                    Total: {tableCounts.reduce((sum, [, c]) => sum + c, 0).toLocaleString('pt-BR')} registros em {tableCounts.filter(([, c]) => c > 0).length} tabelas ativas
                  </p>
                </div>
              )}
              <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportFileSelect} className="hidden" />
            </CardContent>
          </Card>

          {/* Import confirmation dialog */}
          {showImportConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <Card className="w-[420px] shadow-2xl">
                <CardContent className="p-6">
                  <h3 className="text-base font-bold mb-2 text-foreground">Confirmar importacao</h3>
                  <p className="text-[13px] text-muted-foreground mb-1">
                    Voce esta prestes a importar o arquivo:
                  </p>
                  <p className="text-[13px] font-semibold text-foreground mb-3">{importPending?.name}</p>
                  <p className="text-[12px] text-muted-foreground mb-4">
                    Dados existentes podem ser atualizados. Recomendamos exportar um backup antes de continuar.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => { setShowImportConfirm(false); setImportPending(null) }}>Cancelar</Button>
                    <Button size="sm" onClick={handleImportConfirm} className="gap-1.5"><Upload size={12} /> Confirmar importacao</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      <p className="text-[9px] text-center text-muted-foreground/35 pb-1">Analises baseadas em historico. Nao garantem resultados.</p>
    </div>
  )
}

function MiniCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <p className="text-[10px] font-semibold text-muted-foreground mb-1">{label}</p>
        <p className={cn('font-extrabold', accent ? 'text-[22px] text-primary' : 'text-sm text-foreground')}>{value}</p>
      </CardContent>
    </Card>
  )
}
