// 👉 Everything the Expenses pages state, worked out from the raw rows. No server code in this file
// (the client forms import it too), and no stored totals: every figure is computed here each render.

export const KINDS = ['hotel', 'flight', 'transport', 'subscription', 'equipment', 'ads', 'admin', 'other'] as const
export type Kind = (typeof KINDS)[number]

export const KIND_LABEL: Record<Kind, string> = {
  hotel: 'Hotels',
  flight: 'Flights',
  transport: 'Transport',
  subscription: 'Subscriptions',
  equipment: 'Equipment',
  ads: 'Ads',
  admin: 'Admin fees',
  other: 'Other',
}

/** The singular, for form options and a row's tag. */
export const KIND_ONE: Record<Kind, string> = {
  hotel: 'Hotel',
  flight: 'Flight',
  transport: 'Transport',
  subscription: 'Subscription',
  equipment: 'Equipment',
  ads: 'Ads',
  admin: 'Admin fee',
  other: 'Other',
}

export const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as readonly string[]).includes(v)

/** Where an expense's receipt stands, kept on the row itself (`receipt`) so nothing searches Drive to know.
 *   filed     — the file is in Google Drive (file_id, url)
 *   uploading — an upload is running (started_at); one stuck for over 5 minutes counts as failed
 *   failed    — the last upload failed (error)
 *   waived    — no receipt exists or is needed (a cash tip, a bank fee); shows as done, not missing
 *  No receipt object at all = still missing. */
export type ReceiptMeta = {
  status: 'filed' | 'uploading' | 'failed' | 'waived'
  file_id?: string
  url?: string
  name?: string
  uploaded_at?: string
  started_at?: string
  error?: string
  source?: 'dashboard' | 'gmail' | 'import'
  note?: string
}

export const DOC_TYPES = ['Invoice', 'Receipt', 'Refund'] as const
export type DocType = (typeof DOC_TYPES)[number]

export type Expense = {
  id: number
  spent_on: string // YYYY-MM-DD
  kind: Kind
  vendor: string
  description: string | null
  amount: number | null // RM actually paid; null = not known yet (foreign currency waiting for the statement)
  amount_estimated: boolean // `amount` is an estimate until the statement figure replaces it
  doc_type: DocType // the file name's last word; a Refund is money back
  currency: string
  original_amount: number | null
  paid_with: string | null
  reference: string | null
  trip: string | null
  recurring: 'monthly' | 'yearly' | null
  source: string
  source_ref: Record<string, any> | null
  receipt: ReceiptMeta | null
  notes: string | null
}

export type ReceiptState = 'filed' | 'uploading' | 'failed' | 'waived' | 'missing'

export const STALE_UPLOAD_MS = 5 * 60 * 1000

export function receiptState(e: Pick<Expense, 'receipt'>, now = Date.now()): ReceiptState {
  const r = e.receipt
  if (!r?.status) return 'missing'
  if (r.status === 'uploading' && r.started_at && now - Date.parse(r.started_at) > STALE_UPLOAD_MS) return 'failed'
  return r.status
}

/** A receipt still owed: nothing filed, nothing waived. A failed or stuck upload counts too. */
export const needsReceipt = (e: Pick<Expense, 'receipt'>, now = Date.now()) => {
  const s = receiptState(e, now)
  return s === 'missing' || s === 'failed'
}

const r2 = (n: number) => Math.round(n * 100) / 100
type Money = Pick<Expense, 'amount' | 'doc_type'>
/** The RM an expense adds to the books: a Refund is money back (negative); an unknown amount adds nothing yet. */
export const rmOf = (e: Money) => (e.doc_type === 'Refund' ? -1 : 1) * Number(e.amount ?? 0)
const sum = (rows: Money[]) => r2(rows.reduce((a, e) => a + rmOf(e), 0))
/** Rows still waiting for their RM figure, and rows whose RM figure is only an estimate. */
export const rmPending = (rows: Pick<Expense, 'amount'>[]) => rows.filter(e => e.amount == null).length
export const rmEstimated = (rows: Pick<Expense, 'amount' | 'amount_estimated'>[]) => rows.filter(e => e.amount != null && e.amount_estimated).length

/** Money in other currencies, in the currency itself (never converted, never added to RM): HKD 78.00, USD 198.00. */
export function foreignTotals(rows: Pick<Expense, 'currency' | 'original_amount' | 'doc_type'>[]): { currency: string; total: number; count: number }[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const e of rows) {
    if (e.currency === 'MYR' || e.original_amount == null) continue
    const cur = map.get(e.currency) ?? { total: 0, count: 0 }
    cur.total = r2(cur.total + (e.doc_type === 'Refund' ? -1 : 1) * Number(e.original_amount))
    cur.count++
    map.set(e.currency, cur)
  }
  return [...map.entries()].map(([currency, v]) => ({ currency, ...v })).sort((a, b) => b.count - a.count)
}

const SYMBOL: Record<string, string> = { HKD: 'HK$', USD: 'US$', SGD: 'S$', AUD: 'A$', EUR: '€', GBP: '£', CNY: 'CN¥', RMB: 'CN¥', JPY: '¥' }
/** 78 HKD → "HK$78.00"; an unlisted currency keeps its code: "THB 120.00". */
export const foreignText = (currency: string, n: number) => (SYMBOL[currency] ? `${SYMBOL[currency]}${n.toFixed(2)}` : `${currency} ${n.toFixed(2)}`)

// ── Filters (kept in the URL, like every money page) ────────────────────────

export type ExpenseFilters = {
  year: string // '' = all years
  month: string // YYYY-MM or ''
  kind: Kind | ''
  receipt: '' | 'missing' | 'filed'
  trip: string
  q: string
}

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export function parseExpenseFilters(sp: Params, today: string): ExpenseFilters {
  const month = /^\d{4}-\d{2}$/.test(one(sp.month)) ? one(sp.month) : ''
  const kind = isKind(one(sp.kind)) ? (one(sp.kind) as Kind) : ''
  const yearRaw = one(sp.year)
  // Opens on the current year; ?year=all lists every year. A chosen month fixes the year.
  const year = month ? month.slice(0, 4) : yearRaw === 'all' ? '' : /^\d{4}$/.test(yearRaw) ? yearRaw : today.slice(0, 4)
  const receipt = one(sp.receipt) === 'missing' ? 'missing' : one(sp.receipt) === 'filed' ? 'filed' : ''
  return { year, month, kind, receipt, trip: one(sp.trip).slice(0, 80), q: one(sp.q).slice(0, 80) }
}

export function applyExpenseFilters(rows: Expense[], f: ExpenseFilters, now = Date.now()): Expense[] {
  const q = f.q.trim().toLowerCase()
  return rows.filter(e => {
    if (f.year && !e.spent_on.startsWith(f.year)) return false
    if (f.month && !e.spent_on.startsWith(f.month)) return false
    if (f.kind && e.kind !== f.kind) return false
    if (f.trip && e.trip !== f.trip) return false
    if (f.receipt === 'missing' && !needsReceipt(e, now)) return false
    if (f.receipt === 'filed' && receiptState(e, now) !== 'filed' && receiptState(e, now) !== 'waived') return false
    if (q && ![e.vendor, e.description, e.reference, e.trip, e.paid_with, e.notes].some(x => x?.toLowerCase().includes(q))) return false
    return true
  })
}

export const newestFirst = (rows: Expense[]) => [...rows].sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.id - a.id)

// ── Figures ─────────────────────────────────────────────────────────────────

export type KindTotal = { kind: Kind; total: number; count: number; share: number }

export function byKind(rows: Expense[]): KindTotal[] {
  const all = sum(rows) || 1
  return KINDS.map(kind => {
    const mine = rows.filter(e => e.kind === kind)
    return { kind, total: sum(mine), count: mine.length, share: sum(mine) / all }
  })
    .filter(k => k.count > 0)
    .sort((a, b) => b.total - a.total)
}

export type MonthTotal = { month: string; total: number; byKind: Partial<Record<Kind, number>> }

/** The last `n` calendar months ending at `today`'s month, oldest first, empty months included. */
export function byMonth(rows: Expense[], today: string, n = 12): MonthTotal[] {
  const [y, m] = today.split('-').map(Number)
  const out: MonthTotal[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1))
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
    const mine = rows.filter(e => e.spent_on.startsWith(key))
    const kinds: Partial<Record<Kind, number>> = {}
    for (const e of mine) kinds[e.kind] = r2((kinds[e.kind] ?? 0) + rmOf(e))
    out.push({ month: key, total: sum(mine), byKind: kinds })
  }
  return out
}

export type VendorTotal = { vendor: string; total: number; count: number }

export function topVendors(rows: Expense[], n = 6): VendorTotal[] {
  const map = new Map<string, Expense[]>()
  for (const e of rows) map.set(e.vendor, [...(map.get(e.vendor) ?? []), e])
  return [...map.entries()]
    .map(([vendor, es]) => ({ vendor, total: sum(es), count: es.length }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n)
}

export type TripTotal = { trip: string; total: number; count: number; from: string; to: string }

export function trips(rows: Expense[]): TripTotal[] {
  const map = new Map<string, Expense[]>()
  for (const e of rows) if (e.trip) map.set(e.trip, [...(map.get(e.trip) ?? []), e])
  return [...map.entries()]
    .map(([trip, es]) => {
      const dates = es.map(e => e.spent_on).sort()
      return { trip, total: sum(es), count: es.length, from: dates[0], to: dates[dates.length - 1] }
    })
    .sort((a, b) => b.to.localeCompare(a.to))
}

/** What the repeating subscriptions cost per month now: each series (vendor + what it is) counts its latest
 *  charge once — monthly as is, yearly divided by 12 — and only while it is still being charged
 *  (a monthly one within 62 days, a yearly one within 380). A cancelled plan drops out by itself. */
export function monthlyRunRate(rows: Expense[], today: string): { perMonth: number; series: number } {
  const series = new Map<string, Expense>()
  for (const e of rows) {
    if (!e.recurring) continue
    const key = `${e.vendor}|${e.description ?? ''}`
    const cur = series.get(key)
    if (!cur || e.spent_on > cur.spent_on) series.set(key, e)
  }
  const t = Date.parse(today)
  let total = 0
  let live = 0
  for (const e of series.values()) {
    const age = (t - Date.parse(e.spent_on)) / 86_400_000
    if (age > (e.recurring === 'monthly' ? 62 : 380)) continue
    total += e.recurring === 'monthly' ? Number(e.amount ?? 0) : Number(e.amount ?? 0) / 12
    live++
  }
  return { perMonth: r2(total), series: live }
}

export type Summary = {
  year: string
  ytd: number
  lastYtd: number | null // the same stretch of last year; null when there was nothing then
  thisMonth: number
  count: number
  missing: { count: number; amount: number }
  pending: number // this year's expenses still waiting for their RM figure
  estimated: number // this year's expenses whose RM figure is an estimate
  foreign: { currency: string; total: number; count: number }[] // this year, in each currency itself
  kinds: KindTotal[]
  months: MonthTotal[]
  vendors: VendorTotal[]
  runRate: { perMonth: number; series: number }
}

export function summarise(rows: Expense[], today: string, now = Date.now()): Summary {
  const year = today.slice(0, 4)
  const lastYear = String(Number(year) - 1)
  const mmdd = today.slice(5)
  // Up to today: a hotel booked and paid for a December stay is dated when it was paid, but one typed in with a
  // future date must not inflate "so far this year" against last year's same stretch.
  const thisYear = rows.filter(e => e.spent_on.startsWith(year) && e.spent_on <= today)
  const lastSame = rows.filter(e => e.spent_on.startsWith(lastYear) && e.spent_on.slice(5) <= mmdd)
  const owed = thisYear.filter(e => needsReceipt(e, now))
  return {
    year,
    ytd: sum(thisYear),
    lastYtd: lastSame.length ? sum(lastSame) : null,
    thisMonth: sum(rows.filter(e => e.spent_on.startsWith(today.slice(0, 7)) && e.spent_on <= today)),
    count: thisYear.length,
    missing: { count: owed.length, amount: sum(owed) },
    pending: rmPending(thisYear),
    estimated: rmEstimated(thisYear),
    foreign: foreignTotals(thisYear),
    kinds: byKind(thisYear),
    months: byMonth(rows, today, 12),
    vendors: topVendors(thisYear),
    runRate: monthlyRunRate(rows, today),
  }
}

// ── Export ──────────────────────────────────────────────────────────────────

// Text from outside (a vendor read out of an email, a typed description) must never run as a spreadsheet formula
// when the accountant opens the CSV: a cell starting with = + - @ or a tab/return gets a leading apostrophe.
const cell = (v: unknown, text = true) => {
  let s = v == null ? '' : String(v)
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** A month (or any slice) as a CSV the accountant can open: one line per payment, receipt link included. */
export function expensesCsv(rows: Expense[]): string {
  const head = ['Date', 'Kind', 'Type', 'Vendor', 'Description', 'Amount (RM)', 'RM estimated', 'Currency', 'Original amount', 'Reference', 'Trip', 'Paid with', 'Receipt']
  const lines = newestFirst(rows)
    .reverse()
    .map(e => {
      const numeric = new Set([5, 8]) // Amount (RM) and Original amount are numbers, never formulas
      const rm = e.amount == null ? '' : ((e.doc_type === 'Refund' ? -1 : 1) * e.amount).toFixed(2)
      return [e.spent_on, KIND_ONE[e.kind], e.doc_type, e.vendor, e.description, rm, e.amount_estimated ? 'yes' : '', e.currency, e.original_amount ?? '', e.reference, e.trip, e.paid_with, e.receipt?.status === 'waived' ? 'not needed' : (e.receipt?.url ?? '')]
        .map((v, i) => cell(v, !numeric.has(i)))
        .join(',')
    })
  return [head.join(','), ...lines].join('\r\n') + '\r\n'
}

const clean = (s: string) => s.replace(/→/g, 'to').replace(/\//g, '-').replace(/[\\:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim()

/** The name a receipt gets in Drive (Aereon's format, 21 Oct 2026):
 *    YYYYMMDD - <item / product / service> - <vendor and order id> - <Invoice | Receipt | Refund>
 *    "20251219 - KLIA Transit KLIA (T1-T2) to Bandar Tasik Selatan - KLIA Ekspres EC1219PU9XP3MUE - Receipt.pdf"
 *  The item is the expense's description (the vendor when there is none). The tracking part is the vendor, unless the
 *  item already starts with it, then the booking / order / invoice number; with neither, a foreign-currency charge shows
 *  its own-currency amount ("Uber Trip HK 0616 - HK$78.00 - Receipt"). The RM amount is deliberately not in the name. */
export function receiptFilename(e: Pick<Expense, 'spent_on' | 'vendor' | 'description' | 'reference'> & Partial<Pick<Expense, 'doc_type' | 'currency' | 'original_amount'>>, ext: string): string {
  const item = clean(e.description ?? '') || clean(e.vendor)
  const vendor = clean(e.vendor)
  const vendorShown = item.toLowerCase().startsWith(vendor.toLowerCase()) || item.toLowerCase().includes(vendor.toLowerCase())
  let info = [vendorShown ? '' : vendor, clean(e.reference ?? '')].filter(Boolean).join(' ')
  if (!info && e.currency && e.currency !== 'MYR' && e.original_amount != null) info = clean(foreignText(e.currency, Number(e.original_amount)).replace('/', '-'))
  const name = [e.spent_on.replace(/-/g, ''), item.slice(0, 90), info.slice(0, 60), e.doc_type ?? 'Receipt'].filter(Boolean).join(' - ')
  return `${name}.${ext.replace(/^\./, '').toLowerCase() || 'pdf'}`
}
