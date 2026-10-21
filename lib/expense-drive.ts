import 'server-only'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composioExec } from './composio-exec'
import { getSetting } from './settings'

// 👉 Filing expense receipts in Google Drive, the same way invoices are filed: the server hands the file to
// Drive through Composio (no model in the loop) and records where it landed on the expense row.
//
//   One Drive folder (Aereon's "To Process" folder), every receipt in it, named
//   YYYYMMDD - <item> - <vendor / order id>.pdf   (see receiptFilename in lib/expenses-math.ts)
//
// The names sort by date on their own, and the month CSVs sit in the same folder. The folder id lives in the
// `expense_export` setting — change the folder by writing a new value there, not by editing code.

export type ExpenseExportConfig = { driveFolderId: string; driveFolderName: string }

const DEFAULT_CONFIG: ExpenseExportConfig = { driveFolderId: '1mUamjl2DttIAQSkIw4_73h8N_pLs_n9N', driveFolderName: 'To Process' }

export type Filed = { fileId: string; url: string; name: string }

export async function expenseFolder(): Promise<string> {
  return (await getSetting<ExpenseExportConfig>('expense_export', DEFAULT_CONFIG)).driveFolderId || DEFAULT_CONFIG.driveFolderId
}

/** Put one file into the Expenses folder. `bytes` go through a temp file, because Drive's upload tool takes a path. */
export async function fileToDrive(name: string, bytes: Uint8Array): Promise<Filed> {
  const folderId = await expenseFolder()
  const dir = await mkdtemp(join(tmpdir(), 'expense-'))
  try {
    const path = join(dir, name)
    await writeFile(path, bytes)
    const res = await composioExec<any>('GOOGLEDRIVE_UPLOAD_FILE', { file_to_upload: path, folder_to_upload_to: folderId })
    const file = res?.file ?? res?.response_data ?? res
    const fileId = String(file?.id ?? '')
    if (!fileId) throw new Error('Google Drive did not return a file id')
    return { fileId, url: String(file?.webViewLink ?? `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`), name }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** Move a file to Drive's trash (kept 30 days) — used when a receipt is replaced. Already gone is fine. */
export async function trashDriveFile(fileId: string): Promise<string | null> {
  try {
    await composioExec('GOOGLEDRIVE_TRASH_FILE', { file_id: fileId, fields: 'id,trashed' })
    return null
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    return /not ?found|404/i.test(text) ? null : text
  }
}

/** Which months have been sent to Drive as a CSV, and where (kept in the `expense_month_exports` setting). */
export type MonthExport = { url: string; fileId: string; at: string; count: number }

export async function monthExports(): Promise<Record<string, MonthExport>> {
  return getSetting<Record<string, MonthExport>>('expense_month_exports', {})
}
