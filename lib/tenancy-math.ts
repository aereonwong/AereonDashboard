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
  deposit: number | null
  tenant_name: string | null
  notes: string | null
}

export type CostKind = 'maintenance_fee' | 'repair' | 'agent_fee' | 'other'
export type Cost = {
  id: number
  property_id: string
  cost_date: string
  kind: CostKind
  amount: number
  description: string | null
  vendor: string | null
}

export const KIND_LABEL: Record<CostKind, string> = { maintenance_fee: 'Maintenance fee', repair: 'Repair', agent_fee: 'Agent fee', other: 'Other' }

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
  return { year: sum(inYear), all: sum(costs), repairsYear: sum(inYear.filter(c => c.kind === 'repair')), feesYear: sum(inYear.filter(c => c.kind === 'maintenance_fee')), agentYear: sum(inYear.filter(c => c.kind === 'agent_fee')) }
}
