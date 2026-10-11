import type { Invoice, WorkKind } from '@/lib/invoices'
import { todayISO } from '@/lib/today'

// 👉 One filter model for every v3 surface, carried in the URL so a filtered
// view survives a refresh and can be bookmarked. The server reads it and does
// the arithmetic; the filter bar only ever edits the URL.

export const KINDS: WorkKind[] = ['Drone / aerial', 'Social campaign', 'Event coverage', 'Production / licensing', 'Other']

export type Range = 'ytd' | '12m' | 'last-year' | 'all' | 'custom'

export const RANGES: { id: Range; label: string }[] = [
  { id: 'ytd', label: 'This year' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'last-year', label: 'Last year' },
  { id: 'all', label: 'All time' },
  { id: 'custom', label: 'Custom' },
]

export type Filters = {
  range: Range
  from: string // YYYY-MM-DD, inclusive
  to: string // YYYY-MM-DD, inclusive
  client?: string
  kind?: WorkKind
  /** The calendar year the pace chart compares against the year before it. */
  year: number
}

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const iso = (s: string | undefined) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined)

export function parseFilters(
  sp: Params,
  today = todayISO(),
  /** What an empty URL means. Clients reads a relationship, so it defaults to all time. */
  fallback: Range = 'ytd',
): Filters {
  const y = Number(today.slice(0, 4))
  const raw = one(sp.range)
  const range: Range = RANGES.some(r => r.id === raw) ? (raw as Range) : fallback

  let from = `${y}-01-01`
  let to = today
  if (range === '12m') {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCFullYear(d.getUTCFullYear() - 1)
    d.setUTCDate(d.getUTCDate() + 1)
    from = d.toISOString().slice(0, 10)
  } else if (range === 'last-year') {
    from = `${y - 1}-01-01`
    to = `${y - 1}-12-31`
  } else if (range === 'all') {
    from = '2000-01-01'
  } else if (range === 'custom') {
    from = iso(one(sp.from)) ?? from
    to = iso(one(sp.to)) ?? to
    if (from > to) [from, to] = [to, from]
  }

  const client = one(sp.client)?.trim() || undefined
  const k = one(sp.kind)
  const kind = KINDS.find(x => x === k)

  return { range, from, to, client, kind, year: Number(to.slice(0, 4)) }
}

/** Client and work-type filters: they narrow every module, whatever the range. */
export const narrow = (list: Invoice[], f: Filters) =>
  list.filter(i => (!f.client || i.client === f.client) && (!f.kind || i.kind === f.kind))

/** The full filter, range included. */
export const inRange = (list: Invoice[], f: Filters) => narrow(list, f).filter(i => i.date >= f.from && i.date <= f.to)

/** Rebuild a query string with one value changed, for links that keep the rest. */
export function withParam(f: Filters, key: string, value: string | undefined): string {
  const p = new URLSearchParams()
  if (f.range !== 'ytd') p.set('range', f.range)
  if (f.range === 'custom') {
    p.set('from', f.from)
    p.set('to', f.to)
  }
  if (f.client) p.set('client', f.client)
  if (f.kind) p.set('kind', f.kind)
  if (value === undefined) p.delete(key)
  else p.set(key, value)
  const s = p.toString()
  return s ? `?${s}` : '?'
}

