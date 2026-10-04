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
  const c = costTotals(costs, year)
  const month = propertyMonthly(groups, costs, months, today)
  return (
    <article className="v3-panel v3-prop-card" aria-labelledby={`o-${loan.id}`}>
      <h2 className="v3-chapter-title" id={`o-${loan.id}`}>
        {loan.name}
      </h2>
      <p className="v3-panel-note">{[loan.location, loan.bank].filter(Boolean).join(' · ')}</p>
      <h3 className="v3-prop-sub">Loan</h3>
      <dl className="v3-prop-facts">
        <div>
          <dt>Outstanding</dt>
          <dd className="num">{rm(last?.outstanding_balance)}</dd>
        </div>
        <div>
          <dt>Rate</dt>
          <dd className="num">{last?.rate != null ? `${last.rate.toFixed(2)}%` : '—'}</dd>
        </div>
        <div>
          <dt>Instalment</dt>
          <dd className="num">{last?.instalment != null ? `${rm(last.instalment)} / month` : '—'}</dd>
        </div>
      </dl>
      {tenancyReady ? (
        <>
          <h3 className="v3-prop-sub">{shown.length > 1 ? 'Tenants' : 'Tenant'}</h3>
          {shown.length ? (
            <dl className="v3-prop-facts">
              {shown.map(x => (
                <div key={x.key}>
                  <dt>
                    {x.name ?? 'Not named'}
                    {x.status === 'ended' ? ' (ended)' : ''}
                    <span className="v3-prop-dim"> · ends {dmy(x.end)} · {spanLabel(x.start, x.end)}</span>
                  </dt>
                  <dd className="num">{rm(rentOf(x))} / month</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="v3-panel-note">Not rented out.</p>
          )}
          {month ? (
            <>
              <h3 className="v3-prop-sub">A month, as it stands</h3>
              <dl className="v3-prop-facts">
                <div>
                  <dt>Rent</dt>
                  <dd className="num">{rm(month.rent)}</dd>
                </div>
                <div>
                  <dt>Maintenance and bills you bore (fees spread over the tenancy)</dt>
                  <dd className="num">− {rm(month.upkeep)}</dd>
                </div>
                <div>
                  <dt>Loan instalment</dt>
                  <dd className="num">− {rm(month.loan)}</dd>
                </div>
                <div className="v3-prop-net">
                  <dt>Net per month</dt>
                  <dd className="num">{rm(month.net)}</dd>
                </div>
              </dl>
            </>
          ) : null}
          <dl className="v3-prop-facts">
            <div>
              <dt>Costs {year}</dt>
              <dd className="num">{rm(c.year)}</dd>
            </div>
          </dl>
        </>
      ) : null}
      <p className="v3-prop-links">
        <a href={`/property/loans#${loan.id}`}>Loans</a>
        <a href={`/property/tenancy#${loan.id}`}>Tenancy</a>
        <a href={`/property/costs#${loan.id}`}>Running costs</a>
      </p>
    </article>
  )
}
