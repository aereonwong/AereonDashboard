import type { ExpensesRead } from '@/lib/expenses'
import type { MonthExport } from '@/lib/expense-drive'
import { applyExpenseFilters, foreignText, foreignTotals, newestFirst, parseExpenseFilters, rmOf, rmPending, type Expense } from '@/lib/expenses-math'
import ScopedPanel from '../../ScopedPanel'
import { ExpenseFilterBar, ExpenseForm, ExpenseList, MonthExportCard } from '../../ExpenseForms'
import { plural, sen, today } from '../property/shared'
import ExpensesSetup from './Setup'
import '../../expenses.css'

// 👉 v3 Expenses → All expenses. One sticky filter bar (docs/FILTER-BAR.md) above the list; the filters live in the
// URL and the server redraws, so a filtered view can be bookmarked and the money maths stays in one place.

type Params = Record<string, string | string[] | undefined>

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b))

export default function All({ read, sp, exports, canDrive, sql, sqlUrl }: { read: ExpensesRead; sp: Params; exports: Record<string, MonthExport>; canDrive: boolean; sql: string; sqlUrl: string | null }) {
  if (!read.ready)
    return (
      <div className="v3-property">
        <header className="v3-head">
          <h1 className="v3-title">All expenses</h1>
        </header>
        <ExpensesSetup sql={sql} sqlUrl={sqlUrl} />
      </div>
    )

  const day = today()
  const filters = parseExpenseFilters(sp, day)
  const rows = newestFirst(applyExpenseFilters(read.rows, filters))
  const total = Math.round(rows.reduce((a, e) => a + rmOf(e), 0) * 100) / 100
  const pending = rmPending(rows)
  const foreign = foreignTotals(rows)
  const lists = {
    vendors: uniq(read.rows.map(e => e.vendor)),
    trips: uniq(read.rows.map(e => e.trip)),
    paidWith: uniq(read.rows.map(e => e.paid_with)),
  }
  const years = uniq(read.rows.map(e => e.spent_on.slice(0, 4))).reverse()
  if (!years.includes(day.slice(0, 4))) years.unshift(day.slice(0, 4))
  const months = [...new Set(read.rows.map(e => e.spent_on.slice(0, 7)))].sort().reverse()
  const exportMonthDefault = filters.month || months.find(m => m < day.slice(0, 7)) || months[0] || day.slice(0, 7)
  const slice = [filters.month || filters.year || 'all years', filters.kind, filters.trip].filter(Boolean).join(' · ')

  return (
    <div className="v3-property">
      <header className="v3-head">
        <div>
          <h1 className="v3-title">All expenses</h1>
          <p className="v3-lede">
            {plural(rows.length, 'payment')} · <b className="num">RM {sen(total)}</b>
            {foreign.map(f => (
              <span key={f.currency}>
                {' '}
                + <b className="num">{foreignText(f.currency, f.total)}</b>
              </span>
            ))}{' '}
            — {slice}.{pending ? ` ${plural(pending, 'charge')} waiting for the RM figure.` : ''}
            {read.demo ? ' Demo data.' : ''}
          </p>
        </div>
      </header>

      <ExpenseFilterBar filters={filters} years={years} trips={lists.trips} count={rows.length} total={`RM ${sen(total)}`} />

      <div className="v3-grid v3-prop-grid">
        <section className="v3-panel v3-span-4" aria-labelledby="p-add">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="p-add">Add an expense</h2>
            <p className="v3-panel-note">A new expense starts as &ldquo;receipt missing&rdquo; until you file one.</p>
          </div>
          <ExpenseForm lists={lists} />
        </section>

        <ScopedPanel id="list" title="Payments" note="Edit a row to change it, attach its receipt or mark it as not needing one." scope="All filters" span={8}>
          <ExpenseList rows={rows as Expense[]} lists={lists} canDrive={canDrive} />
        </ScopedPanel>

        <ScopedPanel id="export" title="Send a month to the accountant" note="Files a CSV of that month in Google Drive, next to its receipts." scope="Ignores filters" span={4}>
          {months.length ? <MonthExportCard months={months} exports={exports} canDrive={canDrive} initial={exportMonthDefault} /> : <p className="v3-empty">Add an expense first.</p>}
        </ScopedPanel>
      </div>
    </div>
  )
}
