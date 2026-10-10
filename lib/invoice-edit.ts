import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import type { Rec } from './records'
import { composioExec } from './composio-exec'
import { commitRender, discardRender, fileDesign, parkForDeletion, designIdOf, type RenderPreview } from './invoice-canva'
import { driveOf, driveStatus, type DriveMeta } from './invoice-drive'
import { editBlockOf } from './invoice-details'
import { invoiceRow, quoteIdFor, rememberClient, type Draft } from './invoice-intake'
import type { DocKind } from './invoice-render'

// 👉 Edit an invoice already filed, and undo that edit. Same idea as Create
// Invoice: the template is copied and filled in fresh (a preview Aereon
// approves), never patched in place — so an edit looks exactly like a new
// invoice would. The NUMBER stays: same client, same job, a corrected version.
//
//   Save edit:  commit the new Canva design → move the old Drive PDF to trash →
//               rewrite the row (Drive status back to "not uploaded") → park the
//               old design in "TODO: Delete".
//   Undo:       the reverse, from the snapshot the edit kept on the row:
//               restore the old Drive PDF from trash, trash any PDF uploaded
//               since, file the old design back into its year folder, park the
//               new one, and put the row back exactly as it was.
//
// Snapshots live on the row (`meta.edits`, newest last), so undo needs no
// extra table and works one step at a time back through several edits.
//
// Quotations (doc / 'quotation' rows) edit the same way, from the quotation
// template: their status stays 'quotation', they have no due date or payment,
// and nothing is in Drive. Old-format quotes from the Canva back catalogue are
// view only — editBlockOf() says so.

const KEEP_EDITS = 10

type Row = Pick<Rec, 'id' | 'title' | 'notes' | 'amount' | 'status' | 'due_date' | 'created_at' | 'meta'>

export type EditSnapshot = {
  at: string
  /** The row exactly as it was before this edit (its own `edits` left out). */
  prev: Omit<Row, 'id'>
  /** The design this edit created, and the one it replaced. */
  design_id: string
  old_design_id: string
  /** The Drive PDF this edit moved to trash, if there was one. */
  trashed_drive_file?: string
}

type Fail = { ok: false; error: string }
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))
const notFound = (e: unknown) => /not ?found|404/i.test(msg(e))

/** Invoice or quotation, from the row itself — never from what the browser sent. */
export const rowKind = (r: Pick<Rec, 'category' | 'status'>): DocKind | null =>
  r.category === 'cash_in' ? 'invoice' : r.category === 'doc' && r.status === 'quotation' ? 'quotation' : null

/** An invoice or quotation row (by `rowKind`), with the fields edit and undo need. */
async function loadDoc(id: number, select: string) {
  const { data } = await supabase.from('records').select(`category, status, ${select}`).eq('id', id).in('category', ['cash_in', 'doc']).single()
  const row = data as unknown as (Row & Pick<Rec, 'category'>) | null
  return row && rowKind(row) && row.meta?.invoice_no ? row : null
}

export async function loadEditable(id: number): Promise<Row | Fail> {
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const data = await loadDoc(id, 'id, title, notes, amount, due_date, created_at, meta')
  if (!data) return { ok: false, error: 'Invoice or quotation not found' }
  const block = editBlockOf(data)
  if (block) return { ok: false, error: block }
  return data as Row
}

/** A multi-day job keeps its list of days as long as the first day wasn't changed. */
export function withRowDates(row: Row, draft: Draft): Draft {
  const m = row.meta ?? {}
  return Array.isArray(m.event_dates) && draft.eventDate === m.event_date ? { ...draft, eventDates: m.event_dates } : draft
}

const trash = (fileId: string) => composioExec('GOOGLEDRIVE_TRASH_FILE', { file_id: fileId, fields: 'id,trashed' })
const untrash = (fileId: string) => composioExec('GOOGLEDRIVE_UNTRASH_FILE', { file_id: fileId })

export type EditResult = { ok: true; no: string; warning?: string } | Fail

export async function applyEdit(
  id: number,
  draft: Draft,
  opts: { status: 'waiting' | 'paid' | 'issued'; dueDate: string | null; preview: RenderPreview; expectDesign: string },
): Promise<EditResult> {
  const row = await loadEditable(id)
  if ('ok' in row) {
    await discardRender(opts.preview).catch(() => {})
    return row
  }
  const meta = row.meta
  const no = String(meta.invoice_no)
  const kind = rowKind(row as Row & Pick<Rec, 'category'>)!
  const isQuote = kind === 'quotation'
  const noun = isQuote ? 'quotation' : 'invoice'
  const oldDesign = designIdOf(row)!
  if (oldDesign !== opts.expectDesign) {
    await discardRender(opts.preview).catch(() => {})
    return { ok: false, error: `${no} changed while you were editing. Close and open Edit again.` }
  }
  if (driveStatus(row) === 'uploading') {
    await discardRender(opts.preview).catch(() => {})
    return { ok: false, error: `A Google Drive upload for this ${noun} is running — wait for it, then edit.` }
  }

  try {
    await commitRender({ designId: opts.preview.designId, transactionId: opts.preview.transactionId, invoiceDate: draft.date!, kind })
  } catch (e) {
    return { ok: false, error: `Canva could not save the design: ${msg(e)}. Generate the preview again.` }
  }

  // The old PDF shows the old details, so it goes to Drive's trash (kept 30 days).
  let warning: string | undefined
  let trashed: string | undefined
  const oldDrive = driveOf(row)
  if (oldDrive?.status === 'uploaded' && oldDrive.file_id) {
    try {
      await trash(oldDrive.file_id)
      trashed = oldDrive.file_id
    } catch (e) {
      if (!notFound(e)) warning = `Saved, but the old PDF could not be moved to Drive's trash — delete it by hand: ${msg(e)}`
    }
  }

  const now = new Date().toISOString()
  const wasPaid = ['paid', 'received'].includes(String(row.status).toLowerCase())
  const { edits: prevEdits, ...prevMeta } = meta
  const snapshot: EditSnapshot = {
    at: now,
    prev: { title: row.title, notes: row.notes, amount: row.amount, status: row.status, due_date: row.due_date, created_at: row.created_at, meta: prevMeta },
    design_id: opts.preview.designId,
    old_design_id: oldDesign,
    trashed_drive_file: trashed,
  }
  // Keep the quote link while the printed reference is unchanged; a new reference
  // is looked up again (lib/quotes.ts reads quotation_id first).
  const quotationId = isQuote
    ? undefined
    : (draft.quotation ?? '') === String(prevMeta.quotation_no ?? '')
      ? prevMeta.quotation_id
      : await quoteIdFor(draft.quotation)
  // The row's kind wins over the draft's: an edit can never turn one into the other.
  const next = invoiceRow({ ...draft, kind, quotationId }, no)
  // A quotation stays a quotation: no payment status, no due date, never income.
  const payment = isQuote
    ? { payment_tracked: undefined, paid_at: undefined, paid_on: undefined }
    : {
        payment_tracked: opts.status !== 'issued',
        paid_at: opts.status === 'paid' ? (wasPaid ? prevMeta.paid_at : undefined) ?? now : undefined,
        // The payment date only survives while the invoice stays paid.
        paid_on: opts.status === 'paid' ? prevMeta.paid_on : undefined,
      }
  const update = {
    title: next.title,
    notes: next.notes,
    amount: next.amount,
    created_at: next.created_at,
    status: isQuote ? 'quotation' : opts.status,
    due_date: isQuote ? null : opts.dueDate,
    meta: {
      ...prevMeta,
      ...next.meta,
      source: prevMeta.source,
      ...payment,
      canva_design: opts.preview.designId,
      canva_url: opts.preview.viewUrl ?? `https://www.canva.com/design/${opts.preview.designId}/view`,
      render: { status: 'done', design_id: opts.preview.designId, rendered_at: now, source: 'dashboard-edit' },
      // Back to "not uploaded": the new PDF is uploaded with the usual Drive button.
      drive: undefined,
      edits: [...(Array.isArray(prevEdits) ? prevEdits : []), snapshot].slice(-KEEP_EDITS),
    },
  }

  const { error } = await supabase.from('records').update(update).eq('id', id)
  if (error) {
    // Put Drive and Canva back so nothing points at a version the row doesn't have.
    if (trashed) await untrash(trashed).catch(() => {})
    await parkForDeletion(opts.preview.designId)
    return { ok: false, error: `The ${noun} row could not be updated: ${error.message}. Nothing was changed.` }
  }

  await parkForDeletion(oldDesign)
  if (draft.client?.name) await rememberClient(draft.client).catch(() => {})
  return warning ? { ok: true, no, warning } : { ok: true, no }
}

export type UndoResult = { ok: true; no: string; warning?: string } | Fail

export async function undoLastEdit(id: number): Promise<UndoResult> {
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const row = await loadDoc(id, 'id, meta')
  const meta = row?.meta ?? {}
  const kind = row ? rowKind(row)! : 'invoice'
  const noun = kind === 'quotation' ? 'quotation' : 'invoice'
  const edits: EditSnapshot[] = Array.isArray(meta.edits) ? meta.edits : []
  const last = edits[edits.length - 1]
  if (!row || !last) return { ok: false, error: `There is no edit to undo on this ${noun}` }
  const no = String(meta.invoice_no)
  if (designIdOf(row) !== last.design_id) return { ok: false, error: `${no}'s Canva design changed after the edit, so it can't be undone safely.` }
  if (driveStatus(row) === 'uploading') return { ok: false, error: `A Google Drive upload for this ${noun} is running — wait for it, then undo.` }

  const warnings: string[] = []

  // A PDF uploaded after the edit shows the edited details — trash it.
  const current = driveOf(row)
  if (current?.status === 'uploaded' && current.file_id && current.file_id !== last.trashed_drive_file) {
    await trash(current.file_id).catch(e => {
      if (!notFound(e)) warnings.push(`the edited PDF could not be moved to Drive's trash (${msg(e)})`)
    })
  }

  // Bring the old PDF back. If Drive no longer has it, the row says "not uploaded".
  const prevMeta = { ...last.prev.meta }
  if (last.trashed_drive_file) {
    try {
      await untrash(last.trashed_drive_file)
    } catch (e) {
      warnings.push(`the old PDF could not be restored from Drive's trash (${msg(e)}) — upload it again`)
      prevMeta.drive = undefined as unknown as DriveMeta
      if (prevMeta.render) prevMeta.render = { ...prevMeta.render, drive_file_id: undefined, drive_url: undefined }
    }
  }

  const rest = edits.slice(0, -1)
  // Linked Instagram posts aren't part of the invoice's content: undo keeps
  // today's links rather than the ones the snapshot happened to hold.
  const { error } = await supabase
    .from('records')
    .update({ ...last.prev, meta: { ...prevMeta, ig_posts: meta.ig_posts, edits: rest.length ? rest : undefined } })
    .eq('id', id)
  if (error) return { ok: false, error: `The ${noun} row could not be restored: ${error.message}` }

  const prevDate = String(prevMeta.invoice_date ?? last.prev.created_at).slice(0, 10)
  await fileDesign(last.old_design_id, prevDate, kind)
  await parkForDeletion(last.design_id)

  return warnings.length ? { ok: true, no, warning: `${no} restored, but ${warnings.join('; ')}.` } : { ok: true, no }
}
