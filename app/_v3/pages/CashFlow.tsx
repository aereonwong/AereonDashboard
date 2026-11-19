import type { CashFlow as View, TxnView } from '@/lib/bank'
import { IN_KINDS, OUT_KINDS } from '@/lib/bank-math'
import { confirmFromBankForm, linkDeposit, setTxnKind } from '@/lib/bank-actions'
import Icon from '@/app/_components/Icon'
import { rmFull } from '../fmt'
import { dmy, mon, plural, rm } from './property/shared'
import '../cashflow.css'

// 👉 v3 Invoices → Cash flow. Two different things side by side: what was INVOICED (revenue, on the invoice date)
// and what LANDED in the company bank account (cash, on the day it arrived). It answers: how much is in the bank,
// which invoices the bank shows paid, which are still waiting, and which deposits nobody has explained yet.
// Every figure comes from lib/bank.ts; this file only draws.

const STATE_LABEL = { 'paid-bank': 'Paid', part: 'Part paid', 'marked-only': 'Marked paid', unpaid: 'Waiting', 'before-bank': 'Before statements' } as const

export default function CashFlow({ view, sql, sqlUrl, canEdit, lockNote = null }: { view: View; sql: string; sqlUrl: string | null; canEdit: boolean; lockNote?: string | null }) {
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

  const last12 = view.months.slice(-12)
  const max = Math.max(1, ...last12.map(m => Math.max(m.invoiced, m.clientIn)))
  const maxFlow = Math.max(1, ...last12.map(m => Math.max(m.cashIn, m.out)))
  const maxOut = Math.max(1, ...view.outKinds.map(k => k.total))
  const lines = view.txns.slice(0, 40)
  const paidOut = view.txns.filter(t => t.amount < 0 && t.date.startsWith(view.year)) // newest first

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

      <section className="v3-kpis" aria-label="The bank account this year">
        <div className="v3-kpi">
          <div className="v3-kpi-label">Money in {view.year}</div>
          <div className="v3-kpi-value">{rmFull(view.ytd.cashIn)}</div>
          <div className="v3-kpi-note">everything paid into the account — clients, director, interest, refunds</div>
        </div>
        <a className="v3-kpi" href="#t-paid-out">
          <div className="v3-kpi-label">Money out {view.year}</div>
          <div className="v3-kpi-value">{rmFull(view.ytd.out)}</div>
          <div className="v3-kpi-note">everything withdrawn — {plural(paidOut.length, 'payment')}</div>
        </a>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Net cash flow {view.year}</div>
          <div className="v3-kpi-value">{signed(view.ytd.net)}</div>
          <div className="v3-kpi-note">money in minus money out</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Bank balance</div>
          <div className="v3-kpi-value">{view.balance == null ? '—' : rmFull(view.balance)}</div>
          <div className="v3-kpi-note">on {dmy(view.to)}</div>
        </div>
      </section>

      <section className="v3-kpis" aria-label="Invoices against the bank" style={{ marginTop: 'var(--space-4)' }}>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Invoiced {view.year}</div>
          <div className="v3-kpi-value">{rmFull(view.ytd.invoiced)}</div>
          <div className="v3-kpi-note">revenue, by invoice date (RM invoices)</div>
        </div>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Client money in {view.year}</div>
          <div className="v3-kpi-value">{rmFull(view.ytd.clientIn)}</div>
          <div className="v3-kpi-note">cash that landed in the bank, by the day it landed</div>
        </div>
        <a className="v3-kpi" href="#t-waiting">
          <div className="v3-kpi-label">Still to collect</div>
          <div className="v3-kpi-value">{rmFull(view.owed.rm)}</div>
          <div className="v3-kpi-note">
            {plural(view.owed.count, 'invoice')} with no money in the bank yet{view.owed.foreign ? ` (${view.owed.foreign} in other currencies, not in the RM figure)` : ''}
          </div>
        </a>
        <div className="v3-kpi">
          <div className="v3-kpi-label">Time to get paid</div>
          <div className="v3-kpi-value">{view.median == null ? '—' : `${view.median} days`}</div>
          <div className="v3-kpi-note">median, invoice date to money in the bank</div>
        </div>
      </section>

      <div className="v3-grid" style={{ marginTop: 'var(--space-5)' }}>
        <section className="v3-panel v3-span-8" aria-labelledby="t-inout">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-inout">Money in vs money out</h2>
            <p className="v3-panel-note">Last 12 months, everything that entered and left the account. Hover a month for the net and the balance.</p>
          </div>
          <ol className="v3-cf-bars" aria-label="Money in and money out per month">
            {last12.map(m => {
              return (
                <li
                  key={m.month}
                  data-tip={`${mon(`${m.month}-01`)}\n${m.bank === 'none' ? 'No statement for this month' : `Money in ${rmFull(m.cashIn)}\nMoney out ${rmFull(m.out)}\nNet ${signed(m.net)}${m.closing != null ? `\nBank balance at month end ${rmFull(m.closing)}` : ''}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}
                >
                  <span className="v3-cf-pair">
                    <i className="cash" style={{ ['--h' as string]: m.cashIn / maxFlow }} />
                    <i className="out" style={{ ['--h' as string]: m.out / maxFlow }} />
                  </span>
                  <span className="v3-cf-label">{mon(`${m.month}-01`).slice(0, 3)}</span>
                </li>
              )
            })}
          </ol>
          <p className="v3-cf-legend">
            <span><i className="cash" /> Money in</span>
            <span><i className="out" /> Money out</span>
          </p>
        </section>

        <section className="v3-panel v3-span-4" aria-labelledby="t-out">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-out">Money out {view.year}</h2>
            <p className="v3-panel-note">Everything that left the bank account, by kind.</p>
          </div>
          {view.outKinds.length === 0 ? (
            <p className="v3-empty">Nothing left the account this year.</p>
          ) : (
            <div className="v3-rows">
              {view.outKinds.map(k => (
                <div key={k.kind} className="v3-row">
                  <div className="v3-row-main">
                    <div className="v3-row-title">{k.label}</div>
                    <div className="v3-row-sub">{plural(k.count, 'payment')}</div>
                  </div>
                  <div className="v3-row-num">{rmFull(k.total)}</div>
                  <div className="v3-row-bar" aria-hidden="true">
                    <i style={{ ['--w' as string]: k.total / maxOut }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="v3-panel v3-span-12" aria-labelledby="t-months">
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-months">Invoiced vs money in</h2>
            <p className="v3-panel-note">Last 12 months of revenue against client payments. The gap is money on its way, or invoices nobody has paid.</p>
          </div>
          <ol className="v3-cf-bars" aria-label="Invoiced and client money in per month">
            {last12.map(m => (
              <li
                key={m.month}
                data-tip={`${mon(`${m.month}-01`)}\nInvoiced ${rmFull(m.invoiced)}${m.bank === 'none' ? '\nNo bank statement for this month' : `\nClient money in ${rmFull(m.clientIn)}\nAll money out ${rmFull(m.out)}${m.closing != null ? `\nBank balance at month end ${rmFull(m.closing)}` : ''}${m.bank === 'part' ? '\nStatement covers part of this month only' : ''}`}`}
              >
                <span className="v3-cf-pair">
                  <i className="inv" style={{ ['--h' as string]: m.invoiced / max }} />
                  <i className="cash" style={{ ['--h' as string]: m.clientIn / max }} />
                </span>
                <span className="v3-cf-label">{mon(`${m.month}-01`).slice(0, 3)}</span>
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
            <div className="v3-panel-head">
              <h2 className="v3-panel-title" id="t-confirm">Paid, says the bank</h2>
              <p className="v3-panel-note">The money landed; the app doesn&rsquo;t know yet. Marking paid records the bank&rsquo;s date. Undo is &ldquo;Mark unpaid&rdquo; on Invoice Details.</p>
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
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-waiting">Waiting for payment</h2>
            <p className="v3-panel-note">
              Invoices since the statements began with no money in the bank yet (or only part), oldest first.
              {view.untracked ? ` ${plural(view.untracked, 'invoice')} with payment tracking off and no deposit found are not counted here — turn tracking on in Invoice Details, or link a deposit below.` : ''}
            </p>
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
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-unmatched">Money in, no invoice found</h2>
            <p className="v3-panel-note">Client deposits the app could not tie to an invoice. Pick the invoice, or say it isn&rsquo;t one.</p>
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
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-paid-out">Payments out {view.year}</h2>
            <p className="v3-panel-note">Every withdrawal this year, newest first — {rmFull(view.ytd.out)} in all.</p>
          </div>
          {paidOut.length === 0 ? (
            <p className="v3-empty">Nothing left the account this year.</p>
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
          <div className="v3-panel-head">
            <h2 className="v3-panel-title" id="t-lines">Latest bank lines</h2>
            <p className="v3-panel-note">The newest {lines.length} of {view.txns.length}. The kind decides which total a line counts in — change it if the app guessed wrong.</p>
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
