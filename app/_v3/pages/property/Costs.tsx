import type { PropertyRead, LoanView } from '@/lib/property'
import { costTotals, currentTerm, groupTenants } from '@/lib/tenancy-math'
import { CostForm, CostsBrowser } from '../../TenancyForms'
import TenancySetup from './TenancySetup'
import { plural, rm, thisYear, today as now } from './shared'

// 👉 v3 Property → Costs: what each property costs to keep — maintenance fee, repairs, agent and
// stamping fees. Ten to a page, newest first.

export default function Costs({ read, sqlUrl, tenancySql }: { read: PropertyRead; sqlUrl: string | null; tenancySql: string }) {
  if (!read.ready) return <p className="v3-empty">Set up Property first — open Loans.</p>
  const year = thisYear()
  const all = read.loans.flatMap(l => l.costs)
  const t = costTotals(all, year)
  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Running costs</h1>
          <p className="v3-lede">
            {read.tenancyReady ? (
              <>
                <b className="num">{rm(t.year)}</b> in {year} so far, <b className="num">{rm(t.all)}</b> since records began, across {plural(read.loans.length, 'property')}.
                {read.demo ? ' Demo data.' : ''}
              </>
            ) : (
              'Maintenance fee, repairs, agent and stamping fees for each property.'
            )}
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
      {!read.tenancyReady ? <TenancySetup sql={tenancySql} sqlUrl={sqlUrl} /> : read.loans.map(l => <PropertyCosts key={l.loan.id} view={l} year={year} />)}
    </div>
  )
}

function PropertyCosts({ view, year }: { view: LoanView; year: string }) {
  const { loan, costs, tenancies } = view
  const c = costTotals(costs, year)
  const today = now()
  const names = groupTenants(tenancies, today).map(g => g.name).filter((n): n is string => !!n)
  const rent = currentTerm(tenancies, today)?.monthly_rent ?? null
  const monthly = costs.filter(x => x.kind === 'maintenance_fee')
  const lastFee = [...monthly].sort((a, b) => b.cost_date.localeCompare(a.cost_date))[0]
  return (
    <section className="v3-prop" id={loan.id} aria-labelledby={`c-${loan.id}`}>
      <div className="v3-prop-head">
        <div>
          <h2 className="v3-chapter-title" id={`c-${loan.id}`}>
            {loan.name}
          </h2>
          <p className="v3-panel-note">{loan.location}</p>
        </div>
      </div>
      <div className="v3-kpis">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Costs {year}</div>
          <div className="v3-kpi-value">{rm(c.year)}</div>
          <div className="v3-kpi-note">{plural(costs.filter(x => x.cost_date.startsWith(year)).length, 'bill')}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Costs all time</div>
          <div className="v3-kpi-value">{rm(c.all)}</div>
          <div className="v3-kpi-note">{plural(costs.length, 'bill')}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Maintenance fee</div>
          <div className="v3-kpi-value">{rm(lastFee?.amount)}</div>
          <div className="v3-kpi-note">{lastFee ? 'latest monthly bill' : 'none recorded'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Repairs {year}</div>
          <div className="v3-kpi-value">{rm(c.repairsYear)}</div>
          <div className="v3-kpi-note">agent &amp; stamping {rm(c.signingYear)}</div>
        </div>
      </div>
      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-4" aria-label={`Add a cost for ${loan.name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Add a cost</h3>
          </div>
          <CostForm propertyId={loan.id} rent={rent} tenants={names} />
        </section>
        <section className="v3-panel v3-span-8" aria-label={`${loan.name} costs`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Every bill</h3>
          </div>
          <CostsBrowser costs={costs} rent={rent} tenants={names} />
        </section>
      </div>
    </section>
  )
}
