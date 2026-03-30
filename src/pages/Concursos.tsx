import { useState, useEffect } from 'react'
import { api, type Contest, type ContestSearchResult, type BetCheckResult } from '@/lib/tauri'
import { useAppStore } from '@/stores/appStore'
import { useLotteryStore } from '@/stores/lotteryStore'
import LotteryTabs from '@/components/LotteryTabs'
import NumberBall from '@/components/NumberBall'
import BannerCarousel from '@/components/BannerCarousel'
import { cn } from '@/lib/utils'
import { Search, ChevronLeft, ChevronRight, Save, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function SuperSeteColumnBalls({ numbers, size = 'md', variant = 'primary', animated = false }: { numbers: number[]; size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'gold' | 'muted'; animated?: boolean }) {
  return (
    <div className={cn('flex flex-wrap items-end', size === 'sm' ? 'gap-1' : size === 'md' ? 'gap-1.5' : 'gap-2')}>
      {numbers.map((n, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5">
          <span className={cn('font-bold text-primary/70', size === 'sm' ? 'text-[8px]' : size === 'md' ? 'text-[9px]' : 'text-[10px]')}>C{i + 1}</span>
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
  const [contestScore, setContestScore] = useState<number | null>(null)

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

  const sel = async (c: Contest) => { setCheckResults(null); setContestScore(null); try { const d = await api.getContestDetails(c.contest_number, activeGame); setSelected(d || c) } catch { setSelected(c) } }

  useEffect(() => {
    if (selected) {
      api.analyzeGame(selected.numbers_sorted, activeGame).then(a => setContestScore(a.structural_score)).catch(() => setContestScore(null))
    } else {
      setContestScore(null)
    }
  }, [selected, activeGame])
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
      if (results.length === 0) showToast('Nenhuma aposta marcada em Meus Jogos.', 'info')
    } catch (e: any) { showToast(e?.toString() || 'Erro ao conferir', 'error') }
    finally { setCheckingMyGames(false) }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {enabledGames.length > 0 && (
        <div className="px-7 pt-3 shrink-0">
          <LotteryTabs games={enabledGames} activeGame={activeGame} onSelect={(gt) => { setActiveGame(gt); setSelected(null); setPage(1) }} />
        </div>
      )}
      <div className="grid grid-cols-[1fr_minmax(320px,420px)] flex-1 overflow-hidden">
        <div className="flex flex-col overflow-hidden min-w-0">
          <div className="px-7 pt-4 pb-3 bg-card shrink-0">
            <div className="flex items-center gap-2.5 mb-3">
              <h2 className="text-[1.2rem] font-bold text-foreground">Concursos</h2>
              {result && <Badge variant="secondary" className="text-xs">{result.total.toLocaleString('pt-BR')} concursos</Badge>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input type="text" placeholder="N. do concurso" value={searchNumber} onChange={e => setSearchNumber(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setPage(1), load(1))} className="w-[130px] text-[13px]" />
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px] min-h-[40px] px-3 text-[13px]" />
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px] min-h-[40px] px-3 text-[13px]" />
              <Button size="sm" onClick={() => { setPage(1); load(1) }} className="gap-1.5"><Search size={14} /> Buscar</Button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto px-2 py-1">
            {loading && <p className="text-center py-10 text-[13px] text-muted-foreground">Carregando...</p>}
            {result?.contests.length === 0 && <p className="text-center py-10 text-[13px] text-muted-foreground">Nenhum encontrado.</p>}
            {result?.contests.map((c, i) => {
              const act = selected?.contest_number === c.contest_number
              const manyNums = c.numbers_sorted.length > 8
              let extraInfo: string | null = null
              if (c.time_coracao) extraInfo = c.time_coracao
              else if (c.mes_sorte) extraInfo = c.mes_sorte
              return (
                <button
                  key={c.id}
                  onClick={() => sel(c)}
                  className={cn(
                    'w-full text-left px-3.5 rounded-[10px] border-none cursor-pointer mb-0.5',
                    'min-h-[48px] transition-all duration-150 text-foreground',
                    manyNums ? 'flex flex-col items-start justify-start py-2.5 gap-2' : 'flex flex-row items-center justify-between py-2',
                    act ? 'bg-accent' : i % 2 === 0 ? 'bg-transparent' : 'bg-card/50',
                  )}
                >
                  <div className={cn('flex items-center gap-2.5', manyNums && 'w-full')}>
                    <span className="font-mono font-bold text-[13px] text-primary whitespace-nowrap">#{c.contest_number}</span>
                    <span className="text-[11px] text-muted-foreground">{c.contest_date}</span>
                    {!c.accumulated && <Trophy size={13} className="text-accent-gold shrink-0" />}
                    {c.accumulated && <Badge variant="secondary" className="text-[9px] py-0 uppercase">Acumulou</Badge>}
                    {extraInfo && <span className="text-[10px] font-semibold text-muted-foreground">{extraInfo}</span>}
                  </div>
                  <div className="flex gap-1 flex-wrap shrink-0 items-center">
                    {activeGame === 'supersete'
                      ? <SuperSeteColumnBalls numbers={c.numbers_sorted} size="sm" variant={act ? 'primary' : 'muted'} />
                      : c.numbers_sorted.map(n => <NumberBall key={n} number={n} size="sm" variant={act ? 'primary' : 'muted'} />)}
                    {(() => { let tv: (string|number)[] = []; try { if (c.trevos_json) tv = JSON.parse(c.trevos_json) } catch {} return tv.length > 0 ? (
                      <>
                        <span className="w-px h-5 bg-border mx-0.5" />
                        {tv.map((t, ti) => (
                          <span key={`t-${ti}`} className="w-7 h-7 rounded-full inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[10px] font-extrabold font-mono">
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
            <div className="px-5 py-2.5 flex items-center justify-between bg-card shrink-0">
              <Button variant="ghost" size="sm" onClick={() => { setPage(page-1); load(page-1) }} disabled={page <= 1}><ChevronLeft size={16} /></Button>
              <span className="text-xs text-muted-foreground">Pagina {page} de {result.total_pages} - {result.total} concursos</span>
              <Button variant="ghost" size="sm" onClick={() => { setPage(page+1); load(page+1) }} disabled={page >= result.total_pages}><ChevronRight size={16} /></Button>
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="overflow-auto p-6 bg-card border-l border-border">
          {selected ? (
            <div className="flex flex-col gap-5">
              <div className="flex gap-1.5">
                <Button size="sm" onClick={saveContest} className="flex-1 justify-center gap-1.5"><Save size={14} /> Salvar em Meus Jogos</Button>
                <Button variant="secondary" size="sm" onClick={handleCheckMyGames} disabled={checkingMyGames} className="flex-1 justify-center gap-1.5">
                  <Trophy size={14} /> {checkingMyGames ? 'Conferindo...' : 'Conferir meus jogos'}
                </Button>
              </div>

              {/* Check results */}
              {checkResults && checkResults.length > 0 && (
                <Card className="border-[color-mix(in_srgb,var(--accent-gold)_20%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent-gold)_10%,var(--card)),var(--card))]">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <Trophy size={15} className="text-accent-gold" />
                      <span className="text-xs font-bold text-accent-gold">Minhas apostas vs Concurso #{selected.contest_number}</span>
                      <button onClick={() => setCheckResults(null)} className="ml-auto bg-transparent border-none cursor-pointer text-muted-foreground text-[10px]">Fechar</button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {checkResults.map(r => (
                        <div key={r.game_id} className="bg-card rounded-[10px] px-3 py-2.5">
                          <div className="flex gap-1 flex-wrap mb-1.5">
                            {r.game_numbers.map(n => (
                              <span key={n} className={cn(
                                'w-7 h-7 rounded-full inline-flex items-center justify-center text-[10px] font-bold font-mono',
                                r.hits.includes(n)
                                  ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-[inset_0_1px_3px_rgba(255,255,255,0.3)]'
                                  : 'bg-muted text-muted-foreground',
                              )}>{String(n).padStart(2, '0')}</span>
                            ))}
                          </div>
                          <span className={cn('text-xs font-extrabold', r.hit_count >= 4 ? 'text-accent-gold' : 'text-foreground')}>{r.prize_label}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {checkResults && checkResults.length === 0 && (
                <Card>
                  <CardContent className="p-3.5 text-center">
                    <p className="text-xs text-muted-foreground">Nenhum jogo marcado como apostado em Meus Jogos.</p>
                  </CardContent>
                </Card>
              )}

              <div>
                <h3 className="text-xl font-bold text-foreground">Concurso {selected.contest_number}</h3>
                <p className="text-[13px] text-muted-foreground mt-0.5">{selected.contest_date}</p>
                {selected.location && <p className="text-[11px] text-muted-foreground mt-0.5">{selected.location}</p>}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2.5">Dezenas sorteadas</p>
                {activeGame === 'supersete' ? (
                  <SuperSeteColumnBalls numbers={selected.numbers_sorted} size="lg" animated />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selected.numbers_sorted.map((n, i) => <NumberBall key={n} number={n} size="lg" animated delay={i * 70} />)}
                  </div>
                )}
                {contestScore !== null && (
                  <div className="mt-2">
                    <Badge className="text-xs">{Math.round(contestScore)} {contestScore >= 80 ? 'Excelente' : contestScore >= 60 ? 'Bom' : 'Regular'}</Badge>
                  </div>
                )}
              </div>

              <ContestDetails contest={selected} fmt={fmt} />

              <BannerCarousel position="internal" className="mt-6" />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-[13px] text-muted-foreground">Selecione um concurso</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ContestDetails({ contest, fmt }: { contest: Contest; fmt: (v: number | null) => string }) {
  let raw: any = {}
  try { if (contest.raw_json) raw = JSON.parse(contest.raw_json) } catch {}

  const localGanhadores: any[] = raw.localGanhadores || []
  const valorAcumulado05 = raw.valorAcumuladoConcurso_0_5
  const valorAcumuladoEspecial = raw.valorAcumuladoConcursoEspecial
  const valorAcumuladoProx = raw.valorAcumuladoProximoConcurso
  const observacao = raw.observacao
  const concursoEspecial = raw.concursoEspecial
  const dezenasOrdem = raw.dezenasOrdemSorteio || []
  const timeCoracao = contest.time_coracao || raw.timeCoracao || raw.nomeTimeCoracao || null
  const mesSorte = contest.mes_sorte || raw.mesSorte || raw.nomesMesDaSorte || null
  let trevos: (string | number)[] = []
  if (contest.trevos_json) { try { trevos = JSON.parse(contest.trevos_json) } catch {} }
  if (trevos.length === 0) { trevos = raw.trevosSorteados || raw.trevos || [] }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Row label="Acumulou" value={contest.accumulated ? 'Sim' : 'Nao'} color={contest.accumulated ? 'var(--accent-gold)' : 'var(--primary)'} />
        {concursoEspecial && <Row label="Concurso especial" value="Sim" color="var(--accent-gold)" />}
        {contest.amount_collected != null && contest.amount_collected > 0 && <Row label="Arrecadacao" value={fmt(contest.amount_collected)} />}
        {contest.estimated_next_prize != null && contest.estimated_next_prize > 0 && <Row label="Premio est. prox." value={fmt(contest.estimated_next_prize)} color="var(--accent-gold)" />}
        {valorAcumulado05 != null && valorAcumulado05 > 0 && <Row label="Acumulado Mega da Virada" value={fmt(valorAcumulado05)} />}
        {valorAcumuladoEspecial != null && valorAcumuladoEspecial > 0 && <Row label="Acumulado especial" value={fmt(valorAcumuladoEspecial)} />}
        {valorAcumuladoProx != null && valorAcumuladoProx > 0 && <Row label="Acumulado prox." value={fmt(valorAcumuladoProx)} />}
        {contest.next_contest_number && <Row label="Proximo concurso" value={`#${contest.next_contest_number}`} />}
        {contest.next_contest_date && <Row label="Data proximo" value={contest.next_contest_date} />}
      </div>

      {timeCoracao && (
        <Card className="bg-primary/8">
          <CardContent className="px-4 py-3 flex items-center gap-2.5">
            <span className="text-lg">💚</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Time do Coracao</p>
              <p className="text-[15px] font-extrabold text-primary mt-0.5">{timeCoracao}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {mesSorte && (
        <Card className="bg-[color-mix(in_srgb,var(--accent-gold)_8%,var(--card))]">
          <CardContent className="px-4 py-3 flex items-center gap-2.5">
            <span className="text-lg">📅</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mes da Sorte</p>
              <p className="text-[15px] font-extrabold text-accent-gold mt-0.5">{mesSorte}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {trevos.length > 0 && (
        <Card className="bg-blue-500/8">
          <CardContent className="px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Trevos sorteados</p>
            <div className="flex gap-2">
              {trevos.map((t: string | number, i: number) => (
                <span key={i} className="w-10 h-10 rounded-full inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 text-white text-[15px] font-extrabold font-mono shadow-[inset_0_2px_4px_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.2)]">
                  {String(t).padStart(2, '0')}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dezenasOrdem.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Ordem do sorteio</p>
          <div className="flex gap-1 flex-wrap">
            {dezenasOrdem.map((d: string, i: number) => (
              <span key={i} className="font-mono font-bold text-[13px] px-2 py-1 rounded-md bg-card text-foreground">{i+1}° {d}</span>
            ))}
          </div>
        </div>
      )}

      {contest.prizes.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Premiacao</p>
          <div className="flex flex-col gap-1.5">
            {contest.prizes.map((p, i) => (
              <Card key={i}>
                <CardContent className="p-3">
                  <div className="flex justify-between text-[13px]">
                    <span className="text-muted-foreground">{p.description || `Faixa ${p.range_number}`}</span>
                    <span className="font-bold">{fmt(p.prize_value)}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{p.winners_count || 0} ganhador{(p.winners_count || 0) !== 1 ? 'es' : ''}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {localGanhadores.length > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Local dos ganhadores</p>
          <div className="flex flex-col gap-1">
            {localGanhadores.map((lg: any, i: number) => (
              <div key={i} className="bg-card rounded-lg px-3 py-2 text-xs">
                <span className="font-semibold text-primary">{lg.municipio || 'N/A'}</span>
                <span className="text-muted-foreground"> - {lg.uf || ''}</span>
                {lg.ganhadores > 1 && <span className="text-accent-gold ml-2">({lg.ganhadores} ganhadores)</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {observacao && observacao.trim() && (
        <Card>
          <CardContent className="p-3 text-xs text-muted-foreground">
            <p className="text-[10px] font-bold uppercase tracking-wider mb-1">Observacao</p>
            {observacao}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-sm font-bold" style={{ color: color || 'var(--foreground)' }}>{value}</span>
    </div>
  )
}
