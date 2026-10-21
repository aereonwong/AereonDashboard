import type { ExpensesRead } from '@/lib/expenses'
import { KIND_LABEL, foreignText, summarise } from '@/lib/expenses-math'
import { rmFull } from '../fmt'
import { plural, today } from '../pages/property/shared'
import '../expenses.css'

// 👉 Dashboard → what the company spent, in one glance. Fixed to this calendar year: it ignores the filter bar
// above (the chip says so), because company spending is not split by invoice client or kind. Detail is on /expenses.
// Draws nothing until the Expenses table exists, so a fresh install never shows a dead panel.

export default function Spend({ expenses }: { expenses?: ExpensesRead }) {
  if (!expenses?.ready) return null
  const s = summarise(expenses.rows, today())
  const top = s.kinds.slice(0, 4)
  const max = Math.max(...top.map(k => k.total), 1)
  return (
    <section className="v3-panel v3-span-12" id="spend" aria-labelledby="t-spend">
      <div className="v3-scoped-head">
        <div>
          <h2 className="v3-panel-title" id="t-spend">
            Company spend {s.year}
          </h2>
          <p className="v3-panel-note">Hotels, flights, transport, subscriptions, equipment, ads and admin — from Expenses.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="v3-scope">This year · ignores filters</span>
          <a className="v3-panel-link" href="/expenses">
            Open Expenses
          </a>
        </span>
      </div>
      {s.count === 0 ? (
        <p className="v3-empty">
          Nothing recorded for {s.year} yet. <a href="/expenses/all">Add the first expense</a>.
        </p>
      ) : (
        <div className="v3-exp-spend">
          <div className="v3-exp-spend-figures">
            <div>
              <div className="v3-kpi-label">Spent so far</div>
              <div className="v3-kpi-value">{rmFull(s.ytd)}</div>
              <div className="v3-kpi-note">
                {plural(s.count, 'payment')}
                {s.foreign.length ? ` · plus ${s.foreign.map(f => foreignText(f.currency, f.total)).join(' + ')} in other currencies` : ''}
                {s.pending ? ` · ${s.pending} waiting for the RM figure` : ''}
              </div>
            </div>
            <div>
              <div className="v3-kpi-label">This month</div>
              <div className="v3-kpi-value">{rmFull(s.thisMonth)}</div>
            </div>
            <a href="/expenses/all?receipt=missing">
              <div className="v3-kpi-label">Receipts missing</div>
              <div className="v3-kpi-value">{s.missing.count}</div>
              <div className="v3-kpi-note">{s.missing.count ? `worth ${rmFull(s.missing.amount)}` : 'all filed'}</div>
            </a>
          </div>
          <div className="v3-rows">
            {top.map(k => (
              <a key={k.kind} className="v3-row" href={`/expenses/all?kind=${k.kind}`} data-tip={`${KIND_LABEL[k.kind]}\n${rmFull(k.total)}\n${Math.round(k.share * 100)}% of ${s.year}'s spending`}>
                <div className="v3-row-main">
                  <div className="v3-row-title">{KIND_LABEL[k.kind]}</div>
                  <div className="v3-row-sub">{plural(k.count, 'payment')}</div>
                </div>
                <div className="v3-row-num">{rmFull(k.total)}</div>
                <div className="v3-row-bar" aria-hidden="true">
                  <i style={{ ['--w' as string]: k.total / max }} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
