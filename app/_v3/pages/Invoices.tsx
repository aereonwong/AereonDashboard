import type { Rec } from '@/lib/records'
import { buildLedger } from '@/lib/v3/ledger'
import { RANGES, withParam, type Filters } from '@/lib/v3/filters'
import FilterBar from '../FilterBar'
import Bars from '../Bars'
import StatusStrip from '@/app/(app)/invoices/StatusStrip'
import { toDetailRows } from '@/lib/invoice-details'
import { rmFull, money, longDate } from '../fmt'

// 👉 v3 Invoice Summary. Totals, the monthly chart, top clients, work type,
// repeat and concentration figures, and the payment & Drive status strip —
// all following the range filter. Summary only: the invoice-by-invoice table
// (sortable, searchable, with the Drive/PDF actions) is Invoice Details.

type Params = Record<string, string | string[] | undefined>

// "12 months", "8.9 months" — whole numbers stay whole.
const spanLabel = (m: number) => {
  const r = Math.round(m * 10) / 10
  return `${Number.isInteger(r) ? r : r.toFixed(1)} month${r === 1 ? '' : 's'}`
}

export default function Invoices({ rows, filters }: { rows: Rec[]; filters: Filters; sp?: Params }) {
  const l = buildLedger(rows, filters)
  const rangeLabel = RANGES.find(r => r.id === filters.range)?.label ?? ''
  // The status strip covers exactly the invoices the rest of the page is showing.
  const inView = new Set(l.rows.map(r => r.id))
  const details = toDetailRows(rows).filter(r => inView.has(r.id))
  const oneYear = filters.from.slice(0, 4) === filters.to.slice(0, 4) ? filters.from.slice(0, 4) : undefined

  return (
    <div>
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Invoice Summary</h1>
          <p className="v3-lede">
            {rmFull(l.total)} across {l.count} ringgit invoice{l.count === 1 ? '' : 's'} ·{' '}
            {filters.range === 'custom' ? `${longDate(filters.from)} to ${longDate(filters.to)}` : rangeLabel.toLowerCase()}
          </p>
        </div>
      </header>

      <FilterBar filters={filters} clients={l.allClients} />

      <StatusStrip rows={details} year={oneYear} />

      <div className="v3-grid">
        <section className="v3-panel v3-span-12" aria-label="Figures">
          <div className="v3-kpis v3-kpis-5">
            <div>
              <div className="v3-kpi-label">Invoiced</div>
              <div className="v3-kpi-value num">{rmFull(l.total)}</div>
              <div className="v3-kpi-note">{l.count} invoices</div>
            </div>
            <div>
              <div className="v3-kpi-label">Average invoice</div>
              <div className="v3-kpi-value num">{rmFull(l.average)}</div>
              <div className="v3-kpi-note">
                Biggest {l.biggest ? `${rmFull(l.biggest.amount)}, ${l.biggest.client}` : '—'}
              </div>
            </div>
            <div>
              <div className="v3-kpi-label">Average month</div>
              {/* Under a month, a monthly rate would be a guess scaled up — say so instead. */}
              <div className="v3-kpi-value num">{l.spanMonths >= 1 ? rmFull(l.perMonth) : '—'}</div>
              <div className="v3-kpi-note">
                {l.spanMonths >= 1
                  ? `over ${spanLabel(l.spanMonths)}, ${(l.count / l.spanMonths).toFixed(1)} invoices a month`
                  : l.count
                    ? 'range is shorter than a month'
                    : 'no invoices in range'}
              </div>
            </div>
            <div>
              <div className="v3-kpi-label">From returning clients</div>
              <div className="v3-kpi-value num">{Math.round(l.repeatShare * 100)}%</div>
              <div className="v3-kpi-note">clients who have hired you more than once</div>
            </div>
            <div>
              <div className="v3-kpi-label">Top five clients</div>
              <div className="v3-kpi-value num">{Math.round(l.concentration * 100)}%</div>
              <div className="v3-kpi-note">
                of the range{l.concentration >= 0.5 ? ' — a lot resting on a few' : ''}
              </div>
            </div>
          </div>
          {l.foreign.length ? (
            <p className="v3-panel-note" style={{ marginTop: 'var(--space-4)' }}>
              Plus {l.foreign.map(f => `${money(f.total, f.currency)} (${f.count})`).join(' and ')} in foreign currency, kept
              out of the ringgit totals.
            </p>
          ) : null}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-months">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-months">
              Invoiced by month
            </h2>
            <p className="v3-panel-note">Click a month to filter the page to it</p>
          </div>
          <Bars months={l.months} />
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-kind">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-kind">
              Kind of work
            </h2>
          </div>
          <div className="v3-rows">
            {l.mix.map(x => (
              <a
                key={x.kind}
                className="v3-row"
                href={withParam(filters, 'kind', filters.kind === x.kind ? undefined : x.kind)}
                aria-current={filters.kind === x.kind ? 'true' : undefined}
              >
                <div className="v3-row-main">
                  <div className="v3-row-title">{x.kind}</div>
                  <div className="v3-row-sub">
                    {x.count} jobs · {Math.round(x.share * 100)}%
                  </div>
                </div>
                <div className="v3-row-num">{rmFull(x.total)}</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: x.share.toFixed(3) }} />
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="v3-panel v3-span-6" aria-labelledby="t-top">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-top">
              Top clients
            </h2>
            <a className="v3-panel-link" href="/clients">
              Relationship map
            </a>
          </div>
          <div className="v3-rows">
            {l.topClients.map(c => (
              <a key={c.client} className="v3-row" href={withParam(filters, 'client', c.client)}>
                <div className="v3-row-main">
                  <div className="v3-row-title">{c.client}</div>
                  <div className="v3-row-sub">
                    {c.count} job{c.count === 1 ? '' : 's'} · {Math.round(c.share * 100)}%
                  </div>
                </div>
                <div className="v3-row-num">{rmFull(c.total)}</div>
                <div className="v3-row-bar">
                  <i style={{ ['--w' as string]: (c.total / (l.topClients[0]?.total || 1)).toFixed(3) }} />
                </div>
              </a>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}
