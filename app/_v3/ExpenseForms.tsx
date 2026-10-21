'use client'

import { Fragment, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/app/_components/Icon'
import { attachReceipt, deleteExpense, exportMonth, saveExpense, waiveReceipt } from '@/lib/expense-actions'
import type { MonthExport } from '@/lib/expense-drive'
import { KINDS, KIND_LABEL, KIND_ONE, receiptState, type Expense, type ExpenseFilters } from '@/lib/expenses-math'
import { dmy, monthName, sen, today } from './pages/property/shared'
import './filterbar.css'
import './expenses.css'

// Add / edit, the list, the filter bar and the month export for the Expenses pages. Every form is both: with an
// `initial` row it saves over that row (hidden `id`), without one it adds a new row. Rows edit in place.

type Msg = { ok: boolean; text: string } | null
const PAGE = 15

export type Lists = { vendors: string[]; trips: string[]; paidWith: string[] }

export function ExpenseForm({ initial, lists, onDone }: { initial?: Expense; lists: Lists; onDone?: () => void }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const [currency, setCurrency] = useState(initial?.currency ?? 'MYR')
  const fid = `exp-${initial?.id ?? 'new'}`
  return (
    <form
      data-edit=""
      data-money-edit=""
      className="v3-prop-form v3-exp-form"
      id={fid}
      action={form => {
        setMsg(null)
        start(async () => {
          const r = await saveExpense(form)
          setMsg(r.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: r.error })
          if (r.ok) {
            if (!initial) {
              ;(document.getElementById(fid) as HTMLFormElement | null)?.reset()
              setCurrency('MYR')
            }
            onDone?.()
          }
        })
      }}
    >
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <label>
        <span>Date paid</span>
        <input className="v3-select" type="date" name="spent_on" defaultValue={initial?.spent_on ?? today()} required />
      </label>
      <label>
        <span>What kind</span>
        <select className="v3-select" name="kind" defaultValue={initial?.kind ?? 'hotel'}>
          {KINDS.map(k => (
            <option key={k} value={k}>
              {KIND_ONE[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>Paid to</span>
        <input className="v3-select" name="vendor" list={`${fid}-vendors`} autoComplete="off" maxLength={120} placeholder="e.g. Trip.com" defaultValue={initial?.vendor ?? ''} required />
        <datalist id={`${fid}-vendors`}>
          {lists.vendors.map(v => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>
      <label>
        <span>Amount paid (RM)</span>
        <input className="v3-select num" name="amount" inputMode="decimal" autoComplete="off" placeholder="e.g. 531.16" defaultValue={initial ? initial.amount : ''} required />
      </label>
      <label className="v3-exp-wide">
        <span>What it was for</span>
        <input className="v3-select" name="description" autoComplete="off" maxLength={300} placeholder="Hotel name, route, plan, item…" defaultValue={initial?.description ?? ''} />
      </label>
      <label>
        <span>Booking / order / invoice no.</span>
        <input className="v3-select" name="reference" autoComplete="off" maxLength={80} defaultValue={initial?.reference ?? ''} />
      </label>
      <label>
        <span>Trip or job (groups costs)</span>
        <input className="v3-select" name="trip" list={`${fid}-trips`} autoComplete="off" maxLength={80} placeholder="e.g. Bali FAM Oct 2026" defaultValue={initial?.trip ?? ''} />
        <datalist id={`${fid}-trips`}>
          {lists.trips.map(v => (
            <option key={v} value={v} />
          ))}
        </datalist>
      </label>
      <details className="v3-exp-wide">
        <summary>More: card, other currency, repeats, notes</summary>
        <div className="v3-exp-more">
          <label>
            <span>Paid with</span>
            <input className="v3-select" name="paid_with" list={`${fid}-cards`} autoComplete="off" maxLength={80} placeholder="e.g. company Visa" defaultValue={initial?.paid_with ?? ''} />
            <datalist id={`${fid}-cards`}>
              {lists.paidWith.map(v => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Repeats</span>
            <select className="v3-select" name="recurring" defaultValue={initial?.recurring ?? ''}>
              <option value="">One-off</option>
              <option value="monthly">Every month</option>
              <option value="yearly">Every year</option>
            </select>
          </label>
          <label>
            <span>Currency charged</span>
            <input className="v3-select" name="currency" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} maxLength={3} autoComplete="off" />
          </label>
          {currency !== 'MYR' ? (
            <label>
              <span>Amount in {currency || 'that currency'}</span>
              <input className="v3-select num" name="original_amount" inputMode="decimal" autoComplete="off" defaultValue={initial?.original_amount ?? ''} />
            </label>
          ) : null}
          <label className="v3-exp-wide">
            <span>Notes</span>
            <input className="v3-select" name="notes" autoComplete="off" maxLength={500} defaultValue={initial?.notes ?? ''} />
          </label>
        </div>
      </details>
      <button className="v3-btn v3-btn-primary v3-exp-wide" type="submit" disabled={pending}>
        {pending ? 'Saving…' : initial ? 'Save changes' : 'Add expense'}
      </button>
      <p className="v3-prop-msg v3-exp-wide" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </form>
  )
}

function ReceiptChip({ e }: { e: Expense }) {
  const s = receiptState(e)
  if (s === 'filed')
    return (
      <a className="v3-exp-chip" data-s="filed" href={e.receipt?.url} target="_blank" rel="noreferrer" title={e.receipt?.name}>
        <Icon name="check" /> Filed
      </a>
    )
  if (s === 'waived')
    return (
      <span className="v3-exp-chip" data-s="waived">
        Not needed
      </span>
    )
  if (s === 'uploading')
    return (
      <span className="v3-exp-chip" data-s="uploading">
        Uploading…
      </span>
    )
  if (s === 'failed')
    return (
      <span className="v3-exp-chip" data-s="failed" title={e.receipt?.error}>
        <Icon name="alert" /> Failed
      </span>
    )
  return (
    <span className="v3-exp-chip" data-s="missing">
      Missing
    </span>
  )
}

function ReceiptTools({ e, canDrive, onDone }: { e: Expense; canDrive: boolean; onDone: () => void }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const s = receiptState(e)
  return (
    <div className="v3-exp-receipt" data-edit="">
      <h4 className="v3-exp-sub">Receipt</h4>
      {s === 'filed' && e.receipt?.url ? (
        <p className="v3-panel-note">
          In Google Drive: <a href={e.receipt.url} target="_blank" rel="noreferrer">{e.receipt.name ?? 'open the file'}</a>. Choosing a new file replaces it (the old one goes to Drive&rsquo;s trash).
        </p>
      ) : s === 'waived' ? (
        <p className="v3-panel-note">Marked as not needing a receipt.</p>
      ) : (
        <p className="v3-panel-note">
          {e.source_ref?.gmail_id ? 'This came from an email — the receipt can be pulled from it automatically (npm run expense:receipts).' : 'Choose the PDF or photo and it is filed in Drive.'}
        </p>
      )}
      <form
        className="v3-exp-upload"
        action={form => {
          setMsg(null)
          start(async () => {
            const r = await attachReceipt(form)
            setMsg(r.ok ? { ok: true, text: 'Filed in Google Drive.' } : { ok: false, text: r.error })
            if (r.ok) onDone()
          })
        }}
      >
        <input type="hidden" name="id" value={e.id} />
        <input className="v3-select" type="file" name="file" accept="application/pdf,image/png,image/jpeg,image/webp,image/heic" required aria-label="Receipt file" />
        <button className="v3-btn v3-btn-primary" type="submit" disabled={pending || !canDrive} title={canDrive ? undefined : 'Google Drive is not connected on this server'}>
          <Icon name="upload" /> {pending ? 'Filing…' : s === 'filed' ? 'Replace' : 'Upload to Drive'}
        </button>
      </form>
      {s !== 'filed' ? (
        <button
          type="button"
          className="v3-btn"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await waiveReceipt(e.id, s !== 'waived')
              setMsg(r.ok ? { ok: true, text: s === 'waived' ? 'Back to needing a receipt.' : 'Marked as not needed.' } : { ok: false, text: r.error })
              if (r.ok) onDone()
            })
          }
        >
          {s === 'waived' ? 'It does need a receipt' : 'No receipt needed'}
        </button>
      ) : null}
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </div>
  )
}

function RowButtons({ editing, toggle, remove }: { editing: boolean; toggle: () => void; remove: () => Promise<unknown> }) {
  const [pending, start] = useTransition()
  return (
    <span className="v3-prop-actions" data-edit="">
      <button type="button" className="v3-btn" aria-expanded={editing} onClick={toggle}>
        {editing ? 'Close' : 'Edit'}
      </button>
      <button
        type="button"
        className="v3-btn"
        disabled={pending}
        aria-label="Delete this expense"
        onClick={() => {
          if (confirm('Delete this expense? Its receipt stays in Google Drive.')) start(async () => void (await remove()))
        }}
      >
        {pending ? '…' : 'Delete'}
      </button>
    </span>
  )
}

/** The expense table: ten-ish to a page, edit / receipt / delete in place. Filtering already happened on the server. */
export function ExpenseList({ rows, lists, canDrive }: { rows: Expense[]; lists: Lists; canDrive: boolean }) {
  const [open, setOpen] = useState<number | null>(null)
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const at = Math.min(page, pages - 1)
  const shown = rows.slice(at * PAGE, at * PAGE + PAGE)
  if (!rows.length) return <p className="v3-empty">Nothing matches these filters.</p>
  return (
    <div>
      <div className="v3-table-wrap">
        <table className="v3-table v3-prop-table v3-exp-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>What</th>
              <th>Amount (RM)</th>
              <th>Receipt</th>
              <th>
                <span className="sr-only">Edit or delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(e => (
              <Fragment key={e.id}>
                <tr>
                  <td>{dmy(e.spent_on)}</td>
                  <td>
                    <div className="v3-exp-what">
                      <b>{e.vendor}</b>
                      <span className="v3-exp-kind">{KIND_ONE[e.kind]}</span>
                      {e.recurring ? <span className="v3-exp-kind">{e.recurring === 'monthly' ? 'monthly' : 'yearly'}</span> : null}
                    </div>
                    <div className="v3-panel-note">{[e.description, e.trip, e.reference ? `#${e.reference}` : null].filter(Boolean).join(' · ') || '—'}</div>
                  </td>
                  <td className="num" data-money>
                    {sen(e.amount)}
                    {e.currency !== 'MYR' && e.original_amount != null ? <div className="v3-panel-note">{e.currency} {sen(e.original_amount)}</div> : null}
                  </td>
                  <td>
                    <ReceiptChip e={e} />
                  </td>
                  <td>
                    <RowButtons editing={open === e.id} toggle={() => setOpen(open === e.id ? null : e.id)} remove={() => deleteExpense(e.id)} />
                  </td>
                </tr>
                {open === e.id ? (
                  <tr className="v3-prop-edit">
                    <td colSpan={5}>
                      <div className="v3-exp-edit">
                        <ExpenseForm initial={e} lists={lists} onDone={() => setOpen(null)} />
                        <ReceiptTools e={e} canDrive={canDrive} onDone={() => setOpen(null)} />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="v3-prop-pager" aria-label="Pages">
          <button type="button" className="v3-btn" disabled={at === 0} onClick={() => setPage(at - 1)}>
            Newer
          </button>
          <span className="v3-panel-note">
            Page {at + 1} of {pages}
          </span>
          <button type="button" className="v3-btn" disabled={at >= pages - 1} onClick={() => setPage(at + 1)}>
            Older
          </button>
        </nav>
      ) : null}
    </div>
  )
}

/** The one sticky filter bar (docs/FILTER-BAR.md). It only rewrites the URL; the server redraws the page. */
export function ExpenseFilterBar({ filters, years, trips, count, total }: { filters: ExpenseFilters; years: string[]; trips: string[]; count: number; total: string }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const defaultYear = today().slice(0, 4)

  const set = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params?.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') p.delete(k)
      else p.set(k, v)
    }
    if (p.get('year') === defaultYear) p.delete('year')
    start(() => router.replace(p.toString() ? `${path}?${p}` : path, { scroll: false }))
  }

  const yearValue = filters.month ? filters.month.slice(0, 4) : filters.year || 'all'
  const differs = !!filters.month || !!filters.kind || !!filters.receipt || !!filters.trip || !!filters.q || filters.year !== defaultYear

  return (
    <div className="v3-fbar" role="toolbar" aria-label="Filter every panel" data-pending={pending}>
      <div className="v3-fbar-group">
        <span className="v3-fbar-label">Year</span>
        <select className="v3-fbar-select" aria-label="Year" value={yearValue} onChange={e => set({ year: e.target.value === defaultYear ? undefined : e.target.value, month: undefined })}>
          <option value="all">All years</option>
          {years.map(y => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {filters.month ? (
          <button type="button" className="v3-fbar-chip" onClick={() => set({ month: undefined })} aria-label={`Remove ${monthName(`${filters.month}-01`)} filter`}>
            {monthName(`${filters.month}-01`)} ✕
          </button>
        ) : null}
      </div>
      <div className="v3-fbar-group">
        <span className="v3-fbar-label">Kind</span>
        <select className="v3-fbar-select" aria-label="Kind" value={filters.kind} onChange={e => set({ kind: e.target.value })}>
          <option value="">All kinds</option>
          {KINDS.map(k => (
            <option key={k} value={k}>
              {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="v3-fbar-group">
        <span className="v3-fbar-label">Receipt</span>
        <div className="v3-seg" role="group" aria-label="Receipt">
          {([['', 'All'], ['missing', 'Missing'], ['filed', 'Filed']] as const).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={filters.receipt === v} onClick={() => set({ receipt: v })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {trips.length ? (
        <div className="v3-fbar-group">
          <span className="v3-fbar-label">Trip</span>
          <select className="v3-fbar-select" aria-label="Trip or job" value={filters.trip} onChange={e => set({ trip: e.target.value })}>
            <option value="">All trips</option>
            {trips.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="v3-fbar-group">
        <input
          className="v3-fbar-select v3-exp-search"
          type="search"
          aria-label="Search expenses"
          placeholder="Search vendor, booking no…"
          defaultValue={filters.q}
          key={filters.q}
          onKeyDown={e => {
            if (e.key === 'Enter') set({ q: (e.target as HTMLInputElement).value.trim() })
          }}
          onBlur={e => {
            if (e.target.value.trim() !== filters.q) set({ q: e.target.value.trim() })
          }}
        />
      </div>
      <div className="v3-fbar-count" aria-live="polite">
        <span>
          <b>{count}</b> expense{count === 1 ? '' : 's'} · <span data-money>{total}</span>
        </span>
        {differs ? (
          <button type="button" className="v3-fbar-reset" onClick={() => router.replace(path, { scroll: false })}>
            Reset
          </button>
        ) : null}
      </div>
    </div>
  )
}

/** Send one month's list to Google Drive as a CSV the accountant can open. */
export function MonthExportCard({ months, exports, canDrive, initial }: { months: string[]; exports: Record<string, MonthExport>; canDrive: boolean; initial: string }) {
  const [month, setMonth] = useState(initial)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<Msg>(null)
  const last = exports[month]
  return (
    <div className="v3-exp-export" data-edit="" data-money-edit="">
      <label>
        <span className="sr-only">Month</span>
        <select className="v3-select" value={month} onChange={e => setMonth(e.target.value)}>
          {months.map(m => (
            <option key={m} value={m}>
              {monthName(`${m}-01`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="v3-btn v3-btn-primary"
        disabled={pending || !canDrive || !month}
        title={canDrive ? undefined : 'Google Drive is not connected on this server'}
        onClick={() =>
          start(async () => {
            setMsg(null)
            const r = await exportMonth(month)
            setMsg(r.ok ? { ok: true, text: 'Filed in Google Drive.' } : { ok: false, text: r.error })
          })
        }
      >
        <Icon name="drive" /> {pending ? 'Filing…' : last ? 'Export again' : 'Export to Drive'}
      </button>
      {last ? (
        <p className="v3-panel-note">
          Last filed {dmy(last.at.slice(0, 10))} — {last.count} expense{last.count === 1 ? '' : 's'}.{' '}
          <a href={last.url} target="_blank" rel="noreferrer">
            Open in Drive
          </a>
        </p>
      ) : (
        <p className="v3-panel-note">One CSV for the month, with a link to every receipt.</p>
      )}
      <p className="v3-prop-msg" role="status" data-ok={msg?.ok}>
        {msg?.text}
      </p>
    </div>
  )
}
