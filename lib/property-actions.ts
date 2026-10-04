'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import { addMonth } from '@/lib/property-math'

// 👉 Property tab writes. The monthly job is one figure: the outstanding balance on the statement.
// Saving it marks the month as read from a statement and opens next month as "pending",
// carrying the instalment forward, so the form always knows what comes next.

type Result = { ok: true } | { ok: false; error: string }

const money = (v: FormDataEntryValue | null): number | null | 'bad' => {
  const s = String(v ?? '').replace(/[,\sRM]/gi, '')
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : 'bad'
}

export async function recordLoanMonth(form: FormData): Promise<Result> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — switch it off in Settings to record real figures.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }

  const propertyId = String(form.get('property_id') ?? '')
  const month = String(form.get('month') ?? '')
  if (!/^\d{4}-\d{2}-01$/.test(month)) return { ok: false, error: 'Pick a month' }
  const outstanding = money(form.get('outstanding'))
  const instalment = money(form.get('instalment'))
  const interest = money(form.get('interest'))
  if (outstanding === 'bad' || outstanding == null) return { ok: false, error: 'Type the outstanding balance, e.g. 123456.78' }
  if (instalment === 'bad' || interest === 'bad') return { ok: false, error: 'Instalment and interest must be amounts in RM' }
  const note = String(form.get('note') ?? '').trim().slice(0, 500) || null

  const { data: loan } = await supabase.from('property_loan').select('id').eq('id', propertyId).maybeSingle()
  if (!loan) return { ok: false, error: 'Unknown loan' }

  const { data: existing } = await supabase
    .from('property_loan_month')
    .select('instalment, opening_balance')
    .eq('property_id', propertyId)
    .eq('month', month)
    .maybeSingle()
  const { data: prev } = await supabase
    .from('property_loan_month')
    .select('instalment')
    .eq('property_id', propertyId)
    .lt('month', month)
    .not('instalment', 'is', null)
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  const carried = instalment ?? existing?.instalment ?? prev?.instalment ?? null

  const { error } = await supabase.from('property_loan_month').upsert({
    property_id: propertyId,
    month,
    opening_balance: existing?.opening_balance ?? null,
    outstanding_balance: outstanding,
    instalment: carried,
    interest_charged: interest,
    status: 'normal',
    quality: 'statement',
    note,
    updated_at: new Date().toISOString(),
  })
  if (error) return { ok: false, error: error.message }

  // Open next month as pending — never overwrite a row that already exists.
  await supabase.from('property_loan_month').upsert(
    { property_id: propertyId, month: addMonth(month), instalment: carried, status: 'pending', quality: 'unchecked' },
    { onConflict: 'property_id,month', ignoreDuplicates: true },
  )
  revalidatePath('/property')
  return { ok: true }
}

export async function setIssueStatus(id: number, status: 'open' | 'fixed' | 'ignored'): Promise<Result> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!['open', 'fixed', 'ignored'].includes(status) || !Number.isInteger(id)) return { ok: false, error: 'Bad request' }
  const { error } = await supabase.from('property_data_issue').update({ status }).eq('id', id)
  revalidatePath('/property')
  return error ? { ok: false, error: error.message } : { ok: true }
}

// ── Tenancy and running costs ────────────────────────────────────────────────

const text = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max) || null
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))

async function guard(propertyId: string): Promise<Result | null> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — switch it off in Settings to record real figures.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const { data: loan } = await supabase.from('property_loan').select('id').eq('id', propertyId).maybeSingle()
  return loan ? null : { ok: false, error: 'Unknown property' }
}

const done = (error: { message: string } | null): Result => {
  revalidatePath('/property')
  return error ? { ok: false, error: /does not exist|schema cache/.test(error.message) ? 'Run supabase/tenancy.sql first (the Property page shows the one step).' : error.message } : { ok: true }
}

/** Record a bill: maintenance fee, repair or anything else the property cost. */
export async function addPropertyCost(form: FormData): Promise<Result> {
  const propertyId = String(form.get('property_id') ?? '')
  const blocked = await guard(propertyId)
  if (blocked) return blocked
  const date = String(form.get('cost_date') ?? '')
  const kind = String(form.get('kind') ?? '')
  const amount = money(form.get('amount'))
  if (!isDate(date)) return { ok: false, error: 'Pick the date of the bill' }
  if (!['maintenance_fee', 'repair', 'agent_fee', 'stamping_fee', 'other'].includes(kind)) return { ok: false, error: 'Pick what kind of cost it is' }
  if (amount === 'bad' || amount == null) return { ok: false, error: 'Type the amount, e.g. 350' }
  const { error } = await supabase.from('property_cost').insert({
    property_id: propertyId,
    cost_date: date,
    kind,
    amount,
    description: text(form.get('description'), 300),
    vendor: text(form.get('vendor'), 120),
  })
  return done(error)
}

export async function deletePropertyCost(id: number): Promise<Result> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!Number.isInteger(id) || id < 1) return { ok: false, error: 'Bad request' }
  return done((await supabase.from('property_cost').delete().eq('id', id)).error)
}

/** Add a tenancy term — the first lease, or a renewal (a new row, so the old rent stays in the history). */
export async function addTenancyTerm(form: FormData): Promise<Result> {
  const propertyId = String(form.get('property_id') ?? '')
  const blocked = await guard(propertyId)
  if (blocked) return blocked
  const start = String(form.get('start_date') ?? '')
  const end = String(form.get('end_date') ?? '')
  const rent = money(form.get('monthly_rent'))
  const deposit = money(form.get('deposit'))
  if (!isDate(start) || !isDate(end)) return { ok: false, error: 'Pick the start and end dates' }
  if (end <= start) return { ok: false, error: 'The end date must be after the start date' }
  if (rent === 'bad' || deposit === 'bad') return { ok: false, error: 'Rent and deposit must be amounts in RM' }
  const { error } = await supabase.from('property_tenancy').insert({
    property_id: propertyId,
    start_date: start,
    end_date: end,
    monthly_rent: rent,
    deposit,
    tenant_name: text(form.get('tenant_name'), 120),
    notes: text(form.get('notes'), 500),
  })
  return done(error)
}
