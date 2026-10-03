import type { Rec } from '@/lib/records'
import { buildRelationships, type ClientSort } from '@/lib/v3/ledger'
import { QUIET_MONTHS } from '@/lib/v3/catalog'
import { withParam, type Filters } from '@/lib/v3/filters'
import FilterBar from '../FilterBar'
import RelationshipMap from '../RelationshipMap'
import Search from '../Search'
import { rmFull, money, longDate, shortDate } from '../fmt'
import { clientPulse } from '@/lib/v3/clients'
import { KpiCard } from '../summary/Panels'

// 👉 v3 Clients: who the business rests on, and who to call. Health (figures,
// the four groups, the relationship map and the re-pitch list), Who to call
// (clients past their usual gap, and how each year's new clients were kept),
// then every client. Analytics in lib/v3/clients.ts and lib/v3/ledger.ts.

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const SORTS: ClientSort[] = ['value', 'recent', 'quiet', 'jobs', 'name']
const SEG_NAME = { nurture: 'Nurture', repitch: 'Re-pitch', new: 'Newer, smaller', drifted: 'Drifted' } as const
const SEG_NOTE = {
  nurture: 'valuable and recent',
  repitch: 'valuable, gone quiet',
  new: 'smaller, recent',
  drifted: 'smaller, gone quiet',
} as const

export default function Clients({ rows, filters, sp }: { rows: Rec[]; filters: Filters; sp: Params }) {
  const raw = one(sp.sort) as ClientSort | undefined
  const sort: ClientSort = raw && SORTS.includes(raw) ? raw : 'value'
  const q = one(sp.q) ?? ''
  // Figures and groups come from every client in range; the search box only narrows the table.
  const { list: everyone, median, stats } = buildRelationships(rows, filters, sort)
  const searched = q ? buildRelationships(rows, filters, sort, q).list : everyone
  const SEGS = ['nurture', 'repitch', 'new', 'drifted'] as const
  const segRaw = one(sp.seg)
  const seg = SEGS.find(x => x === segRaw)
  const list = seg ? searched.filter(c => c.quadrant === seg) : searched
  const pulse = clientPulse(rows, filters)
  const groups = SEGS.map(id => {
    const xs = everyone.filter(c => c.quadrant === id)
    return { id, count: xs.length, rm: xs.reduce((t, c) => t + c.lifetime, 0) }
  })
  const segHref = (id?: string) => {
    const p = new URLSearchParams(withParam(filters, 'seg', id).slice(1))
    if (filters.range === 'all') p.delete('range')
    if (q) p.set('q', q)
    if (sort !== 'value') p.set('sort', sort)
    const str = p.toString()
    return `${str ? `?${str}` : '?'}#t-list`
  }
  const repitch = everyone.filter(c => c.quadrant === 'repitch').sort((a, b) => b.lifetime - a.lifetime)
  const sortHref = (s: ClientSort) => {
    const p = new URLSearchParams(withParam(filters, 'sort', s === 'value' ? undefined : s).slice(1))
    if (filters.range === 'all') p.delete('range')
    if (q) p.set('q', q)
    if (seg) p.set('seg', seg)
    const str = p.toString()
    return str ? `?${str}` : '?'
  }

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Clients</h1>
          <p className="v3-lede">
            {stats.clients} clients · {repitch.length} valuable relationship{repitch.length === 1 ? '' : 's'} gone quiet for{' '}
            {QUIET_MONTHS}+ months
          </p>
        </div>
      </header>

      <FilterBar filters={filters} clients={[]} clientPicker={false} fallback="all" />

      <div className="v3-grid">
        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Health</h2>
          <p className="v3-chapter-note">Who the business rests on, judged over each relationship&rsquo;s whole history.</p>
        </div>

        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="Figures">
          <KpiCard
            label="Active clients · 12 months"
            value={String(pulse.active12)}
            k={{ value: pulse.active12, prev: null, delta: null, spark: pulse.activeByMonth.map(m => m.count) }}
            note="clients invoiced each month, last two years"
          />
          <KpiCard label="New this year" value={String(pulse.newThisYear)} note="first-ever invoice this calendar year" />
          <KpiCard
            label="Hired you again · all time"
            value={`${Math.round(pulse.repeatRate * 100)}%`}
            note={pulse.medianGap !== null ? `of ${pulse.clients} clients ever · usually every ${Math.round(pulse.medianGap)} months` : `of ${pulse.clients} clients ever`}
          />
          <KpiCard label="Average lifetime value" value={rmFull(stats.average)} note={`${stats.clients} clients in range · median ${rmFull(median)}`} />
          <KpiCard label="Gone quiet" value={String(stats.quiet)} note={`of ${stats.clients} in range · no job for ${QUIET_MONTHS}+ months`} />
        </section>

        <nav className="v3-span-12 v3-segs" aria-label="Client groups">
          {groups.map(g => (
            <a key={g.id} className="v3-seg-card" data-seg={g.id} href={segHref(seg === g.id ? undefined : g.id)} aria-current={seg === g.id ? 'true' : undefined}>
              <span className="v3-seg-name">{SEG_NAME[g.id]}</span>
              <b className="num">{g.count}</b>
              <span className="v3-seg-note">
                {rmFull(g.rm)} lifetime · {SEG_NOTE[g.id]}
              </span>
            </a>
          ))}
        </nav>

        <section className="v3-panel v3-span-8" aria-labelledby="t-map">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-map">
              Relationship map
            </h2>
            <p className="v3-panel-note">Up is worth more · right is longer since the last job</p>
          </div>
          <RelationshipMap list={list} median={median} />
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="t-repitch">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-repitch">
              Worth a re-pitch
            </h2>
          </div>
          {repitch.length ? (
            <div className="v3-rows">
              {repitch.slice(0, 8).map(c => (
                <a key={c.client} className="v3-row" href={`/invoices?range=all&client=${encodeURIComponent(c.client)}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{c.client}</div>
                    <div className="v3-row-sub">
                      {c.jobs} job{c.jobs === 1 ? '' : 's'} · last {longDate(c.last)}
                    </div>
                  </div>
                  <div className="v3-row-num">{rmFull(c.lifetime)}</div>
                </a>
              ))}
            </div>
          ) : (
            <p className="v3-empty">Nobody valuable has gone quiet. Every bigger client has worked with you recently.</p>
          )}
        </section>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Who to call</h2>
          <p className="v3-chapter-note">Clients past their usual gap between jobs, and how well each year&rsquo;s new clients were kept.</p>
        </div>

        <section className="v3-panel v3-span-7" aria-labelledby="t-due">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-due">
              Due for a check-in
            </h2>
            <p className="v3-panel-note">Returning clients past their usual gap</p>
          </div>
          {pulse.due.length ? (
            <div className="v3-rows">
              {pulse.due.map(c => (
                <a key={c.client} className="v3-row" href={`/invoices?range=all&client=${encodeURIComponent(c.client)}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{c.client}</div>
                    <div className="v3-row-sub">
                      usually every {Math.max(1, Math.round(c.gapMonths))} month{Math.max(1, Math.round(c.gapMonths)) === 1 ? '' : 's'} · last {shortDate(c.last)} {c.last.slice(0, 4)} ·{' '}
                      <b className="v3-due">{Math.round(c.overdueMonths)} month{Math.round(c.overdueMonths) === 1 ? '' : 's'} past it</b>
                    </div>
                  </div>
                  <div className="v3-row-num">
                    {c.lifetime || !c.foreign.length ? rmFull(c.lifetime) : c.foreign.map(x => money(x.total, x.currency)).join(' + ')}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="v3-empty">Every returning client has worked with you within their usual gap.</p>
          )}
          <p className="v3-ins-foot" style={{ marginTop: 'var(--space-3)' }}>
            Clients with two or more jobs; their usual gap is the median time between them. Silent for {36}+ months counts as ended, not due.
          </p>
        </section>

        <section className="v3-panel v3-span-5" aria-labelledby="t-cohort">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-cohort">
              Kept clients, by first year
            </h2>
          </div>
          <div className="v3-keep" role="table" aria-label="Clients by the year of their first invoice">
            <div className="v3-keep-row v3-keep-head" role="row">
              <span role="columnheader">First job</span>
              <span role="columnheader">Clients</span>
              <span role="columnheader">Came back</span>
              <span role="columnheader" className="r">
                Later RM
              </span>
            </div>
            {pulse.cohorts.map(c => {
              const rate = c.clients ? c.cameBack / c.clients : 0
              return (
                <div className="v3-keep-row" role="row" key={c.year} data-progress={c.inProgress ? 'true' : undefined}>
                  <span role="rowheader" className="num">
                    {c.year}
                    {c.inProgress ? <small className="v3-keep-wip">so far</small> : null}
                  </span>
                  <span role="cell" className="num">
                    {c.clients}
                  </span>
                  <span role="cell" className="v3-keep-rate">
                    <i style={{ ['--w' as string]: rate.toFixed(3) }} aria-hidden="true" />
                    <b className="num">{Math.round(rate * 100)}%</b>
                  </span>
                  <span role="cell" className="r num">
                    {rmFull(c.laterRm)}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="v3-ins-foot" style={{ marginTop: 'var(--space-3)' }}>
            Came back = hired you again after their first job (any work type). This year&rsquo;s row is still in progress. Later RM =
            ringgit invoiced for their jobs after the first.
          </p>
        </section>

        <div className="v3-chapter v3-span-12">
          <h2 className="v3-chapter-title">Every client</h2>
          <p className="v3-chapter-note">{seg ? `Showing ${SEG_NAME[seg].toLowerCase()} only · ` : ''}sortable, searchable.</p>
        </div>

        <section className="v3-panel v3-span-12" aria-labelledby="t-list">
          <div className="v3-toolbar">
            <h2 className="v3-panel-title" id="t-list">
              Every client
            </h2>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span className="v3-count">{list.length} shown</span>
              <Search placeholder="Search client, contact or work" />
            </div>
          </div>
          <div className="v3-table-wrap">
            <table className="v3-table">
              <thead>
                <tr>
                  <th aria-sort={sort === 'name' ? 'ascending' : undefined}>
                    <a href={sortHref('name')}>Client</a>
                  </th>
                  <th>Contact</th>
                  <th aria-sort={sort === 'jobs' ? 'descending' : undefined}>
                    <a href={sortHref('jobs')}>Jobs</a>
                  </th>
                  <th>Work</th>
                  <th aria-sort={sort === 'recent' ? 'descending' : undefined}>
                    <a href={sortHref('recent')}>Last job</a>
                  </th>
                  <th aria-sort={sort === 'quiet' ? 'descending' : undefined}>
                    <a href={sortHref('quiet')}>Group</a>
                  </th>
                  <th className="r" aria-sort={sort === 'value' ? 'descending' : undefined}>
                    <a href={sortHref('value')}>Lifetime</a>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map(c => (
                  <tr key={c.client}>
                    <td>
                      <a href={`/invoices?range=all&client=${encodeURIComponent(c.client)}`}>{c.client}</a>
                      {c.address ? <div className="dim" style={{ fontSize: 12, marginTop: 2, maxWidth: 360 }}>{c.address}</div> : null}
                    </td>
                    <td className="dim">{c.contact ?? '—'}</td>
                    <td className="num">
                      {c.jobs}
                      {c.jobs > 1 ? <span className="v3-tag" style={{ marginLeft: 6 }}>returning</span> : null}
                    </td>
                    <td className="dim">{c.kinds.join(', ')}</td>
                    <td className="num dim">{c.last}</td>
                    <td>
                      <span className="v3-seg-tag" data-seg={c.quadrant}>
                        {SEG_NAME[c.quadrant]}
                      </span>
                      {c.monthsQuiet >= QUIET_MONTHS ? <span className="dim" style={{ marginLeft: 6, fontSize: 12 }}>{c.monthsQuiet}m quiet</span> : null}
                    </td>
                    <td className="r num">
                      {rmFull(c.lifetime)}
                      {c.foreign.map(f => (
                        <div key={f.currency} className="dim" style={{ fontSize: 12 }}>
                          + {money(f.total, f.currency)}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
