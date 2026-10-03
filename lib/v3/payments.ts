'use server'

import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { isPaid } from '@/lib/records'

// 👉 Marking invoices paid from the web app. Until 26 Sep 2026 no invoice had
// ever been marked paid, so "who owes me money" had no true answer; these
// actions are how that answer starts to exist.
//
// Clicking the button IS the owner's approval — the same money-truth change the
// Telegram bot's mark_invoice_paid proposes and waits on. Marking paid never
// changes revenue: every tab counts an invoice by its number, whatever its status.

const refresh = () => {
  for (const p of ['/dashboard', '/invoices', '/invoices/details', '/clients']) revalidatePath(p)
}

export async function markPaid(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const { data } = await supabase.from('records').select('meta, status').eq('id', id).eq('category', 'cash_in').single()
  if (!data) return { ok: false, error: 'Invoice not found' }
  // Remember what it was, so undo returns an "awaiting payment" invoice to
  // awaiting rather than to "not tracked".
  const before = data.status === 'paid' ? data.meta?.status_before_paid : data.status
  const { error } = await supabase
    .from('records')
    .update({
      status: 'paid',
      meta: {
        ...data.meta,
        paid_at: new Date().toISOString(),
        payment_tracked: true,
        status_before_paid: before ?? 'issued',
        // Undo must restore tracking as it was: an untracked invoice marked paid
        // by mistake goes back to untracked, never to owed.
        tracked_before_paid: data.status === 'paid' ? data.meta?.tracked_before_paid : data.meta?.payment_tracked ?? null,
      },
    })
    .eq('id', id)
  refresh()
  return error ? { ok: false, error: error.message } : { ok: true }
}

export async function markUnpaid(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const { data } = await supabase.from('records').select('meta').eq('id', id).eq('category', 'cash_in').single()
  if (!data) return { ok: false, error: 'Invoice not found' }
  const { paid_at: _drop, paid_on: _dropOn, paid_baseline: _dropBase, status_before_paid: before, tracked_before_paid: trackedBefore, ...meta } = data.meta ?? {}
  const status = before && before !== 'paid' ? String(before) : 'issued'
  // Restore tracking exactly; rows paid before this was recorded fall back to the status.
  const tracked = typeof trackedBefore === 'boolean' ? trackedBefore : status !== 'issued'
  const { error } = await supabase
    .from('records')
    .update({ status, meta: { ...meta, payment_tracked: tracked } })
    .eq('id', id)
  refresh()
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** One-time baseline: confirm everything issued on or before a date as paid. */
export async function markPaidBefore(date: string): Promise<{ ok: boolean; count: number; error?: string }> {
  await requireSession()
  if (!supabaseConfigured) return { ok: false, count: 0, error: 'Database not configured' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, count: 0, error: 'Pick a valid date' }
  const { data, error } = await supabase
    .from('records')
    .select('id, meta, status, created_at')
    .eq('category', 'cash_in')
    .neq('status', 'paid')
    .not('meta->invoice_no', 'is', null) // invoices only — never other income rows
    .limit(3000)
  if (error) return { ok: false, count: 0, error: error.message }
  // The invoice's date as every page reads it (toInvoices): invoice_date, else when it was filed.
  const targets = (data ?? []).filter(r => !isPaid(r) && String(r.meta?.invoice_date || r.created_at).slice(0, 10) <= date)
  const stamp = new Date().toISOString()
  for (const r of targets) {
    await supabase
      .from('records')
      .update({
        status: 'paid',
        meta: {
          ...r.meta,
          paid_at: stamp,
          paid_baseline: date,
          payment_tracked: true,
          // As markPaid: remember what it was, so undo on its row restores it exactly.
          status_before_paid: r.status,
          tracked_before_paid: r.meta?.payment_tracked ?? null,
        },
      })
      .eq('id', r.id)
  }
  refresh()
  return { ok: true, count: targets.length }
}
