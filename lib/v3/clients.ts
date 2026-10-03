import type { Rec } from '@/lib/records'
import { toInvoices, type Invoice } from '@/lib/invoices'
import { narrow, type Filters } from './filters'

// 👉 Relationship analytics for v3 Clients, beyond the map: who is due back
// (their usual gap between jobs has passed), how well each year's new clients
// were kept, and the monthly rhythm of active clients. Ringgit only for money;
// counts include every invoice. The work-type filter applies; dates do not —
// a relationship is judged over its whole history.

const DAY = 86_400_000
const t0 = (d: string) => Date.parse(`${d}T00:00:00Z`)
const monthsBetween = (a: string, b: string) => (t0(b) - t0(a)) / (DAY * 30.44)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export type DueClient = {
  client: string
  jobs: number
  lifetime: number // RM
  foreign: { currency: string; total: number }[] // never added into RM
  last: string
  gapMonths: number // their usual (median) gap between jobs
  overdueMonths: number // how far past that gap they are now
}
export type Cohort = { year: string; clients: number; cameBack: number; within12: number; laterRm: number; inProgress: boolean }
export type ClientPulse = {
  due: DueClient[]
  cohorts: Cohort[]
  activeByMonth: { key: string; count: number }[] // distinct clients invoiced each month, last 24 months
  active12: number // clients invoiced in the last 12 months
  newThisYear: number
  clients: number // every client on record (any work type)
  repeatRate: number // share of all clients with jobs on two or more days, all time
  medianGap: number | null // across returning clients, months
}

// A relationship that has been silent for this long has ended, not slipped.
const COLD_MONTHS = 36

export function clientPulse(rows: Rec[], f: Filters, today = new Date().toISOString().slice(0, 10)): ClientPulse {
  const named = (xs: Invoice[]) => xs.filter(i => i.client && i.client !== '—')
  // The work-type filter steers who is due and who was active; first jobs, cohorts and
  // the repeat rate always read every invoice, so a filter never makes an old client new.
  const everything = named(toInvoices(rows))
  const all = named(narrow(toInvoices(rows), { ...f, client: undefined }))
  const group = (xs: Invoice[]) => {
    const m = new Map<string, Invoice[]>()
    for (const i of xs) m.set(i.client, [...(m.get(i.client) ?? []), i])
    return m
  }
  const by = group(all)
  const life = group(everything)
  const jobDays = (xs: Invoice[]) => new Set(xs.map(x => x.date)).size // two invoices for one shoot are one visit

  const due: DueClient[] = []
  const gaps: number[] = []
  for (const [client, xs] of by) {
    // One job per day at most — two invoices for one shoot are one visit.
    const days = [...new Set(xs.map(x => x.date))].sort()
    if (days.length < 2) continue
    const g = days.slice(1).map((d, k) => monthsBetween(days[k], d))
    const gap = median(g)
    gaps.push(gap)
    const last = days.at(-1)!
    const since = monthsBetween(last, today)
    const overdue = since - Math.max(gap, 1)
    if (overdue > 0.5 && since < COLD_MONTHS)
      due.push({
        client,
        jobs: xs.length,
        lifetime: xs.filter(x => x.currency === 'MYR').reduce((s, x) => s + x.amount, 0),
        foreign: [...xs.filter(x => x.currency !== 'MYR').reduce((m, x) => m.set(x.currency, (m.get(x.currency) ?? 0) + x.amount), new Map<string, number>())].map(([currency, total]) => ({ currency, total })),
        last,
        gapMonths: gap,
        overdueMonths: overdue,
      })
  }
  due.sort((a, b) => b.lifetime - a.lifetime)

  const [y0, m0] = today.split('-').map(Number)
  // Cohorts: clients grouped by the year of their first invoice.
  const first = new Map<string, string>()
  for (const [c, xs] of life) first.set(c, xs.map(x => x.date).sort()[0])
  const years = [...new Set([...first.values()].map(d => d.slice(0, 4)))].sort()
  const cohorts: Cohort[] = years.map(year => {
    const members = [...first.entries()].filter(([, d]) => d.startsWith(year)).map(([c]) => c)
    let came = 0
    let within = 0
    let laterRm = 0
    for (const c of members) {
      const xs = life.get(c)!
      const f0 = first.get(c)!
      const later = xs.filter(x => x.date > f0)
      if (later.length) came++
      if (later.some(x => monthsBetween(f0, x.date) <= 12)) within++
      laterRm += later.filter(x => x.currency === 'MYR').reduce((s, x) => s + x.amount, 0)
    }
    return { year, clients: members.length, cameBack: came, within12: within, laterRm, inProgress: Number(year) >= y0 }
  })

  const activeByMonth = Array.from({ length: 24 }, (_, k) => {
    const d = new Date(Date.UTC(y0, m0 - 1 - (23 - k), 1))
    const key = d.toISOString().slice(0, 7)
    return { key, count: new Set(all.filter(i => i.date.startsWith(key)).map(i => i.client)).size }
  })
  const yearAgo = new Date(t0(today) - 365 * DAY).toISOString().slice(0, 10)

  return {
    due: due.slice(0, 8),
    cohorts,
    activeByMonth,
    active12: new Set(all.filter(i => i.date > yearAgo && i.date <= today).map(i => i.client)).size,
    newThisYear: [...first.values()].filter(d => d.startsWith(String(y0))).length,
    clients: life.size,
    repeatRate: life.size ? [...life.values()].filter(xs => jobDays(xs) > 1).length / life.size : 0,
    medianGap: gaps.length ? median(gaps) : null,
  }
}
