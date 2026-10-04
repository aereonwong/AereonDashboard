import type { PropertyRead, LoanView } from '@/lib/property'
import { cashResult, currentTerm, daysBetween, groupTenants, spanLabel, tenantStats, type TenantGroup } from '@/lib/tenancy-math'
import { TenantName, TermForm, TermTable } from '../../TenancyForms'
import TenancySetup from './TenancySetup'
import { dmy, plural, rm, today as now } from './shared'

// 👉 v3 Property → Tenancy: per property, each tenant is one group — the original term plus every
// extension — with its own rent, deposits and score (rent due so far less the bills tagged to them).

export default function Tenancy({ read, sqlUrl, tenancySql }: { read: PropertyRead; sqlUrl: string | null; tenancySql: string }) {
  if (!read.ready) return <p className="v3-empty">Set up Property first — open Loans.</p>
  const today = now()
  const rented = read.loans.flatMap(l => groupTenants(l.tenancies, today).filter(g => g.status === 'current'))
  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Tenancy</h1>
          <p className="v3-lede">
            {read.tenancyReady
              ? `${plural(rented.length, 'tenancy')} running now across ${plural(read.loans.length, 'property')}. Terms are grouped by tenant name, so an extension counts with the tenancy it extends.${read.demo ? ' Demo data.' : ''}`
              : 'Tenants, rent and deposits for each property.'}
          </p>
        </div>
        {read.loans.length > 1 ? (
          <nav className="v3-prop-jump" aria-label="Properties">
            {read.loans.map(l => (
              <a key={l.loan.id} className="v3-chip" href={`#${l.loan.id}`}>
                {l.loan.name}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      {!read.tenancyReady ? <TenancySetup sql={tenancySql} sqlUrl={sqlUrl} /> : read.loans.map(l => <PropertyTenants key={l.loan.id} view={l} today={today} />)}
    </div>
  )
}

function PropertyTenants({ view, today }: { view: LoanView; today: string }) {
  const { loan, tenancies, costs } = view
  const groups = groupTenants(tenancies, today)
  const names = groups.map(g => g.name).filter((n): n is string => !!n)
  const last = [...tenancies].sort((a, b) => b.end_date.localeCompare(a.end_date))[0]
  return (
    <section className="v3-prop" id={loan.id} aria-labelledby={`t-${loan.id}`}>
      <div className="v3-prop-head">
        <div>
          <h2 className="v3-chapter-title" id={`t-${loan.id}`}>
            {loan.name}
          </h2>
          <p className="v3-panel-note">{[loan.location, plural(groups.length, 'tenant')].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      {groups.length === 0 ? <p className="v3-empty">{loan.name} has no tenancy recorded. It is not rented out, or not entered yet.</p> : null}
      {groups.map(g => (
        <TenantCard key={g.key} group={g} view={view} today={today} names={names} />
      ))}
      <details className="v3-prop-more">
        <summary>{groups.length ? 'Add a new tenant' : `Renting ${loan.name} out? Add a tenancy`}</summary>
        <TermForm propertyId={loan.id} from={last ? new Date(Date.parse(last.end_date) + 86_400_000).toISOString().slice(0, 10) : today} tenants={names} />
      </details>
    </section>
  )
}

function TenantCard({ group: g, view, today, names }: { group: TenantGroup; view: LoanView; today: string; names: string[] }) {
  const { loan, costs } = view
  const st = tenantStats(g, costs, today)
  const cash = cashResult(g, costs, view.months, today)
  const term = currentTerm(g.terms, today)
  const left = daysBetween(today, g.end)
  const lastTerm = g.terms[g.terms.length - 1]
  const anyDeposit = st.deposits.total > 0
  return (
    <article className="v3-panel v3-prop-tenant" aria-label={g.name ?? 'Tenant'}>
      <div className="v3-prop-tenant-head">
        <TenantName propertyId={loan.id} name={g.name} termIds={g.terms.map(t => t.id)} />
        <span className="v3-tag" data-q={g.status === 'current' ? 'statement' : g.status === 'upcoming' ? 'estimated' : 'unchecked'}>
          {g.status === 'current' ? 'Current' : g.status === 'upcoming' ? 'Upcoming' : 'Ended'}
        </span>
      </div>
      <p className="v3-panel-note">
        {dmy(g.start)} – {dmy(g.end)} · {spanLabel(g.start, g.end)}
        {g.terms.length > 1 ? ` · original term and ${plural(g.terms.length - 1, 'extension')}` : ''}
      </p>

      <div className="v3-kpis">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Rent</div>
          <div className="v3-kpi-value">{rm(term?.monthly_rent)}</div>
          <div className="v3-kpi-note">per month</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Tenancy ends</div>
          <div className="v3-kpi-value">{dmy(g.end)}</div>
          <div className="v3-kpi-note">{left < 0 ? `ended ${plural(-left, 'day')} ago` : left === 0 ? 'last day' : `${plural(left, 'day')} left`}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Rent due so far</div>
          <div className="v3-kpi-value">{rm(st.rent.total)}</div>
          <div className="v3-kpi-note">
            {st.rent.payments} of {st.estimate.payments} payments, assumed paid on time
          </div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Net from this tenant</div>
          <div className="v3-kpi-value">{rm(st.net)}</div>
          <div className="v3-kpi-note">{st.taggedCount ? `after ${rm(st.taggedTotal)} of bills you bore for them` : 'no bills you bore for them yet'}</div>
        </div>
      </div>

      <section className="v3-panel" aria-label="Cash result after maintenance and the loan">
        <div className="v3-panel-head">
          <h3 className="v3-panel-title">What this tenant leaves you</h3>
          <p className="v3-panel-note">
            Rent less the bills you bore for them, the maintenance fee and the loan instalment, month for month. The whole-tenancy column
            assumes every payment arrives on time.
          </p>
        </div>
        <div className="v3-table-wrap">
          <table className="v3-table v3-prop-table v3-prop-cash">
            <thead>
              <tr>
                <th />
                <th>So far ({plural(cash.soFar.payments, 'month')})</th>
                <th>Whole tenancy ({plural(cash.whole.payments, 'month')})</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Rent</td>
                <td className="num">{rm(cash.soFar.rent)}</td>
                <td className="num">{rm(cash.whole.rent)}</td>
              </tr>
              <tr>
                <td>Bills you bore for them (agent fee, repairs you absorbed)</td>
                <td className="num">− {rm(cash.soFar.bills)}</td>
                <td className="num">− {rm(cash.whole.bills)}</td>
              </tr>
              <tr className="v3-prop-sub-row">
                <td>Net from the tenant</td>
                <td className="num">{rm(Math.round((cash.soFar.rent - cash.soFar.bills) * 100) / 100)}</td>
                <td className="num">{rm(Math.round((cash.whole.rent - cash.whole.bills) * 100) / 100)}</td>
              </tr>
              <tr>
                <td>Maintenance fee</td>
                <td className="num">− {rm(cash.soFar.maintenance)}</td>
                <td className="num">− {rm(cash.whole.maintenance)}</td>
              </tr>
              <tr>
                <td>Loan instalments</td>
                <td className="num">− {rm(cash.soFar.loan)}</td>
                <td className="num">− {rm(cash.whole.loan)}</td>
              </tr>
              <tr className="v3-prop-total-row">
                <td>
                  <b>Cash result</b>
                </td>
                <td className="num">
                  <b>{rm(cash.soFar.result)}</b>
                </td>
                <td className="num">
                  <b>{rm(cash.whole.result)}</b>
                </td>
              </tr>
              <tr>
                <td>
                  <b>Per month</b>
                </td>
                <td className="num">
                  <b>{rm(cash.soFar.perMonth)}</b>
                </td>
                <td className="num">
                  <b>{rm(cash.whole.perMonth)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="v3-panel-note">
          {st.settlement.recoveredCount ? `Bills deducted from their deposit (${rm(st.settlement.recoveredTotal)}) are not counted: you recovered them. ` : ''}
          A loan instalment is mostly principal, which is equity you keep, so this is cash, not profit. Loan figures before 2025 are approximate.
          {cash.whole.unpriced ? ` ${plural(cash.whole.unpriced, 'month')} in terms with no rent entered are left out.` : ''} Stamping fee and any renewal agent
          fee count once entered and tagged to this tenant.
        </p>
      </section>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-4" aria-label="Deposits">
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Collected at signing</h3>
            <p className="v3-panel-note">{anyDeposit ? rm(st.deposits.total) : 'none entered'}</p>
          </div>
          {anyDeposit ? (
            <>
              <dl className="v3-prop-deposits">
                {st.deposits.parts
                  .filter(p => p.amount > 0)
                  .map(p => (
                    <div key={p.key}>
                      <dt>{p.label}</dt>
                      <dd className="num">{rm(p.amount)}</dd>
                    </div>
                  ))}
              </dl>
              {st.settlement.recoveredCount || st.settlement.refunded != null ? (
                <>
                  <h4 className="v3-prop-sub">Deposit settlement</h4>
                  <dl className="v3-prop-deposits">
                    <div>
                      <dt>Refundable deposit held</dt>
                      <dd className="num">{rm(st.deposits.refundable)}</dd>
                    </div>
                    <div>
                      <dt>Less bills deducted ({st.settlement.recoveredCount})</dt>
                      <dd className="num">− {rm(st.settlement.recoveredTotal)}</dd>
                    </div>
                    <div>
                      <dt>
                        <b>Due back to the tenant</b>
                      </dt>
                      <dd className="num">
                        <b>{rm(st.settlement.dueBack)}</b>
                      </dd>
                    </div>
                    {st.settlement.refunded != null ? (
                      <>
                        <div>
                          <dt>Actually paid back</dt>
                          <dd className="num">{rm(st.settlement.refunded)}</dd>
                        </div>
                        <div>
                          <dt>{(st.settlement.kept ?? 0) >= 0 ? 'Kept by you beyond the bills' : 'Paid back more than due'}</dt>
                          <dd className="num">{rm(Math.abs(st.settlement.kept ?? 0))}</dd>
                        </div>
                      </>
                    ) : null}
                  </dl>
                </>
              ) : null}
              <p className="v3-panel-note">
                {rm(st.deposits.refundable)} of it is refundable (everything except the advance rental). Edit the original term to change it.
              </p>
            </>
          ) : (
            <p className="v3-empty">Edit the original term to enter advance rental and deposits.</p>
          )}
        </section>
        <section className="v3-panel v3-span-8" aria-label="Terms">
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Terms</h3>
          </div>
          <TermTable terms={g.terms} today={today} tenants={names} />
          <details className="v3-prop-more">
            <summary>Add an extension</summary>
            <TermForm
              propertyId={loan.id}
              from={new Date(Date.parse(lastTerm.end_date) + 86_400_000).toISOString().slice(0, 10)}
              rent={lastTerm.monthly_rent}
              tenant={g.name}
              lockTenant={!!g.name}
              tenants={names}
            />
          </details>
        </section>
      </div>
    </article>
  )
}
