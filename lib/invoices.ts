import { type Rec, isIssued } from './records'

// 👉 Everything the Invoice tabs count, in one place, derived from the same
// `records` table: an invoice is a cash_in row carrying meta.invoice_no.
// Amounts in another currency (meta.currency, e.g. USD) are kept apart — they
// are never added into a RM total.

export type Invoice = {
  id: number
  no: string
  date: string // YYYY-MM-DD
  jobDate?: string // YYYY-MM-DD, the job's final day (meta.job_date) — only where the invoice states one
  client: string
  contact?: string
  address?: string
  amount: number
  currency: string // 'MYR' unless meta.currency says otherwise
  project: string
  url?: string
  kind: WorkKind
}

export type WorkKind = 'Drone / aerial' | 'Social campaign' | 'Event coverage' | 'Production / licensing' | 'Other'

// Rough bucketing from what the invoice says. Deliberately simple and readable —
// tweak the keyword lists as the business changes.
export function classify(text: string): WorkKind {
  const t = text.toLowerCase()
  if (/\bdrone|aerial|fpv|drone show|drone pilot\b/.test(t)) return 'Drone / aerial'
  if (/\breel|tiktok|campaign|posting|carousel|ig story|influencer|shout-?out\b/.test(t)) return 'Social campaign'
  if (/\bevent|dinner|photographer|townhall|coverage|fair|launch|ceremony\b/.test(t)) return 'Event coverage'
  if (/\bproduction|footage|licen[cs]|archive|handover|usage rights|buyout\b/.test(t)) return 'Production / licensing'
  return 'Other'
}

export function toInvoices(rows: Rec[]): Invoice[] {
  return rows
    .filter(r => r.category === 'cash_in' && r.meta?.invoice_no)
    .map(r => ({
      id: r.id,
      no: String(r.meta?.invoice_no),
      date: String(r.meta?.invoice_date || r.created_at).slice(0, 10),
      jobDate: r.meta?.job_date ? String(r.meta.job_date) : undefined,
      client: String(r.meta?.customer || '—'),
      contact: r.meta?.contact ? String(r.meta.contact) : undefined,
      address: r.meta?.address ? String(r.meta.address) : undefined,
      amount: Number(r.amount || 0),
      currency: String(r.meta?.currency || 'MYR'),
      project: r.notes || r.title,
      url: r.meta?.canva_url ? String(r.meta.canva_url) : undefined,
      kind: classify(`${r.title} ${r.notes ?? ''}`),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
}

const myr = (i: Invoice) => i.currency === 'MYR'
export const sumRM = (list: Invoice[]) => list.filter(myr).reduce((s, i) => s + i.amount, 0)

export type ClientRoll = {
  name: string
  contact?: string
  address?: string
  invoices: Invoice[]
  totalRM: number
  otherCurrency: { currency: string; total: number }[]
  first: string
  last: string
  kinds: WorkKind[]
}

export function rollUpClients(list: Invoice[]): ClientRoll[] {
  const by = new Map<string, Invoice[]>()
  for (const i of list) by.set(i.client, [...(by.get(i.client) ?? []), i])
  return [...by.entries()]
    .map(([name, xs]) => {
      const dates = xs.map(x => x.date).sort()
      const other = new Map<string, number>()
      for (const x of xs) if (!myr(x)) other.set(x.currency, (other.get(x.currency) ?? 0) + x.amount)
      return {
        name,
        contact: xs.find(x => x.contact)?.contact,
        address: xs.find(x => x.address)?.address,
        invoices: xs,
        totalRM: sumRM(xs),
        otherCurrency: [...other.entries()].map(([currency, total]) => ({ currency, total })),
        first: dates[0],
        last: dates[dates.length - 1],
        kinds: [...new Set(xs.map(x => x.kind))],
      }
    })
    .sort((a, b) => b.totalRM - a.totalRM || b.invoices.length - a.invoices.length)
}

export type MonthPoint = { month: string; label: string; total: number; count: number }

// Every month from the first invoice to the last, so gaps show as gaps.
export function byMonth(list: Invoice[]): MonthPoint[] {
  const rm = list.filter(myr)
  if (rm.length === 0) return []
  const keys = rm.map(i => i.date.slice(0, 7)).sort()
  const out: MonthPoint[] = []
  const [y0, m0] = keys[0].split('-').map(Number)
  const [y1, m1] = keys[keys.length - 1].split('-').map(Number)
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? ((y += 1), (m = 1)) : (m += 1)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const mine = rm.filter(i => i.date.startsWith(key))
    out.push({
      month: key,
      label: new Date(`${key}-01T00:00:00Z`).toLocaleString('en-MY', { month: 'short', timeZone: 'UTC' }),
      total: mine.reduce((s, i) => s + i.amount, 0),
      count: mine.length,
    })
  }
  return out
}

export type InvoiceSummary = {
  invoices: Invoice[]
  countRM: number
  totalRM: number
  averageRM: number
  biggest?: Invoice
  months: MonthPoint[]
  bestMonth?: MonthPoint
  clients: ClientRoll[]
  topClientShare: number // % of RM from the single biggest client
  repeatClients: number
  repeatRevenueShare: number // % of RM from clients with 2+ invoices
  byKind: { kind: WorkKind; total: number; count: number }[]
  otherCurrency: { currency: string; total: number; count: number }[]
  untracked: number // invoices still marked "issued" (payment not tracked)
}

export function summarize(rows: Rec[]): InvoiceSummary {
  const invoices = toInvoices(rows)
  const rm = invoices.filter(myr)
  const totalRM = sumRM(invoices)
  const clients = rollUpClients(invoices)
  const months = byMonth(invoices)
  const repeat = clients.filter(c => c.invoices.length > 1)

  const kinds = new Map<WorkKind, { total: number; count: number }>()
  for (const i of rm) {
    const cur = kinds.get(i.kind) ?? { total: 0, count: 0 }
    kinds.set(i.kind, { total: cur.total + i.amount, count: cur.count + 1 })
  }

  const other = new Map<string, { total: number; count: number }>()
  for (const i of invoices.filter(x => !myr(x))) {
    const cur = other.get(i.currency) ?? { total: 0, count: 0 }
    other.set(i.currency, { total: cur.total + i.amount, count: cur.count + 1 })
  }

  return {
    invoices,
    countRM: rm.length,
    totalRM,
    averageRM: rm.length ? totalRM / rm.length : 0,
    biggest: [...rm].sort((a, b) => b.amount - a.amount)[0],
    months,
    bestMonth: [...months].sort((a, b) => b.total - a.total)[0],
    clients,
    topClientShare: totalRM ? ((clients[0]?.totalRM ?? 0) / totalRM) * 100 : 0,
    repeatClients: repeat.length,
    repeatRevenueShare: totalRM ? (repeat.reduce((s, c) => s + c.totalRM, 0) / totalRM) * 100 : 0,
    byKind: [...kinds.entries()]
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.total - a.total),
    otherCurrency: [...other.entries()]
      .map(([currency, v]) => ({ currency, ...v }))
      .sort((a, b) => b.total - a.total),
    untracked: rows.filter(r => r.category === 'cash_in' && isIssued(r)).length,
  }
}
