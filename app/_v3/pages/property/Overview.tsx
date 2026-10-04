import type { PropertyRead, LoanView } from '@/lib/property'
import { costTotals, groupTenants, propertyMonthly, spanLabel } from '@/lib/tenancy-math'
import { dmy, plural, rm, thisYear, today as now } from './shared'

// 👉 v3 Property → Overview: one card per property, the few figures that matter, and a way into
// Loans, Tenancy and Running costs. This is where the property dashboard will grow; none of it
// feeds the studio's own Dashboard.

export default function Overview({ read }: { read: PropertyRead }) {
  if (!read.ready) return <p className="v3-empty">Property is not set up yet — open Loans for the one setup step.</p>
  const year = thisYear()
  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Property</h1>
          <p className="v3-lede">
            {plural(read.loans.length, 'property')}. Loans, tenancies and running costs live here, apart from the studio&rsquo;s own numbers.
            {read.demo ? ' Demo data.' : ''}
          </p>
        </div>
      </header>
      <div className="v3-prop-cards">
        {read.loans.map(l => (
          <Card key={l.loan.id} view={l} year={year} tenancyReady={read.tenancyReady} />
        ))}
      </div>
    </div>
  )
}

function Card({ view, year, tenancyReady }: { view: LoanView; year: string; tenancyReady: boolean }) {
  const { loan, months, tenancies, costs } = view
  const today = now()
  const last = [...months].reverse().find(m => m.outstanding_balance != null)
  const groups = groupTenants(tenancies, today)
  // A dual-key property has two tenants at once: the card shows both, rent added together.
  const live = groups.filter(x => x.status === 'current')
  const g = live[0] ?? groups[0]
  const shown = live.length ? live : g ? [g] : []
  const rentOf = (x: (typeof groups)[number]) => ([...x.terms].reverse().find(t => t.start_date <= today) ?? x.terms[0]).monthly_rent
  const rent = shown.length ? (shown.some(x => rentOf(x) == null) ? null : shown.reduce((a, x) => a + (rentOf(x) ?? 0), 0)) : null
  const gap = rent != null && last?.instalment != null ? rent - last.instalment : null
  const c = costTotals(costs, year)
  const net = propertyMonthly(groups, costs, months, today)
  return (
    <article className="v3-panel v3-prop-card" aria-labelledby={`o-${loan.id}`}>
      <h2 className="v3-chapter-title" id={`o-${loan.id}`}>
        {loan.name}
      </h2>
      <p className="v3-panel-note">{[loan.location, loan.bank].filter(Boolean).join(' · ')}</p>
      <dl className="v3-prop-facts">
        <div>
          <dt>Outstanding</dt>
          <dd className="num">{rm(last?.outstanding_balance)}</dd>
        </div>
        <div>
          <dt>Loan rate</dt>
          <dd className="num">{last?.rate != null ? `${last.rate.toFixed(2)}%` : '—'}</dd>
        </div>
        {tenancyReady ? (
          <>
            <div>
              <dt>Tenant</dt>
              <dd>{g ? `${shown.map(x => x.name ?? 'Not named').join(' + ')}${g.status === 'ended' ? ' (ended)' : ''}` : 'Not rented out'}</dd>
            </div>
            {g ? (
              <>
                <div>
                  <dt>Rent</dt>
                  <dd className="num">{rm(rent)} / month</dd>
                </div>
                <div>
                  <dt>Tenancy ends</dt>
                  <dd>
                    {shown.map(x => `${x.name ? `${x.name} ` : ''}${dmy(x.end)}`).join(' · ')}
                    {shown.length === 1 ? ` · ${spanLabel(g.start, g.end)} in all` : ''}
                  </dd>
                </div>
                <div>
                  <dt>Rent vs instalment</dt>
                  <dd className="num">{gap == null ? '—' : `${gap >= 0 ? '+' : '−'}${rm(Math.abs(gap))}`}</dd>
                </div>
                <div>
                  <dt>Estimated net / month, after bills and maintenance</dt>
                  <dd className="num">{rm(net.beforeLoan)}</dd>
                </div>
                <div>
                  <dt>Estimated net / month, after the loan too</dt>
                  <dd className="num">{rm(net.afterLoan)}</dd>
                </div>
              </>
            ) : null}
            <div>
              <dt>Costs {year}</dt>
              <dd className="num">{rm(c.year)}</dd>
            </div>
          </>
        ) : null}
      </dl>
      <p className="v3-prop-links">
        <a href={`/property/loans#${loan.id}`}>Loans</a>
        <a href={`/property/tenancy#${loan.id}`}>Tenancy</a>
        <a href={`/property/costs#${loan.id}`}>Running costs</a>
      </p>
    </article>
  )
}
