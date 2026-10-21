import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { moneyFactor, moneyHidden, scrubAmounts, scrubFields, disguiseFields } from './privacy'
import { DOC_TYPES, isKind, type DocType, type Expense } from './expenses-math'
import { todayISO } from './today'

// 👉 Expenses (/expenses, /expenses/all): what the company spends, one row per payment, from
// supabase/expenses.sql. The page asks for that SQL (ready: false) until the table exists.
// Amounts follow the privacy rule: while hidden every money column is disguised BEFORE any maths.

export type ExpensesRead = { ready: false } | { ready: true; rows: Expense[]; demo: boolean }

const num = (v: unknown) => (v == null ? null : Number(v)) // numeric columns arrive as strings

export async function readExpenses(): Promise<ExpensesRead> {
  if (await demoMode()) return { ready: true, demo: true, rows: await hide(demoExpenses()) }
  if (!supabaseConfigured) return { ready: false }
  // Read in pages of 1,000 (Supabase's cap per request) so a long history is never cut off silently.
  const all: Record<string, any>[] = []
  for (let from = 0; from < 50_000; from += 1000) {
    const { data, error } = await supabase.from('expense').select('*').order('spent_on', { ascending: false }).order('id', { ascending: false }).range(from, from + 999)
    if (error) return { ready: false } // the table does not exist until supabase/expenses.sql has been run once
    all.push(...data)
    if (data.length < 1000) break
  }
  return { ready: true, demo: false, rows: await hide(all.map(toExpense)) }
}

export function toExpense(r: Record<string, any>): Expense {
  return {
    id: Number(r.id),
    spent_on: String(r.spent_on).slice(0, 10),
    kind: isKind(r.kind) ? r.kind : 'other',
    vendor: String(r.vendor ?? ''),
    description: r.description ?? null,
    amount: num(r.amount),
    amount_estimated: !!r.amount_estimated,
    doc_type: (DOC_TYPES as readonly string[]).includes(r.doc_type) ? (r.doc_type as DocType) : 'Receipt',
    currency: r.currency || 'MYR',
    original_amount: num(r.original_amount),
    paid_with: r.paid_with ?? null,
    reference: r.reference ?? null,
    trip: r.trip ?? null,
    recurring: r.recurring === 'monthly' || r.recurring === 'yearly' ? r.recurring : null,
    source: r.source || 'manual',
    source_ref: r.source_ref ?? null,
    receipt: r.receipt ?? null,
    notes: r.notes ?? null,
  }
}

async function hide(rows: Expense[]): Promise<Expense[]> {
  if (!(await moneyHidden())) return rows
  const k = await moneyFactor()
  // A receipt's file name carries the real amount ("… - RM 531.16.pdf") and source_ref is only for the import scripts:
  // neither may reach the browser while amounts are hidden.
  const bare = rows.map(r => ({
    ...r,
    source_ref: null,
    receipt: r.receipt ? { ...r.receipt, name: r.receipt.name ? scrubAmounts(r.receipt.name) ?? undefined : undefined, error: r.receipt.error ? scrubAmounts(r.receipt.error) ?? undefined : undefined } : null,
  }))
  return scrubFields(disguiseFields(bare, ['amount', 'original_amount'], k), ['description', 'notes'])
}

/** An invented year of company spending for Settings → demo data. Nothing here is real. */
function demoExpenses(): Expense[] {
  const today = todayISO()
  const day = (back: number) => {
    const d = new Date(`${today}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - back)
    return d.toISOString().slice(0, 10)
  }
  const filed = { status: 'filed', url: 'https://drive.google.com/', name: 'demo.pdf' } as const
  const rows: Omit<Expense, 'id' | 'currency' | 'original_amount' | 'source' | 'source_ref' | 'notes' | 'paid_with' | 'doc_type' | 'amount_estimated'>[] = [
    { spent_on: day(3), kind: 'flight', vendor: 'Demo Air', description: 'KUL – Penang return', amount: 286, reference: 'D1', trip: 'Demo shoot', recurring: null, receipt: filed },
    { spent_on: day(4), kind: 'hotel', vendor: 'Demo Stays', description: 'Harbour View Hotel, 2 nights', amount: 540, reference: 'D2', trip: 'Demo shoot', recurring: null, receipt: null },
    { spent_on: day(6), kind: 'transport', vendor: 'Demo Rides', description: 'Airport transfer', amount: 75, reference: null, trip: 'Demo shoot', recurring: null, receipt: { status: 'waived' } },
    { spent_on: day(9), kind: 'subscription', vendor: 'Demo Cloud', description: 'Storage plan', amount: 49, reference: null, trip: null, recurring: 'monthly', receipt: filed },
    { spent_on: day(14), kind: 'ads', vendor: 'Demo Ads', description: 'Reel boost', amount: 300, reference: null, trip: null, recurring: null, receipt: filed },
    { spent_on: day(25), kind: 'equipment', vendor: 'Demo Camera Shop', description: 'ND filter set', amount: 459, reference: 'D3', trip: null, recurring: null, receipt: null },
    { spent_on: day(40), kind: 'admin', vendor: 'Demo Registry', description: 'Annual return fee', amount: 200, reference: null, trip: null, recurring: 'yearly', receipt: filed },
    { spent_on: day(70), kind: 'subscription', vendor: 'Demo Cloud', description: 'Storage plan', amount: 49, reference: null, trip: null, recurring: 'monthly', receipt: filed },
    { spent_on: day(100), kind: 'hotel', vendor: 'Demo Stays', description: 'City Inn, 1 night', amount: 230, reference: 'D4', trip: 'Demo city', recurring: null, receipt: filed },
  ]
  return rows.map((r, i) => ({ ...r, id: i + 1, currency: 'MYR', original_amount: null, doc_type: 'Receipt' as const, amount_estimated: false, source: 'manual', source_ref: null, notes: null, paid_with: null }))
}
