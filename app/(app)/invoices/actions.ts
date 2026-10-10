'use server'

import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { supabaseConfigured } from '@/lib/supabase'
import { demoMode, type Rec } from '@/lib/records'
import { invoiceRow, nextInvoiceNo, fileInvoice, TERMS, type Draft, type Currency } from '@/lib/invoice-intake'
import { startRender, commitRender, discardRender, type RenderPreview } from '@/lib/invoice-canva'
import type { DocKind } from '@/lib/invoice-render'
import { uploadInvoiceToDrive, reuploadInvoiceToDrive } from '@/lib/invoice-drive-upload'
import { composioReady } from '@/lib/composio-exec'
import { loadEditable, withRowDates, applyEdit, undoLastEdit, rowKind } from '@/lib/invoice-edit'

// 👉 The dashboard's invoice buttons. Each goes database → app → (Canva or
// Drive only when the action needs it) → database. No model is involved.
//
//   Create Invoice:  previewInvoice → (Aereon looks) → saveInvoice | discardInvoice
//   Upload to Drive: uploadToDrive — a separate, manual click, never automatic.
//   Re-upload:       reuploadToDrive — after a hand fix in Canva, replace the PDF.
//   Edit Invoice:    previewEdit → (Aereon looks, confirms) → saveEdit | discardInvoice
//   Undo edit:       undoEdit — puts the row, Canva design and Drive PDF back.

export type InvoiceForm = {
  /** Invoice (default) or quotation — same form, own number series, template and Canva folder. */
  kind?: DocKind
  client: { name: string; contact?: string; address?: string; reg?: string }
  job: string
  venue?: string
  eventDate?: string
  eventDateLabel?: string
  eventTime?: string
  deliverables: string[]
  amount: number
  currency: Currency
  discount?: number
  termsKey: keyof typeof TERMS | 'custom'
  terms: string
  quotation?: string
  /** Set when the form was opened from a quote's Convert button. */
  quotationId?: number
  date: string
  dueDate?: string
  status: 'waiting' | 'paid' | 'issued'
  /** Quotations only: days the quote stays valid (printed on it). */
  validityDays?: number
}

type Fail = { ok: false; error: string }
const fail = (error: string): Fail => ({ ok: false, error })
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const ISO = /^\d{4}-\d{2}-\d{2}$/
const CURRENCIES: Currency[] = ['MYR', 'USD', 'SGD', 'EUR', 'RMB']

function refresh() {
  for (const p of ['/invoices', '/invoices/details', '/invoices/quotes', '/dashboard', '/cash-in', '/clients']) revalidatePath(p)
}

async function guard(): Promise<Fail | null> {
  if (await demoMode()) return fail('Demo data is on — turn it off in Settings to create or file real invoices.')
  if (!supabaseConfigured) return fail('Database not configured')
  return null
}

/** Everything the form must have, checked on the server as well as in the browser. */
const kindOf = (f: InvoiceForm): DocKind => (f.kind === 'quotation' ? 'quotation' : 'invoice')
const noun = (f: InvoiceForm) => kindOf(f)

function validate(f: InvoiceForm): string | null {
  if (!f.client?.name?.trim()) return 'Pick or enter a client'
  if (!f.job?.trim()) return 'Enter the job name'
  if (!(f.amount > 0)) return 'Enter an amount above zero'
  if (f.discount && (f.discount < 0 || f.discount >= f.amount)) return 'The discount must be less than the amount'
  if (!CURRENCIES.includes(f.currency)) return 'Pick a currency'
  if (!ISO.test(f.date)) return `Pick the ${noun(f)} date`
  if (kindOf(f) === 'quotation' && !(Number.isInteger(f.validityDays) && f.validityDays! >= 1 && f.validityDays! <= 365))
    return 'Enter how many days the quotation stays valid (1–365)'
  if (f.eventDate && !ISO.test(f.eventDate)) return 'The job date is not a valid date'
  if (f.dueDate && !ISO.test(f.dueDate)) return 'The due date is not a valid date'
  if (f.dueDate && f.dueDate < f.date) return 'The due date is before the invoice date'
  if (!f.terms?.trim()) return 'Choose the payment terms'
  if (!f.deliverables.some(d => d.trim())) return 'List at least one deliverable'
  return null
}

function toDraft(f: InvoiceForm): Draft {
  const clean = (s?: string) => (s && s.trim() && s.trim() !== '-' ? s.trim() : undefined)
  const isQuote = kindOf(f) === 'quotation'
  return {
    kind: kindOf(f),
    step: 'confirm',
    client: {
      name: f.client.name.trim(),
      contact: clean(f.client.contact),
      address: clean(f.client.address),
      reg: clean(f.client.reg),
    },
    job: f.job.trim(),
    venue: clean(f.venue) ?? '—',
    eventDate: f.eventDate || f.date,
    eventDateLabel: clean(f.eventDateLabel),
    eventTime: clean(f.eventTime) ?? '-',
    deliverables: f.deliverables.map(d => d.trim()).filter(Boolean),
    amount: f.amount,
    currency: f.currency,
    discount: f.discount || undefined,
    terms: f.terms.trim(),
    // A quotation has no quotation reference; an invoice has no validity period.
    quotation: isQuote ? undefined : clean(f.quotation),
    quotationId: !isQuote && f.quotationId && clean(f.quotation) ? f.quotationId : undefined,
    validityDays: isQuote ? f.validityDays : undefined,
    date: f.date,
  }
}

export type PreviewResult = { ok: true; no: string; preview: RenderPreview } | Fail

/** Step 1: draw the invoice in Canva and hand back a picture of it. Nothing is
 *  saved yet — the Canva edit stays uncommitted and no database row exists. */
export async function previewInvoice(form: InvoiceForm): Promise<PreviewResult> {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  const invalid = validate(form)
  if (invalid) return fail(invalid)
  if (!composioReady()) return fail('Canva is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')

  try {
    const no = await nextInvoiceNo(form.date, kindOf(form))
    const row = invoiceRow(toDraft(form), no)
    const preview = await startRender({ ...row, id: 0 } as unknown as Rec, kindOf(form))
    return { ok: true, no, preview }
  } catch (e) {
    return fail(`Canva could not draw the ${noun(form)}: ${msg(e)}`)
  }
}

export type SaveResult = { ok: true; id: number; no: string } | Fail

/** Step 2: Aereon approved the preview — commit the Canva design, then file the
 *  invoice row with its design id already on it. Drive is NOT touched here. */
export async function saveInvoice(form: InvoiceForm, no: string, preview: RenderPreview): Promise<SaveResult> {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  const invalid = validate(form)
  if (invalid) return fail(invalid)

  // The number is printed on the design, so it must still be the next free one.
  const expected = await nextInvoiceNo(form.date, kindOf(form))
  if (expected !== no) {
    await discardRender(preview).catch(() => {})
    return fail(`${no} was taken by another ${noun(form)} while you were reviewing. Generate the preview again to get ${expected}.`)
  }

  try {
    await commitRender({ designId: preview.designId, transactionId: preview.transactionId, invoiceDate: form.date, kind: kindOf(form) })
  } catch (e) {
    return fail(`Canva could not save the design: ${msg(e)}. Generate the preview again.`)
  }

  const now = new Date().toISOString()
  const isQuote = kindOf(form) === 'quotation'
  // A quotation keeps the row fileInvoice gives it (doc / 'quotation', never
  // income): no payment status, no due date.
  const filed = await fileInvoice(toDraft(form), {
    no,
    ...(isQuote ? {} : { status: form.status, dueDate: form.dueDate || null }),
    meta: {
      source: 'dashboard',
      ...(isQuote ? {} : { payment_tracked: form.status !== 'issued', paid_at: form.status === 'paid' ? now : undefined }),
      canva_design: preview.designId,
      canva_url: preview.viewUrl ?? `https://www.canva.com/design/${preview.designId}/view`,
      render: { status: 'done', design_id: preview.designId, rendered_at: now, source: 'dashboard' },
    },
  })
  if (!filed) return fail(`The Canva design was saved (${preview.designId}) but the ${noun(form)} row was not.`)
  refresh()
  return { ok: true, id: filed.id, no }
}

/** Aereon rejected the preview: nothing is saved, the copy is parked for deletion. */
export async function discardInvoice(preview: RenderPreview): Promise<{ ok: boolean }> {
  await requireSession()
  await discardRender(preview).catch(() => {})
  return { ok: true }
}

/** The manual Google Drive step, one invoice at a time. */
export async function uploadToDrive(id: number) {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  if (!composioReady()) return fail('Google Drive is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')
  const res = await uploadInvoiceToDrive(id)
  refresh()
  return res
}

/** After a hand fix in the Canva design: export again, upload the new PDF, then
 *  move the old Drive copy to trash. Manual click only, like uploadToDrive. */
export async function reuploadToDrive(id: number) {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  if (!composioReady()) return fail('Google Drive is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')
  const res = await reuploadInvoiceToDrive(id)
  refresh()
  return res
}

/** Edit step 1: redraw the invoice from the template with the edited details,
 *  under the SAME number. Nothing changes until saveEdit. */
export async function previewEdit(id: number, form: InvoiceForm): Promise<PreviewResult> {
  await requireSession()

  const blocked = await guard()
  if (blocked) return blocked
  const invalid = validate(form)
  if (invalid) return fail(invalid)
  if (!composioReady()) return fail('Canva is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')

  const row = await loadEditable(id)
  if ('ok' in row) return row
  // The row decides invoice or quotation; a form claiming otherwise is refused.
  const kind = rowKind(row as Rec)
  if (kind !== kindOf(form)) return fail(`${row.meta.invoice_no} is not ${kindOf(form) === 'quotation' ? 'a quotation' : 'an invoice'}.`)
  try {
    const no = String(row.meta.invoice_no)
    const draft = invoiceRow(withRowDates(row, toDraft(form)), no)
    const preview = await startRender({ ...draft, id } as unknown as Rec, kind)
    return { ok: true, no, preview }
  } catch (e) {
    return fail(`Canva could not draw the ${kind}: ${msg(e)}`)
  }
}

/** Edit step 2: Aereon approved and confirmed — swap in the new design, trash
 *  the old Drive PDF (Drive status resets) and rewrite the row, keeping a
 *  snapshot so the edit can be undone. */
export async function saveEdit(id: number, form: InvoiceForm, preview: RenderPreview, expectDesign: string) {
  await requireSession()
  const blocked = await guard()
  if (blocked) {
    await discardRender(preview).catch(() => {})
    return blocked
  }
  const invalid = validate(form)
  if (invalid) return fail(invalid)
  const row = await loadEditable(id)
  if ('ok' in row) {
    await discardRender(preview).catch(() => {})
    return row
  }
  if (rowKind(row as Rec) !== kindOf(form)) {
    await discardRender(preview).catch(() => {})
    return fail(`${row.meta.invoice_no} is not ${kindOf(form) === 'quotation' ? 'a quotation' : 'an invoice'}.`)
  }
  const res = await applyEdit(id, withRowDates(row, toDraft(form)), {
    status: form.status,
    dueDate: form.dueDate || null,
    preview,
    expectDesign,
  })
  refresh()
  return res
}

/** Undo the last edit of an invoice. */
export async function undoEdit(id: number) {
  await requireSession()
  const blocked = await guard()
  if (blocked) return blocked
  if (!composioReady()) return fail('Canva / Google Drive are not connected on this server yet — add COMPOSIO_API_KEY in Vercel.')
  const res = await undoLastEdit(id)
  refresh()
  return res
}
