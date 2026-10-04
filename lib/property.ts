import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { demoProperty } from './demo-data'
import type { Cost, Tenancy } from './tenancy-math'
import { computeLoan, validate, type BankRate, type DataIssue, type Loan, type LoanMonth, type LoanMonthRow, type Warning } from './property-math'

// 👉 Property section (/property, /property/loans, /property/tenancy, /property/costs): the home loans that used to live in the "Interest Rate" Numbers sheet.
// Four tables from supabase/property.sql; every figure on the page is worked out by
// lib/property-math.ts from the raw rows, never stored.

export type LoanView = { loan: Loan; months: LoanMonth[]; warnings: Warning[]; issues: DataIssue[]; tenancies: Tenancy[]; costs: Cost[] }
// tenancyReady is false until supabase/tenancy.sql has been run; the loans still work without it.
export type PropertyRead = { ready: false } | { ready: true; loans: LoanView[]; rates: BankRate[]; demo: boolean; tenancyReady: boolean }

const num = (v: unknown) => (v == null ? null : Number(v)) // numeric columns arrive as strings

export async function readProperty(): Promise<PropertyRead> {
  const demo = await demoMode()
  if (demo) return { ready: true, demo, tenancyReady: true, ...build(demoProperty()) }
  if (!supabaseConfigured) return { ready: false }

  const [loans, months, rates, issues, tenancies, costs, upgrade1, upgrade2] = await Promise.all([
    supabase.from('property_loan').select('*').order('sort'),
    supabase.from('property_loan_month').select('*').order('month').limit(5000),
    supabase.from('property_bank_rate').select('*').order('effective_date'),
    supabase.from('property_data_issue').select('*').order('id'),
    supabase.from('property_tenancy').select('*').order('start_date'),
    supabase.from('property_cost').select('*').order('cost_date', { ascending: false }).limit(2000),
    // New columns from the second version of supabase/tenancy.sql: if they are missing the page asks for the SQL again.
    supabase.from('property_tenancy').select('advance_rent').limit(1),
    supabase.from('property_cost').select('tenant_name').limit(1),
  ])
  // The tables don't exist until supabase/property.sql has been run once.
  if (loans.error || months.error || rates.error || issues.error) return { ready: false }

  const tenancyReady = !tenancies.error && !costs.error && !upgrade1.error && !upgrade2.error

  return {
    ready: true,
    demo,
    tenancyReady,
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
      tenancies: tenancies.error ? [] : (tenancies.data ?? []).map(t => ({ ...t, monthly_rent: num(t.monthly_rent), advance_rent: num(t.advance_rent), security_deposit: num(t.security_deposit), utility_deposit: num(t.utility_deposit), access_card_deposit: num(t.access_card_deposit) }) as Tenancy),
      costs: costs.error ? [] : (costs.data ?? []).map(c => ({ ...c, amount: Number(c.amount) }) as Cost),
    }),
  }
}

function build(d: { loans: Loan[]; months: LoanMonthRow[]; rates: BankRate[]; issues: DataIssue[]; tenancies: Tenancy[]; costs: Cost[] }) {
  return {
    rates: d.rates,
    loans: d.loans.map(loan => {
      const months = computeLoan(loan, d.months.filter(m => m.property_id === loan.id), d.rates)
      return { loan, months, warnings: validate(months), issues: d.issues.filter(i => i.property_id === loan.id),
        tenancies: d.tenancies.filter(t => t.property_id === loan.id), costs: d.costs.filter(c => c.property_id === loan.id) }
    }),
  }
}
