// 👉 Property loan maths: the rules of the old "Interest Rate" Numbers sheet, in one place.
// Pure functions, no imports, so scripts/property-import.mjs runs the same code as the page.
//
//   principal          = opening − outstanding
//   interest           = statement figure, else instalment − principal
//   full-rate interest = opening × rate ÷ 365, summed day by day over the period the row covers
//                        (what the month would have cost with no cash in the flexi account)
//   flexi saving       = full-rate interest − interest
//
// A row dated month M pays the interest for the period that ends on M's instalment day: from
// cycle_day of month M−1 up to the day before cycle_day of M. The bank statements prove this to the
// sen (Feb 2026's 28 days give exactly 4.10%). The old sheet used a flat 30 days.
//
// The rate is never typed: it is the bank's published BR (or SBR) on each day of that period,
// plus the loan's fixed spread. A cut mid-period is weighted by the days on each side.

export type Loan = {
  id: string
  name: string
  location: string | null
  bank: string
  loan_type: string | null
  rate_basis: 'BR' | 'SBR'
  spread: number
  cycle_day: number
  loan_amount: number | null
  tenure_months: number | null
  first_month: string
  notes: string | null
  sort: number
}

export type LoanMonthStatus = 'normal' | 'moratorium' | 'interest_only' | 'pending' | 'missing'
export type LoanMonthQuality = 'statement' | 'derived' | 'estimated' | 'unchecked'

export type LoanMonthRow = {
  property_id: string
  month: string // YYYY-MM-01
  opening_balance: number | null
  outstanding_balance: number | null
  instalment: number | null
  interest_charged: number | null
  status: LoanMonthStatus
  quality: LoanMonthQuality
  note: string | null
}

export type BankRate = { bank: string; effective_date: string; base_rate: number | null; sbr: number | null; source: string | null }

export type DataIssue = {
  id: number
  property_id: string
  month: string | null
  month_to: string | null
  field: string | null
  current_value: string | null
  suggested_value: string | null
  severity: 'high' | 'medium' | 'low'
  explanation: string
  status: 'open' | 'fixed' | 'ignored'
  resolution: string | null
}

export type LoanMonth = LoanMonthRow & {
  opening: number | null // opening_balance, or last month's outstanding when blank
  added: number | null // what the bank added on top of last month's outstanding (e.g. interest after a payment holiday)
  periodFrom: string
  periodTo: string // inclusive
  days: number
  baseRate: number | null // reference rate on the last day of the period
  rate: number | null // day-weighted effective rate, % a year
  principal: number | null
  interest: number | null
  fullRate: number | null
  saved: number | null
  flexiCash: number | null // cash the bank must have offset to charge this interest
}

const r2 = (n: number) => Math.round(n * 100) / 100
const DAY = 86_400_000
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)

/** The days a row pays interest for: cycle_day of the previous month up to the day before cycle_day of this month. */
export function period(month: string, cycleDay: number): { from: string; to: string; days: number } {
  const [y, m] = month.split('-').map(Number)
  const start = Date.UTC(y, m - 2, cycleDay)
  const end = Date.UTC(y, m - 1, cycleDay)
  return { from: ymd(start), to: ymd(end - DAY), days: Math.round((end - start) / DAY) }
}

/** The bank's reference rate in force on a date (ISO), or null before the first known change. */
export function referenceRate(rates: BankRate[], bank: string, basis: 'BR' | 'SBR', date: string): number | null {
  let hit: BankRate | null = null
  for (const r of rates) {
    if (r.bank !== bank || r.effective_date > date) continue
    if ((basis === 'BR' ? r.base_rate : r.sbr) == null) continue
    if (!hit || r.effective_date > hit.effective_date) hit = r
  }
  return hit ? (basis === 'BR' ? hit.base_rate : hit.sbr) : null
}

/** Sum of the daily rate (as a fraction ÷ 365) over a period: multiply by a balance for that period's interest. */
function dailyFactor(rates: BankRate[], loan: Loan, from: string, days: number): number | null {
  let sum = 0
  const t0 = Date.parse(`${from}T00:00:00Z`)
  for (let i = 0; i < days; i++) {
    const ref = referenceRate(rates, loan.bank, loan.rate_basis, ymd(t0 + i * DAY))
    if (ref == null) return null
    sum += (ref + loan.spread) / 100 / 365
  }
  return sum
}

/** Every row of one loan, worked out like the sheet. Rows must belong to `loan`. */
export function computeLoan(loan: Loan, rows: LoanMonthRow[], rates: BankRate[]): LoanMonth[] {
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month))
  const out: LoanMonth[] = []
  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]
    const prev = sorted[i - 1]
    const p = period(m.month, loan.cycle_day)
    const factor = dailyFactor(rates, loan, p.from, p.days)
    const baseRate = referenceRate(rates, loan.bank, loan.rate_basis, p.to)
    const opening = m.opening_balance ?? (prev?.outstanding_balance ?? null)
    const added =
      m.opening_balance != null && prev?.outstanding_balance != null && m.status !== 'interest_only'
        ? r2(m.opening_balance - prev.outstanding_balance) || null
        : null
    const principal = opening != null && m.outstanding_balance != null ? r2(opening - m.outstanding_balance) : null

    let interest: number | null = null
    if (m.interest_charged != null) interest = m.interest_charged
    else if (m.status === 'moratorium') interest = 0
    else if (principal != null && m.instalment != null) interest = r2(m.instalment - principal)

    const live = m.status === 'normal' || m.status === 'interest_only'
    const fullRate = m.status === 'moratorium' ? 0 : opening != null && factor != null && live ? r2(opening * factor) : null
    const saved = m.status === 'normal' && fullRate != null && interest != null ? r2(fullRate - interest) : null
    const flexiCash =
      m.status === 'normal' && factor && interest != null && opening != null ? Math.max(0, r2(opening - interest / factor)) : null

    out.push({
      ...m,
      opening,
      added,
      periodFrom: p.from,
      periodTo: p.to,
      days: p.days,
      baseRate,
      rate: factor == null ? null : r2((factor * 365 * 100) / p.days),
      principal,
      interest,
      fullRate,
      saved,
      flexiCash,
    })
  }
  return out
}

export type Warning = { property_id: string; month: string; msg: string }

/** Automatic checks, month against month. The hand-written findings are property_data_issue. */
export function validate(months: LoanMonth[]): Warning[] {
  const out: Warning[] = []
  for (let i = 0; i < months.length; i++) {
    const m = months[i]
    const w = (msg: string) => out.push({ property_id: m.property_id, month: m.month, msg })
    if (m.status === 'pending' || m.status === 'missing') continue
    // A typed opening balance means the bank changed it on purpose — shown as `added`, not warned —
    // unless it went DOWN, which no bank does to a loan without a payment.
    if (m.added != null && m.added < 0) w(`Opening balance is ${m.added.toFixed(2)} below last month's outstanding`)
    if (m.status === 'normal' && m.principal != null && m.principal < 0) w(`Principal is negative (${m.principal.toFixed(2)})`)
    if (m.interest != null && m.interest < 0) w(`Interest is negative (${m.interest.toFixed(2)})`)
    if (
      m.status === 'normal' && m.interest_charged != null && m.instalment != null && m.principal != null &&
      Math.abs(m.instalment - m.principal - m.interest_charged) >= 0.01
    )
      w(`Statement interest ${m.interest_charged.toFixed(2)} ≠ instalment − principal ${(m.instalment - m.principal).toFixed(2)}`)
    if (m.status === 'normal' && m.fullRate != null && m.interest != null && m.interest > m.fullRate + 1)
      w(`Interest ${m.interest.toFixed(2)} is above the full-rate amount ${m.fullRate.toFixed(2)}`)
  }
  return out
}

/** The month whose outstanding balance should be typed next: the first pending/missing row after the last filled one. */
export function nextToFill(months: LoanMonth[]): LoanMonth | null {
  const lastFilled = [...months].reverse().find(m => m.outstanding_balance != null)
  return months.find(m => (m.status === 'pending' || m.outstanding_balance == null) && (!lastFilled || m.month > lastFilled.month)) ?? null
}

/** First of the month after `month` (YYYY-MM-01). */
export function addMonth(month: string, n = 1): string {
  const [y, m] = month.split('-').map(Number)
  return ymd(Date.UTC(y, m - 1 + n, 1))
}
