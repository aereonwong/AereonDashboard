'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/app/_components/Icon'
import { quoteFigures, type QuoteRow, type QuoteStatus } from '@/lib/quotes'
import type { FormOptions } from '@/lib/invoice-figures'
import CreateInvoice, { type QuoteSource } from '../CreateInvoice'
import ConfirmDialog, { type ConfirmAsk } from '../ConfirmDialog'
import { setQuoteLost, linkInvoice, unlinkInvoice } from './actions'
import '../invoices.css'

// 👉 Quotations — the table beside Invoice Details, drawn from rows the server
// already loaded. Filters run in the browser. Convert opens Create Invoice
// filled in from the quote; the saved invoice carries the link, which is what
// turns the quote "won" (lib/quotes.ts).

export type LinkableInvoice = { id: number; no: string; date: string; client: string; job: string; amount: number; currency: string }
type Filters = { year: string; status: string; client: string; q: string }

const STATUS_LABEL: Record<QuoteStatus, string> = { open: 'Open', won: 'Won', expired: 'No invoice', lost: 'Lost' }
const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`
const money = (n: number, cur: string) =>
  `${cur === 'MYR' ? 'RM' : cur} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/sdn\.?\s*bhd\.?|berhad|pte\.?\s*ltd\.?|[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()

export default function Quotations({
  rows,
  invoices,
  options,
  initial,
  demo,
  ready,
  v3,
}: {
  rows: QuoteRow[]
  invoices: LinkableInvoice[]
  options: FormOptions
  initial: Partial<Filters>
  demo: boolean
  ready: boolean
  v3: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [f, setF] = useState<Filters>({ year: initial.year ?? '', status: initial.status ?? '', client: initial.client ?? '', q: initial.q ?? '' })
  const [converting, setConverting] = useState<QuoteSource | null>(null)
  const [linking, setLinking] = useState<QuoteRow | null>(null)
  const [ask, setAsk] = useState<ConfirmAsk | null>(null)
  const [busy, setBusy] = useState<Set<number>>(new Set())
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null)

  useEffect(() => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [f])
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
    return inYear.filter(
      r =>
        (!f.status || r.status === f.status) &&
        (!f.client || r.client === f.client) &&
        (!needle || `${r.no} ${r.client} ${r.job} ${r.invoices.map(i => i.no).join(' ')}`.toLowerCase().includes(needle)),
    )
  }, [inYear, f])
  const s = quoteFigures(shown)
  const filtered = !!(f.status || f.client || f.q)
  const set = (k: keyof Filters, v: string) => setF(x => ({ ...x, [k]: v, ...(k === 'year' ? { client: '' } : {}) }))

  const locked = demo ? 'Demo data is on — actions are off' : undefined
  const offline = !ready ? 'Canva is not connected on this server yet (COMPOSIO_API_KEY)' : undefined

  const run = async (id: number, fn: () => Promise<{ ok: boolean; error?: string }>, done: string) => {
    setBusy(b => new Set(b).add(id))
    const res = await fn().catch(e => ({ ok: false, error: String(e) }))
    setBusy(b => {
      const n = new Set(b)
      n.delete(id)
      return n
    })
    setToast(res.ok ? { text: done } : { text: res.error ?? 'That did not save.', bad: true })
    startTransition(() => router.refresh())
  }

  return (
    <div className="idt">
      <header className="idt-head">
        <div>
          <h1 className={v3 ? 'v3-title' : 'ph'}>Quotations</h1>
          <p>
            Every quote, and which ones became invoices. Quotes are never counted as income.{' '}
            <a href="/invoices/details">Invoice Details</a>
          </p>
        </div>
        <CreateInvoice
          kind="quotation"
          options={options}
          disabled={!!locked || !ready}
          disabledReason={locked ?? offline}
          onSaved={no => {
            setF(x => ({ ...x, year: '', status: '', client: '', q: '' }))
            setToast({ text: `${no} saved and filed in Canva's Quotation folder. Convert it when the job is confirmed.` })
            router.refresh()
          }}
        />
      </header>

      {converting ? (
        <CreateInvoice
          key={converting.id}
          options={options}
          fromQuote={converting}
          onClose={() => setConverting(null)}
          onSaved={no => {
            setToast({ text: `${no} saved and linked to ${converting.no}. Upload it to Google Drive from Invoice Details.` })
            router.refresh()
          }}
        />
      ) : null}
      {ask ? <ConfirmDialog ask={ask} onCancel={() => setAsk(null)} /> : null}
      {linking ? (
        <LinkInvoice
          quote={linking}
          invoices={invoices}
          onClose={() => setLinking(null)}
          onPick={inv => {
            const q = linking
            setLinking(null)
            run(q.id, () => linkInvoice(q.id, inv.id), `${inv.no} linked to ${q.no}`)
          }}
        />
      ) : null}

      <section className="idt-figs" aria-label="Figures for the quotations shown">
        <div className="idt-fig">
          <div className="idt-fig-label">Quotations</div>
          <div className="idt-fig-value">{s.count}</div>
          <div className="idt-fig-note">{filtered ? 'matching filters' : f.year || 'all years'}</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">Quoted</div>
          <div className="idt-fig-value">{rm(s.quotedRM)}</div>
          <div className="idt-fig-note">ringgit quotes with one total</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-warn)' }} /> Open
          </div>
          <div className="idt-fig-value">{rm(s.openRM)}</div>
          <div className="idt-fig-note">
            {s.open} still valid
          </div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">
            <span className="idt-dot" style={{ background: 'var(--i-pos)' }} /> Won
          </div>
          <div className="idt-fig-value">{s.winRate === null ? '—' : `${Math.round(s.winRate * 100)}%`}</div>
          <div className="idt-fig-note" title="Won ÷ quotes that are decided (won, lost or past their validity)">
            {s.won} of {s.decided} decided
          </div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">Invoiced from quotes</div>
          <div className="idt-fig-value">{rm(s.invoicedRM)}</div>
          <div className="idt-fig-note">quoted {rm(s.wonRM)} for those jobs</div>
        </div>
        <div className="idt-fig">
          <div className="idt-fig-label">Quote to invoice</div>
          <div className="idt-fig-value">{s.medianDaysToWin === null ? '—' : `${s.medianDaysToWin} days`}</div>
          <div className="idt-fig-note">typical (median)</div>
        </div>
      </section>

      <div className="idt-filters" role="search">
        <select aria-label="Year" value={f.year} onChange={e => set('year', e.target.value)}>
          <option value="">All years</option>
          {years.map(y => (
            <option key={y}>{y}</option>
          ))}
        </select>
        <select aria-label="Status" value={f.status} onChange={e => set('status', e.target.value)}>
          <option value="">Any status</option>
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="expired">No invoice</option>
          <option value="lost">Lost</option>
        </select>
        <select aria-label="Client" value={f.client} onChange={e => set('client', e.target.value)} style={{ maxWidth: 220 }}>
          <option value="">All clients</option>
          {clients.map(c => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input type="search" aria-label="Search" placeholder="Search number, client, job or invoice" value={f.q} onChange={e => set('q', e.target.value)} />
        {filtered ? (
          <button type="button" className="idt-reset" onClick={() => setF(x => ({ ...x, status: '', client: '', q: '' }))}>
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="idt-wrap">
        <table className="idt-table">
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Date</th>
              <th>Client · job</th>
              <th className="r">Amount</th>
              <th>Outcome</th>
              <th className="r">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(r => {
              const isBusy = busy.has(r.id)
              return (
                <tr key={r.id}>
                  <td className="idt-no">
                    {r.no}
                    {r.sharedNo ? (
                      <span className="idt-flag" title="Another quotation in the back catalogue was printed with the same number">
                        repeat no.
                      </span>
                    ) : null}
                    <span className="idt-sub">{r.source === 'canva' ? 'Canva, before the dashboard' : r.source === 'telegram' ? 'Telegram' : 'Dashboard'}</span>
                  </td>
                  <td className="idt-num">{r.date}</td>
                  <td className="idt-who">
                    <div className="idt-client" title={r.client}>
                      {r.client}
                    </div>
                    <div className="idt-proj" title={r.job}>
                      {r.job}
                    </div>
                    {r.invoices.length ? (
                      <ul className="idt-wins" aria-label={`Invoices from ${r.no}`}>
                        {r.invoices.map(i => (
                          <li key={i.id}>
                            <a href={`/invoices/details?year=${i.date.slice(0, 4)}&q=${encodeURIComponent(i.no)}`} title={`${i.date} · ${money(i.amount, i.currency)}`}>
                              → {i.no}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {r.note ? <div className="idt-note-line">{r.note}</div> : null}
                  </td>
                  <td className="r idt-num">
                    {r.amount === null ? (
                      <span className="idt-sub" title="This quote gave options or a range rather than one total">options</span>
                    ) : (
                      <>
                        {r.currency !== 'MYR' ? <span className="idt-fx">{r.currency}</span> : null}
                        {money(r.amount, r.currency)}
                      </>
                    )}
                  </td>
                  <td>
                    <div className="idt-state">
                      <span className={`idt-pill ${r.status}`}>
                        <span className="idt-dot" /> {STATUS_LABEL[r.status]}
                      </span>
                      <span className="idt-sub idt-num">
                        {r.status === 'won'
                          ? `invoiced after ${r.daysToWin} day${r.daysToWin === 1 ? '' : 's'}`
                          : r.status === 'open'
                            ? `valid until ${r.validUntil}`
                            : r.status === 'expired'
                              ? `lapsed ${r.validUntil}`
                              : 'client said no'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="idt-acts">
                      <button
                        type="button"
                        className="idt-btn idt-convert"
                        disabled={isBusy || !!locked || !ready}
                        onClick={() => setConverting({ id: r.id, no: r.no, values: r.prefill })}
                        title={
                          locked ??
                          offline ??
                          (r.status === 'won'
                            ? 'Raise another invoice from this quote (a balance or an add-on)'
                            : 'Create the invoice, filled in from this quote')
                        }
                      >
                        <Icon name="invoice" /> {r.status === 'won' ? 'Invoice again' : 'Convert'}
                      </button>

                      <button
                        type="button"
                        className="idt-act"
                        disabled={isBusy || !!locked}
                        onClick={() => setLinking(r)}
                        aria-label={`Link an existing invoice to ${r.no}`}
                        title={locked ?? 'Link an invoice that already exists (a job won before the Convert button)'}
                      >
                        <Icon name="plus" />
                      </button>

                      {r.status === 'won' ? (
                        <button
                          type="button"
                          className="idt-act"
                          disabled={isBusy || !!locked}
                          onClick={() =>
                            setAsk({
                              title: `Unlink invoices from ${r.no}?`,
                              lines: [
                                `${r.invoices.map(i => i.no).join(', ')} stop counting as won from this quote.`,
                                'An invoice that prints this quotation number stays linked by that number. Nothing in Canva or Drive changes.',
                              ],
                              confirmLabel: 'Unlink',
                              onConfirm: () => {
                                setAsk(null)
                                run(
                                  r.id,
                                  async () => {
                                    for (const i of r.invoices) {
                                      const res = await unlinkInvoice(i.id)
                                      if (!res.ok) return res
                                    }
                                    return { ok: true }
                                  },
                                  `Invoices unlinked from ${r.no}`,
                                )
                              },
                            })
                          }
                          aria-label={`Unlink invoices from ${r.no}`}
                          title={locked ?? 'Unlink the invoices from this quote'}
                        >
                          <Icon name="undo" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={`idt-act${r.status === 'lost' ? ' bad' : ''}`}
                          disabled={isBusy || !!locked}
                          aria-pressed={r.status === 'lost'}
                          onClick={() =>
                            run(r.id, () => setQuoteLost(r.id, r.status !== 'lost'), r.status === 'lost' ? `${r.no} no longer marked lost` : `${r.no} marked lost`)
                          }
                          aria-label={r.status === 'lost' ? `Undo lost for ${r.no}` : `Mark ${r.no} lost`}
                          title={locked ?? (r.status === 'lost' ? 'Marked lost — click to undo' : 'Mark lost (the client said no)')}
                        >
                          <Icon name="close" />
                        </button>
                      )}

                      <span className="idt-acts-rule" aria-hidden="true" />
                      {r.canvaUrl ? (
                        <a className="idt-act" href={r.canvaUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.no} in Canva`} title="Open in Canva">
                          <Icon name="design" />
                        </a>
                      ) : (
                        <span className="idt-act" aria-disabled="true" title="No Canva design linked">
                          <Icon name="design" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {shown.length === 0 ? <p className="idt-empty">{rows.length ? 'No quotations match these filters.' : 'No quotations on file yet.'}</p> : null}
      </div>

      {toast ? (
        <div className={`idt-toast${toast.bad ? ' bad' : ''}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      ) : null}
    </div>
  )
}

/** Pick an existing invoice for this quote: same client first, then everything
 *  else dated on or after the quote. */
function LinkInvoice({
  quote,
  invoices,
  onClose,
  onPick,
}: {
  quote: QuoteRow
  invoices: LinkableInvoice[]
  onClose: () => void
  onPick: (inv: LinkableInvoice) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [q, setQ] = useState('')
  useEffect(() => dialog.current?.showModal(), [])
  const list = useMemo(() => {
    const who = norm(quote.client)
    const needle = q.trim().toLowerCase()
    const after = invoices.filter(i => i.date >= quote.date)
    const same = (i: LinkableInvoice) => {
      const c = norm(i.client)
      return !!who && !!c && (c === who || c.includes(who) || who.includes(c))
    }
    // Same client first, nearest the quote date first; then everything else, newest first.
    const mine = after.filter(same).sort((a, b) => a.date.localeCompare(b.date))
    return [...mine, ...after.filter(i => !same(i))]
      .filter(i => !needle || `${i.no} ${i.client} ${i.job}`.toLowerCase().includes(needle))
      .slice(0, 40)
  }, [invoices, quote.client, quote.date, q])

  return (
    <dialog ref={dialog} className="idt-dialog idt" aria-labelledby="ql-title" onCancel={e => (e.preventDefault(), onClose())}>
      <div className="idt-dialog-head">
        <h2 id="ql-title">Link an invoice to {quote.no}</h2>
        <button type="button" className="idt-act" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>
      </div>
      <div className="idt-dialog-body">
        <p className="note" style={{ marginTop: 0 }}>
          For a job won before the Convert button. Only the link is saved — the invoice&apos;s Canva design and PDF stay as
          they are. Invoices already linked to a quote aren&apos;t listed.
        </p>
        <div className="idt-filters">
          <input type="search" aria-label="Search invoices" placeholder="Search number, client or job" value={q} onChange={e => setQ(e.target.value)} autoFocus />
        </div>
        <div className="idt-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
          <table className="idt-table">
            <tbody>
              {list.map(i => (
                <tr key={i.id}>
                  <td className="idt-no">{i.no}</td>
                  <td className="idt-num">{i.date}</td>
                  <td className="idt-who">
                    <div className="idt-client">{i.client}</div>
                    <div className="idt-proj">{i.job}</div>
                  </td>
                  <td className="r idt-num">{money(i.amount, i.currency)}</td>
                  <td className="r">
                    <button type="button" className="idt-btn idt-convert" onClick={() => onPick(i)}>
                      Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 ? <p className="idt-empty">No unlinked invoices dated on or after {quote.date}.</p> : null}
        </div>
      </div>
    </dialog>
  )
}
