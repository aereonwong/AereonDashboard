import type { CashFlow as View, TxnView } from '@/lib/bank'
import { IN_KINDS, OUT_KINDS } from '@/lib/bank-math'
import { confirmFromBankForm, linkDeposit, setTxnKind } from '@/lib/bank-actions'
import Icon from '@/app/_components/Icon'
import { withParam, type Filters } from '@/lib/v3/filters'
import FilterBar from '../FilterBar'
import { Scope } from '../ScopedPanel'
import { rmFull } from '../fmt'
import { dmy, mon, plural, rm } from './property/shared'
import '../cashflow.css'

// 👉 v3 Invoices → Cash flow. Two different things side by side: what was INVOICED (revenue, on the invoice date)
// and what LANDED in the company bank account (cash, on the day it arrived). It answers: how much is in the bank,
// which invoices the bank shows paid, which are still waiting, and which deposits nobody has explained yet.
// Every figure comes from lib/bank.ts; this file only draws.

const STATE_LABEL = { 'paid-bank': 'Paid', part: 'Part paid', 'marked-only': 'Marked paid', unpaid: 'Waiting', 'before-bank': 'Before statements' } as const

export default function CashFlow({
  view, sql, sqlUrl, canEdit, lockNote = null, filters, label, outKind = null,
}: { view: View; sql: string; sqlUrl: string | null; canEdit: boolean; lockNote?: string | null; filters: Filters; label: string; outKind?: string | null }) {
  if (!view.ready)
    return (
      <div className="v3-property">
        <Head lede="The company bank account beside what was invoiced." />
        <section className="v3-panel" aria-labelledby="t-bank-setup">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-bank-setup">One step switches Cash flow on</h2>
          </div>
          <p className="v3-lede" style={{ marginTop: 0 }}>Paste this into Supabase&rsquo;s SQL editor and press Run. It only adds two tables and is safe to run again.</p>
          <pre className="v3-sql">{sql}</pre>
          {sqlUrl ? (
            <a className="v3-btn v3-btn-primary" href={sqlUrl} target="_blank" rel="noreferrer" style={{ marginTop: 'var(--space-4)', textDecoration: 'none' }}>
              Open the Supabase SQL editor <Icon name="external" />
            </a>
          ) : null}
        </section>
      </div>
    )
  if (view.empty)
    return (
      <div className="v3-property">
        <Head lede={view.demo ? 'Demo data has no bank statements.' : 'No bank statements loaded yet. Run npm run bank:fetch, then npm run bank:parse -- --upload.'} />
      </div>
    )

  const chart = view.chart
  const max = Math.max(1, ...chart.map(m => Math.max(m.invoiced, m.clientIn)))
  const maxFlow = Math.max(1, ...chart.map(m => Math.max(m.cashIn, m.out)))
  const maxNet = Math.max(1, ...chart.filter(m => m.bank !== 'none').map(m => Math.abs(m.net)))
  const maxOut = Math.max(1, ...view.outKinds.map(k => k.total))
  const inPeriod = (d: string) => d >= view.period.from && d <= view.period.to
  const periodTxns = view.txns.filter(t => inPeriod(t.date)) // newest first
  const lines = periodTxns.slice(0, 40)
  const allOut = periodTxns.filter(t => t.amount < 0)
  // Clicking a kind under "Money out" narrows the payments table to it (?out=kind, kept with the dates).
  const picked = outKind ? view.outKinds.find(k => k.kind === outKind) ?? null : null
  const paidOut = picked ? allOut.filter(t => t.kind === picked.kind) : allOut
  const outHref = (kind: string | undefined) => `${withParam(filters, 'out', kind)}#t-paid-out`
  const cols = { gridTemplateColumns: `repeat(${Math.max(1, chart.length)}, minmax(0, 1fr))` }
  // Up to 14 months: every month named. Longer ranges: only each January (as the year), and the first month's year when it starts early enough not to crowd the next, so the axis stays readable.
  const axis = (m: string, i: number) =>
    chart.length <= 14 ? mon(`${m}-01`).slice(0, 3) : m.endsWith('-01') ? m.slice(0, 4) : i === 0 && Number(m.slice(5)) <= 6 ? m.slice(0, 4) : ''
  const span = `${dmy(view.period.from)} – ${dmy(view.period.to < view.to ? view.period.to : view.to)}`
  const noBank = !view.period.covered // no statement covers these dates: bank figures show '—', never RM 0
  const bankFig = (n: number, f: (n: number) => string = rmFull) => (noBank ? '—' : f(n))

  return (
    <div className="v3-property v3-cf-page">
      <Head
        lede={
          <>
            <b className="num">{rm(view.balance)}</b> in the bank on {dmy(view.to)}. Statements from {dmy(view.from)}
            {view.gaps.length ? <> — none for {view.gaps.map(g => mon(`${g}-01`)).join(', ')}.</> : '.'}
          </>
        }
      />

      {view.toConfirm.length ? (
        <div className="v3-cf-flag" role="status">
          <span>
            <b>{plural(view.toConfirm.length, 'invoice')}</b> the bank shows paid {view.toConfirm.some(i => i.paid) ? 'still need a payment date' : 'are not marked paid yet'} in the app.
          </span>
          {canEdit ? (
            <form action={confirmFromBankForm}>
              <button className="v3-btn v3-btn-primary" type="submit">Mark all paid on their bank dates</button>
            </form>
          ) : lockNote ? <span className="v3-panel-note">{lockNote}</span> : null}
        </div>
      ) : null}

      <FilterBar filters={filters} clients={[]} kinds={false} clientPicker={false} />

      {noBank ? (
        <p className="v3-cf-flag" role="status">
          No bank statement covers {span}. Statements run {dmy(view.from)} to {dmy(view.to)} — bank figures show &ldquo;—&rdquo; for these dates.
        </p>
      ) : null}

      <section className="v3-kpis" aria-label={`The bank account · ${label}`}>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Money in · {label}</div>
          <div className="v3-kpi-value">{bankFig(view.totals.cashIn)}</div>
          <div className="v3-kpi-note">everything paid into the account — clients, director, interest, refunds</div>
        </div>
        <a className="v3-kpi" href="#t-paid-out">
          <div className="v3-kpi-label">Money out · {label}</div>
          <div className="v3-kpi-value">{bankFig(view.totals.out)}</div>
          <div className="v3-kpi-note">{noBank ? 'no statement for these dates' : `everything withdrawn — ${plural(allOut.length, 'payment')}`}</div>
        </a>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Net cash flow · {label}</div>
          <div className="v3-kpi-value v3-cf-net-value" data-sign={noBank ? undefined : view.totals.net < 0 ? 'neg' : 'pos'}>{bankFig(view.totals.net, signed)}</div>
          <div className="v3-kpi-note">{noBank ? 'no statement for these dates' : view.totals.net < 0 ? 'more went out than came in' : 'more came in than went out'}</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Bank balance</div>
          <div className="v3-kpi-value">{view.periodBalance ? rmFull(view.periodBalance.amount) : '—'}</div>
          <div className="v3-kpi-note">{view.periodBalance ? `on ${dmy(view.periodBalance.on)}, the last statement in the period` : 'no statement in this period'}</div>
        </div>
      </section>

      <section className="v3-kpis" aria-label="Invoices against the bank" style={{ marginTop: 'var(--space-4)' }}>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Invoiced · {label}</div>
          <div className="v3-kpi-value">{rmFull(view.totals.invoiced)}</div>
          <div className="v3-kpi-note">revenue, by invoice date (RM invoices)</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Client money in · {label}</div>
          <div className="v3-kpi-value">{bankFig(view.totals.clientIn)}</div>
          <div className="v3-kpi-note">cash that landed in the bank, by the day it landed</div>
        </div>
        <a className="v3-kpi" href="#t-waiting">
          <div className="v3-kpi-label">Still to collect</div>
          <div className="v3-kpi-value">{rmFull(view.owed.rm)}</div>
          <div className="v3-kpi-note">
            right now, whatever the dates — {plural(view.owed.count, 'invoice')} with no money in the bank yet{view.owed.foreign ? ` (${view.owed.foreign} in other currencies, not in the RM figure)` : ''}
          </div>
        </a>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Time to get paid</div>
          <div className="v3-kpi-value">{view.median == null ? '—' : `${view.median} days`}</div>
          <div className="v3-kpi-note">median, invoice date to money in the bank, invoices dated in the period</div>
        </div>
      </section>

      <div className="v3-grid" style={{ marginTop: 'var(--space-5)' }}>
        <section className="v3-panel v3-span-8" aria-labelledby="t-inout" style={{ alignSelf: 'start' }}>
          <div className="v3-scoped-head">
            <div>
              <h2 className="v3-panel-title" id="t-inout">Money in vs money out</h2>
              <p className="v3-panel-note">{span}. Bars: everything that entered and left the account. Below: what was left over each month — above the line more came in, below it more went out.</p>
            </div>
            <Scope>Timeline</Scope>
          </div>
          <ol className="v3-cf-bars" style={cols} aria-label="Money in and money out per month">
            {chart.map((m, i) => {
              return (
                <li
                  key={m.month}
                  data-tip={`${mon(`${m.month}-01`)}\n${m.bank === 'none' ? 'No statement for this month' : `Money in ${rmFull(m.cashIn)}\nMoney out ${rmFull(m.out)}\nNet ${signed(m.net)}${m.closing != null ? `\nBank balance at month end ${rmFull(m.closing)}` : ''}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}
                >
                  <span className="v3-cf-pair">
                    <i className="cash" style={{ ['--h' as string]: m.cashIn / maxFlow }} />
                    <i className="out" style={{ ['--h' as string]: m.out / maxFlow }} />
                  </span>
                  <span className="v3-cf-label">{axis(m.month, i)}</span>
                </li>
              )
            })}
          </ol>
          <ol className="v3-cf-net" style={cols} aria-label="Net cash flow per month">
            {chart.map(m => (
              <li
                key={m.month}
                data-sign={m.bank === 'none' ? 'none' : m.net < 0 ? 'neg' : 'pos'}
                data-tip={`${mon(`${m.month}-01`)}\n${m.bank === 'none' ? 'No statement for this month' : `Net ${signed(m.net)}\n${m.net < 0 ? 'More went out than came in' : 'More came in than went out'}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}
              >
                <i style={{ ['--h' as string]: m.bank === 'none' ? 0 : Math.abs(m.net) / maxNet }} />
              </li>
            ))}
          </ol>
          <p className="v3-cf-legend">
            <span><i className="cash" /> Money in</span>
            <span><i className="out" /> Money out</span>
            <span><i className="net-pos" /> Net up</span>
            <span><i className="net-neg" /> Net down</span>
          </p>
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="t-out">
          <div className="v3-scoped-head">
            <div>
              <h2 className="v3-panel-title" id="t-out">Money out · {label}</h2>
              <p className="v3-panel-note">Everything that left the bank account, by kind. Click one to see its payments.</p>
            </div>
            <Scope>Timeline</Scope>
          </div>
          {view.outKinds.length === 0 ? (
            <p className="v3-empty">Nothing left the account in this period.</p>
          ) : (
            <div className="v3-rows">
              {view.outKinds.map(k => (
                <a key={k.kind} className="v3-row v3-cf-kind" href={outHref(picked?.kind === k.kind ? undefined : k.kind)} aria-current={picked?.kind === k.kind ? 'true' : undefined}>
                  <div className="v3-row-main">
                    <div className="v3-row-title">{k.label}</div>
                    <div className="v3-row-sub">{plural(k.count, 'payment')}</div>
                  </div>
                  <div className="v3-row-num">{rmFull(k.total)}</div>
                  <div className="v3-row-bar" aria-hidden="true">
                    <i style={{ ['--w' as string]: k.total / maxOut }} />
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-months">
          <div className="v3-scoped-head">
            <div>
              <h2 className="v3-panel-title" id="t-months">Invoiced vs money in</h2>
              <p className="v3-panel-note">{span}. Revenue against client payments. The gap is money on its way, or invoices nobody has paid.</p>
            </div>
            <Scope>Timeline</Scope>
          </div>
          <ol className="v3-cf-bars" style={cols} aria-label="Invoiced and client money in per month">
            {chart.map((m, i) => (
              <li
                key={m.month}
                data-tip={`${mon(`${m.month}-01`)}\nInvoiced ${rmFull(m.invoiced)}${m.bank === 'none' ? '\nNo bank statement for this month' : `\nClient money in ${rmFull(m.clientIn)}\nAll money out ${rmFull(m.out)}${m.closing != null ? `\nBank balance at month end ${rmFull(m.closing)}` : ''}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}
              >
                <span className="v3-cf-pair">
                  <i className="inv" style={{ ['--h' as string]: m.invoiced / max }} />
                  <i className="cash" style={{ ['--h' as string]: m.clientIn / max }} />
                </span>
                <span className="v3-cf-label">{axis(m.month, i)}</span>
              </li>
            ))}
          </ol>
          <p className="v3-cf-legend">
            <span><i className="inv" /> Invoiced</span>
            <span><i className="cash" /> Client money in</span>
          </p>
        </section>


        {view.toConfirm.length ? (
          <section className="v3-panel v3-span-12" aria-labelledby="t-confirm">
            <div className="v3-scoped-head">
              <div>
              <h2 className="v3-panel-title" id="t-confirm">Paid, says the bank</h2>
              <p className="v3-panel-note">The money landed; the app doesn&rsquo;t know yet. Marking paid records the bank&rsquo;s date. Undo is &ldquo;Mark unpaid&rdquo; on Invoice Details.</p>
              </div>
              <Scope>Ignores timeline · what is open now</Scope>
            </div>
            <div className="v3-table-wrap">
              <table className="v3-table">
                <thead>
                  <tr><th>Invoice</th><th>Client</th><th className="num">Amount</th><th>Invoiced</th><th>In the bank</th><th className="num">Days</th><th>Found by</th>{canEdit ? <th /> : null}</tr>
                </thead>
                <tbody>
                  {view.toConfirm.map(i => (
                    <tr key={i.id}>
                      <td><a href={`/invoices/details?q=${encodeURIComponent(i.no)}`}>{i.no}</a></td>
                      <td>{i.client}</td>
                      <td className="num">{i.currency === 'MYR' ? rm(i.amount) : `${i.currency} ${i.amount.toLocaleString('en-MY')}`}</td>
                      <td>{dmy(i.date)}</td>
                      <td>{i.bank ? dmy(i.bank.lastPaid) : '—'}</td>
                      <td className="num">{i.daysToPay ?? '—'}</td>
                      <td className="v3-cf-how">{i.bank?.how === 'reference' ? 'invoice no. in the transfer' : i.bank?.how === 'owner' ? 'linked by you' : 'payer + amount'}</td>
                      {canEdit ? (
                        <td>
                          <form action={confirmFromBankForm}>
                            <input type="hidden" name="invoice" value={i.id} />
                            <button className="v3-btn" type="submit">{i.paid ? 'Add date' : 'Mark paid'}</button>
                          </form>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <section className="v3-panel v3-span-12" aria-labelledby="t-waiting">
          <div className="v3-scoped-head">
            <div>
            <h2 className="v3-panel-title" id="t-waiting">Waiting for payment</h2>
            <p className="v3-panel-note">
              Invoices since the statements began with no money in the bank yet (or only part), oldest first.
              {view.untracked ? ` ${plural(view.untracked, 'invoice')} with payment tracking off and no deposit found are not counted here — turn tracking on in Invoice Details, or link a deposit below.` : ''}
            </p>
            </div>
            <Scope>Ignores timeline · what is open now</Scope>
          </div>
          {view.waiting.length === 0 ? (
            <p className="v3-empty">Every invoice since {dmy(view.from)} has been paid.</p>
          ) : (
            <div className="v3-table-wrap">
              <table className="v3-table">
                <thead>
                  <tr><th>Invoice</th><th>Client</th><th className="num">Still owed</th><th>Invoiced</th><th className="num">Days</th><th>State</th></tr>
                </thead>
                <tbody>
                  {view.waiting.map(i => (
                    <tr key={i.id}>
                      <td><a href={`/invoices/details?q=${encodeURIComponent(i.no)}`}>{i.no}</a></td>
                      <td>{i.client}</td>
                      <td className="num">{i.currency === 'MYR' ? rm(i.remaining) : `${i.currency} ${i.amount.toLocaleString('en-MY')}`}</td>
                      <td>{dmy(i.date)}</td>
                      <td className="num">{i.age}</td>
                      <td><span className="v3-cf-state" data-s={i.state}>{STATE_LABEL[i.state]}{i.state === 'part' && i.bank ? ` · ${rm(i.bank.received)} in` : ''}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view.markedOnly.length ? (
            <p className="v3-cf-note">
              {plural(view.markedOnly.length, 'invoice')} marked paid with no matching deposit: {view.markedOnly.map(i => i.no).join(', ')}. Paid another way, or link the deposit below.
            </p>
          ) : null}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-unmatched">
          <div className="v3-scoped-head">
            <div>
            <h2 className="v3-panel-title" id="t-unmatched">Money in, no invoice found</h2>
            <p className="v3-panel-note">Client deposits the app could not tie to an invoice. Pick the invoice, or say it isn&rsquo;t one.</p>
            </div>
            <Scope>Ignores timeline · what is open now</Scope>
          </div>
          {view.unmatched.length === 0 ? (
            <p className="v3-empty">Every client deposit is tied to an invoice.</p>
          ) : (
            <div className="v3-table-wrap">
              <table className="v3-table v3-cf-lines">
                <thead>
                  <tr><th>Date</th><th>From</th><th>Their reference</th><th className="num">Amount</th>{canEdit ? <th>Which invoice?</th> : null}</tr>
                </thead>
                <tbody>
                  {[...view.unmatched].reverse().map(t => (
                    <tr key={t.id}>
                      <td>{dmy(t.date)}</td>
                      <td>{t.party ?? t.type}</td>
                      <td className="v3-cf-ref">{t.note ?? '—'}</td>
                      <td className="num">{rm(t.amount)}</td>
                      {canEdit ? (
                        <td>
                          <LinkForm t={t} open={view.openInvoices} />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-paid-out">
          <div className="v3-scoped-head">
            <div>
              <h2 className="v3-panel-title" id="t-paid-out">Payments out · {label}</h2>
              <p className="v3-panel-note">
                {picked
                  ? <>{picked.label} only, newest first — {rmFull(picked.total)} over {plural(picked.count, 'payment')}.</>
                  : <>Every withdrawal in the period, newest first — {rmFull(view.totals.out)} in all. Pick a kind under Money out to narrow it.</>}
              </p>
              {picked ? (
                <a className="v3-fbar-chip" href={outHref(undefined)} style={{ marginTop: 'var(--space-2)', display: 'inline-flex' }}>
                  {picked.label} <span aria-hidden="true">✕</span><span className="v3-visually-hidden">show every kind</span>
                </a>
              ) : null}
            </div>
            <Scope>Timeline</Scope>
          </div>
          {paidOut.length === 0 ? (
            <p className="v3-empty">{picked ? `No ${picked.label.toLowerCase()} payments in this period.` : 'Nothing left the account in this period.'}</p>
          ) : (
            <div className="v3-table-wrap">
              <table className="v3-table v3-cf-lines">
                <thead>
                  <tr><th>Date</th><th>To</th><th>Reference</th><th>Kind</th><th className="num">Amount</th></tr>
                </thead>
                <tbody>
                  {paidOut.map(t => (
                    <tr key={t.id}>
                      <td>{dmy(t.date)}</td>
                      <td>{t.party ?? t.type}</td>
                      <td className="v3-cf-ref">{t.note ?? '—'}</td>
                      <td>{canEdit ? <KindForm t={t} /> : t.kindLabel}</td>
                      <td className="num">{rm(-t.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-lines">
          <div className="v3-scoped-head">
            <div>
              <h2 className="v3-panel-title" id="t-lines">Latest bank lines</h2>
              <p className="v3-panel-note">The newest {lines.length} of {periodTxns.length} in the period. The kind decides which total a line counts in — change it if the app guessed wrong.</p>
            </div>
            <Scope>Timeline</Scope>
          </div>
          <div className="v3-table-wrap">
            <table className="v3-table v3-cf-lines">
              <thead>
                <tr><th>Date</th><th>Who</th><th>Reference</th><th className="num">In</th><th className="num">Out</th><th>Kind</th><th>Invoice</th></tr>
              </thead>
              <tbody>
                {lines.map(t => (
                  <tr key={t.id}>
                    <td>{dmy(t.date)}</td>
                    <td>{t.party ?? t.type}</td>
                    <td className="v3-cf-ref">{t.note ?? '—'}</td>
                    <td className="num">{t.amount > 0 ? rm(t.amount) : ''}</td>
                    <td className="num">{t.amount < 0 ? rm(-t.amount) : ''}</td>
                    <td>{canEdit ? <KindForm t={t} /> : t.kindLabel}</td>
                    <td>{t.invoices.length ? t.invoices.map(i => i.no).join(', ') : t.linkSet ? 'not an invoice' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}

// "+RM 1,234" / "−RM 1,234" for a net figure (formatting only — the figure comes from lib/bank.ts).
const signed = (n: number) => (n < 0 ? `−${rmFull(-n)}` : `+${rmFull(n)}`)

function Head({ lede }: { lede: React.ReactNode }) {
  return (
    <header className="v3-head">
      <div>
        <h1 className="v3-title">Cash flow</h1>
        <p className="v3-lede">{lede}</p>
      </div>
    </header>
  )
}

// Plain forms posting to server actions: they work before the page's JavaScript loads, and the server re-checks
// everything (lib/bank-actions.ts).
function LinkForm({ t, open }: { t: TxnView; open: { id: number; no: string; client: string; date: string; amount: number; currency: string }[] }) {
  // invoices dated up to two weeks after the deposit and before it; closest amount first
  const near = open
    .filter(i => i.date <= addDays(t.date, 14))
    .sort((a, b) => Math.abs(a.amount - t.amount) - Math.abs(b.amount - t.amount))
    .slice(0, 15)
  return (
    <form action={linkDeposit} className="v3-cf-form">
      <input type="hidden" name="txn" value={t.id} />
      <select className="v3-select" name="invoice" defaultValue="auto" aria-label={`Invoice paid by the ${dmy(t.date)} deposit`}>
        <option value="auto">Choose…</option>
        <option value="none">Not an invoice payment</option>
        {near.map(i => (
          <option key={i.id} value={i.id}>
            {i.no} · {i.client} · {i.currency === 'MYR' ? rm(i.amount) : `${i.currency} ${i.amount}`}
          </option>
        ))}
      </select>
      <button className="v3-btn" type="submit">Save</button>
    </form>
  )
}

function KindForm({ t }: { t: TxnView }) {
  const kinds = t.amount > 0 ? IN_KINDS : OUT_KINDS
  return (
    <form action={setTxnKind} className="v3-cf-form">
      <input type="hidden" name="txn" value={t.id} />
      <select className="v3-select" name="kind" defaultValue={t.kindSet ? t.kind : 'auto'} aria-label={`Kind of the ${dmy(t.date)} line`}>
        <option value="auto">{t.kindSet ? 'Let the app decide' : `${t.kindLabel} (auto)`}</option>
        {Object.entries(kinds).map(([k, label]) => (
          <option key={k} value={k}>{label}</option>
        ))}
      </select>
      <button className="v3-btn" type="submit">Save</button>
    </form>
  )
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
