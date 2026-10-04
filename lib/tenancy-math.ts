// 👉 Tenancy maths for the Property tab. Pure functions, no imports, so the page and the import
// script can share them. Dates are YYYY-MM-DD strings; "today" is passed in (Malaysia's date).
//
//   current term     = the term that contains today, else the latest one
//   rent due so far  = one month's rent on each monthly anniversary of the start date, from the
//                      start up to today and before the term ends (rent paid in advance).
//                      Terms with no rent entered are left out and counted in `unpriced`.
//   covers           = rent ÷ the loan instalment

export type Tenancy = {
  id: number
  property_id: string
  start_date: string
  end_date: string
  monthly_rent: number | null
  advance_rent: number | null
  security_deposit: number | null
  utility_deposit: number | null
  access_card_deposit: number | null
  deposit_refunded: number | null
  tenant_name: string | null
  notes: string | null
}

export type CostKind = 'maintenance_fee' | 'repair' | 'agent_fee' | 'stamping_fee' | 'other'
export type Cost = {
  id: number
  property_id: string
  cost_date: string
  kind: CostKind
  amount: number
  description: string | null
  vendor: string | null
  tenant_name: string | null
  recovered_from_deposit: boolean // deducted from the tenant's deposit, so not a cost to the owner
}

export const KIND_LABEL: Record<CostKind, string> = { maintenance_fee: 'Maintenance fee', repair: 'Repair', agent_fee: 'Agent fee', stamping_fee: 'Stamping fee', other: 'Other' }

const day = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))

/** The date `n` months after `iso`, clamped to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10)
  const t = new Date(Date.UTC(y, m + n, 1))
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(d, last))).toISOString().slice(0, 10)
}

export const daysBetween = (from: string, to: string) => Math.round((day(to) - day(from)) / 86_400_000)

export function currentTerm(terms: Tenancy[], today: string): Tenancy | null {
  const sorted = [...terms].sort((a, b) => a.start_date.localeCompare(b.start_date))
  return sorted.find(t => t.start_date <= today && today <= t.end_date) ?? sorted.filter(t => t.start_date <= today).at(-1) ?? sorted[0] ?? null
}

/** How many rent payments have fallen due in one term as of `today`. */
export function paymentsDue(t: Tenancy, today: string): number {
  let n = 0
  for (let k = 0; ; k++) {
    const due = addMonths(t.start_date, k)
    if (due > today || due > t.end_date) return n
    n++
  }
}

export function rentSoFar(terms: Tenancy[], today: string): { total: number; payments: number; unpriced: number } {
  let total = 0, payments = 0, unpriced = 0
  for (const t of terms) {
    const n = paymentsDue(t, today)
    if (t.monthly_rent == null) unpriced += n
    else {
      total += n * t.monthly_rent
      payments += n
    }
  }
  return { total: Math.round(total * 100) / 100, payments, unpriced }
}

/** The next rent due date on or after today, within the current term; null once the term is over. */
export function nextRentDue(t: Tenancy, today: string): string | null {
  for (let k = 0; ; k++) {
    const due = addMonths(t.start_date, k)
    if (due > t.end_date) return null
    if (due >= today) return due
  }
}

/** What the property cost the owner: bills deducted from a tenant's deposit are not counted. */
export function costTotals(all: Cost[], year: string) {
  const costs = all.filter(c => !c.recovered_from_deposit)
  const inYear = costs.filter(c => c.cost_date.startsWith(year))
  const sum = (cs: Cost[]) => Math.round(cs.reduce((a, c) => a + c.amount, 0) * 100) / 100
  return { year: sum(inYear), all: sum(costs), repairsYear: sum(inYear.filter(c => c.kind === 'repair')), feesYear: sum(inYear.filter(c => c.kind === 'maintenance_fee')), signingYear: sum(inYear.filter(c => c.kind === 'agent_fee' || c.kind === 'stamping_fee')) }
}

// ── Tenants: terms grouped under one name, so an extension counts with the tenancy it extends ──

export type TenantGroup = {
  key: string
  name: string | null // null = no name entered yet
  terms: Tenancy[] // oldest first: the first is the original term, the rest are extensions
  start: string
  end: string
  status: 'current' | 'upcoming' | 'ended'
}

const same = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase()

/** Newest tenancy first. Terms with the same tenant name form one group; an unnamed term stands alone. */
export function groupTenants(terms: Tenancy[], today: string): TenantGroup[] {
  const groups: TenantGroup[] = []
  for (const t of [...terms].sort((a, b) => a.start_date.localeCompare(b.start_date))) {
    const g = t.tenant_name?.trim() ? groups.find(x => x.name && same(x.name, t.tenant_name)) : undefined
    if (g) g.terms.push(t)
    else groups.push({ key: t.tenant_name?.trim() ? t.tenant_name.trim().toLowerCase() : `term-${t.id}`, name: t.tenant_name?.trim() || null, terms: [t], start: t.start_date, end: t.end_date, status: 'ended' })
  }
  for (const g of groups) {
    g.start = g.terms[0].start_date
    g.end = g.terms.reduce((e, t) => (t.end_date > e ? t.end_date : e), g.terms[0].end_date)
    g.status = g.start > today ? 'upcoming' : g.end < today ? 'ended' : 'current'
  }
  return groups.sort((a, b) => b.start.localeCompare(a.start))
}

/** "3 years", "18 months" — the length of a start–end span (end is the last day). */
export function spanLabel(start: string, end: string): string {
  const months = Math.round(daysBetween(start, end) / 30.4375)
  return months % 12 === 0 ? `${months / 12} year${months === 12 ? '' : 's'}` : `${months} months`
}

export const DEPOSIT_FIELDS = [
  { key: 'advance_rent', label: 'Advance rental' },
  { key: 'security_deposit', label: 'Security deposit' },
  { key: 'utility_deposit', label: 'Utility deposit' },
  { key: 'access_card_deposit', label: 'Access cards' },
] as const

const r2 = (n: number) => Math.round(n * 100) / 100

/** What the tenant handed over at signing, and the part of it that is refundable (everything but the advance rent). */
export function depositsOf(terms: Tenancy[]) {
  const sum = (k: (typeof DEPOSIT_FIELDS)[number]['key']) => r2(terms.reduce((a, t) => a + (t[k] ?? 0), 0))
  const parts = DEPOSIT_FIELDS.map(f => ({ ...f, amount: sum(f.key) }))
  const total = r2(parts.reduce((a, p) => a + p.amount, 0))
  const refunded = terms.some(t => t.deposit_refunded != null) ? r2(terms.reduce((a, t) => a + (t.deposit_refunded ?? 0), 0)) : null
  return { parts, total, refundable: r2(total - sum('advance_rent')), refunded }
}

/** One tenant's score so far: rent that has fallen due, less the bills you bore for them. Bills deducted from their deposit are recovered, so they are not a cost. */
export function tenantStats(g: TenantGroup, costs: Cost[], today: string) {
  const rent = rentSoFar(g.terms, today)
  const mine = g.name ? costs.filter(c => same(c.tenant_name, g.name)) : []
  const tagged = mine.filter(c => !c.recovered_from_deposit)
  const recovered = mine.filter(c => c.recovered_from_deposit)
  const taggedTotal = r2(tagged.reduce((a, c) => a + c.amount, 0))
  const recoveredTotal = r2(recovered.reduce((a, c) => a + c.amount, 0))
  // If the tenant stays to the very end: every payment of every term, less the same tagged bills.
  const full = rentSoFar(g.terms, g.end)
  const fullNet = r2(full.total - taggedTotal)
  const estimate = { payments: full.payments, unpriced: full.unpriced, rent: full.total, net: fullNet, perMonth: full.payments ? r2(fullNet / full.payments) : null }
  const deposits = depositsOf(g.terms)
  // The deposit settlement: what is held, less the bills deducted, is due back; anything paid back less than that stays with the owner.
  const dueBack = r2(deposits.refundable - recoveredTotal)
  const settlement = { recoveredTotal, recoveredCount: recovered.length, dueBack, refunded: deposits.refunded, kept: deposits.refunded == null ? null : r2(dueBack - deposits.refunded) }
  return { rent, taggedTotal, taggedCount: tagged.length, net: r2(rent.total - taggedTotal), estimate, deposits, settlement }
}

// ── Cash result: rent less what it costs you to hold the property while they live there ──

export type CashFrame = { payments: number; unpriced: number; rent: number; bills: number; maintenance: number; loan: number; result: number; perMonth: number | null }

/** The rent running under every tenant of the property on a date: a term counts from its start to its last day. */
const rentOn = (groups: TenantGroup[], date: string) => groups.reduce((a, g) => a + g.terms.filter(t => t.start_date <= date && date <= t.end_date).reduce((b, t) => b + (t.monthly_rent ?? 0), 0), 0)

/**
 * The tenant's whole cash picture, two ways: so far (payments already due) and the whole tenancy
 * (every payment, assuming they all arrive). Per payment month it takes the rent, the loan instalment
 * and the property's maintenance fee for that month; a month with no figure of its own uses the
 * nearest one on record (the latest, for months still to come). Bills you bore for the tenant count once.
 * A dual-key property has two tenants at once under one loan and one maintenance fee: pass every group in `all`
 * and each tenant carries the share of those two that their rent is of the rents paid that month (alone = all of it).
 * The loan instalment includes principal, which is equity you keep, so this is cash, not profit.
 */
export function cashResult(g: TenantGroup, costs: Cost[], loanMonths: { month: string; instalment: number | null }[], today: string, all: TenantGroup[] = [g]): { soFar: CashFrame; whole: CashFrame } {
  const near = (m: Map<string, number>, key: string) => {
    if (m.has(key)) return m.get(key)!
    const keys = [...m.keys()].sort()
    if (!keys.length) return 0
    return m.get([...keys].reverse().find(k => k < key) ?? keys[0])!
  }
  const inst = new Map<string, number>()
  for (const l of loanMonths) if (l.instalment != null) inst.set(l.month.slice(0, 7), l.instalment)
  const maint = new Map<string, number>()
  for (const c of costs) if (c.kind === 'maintenance_fee' && !c.recovered_from_deposit) maint.set(c.cost_date.slice(0, 7), (maint.get(c.cost_date.slice(0, 7)) ?? 0) + c.amount)
  const mine = g.name ? costs.filter(c => same(c.tenant_name, g.name) && !c.recovered_from_deposit) : []

  const frame = (upTo: string): CashFrame => {
    let payments = 0, unpriced = 0, rent = 0, maintenance = 0, loan = 0
    for (const t of g.terms)
      for (let k = 0; ; k++) {
        const due = addMonths(t.start_date, k)
        if (due > t.end_date || due > upTo) break
        if (t.monthly_rent == null) {
          unpriced++
          continue
        }
        payments++
        rent += t.monthly_rent
        const share = t.monthly_rent / (rentOn(all, due) || t.monthly_rent)
        maintenance += near(maint, due.slice(0, 7)) * share
        loan += near(inst, due.slice(0, 7)) * share
      }
    const bills = r2(mine.filter(c => c.cost_date <= upTo || upTo === g.end).reduce((a, c) => a + c.amount, 0))
    const result = r2(rent - bills - maintenance - loan)
    return { payments, unpriced, rent: r2(rent), bills, maintenance: r2(maintenance), loan: r2(loan), result, perMonth: payments ? r2(result / payments) : null }
  }
  return { soFar: frame(today), whole: frame(g.end) }
}

/**
 * The property's estimated net per month across every tenant running now, before and after the loan.
 * Each tenant's own monthly figure is added up (their tenancies differ in length); the loan and the
 * maintenance fee are split by rent, so they are counted once.
 */
export function propertyMonthly(groups: TenantGroup[], costs: Cost[], loanMonths: { month: string; instalment: number | null }[], today: string): { beforeLoan: number | null; afterLoan: number | null } {
  const frames = groups.filter(g => g.status === 'current').map(g => cashResult(g, costs, loanMonths, today, groups).whole).filter(f => f.payments)
  if (!frames.length) return { beforeLoan: null, afterLoan: null }
  return { beforeLoan: r2(frames.reduce((a, f) => a + (f.rent - f.bills - f.maintenance) / f.payments, 0)), afterLoan: r2(frames.reduce((a, f) => a + f.result / f.payments, 0)) }
}
