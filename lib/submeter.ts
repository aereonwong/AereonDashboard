import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { demoSubmeter } from './demo-data'
import type { Bill, Reading } from './submeter-math'

// 👉 Property → Sub-meter. Two tables from supabase/submeter.sql (readings, TNB bills); every figure on
// the page is worked out by lib/submeter-math.ts from the raw rows, never stored.

// ready is false until supabase/submeter.sql has been run; the rest of Property works without it.
export type SubmeterRead = { ready: false } | { ready: true; readings: Reading[]; bills: Bill[] }

const num = (v: unknown) => (v == null ? null : Number(v)) // numeric columns arrive as strings

export async function readSubmeter(): Promise<SubmeterRead> {
  if (await demoMode()) return { ready: true, ...demoSubmeter() }
  if (!supabaseConfigured) return { ready: false }
  const [readings, bills] = await Promise.all([
    supabase.from('submeter_reading').select('*').order('read_on').limit(5000),
    supabase.from('submeter_bill').select('*').order('bill_date').limit(2000),
  ])
  if (readings.error || bills.error) return { ready: false }
  return {
    ready: true,
    readings: (readings.data ?? []).map(r => ({ ...r, reading: Number(r.reading), rate: num(r.rate) }) as Reading),
    bills: (bills.data ?? []).map(b => ({ ...b, amount: Number(b.amount), kwh: num(b.kwh), kw: num(b.kw), kvarh: num(b.kvarh) }) as Bill),
  }
}
