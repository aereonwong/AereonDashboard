import type { ExpensesRead } from '@/lib/expenses'
import { KIND_LABEL, foreignText, needsReceipt, newestFirst, rmOf, summarise, trips, type Expense } from '@/lib/expenses-math'
import { rmFull, pct } from '../../fmt'
import { dmy, mon, plural, today } from '../property/shared'
import ExpensesSetup from './Setup'
import '../../expenses.css'

// 👉 v3 Expenses → Overview. The questions it answers: how much did the company spend this year, on what, when,
// and which receipts are still owed to the accountant. Every figure is worked out in lib/expenses-math.ts.

export default function Overview({ read, sql, sqlUrl }: { read: ExpensesRead; sql: string; sqlUrl: string | null }) {
  if (!read.ready)
    return (
      <div className="v3-property">
        <header className="v3-head">
          <div>
            <h1 className="v3-title">Expenses</h1>
            <p className="v3-lede">Hotels, flights, transport, subscriptions, equipment, ads and admin fees — every payment, with its receipt.</p>
          </div>
        </header>
        <ExpensesSetup sql={sql} sqlUrl={sqlUrl} />
      </div>
    )

  const day = today()
  const s = summarise(read.rows, day)
  const delta = s.lastYtd ? ((s.ytd - s.lastYtd) / s.lastYtd) * 100 : null
  const owed = newestFirst(read.rows.filter(e => needsReceipt(e)))
  const maxMonth = Math.max(...s.months.map(m => m.total), 1)
  const maxKind = Math.max(...s.kinds.map(k => k.total), 1)
  const maxVendor = Math.max(...s.vendors.map(v => v.total), 1)
  const tripList = trips(read.rows.filter(e => e.spent_on.startsWith(s.year))).slice(0, 5)

  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">Expenses {s.year}</h1>
          <p className="v3-lede">
            {s.count === 0 ? (
              'Nothing recorded this year yet.'
            ) : (
              <>
                <b className="num">{rmFull(s.ytd)}</b> spent in {s.year} across {plural(s.count, 'payment')}
                {s.missing.count ? <>, and {plural(s.missing.count, 'receipt')} still to file.</> : ', every receipt filed.'}
                {read.demo ? ' Demo data.' : ''}
              </>
            )}
          </p>
        </div>
        <a className="v3-btn v3-btn-primary" href="/expenses/all" style={{ textDecoration: 'none' }}>
          Add or review expenses
        </a>
      </header>

      {s.missing.count ? (
        <div className="v3-exp-flag" role="status">
          <b>{plural(s.missing.count, 'receipt')} missing</b>
          <span>
            for <span className="num">{rmFull(s.missing.amount)}</span> of this year&rsquo;s spending.
          </span>
          <a className="v3-btn" href="/expenses/all?receipt=missing" style={{ textDecoration: 'none' }}>
            Show them
          </a>
        </div>
      ) : null}

      <section className="v3-kpis" aria-label="Key figures">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Spent this year</div>
          <div className="v3-kpi-value">
            {rmFull(s.ytd)}
            {delta !== null ? <span className={`v3-delta ${delta <= 0 ? 'up' : 'down'}`}>{pct(delta)}</span> : null}
          </div>
          <div className="v3-kpi-note">{s.lastYtd !== null ? `vs ${rmFull(s.lastYtd)} by this day in ${Number(s.year) - 1}` : `nothing recorded in ${Number(s.year) - 1} to compare`}</div>
          {s.foreign.length || s.pending || s.estimated ? (
            <div className="v3-kpi-note">
              {[
                s.foreign.length ? `plus ${s.foreign.map(f => foreignText(f.currency, f.total)).join(' + ')} in other currencies` : '',
                s.pending ? `${s.pending} still waiting for the RM figure` : '',
                s.estimated ? `${s.estimated} RM figure${s.estimated === 1 ? '' : 's'} estimated` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          ) : null}
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">This month</div>
          <div className="v3-kpi-value">{rmFull(s.thisMonth)}</div>
          <div className="v3-kpi-note">{mon(`${day.slice(0, 7)}-01`)}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Subscriptions running</div>
          <div className="v3-kpi-value">{rmFull(s.runRate.perMonth)}</div>
          <div className="v3-kpi-note">{s.runRate.series ? `a month, ${plural(s.runRate.series, 'plan')}` : 'no repeating plans marked yet'}</div>
        </div>
        <a className="v3-kpi" href="/expenses/all?receipt=missing">
          <div className="v3-kpi-label">Missing this year</div>
          <div className="v3-kpi-value">{s.missing.count}</div>
          <div className="v3-kpi-note">{s.missing.count ? `worth ${rmFull(s.missing.amount)}` : 'all filed'}</div>
        </a>
      </section>

      <div className="v3-grid" style={{ marginTop: 'var(--space-5)' }}>
        <section className="v3-panel v3-span-8" aria-labelledby="p-months">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-months">Month by month</h2>
            <p className="v3-panel-note">Last 12 months. Open a month to see its payments.</p>
          </div>
          <ol className="v3-exp-bars" aria-label="Spending per month">
            {s.months.map(m => {
              const top = Object.entries(m.byKind)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([k, v]) => `${KIND_LABEL[k as Expense['kind']]} ${rmFull(v)}`)
                .join(' · ')
              return (
                <li key={m.month}>
                  <a href={`/expenses/all?month=${m.month}`} data-tip={`${mon(`${m.month}-01`)}\n${rmFull(m.total)} spent${top ? `\n${top}` : ''}`}>
                    <span className="v3-exp-bar">
                      <i style={{ ['--h' as string]: m.total / maxMonth }} />
                    </span>
                    <span className="v3-exp-bar-label">{mon(`${m.month}-01`).slice(0, 3)}</span>
                  </a>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="p-kinds">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-kinds">Where it went</h2>
            <p className="v3-panel-note">{s.year} so far, by kind.</p>
          </div>
          {s.kinds.length === 0 ? (
            <p className="v3-empty">No spending yet.</p>
          ) : (
            <div className="v3-rows">
              {s.kinds.map(k => (
                <a key={k.kind} className="v3-row" href={`/expenses/all?kind=${k.kind}`} data-tip={`${KIND_LABEL[k.kind]}\n${rmFull(k.total)}\n${Math.round(k.share * 100)}% of ${s.year}'s spending · ${plural(k.count, 'payment')}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{KIND_LABEL[k.kind]}</div>
                    <div className="v3-row-sub">{plural(k.count, 'payment')}</div>
                  </div>
                  <div className="v3-row-num">{rmFull(k.total)}</div>
                  <div className="v3-row-bar" aria-hidden="true">
                    <i style={{ ['--w' as string]: k.total / maxKind }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="p-vendors">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-vendors">Biggest vendors</h2>
            <p className="v3-panel-note">Who got most of the money in {s.year}.</p>
          </div>
          {s.vendors.length === 0 ? (
            <p className="v3-empty">No spending yet.</p>
          ) : (
            <div className="v3-rows">
              {s.vendors.map(v => (
                <a key={v.vendor} className="v3-row" href={`/expenses/all?q=${encodeURIComponent(v.vendor)}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{v.vendor}</div>
                    <div className="v3-row-sub">{plural(v.count, 'payment')}</div>
                  </div>
                  <div className="v3-row-num">{rmFull(v.total)}</div>
                  <div className="v3-row-bar" aria-hidden="true">
                    <i style={{ ['--w' as string]: v.total / maxVendor }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="p-trips">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-trips">Trips &amp; jobs</h2>
            <p className="v3-panel-note">What each trip or shoot cost, from the tag on its expenses.</p>
          </div>
          {tripList.length === 0 ? (
            <p className="v3-empty">Tag expenses with a trip or job and they group here.</p>
          ) : (
            <div className="v3-rows">
              {tripList.map(t => (
                <a key={t.trip} className="v3-row" href={`/expenses/all?year=all&trip=${encodeURIComponent(t.trip)}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{t.trip}</div>
                    <div className="v3-row-sub">
                      {plural(t.count, 'payment')} · {dmy(t.from)}
                      {t.to !== t.from ? ` – ${dmy(t.to)}` : ''}
                    </div>
                  </div>
                  <div className="v3-row-num">{rmFull(t.total)}</div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="p-owed">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-owed">Receipts to chase</h2>
            <p className="v3-panel-note">Newest first, across every year.</p>
          </div>
          {owed.length === 0 ? (
            <p className="v3-empty">Every payment has its receipt.</p>
          ) : (
            <div className="v3-rows">
              {owed.slice(0, 6).map(e => (
                <a key={e.id} className="v3-row" href={`/expenses/all?year=all&q=${encodeURIComponent(e.reference ?? e.vendor)}`}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{e.vendor}</div>
                    <div className="v3-row-sub">
                      {dmy(e.spent_on)} · {e.description ?? KIND_LABEL[e.kind]}
                    </div>
                  </div>
                  <div className="v3-row-num">{e.amount == null && e.original_amount != null ? foreignText(e.currency, e.original_amount) : rmFull(rmOf(e))}</div>
                </a>
              ))}
            </div>
          )}
          {owed.length > 6 ? (
            <p className="v3-exp-note">
              and {owed.length - 6} more — <a href="/expenses/all?year=all&receipt=missing">see all</a>
            </p>
          ) : null}
        </section>
      </div>
    </div>
  )
}
