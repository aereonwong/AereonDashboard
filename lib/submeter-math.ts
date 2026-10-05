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
//   buffer    = charged − cost. The flat rate is meant to stay clearly above cost. It is worked out
//               separately: electricity is collected from the tenants, never a cost of the property.
//   tenant    = who a segment is billed to: the tenant named on the reading that closes it.
//   kind      = what a reading marks. 'reading' bills the usage since the last one; 'move_out' is a tenant's
//               final reading (billed as usual); 'move_in' is a new tenant's starting number — never a charge.
//               The usage that ends at a move-in reading happened between tenants (cleaning, viewings):
//               the owner's own electricity, billed to nobody. A same-day handover needs only the move-out:
//               the new tenant's first bill starts from it. A unit's very first reading is a starting point too.

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
  tenant_name: string | null // who the usage since the previous reading is billed to
  paid_on: string | null // when the tenant paid this reading's charge; null = still to collect
  kind?: ReadingKind // missing on rows from before the column = 'reading'
}

export type ReadingKind = 'reading' | 'move_in' | 'move_out'
export const KIND_LABEL: Record<ReadingKind, string> = { reading: 'Regular reading', move_out: 'Move-out (final reading)', move_in: 'Move-in (starting reading)' }
const kindOf = (r: Reading): ReadingKind => r.kind ?? 'reading'

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
  tenant: string | null
  paidOn: string | null
  kind: ReadingKind // of the reading that closes the segment
  vacant: boolean // ends at a move-in reading: between tenants, billed to nobody
  startReading: number // the meter at `from`
  from: string
  to: string
  days: number
  kwh: number
  perDay: number
  rate: number | null
  charged: number | null
  legacy: boolean
  costPerKwh: number | null // TNB's real cost per kWh over the segment, if bills cover it
  costEstimated: boolean // the cost leans on a bill without kWh, or on bills covering only part of the days
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
  perKwhFrom: 'bill' | 'submeters' // 'submeters' = the bill has no kWh, so the sub-meter total stands in: an estimate
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

/** Units in a fixed order (by name), so colours and columns don't swap when a new reading arrives. */
export const unitsOf = (readings: Reading[]) => [...new Set(readings.map(r => r.unit))].sort()

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
      return { unit, kwh: a == null || b == null || b < a ? null : r2(b - a) } // a meter that goes backwards is left out, not subtracted
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
      perKwhFrom: bill.kwh ? 'bill' : 'submeters',
      high: (basis ?? 0) > HIGH_USE_KWH,
    }
  })
}

/** TNB's cost per kWh over [from, to]: the cycles it overlaps, weighted by days. Null if the bills cover under half of it;
 *  `estimated` when it leans on a bill without kWh or the bills cover under 95% of the days. */
function costPerKwh(cs: Cycle[], from: string, to: string): { value: number; estimated: boolean } | null {
  const span = daysBetween(from, to)
  if (span <= 0) return null
  let days = 0
  let weighted = 0
  let fromSubmeters = false
  for (const c of cs) {
    if (c.perKwh == null) continue
    const o = Math.min(daysBetween(from, c.bill.bill_date), span) - Math.max(daysBetween(from, c.start), 0)
    if (o > 0) {
      days += o
      weighted += o * c.perKwh
      if (c.perKwhFrom === 'submeters') fromSubmeters = true
    }
  }
  return days / span >= 0.5 ? { value: r4(weighted / days), estimated: fromSubmeters || days / span < 0.95 } : null
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
      const cp = costPerKwh(cs, a.read_on, b.read_on)
      const cpk = cp?.value ?? null
      const flags: string[] = []
      const vacant = kindOf(b) === 'move_in'
      if (kwh < 0) flags.push('Meter went backwards')
      if (days > LONG_GAP_DAYS && !vacant) flags.push(`${days} days since the last reading`)
      if (vacant) {
        out.push({ id: b.id, unit, tenant: null, paidOn: null, kind: 'move_in', vacant, startReading: a.reading, from: a.read_on, to: b.read_on, days, kwh, perDay, rate: null, charged: null, legacy: b.legacy, costPerKwh: cpk, costEstimated: cp?.estimated ?? false, cost: cpk != null ? r2(kwh * cpk) : null, buffer: null, flags })
        continue
      }
      if (seen.length >= 3) {
        const m = median(seen)
        if (m > 0 && Math.abs(perDay - m) / m > 0.4) flags.push(`${perDay > m ? 'Usage up' : 'Usage down'} ${Math.round((Math.abs(perDay - m) / m) * 100)}% on this unit's usual — check the reading`)
      }
      if (kwh >= 0) seen.push(perDay)
      const charged = b.rate != null ? r2(kwh * b.rate) : null
      const cost = cpk != null ? r2(kwh * cpk) : null
      out.push({ id: b.id, unit, tenant: b.tenant_name ?? null, paidOn: b.paid_on ?? null, kind: kindOf(b), vacant, startReading: a.reading, from: a.read_on, to: b.read_on, days, kwh, perDay, rate: b.rate, charged, legacy: b.legacy, costPerKwh: cpk, costEstimated: cp?.estimated ?? false, cost, buffer: charged != null && cost != null ? r2(charged - cost) : null, flags })
    }
  }
  return out.sort((x, y) => y.to.localeCompare(x.to) || x.unit.localeCompare(y.unit))
}

/** Charged against cost over the segments that have both, split into the old rates and the flat rate. */
export function buffers(segs: Segment[]) {
  const sum = (rows: Segment[]) => {
    const used = rows.filter(s => s.kwh >= 0 && s.charged != null && s.cost != null)
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

/** The date a year before `iso`. */
export const yearBefore = (iso: string) => `${+iso.slice(0, 4) - 1}${iso.slice(4)}`

export type TenantBilling = {
  unit: string
  tenant: string | null
  current: boolean // the unit's latest reading is billed to this tenant
  segments: Segment[] // newest first
  from: string
  to: string
  kwh: number
  billed: number // every charge with a rate, whole history
  billed12: number // charges for the days in the last 12 months (a segment straddling the cut-off counts only its days inside)
  perDay: number | null // kWh a day over the last 12 months of readings
  unrated: number // segments with no rate: their kWh are not in `billed`
  owed: number // charges not marked paid yet
  owedCount: number
  start: { date: string; reading: number } // where this tenant's billing starts: their move-in, or the reading before their first bill
  movedOut: { date: string; reading: number } | null // their final reading, when one is marked
}

/** The part of a segment that falls on or after `since`, as a fraction of its days. */
const inside = (s: Segment, since: string) => (s.days <= 0 || s.to <= since ? 0 : s.from >= since ? 1 : daysBetween(since, s.to) / s.days)

/** What each tenant of each unit has been billed: one row per unit + tenant, the current tenant of each unit first. */
export function billing(all: Segment[], today: string): TenantBilling[] {
  const since = yearBefore(today)
  const segs = all.filter(s => !s.vacant)
  // A unit's tenant now: whoever its latest reading is billed to — nobody after a move-out, the newcomer after a move-in.
  const last = new Map<string, Segment>()
  for (const s of all) if (!last.has(s.unit) || s.to > last.get(s.unit)!.to) last.set(s.unit, s)
  const groups = new Map<string, Segment[]>()
  for (const s of segs) {
    const key = `${s.unit}\u0000${s.tenant ?? ''}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const latest = new Map<string, Segment>() // per unit
  for (const s of segs) if (!latest.has(s.unit) || s.to > latest.get(s.unit)!.to) latest.set(s.unit, s)
  const units = [...new Set(segs.map(s => s.unit))].sort()
  return [...groups.values()]
    .map(rows => {
      const sorted = [...rows].sort((a, b) => b.to.localeCompare(a.to))
      const ok = sorted.filter(s => s.kwh >= 0)
      const recent = ok.filter(s => inside(s, since) > 0)
      const days = recent.reduce((t, s) => t + s.days * inside(s, since), 0)
      return {
        unit: sorted[0].unit,
        tenant: sorted[0].tenant,
        current: latest.get(sorted[0].unit)?.tenant === sorted[0].tenant && last.get(sorted[0].unit) === latest.get(sorted[0].unit) && sorted[0].kind !== 'move_out',
        segments: sorted,
        from: sorted[sorted.length - 1].from,
        to: sorted[0].to,
        kwh: r2(ok.reduce((t, s) => t + s.kwh, 0)),
        billed: r2(ok.reduce((t, s) => t + (s.charged ?? 0), 0)),
        billed12: r2(recent.reduce((t, s) => t + (s.charged ?? 0) * inside(s, since), 0)),
        perDay: days > 0 ? recent.reduce((t, s) => t + s.kwh * inside(s, since), 0) / days : null,
        unrated: ok.filter(s => s.charged == null).length,
        owed: r2(ok.reduce((t, s) => t + (s.paidOn ? 0 : (s.charged ?? 0)), 0)),
        owedCount: ok.filter(s => !s.paidOn && s.charged != null && s.charged > 0).length,
        start: { date: sorted[sorted.length - 1].from, reading: sorted[sorted.length - 1].startReading },
        movedOut: sorted[0].kind === 'move_out' ? { date: sorted[0].to, reading: sorted[0].startReading + sorted[0].kwh } : null,
      }
    })
    .sort((a, b) => units.indexOf(a.unit) - units.indexOf(b.unit) || Number(b.current) - Number(a.current) || b.to.localeCompare(a.to))
}

/** Each unit's share of the electricity over the last 12 months of readings (kWh a day, so uneven gaps don't skew it). */
export function usageShare(segs: Segment[], today: string): { unit: string; perDay: number; share: number }[] {
  const since = yearBefore(today)
  const per = [...new Set(segs.map(s => s.unit))].sort().map(unit => {
    const rows = segs.filter(s => s.unit === unit && s.kwh >= 0 && inside(s, since) > 0)
    const days = rows.reduce((t, s) => t + s.days * inside(s, since), 0)
    return { unit, perDay: days > 0 ? rows.reduce((t, s) => t + s.kwh * inside(s, since), 0) / days : 0 }
  })
  const total = per.reduce((t, u) => t + u.perDay, 0)
  return per.map(u => ({ ...u, share: total > 0 ? u.perDay / total : 0 }))
}

/** Per unit, how its latest reading leaves it: a tenant who moved in and has no bill yet, or empty after a move-out. */
export function unitState(readings: Reading[]): Map<string, { kind: ReadingKind; tenant: string | null; date: string; reading: number }> {
  const out = new Map<string, { kind: ReadingKind; tenant: string | null; date: string; reading: number }>()
  for (const r of [...readings].sort(byDate)) out.set(r.unit, { kind: kindOf(r), tenant: r.tenant_name, date: r.read_on, reading: r.reading })
  return out
}
