'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/app/_components/Icon'
import { statusFigures, type DetailRow, type FormOptions, type Payment } from '@/lib/invoice-figures'
import type { DriveStatus } from '@/lib/invoice-drive'
import { markPaid, markUnpaid } from '@/lib/v3/payments'
import { uploadToDrive } from '../actions'
import CreateInvoice from '../CreateInvoice'
import '../invoices.css'

// 👉 Invoice Details — the operational table. Every row, filter and figure here
// comes from the records the server already loaded; filtering and sorting run
// in the browser, so changing a filter makes no request at all. Only the row
// actions (Drive upload, PDF, mark paid) reach out, and only when clicked.

type Filters = { year: string; month: string; client: string; payment: string; drive: string; q: string }
type SortKey = 'no' | 'date' | 'client' | 'amount' | 'due'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const PAYMENT_LABEL: Record<Payment, string> = {
  paid: 'Paid',
  outstanding: 'Awaiting',
  overdue: 'Overdue',
  untracked: 'Not tracked',
}
const DRIVE_LABEL: Record<DriveStatus, string> = {
  uploaded: 'In Drive',
  none: 'Not uploaded',
  failed: 'Upload failed',
  uploading: 'Uploading',
}
const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`
const money = (n: number, cur: string) =>
  `${cur === 'MYR' ? 'RM' : cur} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function InvoiceDetails({
  rows,
  options,
  initial,
  demo,
  ready,
  v3,
}: {
  rows: DetailRow[]
  options: FormOptions
  initial: Partial<Filters>
  demo: boolean
  ready: boolean
  v3: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [f, setF] = useState<Filters>({
    year: initial.year ?? options.today.slice(0, 4),
    month: initial.month ?? '',
    client: initial.client ?? '',
    payment: initial.payment ?? '',
    drive: initial.drive ?? '',
    q: initial.q ?? '',
  })
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'date', desc: true })
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null)

  // Keep the filters in the address bar so a refresh or a bookmark keeps them.
  useEffect(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v && !(k === 'year' && v === options.today.slice(0, 4))) p.set(k, v)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [f, options.today])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.bad ? 9000 : 4500)
    return () => clearTimeout(t)
  }, [toast])

  const years = useMemo(() => [...new Set(rows.map(r => r.date.slice(0, 4)))].sort().reverse(), [rows])
  const inYear = useMemo(() => rows.filter(r => !f.year || r.date.startsWith(f.year)), [rows, f.year])
  const clients = useMemo(() => [...new Set(inYear.map(r => r.client))].sort((a, b) => a.localeCompare(b)), [inYear])

  const shown = useMemo(() => {
    const needle = f.q.trim().toLowerCase()
    const list = inYear.filter(
      r =>
        (!f.month || r.date.slice(5, 7) === f.month) &&
        (!f.client || r.client === f.client) &&
        (!f.payment || (f.payment === 'owed' ? r.payment === 'outstanding' || r.payment === 'overdue' : r.payment === f.payment)) &&
        (!f.drive || (f.drive === 'pending' ? r.drive !== 'uploaded' : r.drive === f.drive)) &&
        (!needle || `${r.no} ${r.client} ${r.project}`.toLowerCase().includes(needle)),
    )
    const dir = sort.desc ? -1 : 1
    const val = (r: DetailRow) =>
      sort.key === 'amount' ? r.amount : sort.key === 'client' ? r.client.toLowerCase() : sort.key === 'due' ? r.dueDate ?? '' : sort.key === 'no' ? r.no : r.date
    return [...list].sort((a, b) => {
      const x = val(a)
      const y = val(b)
      return (x < y ? -1 : x > y ? 1 : 0) * dir || b.no.localeCompare(a.no)
    })
  }, [inYear, f, sort])

  const s = statusFigures(shown)
  const set = (k: keyof Filters, v: string) => setF(x => ({ ...x, [k]: v, ...(k === 'year' ? { client: '', month: '' } : {}) }))
  const filtered = !!(f.month || f.client || f.payment || f.drive || f.q)
  const sortBy = (key: SortKey) => setSort(x => ({ key, desc: x.key === key ? !x.desc : key !== 'client' }))
  const ariaSort = (key: SortKey) => (sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined)

  const withBusy = async (id: number, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(b => new Set(b).add(id))
    const res = await fn().catch(e => ({ ok: false, error: String(e) }))
    setBusy(b => {
      const n = new Set(b)
      n.delete(id)
      return n
    })
    setToast(res.ok ? { text: done } : { text: res.error ?? 'Something went wrong', bad: true })
    startTransition(() => router.refresh())
  }

  const locked = demo ? 'Demo data is on — actions are off' : undefined
  const offline = !ready ? 'Canva / Google Drive are not connected on this server yet (COMPOSIO_API_KEY)' : undefined

  const Th = ({ k, children, right }: { k: SortKey; children: React.ReactNode; right?: boolean }) => (
    <th aria-sort={ariaSort(k)} className={right ? 'r' : undefined}>
      <button type="button" onClick={() => sortBy(k)}>
        {children}
        {sort.key === k ? <span aria-hidden="true">{sort.desc ? '↓' : '↑'}</span> : null}
      </button>
    </th>
  )

  return (
    <div className="idt">
      <header className="idt-head">
        <div>
          <h1 className={v3 ? 'v3-title' : 'ph'}>Invoice Details</h1>
          <p>
            Every invoice, its payment and where its PDF is filed. <a href="/invoices">Invoice Summary</a>
          </p>
        </div>
        <CreateInvoice
          options={options}
          disabled={!!locked || !ready}
          disabledReason={locked ?? offline}
          onSaved={no => {
            setF(x => ({ ...x, year: options.today.slice(0, 4), month: '', client: '', payment: '', drive: '', q: '' }))
            setToast({ text: `${no} saved. Upload it to Google Drive from its row when you're ready.` })
            router.refresh()
          }}
        />
      </header>

      {!ready && !demo ? (
        <p className="idt-banner" role="status">
          Creating invoices, Drive uploads and PDF downloads need Canva and Google Drive connected on this server
          (<code>COMPOSIO_API_KEY</code>). Everything else on this page works without it. PDFs already in Drive still
          download.
        </p>
      ) : null}

      <section className="idt-figs" aria-label="Figures for the invoices shown">
        <div className="idt-fig">
          <div className="idt-fig-label">Invoices</div>
          <div className="idt-fig-value">{s.count}</div>
          <div className="idt-fig-note">{filtered ? 'matching filters' : f.year || 'all years'}</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">Invoiced</div>
          <div className="idt-fig-value">{rm(s.totalRM)}</div>
          <div className="idt-fig-note" title={s.foreign.map(x => `${x.currency} ${x.total.toLocaleString('en-MY')}`).join(' · ')}>
            {s.foreign.length ? `+ ${s.foreign.map(x => `${x.currency} ${Math.round(x.total).toLocaleString('en-MY')}`).join(', ')}` : 'ringgit'}
          </div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-pos)' }} /> Paid
          </div>
          <div className="idt-fig-value">{rm(s.paidRM)}</div>
          <div className="idt-fig-note">{s.paidCount} invoice{s.paidCount === 1 ? '' : 's'}</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-warn)' }} /> Outstanding
          </div>
          <div className="idt-fig-value">{rm(s.outstandingRM)}</div>
          <div className="idt-fig-note">
            {s.untrackedCount ? `${s.untrackedCount} not tracked` : `${s.outstandingCount} invoice${s.outstandingCount === 1 ? '' : 's'}`}
          </div>
        </div>
        <div className={`idt-fig${s.overdueCount ? ' neg' : ''}`}>
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-neg)' }} /> Overdue
          </div>
          <div className="idt-fig-value">{rm(s.overdueRM)}</div>
          <div className="idt-fig-note">{s.overdueCount ? `${s.overdueCount} past due` : 'none past due'}</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">
            <Icon name="drive" /> In Google Drive
          </div>
          <div className="idt-fig-value">
            {s.driveUploaded} / {s.count}
          </div>
          <div className="idt-meter" aria-hidden="true">
            <i style={{ width: `${s.count ? (s.driveUploaded / s.count) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      <div className="idt-filters" role="search">
        <select aria-label="Year" value={f.year} onChange={e => set('year', e.target.value)}>
          <option value="">All years</option>
          {years.map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select aria-label="Month" value={f.month} onChange={e => set('month', e.target.value)}>
          <option value="">All months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1).padStart(2, '0')}>
              {m}
            </option>
          ))}
        </select>
        <select aria-label="Client" value={f.client} onChange={e => set('client', e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All clients</option>
          {clients.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select aria-label="Payment status" value={f.payment} onChange={e => set('payment', e.target.value)}>
          <option value="">Any payment</option>
          <option value="owed">Awaiting + overdue</option>
          <option value="overdue">Overdue</option>
          <option value="paid">Paid</option>
          <option value="untracked">Not tracked</option>
        </select>
        <select aria-label="Google Drive status" value={f.drive} onChange={e => set('drive', e.target.value)}>
          <option value="">Any Drive status</option>
          <option value="uploaded">In Drive</option>
          <option value="pending">Not in Drive yet</option>
          <option value="failed">Upload failed</option>
        </select>
        <input type="search" aria-label="Search" placeholder="Search number, client or job" value={f.q} onChange={e => set('q', e.target.value)} />
        {filtered ? (
          <button type="button" className="idt-reset" onClick={() => setF(x => ({ ...x, month: '', client: '', payment: '', drive: '', q: '' }))}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="idt-wrap">
        <table className="idt-table">
          <thead>
            <tr>
              <Th k="no">Invoice</Th>
              <Th k="date">Date</Th>
              <Th k="client">Client</Th>
              <th>Project</th>
              <Th k="amount" right>
                Amount
              </Th>
              <Th k="due">Payment</Th>
              <th>Drive</th>
              <th className="r">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const isBusy = busy.has(r.id) || r.drive === 'uploading'
              const canPdf = r.drive === 'uploaded' || (r.hasDesign && ready)
              return (
                <tr key={r.id}>
                  <td className="idt-no">{r.no}</td>
                  <td className="idt-num" title={`Filed ${r.createdAt} · source: ${r.source}`}>
                    {r.date}
                    {r.createdAt !== r.date ? <span className="idt-sub">filed {r.createdAt}</span> : null}
                  </td>
                  <td>
                    <div className="idt-client" title={r.client}>
                      {r.client}
                    </div>
                  </td>
                  <td>
                    <div className="idt-proj" title={r.project}>
                      {r.project || '—'}
                    </div>
                  </td>
                  <td className="r idt-num">
                    {r.currency !== 'MYR' ? <span className="idt-fx">{r.currency}</span> : null}
                    {money(r.amount, r.currency)}
                  </td>
                  <td>
                    <span className={`idt-pill ${r.payment}`}>
                      <span className="idt-dot" /> {PAYMENT_LABEL[r.payment]}
                    </span>
                    {r.payment === 'paid' && r.paidAt ? (
                      <span className="idt-sub idt-num">on {r.paidAt}</span>
                    ) : r.dueDate ? (
                      <span className="idt-sub idt-num">due {r.dueDate}</span>
                    ) : null}
                  </td>
                  <td>
                    {r.drive === 'uploaded' ? (
                      <a
                        className="idt-drive uploaded"
                        href={r.driveUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open the PDF in Google Drive"
                      >
                        <Icon name="drive" /> In Drive
                      </a>
                    ) : (
                      <span className={`idt-drive ${r.drive}`}>
                        <button
                          type="button"
                          className={`idt-act ${r.drive === 'failed' ? 'bad' : 'go'}${isBusy ? ' busy' : ''}`}
                          disabled={isBusy || !!locked || !ready || !r.hasDesign}
                          onClick={() => withBusy(r.id, () => uploadToDrive(r.id), `${r.no} uploaded to Google Drive`)}
                          aria-label={`Upload ${r.no} to Google Drive`}
                          title={
                            locked ??
                            offline ??
                            (!r.hasDesign
                              ? 'No Canva design linked — nothing to upload'
                              : r.drive === 'failed'
                                ? `Retry upload — ${r.driveError ?? 'last try failed'}`
                                : 'Upload PDF to Google Drive')
                          }
                        >
                          <Icon name={isBusy ? 'refresh' : r.drive === 'failed' ? 'alert' : 'upload'} />
                        </button>
                        {isBusy ? 'Uploading…' : DRIVE_LABEL[r.drive]}
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="idt-acts">
                      {r.canvaUrl ? (
                        <a className="idt-act" href={r.canvaUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.no} in Canva`} title="Open in Canva">
                          <Icon name="design" />
                        </a>
                      ) : (
                        <span className="idt-act" aria-disabled="true" title="No Canva design linked">
                          <Icon name="design" />
                        </span>
                      )}

                      {canPdf ? (
                        <a className="idt-act" href={`/api/invoices/${r.id}/pdf`} target="_blank" rel="noopener" aria-label={`Download ${r.no} as PDF`} title="Download PDF">
                          <Icon name="download" />
                        </a>
                      ) : (
                        <span className="idt-act" aria-disabled="true" title={r.hasDesign ? offline : 'No Canva design linked'}>
                          <Icon name="download" />
                        </span>
                      )}

                      <button
                        type="button"
                        className={`idt-act${r.payment === 'paid' ? ' on' : ''}`}
                        disabled={busy.has(r.id) || !!locked}
                        onClick={() =>
                          r.payment === 'paid'
                            ? withBusy(r.id, () => markUnpaid(r.id), `${r.no} no longer marked paid`)
                            : withBusy(r.id, () => markPaid(r.id), `${r.no} marked paid`)
                        }
                        aria-label={r.payment === 'paid' ? `Undo paid for ${r.no}` : `Mark ${r.no} paid`}
                        title={locked ?? (r.payment === 'paid' ? 'Paid — click to undo' : 'Mark paid')}
                      >
                        <Icon name="wallet" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="idt-empty">No invoices match these filters.</p> : null}
      </div>

      {toast ? (
        <div className={`idt-toast${toast.bad ? ' bad' : ''}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </div>
  )
}
