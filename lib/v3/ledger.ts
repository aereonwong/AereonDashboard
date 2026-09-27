import type { Rec } from '@/lib/records'
import { toInvoices, type Invoice, type WorkKind } from '@/lib/invoices'
import { inRange, narrow, KINDS, type Filters } from './filters'

// 👉 The numbers behind v3's Invoice Summary and Clients pages. Same rules as the
// Dashboard: ringgit only in totals, foreign currency reported alongside, and
// every figure from the records.

export type Status = 'paid' | 'unconfirmed'
export type LedgerRow = Invoice & { status: Status }
export type Sort = 'date' | 'amount' | 'client'
export type MonthBar = { key: string; label: string; total: number; count: number }

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)
const rmOnly = <T extends Invoice>(xs: T[]) => xs.filter(i => i.currency === 'MYR')

function statusOf(rows: Rec[]): Map<number, Status> {
  const m = new Map<number, Status>()
  for (const r of rows) if (r.category === 'cash_in') m.set(r.id, r.status === 'paid' ? 'paid' : 'unconfirmed')
  return m
}

/** Every month between the first and last invoice in range, empty months included. */
function monthBars(list: Invoice[], f: Filters): MonthBar[] {
  if (!list.length) return []
  const dates = list.map(i => i.date).sort()
  const start = f.range === 'all' ? dates[0] : f.from
  const end = f.range === 'all' ? dates.at(-1)! : f.to
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const out: MonthBar[] = []
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`
    const xs = list.filter(i => i.date.startsWith(key))
    out.push({ key, label: `${MON[m - 1]} ${String(y).slice(2)}`, total: sum(xs), count: xs.length })
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
    if (out.length > 240) break
  }
  return out
}

/** Months from one date to another, both inclusive, partial months by their share of days. */
function monthsBetween(from: string, to: string): number {
  let [y, m, d] = from.split('-').map(Number)
  const [ey, em, ed] = to.split('-').map(Number)
  let n = 0
  while (y < ey || (y === ey && m <= em)) {
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const last = y === ey && m === em ? ed : days
    n += (last - d + 1) / days
    d = 1
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return n
}

export type Ledger = {
  rows: LedgerRow[]
  total: number
  count: number
  average: number
  /** Ringgit per month across the range, quiet months counted as zero. */
  perMonth: number
  /** How long the range is in months, partial months counted part-way. */
  spanMonths: number
  biggest: LedgerRow | null
  months: MonthBar[]
  mix: { kind: WorkKind; total: number; count: number; share: number }[]
  topClients: { client: string; total: number; count: number; share: number }[]
  repeatShare: number
  concentration: number // share of the range from the top five clients
  paid: number
  foreign: { currency: string; total: number; count: number }[]
  allClients: string[]
}

export function buildLedger(recs: Rec[], f: Filters, sort: Sort = 'date', q = ''): Ledger {
  const status = statusOf(recs)
  const all = toInvoices(recs)
  const inR = inRange(all, f).map(i => ({ ...i, status: status.get(i.id) ?? 'unconfirmed' }) as LedgerRow)
  const needle = q.trim().toLowerCase()
  const searched = needle
    ? inR.filter(i => `${i.no} ${i.client} ${i.project} ${i.kind}`.toLowerCase().includes(needle))
    : inR
  const sorted = [...searched].sort((a, b) =>
    sort === 'amount' ? b.amount - a.amount : sort === 'client' ? a.client.localeCompare(b.client) : b.date.localeCompare(a.date),
  )

  const rm = rmOnly(inR)
  const total = sum(rm)
  const byClient = new Map<string, Invoice[]>()
  for (const i of rm) byClient.set(i.client, [...(byClient.get(i.client) ?? []), i])
  const ranked = [...byClient.entries()].map(([client, xs]) => ({ client, total: sum(xs), count: xs.length })).sort((a, b) => b.total - a.total)

  // "Repeat" means the client has more than one invoice in their whole history,
  // not just inside the range — a returning client is returning either way.
  const lifetimeJobs = new Map<string, number>()
  for (const i of all) lifetimeJobs.set(i.client, (lifetimeJobs.get(i.client) ?? 0) + 1)
  const repeatTotal = sum(rm.filter(i => (lifetimeJobs.get(i.client) ?? 0) > 1))

  const fx = new Map<string, { total: number; count: number }>()
  for (const i of inR.filter(i => i.currency !== 'MYR')) {
    const c = fx.get(i.currency) ?? { total: 0, count: 0 }
    fx.set(i.currency, { total: c.total + i.amount, count: c.count + 1 })
  }

  const months = monthBars(rm, f)
  // Whole calendar months count as one, partial ones by the share of their days:
  // "Last 12 months" is 12, not the 13 months its two partial ends touch.
  // All time runs from the first invoice to today.
  const start = f.range === 'all' ? ([...rm].map(i => i.date).sort()[0] ?? f.to) : f.from
  const spanMonths = rm.length ? monthsBetween(start, f.to) : 0

  return {
    rows: sorted,
    total,
    count: rm.length,
    average: rm.length ? total / rm.length : 0,
    perMonth: spanMonths ? total / spanMonths : 0,
    spanMonths,
    biggest: [...rmOnly(inR)].sort((a, b) => b.amount - a.amount)[0] ?? null,
    months,
    mix: KINDS.map(kind => {
      const xs = rm.filter(i => i.kind === kind)
      return { kind, total: sum(xs), count: xs.length, share: total ? sum(xs) / total : 0 }
    })
      .filter(x => x.count)
      .sort((a, b) => b.total - a.total),
    topClients: ranked.slice(0, 6).map(c => ({ ...c, share: total ? c.total / total : 0 })),
    repeatShare: total ? repeatTotal / total : 0,
    concentration: total ? ranked.slice(0, 5).reduce((s, c) => s + c.total, 0) / total : 0,
    paid: inR.filter(i => i.status === 'paid').length,
    foreign: [...fx.entries()].map(([currency, v]) => ({ currency, ...v })),
    allClients: [...new Set(all.map(i => i.client))].filter(c => c && c !== '—').sort((a, b) => a.localeCompare(b)),
  }
}

// ---------------------------------------------------------------- clients

export type Relationship = {
  client: string
  contact?: string
  address?: string
  lifetime: number // ringgit, all time
  jobs: number
  inRange: number // ringgit inside the chosen range
  first: string
  last: string
  monthsQuiet: number
  kinds: WorkKind[]
  foreign: { currency: string; total: number }[]
  quadrant: 'nurture' | 'repitch' | 'new' | 'drifted'
}

export type ClientSort = 'value' | 'recent' | 'quiet' | 'jobs' | 'name'

const monthsSince = (iso: string, today: string) =>
  Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / (86_400_000 * 30.44)))

import { QUIET_MONTHS } from './catalog'
export { QUIET_MONTHS }

export function buildRelationships(
  recs: Rec[],
  f: Filters,
  sort: ClientSort = 'value',
  q = '',
  today = new Date().toISOString().slice(0, 10),
): { list: Relationship[]; median: number; stats: { clients: number; repeat: number; quiet: number; average: number; repeatShare: number } } {
  const all = toInvoices(recs)
  const inR = inRange(all, f)
  const active = new Set(inR.map(i => i.client))
  const scope = narrow(all, f).filter(i => active.has(i.client))

  const groups = new Map<string, Invoice[]>()
  for (const i of scope) groups.set(i.client, [...(groups.get(i.client) ?? []), i])

  let list: Relationship[] = [...groups.entries()]
    .filter(([c]) => c && c !== '—')
    .map(([client, xs]) => {
      const dates = xs.map(x => x.date).sort()
      const rm = rmOnly(xs)
      const fx = new Map<string, number>()
      for (const x of xs.filter(x => x.currency !== 'MYR')) fx.set(x.currency, (fx.get(x.currency) ?? 0) + x.amount)
      const withContact = xs.find(x => x.contact)
      const withAddress = xs.find(x => x.address)
      return {
        client,
        contact: withContact?.contact,
        address: withAddress?.address,
        lifetime: sum(rm),
        jobs: xs.length,
        inRange: sum(rmOnly(inR.filter(i => i.client === client))),
        first: dates[0],
        last: dates.at(-1)!,
        monthsQuiet: monthsSince(dates.at(-1)!, today),
        kinds: [...new Set(xs.map(x => x.kind))],
        foreign: [...fx.entries()].map(([currency, total]) => ({ currency, total })),
        quadrant: 'new' as Relationship['quadrant'],
      }
    })

  const values = list.map(c => c.lifetime).sort((a, b) => a - b)
  const median = values.length ? values[Math.floor(values.length / 2)] : 0
  list = list.map(c => {
    const high = c.lifetime >= median
    const quiet = c.monthsQuiet >= QUIET_MONTHS
    return { ...c, quadrant: high ? (quiet ? 'repitch' : 'nurture') : quiet ? 'drifted' : 'new' }
  })

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? list.filter(c => `${c.client} ${c.contact ?? ''} ${c.kinds.join(' ')}`.toLowerCase().includes(needle))
    : list
  shown.sort((a, b) =>
    sort === 'recent'
      ? b.last.localeCompare(a.last)
      : sort === 'quiet'
        ? b.monthsQuiet - a.monthsQuiet
        : sort === 'jobs'
          ? b.jobs - a.jobs
          : sort === 'name'
            ? a.client.localeCompare(b.client)
            : b.lifetime - a.lifetime,
  )

  const total = list.reduce((s, c) => s + c.lifetime, 0)
  const repeatList = list.filter(c => c.jobs > 1)
  return {
    list: shown,
    median,
    stats: {
      clients: list.length,
      repeat: repeatList.length,
      quiet: list.filter(c => c.monthsQuiet >= QUIET_MONTHS).length,
      average: list.length ? total / list.length : 0,
      repeatShare: total ? repeatList.reduce((s, c) => s + c.lifetime, 0) / total : 0,
    },
  }
}
