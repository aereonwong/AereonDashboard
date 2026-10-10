'use server'

import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'

// 👉 The Quotations page's two record-keeping buttons. Neither touches Canva,
// Drive or any money figure: a quote is never income, and the invoice it
// becomes is filed by the ordinary Create Invoice flow (Convert opens it).
//
//   Mark lost / reopen:  meta.quote_outcome on the QUOTE row.
//   Link an invoice:     meta.quotation_id on the INVOICE row — the one place
//                        the quote → invoice link lives (lib/quotes.ts).

type Res = { ok: boolean; error?: string }

const refresh = () => {
  for (const p of ['/invoices/quotes', '/invoices/details']) revalidatePath(p)
}

async function guard(): Promise<Res | null> {
  if (await demoMode()) return { ok: false, error: 'Demo data is on — turn it off in Settings to change real quotations.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  return null
}

/** Mark a quote lost (the client said no), or clear that to let it count as open/expired again. */
export async function setQuoteLost(id: number, lost: boolean): Promise<Res> {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  const { data } = await supabase.from('records').select('meta').eq('id', id).eq('category', 'doc').eq('status', 'quotation').single()
  if (!data) return { ok: false, error: 'Quotation not found' }
  const { quote_outcome: _drop, ...rest } = data.meta ?? {}
  const { error } = await supabase
    .from('records')
    .update({ meta: lost ? { ...rest, quote_outcome: 'lost', quote_outcome_at: new Date().toISOString() } : rest })
    .eq('id', id)
  refresh()
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Point an existing invoice at this quote — for jobs won before the Convert
 *  button existed. Only the link is written; the invoice's printed reference
 *  (quotation_no) and its Canva design are left exactly as they are. */
export async function linkInvoice(quoteId: number, invoiceId: number): Promise<Res> {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  const [{ data: quote }, { data: inv }] = await Promise.all([
    supabase.from('records').select('id').eq('id', quoteId).eq('category', 'doc').eq('status', 'quotation').single(),
    supabase.from('records').select('meta').eq('id', invoiceId).eq('category', 'cash_in').single(),
  ])
  if (!quote) return { ok: false, error: 'Quotation not found' }
  if (!inv?.meta?.invoice_no) return { ok: false, error: 'Invoice not found' }
  const { error } = await supabase
    .from('records')
    .update({ meta: { ...inv.meta, quotation_id: quoteId, quotation_link: 'manual' } })
    .eq('id', invoiceId)
  refresh()
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Undo a link made with linkInvoice (or by the import). An invoice that PRINTS
 *  this quote's number stays linked by that number — that is what it says. */
export async function unlinkInvoice(invoiceId: number): Promise<Res> {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  const { data: inv } = await supabase.from('records').select('meta').eq('id', invoiceId).eq('category', 'cash_in').single()
  if (!inv?.meta?.invoice_no) return { ok: false, error: 'Invoice not found' }
  const { quotation_id: _id, quotation_link: _how, ...rest } = inv.meta
  const { error } = await supabase.from('records').update({ meta: rest }).eq('id', invoiceId)
  refresh()
  return error ? { ok: false, error: error.message } : { ok: true }
}
