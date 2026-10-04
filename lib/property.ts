import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { demoProperty } from './demo-data'
import { computeLoan, validate, type BankRate, type DataIssue, type Loan, type LoanMonth, type LoanMonthRow, type Warning } from './property-math'

// 👉 Property tab: the home loans that used to live in the "Interest Rate" Numbers sheet.
// Four tables from supabase/property.sql; every figure on the page is worked out by
// lib/property-math.ts from the raw rows, never stored.

export type LoanView = { loan: Loan; months: LoanMonth[]; warnings: Warning[]; issues: DataIssue[] }
export type PropertyRead = { ready: false } | { ready: true; loans: LoanView[]; rates: BankRate[]; demo: boolean }

const num = (v: unknown) => (v == null ? null : Number(v)) // numeric columns arrive as strings

export async function readProperty(): Promise<PropertyRead> {
  const demo = await demoMode()
  if (demo) return { ready: true, demo, ...build(demoProperty()) }
  if (!supabaseConfigured) return { ready: false }

  const [loans, months, rates, issues] = await Promise.all([
    supabase.from('property_loan').select('*').order('sort'),
    supabase.from('property_loan_month').select('*').order('month').limit(5000),
    supabase.from('property_bank_rate').select('*').order('effective_date'),
    supabase.from('property_data_issue').select('*').order('id'),
  ])
  // The tables don't exist until supabase/property.sql has been run once.
  if (loans.error || months.error || rates.error || issues.error) return { ready: false }

  return {
    ready: true,
    demo,
    ...build({
      loans: (loans.data ?? []).map(l => ({ ...l, spread: Number(l.spread), loan_amount: num(l.loan_amount) }) as Loan),
      months: (months.data ?? []).map(m => ({
        ...m,
        opening_balance: num(m.opening_balance),
        outstanding_balance: num(m.outstanding_balance),
        instalment: num(m.instalment),
        interest_charged: num(m.interest_charged),
      }) as LoanMonthRow),
      rates: (rates.data ?? []).map(r => ({ ...r, base_rate: num(r.base_rate), sbr: num(r.sbr) }) as BankRate),
      issues: (issues.data ?? []) as DataIssue[],
    }),
  }
}

function build(d: { loans: Loan[]; months: LoanMonthRow[]; rates: BankRate[]; issues: DataIssue[] }) {
  return {
    rates: d.rates,
    loans: d.loans.map(loan => {
      const months = computeLoan(loan, d.months.filter(m => m.property_id === loan.id), d.rates)
      return { loan, months, warnings: validate(months), issues: d.issues.filter(i => i.property_id === loan.id) }
    }),
  }
}
