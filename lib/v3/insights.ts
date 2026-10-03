import { isPaid, type Rec } from '@/lib/records'
import { toInvoices, type Invoice } from '@/lib/invoices'
import { narrow, type Filters } from './filters'
import type { LinkedPost } from '@/lib/ig-link-types'
import type { IgPost } from '@/lib/ig-fetch'
import type { MetricRow } from './ig-insights'

// 👉 The Dashboard's insight panels: how fast work turns into money, how much
// rests on one client, which months are busy or quiet, and whether Instagram
// reach is followed by paid work. Every figure comes from the records and the
// stored Instagram snapshot; where history is too thin to say something, the
// result says so instead of drawing a trend.
//
// Ringgit only, as everywhere: foreign-currency invoices are never summed into RM.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rm = (xs: Invoice[]) => xs.filter(i => i.currency === 'MYR')
const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const isoDay = (s: unknown) => (typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null)
/** A post's day in Malaysia time — a post at 11pm on the 14th was delivered on the 14th. */
const mytDay = (ts: string) => {
  const t = Date.parse(ts)
  return Number.isNaN(t) ? null : new Date(t + 8 * 3_600_000).toISOString().slice(0, 10)
}

// ------------------------------------------------------------ 1. Getting paid

/** When the work was delivered: the tagged Instagram post if there is one (the
 *  deliverable went live), otherwise the event date. Neither → unknown, never guessed. */
export function deliveredOn(r: Pick<Rec, 'meta'>): { day: string; source: 'post' | 'event' } | null {
  const posts = Array.isArray(r.meta?.ig_posts) ? (r.meta!.ig_posts as LinkedPost[]) : []
  const postDays = posts.map(p => mytDay(p.timestamp)).filter((d): d is string => !!d).sort()
  if (postDays.length) return { day: postDays.at(-1)!, source: 'post' } // the campaign ends with its last post
  const ev = isoDay(r.meta?.job_date) ?? isoDay(r.meta?.event_date) // job_date is the job's final day
  return ev ? { day: ev, source: 'event' } : null
}

export type PaidLine = { id: number; no: string; client: string; delivered: string; paid: string; days: number; source: 'post' | 'event' }
export type LagLine = { id: number; no: string; client: string; delivered: string; invoiced: string; days: number }
export type PaySpeed = {
  paid: PaidLine[] // paid invoices with a delivery date and a paid date
  medianDays: number | null
  slowest: { client: string; median: number; count: number }[]
  paidNoDate: number // marked paid, but no delivery date to measure from
  paidBulk: number // confirmed paid in bulk ("Confirm as paid"): the click date says nothing about payment
  paidEarly: number // paid before delivery (deposits) — left out of the median
  lagMedian: number | null // delivered → invoiced, days (invoices raised after delivery)
  lagCount: number
  lagAhead: number // invoiced on or before delivery — left out of the median
  lagLate: LagLine[] // longest gaps between delivery and invoicing
}

export function paySpeed(rows: Rec[], f: Filters): PaySpeed {
  const byId = new Map(rows.map(r => [r.id, r]))
  const list = narrow(toInvoices(rows), f)
  const paid: PaidLine[] = []
  const lag: LagLine[] = []
  let paidNoDate = 0
  let paidBulk = 0
  let paidEarly = 0
  let lagAhead = 0
  for (const i of list) {
    const r = byId.get(i.id)!
    const d = deliveredOn(r)
    if (d) {
      const gap = dayDiff(d.day, i.date)
      if (gap > 0) lag.push({ id: i.id, no: i.no, client: i.client, delivered: d.day, invoiced: i.date, days: gap })
      else lagAhead++
    }
    if (!isPaid(r)) continue
    // paid_at is the day Paid was clicked. A bulk confirmation stamps today on years of
    // old invoices, so those rows carry no payment timing at all.
    if (r.meta?.paid_baseline) {
      paidBulk++
      continue
    }
    const paidDay = isoDay(r.meta?.paid_at)
    if (!d || !paidDay) {
      paidNoDate++
      continue
    }
    if (dayDiff(d.day, paidDay) < 0) {
      paidEarly++
      continue
    }
    paid.push({ id: i.id, no: i.no, client: i.client, delivered: d.day, paid: paidDay, days: dayDiff(d.day, paidDay), source: d.source })
  }
  const byClient = new Map<string, number[]>()
  for (const p of paid) byClient.set(p.client, [...(byClient.get(p.client) ?? []), p.days])
  return {
    paid,
    medianDays: median(paid.map(p => p.days)),
    slowest: [...byClient.entries()]
      .map(([client, xs]) => ({ client, median: median(xs)!, count: xs.length }))
      .sort((a, b) => b.median - a.median)
      .slice(0, 3),
    paidNoDate,
    paidBulk,
    paidEarly,
    lagMedian: median(lag.map(l => l.days)),
    lagCount: lag.length,
    lagAhead,
    lagLate: [...lag].sort((a, b) => b.days - a.days).slice(0, 3),
  }
}

// ------------------------------------------------------------- 3. Client risk

export const RISK_LINE = 0.25 // one client above this share of a year's income is a risk

export type ClientRisk = {
  from: string
  to: string
  total: number
  clients: number
  top: { client: string; total: number; share: number }[] // top three
  top1Share: number
  top3Share: number
  forEighty: number // how many clients make up 80% of the year
  prevTop1Share: number | null // the same measure, the 12 months before
  prevTop1Client: string | null
}

// The last 12 months to today, whatever the page's range — risk is about now.
// The work-type filter applies; a client filter does not (one client is always 100% of itself).
export function clientRisk(rows: Rec[], f: Filters, today: string): ClientRisk {
  const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10)
  const from = shift(364)
  const prevFrom = shift(729)
  const all = rm(narrow(toInvoices(rows), { ...f, client: undefined }))
  const roll = (xs: Invoice[]) => {
    const m = new Map<string, number>()
    for (const i of xs) m.set(i.client, (m.get(i.client) ?? 0) + i.amount)
    return [...m.entries()].map(([client, total]) => ({ client, total })).sort((a, b) => b.total - a.total)
  }
  const now = all.filter(i => i.date >= from && i.date <= today)
  const before = all.filter(i => i.date >= prevFrom && i.date < from)
  const total = sum(now)
  const ranked = roll(now)
  let run = 0
  let forEighty = 0
  for (const c of ranked) {
    if (run >= total * 0.8) break
    run += c.total
    forEighty++
  }
  const prevRanked = roll(before)
  const prevTotal = sum(before)
  return {
    from,
    to: today,
    total,
    clients: ranked.length,
    top: ranked.slice(0, 3).map(c => ({ ...c, share: total ? c.total / total : 0 })),
    top1Share: total ? (ranked[0]?.total ?? 0) / total : 0,
    top3Share: total ? ranked.slice(0, 3).reduce((s, c) => s + c.total, 0) / total : 0,
    forEighty,
    prevTop1Share: prevTotal ? (prevRanked[0]?.total ?? 0) / prevTotal : null,
    prevTop1Client: prevRanked[0]?.client ?? null,
  }
}

// ----------------------------------------------------- 7. Busy and quiet months

export type SeasonRow = { year: string; cells: { month: number; total: number; count: number; future: boolean }[]; total: number }
export type Seasons = {
  rows: SeasonRow[] // the last three years, oldest first
  average: { month: number; label: string; average: number; tone: 'busy' | 'quiet' | 'usual' }[]
  fullYears: string[] // the complete years the average is taken over
  peak: number // shared scale for every cell
}

export function seasons(rows: Rec[], f: Filters, today: string): Seasons {
  const list = rm(narrow(toInvoices(rows), f))
  const thisYear = Number(today.slice(0, 4))
  const thisMonth = Number(today.slice(5, 7))
  const first = list.map(i => i.date).sort()[0]
  const cell = (y: number, m: number) => {
    const xs = list.filter(i => i.date.startsWith(`${y}-${String(m).padStart(2, '0')}`))
    return { month: m, total: sum(xs), count: xs.length, future: y === thisYear && m > thisMonth }
  }
  const years = [thisYear - 2, thisYear - 1, thisYear]
  const out: SeasonRow[] = years.map(y => {
    const cells = MONTHS.map((_, i) => cell(y, i + 1))
    return { year: String(y), cells, total: cells.reduce((s, c) => s + c.total, 0) }
  })
  // The average is over complete years only: from the first January on record to last year.
  const firstFull = first ? (first.slice(5) <= '01-01' ? Number(first.slice(0, 4)) : Number(first.slice(0, 4)) + 1) : thisYear
  const fullYears: number[] = []
  for (let y = firstFull; y < thisYear; y++) fullYears.push(y)
  const avg = MONTHS.map((label, i) => ({
    month: i + 1,
    label,
    average: fullYears.length ? fullYears.reduce((s, y) => s + cell(y, i + 1).total, 0) / fullYears.length : 0,
  }))
  const mean = avg.reduce((s, a) => s + a.average, 0) / 12
  return {
    rows: out,
    average: avg.map(a => ({
      ...a,
      tone: !mean ? 'usual' : a.average >= mean * 1.4 ? 'busy' : a.average <= mean * 0.6 ? 'quiet' : 'usual',
    })),
    fullYears: fullYears.map(String),
    peak: Math.max(1, ...out.flatMap(r => r.cells.map(c => c.total))),
  }
}

// ------------------------------------------------ 6. Instagram reach vs paid work

/** Every post we have a reach for: the latest snapshot plus the stored readings
 *  (ig_post_metrics), so history reaches past the newest 40 posts. Latest reading wins. */
export type PostReach = { id: string; timestamp: string; reach?: number }
export function postReach(posts: IgPost[], metrics: MetricRow[]): PostReach[] {
  const out = new Map<string, PostReach>()
  for (const m of metrics) // oldest first, so a later reading replaces an earlier one
    if (m.posted_at && m.reach !== null) out.set(m.media_id, { id: m.media_id, timestamp: m.posted_at, reach: m.reach })
  for (const p of posts) if (p.reach !== undefined || !out.has(p.id)) out.set(p.id, { id: p.id, timestamp: p.timestamp, reach: p.reach })
  return [...out.values()]
}

export type ReachMonth = {
  key: string // YYYY-MM
  label: string
  posts: number
  reach: number // lifetime reach of each post published that month, added up — one person can count more than once
  invoiced: number // RM invoiced that month
  next2: number | null // RM invoiced in the two months after — null until both have passed
}
export type ReachVsWork = {
  months: ReachMonth[]
  // Months with above-median reach against the rest: average RM in the two months after.
  // Null until there are at least six months with both figures.
  highNext: number | null
  lowNext: number | null
  scored: number // months in the comparison
  linked: { count: number; total: number } // invoices tagged to an Instagram post
}

// Reach is the whole account's, so the invoices are too: a client filter doesn't apply.
export function reachVsWork(rows: Rec[], f: Filters, posts: PostReach[], today: string): ReachVsWork {
  const list = rm(narrow(toInvoices(rows), { ...f, client: undefined }))
  const monthKey = (ts: string) => mytDay(ts)?.slice(0, 7) ?? null
  const withReach = posts.filter(p => p.reach !== undefined)
  const keys = [...new Set(withReach.map(p => monthKey(p.timestamp)).filter((k): k is string => !!k))].sort()
  const add = (key: string, n: number) => {
    const d = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1 + n, 1))
    return d.toISOString().slice(0, 7)
  }
  const nowKey = today.slice(0, 7)
  // The oldest month is cut off where the stored posts begin, so it would understate reach:
  // leave it out. Every month after it is shown, a month with no posts as a gap (0 posts).
  const covered: string[] = []
  for (let k = keys[1]; k && k <= nowKey; k = add(k, 1)) covered.push(k)
  const rmIn = (key: string) => sum(list.filter(i => i.date.startsWith(key)))
  const months: ReachMonth[] = covered.map(key => {
    const mine = withReach.filter(p => monthKey(p.timestamp) === key)
    const done = add(key, 2) < nowKey
    return {
      key,
      label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}${key === nowKey ? ' so far' : ''}`,
      posts: mine.length,
      reach: mine.reduce((s, p) => s + (p.reach ?? 0), 0),
      invoiced: rmIn(key),
      next2: done ? rmIn(add(key, 1)) + rmIn(add(key, 2)) : null,
    }
  })
  const scored = months.filter(m => m.next2 !== null)
  let highNext: number | null = null
  let lowNext: number | null = null
  if (scored.length >= 6) {
    const mid = median(scored.map(m => m.reach))!
    const hi = scored.filter(m => m.reach > mid)
    const lo = scored.filter(m => m.reach <= mid)
    const avg = (xs: ReachMonth[]) => xs.reduce((s, m) => s + (m.next2 ?? 0), 0) / xs.length
    if (hi.length && lo.length) {
      highNext = avg(hi)
      lowNext = avg(lo)
    }
  }
  const linkedRows = rows.filter(r => r.category === 'cash_in' && r.meta?.invoice_no && Array.isArray(r.meta?.ig_posts) && r.meta.ig_posts.length)
  const linkedIds = new Set(linkedRows.map(r => r.id))
  const linkedList = list.filter(i => linkedIds.has(i.id))
  return { months, highNext, lowNext, scored: scored.length, linked: { count: linkedList.length, total: sum(linkedList) } }
}
