import { isIssued, isPaid, type Rec } from '@/lib/records'
import { toInvoices, type Invoice, type WorkKind } from '@/lib/invoices'
import { narrow, inRange, KINDS, type Filters } from './filters'

// 👉 The creator studio's numbers, built around the three questions Aereon opens
// the app to answer (PRODUCT.md): am I on track this year, is my audience
// growing, and who owes me money. Every figure here comes from his records.
//
// Two rules hold throughout, and both are load-bearing:
//   · Ringgit only in totals. Foreign-currency invoices are counted and listed
//     separately, never converted and summed into RM.
//   · One shared scale. Both years in the pace chart, and every month frame, are
//     measured against the same maximum, so no comparison is flattered by an
//     axis that quietly rescaled itself.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const rm = (xs: Invoice[]) => xs.filter(i => i.currency === 'MYR')
const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)

// `before` is last year's running total at month end (chart line). `beforeAt` is the
// same, except for the current month, where it stops at today's date — the fair
// comparison for a month that isn't over yet.
export type PacePoint = { month: string; now: number | null; before: number; beforeAt: number }
export type MonthFrame = {
  key: string // YYYY-MM
  label: string
  total: number
  count: number
  numbers: string[] // the invoice numbers raised that month, for the film edge
  density: number // 0..1 against the shared maximum
  future: boolean
}
export type MixLine = { kind: WorkKind; total: number; count: number; share: number }
export type OwedLine = { id: number; no: string; client: string; amount: number; currency: string; date: string; days: number }
export type ClientLine = { client: string; total: number; count: number; last: string; share: number }

export type Studio = {
  today: string
  recentIncome: number // RM invoiced in the owed window, same filters as `owed`
  recentPaid: number // of that, RM marked paid
  untracked: number // invoices still `issued`: payment not tracked, never counted as owed
  year: number
  // Question 1 — on track this year
  ytd: number
  lastYtd: number // the same point in the previous year
  lastFull: number // the whole previous year
  pacePct: number | null // this year against the same point last year
  projection: number // this year at its current pace
  pace: PacePoint[]
  monthsLeft: number
  // The months of the chosen year, printed as frames
  frames: MonthFrame[]
  bestMonth: MonthFrame | null
  // The filtered range
  rangeTotal: number
  rangeCount: number
  mix: MixLine[]
  clients: ClientLine[]
  keepers: Invoice[] // the three biggest jobs in range: the frames circled on the sheet
  foreign: { count: number; byCurrency: { currency: string; total: number; count: number }[] }
  // Question 3 — who owes me money
  owed: OwedLine[]
  owedTotal: number
  unconfirmedOlder: number // invoices tracked as unpaid, older than the owed window
  paidCount: number
  // Filter choices, drawn from the data rather than invented
  allClients: string[]
}

import { OWED_WINDOW_DAYS } from './catalog'
export { OWED_WINDOW_DAYS }

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)

export function buildStudio(rows: Rec[], f: Filters, today = new Date().toISOString().slice(0, 10)): Studio {
  const all = toInvoices(rows)
  const narrowed = rm(narrow(all, f))
  const year = f.year
  const isCurrentYear = year === Number(today.slice(0, 4))
  const cutoffMd = isCurrentYear ? today.slice(5) : '12-31'

  // ---- Question 1: on track ----
  const inYear = (xs: Invoice[], y: number) => xs.filter(i => i.date.startsWith(`${y}-`))
  const thisYear = inYear(narrowed, year)
  const prevYear = inYear(narrowed, year - 1)
  const ytd = sum(thisYear.filter(i => i.date.slice(5) <= cutoffMd))
  const lastYtd = sum(prevYear.filter(i => i.date.slice(5) <= cutoffMd))
  const lastFull = sum(prevYear)
  const pacePct = lastYtd ? ((ytd - lastYtd) / lastYtd) * 100 : null

  const dayOfYear = isCurrentYear ? dayDiff(`${year}-01-01`, today) + 1 : 365
  const projection = isCurrentYear ? (ytd / Math.max(dayOfYear, 1)) * 365 : ytd

  const monthTotal = (xs: Invoice[], m: number) => xs.filter(i => Number(i.date.slice(5, 7)) === m)
  const currentMonth = isCurrentYear ? Number(today.slice(5, 7)) : 12
  let runNow = 0
  let runBefore = 0
  const pace: PacePoint[] = MONTHS.map((label, idx) => {
    const m = idx + 1
    runBefore += sum(monthTotal(prevYear, m))
    if (m <= currentMonth) runNow += sum(monthTotal(thisYear, m))
    return {
      month: label,
      now: m <= currentMonth ? runNow : null,
      before: runBefore,
      beforeAt: isCurrentYear && m === currentMonth ? lastYtd : runBefore,
    }
  })

  // ---- The months, as frames on one shared scale across both years ----
  const perMonth = (xs: Invoice[]) => MONTHS.map((_, i) => monthTotal(xs, i + 1))
  const nowMonths = perMonth(thisYear)
  const beforeMonths = perMonth(prevYear)
  const peak = Math.max(1, ...nowMonths.map(sum), ...beforeMonths.map(sum))
  const frames: MonthFrame[] = nowMonths.map((xs, i) => ({
    key: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: MONTHS[i],
    total: sum(xs),
    count: xs.length,
    numbers: xs.map(x => x.no).sort(),
    density: sum(xs) / peak,
    future: isCurrentYear && i + 1 > currentMonth,
  }))
  const bestMonth = frames.filter(fr => fr.total > 0).sort((a, b) => b.total - a.total)[0] ?? null

  // ---- The filtered range ----
  const ranged = inRange(all, f)
  const rangedRm = rm(ranged)
  const rangeTotal = sum(rangedRm)

  const mix: MixLine[] = KINDS.map(kind => {
    const xs = rangedRm.filter(i => i.kind === kind)
    return { kind, total: sum(xs), count: xs.length, share: rangeTotal ? sum(xs) / rangeTotal : 0 }
  })
    .filter(x => x.count > 0)
    .sort((a, b) => b.total - a.total)

  const byClient = new Map<string, Invoice[]>()
  for (const i of rangedRm) byClient.set(i.client, [...(byClient.get(i.client) ?? []), i])
  const clients: ClientLine[] = [...byClient.entries()]
    .map(([client, xs]) => ({
      client,
      total: sum(xs),
      count: xs.length,
      last: xs.map(x => x.date).sort().at(-1) ?? '',
      share: rangeTotal ? sum(xs) / rangeTotal : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const keepers = [...rangedRm].sort((a, b) => b.amount - a.amount).slice(0, 3)

  const foreignList = ranged.filter(i => i.currency !== 'MYR')
  const fx = new Map<string, { total: number; count: number }>()
  for (const i of foreignList) {
    const cur = fx.get(i.currency) ?? { total: 0, count: 0 }
    fx.set(i.currency, { total: cur.total + i.amount, count: cur.count + 1 })
  }

  // ---- Question 3: who owes me money (owedBook, below) ----
  const book = owedBook(rows, narrow(all, f), today)
  const { owed, paidIds } = book

  const recent = narrowed.filter(i => { const d = dayDiff(i.date, today); return d >= 0 && d <= OWED_WINDOW_DAYS })

  return {
    today,
    year,
    ytd,
    lastYtd,
    lastFull,
    pacePct,
    projection,
    pace,
    monthsLeft: isCurrentYear ? 12 - currentMonth : 0,
    frames,
    bestMonth,
    rangeTotal,
    rangeCount: rangedRm.length,
    mix,
    clients,
    keepers,
    foreign: {
      count: foreignList.length,
      byCurrency: [...fx.entries()].map(([currency, v]) => ({ currency, ...v })).sort((a, b) => b.count - a.count),
    },
    owed,
    owedTotal: book.owedTotal,
    recentIncome: sum(recent),
    recentPaid: sum(recent.filter(i => paidIds.has(i.id))),
    untracked: book.untracked,
    unconfirmedOlder: book.olderCount,
    paidCount: book.paidCount,
    allClients: [...new Set(all.map(i => i.client))].filter(c => c && c !== '—').sort((a, b) => a.localeCompare(b)),
  }
}

// ---- Question 3: who owes me money ----
// "Owed" = invoices TRACKED as unpaid, in exact days since issue. An `issued`
// invoice is documented but its payment isn't tracked, so it is never owed
// (isIssued() in lib/records.ts, a house rule) — those are only counted, as
// `untracked`. There are no due dates in the records, so nothing is "overdue".
// Shared by the Dashboard (filtered) and Invoice Details (every invoice).
export function owedBook(rows: Rec[], invoices: Invoice[], today: string) {
  const paidIds = new Set(rows.filter(r => r.category === 'cash_in' && isPaid(r)).map(r => r.id))
  const issuedIds = new Set(rows.filter(r => r.category === 'cash_in' && isIssued(r)).map(r => r.id))
  const unconfirmed = invoices.filter(i => !paidIds.has(i.id) && !issuedIds.has(i.id))
  const owed: OwedLine[] = unconfirmed
    .map(i => ({ id: i.id, no: i.no, client: i.client, amount: i.amount, currency: i.currency, date: i.date, days: dayDiff(i.date, today) }))
    .filter(o => o.days <= OWED_WINDOW_DAYS && o.days >= 0)
    .sort((a, b) => b.days - a.days)
  return {
    owed,
    owedTotal: owed.filter(o => o.currency === 'MYR').reduce((s, o) => s + o.amount, 0),
    untracked: invoices.filter(i => issuedIds.has(i.id)).length,
    olderCount: unconfirmed.filter(i => dayDiff(i.date, today) > OWED_WINDOW_DAYS).length,
    paidCount: paidIds.size,
    paidIds,
  }
}

// Owed ringgit by age since issue — the Dashboard's ageing bar. Buckets cover the
// whole owed window, so they always add up to owedTotal.
export const AGE_BUCKETS = [
  { id: 'new', label: '0–30 days', max: 30 },
  { id: 'mid', label: '31–60 days', max: 60 },
  { id: 'late', label: '61–90 days', max: 90 },
  { id: 'old', label: `91–${OWED_WINDOW_DAYS} days`, max: Infinity }, // the rest of the owed window
] as const
export function ageing(owed: OwedLine[]) {
  const rmOwed = owed.filter(o => o.currency === 'MYR')
  return AGE_BUCKETS.map((b, i) => {
    const min = i ? AGE_BUCKETS[i - 1].max + 1 : 0
    const xs = rmOwed.filter(o => o.days >= min && o.days <= b.max)
    return { ...b, total: xs.reduce((s, o) => s + o.amount, 0), count: xs.length }
  })
}
