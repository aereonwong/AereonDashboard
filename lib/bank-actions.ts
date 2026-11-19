'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode, type Rec } from '@/lib/records'
import { KIND_LABEL } from '@/lib/bank-math'
import { build, toInvoiceLite, toTxn } from '@/lib/bank'
import { todayISO } from '@/lib/today'
import { moneyLocked } from '@/lib/privacy'

// 👉 What the owner can do on the Cash flow page. Every action re-reads the bank and the invoices on the server and
// works the answer out again — nothing the browser sends is trusted beyond an id. None of them changes an amount.

type Result = { ok: boolean; error?: string; count?: number }

const refresh = () => {
  for (const p of ['/dashboard', '/invoices', '/invoices/details', '/invoices/cash-flow', '/clients']) revalidatePath(p)
}

async function guard(): Promise<Result | null> {
  await requireSession() // signed in AND allowed to edit (owner / admin)
  if (await demoMode()) return { ok: false, error: 'Demo data is on — switch it off in Settings first.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  // Owner only, and only with amounts showing: these change which invoices count as paid.
  const locked = await moneyLocked()
  if (locked) return { ok: false, error: locked }
  return null
}

const fail = (message: string): Result => {
  console.error('[bank]', message)
  if (/does not exist|schema cache/.test(message)) return { ok: false, error: 'Run supabase/bank.sql first (the Cash flow page shows the one step).' }
  return { ok: false, error: 'Could not save that. Try again, and check the Vercel logs if it keeps failing.' }
}

/** Mark invoices paid on the day the bank shows the money landed (meta.paid_on). Only invoices the bank fully
 *  covers are touched; `ids` narrows it to some of them (none = all of them). Undo is the usual "mark unpaid". */
export async function confirmFromBank(ids?: number[]): Promise<Result> {
  const g = await guard()
  if (g) return g
  const [st, tx, recs] = await Promise.all([
    supabase.from('bank_statement').select('*').limit(5000),
    supabase.from('bank_txn').select('*').limit(50000),
    supabase.from('records').select('*').in('category', ['cash_in', 'doc']).limit(5000),
  ])
  const err = st.error ?? tx.error ?? recs.error
  if (err) return fail(err.message)
  const rows = (recs.data ?? []).map(r => ({ ...r, meta: r.meta ?? {} })) as Rec[]
  const view = build(
    (st.data ?? []).map(s => ({ from: String(s.period_from), to: String(s.period_to), closing: s.closing == null ? null : Number(s.closing) })),
    (tx.data ?? []).map(toTxn),
    toInvoiceLite(rows),
    todayISO(),
  )
  if (!view.ready) return { ok: false, error: 'No bank statements loaded yet.' }
  const want = ids?.length ? new Set(ids.map(Number)) : null
  const targets = view.toConfirm.filter(i => !want || want.has(i.id))
  const byId = new Map(rows.map(r => [r.id, r]))
  const stamp = new Date().toISOString()
  let count = 0
  for (const i of targets) {
    const r = byId.get(i.id)
    if (!r || !i.bank) continue
    const wasPaid = r.status === 'paid'
    const meta = {
      ...r.meta,
      paid_on: i.bank.lastPaid,
      payment_ref: 'bank statement',
      payment_tracked: true,
      ...(wasPaid ? {} : { paid_at: stamp, status_before_paid: r.status, tracked_before_paid: r.meta?.payment_tracked ?? null }),
    }
    const { error } = await supabase.from('records').update({ status: 'paid', meta }).eq('id', r.id).eq('category', 'cash_in')
    if (error) return fail(error.message)
    count++
  }
  refresh()
  return { ok: true, count }
}

/** The same from a plain form: field `invoice` = one invoice id, absent = every invoice waiting. */
export async function confirmFromBankForm(form: FormData): Promise<void> {
  const one = Number(form.get('invoice'))
  const res = await confirmFromBank(one > 0 ? [one] : undefined)
  if (!res.ok) throw new Error(res.error)
}

/** Link one deposit to invoices by hand (or say it isn't an invoice payment with "none"; "auto" hands it back to
 *  the app's own matching). Form fields: txn, invoice ("auto" | "none" | an invoice id). */
export async function linkDeposit(form: FormData): Promise<void> {
  const g = await guard()
  if (g) throw new Error(g.error)
  const txn = Number(form.get('txn'))
  const pick = String(form.get('invoice') ?? 'auto')
  if (!Number.isInteger(txn) || txn <= 0) throw new Error('Pick a bank line')
  let invoice_ids: number[] | null = null
  if (pick === 'none') invoice_ids = []
  else if (pick !== 'auto') {
    const id = Number(pick)
    if (!Number.isInteger(id) || id <= 0) throw new Error('Pick an invoice')
    const { data } = await supabase.from('records').select('id').eq('id', id).eq('category', 'cash_in').maybeSingle()
    if (!data) throw new Error('That invoice was not found')
    invoice_ids = [id]
  }
  const { error } = await supabase.from('bank_txn').update({ invoice_ids }).eq('id', txn)
  if (error) throw new Error(fail(error.message).error)
  refresh()
}

/** Re-label what a bank line is (salary, crew & suppliers, from director…); "auto" lets the app decide again. */
export async function setTxnKind(form: FormData): Promise<void> {
  const g = await guard()
  if (g) throw new Error(g.error)
  const txn = Number(form.get('txn'))
  const kind = String(form.get('kind') ?? 'auto')
  if (!Number.isInteger(txn) || txn <= 0) throw new Error('Pick a bank line')
  if (kind !== 'auto' && !(kind in KIND_LABEL)) throw new Error('Unknown kind')
  const { error } = await supabase.from('bank_txn').update({ kind: kind === 'auto' ? null : kind }).eq('id', txn)
  if (error) throw new Error(fail(error.message).error)
  refresh()
}
