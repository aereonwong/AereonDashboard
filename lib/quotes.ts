import type { Rec } from './records'
import { TERMS, type EditValues } from './invoice-figures'

// 👉 Quotations, read from the same `records` table as everything else. A quote
// is a `doc` row with status 'quotation' — NEVER income — whether the Telegram
// bot filed it or it was recorded from the Canva back catalogue
// (scripts/quote-import.mjs, meta.source 'canva_quote').
//
// The link between a quote and the job it won lives on the INVOICE, in one
// place: `meta.quotation_id` (the quote's row id) and/or `meta.quotation_no`
// (the number printed on the invoice as "QUOTATION No."). A quote's outcome is
// worked out from that link every time the page is drawn, so the two sides can
// never disagree:
//
//   won      an invoice points at it (one quote can win several invoices —
//            a deposit and a balance, or an add-on billed separately)
//   lost     Aereon marked it lost (meta.quote_outcome = 'lost')
//   expired  no invoice, and its validity has run out
//   open     still within its validity
//
// Old quotation numbers are kept exactly as printed, odd formats and repeats
// included — they were sent to clients. Only quotes raised from now on follow
// SYCP-Q-YYYYMM-NNN (lib/invoice-intake.ts nextInvoiceNo).

export type QuoteStatus = 'open' | 'won' | 'expired' | 'lost'

export type QuoteInvoice = { id: number; no: string; date: string; amount: number; currency: string }

export type QuoteRow = {
  id: number
  no: string
  date: string
  client: string
  contact: string
  job: string
  /** Net total. Null when the quote gave options or ranges instead of one figure. */
  amount: number | null
  currency: string
  validUntil: string
  status: QuoteStatus
  invoices: QuoteInvoice[]
  /** Days from the quote to its first invoice, when it was won. */
  daysToWin: number | null
  source: 'canva' | 'telegram' | 'dashboard'
  canvaUrl: string | null
  pages: number | null
  note: string | null
  /** Another quote carries the same printed number (old back catalogue). */
  sharedNo: boolean
  /** The Create Invoice form, filled in from this quote. */
  prefill: Partial<EditValues>
}

export type QuoteFigures = {
  count: number
  open: number
  openRM: number
  won: number
  wonRM: number
  decided: number
  winRate: number | null
  quotedRM: number
  invoicedRM: number
  medianDaysToWin: number | null
}

/** Default validity when a quote doesn't state one (the template's 14 days). */
export const DEFAULT_VALIDITY_DAYS = 14

export const isQuote = (r: Pick<Rec, 'category' | 'status'>) => r.category === 'doc' && r.status === 'quotation'
const isInvoice = (r: Rec) => r.category === 'cash_in' && !!r.meta?.invoice_no

const day = (r: Rec) => String(r.meta?.invoice_date || r.created_at).slice(0, 10)
const norm = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/sdn\.?\s*bhd\.?|berhad|pte\.?\s*ltd\.?|[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

/**
 * Which quote each invoice came from: invoice id → quote row id.
 *
 * `quotation_id` wins when present. Otherwise the printed `quotation_no` is
 * matched by number; old numbers repeat (SYCP-Q-202604-01 was used three
 * times), so a repeated number goes to the quote for the same client dated on
 * or before the invoice, newest first — and stays unlinked if that's still not
 * one quote.
 */
export function quoteLinks(rows: Rec[]): Map<number, number> {
  const quotes = rows.filter(isQuote)
  const ids = new Set(quotes.map(q => q.id))
  const byNo = new Map<string, Rec[]>()
  for (const q of quotes) {
    const no = String(q.meta?.invoice_no ?? '').trim()
    if (no) byNo.set(no, [...(byNo.get(no) ?? []), q])
  }
  const out = new Map<number, number>()
  for (const inv of rows.filter(isInvoice)) {
    const qid = Number(inv.meta?.quotation_id)
    if (qid && ids.has(qid)) {
      out.set(inv.id, qid)
      continue
    }
    const no = String(inv.meta?.quotation_no ?? '').trim()
    let hits = no ? byNo.get(no) ?? [] : []
    if (hits.length > 1) {
      const who = norm(inv.meta?.customer)
      hits = hits
        .filter(q => norm(q.meta?.customer) === who && day(q) <= day(inv))
        .sort((a, b) => day(b).localeCompare(day(a)))
        .slice(0, 1)
    }
    if (hits.length === 1) out.set(inv.id, hits[0].id)
  }
  return out
}

/** The Canva editor link for a quote (same rule as invoices: open the editor). */
function canvaUrlOf(m: Rec['meta']): string | null {
  const id = m?.canva_design ?? m?.render?.design_id
  if (id) return `https://www.canva.com/design/${id}/edit`
  return m?.canva_url ? String(m.canva_url) : null
}

/** The Create Invoice form's fields, filled in from a quote. Dated today, never paid. */
export function prefillOf(q: Rec, today: string): Partial<EditValues> {
  const m = q.meta ?? {}
  const str = (v: unknown) => (v == null || v === '—' || v === '-' ? '' : String(v))
  const terms = str(m.terms)
  const termsKey = terms ? ((Object.keys(TERMS).find(k => TERMS[k] === terms) ?? 'custom') as EditValues['termsKey']) : undefined
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
    deliverables: Array.isArray(m.deliverables) ? m.deliverables.join('\n') : '',
    // The row's amount is the NET; the form takes the list price and the discount.
    amount: q.amount || m.list_price ? String(m.list_price ?? q.amount) : '',
    currency: (m.currency ?? 'MYR') as EditValues['currency'],
    discount: m.discount ? String(m.discount) : '',
    ...(termsKey ? { termsKey, terms } : {}),
    quotation: str(m.invoice_no),
    date: today,
    dueDate: '',
    status: 'waiting',
  }
}

export function toQuoteRows(rows: Rec[], today = new Date().toISOString().slice(0, 10)): QuoteRow[] {
  const quotes = rows.filter(isQuote)
  const links = quoteLinks(rows)
  const invById = new Map(rows.filter(isInvoice).map(r => [r.id, r]))
  const won = new Map<number, QuoteInvoice[]>()
  for (const [invId, qid] of links) {
    const r = invById.get(invId)!
    won.set(qid, [
      ...(won.get(qid) ?? []),
      { id: r.id, no: String(r.meta.invoice_no), date: day(r), amount: Number(r.amount) || 0, currency: String(r.meta?.currency ?? 'MYR') },
    ])
  }
  const noCount = new Map<string, number>()
  for (const q of quotes) {
    const no = String(q.meta?.invoice_no ?? '')
    noCount.set(no, (noCount.get(no) ?? 0) + 1)
  }

  return quotes
    .map(q => {
      const m = q.meta ?? {}
      const date = day(q)
      const validUntil = addDays(date, Number(m.validity_days) || DEFAULT_VALIDITY_DAYS)
      const invoices = (won.get(q.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))
      const status: QuoteStatus = invoices.length
        ? 'won'
        : m.quote_outcome === 'lost'
          ? 'lost'
          : today > validUntil
            ? 'expired'
            : 'open'
      const no = String(m.invoice_no ?? q.title)
      return {
        id: q.id,
        no,
        date,
        client: String(m.customer ?? '—'),
        contact: String(m.contact ?? ''),
        job: String(m.job ?? q.notes ?? q.title),
        amount: m.no_total ? null : Number(q.amount) || 0,
        currency: String(m.currency ?? 'MYR'),
        validUntil,
        status,
        invoices,
        daysToWin: invoices.length ? Math.max(0, daysBetween(date, invoices[0].date)) : null,
        source: m.source === 'canva_quote' ? 'canva' : m.source === 'dashboard' ? 'dashboard' : 'telegram',
        canvaUrl: canvaUrlOf(m),
        pages: m.pages ? Number(m.pages) : null,
        note: m.quote_note ? String(m.quote_note) : null,
        sharedNo: (noCount.get(no) ?? 0) > 1,
        prefill: prefillOf(q, today),
      } satisfies QuoteRow
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.no.localeCompare(a.no))
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/** Figures for a list of quotes. Ringgit only — foreign quotes are counted but never added in. */
export function quoteFigures(list: QuoteRow[]): QuoteFigures {
  const myr = (q: QuoteRow) => q.currency === 'MYR' && q.amount !== null
  const sum = (xs: QuoteRow[]) => xs.filter(myr).reduce((t, q) => t + (q.amount ?? 0), 0)
  const open = list.filter(q => q.status === 'open')
  const won = list.filter(q => q.status === 'won')
  const decided = list.filter(q => q.status !== 'open').length
  return {
    count: list.length,
    open: open.length,
    openRM: sum(open),
    won: won.length,
    wonRM: sum(won),
    decided,
    winRate: decided ? won.length / decided : null,
    quotedRM: sum(list),
    invoicedRM: won.flatMap(q => q.invoices).filter(i => i.currency === 'MYR').reduce((t, i) => t + i.amount, 0),
    medianDaysToWin: median(won.map(q => q.daysToWin ?? 0)),
  }
}
