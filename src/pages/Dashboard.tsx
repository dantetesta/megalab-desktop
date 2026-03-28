import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import HeatMap from '@/components/HeatMap'
import { api, type DynamicDashboardStats, type SpecialFieldStat } from '@/lib/tauri'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { Database, RefreshCw, Dices, Search, FolderHeart, Loader2, Download, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'


const PERIOD_OPTIONS = [
  { label: 'Todos', value: null },
  { label: 'Ultimos 10', value: 10 },
  { label: 'Ultimos 20', value: 20 },
  { label: 'Ultimos 50', value: 50 },
  { label: 'Ultimos 100', value: 100 },
  { label: 'Ultimos 500', value: 500 },
  { label: 'Ultimos 1000', value: 1000 },
]

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

  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const gameTypes = enabledGames.map(g => g.game_type)
      let completed = 0
      for (const gt of gameTypes) {
        try { await api.syncGame(gt); completed++ } catch (e: any) { console.warn(`Sync ${gt}:`, e) }
      }
      showToast(`${completed} loteria${completed > 1 ? 's' : ''} sincronizada${completed > 1 ? 's' : ''}!`, 'success')
      loadDashboard()
    } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setSyncingAll(false) }
  }

  const handleExportSql = async () => { try { const s = await api.exportFullDatabaseSql(); const b = new Blob([s], { type: 'text/sql' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `megalab_backup.sql`; a.click(); URL.revokeObjectURL(u); showToast('Exportado!', 'success') } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') } }
  const handleImportSql = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; try { const r = await api.importDatabaseSql(await f.text()); showToast(r, 'success'); await loadDashboard() } catch (err: any) { showToast(err?.toString() || 'Erro', 'error') }; if (fileInputRef.current) fileInputRef.current.value = '' }

  if (!dashboard) return <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-primary" /></div>

  const top10 = dstats ? [...dstats.number_data].sort((a, b) => b.frequency - a.frequency).slice(0, 10) : []
  const delayed10 = dstats ? [...dstats.number_data].sort((a, b) => b.delay - a.delay).slice(0, 10) : []
  const activeConfig = enabledGames.find(g => g.game_type === activeGame)
  const tooltipStyle = { background: '#1a2024', border: 'none', borderRadius: 10, fontSize: 12, color: '#e0e8ec', fontFamily: 'Inter' }

  return (
    <div className="h-full overflow-auto px-9 py-7 flex flex-col gap-5">
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
            <span className="text-[13px] font-semibold">Sincronizando loterias habilitadas...</span>
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
            <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportSql} className="hidden" />
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
              { id: 'meus_jogos', icon: FolderHeart, label: 'Meus Jogos', color: 'var(--secondary)' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className="bg-card rounded-xl px-4 py-4 border-none cursor-pointer flex items-center gap-3 min-h-[56px] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div
                  className="w-[38px] h-[38px] rounded-[10px] flex items-center justify-center shrink-0"
                  style={{ background: `color-mix(in srgb, ${item.color} 15%, transparent)` }}
                >
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <span className="text-sm font-bold text-foreground">{item.label}</span>
              </button>
            ))}
          </div>

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
                          <span className="text-base font-extrabold text-secondary">{dstats.odd_pct.toFixed(1)}%</span>
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
                        <p className="text-[11px] font-bold text-secondary mb-2.5">Mais Atrasados</p>
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
                                <Tooltip contentStyle={tooltipStyle} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill={activeConfig?.color || 'var(--primary)'}>
                                  {specialStats.slice(0, 20).map((_, i) => (
                                    <Cell key={i} fill={i === 0 ? 'var(--secondary)' : i < 3 ? activeConfig?.color || 'var(--primary)' : 'var(--muted)'} />
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
                                <Tooltip contentStyle={tooltipStyle} />
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
                            <Tooltip contentStyle={tooltipStyle} />
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
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="delay" radius={[2, 2, 0, 0]} fill="var(--secondary)" />
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
                              <Cell fill="var(--secondary)" />
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex justify-center gap-3.5 text-[10px] text-muted-foreground">
                          <span><span className="text-primary font-bold">&#9679;</span> Pares</span>
                          <span><span className="text-secondary font-bold">&#9679;</span> Impares</span>
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
                            <Tooltip contentStyle={tooltipStyle} />
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
                            <Tooltip contentStyle={tooltipStyle} />
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
                  <Button variant="outline" size="sm" onClick={handleExportSql} className="gap-1.5 text-[11px]"><Download size={12} /> Exportar SQL</Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5 text-[11px]"><Upload size={12} /> Importar SQL</Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Inclui todos os concursos, jogos salvos, configuracoes e estatisticas</p>
              <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportSql} className="hidden" />
            </CardContent>
          </Card>
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
