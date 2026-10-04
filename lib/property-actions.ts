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
