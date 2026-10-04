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

export function costTotals(costs: Cost[], year: string) {
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
  return { parts, total, refundable: r2(total - sum('advance_rent')) }
}

/** One tenant's score so far: rent that has fallen due, less the bills tagged to them. */
export function tenantStats(g: TenantGroup, costs: Cost[], today: string) {
  const rent = rentSoFar(g.terms, today)
  const tagged = g.name ? costs.filter(c => same(c.tenant_name, g.name)) : []
  const taggedTotal = r2(tagged.reduce((a, c) => a + c.amount, 0))
  // If the tenant stays to the very end: every payment of every term, less the same tagged bills.
  const full = rentSoFar(g.terms, g.end)
  const fullNet = r2(full.total - taggedTotal)
  const estimate = { payments: full.payments, unpriced: full.unpriced, rent: full.total, net: fullNet, perMonth: full.payments ? r2(fullNet / full.payments) : null }
  return { rent, taggedTotal, taggedCount: tagged.length, net: r2(rent.total - taggedTotal), estimate, deposits: depositsOf(g.terms) }
}
