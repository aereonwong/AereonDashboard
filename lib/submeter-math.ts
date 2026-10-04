// 👉 Sub-meter maths for the Property tab (dual-key units billed from split meters). Pure functions,
// no imports, so the page and the import script share them. Dates are YYYY-MM-DD strings.
//
//   segment   = the usage between two readings of ONE unit: kWh, days, rate charged, RM charged.
//   cycle     = one TNB bill (issued on the 12th): the month before it, ending on the bill date.
//               Each unit's kWh in a cycle is worked out by laying the readings out as a straight line
//               and reading it at the cycle's two ends, so readings need not fall on the 12th.
//   leak gap  = (both sub-meters in a cycle − TNB's kWh) ÷ TNB's kWh. Near 0 = nothing leaks.
//   cost/kWh  = what TNB really charged per kWh = bill RM ÷ bill kWh. A segment's cost is the usage
//               times the cost/kWh of the cycles it overlaps, weighted by the days they overlap.
//   buffer    = charged − cost. The flat rate is meant to stay clearly above cost.

/** What tenants pay per kWh from the 4 Oct 2026 decision on: one flat rate for every unit. */
export const FLAT_RATE = 0.5
/** TNB's residential bill adds a retail charge and service tax once a month passes this many kWh. */
export const HIGH_USE_KWH = 600
/** Below this, the buffer is flagged as thin. */
export const HEALTHY_BUFFER = 0.1
/** A reading gap longer than this many days is flagged. */
export const LONG_GAP_DAYS = 45

export type Reading = {
  id: number
  property_id: string
  unit: string
  read_on: string
  reading: number
  rate: number | null // RM per kWh charged for the usage since the previous reading
  legacy: boolean // recorded before the flat rate
  note: string | null
}

export type Bill = {
  id: number
  property_id: string
  bill_date: string
  amount: number
  kwh: number | null
  kw: number | null
  kvarh: number | null
  note: string | null
}

export type Segment = {
  id: number // the reading that closes the segment
  unit: string
  from: string
  to: string
  days: number
  kwh: number
  perDay: number
  rate: number | null
  charged: number | null
  legacy: boolean
  costPerKwh: number | null // TNB's real cost per kWh over the segment, if bills cover it
  cost: number | null
  buffer: number | null
  flags: string[]
}

export type Cycle = {
  bill: Bill
  start: string
  units: { unit: string; kwh: number | null }[]
  sub: number | null // every unit added together; null while any unit is not covered by readings
  tnbKwh: number | null
  gap: number | null // fraction, e.g. 0.025 = sub-meters read 2.5% more than TNB
  perKwh: number | null
  high: boolean // a month above 600 kWh
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r4 = (n: number) => Math.round(n * 10_000) / 10_000
const dayNum = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86_400_000
export const daysBetween = (a: string, b: string) => Math.round(dayNum(b) - dayNum(a))

/** The date a month earlier (same day of month, clamped to the month's length). */
export function monthBefore(iso: string): string {
  const y = +iso.slice(0, 4)
  const m = +iso.slice(5, 7) - 1
  const d = +iso.slice(8, 10)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1, Math.min(d, last))).toISOString().slice(0, 10)
}

/** The next 12th on or after `today`: when the next reading is due, so it lines up with the TNB bill. */
export function nextReadingDue(today: string): string {
  const y = +today.slice(0, 4)
  const m = +today.slice(5, 7)
  const d = +today.slice(8, 10)
  const [yy, mm] = d <= 12 ? [y, m] : m === 12 ? [y + 1, 1] : [y, m + 1]
  return `${yy}-${String(mm).padStart(2, '0')}-12`
}

const byDate = <T extends { read_on: string }>(a: T, b: T) => a.read_on.localeCompare(b.read_on)

/** One unit's meter value on `date`, laid on a straight line between its readings; null outside the range read. */
export function meterAt(rows: Reading[], date: string): number | null {
  const s = [...rows].sort(byDate)
  if (!s.length || date < s[0].read_on || date > s[s.length - 1].read_on) return null
  for (let i = 0; i < s.length; i++) {
    if (s[i].read_on === date) return s[i].reading
    const next = s[i + 1]
    if (next && date > s[i].read_on && date < next.read_on) {
      const t = daysBetween(s[i].read_on, date) / daysBetween(s[i].read_on, next.read_on)
      return s[i].reading + t * (next.reading - s[i].reading)
    }
  }
  return null
}

export const unitsOf = (readings: Reading[]) => [...new Set(readings.map(r => r.unit))]

/** TNB cycles, oldest first, with each unit's usage worked out from the readings. */
export function cycles(bills: Bill[], readings: Reading[]): Cycle[] {
  const sorted = [...bills].sort((a, b) => a.bill_date.localeCompare(b.bill_date))
  const units = unitsOf(readings)
  return sorted.map((bill, i) => {
    const prev = sorted[i - 1]?.bill_date
    const start = prev && daysBetween(prev, bill.bill_date) <= 35 ? prev : monthBefore(bill.bill_date)
    const per = units.map(unit => {
      const rows = readings.filter(r => r.unit === unit)
      const a = meterAt(rows, start)
      const b = meterAt(rows, bill.bill_date)
      return { unit, kwh: a == null || b == null ? null : r2(b - a) }
    })
    const covered = per.length > 0 && per.every(u => u.kwh != null)
    const sub = covered ? r2(per.reduce((t, u) => t + (u.kwh ?? 0), 0)) : null
    const basis = bill.kwh ?? sub
    return {
      bill,
      start,
      units: per,
      sub,
      tnbKwh: bill.kwh,
      gap: sub != null && bill.kwh ? (sub - bill.kwh) / bill.kwh : null,
      perKwh: basis ? r4(bill.amount / basis) : null,
      high: (basis ?? 0) > HIGH_USE_KWH,
    }
  })
}

/** TNB's cost per kWh over [from, to]: the cycles it overlaps, weighted by days. Null if the bills cover under half of it. */
function costPerKwh(cs: Cycle[], from: string, to: string): number | null {
  const span = daysBetween(from, to)
  if (span <= 0) return null
  let days = 0
  let weighted = 0
  for (const c of cs) {
    if (c.perKwh == null) continue
    const o = Math.min(daysBetween(from, c.bill.bill_date), span) - Math.max(daysBetween(from, c.start), 0)
    if (o > 0) {
      days += o
      weighted += o * c.perKwh
    }
  }
  return days / span >= 0.5 ? r4(weighted / days) : null
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** Every unit's usage between consecutive readings, with the rate charged, TNB's cost and what's flagged. */
export function segments(readings: Reading[], cs: Cycle[]): Segment[] {
  const out: Segment[] = []
  for (const unit of unitsOf(readings)) {
    const rows = readings.filter(r => r.unit === unit).sort(byDate)
    const seen: number[] = []
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1]
      const b = rows[i]
      const days = daysBetween(a.read_on, b.read_on)
      const kwh = r2(b.reading - a.reading)
      const perDay = days > 0 ? kwh / days : 0
      const cpk = costPerKwh(cs, a.read_on, b.read_on)
      const flags: string[] = []
      if (kwh < 0) flags.push('Meter went backwards')
      if (days > LONG_GAP_DAYS) flags.push(`${days} days since the last reading`)
      if (seen.length >= 3) {
        const m = median(seen)
        if (m > 0 && Math.abs(perDay - m) / m > 0.4) flags.push(`${perDay > m ? 'Usage up' : 'Usage down'} ${Math.round((Math.abs(perDay - m) / m) * 100)}% on this unit's usual — check the reading`)
      }
      if (kwh >= 0) seen.push(perDay)
      const charged = b.rate != null ? r2(kwh * b.rate) : null
      const cost = cpk != null ? r2(kwh * cpk) : null
      out.push({ id: b.id, unit, from: a.read_on, to: b.read_on, days, kwh, perDay, rate: b.rate, charged, legacy: b.legacy, costPerKwh: cpk, cost, buffer: charged != null && cost != null ? r2(charged - cost) : null, flags })
    }
  }
  return out.sort((x, y) => y.to.localeCompare(x.to) || x.unit.localeCompare(y.unit))
}

/** Charged against cost over the segments that have both, split into the old rates and the flat rate. */
export function buffers(segs: Segment[]) {
  const sum = (rows: Segment[]) => {
    const used = rows.filter(s => s.charged != null && s.cost != null)
    const charged = r2(used.reduce((t, s) => t + (s.charged ?? 0), 0))
    const cost = r2(used.reduce((t, s) => t + (s.cost ?? 0), 0))
    return { n: used.length, kwh: r2(used.reduce((t, s) => t + s.kwh, 0)), charged, cost, buffer: r2(charged - cost), pct: cost > 0 ? (charged - cost) / cost : null }
  }
  return { flat: sum(segs.filter(s => !s.legacy)), old: sum(segs.filter(s => s.legacy)) }
}

/** The leak check across every cycle both sub-meters cover: the combined gap and TNB's cost per kWh. */
export function leakSummary(cs: Cycle[]) {
  const covered = cs.filter(c => c.sub != null && c.tnbKwh)
  const sub = covered.reduce((t, c) => t + (c.sub ?? 0), 0)
  const tnb = covered.reduce((t, c) => t + (c.tnbKwh ?? 0), 0)
  const priced = cs.filter(c => c.perKwh != null).slice(-6)
  const costs = priced.map(c => c.perKwh as number)
  return {
    n: covered.length,
    gap: tnb > 0 ? (sub - tnb) / tnb : null,
    avgCost: costs.length ? r4(costs.reduce((a, b) => a + b, 0) / costs.length) : null,
    worstCost: costs.length ? Math.max(...costs) : null,
    latestCost: priced.length ? (priced[priced.length - 1].perKwh as number) : null,
  }
}
