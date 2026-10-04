import type { PropertyRead, LoanView } from '@/lib/property'
import type { LoanMonth } from '@/lib/property-math'
import { nextToFill } from '@/lib/property-math'
import Icon from '@/app/_components/Icon'
import LoanChart from '../LoanChart'
import LoanRecord from '../LoanRecord'
import LoanIssue from '../LoanIssue'
import { CostForm, DeleteCost, TermForm } from '../TenancyForms'
import { KIND_LABEL, costTotals, currentTerm, daysBetween, nextRentDue, rentSoFar, type Cost, type Tenancy } from '@/lib/tenancy-math'

// 👉 v3 Property: one chapter per home loan. Monthly job: type the outstanding balance from the
// statement; everything else on the page is worked out from it (lib/property-math.ts).

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const mon = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const monthName = (iso: string) => `${FULL[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const sen = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const rm = (n: number | null | undefined) => (n == null ? '—' : `RM ${sen(n)}`)
const sum = (ms: LoanMonth[], k: 'interest' | 'saved' | 'principal') => ms.reduce((a, m) => a + (m[k] ?? 0), 0)

const STATUS: Record<string, string> = {
  moratorium: 'Payment holiday',
  interest_only: 'Interest only',
  pending: 'Waiting',
  missing: 'No data',
}
const QUALITY: Record<string, string> = { statement: 'Statement', derived: 'Worked out', estimated: 'Estimate', unchecked: 'Unchecked' }

export default function Property({ read, sql, sqlUrl, tenancySql }: { read: PropertyRead; sql: string; sqlUrl: string | null; tenancySql: string }) {
  if (!read.ready) return <Setup sql={sql} sqlUrl={sqlUrl} />

  const lasts = read.loans.map(l => [...l.months].reverse().find(m => m.outstanding_balance != null))
  const owed = lasts.reduce((a, m) => a + (m?.outstanding_balance ?? 0), 0)
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).slice(0, 4) // Malaysia's year, not the server's
  const ytd = read.loans.flatMap(l => l.months.filter(m => m.month.startsWith(year)))

  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Property</h1>
          <p className="v3-lede">
            {read.loans.length} home loan{read.loans.length === 1 ? '' : 's'}, <b className="num">{rm(owed)}</b> outstanding. In {year} so far
            you paid <b className="num">{rm(sum(ytd, 'interest'))}</b> interest; the flexi account saved{' '}
            <b className="num">{rm(sum(ytd, 'saved'))}</b>.{read.demo ? ' Demo data.' : ''}
          </p>
        </div>
        {read.loans.length > 1 ? (
          <nav className="v3-prop-jump" aria-label="Loans">
            {read.loans.map(l => (
              <a key={l.loan.id} className="v3-chip" href={`#${l.loan.id}`}>
                {l.loan.name}
              </a>
            ))}
          </nav>
        ) : null}
      </header>
      {read.loans.map(l => (
        <LoanChapter key={l.loan.id} view={l} year={year} />
      ))}
      {!read.tenancyReady ? (
        <section className="v3-panel" aria-labelledby="t-tenancy-setup">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-tenancy-setup">
              One step switches on tenancy and costs
            </h2>
          </div>
          <p className="v3-lede" style={{ marginTop: 0 }}>
            Paste this into Supabase&rsquo;s SQL editor and press Run. It adds two new, empty tables and touches nothing else. Then load
            the tenancy terms with <code>npm run property:import -- --tenancy</code>.
          </p>
          <pre className="v3-sql">{tenancySql}</pre>
          {sqlUrl ? (
            <a className="v3-btn v3-btn-primary" href={sqlUrl} target="_blank" rel="noreferrer" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
              Open the Supabase SQL editor <Icon name="external" />
            </a>
          ) : null}
        </section>
      ) : null}
      <p className="v3-panel-note v3-prop-foot">
        Rate = the bank&rsquo;s published base rate on each day + the fixed spread from the letter of offer. Full-rate interest =
        what the month would cost with no cash in the flexi account. Flexi saving = full-rate interest − interest charged.
      </p>
    </div>
  )
}

function LoanChapter({ view, year }: { view: LoanView; year: string }) {
  const { loan, months, warnings, issues, tenancies, costs } = view
  const filled = months.filter(m => m.outstanding_balance != null)
  const last = filled.at(-1)
  const ytd = months.filter(m => m.month.startsWith(year))
  const next = nextToFill(months)
  const gaps = months.filter(m => m.status === 'missing' || (m.status === 'pending' && m.month !== next?.month))
  const open = issues.filter(i => i.status === 'open')
  const done = issues.filter(i => i.status !== 'open')
  const rows = [...months].reverse()

  return (
    <section className="v3-prop" id={loan.id} aria-labelledby={`t-${loan.id}`}>
      <div className="v3-prop-head">
        <div>
          <h2 className="v3-chapter-title" id={`t-${loan.id}`}>
            {loan.name}
          </h2>
          <p className="v3-panel-note">
            {[loan.location, loan.bank, loan.loan_type].filter(Boolean).join(' · ')}
            {last?.baseRate != null ? ` · ${loan.rate_basis} ${last.baseRate.toFixed(2)} + ${loan.spread.toFixed(2)} spread` : ''}
          </p>
        </div>
      </div>

      <div className="v3-kpis">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Outstanding</div>
          <div className="v3-kpi-value">{rm(last?.outstanding_balance)}</div>
          <div className="v3-kpi-note">{last ? `after the ${mon(last.month)} instalment` : 'nothing recorded yet'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Rate now</div>
          <div className="v3-kpi-value">{last?.rate != null ? `${last.rate.toFixed(2)}%` : '—'}</div>
          <div className="v3-kpi-note">{last?.instalment != null ? `instalment ${rm(last.instalment)}` : ' '}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Interest {year}</div>
          <div className="v3-kpi-value">{rm(sum(ytd, 'interest'))}</div>
          <div className="v3-kpi-note">principal repaid {rm(sum(ytd, 'principal'))}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Flexi saving {year}</div>
          <div className="v3-kpi-value">{rm(sum(ytd, 'saved'))}</div>
          <div className="v3-kpi-note">since {mon(months[0]?.month ?? loan.first_month)}: {rm(sum(months, 'saved'))}</div>
        </div>
      </div>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-4" aria-label={`Record ${loan.name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">{next ? `Record ${monthName(next.month)}` : 'Record a month'}</h3>
          </div>
          <LoanRecord
            propertyId={loan.id}
            options={[next, ...gaps].filter((m): m is LoanMonth => !!m).map(m => ({ month: m.month, label: monthName(m.month), instalment: m.instalment }))}
            last={last ? { month: monthName(last.month), outstanding: last.outstanding_balance! } : null}
          />
        </section>
        <section className="v3-panel v3-span-8" aria-label={`${loan.name} history`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Balance and interest</h3>
            <p className="v3-panel-note">
              {mon(months[0]?.month ?? loan.first_month)} – {last ? mon(last.month) : '—'}
            </p>
          </div>
          <LoanChart months={months} />
        </section>
      </div>

      {tenancies.length || costs.length ? <TenancyPanel view={view} year={year} instalment={last?.instalment ?? null} /> : null}

      {open.length || warnings.length ? (
        <section className="v3-panel" aria-labelledby={`c-${loan.id}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title" id={`c-${loan.id}`}>
              To check <span className="v3-count">{open.length}</span>
            </h3>
            <p className="v3-panel-note">Found when moving from the spreadsheet. Bank statements settle these.</p>
          </div>
          <ul className="v3-prop-issues">
            {open.map(i => (
              <LoanIssue key={i.id} issue={i} range={`${mon(i.month ?? '')}${i.month_to && i.month_to !== i.month ? ` – ${mon(i.month_to)}` : ''}`} />
            ))}
          </ul>
          {warnings.length ? (
            <details className="v3-prop-more">
              <summary>Automatic checks · {warnings.length}</summary>
              <ul>
                {warnings.map(w => (
                  <li key={w.month + w.msg}>
                    <b className="num">{mon(w.month)}</b> {w.msg}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {done.length ? (
            <details className="v3-prop-more">
              <summary>Already fixed · {done.length}</summary>
              <ul>
                {done.map(i => (
                  <li key={i.id}>
                    <b className="num">{mon(i.month ?? '')}</b> {i.field}: {i.resolution ?? i.status}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="v3-panel" aria-labelledby={`m-${loan.id}`}>
        <div className="v3-panel-head">
          <h3 className="v3-panel-title" id={`m-${loan.id}`}>
            Every month
          </h3>
          <p className="v3-panel-note">{filled.length} recorded</p>
        </div>
        <MonthTable rows={rows.slice(0, 12)} />
        {rows.length > 12 ? (
          <details className="v3-prop-more">
            <summary>Show the other {rows.length - 12} months</summary>
            <MonthTable rows={rows.slice(12)} />
          </details>
        ) : null}
      </section>
    </section>
  )
}

const dmy = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

function TenancyPanel({ view, year, instalment }: { view: LoanView; year: string; instalment: number | null }) {
  const { loan, tenancies, costs } = view
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kuala_Lumpur' })
  const term = currentTerm(tenancies, today)
  const live = term != null && term.start_date <= today && today <= term.end_date
  const left = term ? daysBetween(today, term.end_date) : null
  const next = term && live ? nextRentDue(term, today) : null
  const so = rentSoFar(tenancies, today)
  const c = costTotals(costs, year)
  const rent = term?.monthly_rent ?? null
  const gap = rent != null && instalment != null ? rent - instalment : null
  const terms = [...tenancies].sort((a, b) => b.start_date.localeCompare(a.start_date))
  const first = tenancies.map(t => t.start_date).sort()[0]

  return (
    <section className="v3-prop-tenancy" aria-labelledby={`tn-${loan.id}`}>
      <div className="v3-prop-head">
        <h3 className="v3-chapter-title" id={`tn-${loan.id}`}>
          Tenancy
        </h3>
        <p className="v3-panel-note">
          {term ? `${term.tenant_name ? `${term.tenant_name} · ` : ''}let since ${dmy(first)} · ${plural(tenancies.length, 'term')}` : 'No tenancy recorded yet'}
        </p>
      </div>

      <div className="v3-kpis">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Rent</div>
          <div className="v3-kpi-value">{rm(rent)}</div>
          <div className="v3-kpi-note">{next ? `next due ${dmy(next)}` : live ? 'per month' : term ? 'term has ended' : ' '}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Term ends</div>
          <div className="v3-kpi-value">{term ? dmy(term.end_date) : '—'}</div>
          <div className="v3-kpi-note">
            {left == null ? ' ' : left < 0 ? `ended ${plural(-left, 'day')} ago` : left === 0 ? 'last day' : `${plural(left, 'day')} left`}
          </div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Rent vs instalment</div>
          <div className="v3-kpi-value">{gap == null ? '—' : `${gap >= 0 ? '+' : '−'}${rm(Math.abs(gap))}`}</div>
          <div className="v3-kpi-note">{gap == null ? ' ' : gap >= 0 ? 'rent covers the instalment' : 'a month you top up'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Costs {year}</div>
          <div className="v3-kpi-value">{rm(c.year)}</div>
          <div className="v3-kpi-note">
            agent &amp; stamping {rm(c.signingYear)} · other {rm(c.year - c.signingYear)}
          </div>
        </div>
      </div>

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-4" aria-label={`Add a cost for ${loan.name}`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Add a cost</h3>
          </div>
          <CostForm propertyId={loan.id} rent={rent} />
        </section>
        <section className="v3-panel v3-span-8" aria-label={`${loan.name} costs`}>
          <div className="v3-panel-head">
            <h3 className="v3-panel-title">Running costs</h3>
            <p className="v3-panel-note">all time {rm(c.all)}</p>
          </div>
          {costs.length ? <CostTable costs={costs} /> : <p className="v3-empty">No costs yet. Add the agent fee, stamping fee, maintenance fee and any repair as they come.</p>}
        </section>
      </div>

      <section className="v3-panel" aria-label={`${loan.name} tenancy terms`}>
        <div className="v3-panel-head">
          <h3 className="v3-panel-title">Terms</h3>
          <p className="v3-panel-note">
            Rent due so far {rm(so.total)} over {plural(so.payments, 'payment')}
            {so.unpriced ? ` · ${plural(so.unpriced, 'payment')} in terms with no rent entered are left out` : ''}
          </p>
        </div>
        <TermTable terms={terms} today={today} />
        <details className="v3-prop-more">
          <summary>Renewed or changed the rent?</summary>
          <TermForm
            propertyId={loan.id}
            from={term ? new Date(Date.parse(term.end_date) + 86_400_000).toISOString().slice(0, 10) : today}
            rent={rent}
            tenant={term?.tenant_name ?? null}
          />
        </details>
      </section>
    </section>
  )
}

function TermTable({ terms, today }: { terms: Tenancy[]; today: string }) {
  return (
    <div className="v3-table-wrap">
      <table className="v3-table v3-prop-table">
        <thead>
          <tr>
            <th>Term</th>
            <th>Rent / month</th>
            <th>Deposit</th>
            <th>Tenant</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {terms.map(t => (
            <tr key={t.id} title={t.notes ?? undefined}>
              <td>
                {dmy(t.start_date)} – {dmy(t.end_date)}
              </td>
              <td className="num">{sen(t.monthly_rent)}</td>
              <td className="num">{sen(t.deposit)}</td>
              <td>{t.tenant_name ?? '—'}</td>
              <td>{t.start_date > today ? 'Upcoming' : t.end_date < today ? 'Ended' : 'Current'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CostTable({ costs }: { costs: Cost[] }) {
  return (
    <div className="v3-table-wrap">
      <table className="v3-table v3-prop-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Kind</th>
            <th>Amount</th>
            <th>What for</th>
            <th>
              <span className="sr-only">Delete</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {costs.map(c => (
            <tr key={c.id}>
              <td>{dmy(c.cost_date)}</td>
              <td>{KIND_LABEL[c.kind]}</td>
              <td className="num">{sen(c.amount)}</td>
              <td>{[c.description, c.vendor].filter(Boolean).join(' · ') || '—'}</td>
              <td>
                <DeleteCost id={c.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MonthTable({ rows }: { rows: LoanMonth[] }) {
  return (
    <div className="v3-table-wrap">
      <table className="v3-table v3-prop-table">
        <thead>
          <tr>
            <th>Month</th>
            <th>Outstanding</th>
            <th>Instalment</th>
            <th>Principal</th>
            <th>Interest</th>
            <th>Full-rate interest</th>
            <th>Flexi saving</th>
            <th>Rate</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.month} data-status={m.status} title={m.note ?? undefined}>
              <td>{mon(m.month)}</td>
              <td className="num">
                {sen(m.outstanding_balance)}
                {m.added ? <span className="v3-prop-added">+{sen(m.added)} added by bank</span> : null}
              </td>
              <td className="num">{sen(m.instalment)}</td>
              <td className="num">{sen(m.principal)}</td>
              <td className="num">{sen(m.interest)}</td>
              <td className="num">{sen(m.fullRate)}</td>
              <td className="num">{sen(m.saved)}</td>
              <td className="num">{m.rate != null ? `${m.rate.toFixed(2)}%` : '—'}</td>
              <td>
                <span className="v3-tag" data-q={m.status === 'normal' ? m.quality : m.status}>
                  {STATUS[m.status] ?? QUALITY[m.quality]}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Setup({ sql, sqlUrl }: { sql: string; sqlUrl: string | null }) {
  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Property</h1>
          <p className="v3-lede">Your home loans: balance, rate, interest and what the flexi account saves.</p>
        </div>
      </header>
      <section className="v3-panel" aria-labelledby="t-setup">
        <div className="v3-panel-head">
          <h2 className="v3-panel-title" id="t-setup">
            One step switches this on
          </h2>
        </div>
        <p className="v3-lede" style={{ marginTop: 0 }}>
          Paste the SQL below into Supabase&rsquo;s SQL editor and press Run. It creates four new, empty tables and touches nothing
          else. Your loan history is then loaded with{' '}
          <code>npm run property:import</code>.
        </p>
        <pre className="v3-sql">{sql}</pre>
        {sqlUrl ? (
          <a className="v3-btn v3-btn-primary" href={sqlUrl} target="_blank" rel="noreferrer" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
            Open the Supabase SQL editor <Icon name="external" />
          </a>
        ) : null}
      </section>
    </div>
  )
}
