// 👉 The job date on an invoice is often more than one day: a shoot with a
// rehearsal, a two-night trip, a show that straddles midnight. This turns what
// Aereon types into (a) every day it covers, as YYYY-MM-DD, and (b) the wording
// printed on the invoice. Accepted, all of them:
//
//   1st September 2026            22/10/26   2026-10-22
//   1st to 3rd September 2026     1-3 Sept 2026
//   31st Aug, 3rd Sept 2026       1st and 5th Sept 2026
//   31st Dec 2025 and 1st Jan 2026
//
// "to" / "-" means a range (every day between is covered); "and" / "&" / ","
// means just those days. A missing month or year is borrowed from the date that
// follows, and a year that would put the start after the end is rolled back one.

export type EventDates = { dates: string[]; label: string }

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']
const monthOf = (w: string) => {
  const i = MONTHS.findIndex(m => m === w || (w.length >= 3 && m.startsWith(w)) || (w === 'sept' && m === 'september'))
  return i >= 0 ? i + 1 : 0
}

const ord = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${s}`
}
const cap = (m: number) => MONTHS[m - 1][0].toUpperCase() + MONTHS[m - 1].slice(1)
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const real = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const parts = (s: string) => s.split('-').map(Number) as [number, number, number]

type Item = { day: number; month?: number; year?: number; guessedYear?: boolean }

/** The days the text covers, or null if it can't be read. */
function read(text: string): { items: Item[]; range: boolean } | null {
  const toks = text.toLowerCase().match(/\d{4}|\d{1,2}(?:st|nd|rd|th)?|[a-z]+|[-–—&,]/g)
  if (!toks) return null
  const items: Item[] = []
  const seps: ('range' | 'list')[] = []
  let pending: 'range' | 'list' | null = null
  for (const t of toks) {
    if (/^\d{4}$/.test(t)) {
      const last = items[items.length - 1]
      if (!last || last.year) return null
      last.year = Number(t)
    } else if (/^\d/.test(t)) {
      const day = parseInt(t, 10)
      if (day < 1 || day > 31) return null
      if (items.length) seps.push(pending ?? 'list')
      pending = null
      items.push({ day })
    } else if (['to', 'until', 'till', 'through', 'thru', '-', '–', '—'].includes(t)) {
      pending = 'range'
    } else if (['and', '&', ','].includes(t)) {
      pending ??= 'list'
    } else {
      const m = monthOf(t)
      const last = items[items.length - 1]
      if (!m || !last || last.month) return null
      last.month = m
    }
  }
  if (!items.length || (seps.length && !seps.every(s => s === seps[0]))) return null
  const range = seps[0] === 'range'
  if (range && items.length !== 2) return null
  // Borrow a missing month/year from the date that follows.
  for (let i = items.length - 1; i >= 0; i--) {
    const next = items[i + 1]
    if (!items[i].month) items[i].month = next?.month
    if (!items[i].year && next?.year) {
      items[i].year = next.year
      items[i].guessedYear = true
    }
    if (!items[i].month || !items[i].year) return null
  }
  // "30 Dec to 2 Jan 2026": the borrowed year overshoots, so step it back.
  for (let i = items.length - 2; i >= 0; i--) {
    const a = items[i], b = items[i + 1]
    if (a.guessedYear && iso(a.year!, a.month!, a.day) > iso(b.year!, b.month!, b.day)) a.year!--
  }
  return { items, range }
}

function label(dates: string[], range: boolean): string {
  const p = dates.map(parts)
  const sameYear = p.every(x => x[0] === p[0][0])
  const sameMonth = sameYear && p.every(x => x[1] === p[0][1])
  const one = ([y, m, d]: [number, number, number], withMonth: boolean, withYear: boolean) =>
    `${ord(d)}${withMonth ? ` ${cap(m)}` : ''}${withYear ? ` ${y}` : ''}`
  if (p.length === 1) return one(p[0], true, true)
  const first = p[0], last = p[p.length - 1]
  if (range) {
    if (sameMonth) return `${one(first, false, false)} to ${one(last, true, true)}`
    return `${one(first, true, !sameYear)} to ${one(last, true, true)}`
  }
  const list = (xs: string[]) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
  if (sameMonth) return `${list(p.slice(0, -1).map(x => one(x, false, false)).concat(one(last, true, true)))}`
  return list(p.map((x, i) => one(x, true, i === p.length - 1 || !sameYear)))
}

/** Read a job date the way Aereon types it. Null if it can't be understood. */
export function parseEventDates(text: string): EventDates | null {
  const t = text.trim()
  if (!t) return null
  let dates: string[]
  let range = false
  const numeric = t.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) dates = [t]
  else if (numeric) {
    const [, d, m, y] = numeric
    dates = [iso(y.length === 2 ? 2000 + Number(y) : Number(y), Number(m), Number(d))]
  } else {
    const r = read(t)
    if (!r) return null
    range = r.range
    const days = r.items.map(i => iso(i.year!, i.month!, i.day))
    if (range) {
      const [a, b] = days
      if (a > b) return null
      const out: string[] = []
      for (let d = new Date(`${a}T00:00:00Z`); out.length < 62; d = new Date(d.getTime() + 864e5)) {
        const s = d.toISOString().slice(0, 10)
        out.push(s)
        if (s === b) break
      }
      if (out[out.length - 1] !== b) return null
      dates = out
    } else dates = [...new Set(days)].sort()
  }
  if (!dates.every(s => real(...parts(s)))) return null
  // A range prints as its two ends; a list prints every day named.
  const shown = range ? [dates[0], dates[dates.length - 1]] : dates
  return { dates, label: label(shown.length === 2 && shown[0] === shown[1] ? [shown[0]] : shown, range && shown[0] !== shown[1]) }
}
