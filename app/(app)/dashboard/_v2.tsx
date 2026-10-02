// 👉 Dashboard v2 — the operating picture. Reads top to bottom the way a
// briefing does: where the year stands, what needs a decision, what kind of work
// the money came from, when it landed, and who moved. Every figure on this page
// is computed in lib/analytics.ts from the invoice rows; nothing is estimated.
import Link from 'next/link'
import { type Rec } from '@/lib/records'
import { type IgSnapshot, type AudienceView } from '@/lib/instagram'
import { operatingPicture, mixOverTime, categories } from '@/lib/analytics'
import MixTrend from '@/app/_components/MixTrend'
import Rhythm from '@/app/_components/Rhythm'
import Delta from '@/app/_components/Delta'

const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`
const short = (name: string) => name.replace(/,? (Sdn\.? ?Bhd\.?|Pte\.? ?Ltd\.?|Berhad|Limited|LLC)\.?$/i, '')
const monthName = (iso: string) =>
  new Date(`${iso}-01T00:00:00Z`).toLocaleString('en-MY', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export default function DashboardV2({ rows, snap, ig = null }: { rows: Rec[]; snap: IgSnapshot | null; ig?: AudienceView | null }) {
  const p = operatingPicture(rows)
  const { kpis, revenue, prior, count, priorCount } = p

  const growth = prior ? ((revenue - prior) / prior) * 100 : null
  const lenses = [
    { id: 'service', label: 'What you did', buckets: mixOverTime(p.book, 'service'), lines: categories(p.book, 'service') },
    { id: 'sector', label: 'Who paid', buckets: mixOverTime(p.book, 'sector'), lines: categories(p.book, 'sector') },
  ]
  const peak = [...p.seasonality].sort((a, b) => b.total - a.total)[0]
  const trough = [...p.seasonality].filter(s => s.count > 0).sort((a, b) => a.total - b.total)[0]
  const seasonPeak = Math.max(...p.seasonality.map(s => s.total), 1)

  return (
    <div className="brief">
      <header className="brief-head">
        <h1>Operating picture</h1>
        <p className="brief-lede">
          You invoiced <strong>{rm(revenue)}</strong> over the last twelve months
          {growth === null ? (
            '.'
          ) : growth >= 0 ? (
            <>
              {' '}
              — <strong>{Math.round(growth)}% more</strong> than the year before, across {count} invoices instead of{' '}
              {priorCount}.
            </>
          ) : (
            <>
              {' '}
              — <strong>{Math.round(Math.abs(growth))}% less</strong> than the year before, across {count} invoices
              against {priorCount}.
            </>
          )}
        </p>
        <p className="brief-by">
          <img src="/img/aereon.jpg" alt="" aria-hidden="true" />
          Aereon Wong · tech &amp; travel content creator, Kuala Lumpur · {p.clientCount} clients,{' '}
          {p.invoiceCount} invoices since {p.firstInvoice ? monthName(p.firstInvoice.slice(0, 7)) : '—'}
          {p.invoiceCount > p.rmInvoiceCount ? (
            <> · {p.invoiceCount - p.rmInvoiceCount} in foreign currency, kept out of the ringgit totals</>
          ) : null}
        </p>
      </header>

      {/* ---- the four figures that decide how the year is going ---- */}
      <section className="figures" aria-label="Headline figures">
        {kpis.map(k => (
          <Link href={k.href ?? '/invoices'} key={k.key} className="figure">
            <span className="figure-label">{k.label}</span>
            <span className="figure-value">
              {k.unit === 'rm' ? rm(k.value) : `${Math.round(k.value)}%`}
              <Delta value={k.delta} better={k.better} />
            </span>
            <span className="figure-note">{k.note}</span>
          </Link>
        ))}
      </section>

      {/* ---- exceptions first: what an analyst would raise ---- */}
      <section className="panel" aria-labelledby="h-attention">
        <h2 id="h-attention">Needs a decision</h2>
        {p.signals.length ? (
          <ul className="signals">
            {p.signals.map(s => (
              <li key={s.id} className={`signal ${s.level}`}>
                <span className="signal-dot" aria-hidden="true" />
                <div className="signal-body">
                  <p className="signal-head">{s.headline}</p>
                  <p className="signal-detail">{s.detail}</p>
                </div>
                <div className="signal-end">
                  {s.money !== null ? <span className="signal-money">{rm(s.money)}</span> : null}
                  {s.href ? (
                    <Link href={s.href} className="signal-cta">
                      {s.cta ?? 'Open'}
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="none">Nothing is out of line this month. Concentration, invoicing gaps and dormant clients all sit inside their normal range.</p>
        )}
      </section>

      {/* ---- the centrepiece: what the work is, and how it moved ---- */}
      <section className="panel" aria-labelledby="h-mix">
        <h2 id="h-mix">What the work is, and how it has shifted</h2>
        <p className="panel-sub">
          The same invoices cut two ways. Switch between the kind of work you did and the industry that paid for it.
        </p>
        <MixTrend lenses={lenses} />
      </section>

      {/* ---- rhythm ---- */}
      <section className="panel" aria-labelledby="h-rhythm">
        <h2 id="h-rhythm">Month by month</h2>
        <p className="panel-sub">Two years of invoicing. The gaps are the point.</p>
        <Rhythm cells={p.rhythm} />
      </section>

      {/* ---- client movement ---- */}
      <div className="two-up">
        <section className="panel" aria-labelledby="h-up">
          <h2 id="h-up">Growing this year</h2>
          <p className="panel-sub">Against the same days last year.</p>
          {p.movers.up.length ? (
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">This year</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {p.movers.up.map(m => (
                  <tr key={m.client}>
                    <th scope="row">{short(m.client)}</th>
                    <td data-label="This year" className="num">{rm(m.now)}</td>
                    <td data-label="Change" className="num pos">+{rm(m.delta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="none">No client is ahead of last year yet.</p>
          )}
        </section>

        <section className="panel" aria-labelledby="h-quiet">
          <h2 id="h-quiet">Gone quiet — worth a call</h2>
          <p className="panel-sub">Paid you before, nothing in the last year. Ranked by what they have spent.</p>
          {p.dormant.length ? (
            <table className="ledger">
              <thead>
                <tr>
                  <th scope="col">Client</th>
                  <th scope="col">Spent with you</th>
                  <th scope="col">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {p.dormant.slice(0, 8).map(d => (
                  <tr key={d.client}>
                    <th scope="row">
                      {short(d.client)}
                      <span className="ledger-sub">
                        {d.jobs} job{d.jobs === 1 ? '' : 's'}
                      </span>
                    </th>
                    <td data-label="Spent with you" className="num">{rm(d.lifetime)}</td>
                    <td data-label="Last seen" className="num">{d.monthsQuiet} mo</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="none">Every client who has paid you booked again within the year.</p>
          )}
        </section>
      </div>

      {/* ---- seasonality: when to sell, when to rest ---- */}
      <section className="panel" aria-labelledby="h-season">
        <h2 id="h-season">When the money lands</h2>
        <p className="panel-sub">
          Every {peak.label} on record adds up to {rm(peak.total)}, your strongest month
          {trough && trough.label !== peak.label ? <> — {trough.label} is the quietest at {rm(trough.total)}</> : null}.
          Useful for deciding when to chase work and when to take the trip.
        </p>
        <ol className="season">
          {p.seasonality.map(s => (
            <li key={s.month} className={s.total === peak.total ? 'top' : undefined}>
              <span className="season-track">
                <span className="season-bar" style={{ height: `${Math.max((s.total / seasonPeak) * 100, 2)}%` }} />
              </span>
              <span className="season-month">{s.label}</span>
              <span className="season-figure">{s.total ? `${Math.round(s.total / 1000)}k` : '—'}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- audience ---- */}
      <section className="panel" aria-labelledby="h-audience">
        <h2 id="h-audience">Audience</h2>
        {snap ? (
          <p className="panel-sub">
            {(snap.profile.followers_count ?? 0).toLocaleString('en-MY')} followers on Instagram
            {ig?.follows != null && ig?.unfollows != null ? (
              <>
                {' '}({ig.follows - ig.unfollows >= 0 ? '+' : ''}
                {(ig.follows - ig.unfollows).toLocaleString('en-MY')} in 30 days)
              </>
            ) : null}
            {ig?.totals.reach ? (
              <>
                {' '}· <b>{ig.totals.reach.toLocaleString('en-MY')}</b> accounts reached in 30 days
                {ig.newPeoplePct !== null ? <>, {Math.round(ig.newPeoplePct)}% of them new to you</> : null}
              </>
            ) : null}
            {ig?.coreAgePct != null ? <> · {Math.round(ig.coreAgePct)}% of followers aged 25–44</> : null} ·{' '}
            <Link href="/instagram">see the full breakdown</Link>
          </p>
        ) : (
          <p className="none">
            No Instagram figures stored yet, so nothing here is guessed. Pull a fresh snapshot on the{' '}
            <Link href="/instagram">Instagram tab</Link> and this section will show reach against the work above.
          </p>
        )}
      </section>
    </div>
  )
}
