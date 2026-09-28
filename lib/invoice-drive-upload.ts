import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { composioExec } from './composio-exec'
import { designIdOf, exportPdfUrl } from './invoice-canva'
import { driveOf, driveStatus, driveViewUrl, type DriveMeta } from './invoice-drive'
import { getInvoiceExportConfig, exportFilename } from './invoice-export'

// 👉 The manual "file this invoice in Google Drive" action. Two external calls
// and no model: Canva exports the PDF to a presigned URL, and Google Drive
// fetches it straight from that URL (GOOGLEDRIVE_UPLOAD_FROM_URL) — the bytes
// never pass through this server. The result is written back onto the invoice
// row so nothing ever has to search Drive for it again.

export type UploadResult = { ok: true; drive: DriveMeta } | { ok: false; error: string }

async function saveDrive(id: number, meta: Record<string, any>, drive: DriveMeta) {
  await supabase.from('records').update({ meta: { ...meta, drive } }).eq('id', id)
}

type Row = { id: number; title?: string | null; notes?: string | null; meta: Record<string, any> }

async function loadInvoice(id: number): Promise<Row | { error: string }> {
  if (!supabaseConfigured) return { error: 'Database not configured' }
  const { data: row } = await supabase.from('records').select('id, title, notes, meta').eq('id', id).eq('category', 'cash_in').single()
  if (!row?.meta?.invoice_no) return { error: 'Invoice not found' }
  return row as Row
}

/** Canva → PDF URL → Google Drive. Returns the new file; writes nothing. */
async function sendToDrive(row: Row, designId: string) {
  const meta = row.meta
  const [pdfUrl, config] = await Promise.all([exportPdfUrl(designId), getInvoiceExportConfig()])
  const job = String(meta.job ?? row.notes ?? row.title ?? '').replace(/[\\/:*?"<>|]/g, ' ').trim()
  const res = await composioExec('GOOGLEDRIVE_UPLOAD_FROM_URL', {
    source_url: pdfUrl,
    name: exportFilename(String(meta.invoice_no), job.length > 80 ? job.slice(0, 80).trim() : job),
    mime_type: 'application/pdf',
    parent_folder_id: config.driveFolderId,
  })
  const file = res?.file ?? res?.response_data ?? res
  const fileId = String(file?.id ?? '')
  if (!fileId) throw new Error('Google Drive did not return a file id')
  return { fileId, url: String(file?.webViewLink ?? driveViewUrl(fileId)) }
}

export async function uploadInvoiceToDrive(id: number): Promise<UploadResult> {
  const row = await loadInvoice(id)
  if ('error' in row) return { ok: false, error: row.error }

  // Already there, or already on its way: never upload twice.
  const status = driveStatus(row)
  if (status === 'uploaded') return { ok: true, drive: row.meta.drive ?? { status: 'uploaded' } }
  if (status === 'uploading') return { ok: false, error: 'An upload for this invoice is already running' }

  const designId = designIdOf(row)
  if (!designId) return { ok: false, error: 'This invoice has no Canva design linked, so there is no PDF to file' }

  const meta = row.meta
  await saveDrive(id, meta, { status: 'uploading', started_at: new Date().toISOString(), source: 'dashboard' })

  try {
    const { fileId, url } = await sendToDrive(row, designId)
    const drive: DriveMeta = { status: 'uploaded', file_id: fileId, url, uploaded_at: new Date().toISOString(), source: 'dashboard' }
    await saveDrive(id, meta, drive)
    return { ok: true, drive }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await saveDrive(id, meta, { status: 'failed', error: error.slice(0, 300), source: 'dashboard' })
    return { ok: false, error }
  }
}

export type ReuploadResult = { ok: true; drive: DriveMeta; warning?: string } | { ok: false; error: string }

/** Aereon fixed something in the Canva design by hand after review: export the
 *  design again and replace the PDF in Drive. The new file goes up FIRST and
 *  the old one is moved to Drive's trash only after that worked — so a failed
 *  re-upload never leaves the invoice with no PDF at all. Trash, not permanent
 *  delete: Drive keeps it for 30 days in case the old copy is wanted back. */
export async function reuploadInvoiceToDrive(id: number): Promise<ReuploadResult> {
  const row = await loadInvoice(id)
  if ('error' in row) return { ok: false, error: row.error }
  if (driveStatus(row) === 'uploading') return { ok: false, error: 'An upload for this invoice is already running' }

  const designId = designIdOf(row)
  if (!designId) return { ok: false, error: 'This invoice has no Canva design linked, so there is no PDF to file' }

  const meta = row.meta
  const previous = driveOf(row)
  const oldFileId = previous?.status === 'uploaded' ? previous.file_id : undefined
  await saveDrive(id, meta, { status: 'uploading', started_at: new Date().toISOString(), source: 'dashboard' })

  let fileId: string
  let url: string
  try {
    ;({ fileId, url } = await sendToDrive(row, designId))
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    // Put the old record back — its file is untouched and still the one to open.
    await saveDrive(id, meta, previous?.status === 'uploaded' ? previous : { status: 'failed', error: error.slice(0, 300), source: 'dashboard' })
    return { ok: false, error: `Re-upload failed, the old PDF was kept: ${error}` }
  }

  let warning: string | undefined
  if (oldFileId && oldFileId !== fileId) {
    try {
      await composioExec('GOOGLEDRIVE_TRASH_FILE', { file_id: oldFileId, fields: 'id,trashed' })
    } catch (e) {
      // Already deleted by hand is fine; anything else, say so but keep the new file.
      const text = e instanceof Error ? e.message : String(e)
      if (!/not ?found|404/i.test(text)) warning = `New PDF uploaded, but the old one could not be moved to trash: ${text}`
    }
  }

  const drive: DriveMeta = {
    status: 'uploaded',
    file_id: fileId,
    url,
    uploaded_at: new Date().toISOString(),
    source: 'dashboard',
    replaced_file_id: oldFileId,
  }
  await saveDrive(id, meta, drive)
  return warning ? { ok: true, drive, warning } : { ok: true, drive }
}
