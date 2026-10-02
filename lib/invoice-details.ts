import type { Rec } from './records'
import type { LinkedPost } from './ig-link-types'
import { toInvoices } from './invoices'
import { driveOf, driveStatus } from './invoice-drive'
import { TERMS, type Payment, type DetailRow, type KnownClient, type FormOptions, type EditValues } from './invoice-figures'

export { statusFigures } from './invoice-figures'
export type { Payment, DetailRow, StatusFigures, KnownClient, FormOptions } from './invoice-figures'

// 👉 Invoice Details and the status half of Invoice Summary, read entirely from
// the `records` table — no Canva or Drive call is needed to draw either page.
// Everything here is plain data so it can cross into client components.

const PAID = ['paid', 'received']

/** The link Invoice Details opens: `meta.canva_url` when it's there (the
 *  dashboard's own Create Invoice writes it), else whatever the Telegram bot
 *  recorded instead — `render.view_url`, or a canonical `/design/<id>/view`
 *  built from whichever field carries the design id. Same fields `hasDesign`
 *  below already checks; this just turns them into an openable URL too. */
function canvaUrlOf(m: Rec['meta']): string | null {
  if (m?.canva_url) return String(m.canva_url)
  if (m?.render?.view_url) return String(m.render.view_url)
  const id = m?.canva_design ?? m?.render?.design_id
  return id ? `https://www.canva.com/design/${id}/view` : null
}

export function paymentOf(r: Pick<Rec, 'status' | 'due_date'>, today = new Date().toISOString().slice(0, 10)): Payment {
  const s = (r.status || '').toLowerCase()
  if (PAID.includes(s)) return 'paid'
  if (s === 'issued') return 'untracked'
  return r.due_date && r.due_date < today ? 'overdue' : 'outstanding'
}

/** Why an invoice can't be edited, or null when it can. Only invoices drawn
 *  from the CURRENT Canva template (by the dashboard or the bot) are editable:
 *  an edit redraws the template from the row's fields, so anything else — the
 *  Canva back catalogue, or a bot row with no design recorded — is view only. */
export function editBlockOf(r: Pick<Rec, 'meta'>): string | null {
  const m = r.meta ?? {}
  if (m.source === 'canva' || !m.render?.design_id || m.render?.status !== 'done')
    return 'View only — made before the current Canva template'
  if (!m.job || !Array.isArray(m.deliverables) || !m.deliverables.length)
    return 'View only — this invoice is missing its job or scope of work'
  return null
}

/** The row as the Edit form's fields. Reverse of the form's toDraft() + invoiceRow(). */
export function editValuesOf(r: Rec): EditValues {
  const m = r.meta ?? {}
  const s = String(r.status ?? '').toLowerCase()
  const terms = String(m.terms ?? '')
  const termsKey = (Object.keys(TERMS).find(k => TERMS[k] === terms) ?? 'custom') as EditValues['termsKey']
  const str = (v: unknown) => (v == null || v === '—' || v === '-' ? '' : String(v))
  return {
    client: str(m.customer),
    contact: str(m.contact),
    address: str(m.address),
    reg: str(m.reg),
    job: str(m.job),
    venue: str(m.venue),
    eventDate: str(m.event_date),
    eventDateLabel: str(m.event_date_label),
    eventTime: str(m.event_time),
    deliverables: (m.deliverables as string[]).join('\n'),
    // The row's amount is the NET; the form takes the list price and the discount.
    amount: String(m.list_price ?? r.amount),
    currency: (m.currency ?? 'MYR') as EditValues['currency'],
    discount: m.discount ? String(m.discount) : '',
    termsKey,
    terms,
    quotation: str(m.quotation_no),
    date: str(m.invoice_date) || String(r.created_at).slice(0, 10),
    dueDate: str(r.due_date),
    status: PAID.includes(s) ? 'paid' : s === 'issued' ? 'issued' : 'waiting',
  }
}

/** The posts linked to an invoice, as stored on it. */
export const linkedPostsOf = (r: Pick<Rec, 'meta'>): LinkedPost[] =>
  Array.isArray(r.meta?.ig_posts) ? (r.meta!.ig_posts as LinkedPost[]) : []

export function toDetailRows(rows: Rec[], today?: string, reach: Record<string, number> = {}): DetailRow[] {
  const byId = new Map(rows.map(r => [r.id, r]))
  return toInvoices(rows).map(i => {
    const r = byId.get(i.id)!
    const d = driveOf(r)
    const m = r.meta ?? {}
    return {
      id: i.id,
      no: i.no,
      date: i.date,
      client: i.client,
      project: String(m.job ?? i.project ?? ''),
      amount: i.amount,
      currency: i.currency,
      payment: paymentOf(r, today),
      dueDate: r.due_date,
      paidAt: m.paid_at ? String(m.paid_at).slice(0, 10) : null,
      drive: driveStatus(r),
      driveUrl: d?.url ?? null,
      driveError: d?.status === 'failed' ? d.error ?? null : null,
      canvaUrl: canvaUrlOf(m),
      hasDesign: !!(m.canva_design || m.render?.design_id || /\/design\/D/.test(String(m.canva_url ?? ''))),
      createdAt: String(r.created_at).slice(0, 10),
      source: String(m.source ?? '—'),
      edit: editBlockOf(r) ? null : editValuesOf(r),
      editBlock: editBlockOf(r),
      designId: m.render?.design_id ?? m.canva_design ?? null,
      undo: Array.isArray(m.edits) && m.edits.length ? { at: String(m.edits[m.edits.length - 1].at) } : null,
      igPosts: linkedPostsOf(r).map(p => ({ ...p, reach: reach[p.id] })),
    }
  })
}

// ------------------------------------------------------- Create Invoice options

/** Every client already on file, with the newest contact/address/reg seen for
 *  each — from the customer rows and every earlier invoice. Same merge rule as
 *  the bot's findClients(), but done over rows the page already loaded. */
export function knownClients(rows: Rec[]): KnownClient[] {
  const by = new Map<string, KnownClient>()
  const merge = (name: string, m: any) => {
    const key = name.toLowerCase().trim()
    if (!key) return
    const cur = by.get(key) ?? { name: name.trim() }
    by.set(key, {
      name: cur.name,
      contact: m?.contact || cur.contact,
      address: m?.address || cur.address,
      reg: m?.reg || cur.reg,
    })
  }
  const ordered = [...rows].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
  for (const r of ordered) if (r.category === 'customer') merge(String(r.title), r.meta)
  for (const r of ordered)
    if ((r.category === 'cash_in' || r.category === 'doc') && r.meta?.customer) merge(String(r.meta.customer), r.meta)
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function formOptions(rows: Rec[], today = new Date().toISOString().slice(0, 10)): FormOptions {
  const venues = new Set<string>()
  for (const r of rows) if (r.meta?.venue && r.meta.venue !== '—') venues.add(String(r.meta.venue))
  const quotations = rows
    .filter(r => r.category === 'doc' && r.status === 'quotation' && r.meta?.invoice_no)
    .map(r => ({ no: String(r.meta.invoice_no), client: String(r.meta.customer ?? '') }))
    .sort((a, b) => b.no.localeCompare(a.no))
  return { clients: knownClients(rows), venues: [...venues].sort(), quotations, today }
}
