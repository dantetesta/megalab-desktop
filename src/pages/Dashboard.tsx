import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useLotteryStore } from '../stores/lotteryStore'
import LotteryTabs from '../components/LotteryTabs'
import NumberBall from '../components/NumberBall'
import HeatMap from '../components/HeatMap'
import { api, type DynamicDashboardStats, type SpecialFieldStat } from '../lib/tauri'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { Database, RefreshCw, Dices, Search, FolderHeart, Loader2, Download, Upload } from 'lucide-react'

const PERIOD_OPTIONS = [
  { label: 'Todos', value: null },
  { label: 'Últimos 10', value: 10 },
  { label: 'Últimos 20', value: 20 },
  { label: 'Últimos 50', value: 50 },
  { label: 'Últimos 100', value: 100 },
  { label: 'Últimos 500', value: 500 },
  { label: 'Últimos 1000', value: 1000 },
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
      // Load special field stats for Timemania/Dia de Sorte
      if (activeGame === 'timemania' || activeGame === 'diadesorte') {
        api.getSpecialFieldStats(activeGame, period).then(setSpecialStats).catch(() => setSpecialStats([]))
      } else {
        setSpecialStats([])
      }
      // Load trevo stats for +Milionária
      if (activeGame === 'maismilionaria') {
        api.getTrevoStats(period).then(setTrevoStats).catch(() => setTrevoStats([]))
      } else {
        setTrevoStats([])
      }
    }
  }, [dashboard, period, activeGame])



  // Sync ALL enabled games
  const handleSyncAll = async () => {
    setSyncingAll(true)
    try {
      const gameTypes = enabledGames.map(g => g.game_type)
      let completed = 0
      for (const gt of gameTypes) {
        try {
          await api.syncGame(gt)
          completed++
        } catch (e: any) {
          console.warn(`Sync ${gt}:`, e)
        }
      }
      showToast(`${completed} loteria${completed > 1 ? 's' : ''} sincronizada${completed > 1 ? 's' : ''}!`, 'success')
      loadDashboard()
    } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') }
    finally { setSyncingAll(false) }
  }

  const handleExportSql = async () => { try { const s = await api.exportFullDatabaseSql(); const b = new Blob([s], { type: 'text/sql' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `megalab_backup.sql`; a.click(); URL.revokeObjectURL(u); showToast('Exportado!', 'success') } catch (e: any) { showToast(e?.toString() || 'Erro', 'error') } }
  const handleImportSql = async (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; try { const r = await api.importDatabaseSql(await f.text()); showToast(r, 'success'); await loadDashboard() } catch (err: any) { showToast(err?.toString() || 'Erro', 'error') }; if (fileInputRef.current) fileInputRef.current.value = '' }

  if (!dashboard) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Loader2 size={32} className="animate-spin" style={{ color: 'var(--ml-primary)' }} /></div>

  const top10 = dstats ? [...dstats.number_data].sort((a, b) => b.frequency - a.frequency).slice(0, 10) : []
  const delayed10 = dstats ? [...dstats.number_data].sort((a, b) => b.delay - a.delay).slice(0, 10) : []
  const activeConfig = enabledGames.find(g => g.game_type === activeGame)

  // Custom dark tooltip style for charts
  const tooltipStyle = { background: '#1a2024', border: 'none', borderRadius: 10, fontSize: 12, color: '#e0e8ec', fontFamily: 'Manrope' }

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '28px 36px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Início</h2>
          <p style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>Visão geral do seu LotoLab</p>
        </div>
        {!dashboard.db_is_empty && (
          <button className="btn-primary" style={{ fontSize: 11, padding: '8px 16px' }} onClick={handleSyncAll} disabled={syncingAll}>
            {syncingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sincronizar todas
          </button>
        )}
      </div>

      {/* Lottery tabs */}
      {enabledGames.length > 0 && (
        <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={setActiveGame} />
      )}

      {/* Sync progress (when syncing via button) */}
      {syncingAll && (
        <div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ml-primary) 10%, var(--ml-surface-low)), var(--ml-surface-low))', borderRadius: 14, padding: 16, border: '1px solid color-mix(in srgb, var(--ml-primary) 20%, transparent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--ml-primary)' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Sincronizando loterias habilitadas...</span>
          </div>
        </div>
      )}

      {/* Empty state - direct to Settings or restore backup */}
      {dashboard.db_is_empty && (
        <div style={{ background: 'var(--ml-surface-low)', borderRadius: 16, padding: '48px 40px', textAlign: 'center' }}>
          <Database size={40} style={{ color: 'var(--ml-primary)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 10 }}>Bem-vindo ao LotoLab!</h3>
          <p style={{ color: 'var(--ml-on-surface-variant)', maxWidth: 440, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Para começar, importe a base de dados em <strong>Configurações</strong> ou restaure um backup existente.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => setCurrentPage('settings')} style={{ fontSize: 14, padding: '14px 24px' }}>
              <Database size={16} /> Ir para Configurações
            </button>
            <button className="btn-ghost" onClick={() => fileInputRef.current?.click()} style={{ fontSize: 14, padding: '14px 24px' }}>
              <Upload size={16} /> Restaurar Backup
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportSql} style={{ display: 'none' }} />
        </div>
      )}

      {!dashboard.db_is_empty && (
        <>
          {/* Quick actions */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { id: 'gerador', icon: Dices, label: 'Gerar Jogo', color: 'var(--ml-primary)' },
              { id: 'concursos', icon: Search, label: 'Consultar Concursos', color: 'var(--ml-info)' },
              { id: 'meus_jogos', icon: FolderHeart, label: 'Meus Jogos', color: 'var(--ml-secondary)' },
            ].map(item => (
              <button key={item.id} onClick={() => setCurrentPage(item.id)} style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: '16px 18px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 12, minHeight: 56, transition: 'transform 0.15s' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${item.color} 15%, transparent)`, flexShrink: 0 }}>
                  <item.icon size={18} style={{ color: item.color }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ml-on-surface)' }}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Period filter + stats summary */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)' }}>
                Estatísticas — {activeConfig?.display_name || ''}
              </p>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PERIOD_OPTIONS.map(p => (
                  <button key={p.label} onClick={() => setPeriod(p.value)} style={{
                    padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
                    background: period === p.value ? 'color-mix(in srgb, var(--ml-primary) 15%, transparent)' : 'var(--ml-surface-high)',
                    color: period === p.value ? 'var(--ml-primary)' : 'var(--ml-on-surface-variant)',
                    transition: 'all 0.15s',
                  }}>{p.label}</button>
                ))}
              </div>
            </div>

            {loadingStats && <div style={{ textAlign: 'center', padding: 20 }}><Loader2 size={20} className="animate-spin" style={{ color: 'var(--ml-primary)' }} /></div>}

            {dstats && !loadingStats && (
              <>
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <MiniCard label="Intervalo" value={`#${dstats.first_contest} ao #${dstats.last_contest}`} />
                  <MiniCard label="Total de Sorteios" value={String(dstats.contest_count)} accent />
                  <MiniCard label="Média da Soma" value={dstats.avg_sum.toFixed(1)} />
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>Paridade</p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ml-primary)' }}>{dstats.even_pct.toFixed(1)}%</span>
                      <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--ml-secondary)' }}>{dstats.odd_pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, fontSize: 9, color: 'var(--ml-on-surface-variant)' }}>
                      <span>Pares</span><span>Ímpares</span>
                    </div>
                  </div>
                </div>

                {/* Top frequent + delayed as balls */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-primary)', marginBottom: 10 }}>Mais Frequentes</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {top10.map(d => (
                        <div key={d.number} style={{ textAlign: 'center' }}>
                          <NumberBall number={d.number} size="md" />
                          <p style={{ fontSize: 9, color: 'var(--ml-on-surface-variant)', marginTop: 2, fontWeight: 600 }}>{d.frequency}x</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-secondary)', marginBottom: 10 }}>Mais Atrasados</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {delayed10.map(d => (
                        <div key={d.number} style={{ textAlign: 'center' }}>
                          <NumberBall number={d.number} size="md" variant="gold" />
                          <p style={{ fontSize: 9, color: 'var(--ml-on-surface-variant)', marginTop: 2, fontWeight: 600 }}>{d.delay} conc.</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Heat Map + Special Stats side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: (specialStats.length > 0 || trevoStats.length > 0) ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Mapa de Calor — Volante</p>
                    <HeatMap data={dstats.number_data} highlighted={dashboard.last_contest_numbers || []} />
                  </div>

                  {/* Special field stats: Time do Coração / Mês da Sorte */}
                  {specialStats.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 12 }}>
                        {activeGame === 'timemania' ? '💚 Times do Coração — Frequência' : '📅 Meses da Sorte — Frequência'}
                      </p>
                      <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 16 }}>
                        <ResponsiveContainer width="100%" height={Math.max(200, specialStats.slice(0, 20).length * 28)}>
                          <BarChart data={specialStats.slice(0, 20)} layout="vertical" barCategoryGap="15%">
                            <XAxis type="number" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="label" width={activeGame === 'timemania' ? 140 : 90} tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="count" radius={[0, 6, 6, 0]} fill={activeConfig?.color || 'var(--ml-primary)'}>
                              {specialStats.slice(0, 20).map((_, i) => (
                                <Cell key={i} fill={i === 0 ? 'var(--ml-secondary)' : i < 3 ? activeConfig?.color || 'var(--ml-primary)' : 'var(--ml-surface-highest)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)', marginTop: 8, textAlign: 'center' }}>
                          {specialStats.length} {activeGame === 'timemania' ? 'times' : 'meses'} encontrados · Top 20
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Trevo stats (+Milionária) */}
                  {trevoStats.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 12 }}>
                        🍀 Trevos — Frequência
                      </p>
                      <div style={{ background: 'var(--ml-surface-container)', borderRadius: 14, padding: 16 }}>
                        <ResponsiveContainer width="100%" height={Math.max(160, trevoStats.length * 32)}>
                          <BarChart data={trevoStats} layout="vertical" barCategoryGap="20%">
                            <XAxis type="number" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <YAxis type="category" dataKey="label" width={80} tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={tooltipStyle} />
                            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                              {trevoStats.map((_, i) => (
                                <Cell key={i} fill={i === 0 ? '#f59e0b' : i < 3 ? '#d97706' : 'var(--ml-surface-highest)'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <p style={{ fontSize: 10, color: 'var(--ml-on-surface-variant)', marginTop: 8, textAlign: 'center' }}>
                          {trevoStats.length} trevos encontrados
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Charts: Frequency + Delay */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Frequência dos Números</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dstats.number_data}>
                        <XAxis dataKey="number" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="frequency" radius={[2, 2, 0, 0]} fill={activeConfig?.color || 'var(--ml-primary)'} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Atraso dos Números</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={dstats.number_data}>
                        <XAxis dataKey="number" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 8 }} axisLine={false} tickLine={false} interval={4} />
                        <YAxis tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="delay" radius={[2, 2, 0, 0]} fill="var(--ml-secondary)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Charts row 2: Paridade pie + Range dist + Sum dist */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>Paridade</p>
                    <ResponsiveContainer width="100%" height={130}>
                      <PieChart>
                        <Pie data={[{ name: 'Pares', value: dstats.even_pct }, { name: 'Ímpares', value: dstats.odd_pct }]} cx="50%" cy="50%" innerRadius={30} outerRadius={50} dataKey="value" stroke="none">
                          <Cell fill="var(--ml-primary)" />
                          <Cell fill="var(--ml-secondary)" />
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 14, fontSize: 10, color: 'var(--ml-on-surface-variant)' }}>
                      <span><span style={{ color: 'var(--ml-primary)', fontWeight: 700 }}>●</span> Pares</span>
                      <span><span style={{ color: 'var(--ml-secondary)', fontWeight: 700 }}>●</span> Ímpares</span>
                    </div>
                  </div>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Distribuição por Dezenas</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={dstats.range_distribution}>
                        <XAxis dataKey="label" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                          {dstats.range_distribution.map((_, i) => <Cell key={i} fill={['#6edba6', '#30a373', '#7ec8e3', '#e9c349', '#f0a040', '#e06030'][i]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Soma dos Números</p>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={dstats.sum_distribution}>
                        <XAxis dataKey="label" tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 8 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: 'var(--ml-on-surface-variant)', fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--ml-info)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Backup */}
          <div style={{ background: 'var(--ml-surface-low)', borderRadius: 14, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ml-on-surface)' }}>Backup completo</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }} onClick={handleExportSql}><Download size={12} /> Exportar SQL</button>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px' }} onClick={() => fileInputRef.current?.click()}><Upload size={12} /> Importar SQL</button>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', margin: 0 }}>Inclui todos os concursos, jogos salvos, configurações e estatísticas</p>
            <input ref={fileInputRef} type="file" accept=".sql" onChange={handleImportSql} style={{ display: 'none' }} />
          </div>
        </>
      )}

      <p style={{ fontSize: 9, textAlign: 'center', color: 'var(--ml-on-surface-variant)', opacity: 0.35, paddingBottom: 4 }}>Análises baseadas em histórico. Não garantem resultados.</p>
    </div>
  )
}

function MiniCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: '14px 16px' }}>
      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: accent ? 22 : 14, fontWeight: 800, color: accent ? 'var(--ml-primary)' : 'var(--ml-on-surface)' }}>{value}</p>
    </div>
  )
}
