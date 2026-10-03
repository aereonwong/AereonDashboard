import type { Rec } from '@/lib/records'
import { toInvoices, type Invoice, type WorkKind } from '@/lib/invoices'
import { inRange, narrow, KINDS, type Filters } from './filters'

// 👉 The deeper money analysis behind v3's Invoice Summary, for the chosen range:
// how it compares with the period before, the shape of the year, what kind of
// work pays and at what rate, which invoice sizes carry the business, and how
// clients come, grow and shrink.
//
// Rules as everywhere: ringgit only in totals (foreign currency is never added
// in), every figure counted from the records, nothing estimated.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rm = (xs: Invoice[]) => xs.filter(i => i.currency === 'MYR')
const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)
const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const t0 = (d: string) => Date.parse(`${d}T00:00:00Z`)
const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const change = (now: number, before: number | null) => (before ? (now - before) / before : null)

export type Delta = number | null // fraction vs the period before; null = nothing to compare
export type Kpi = { value: number; prev: number | null; delta: Delta; spark: number[] }

export type MonthPoint = { key: string; label: string; total: number; count: number; lastYear: number; avg3: number | null; partial: boolean }
export type KindLine = { kind: WorkKind; total: number; count: number; share: number; avgJob: number; shareDelta: number | null }
export type YearMix = { year: string; total: number; parts: { kind: WorkKind; share: number }[] }
export type SizeBand = { label: string; min: number; max: number; count: number; total: number; countShare: number; totalShare: number }
export type ClientMove = { client: string; now: number; before: number; delta: number }
export type ClientRow = { client: string; total: number; count: number; share: number; isNew: boolean; delta: number | null }
export type Cohort = { key: string; label: string; fresh: number; returning: number }

export type Summary = {
  from: string
  to: string
  prevFrom: string | null
  prevTo: string | null
  invoiced: Kpi
  count: Kpi
  average: Kpi
  medianInvoice: number
  clients: Kpi
  newClients: { count: number; total: number } | null // null over All time
  returningShare: number | null // null over All time
  months: MonthPoint[]
  best: MonthPoint | null
  kinds: KindLine[]
  yearMix: YearMix[]
  sizes: SizeBand[]
  topClients: ClientRow[]
  movers: { up: ClientMove[]; down: ClientMove[] }
  cohorts: Cohort[]
  foreign: { currency: string; total: number; count: number }[]
}

const SIZE_BANDS = [
  { label: 'Under 1K', min: 0, max: 1000 },
  { label: '1K – 3K', min: 1000, max: 3000 },
  { label: '3K – 5K', min: 3000, max: 5000 },
  { label: '5K – 10K', min: 5000, max: 10000 },
  { label: '10K – 20K', min: 10000, max: 20000 },
  { label: '20K +', min: 20000, max: Infinity },
]

export function buildSummary(recs: Rec[], f: Filters, today = new Date().toISOString().slice(0, 10)): Summary {
  const all = toInvoices(recs)
  const scope = rm(narrow(all, f)) // client + work-type filters, every date
  const cur = rm(inRange(all, f))
  const anyCur = narrow(all, f)
  // All time starts at the first invoice in any currency; with none at all, at today.
  const from = f.range === 'all' ? (anyCur.map(i => i.date).sort()[0] ?? today) : f.from
  const comparable = f.range !== 'all' // "new" and "the period before" need a start that isn't the first invoice
  const to = f.to

  // The period before: the same number of days, ending the day before this one starts.
  const len = Math.round((t0(to) - t0(from)) / DAY) + 1
  const prevTo = comparable ? iso(t0(from) - DAY) : null
  const prevFrom = prevTo ? iso(t0(prevTo) - (len - 1) * DAY) : null
  const prev = prevFrom && prevTo ? scope.filter(i => i.date >= prevFrom && i.date <= prevTo) : null

  // ---- Months across the range, each with the same month a year earlier ----
  const months: MonthPoint[] = []
  {
    let [y, m] = from.split('-').map(Number)
    const [ey, em] = to.split('-').map(Number)
    while ((y < ey || (y === ey && m <= em)) && months.length < 240) {
      const key = `${y}-${String(m).padStart(2, '0')}`
      const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
      // A month the range only partly covers (this month so far, or a range starting
      // mid-month) is compared with exactly the same days a year earlier.
      const d0 = key === from.slice(0, 7) ? Number(from.slice(8)) : 1
      const d1 = key === to.slice(0, 7) ? Math.min(Number(to.slice(8)), lastDay) : lastDay
      const partial = d0 > 1 || d1 < lastDay
      const ly = `${y - 1}-${String(m).padStart(2, '0')}`
      const inDays = (i: Invoice, k: string) => i.date.startsWith(k) && Number(i.date.slice(8)) >= d0 && Number(i.date.slice(8)) <= d1
      const xs = cur.filter(i => i.date.startsWith(key))
      months.push({
        key,
        label: `${MON[m - 1]} ${String(y).slice(2)}${partial ? ' so far' : ''}`,
        total: sum(xs),
        count: xs.length,
        lastYear: sum(scope.filter(i => inDays(i, ly))),
        avg3: null,
        partial,
      })
      m++
      if (m > 12) ((m = 1), y++)
    }
    // The running average skips any window holding a partial month, so it isn't dragged down.
    months.forEach((p, i) => {
      if (i >= 2 && !months[i].partial && !months[i - 1].partial && !months[i - 2].partial)
        p.avg3 = (months[i].total + months[i - 1].total + months[i - 2].total) / 3
    })
  }
  const best = months.filter(p => p.total > 0).sort((a, b) => b.total - a.total)[0] ?? null

  // ---- Headline figures, each against the period before, with a monthly sparkline ----
  const clientsOf = (xs: Invoice[]) => new Set(xs.map(i => i.client)).size
  const total = sum(cur)
  const prevTotal = prev ? sum(prev) : null
  const avg = cur.length ? total / cur.length : 0
  const prevAvg = prev && prev.length ? sum(prev) / prev.length : null
  const sparkAvg = months.map(p => (p.count ? p.total / p.count : 0))
  const sparkClients = months.map(p => clientsOf(cur.filter(i => i.date.startsWith(p.key))))

  // New = the client's first invoice ever falls inside the range.
  // First-ever invoice: any currency, any work type — a filter never makes an old client new.
  const firstSeen = new Map<string, string>()
  for (const i of [...all].sort((a, b) => a.date.localeCompare(b.date))) if (!firstSeen.has(i.client)) firstSeen.set(i.client, i.date)
  // Over All time every client would be "new", so the idea doesn't apply there.
  const isNew = (c: string) => comparable && (firstSeen.get(c) ?? '') >= from
  const curClients = [...new Set(cur.map(i => i.client))]
  const newList = curClients.filter(isNew)
  const newTotal = sum(cur.filter(i => isNew(i.client)))

  // ---- Work types: rate per job and how the mix has shifted ----
  const kinds: KindLine[] = KINDS.map(kind => {
    const xs = cur.filter(i => i.kind === kind)
    const px = prev?.filter(i => i.kind === kind) ?? []
    const share = total ? sum(xs) / total : 0
    const prevShare = prev && prevTotal ? sum(px) / prevTotal : null
    return { kind, total: sum(xs), count: xs.length, share, avgJob: xs.length ? sum(xs) / xs.length : 0, shareDelta: prevShare === null ? null : share - prevShare }
  })
    .filter(k => k.count)
    .sort((a, b) => b.total - a.total)

  const thisYear = Number(today.slice(0, 4))
  const yearMix: YearMix[] = [thisYear - 3, thisYear - 2, thisYear - 1, thisYear].map(y => {
    const xs = scope.filter(i => i.date.startsWith(`${y}-`))
    const t = sum(xs)
    return { year: String(y), total: t, parts: KINDS.map(kind => ({ kind, share: t ? sum(xs.filter(i => i.kind === kind)) / t : 0 })) }
  })

  // ---- Invoice sizes: which band carries the money ----
  const sizes: SizeBand[] = SIZE_BANDS.map(b => {
    const xs = cur.filter(i => i.amount >= b.min && i.amount < b.max)
    return { ...b, count: xs.length, total: sum(xs), countShare: cur.length ? xs.length / cur.length : 0, totalShare: total ? sum(xs) / total : 0 }
  })

  // ---- Clients ----
  const byClient = (xs: Invoice[]) => {
    const m = new Map<string, { total: number; count: number }>()
    for (const i of xs) {
      const c = m.get(i.client) ?? { total: 0, count: 0 }
      m.set(i.client, { total: c.total + i.amount, count: c.count + 1 })
    }
    return m
  }
  const nowBy = byClient(cur)
  const prevBy = prev ? byClient(prev) : null
  const topClients: ClientRow[] = [...nowBy.entries()]
    .map(([client, v]) => ({
      client,
      ...v,
      share: total ? v.total / total : 0,
      isNew: isNew(client),
      delta: prevBy ? change(v.total, prevBy.get(client)?.total ?? null) : null,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const moves: ClientMove[] = prevBy
    ? [...new Set([...nowBy.keys(), ...prevBy.keys()])].map(client => {
        const now = nowBy.get(client)?.total ?? 0
        const before = prevBy.get(client)?.total ?? 0
        return { client, now, before, delta: now - before }
      })
    : []

  // New vs returning money, by quarter across the range.
  const qKey = (d: string) => `${d.slice(0, 4)}-Q${Math.floor((Number(d.slice(5, 7)) - 1) / 3) + 1}`
  const cohortMap = new Map<string, Cohort>()
  for (const i of cur) {
    const k = qKey(i.date)
    const c = cohortMap.get(k) ?? { key: k, label: `${k.slice(5)} ${k.slice(2, 4)}`, fresh: 0, returning: 0 }
    // New in the quarter of its first-ever invoice (when that falls inside the range, as the
    // headline figure counts it); returning in every later quarter.
    if (isNew(i.client) && qKey(firstSeen.get(i.client)!) === k) c.fresh += i.amount
    else c.returning += i.amount
    cohortMap.set(k, c)
  }

  const fx = new Map<string, { total: number; count: number }>()
  for (const i of inRange(all, f).filter(i => i.currency !== 'MYR')) {
    const c = fx.get(i.currency) ?? { total: 0, count: 0 }
    fx.set(i.currency, { total: c.total + i.amount, count: c.count + 1 })
  }

  return {
    from,
    to,
    prevFrom,
    prevTo,
    invoiced: { value: total, prev: prevTotal, delta: change(total, prevTotal), spark: months.map(p => p.total) },
    count: { value: cur.length, prev: prev ? prev.length : null, delta: change(cur.length, prev ? prev.length : null), spark: months.map(p => p.count) },
    average: { value: avg, prev: prevAvg, delta: change(avg, prevAvg), spark: sparkAvg },
    medianInvoice: median(cur.map(i => i.amount)),
    clients: { value: curClients.length, prev: prev ? clientsOf(prev) : null, delta: change(curClients.length, prev ? clientsOf(prev) : null), spark: sparkClients },
    newClients: comparable ? { count: newList.length, total: newTotal } : null,
    returningShare: comparable && total ? (total - newTotal) / total : null,
    months,
    best,
    kinds,
    yearMix,
    sizes,
    topClients,
    movers: {
      up: moves.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4),
      down: moves.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 4),
    },
    cohorts: [...cohortMap.values()].sort((a, b) => a.key.localeCompare(b.key)),
    foreign: [...fx.entries()].map(([currency, v]) => ({ currency, ...v })),
  }
}
