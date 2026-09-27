import type { Rec } from './records'

// 👉 Where an invoice's PDF stands in Google Drive, recorded on the invoice row
// itself (`meta.drive`) so the dashboard never has to search Drive to know.
//
//   meta.drive = {
//     status:      'uploaded' | 'uploading' | 'failed'   (absent = not uploaded)
//     file_id:     Drive file id
//     url:         Drive view link
//     uploaded_at: ISO timestamp
//     source:      'dashboard' | 'reconciled' | 'bot'
//     error:       last failure, when status = 'failed'
//   }
//
// Filled three ways: the dashboard's upload button (lib/invoice-drive-upload.ts),
// the one-time back-fill of invoices already in Drive
// (scripts/drive-reconcile.mjs), and the bot's own export step.
// This file is import-safe for client components — no server code in it.

export type DriveStatus = 'uploaded' | 'uploading' | 'failed' | 'none'

export type DriveMeta = {
  status: Exclude<DriveStatus, 'none'>
  file_id?: string
  url?: string
  uploaded_at?: string
  started_at?: string
  source?: 'dashboard' | 'reconciled' | 'bot'
  error?: string
}

/** An upload still "uploading" after this long died mid-way; allow a retry. */
export const STALE_UPLOAD_MS = 5 * 60 * 1000

export function driveOf(r: Pick<Rec, 'meta'>): DriveMeta | null {
  const m = r.meta ?? {}
  if (m.drive?.status) return m.drive as DriveMeta
  // The bot's export step (27 Sep 2026) recorded the file inside `render`.
  if (m.render?.drive_file_id) {
    return {
      status: 'uploaded',
      file_id: String(m.render.drive_file_id),
      url: m.render.drive_url ? String(m.render.drive_url) : undefined,
      uploaded_at: m.render.rendered_at,
      source: 'bot',
    }
  }
  return null
}

export function driveStatus(r: Pick<Rec, 'meta'>, now = Date.now()): DriveStatus {
  const d = driveOf(r)
  if (!d) return 'none'
  if (d.status === 'uploading' && d.started_at && now - Date.parse(d.started_at) > STALE_UPLOAD_MS) return 'failed'
  return d.status
}

/** A direct-download link for a PDF already in Drive — no API call at all. */
export const driveDownloadUrl = (fileId: string) =>
  `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`

export const driveViewUrl = (fileId: string) => `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`
