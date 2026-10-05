import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { demoSubmeter } from './demo-data'
import type { Bill, Reading } from './submeter-math'

// 👉 Property → Sub-meter. Two tables from supabase/submeter.sql (readings, TNB bills); every figure on
// the page is worked out by lib/submeter-math.ts from the raw rows, never stored.

// ready is false until supabase/submeter.sql has been run; the rest of Property works without it.
// tenantReady is false while the tenant_name column (added 4 Oct 2026) is missing: re-running the SQL adds it.
// paidReady is the same for paid_on (added 4 Oct 2026, later the same day).
// kindReady is the same for kind (move-in / move-out, added 5 Oct 2026).
export type SubmeterRead = { ready: false } | { ready: true; tenantReady: boolean; paidReady: boolean; kindReady: boolean; readings: Reading[]; bills: Bill[] }

const num = (v: unknown) => (v == null ? null : Number(v)) // numeric columns arrive as strings

export async function readSubmeter(): Promise<SubmeterRead> {
  if (await demoMode()) return { ready: true, tenantReady: true, paidReady: true, kindReady: true, ...demoSubmeter() }
  if (!supabaseConfigured) return { ready: false }
  const [readings, bills] = await Promise.all([
    supabase.from('submeter_reading').select('*').order('read_on').limit(5000),
    supabase.from('submeter_bill').select('*').order('bill_date').limit(2000),
  ])
  if (readings.error || bills.error) return { ready: false }
  // An empty table can't show its columns, so ask a one-row question that fails only when the column is missing.
  const [tenantProbe, paidProbe, kindProbe] = await Promise.all(['tenant_name', 'paid_on', 'kind'].map(c => supabase.from('submeter_reading').select(c).limit(1)))
  const kindReady = !kindProbe.error
  const tenantReady = !tenantProbe.error
  const paidReady = !paidProbe.error
  return {
    ready: true,
    tenantReady,
    paidReady,
    kindReady,
    readings: (readings.data ?? []).map(r => ({ ...r, reading: Number(r.reading), rate: num(r.rate), tenant_name: r.tenant_name ?? null, paid_on: r.paid_on ?? null, kind: r.kind ?? 'reading' }) as Reading),
    bills: (bills.data ?? []).map(b => ({ ...b, amount: Number(b.amount), kwh: num(b.kwh), kw: num(b.kw), kvarh: num(b.kvarh) }) as Bill),
  }
}
