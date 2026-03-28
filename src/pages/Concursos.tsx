import { useState, useEffect } from 'react'
import { api, type Contest, type ContestSearchResult, type BetCheckResult } from '../lib/tauri'
import { useAppStore } from '../stores/appStore'
import { useLotteryStore } from '../stores/lotteryStore'
import LotteryTabs from '../components/LotteryTabs'
import NumberBall from '../components/NumberBall'
import { Search, ChevronLeft, ChevronRight, Save, Trophy } from 'lucide-react'

function SuperSeteColumnBalls({ numbers, size = 'md', variant = 'primary', animated = false }: { numbers: number[]; size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'gold' | 'muted'; animated?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: size === 'sm' ? 3 : size === 'md' ? 6 : 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      {numbers.map((n, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <span style={{ fontSize: size === 'sm' ? 8 : size === 'md' ? 9 : 10, fontWeight: 700, color: 'var(--ml-primary)', opacity: 0.7 }}>C{i + 1}</span>
          <NumberBall number={n} size={size} variant={variant} animated={animated} delay={animated ? i * 70 : 0} />
        </div>
      ))}
    </div>
  )
}

export default function Concursos() {
  const { showToast } = useAppStore()
  const { enabledGames, activeGame, setActiveGame } = useLotteryStore()
  const [result, setResult] = useState<ContestSearchResult | null>(null)
  const [searchNumber, setSearchNumber] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Contest | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkResults, setCheckResults] = useState<BetCheckResult[] | null>(null)
  const [checkingMyGames, setCheckingMyGames] = useState(false)

  const load = async (p = page) => {
    setLoading(true)
    try {
      const d = await api.searchContests({ search_number: searchNumber ? parseInt(searchNumber) : null, date_from: dateFrom || null, date_to: dateTo || null, page: p, per_page: 20, game_type: activeGame })
      setResult(d)
      if (d.contests.length > 0 && !selected) sel(d.contests[0])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load(1) }, [])
  useEffect(() => { setSelected(null); setCheckResults(null); setPage(1); load(1) }, [activeGame])

  const sel = async (c: Contest) => { setCheckResults(null); try { const d = await api.getContestDetails(c.contest_number, activeGame); setSelected(d || c) } catch { setSelected(c) } }
  const fmt = (v: number | null) => !v ? '-' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const saveContest = async () => {
    if (!selected) return
    try {
      await api.saveGame({ numbers: selected.numbers_sorted, strategy_id: 'concurso', strategy_label: `Concurso #${selected.contest_number}`, game_type: activeGame })
      showToast('Jogo salvo em Meus Jogos!', 'success')
    } catch (e: any) { showToast(e?.toString() || 'Erro ao salvar', 'error') }
  }

  const handleCheckMyGames = async () => {
    if (!selected) return
    setCheckingMyGames(true)
    try {
      const results = await api.checkBetResultsForContest(activeGame, selected.contest_number)
      setCheckResults(results)
      if (results.length === 0) {
        showToast('Nenhuma aposta marcada em Meus Jogos.', 'info')
      }
    } catch (e: any) { showToast(e?.toString() || 'Erro ao conferir', 'error') }
    finally { setCheckingMyGames(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {enabledGames.length > 0 && (
        <div style={{ padding: '12px 28px 0', flexShrink: 0 }}>
          <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={(gt) => { setActiveGame(gt); setSelected(null); setPage(1) }} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(320px, 420px)', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <div style={{ padding: '16px 28px 12px', background: 'var(--ml-surface-low)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ml-on-surface)', margin: 0 }}>Concursos</h2>
              {result && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ml-on-surface-variant)', background: 'var(--ml-surface-high)', padding: '3px 10px', borderRadius: 8 }}>{result.total.toLocaleString('pt-BR')} concursos</span>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" placeholder="N.º do concurso" value={searchNumber} onChange={e => setSearchNumber(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} className="input-filled" style={{ width: 130, fontSize: 13 }} />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input-filled" style={{ minHeight: 48, fontSize: 16, padding: '8px 12px' }} />
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input-filled" style={{ minHeight: 48, fontSize: 16, padding: '8px 12px' }} />
              <button className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }} onClick={() => { setPage(1); load(1) }}><Search size={14} /> Buscar</button>
            </div>
          </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px' }}>
          {loading && <p style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>Carregando...</p>}
          {result?.contests.length === 0 && <p style={{ textAlign: 'center', padding: 40, fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>Nenhum encontrado.</p>}
          {result?.contests.map((c, i) => {
            const act = selected?.contest_number === c.contest_number
            const manyNums = c.numbers_sorted.length > 8
            // Use dedicated fields for extra info
            let extraInfo: string | null = null
            if (c.time_coracao) extraInfo = `💚 ${c.time_coracao}`
            else if (c.mes_sorte) extraInfo = `📅 ${c.mes_sorte}`
            return (
              <button key={c.id} onClick={() => sel(c)} style={{
                width: '100%', textAlign: 'left', padding: manyNums ? '10px 14px' : '8px 14px', borderRadius: 10,
                display: 'flex', flexDirection: manyNums ? 'column' : 'row', alignItems: manyNums ? 'flex-start' : 'center',
                justifyContent: manyNums ? 'flex-start' : 'space-between', gap: manyNums ? 8 : 0,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 2,
                minHeight: 48, transition: 'all 0.12s ease',
                background: act ? 'var(--ml-surface-high)' : i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--ml-surface-low) 50%, transparent)',
                color: 'var(--ml-on-surface)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: manyNums ? '100%' : 'auto' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--ml-primary)', whiteSpace: 'nowrap' }}>#{c.contest_number}</span>
                  <span style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)' }}>{c.contest_date}</span>
                  {!c.accumulated && <span title="Teve ganhador(es)"><Trophy size={13} style={{ color: 'var(--ml-secondary)', flexShrink: 0 }} /></span>}
                  {c.accumulated && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--ml-secondary)', background: 'color-mix(in srgb, var(--ml-secondary) 15%, transparent)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase' }}>Acumulou</span>}
                  {extraInfo && <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--ml-on-surface-variant)' }}>{extraInfo}</span>}
                </div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', flexShrink: manyNums ? 1 : 0, alignItems: 'center' }}>
                  {activeGame === 'supersete'
                    ? <SuperSeteColumnBalls numbers={c.numbers_sorted} size="sm" variant={act ? 'primary' : 'muted'} />
                    : c.numbers_sorted.map(n => <NumberBall key={n} number={n} size="sm" variant={act ? 'primary' : 'muted'} />)}
                  {(() => { let tv: (string|number)[] = []; try { if (c.trevos_json) tv = JSON.parse(c.trevos_json) } catch {} return tv.length > 0 ? (
                    <>
                      <span style={{ width: 1, height: 20, background: 'var(--ml-outline-variant)', margin: '0 2px' }} />
                      {tv.map((t, ti) => (
                        <span key={`t-${ti}`} style={{ width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #f59e0b, #d97706)', color: '#fff', fontSize: 10, fontWeight: 800, fontFamily: 'monospace' }}>
                          {String(t).padStart(2, '0')}
                        </span>
                      ))}
                    </>
                  ) : null })()}
                </div>
              </button>
            )
          })}
        </div>

        {/* Pagination */}
        {result && result.total_pages > 1 && (
          <div style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--ml-surface-low)', flexShrink: 0 }}>
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => { setPage(page-1); load(page-1) }} disabled={page <= 1}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)' }}>Página {page} de {result.total_pages} · {result.total} concursos</span>
            <button className="btn-ghost" style={{ padding: '6px 10px' }} onClick={() => { setPage(page+1); load(page+1) }} disabled={page >= result.total_pages}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      <div style={{ overflow: 'auto', padding: 24, background: 'var(--ml-surface-low)', borderLeft: '1px solid var(--ml-outline-variant)' }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn-primary" style={{ fontSize: 12, padding: '10px 14px', flex: 1, justifyContent: 'center' }} onClick={saveContest}>
                <Save size={14} /> Salvar em Meus Jogos
              </button>
              <button className="btn-secondary" style={{ fontSize: 12, padding: '10px 14px', flex: 1, justifyContent: 'center' }} onClick={handleCheckMyGames} disabled={checkingMyGames}>
                <Trophy size={14} /> {checkingMyGames ? 'Conferindo...' : 'Conferir meus jogos'}
              </button>
            </div>
            {/* Check my games results */}
            {checkResults && checkResults.length > 0 && (
              <div style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--ml-secondary) 10%, var(--ml-surface-container)), var(--ml-surface-container))', borderRadius: 12, padding: 14, border: '1px solid color-mix(in srgb, var(--ml-secondary) 20%, transparent)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Trophy size={15} style={{ color: 'var(--ml-secondary)' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ml-secondary)' }}>Minhas apostas vs Concurso #{selected.contest_number}</span>
                  <button onClick={() => setCheckResults(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ml-on-surface-variant)', fontSize: 10 }}>Fechar</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {checkResults.map(r => (
                    <div key={r.game_id} style={{ background: 'var(--ml-surface-low)', borderRadius: 10, padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginBottom: 6 }}>
                        {r.game_numbers.map(n => (
                          <span key={n} style={{
                            width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
                            background: r.hits.includes(n) ? 'linear-gradient(145deg, var(--ml-primary), var(--ml-primary-container))' : 'var(--ml-surface-highest)',
                            color: r.hits.includes(n) ? 'var(--ml-on-primary)' : 'var(--ml-on-surface-variant)',
                            boxShadow: r.hits.includes(n) ? 'inset 0 1px 3px rgba(255,255,255,0.3)' : 'none',
                          }}>{String(n).padStart(2, '0')}</span>
                        ))}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 800, color: r.hit_count >= 4 ? 'var(--ml-secondary)' : 'var(--ml-on-surface)' }}>{r.prize_label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {checkResults && checkResults.length === 0 && (
              <div style={{ background: 'var(--ml-surface-container)', borderRadius: 12, padding: 14, textAlign: 'center' }}>
                <p style={{ fontSize: 12, color: 'var(--ml-on-surface-variant)' }}>Nenhum jogo marcado como apostado em Meus Jogos.</p>
              </div>
            )}

            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ml-on-surface)' }}>Concurso {selected.contest_number}</h3>
              <p style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{selected.contest_date}</p>
              {selected.location && <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 2 }}>{selected.location}</p>}
            </div>

            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)', marginBottom: 10 }}>Dezenas sorteadas</p>
              {activeGame === 'supersete' ? (
                <SuperSeteColumnBalls numbers={selected.numbers_sorted} size="lg" animated />
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {selected.numbers_sorted.map((n, i) => <NumberBall key={n} number={n} size="lg" animated delay={i * 70} />)}
                </div>
              )}
            </div>

            {/* All contest info parsed from raw_json */}
            <ContestDetails contest={selected} fmt={fmt} />
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>Selecione um concurso</p>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}

function ContestDetails({ contest, fmt }: { contest: Contest; fmt: (v: number | null) => string }) {
  // Parse raw_json for extra fields
  let raw: any = {}
  try { if (contest.raw_json) raw = JSON.parse(contest.raw_json) } catch {}

  const localGanhadores: any[] = raw.localGanhadores || []
  const valorAcumulado05 = raw.valorAcumuladoConcurso_0_5
  const valorAcumuladoEspecial = raw.valorAcumuladoConcursoEspecial
  const valorAcumuladoProx = raw.valorAcumuladoProximoConcurso
  const observacao = raw.observacao
  const concursoEspecial = raw.concursoEspecial
  const dezenasOrdem = raw.dezenasOrdemSorteio || []
  // Use dedicated columns first, fallback to raw_json
  const timeCoracao = contest.time_coracao || raw.timeCoracao || raw.nomeTimeCoracao || null
  const mesSorte = contest.mes_sorte || raw.mesSorte || raw.nomesMesDaSorte || null
  let trevos: (string | number)[] = []
  if (contest.trevos_json) { try { trevos = JSON.parse(contest.trevos_json) } catch {} }
  if (trevos.length === 0) { trevos = raw.trevosSorteados || raw.trevos || [] }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Basic info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Acumulou" value={contest.accumulated ? 'Sim' : 'Não'} color={contest.accumulated ? 'var(--ml-secondary)' : 'var(--ml-primary)'} />
        {concursoEspecial && <Row label="Concurso especial" value="Sim" color="var(--ml-secondary)" />}
        {contest.amount_collected != null && contest.amount_collected > 0 && <Row label="Arrecadação" value={fmt(contest.amount_collected)} />}
        {contest.estimated_next_prize != null && contest.estimated_next_prize > 0 && <Row label="Prêmio est. próx." value={fmt(contest.estimated_next_prize)} color="var(--ml-secondary)" />}
        {valorAcumulado05 != null && valorAcumulado05 > 0 && <Row label="Acumulado Mega da Virada" value={fmt(valorAcumulado05)} />}
        {valorAcumuladoEspecial != null && valorAcumuladoEspecial > 0 && <Row label="Acumulado especial" value={fmt(valorAcumuladoEspecial)} />}
        {valorAcumuladoProx != null && valorAcumuladoProx > 0 && <Row label="Acumulado próx." value={fmt(valorAcumuladoProx)} />}
        {contest.next_contest_number && <Row label="Próximo concurso" value={`#${contest.next_contest_number}`} />}
        {contest.next_contest_date && <Row label="Data próximo" value={contest.next_contest_date} />}
      </div>

      {/* Time do Coração (Timemania) */}
      {timeCoracao && (
        <div style={{ background: 'color-mix(in srgb, var(--ml-primary) 8%, var(--ml-surface-container))', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>💚</span>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)' }}>Time do Coração</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ml-primary)', marginTop: 2 }}>{timeCoracao}</p>
          </div>
        </div>
      )}

      {/* Mês da Sorte (Dia de Sorte) */}
      {mesSorte && (
        <div style={{ background: 'color-mix(in srgb, var(--ml-secondary) 8%, var(--ml-surface-container))', borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>📅</span>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)' }}>Mês da Sorte</p>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ml-secondary)', marginTop: 2 }}>{mesSorte}</p>
          </div>
        </div>
      )}

      {/* Trevos (+Milionária) */}
      {trevos.length > 0 && (
        <div style={{ background: 'color-mix(in srgb, var(--ml-info) 8%, var(--ml-surface-container))', borderRadius: 12, padding: '12px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>Trevos sorteados</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {trevos.map((t: string | number, i: number) => (
              <span key={i} style={{ width: 40, height: 40, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #f59e0b, #d97706)', color: '#fff', fontSize: 15, fontWeight: 800, fontFamily: 'monospace', boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 6px rgba(0,0,0,0.2)' }}>
                {String(t).padStart(2, '0')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Draw order */}
      {dezenasOrdem.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)', marginBottom: 6 }}>Ordem do sorteio</p>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {dezenasOrdem.map((d: string, i: number) => (
              <span key={i} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, padding: '4px 8px', borderRadius: 6, background: 'var(--ml-surface-container)', color: 'var(--ml-on-surface)' }}>
                {i+1}° {d}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prizes */}
      {contest.prizes.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>Premiação</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {contest.prizes.map((p, i) => (
              <div key={i} style={{ background: 'var(--ml-surface-container)', borderRadius: 10, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--ml-on-surface-variant)' }}>{p.description || `Faixa ${p.range_number}`}</span>
                  <span style={{ fontWeight: 700 }}>{fmt(p.prize_value)}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--ml-on-surface-variant)', marginTop: 4 }}>{p.winners_count || 0} ganhador{(p.winners_count || 0) !== 1 ? 'es' : ''}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Winners locations */}
      {localGanhadores.length > 0 && (
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ml-on-surface-variant)', marginBottom: 8 }}>Local dos ganhadores</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {localGanhadores.map((lg: any, i: number) => (
              <div key={i} style={{ background: 'var(--ml-surface-container)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <span style={{ fontWeight: 600, color: 'var(--ml-primary)' }}>{lg.municipio || 'N/A'}</span>
                <span style={{ color: 'var(--ml-on-surface-variant)' }}> — {lg.uf || ''}</span>
                {lg.ganhadores > 1 && <span style={{ color: 'var(--ml-secondary)', marginLeft: 8 }}>({lg.ganhadores} ganhadores)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Observation */}
      {observacao && observacao.trim() && (
        <div style={{ background: 'var(--ml-surface-container)', borderRadius: 10, padding: 12, fontSize: 12, color: 'var(--ml-on-surface-variant)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Observação</p>
          {observacao}
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 13, color: 'var(--ml-on-surface-variant)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 700, color: color || 'var(--ml-on-surface)' }}>{value}</span>
    </div>
  )
}
