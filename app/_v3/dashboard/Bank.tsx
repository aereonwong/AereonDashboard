import type { CashFlow } from '@/lib/bank'
import { rmFull } from '../fmt'
import { dmy, mon, plural } from '../pages/property/shared'
import '../cashflow.css'

// 👉 Dashboard → the company bank account in one glance: the balance, money that actually came in this year beside
// what was invoiced, what went out, what is still to collect and how long clients take. Fixed to this calendar year and the
// latest statement; it ignores the filter bar (the chip says so). Detail is on /invoices/cash-flow.
// Draws nothing until supabase/bank.sql has run and a statement is loaded.

export default function Bank({ bank }: { bank?: CashFlow }) {
  if (!bank?.ready || bank.empty) return null
  const last6 = bank.months.slice(-6)
  const max = Math.max(1, ...last6.map(m => Math.max(m.invoiced, m.cashIn, m.out)))
  const signed = (n: number) => (n < 0 ? `−${rmFull(-n)}` : `+${rmFull(n)}`)
  return (
    <section className="v3-panel v3-span-12" id="bank" aria-labelledby="t-bank">
      <div className="v3-scoped-head">
        <div>
          <h2 className="v3-panel-title" id="t-bank">Cash in the bank</h2>
          <p className="v3-panel-note">From the company bank statements, latest {dmy(bank.to)}. Invoiced is revenue; money in is cash that landed.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <span className="v3-scope">This year · ignores filters</span>
          <a className="v3-panel-link" href="/invoices/cash-flow">Open Cash flow</a>
        </span>
      </div>
      <div className="v3-exp-spend">
        <div className="v3-exp-spend-figures">
          <div>
            <div className="v3-kpi-label">Bank balance</div>
            <div className="v3-kpi-value">{bank.balance == null ? '—' : rmFull(bank.balance)}</div>
            <div className="v3-kpi-note">on {dmy(bank.to)}</div>
          </div>
          <div>
            <div className="v3-kpi-label">Client money in {bank.year}</div>
            <div className="v3-kpi-value">{rmFull(bank.totals.clientIn)}</div>
            <div className="v3-kpi-note">vs {rmFull(bank.totals.invoiced)} invoiced</div>
          </div>
          <a href="/invoices/cash-flow#t-paid-out">
            <div className="v3-kpi-label">Money out {bank.year}</div>
            <div className="v3-kpi-value">{rmFull(bank.totals.out)}</div>
            <div className="v3-kpi-note">net {signed(bank.totals.net)} after {rmFull(bank.totals.cashIn)} in</div>
          </a>
          <a href="/invoices/cash-flow#t-waiting">
            <div className="v3-kpi-label">Still to collect</div>
            <div className="v3-kpi-value">{rmFull(bank.owed.rm)}</div>
            <div className="v3-kpi-note">
              {plural(bank.owed.count, 'invoice')}
              {bank.median != null ? ` · clients take ${bank.median} days (median)` : ''}
              {bank.toConfirm.length ? ` · ${bank.toConfirm.length} paid per bank, to confirm` : ''}
            </div>
          </a>
        </div>
        <div>
          <ol className="v3-cf-bars" style={{ gridTemplateColumns: `repeat(${last6.length}, minmax(0, 1fr))`, height: 170 }} aria-label="Invoiced, money in and money out, last 6 months">
            {last6.map(m => (
              <li key={m.month} data-tip={`${mon(`${m.month}-01`)}\nInvoiced ${rmFull(m.invoiced)}${m.bank === 'none' ? '\nNo bank statement for this month' : `\nClient money in ${rmFull(m.clientIn)}\nAll money in ${rmFull(m.cashIn)}\nMoney out ${rmFull(m.out)}\nNet ${signed(m.net)}${m.closing != null ? `\nBalance at month end ${rmFull(m.closing)}` : ''}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}>
                <span className="v3-cf-pair">
                  <i className="inv" style={{ ['--h' as string]: m.invoiced / max }} />
                  <i className="cash" style={{ ['--h' as string]: m.clientIn / max }} />
                  <i className="out" style={{ ['--h' as string]: m.out / max }} />
                </span>
                <span className="v3-cf-label">{mon(`${m.month}-01`).slice(0, 3)}</span>
              </li>
            ))}
          </ol>
          <p className="v3-cf-legend">
            <span><i className="inv" /> Invoiced</span>
            <span><i className="cash" /> Client money in</span>
            <span><i className="out" /> Money out</span>
          </p>
        </div>
      </div>
    </section>
  )
}
