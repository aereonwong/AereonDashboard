import type { Rec } from './records'
import { toInvoices } from './invoices'
import { driveOf, driveStatus } from './invoice-drive'
import type { Payment, DetailRow, KnownClient, FormOptions } from './invoice-figures'

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

export function toDetailRows(rows: Rec[], today?: string): DetailRow[] {
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
