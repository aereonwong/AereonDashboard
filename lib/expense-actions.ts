'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/auth'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import { moneyLocked } from '@/lib/privacy'
import { setSetting } from '@/lib/settings'
import { fileToDrive, monthExports, trashDriveFile, type MonthExport } from '@/lib/expense-drive'
import { composioReady } from '@/lib/composio-exec'
import { toExpense } from '@/lib/expenses'
import { DOC_TYPES, expensesCsv, isKind, receiptFilename, receiptState, type ReceiptMeta } from '@/lib/expenses-math'

// 👉 Expense writes. A form drawn while amounts are hidden holds disguised figures, so saving or exporting money
// refuses until "Show amounts" is on (moneyLocked). Receipts are filed in Google Drive with no model involved.

type Result = { ok: true; url?: string } | { ok: false; error: string }

const text = (v: FormDataEntryValue | null, max: number) => String(v ?? '').trim().slice(0, max) || null
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s))
const money = (v: FormDataEntryValue | null): number | null | 'bad' => {
  // Only a leading RM / MYR is dropped: "1.2k" or "1e3" is refused, never saved as 1.2 or 13.
  const s = String(v ?? '').replace(/^\s*(RM|MYR)/i, '').replace(/[,\s]/g, '')
  if (!s) return null
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) return 'bad'
  const n = Number(s)
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n * 100) / 100 : 'bad'
}

const MAX_RECEIPT = 4 * 1024 * 1024 // Vercel's request body limit is 4.5 MB
const RECEIPT_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

async function guard(money_: boolean): Promise<Result | null> {
  await requireSession()
  if (money_) {
    const locked = await moneyLocked()
    if (locked) return { ok: false, error: locked }
  }
  if (await demoMode()) return { ok: false, error: 'Demo data is on — switch it off in Settings to record real expenses.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  return null
}

// Database and Drive errors can carry table, column or path detail: log it here, tell the browser something plain.
const needSql = (message: string) => {
  if (/does not exist|schema cache/.test(message)) return 'Run supabase/expenses.sql first (the Expenses page shows the one step).'
  console.error('[expenses]', message)
  return 'Could not save that. Try again, and check the Vercel logs if it keeps failing.'
}
const driveError = (err: unknown) => {
  console.error('[expenses] Drive', err)
  return 'Google Drive did not accept the file. Try again in a moment.'
}

const done = (error: { message: string; code?: string } | null): Result => {
  revalidatePath('/expenses', 'layout')
  revalidatePath('/dashboard')
  if (!error) return { ok: true }
  if (error.code === '23505') return { ok: false, error: 'That vendor, reference and type is already recorded — it is the same booking or order.' }
  return { ok: false, error: needSql(error.message) }
}

export async function saveExpense(form: FormData): Promise<Result> {
  const g = await guard(true)
  if (g) return g

  const rawId = String(form.get('id') ?? '')
  const id = rawId ? Number(rawId) : null
  if (rawId && !(Number.isInteger(id) && (id as number) > 0)) return { ok: false, error: 'Bad request' }

  const spent_on = String(form.get('spent_on') ?? '')
  if (!isDate(spent_on)) return { ok: false, error: 'Pick the date it was paid' }
  const kind = String(form.get('kind') ?? '')
  if (!isKind(kind)) return { ok: false, error: 'Pick what kind of expense it is' }
  const vendor = text(form.get('vendor'), 120)
  if (!vendor) return { ok: false, error: 'Say who was paid' }
  const amount = money(form.get('amount'))
  const original = money(form.get('original_amount'))
  if (amount === 'bad') return { ok: false, error: 'The RM amount must be a number, e.g. 531.16' }
  if (original === 'bad') return { ok: false, error: 'The amount in the other currency must be a number' }
  const currency = (text(form.get('currency'), 3) ?? 'MYR').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false, error: 'Currency is a three-letter code, e.g. MYR or USD' }
  // A foreign charge is tracked in its own currency; its RM figure can wait for the statement. Ringgit rows need it.
  if (currency === 'MYR' && amount == null) return { ok: false, error: 'Type the amount in RM, e.g. 531.16' }
  if (currency !== 'MYR' && original == null) return { ok: false, error: `Type the amount charged in ${currency}` }
  if (currency !== 'MYR' && original != null && original === amount) return { ok: false, error: `The RM amount is the same as the ${currency} amount — type what the card was charged in RM, or leave the RM box empty until the statement shows it.` }
  const docType = String(form.get('doc_type') ?? 'Receipt')
  if (!(DOC_TYPES as readonly string[]).includes(docType)) return { ok: false, error: 'Pick Invoice, Receipt or Refund' }
  const recurring = String(form.get('recurring') ?? '')
  if (recurring && recurring !== 'monthly' && recurring !== 'yearly') return { ok: false, error: 'Bad request' }

  const row = {
    spent_on,
    kind,
    vendor,
    description: text(form.get('description'), 300),
    amount,
    amount_estimated: amount != null && form.get('amount_estimated') === 'on',
    doc_type: docType,
    currency,
    original_amount: currency === 'MYR' ? null : original,
    paid_with: text(form.get('paid_with'), 80),
    reference: text(form.get('reference'), 80),
    trip: text(form.get('trip'), 80),
    recurring: recurring || null,
    notes: text(form.get('notes'), 500),
    updated_at: new Date().toISOString(),
  }
  const { error } = id ? await supabase.from('expense').update(row).eq('id', id) : await supabase.from('expense').insert({ ...row, source: 'manual' })
  return done(error)
}

export async function deleteExpense(id: number): Promise<Result> {
  const g = await guard(true)
  if (g) return g
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad request' }
  // The receipt file stays in Drive on purpose: deleting a row should never delete the evidence.
  const { error } = await supabase.from('expense').delete().eq('id', id)
  return done(error)
}

async function loadOne(id: number) {
  const { data } = await supabase.from('expense').select('*').eq('id', id).maybeSingle()
  return data ? toExpense(data) : null
}

const saveReceipt = (id: number, receipt: ReceiptMeta | null) => supabase.from('expense').update({ receipt, updated_at: new Date().toISOString() }).eq('id', id)

/** Attach (or replace) the receipt: the file goes to Drive, the row remembers where. */
export async function attachReceipt(form: FormData): Promise<Result> {
  const g = await guard(false)
  if (g) return g
  if (!composioReady()) return { ok: false, error: 'Google Drive is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.' }
  const id = Number(form.get('id'))
  const file = form.get('file')
  if (!Number.isInteger(id) || id <= 0 || !(file instanceof File) || file.size === 0) return { ok: false, error: 'Choose a receipt file first' }
  const ext = RECEIPT_TYPES[file.type]
  if (!ext) return { ok: false, error: 'A receipt must be a PDF or a photo (PNG, JPG, WebP, HEIC)' }
  if (file.size > MAX_RECEIPT) return { ok: false, error: 'That file is over 4 MB — export a smaller PDF or photo' }

  const e = await loadOne(id)
  if (!e) return { ok: false, error: 'Expense not found' }
  if (receiptState(e) === 'uploading') return { ok: false, error: 'An upload for this expense is already running' }
  const previous = e.receipt?.status === 'filed' ? e.receipt : null

  await saveReceipt(id, { status: 'uploading', started_at: new Date().toISOString(), source: 'dashboard' })
  try {
    const filed = await fileToDrive(receiptFilename(e, ext), new Uint8Array(await file.arrayBuffer()))
    await saveReceipt(id, { status: 'filed', file_id: filed.fileId, url: filed.url, name: filed.name, uploaded_at: new Date().toISOString(), source: 'dashboard' })
    // The new file went up first; only now is the old one moved to Drive's trash.
    if (previous?.file_id && previous.file_id !== filed.fileId) await trashDriveFile(previous.file_id)
    revalidatePath('/expenses', 'layout')
    return { ok: true, url: filed.url }
  } catch (err) {
    const error = driveError(err)
    await saveReceipt(id, previous ?? { status: 'failed', error, source: 'dashboard' })
    revalidatePath('/expenses', 'layout')
    return { ok: false, error: previous ? `Upload failed, the old receipt was kept. ${error}` : error }
  }
}

/** "No receipt exists or is needed" (a cash tip, a bank fee) — or undo that. */
export async function waiveReceipt(id: number, waived: boolean): Promise<Result> {
  const g = await guard(false)
  if (g) return g
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Bad request' }
  const e = await loadOne(id)
  if (!e) return { ok: false, error: 'Expense not found' }
  if (waived && e.receipt?.status === 'filed') return { ok: false, error: 'This expense already has a receipt in Drive' }
  const { error } = await saveReceipt(id, waived ? { status: 'waived', source: 'dashboard' } : null)
  return done(error)
}

// ── The month's list, as a CSV in the month's Drive folder ──────────────────

/** File "Expenses 2026-10.csv" in that month's Drive folder: one line per payment, receipt links included. */
export async function exportMonth(month: string): Promise<Result> {
  const g = await guard(true)
  if (g) return g
  if (!composioReady()) return { ok: false, error: 'Google Drive is not connected on this server yet — add COMPOSIO_API_KEY in Vercel.' }
  if (!/^\d{4}-\d{2}$/.test(month)) return { ok: false, error: 'Pick a month' }

  const { data, error } = await supabase.from('expense').select('*').gte('spent_on', `${month}-01`).lt('spent_on', nextMonth(month)).order('spent_on')
  if (error) return { ok: false, error: needSql(error.message) }
  const rows = (data ?? []).map(toExpense)
  if (!rows.length) return { ok: false, error: `No expenses in ${month} to export` }

  const log: Record<string, MonthExport> = await monthExports()
  try {
    const name = `${month.replace('-', '')} - Monthly expenses.csv`
    const filed = await fileToDrive(name, new TextEncoder().encode('﻿' + expensesCsv(rows)))
    await setSetting('expense_month_exports', { ...log, [month]: { url: filed.url, fileId: filed.fileId, at: new Date().toISOString(), count: rows.length } })
    // A re-export replaces the earlier CSV: the old one goes to Drive's trash only after the new one is filed.
    if (log[month]?.fileId && log[month].fileId !== filed.fileId) await trashDriveFile(log[month].fileId)
    revalidatePath('/expenses', 'layout')
    return { ok: true, url: filed.url }
  } catch (err) {
    return { ok: false, error: driveError(err) }
  }
}

const nextMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}
