import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { composioExec } from './composio-exec'
import { designIdOf, exportPdfUrl } from './invoice-canva'
import { driveStatus, driveViewUrl, type DriveMeta } from './invoice-drive'
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

export async function uploadInvoiceToDrive(id: number): Promise<UploadResult> {
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const { data: row } = await supabase.from('records').select('id, title, notes, meta').eq('id', id).eq('category', 'cash_in').single()
  if (!row?.meta?.invoice_no) return { ok: false, error: 'Invoice not found' }

  // Already there, or already on its way: never upload twice.
  const status = driveStatus(row)
  if (status === 'uploaded') return { ok: true, drive: row.meta.drive ?? { status: 'uploaded' } }
  if (status === 'uploading') return { ok: false, error: 'An upload for this invoice is already running' }

  const designId = designIdOf(row)
  if (!designId) return { ok: false, error: 'This invoice has no Canva design linked, so there is no PDF to file' }

  const meta = row.meta
  await saveDrive(id, meta, { status: 'uploading', started_at: new Date().toISOString(), source: 'dashboard' })

  try {
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

    const drive: DriveMeta = {
      status: 'uploaded',
      file_id: fileId,
      url: String(file?.webViewLink ?? driveViewUrl(fileId)),
      uploaded_at: new Date().toISOString(),
      source: 'dashboard',
    }
    await saveDrive(id, meta, drive)
    return { ok: true, drive }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e)
    await saveDrive(id, meta, { status: 'failed', error: error.slice(0, 300), source: 'dashboard' })
    return { ok: false, error }
  }
}
