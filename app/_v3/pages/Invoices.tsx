import type { Rec } from '@/lib/records'
import { moneyHidden } from '@/lib/privacy'
import { buildSummary } from '@/lib/v3/summary'
import { paySpeed, seasons } from '@/lib/v3/insights'
import { RANGES, narrow, type Filters } from '@/lib/v3/filters'
import { toInvoices } from '@/lib/invoices'
import { toDetailRows, statusFigures } from '@/lib/invoice-details'
import FilterBar from '../FilterBar'
import TrendBars from '../TrendBars'
import { GettingPaid, SeasonsGrid } from '../dashboard/Insights'
import { KpiCard, PaymentPanel, WorkTypes, MixByYear, Sizes, Cohorts, TopClients, Movers, ForeignNote } from '../summary/Panels'
import { rmFull, num, longDate, shortDate } from '../fmt'

const rmCpm = (n: number | null) => (n === null ? '—' : `RM ${n < 10 ? n.toFixed(2) : Math.round(n).toLocaleString('en-MY')}`)
import { todayISO } from '@/lib/today'
import { linkedPostIds, paidReach } from '@/lib/v3/paid-reach'
import { latestReach } from '@/lib/ig-links'

// 👉 v3 Invoice Summary — the deep money view for the chosen range. The Dashboard
// is the daily pulse (this year's pace, who owes me, audience); this page is
// where the analysis lives: the period against the one before, the shape of the
// months, what work pays and at what rate, invoice sizes, clients won, grown
// and lost (quiet clients to re-pitch live on Clients), and how fast work turns into an invoice.
// The invoice-by-invoice table, with its Paid and Drive actions, is Invoice Details.

type Params = Record<string, string | string[] | undefined>

export default async function Invoices({ rows, filters }: { rows: Rec[]; filters: Filters; sp?: Params }) {
  const today = todayISO()
  const paid = paidReach(rows, filters, await latestReach(linkedPostIds(rows, filters)).catch(() => ({})))
  const s = buildSummary(rows, filters, today)
  const speed = paySpeed(rows, filters)
  const season = seasons(rows, filters, today)
  const rangeLabel = RANGES.find(r => r.id === filters.range)?.label ?? ''
  const allClients = [...new Set(toInvoices(rows).map(i => i.client))].filter(c => c && c !== '—').sort((a, b) => a.localeCompare(b))
  // The status panel covers exactly the invoices the rest of the page is showing.
  const inView = new Set(narrow(toInvoices(rows), filters).filter(i => i.date >= s.from && i.date <= s.to).map(i => i.id))
  const viewRows = toDetailRows(rows).filter(r => inView.has(r.id))
  // Payment counts sit beside ringgit, so they count ringgit invoices only; filing counts every invoice.
  const status = statusFigures(viewRows.filter(r => r.currency === 'MYR'))
  const filing = statusFigures(viewRows)
  const oneYear = s.from.slice(0, 4) === s.to.slice(0, 4) ? s.from.slice(0, 4) : undefined
  const prevLabel = s.prevFrom ? `vs ${shortDate(s.prevFrom)} – ${shortDate(s.prevTo!)}` : undefined
  const rangeText = filters.range === 'custom' ? `${longDate(s.from)} to ${longDate(s.to)}` : rangeLabel.toLowerCase()
  const d = s.invoiced.delta

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Invoice Summary</h1>
          <p className="v3-lede">
            {rmFull(s.invoiced.value)} invoiced · {rangeText}
            {d !== null ? (
              <>
                {' '}— <b className={d >= 0 ? 'v3-up' : 'v3-down'}>{d >= 0 ? 'up' : 'down'} {Math.abs(Math.round(d * 100))}%</b> on the period before
              </>
            ) : null}
            {s.best ? `. Best month ${s.best.label}, ${rmFull(s.best.total)}.` : '.'}
          </p>
        </div>
      </header>

      <FilterBar filters={filters} clients={allClients} />

      <div className="v3-grid">
        <section className="v3-panel v3-span-12 v3-sum-band" aria-label="Headline figures">
          <KpiCard label="Invoiced" value={rmFull(s.invoiced.value)} k={s.invoiced} prevLabel={prevLabel} note={s.invoiced.prev !== null ? `${rmFull(s.invoiced.prev)} the period before` : 'ringgit, the whole range'} />
          <KpiCard label="Invoices" value={String(s.count.value)} k={s.count} prevLabel={prevLabel} note={s.count.prev !== null ? `${s.count.prev} the period before` : 'ringgit invoices'} />
          <KpiCard label="Average invoice" value={rmFull(s.average.value)} k={s.average} prevLabel={prevLabel} note={`median ${rmFull(s.medianInvoice)}`} />
          <KpiCard
            label="Clients"
            value={String(s.clients.value)}
            k={s.clients}
            prevLabel={prevLabel}
            note={s.newClients ? `${s.newClients.count} new to you` : 'every client on record'}
          />
          <KpiCard
            label="From returning clients"
            value={s.returningShare === null ? '—' : `${Math.round(s.returningShare * 100)}%`}
            note={s.returningShare === null ? 'pick a shorter range — over all time every client was new once' : 'clients you had invoiced before this range'}
          />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-trend">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-trend">
              Invoiced by month
            </h2>
            <p className="v3-panel-note">One scale for every bar · click a month to filter the page</p>
          </div>
          <TrendBars months={s.months} />
          <ForeignNote sum={s} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-pay">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-pay">
              Payment &amp; filing
            </h2>
            <a className="v3-panel-link" href={oneYear ? `/invoices/details?year=${oneYear}` : '/invoices/details?year='}>
              Mark paid in Invoice Details
            </a>
          </div>
          <PaymentPanel s={status} drive={filing} year={oneYear} client={filters.client} />
        </section>

        <section className="v3-panel v3-span-7" aria-labelledby="t-kind">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-kind">
              What the work pays
            </h2>
            <p className="v3-panel-note">Click a type to filter</p>
          </div>
          <WorkTypes sum={s} filters={filters} />
        </section>

        <section className="v3-panel v3-span-5" aria-labelledby="t-mixyear">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-mixyear">
              How the mix has shifted
            </h2>
            <p className="v3-panel-note">Share of each year</p>
          </div>
          <MixByYear sum={s} />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-sizes">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-sizes">
              Invoice sizes
            </h2>
          </div>
          {(await moneyHidden()) ? (
            // Sizes are fixed money bands ("Under 1K"): with disguised amounts they would be wrong,
            // and right ones would give the real sizes away. So the panel waits for Show amounts.
            <p className="v3-locked" data-money-locked="">
              <b>Hidden with amounts.</b> Invoice sizes are bands of real ringgit, so they show when amounts do.
            </p>
          ) : (
            <Sizes sum={s} />
          )}
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-cohort">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-cohort">
              New and returning clients
            </h2>
          </div>
          <Cohorts sum={s} />
        </section>

        <section className="v3-panel v3-span-7" aria-labelledby="t-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-top">
              Top clients
            </h2>
            <a className="v3-panel-link" href="/clients">
              Relationship map
            </a>
          </div>
          <TopClients sum={s} filters={filters} />
        </section>

        <section className="v3-panel v3-span-5" aria-labelledby="t-moves">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-moves">
              Who moved
            </h2>
          </div>
          <Movers sum={s} />
        </section>

        <section className="v3-panel v3-span-12 v3-speed-wide" aria-labelledby="t-speed">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-speed">
              From delivery to money
            </h2>
          </div>
          <GettingPaid p={speed} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-seasons">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-seasons">
              Busy and quiet months
            </h2>
            <p className="v3-panel-note">
              {season.rows[0].year}–{season.rows.at(-1)!.year}
            </p>
          </div>
          <SeasonsGrid s={season} />
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-cpm">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-cpm">
              What a paid post delivered
            </h2>
            <p className="v3-panel-note">
              {paid.cpm !== null
                ? `Effective CPM ${rmCpm(paid.cpm)} per 1,000 reached · typical deal ${rmCpm(paid.medianCpm)}`
                : 'Ringgit per 1,000 people reached'}
            </p>
          </div>
          {paid.lines.length ? (
            <div className="v3-table-wrap">
              <table className="v3-table">
                <thead>
                  <tr>
                    <th scope="col">Invoice</th>
                    <th scope="col">Client</th>
                    <th scope="col" className="r">Amount</th>
                    <th scope="col" className="r">Posts</th>
                    <th scope="col" className="r">Reach</th>
                    <th scope="col" className="r">RM per 1,000</th>
                  </tr>
                </thead>
                <tbody>
                  {paid.lines.map(l => (
                    <tr key={l.id}>
                      <td className="num">{l.no}</td>
                      <td>{l.client}</td>
                      <td className="r num">{rmFull(l.amount)}</td>
                      <td className="r num">{l.posts}</td>
                      <td className="r num">
                        {l.reach !== null ? num(l.reach) : '—'}
                        {l.read < l.posts ? <span className="v3-panel-note"> · {l.read} of {l.posts} read</span> : null}
                      </td>
                      <td className="r num">{rmCpm(l.cpm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="v3-empty">No invoice in this range has its Instagram posts linked yet.</p>
          )}
          <p className="v3-panel-note" style={{ marginTop: 'var(--space-3)' }}>
            {paid.unlinked} ringgit invoice{paid.unlinked === 1 ? '' : 's'} in range without posts linked — link them in{' '}
            <a href="/invoices/details">Invoice Details</a> to fill this in. Reach adds each post&rsquo;s own reach, so
            someone who saw two posts counts twice; posts with no stored reading are left out.
          </p>
        </section>
      </div>
    </div>
  )
}
