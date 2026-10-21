import 'server-only'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { composioExec } from './composio-exec'
import { getSetting, setSetting } from './settings'
import { monthFolder } from './expenses-math'

// 👉 Filing expense receipts in Google Drive, the same way invoices are filed: the server hands the file to
// Drive through Composio (no model in the loop) and records where it landed on the expense row.
//
//   My Drive / 02 SY Creative / Expenses & Receipts / 2026-10 / <date> - <vendor> - <what> - RM <amount>.pdf
//
// One folder per month, so the accountant can take a month at a time. The root folder is found (or made) once and
// its id kept in the `expense_export` setting — change the folder by writing a new value there, not by editing code.

export type ExpenseExportConfig = { driveFolderId: string; driveFolderName: string }

const ROOT_NAME = 'Expenses & Receipts'
const PARENT_NAME = '02 SY Creative'
const DEFAULT_CONFIG: ExpenseExportConfig = { driveFolderId: '', driveFolderName: ROOT_NAME }

type DriveFile = { id?: string; name?: string; webViewLink?: string }

async function findFolder(name: string, parentId?: string): Promise<DriveFile | null> {
  const res = await composioExec<{ files?: DriveFile[] }>('GOOGLEDRIVE_FIND_FOLDER', {
    name_exact: name,
    page_size: 5,
    ...(parentId ? { parent_folder_id: parentId } : {}),
  })
  return res?.files?.find(f => f.id) ?? null
}

async function makeFolder(name: string, parentId?: string): Promise<string> {
  const res = await composioExec<any>('GOOGLEDRIVE_CREATE_FOLDER', { name, ...(parentId ? { parent_id: parentId } : {}) })
  const f = res?.file ?? res?.response_data ?? res
  const id = String(f?.id ?? '')
  if (!id) throw new Error(`Google Drive did not return an id for the folder "${name}"`)
  return id
}

async function ensureFolder(name: string, parentId?: string): Promise<string> {
  return (await findFolder(name, parentId))?.id ?? (await makeFolder(name, parentId))
}

/** The folder every month folder sits in. Made on first use, under "02 SY Creative" when that exists. */
export async function expenseRootFolder(): Promise<string> {
  const config = await getSetting<ExpenseExportConfig>('expense_export', DEFAULT_CONFIG)
  if (config.driveFolderId) return config.driveFolderId
  const parent = await findFolder(PARENT_NAME)
  const id = await ensureFolder(config.driveFolderName || ROOT_NAME, parent?.id)
  await setSetting('expense_export', { driveFolderId: id, driveFolderName: config.driveFolderName || ROOT_NAME })
  return id
}

export type Filed = { fileId: string; url: string; name: string }

/** Put one file into the month's folder. `bytes` go through a temp file, because Drive's upload tool takes a path. */
export async function fileToDrive(spentOn: string, name: string, bytes: Uint8Array): Promise<Filed> {
  const root = await expenseRootFolder()
  const folderId = await ensureFolder(monthFolder(spentOn), root)
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
