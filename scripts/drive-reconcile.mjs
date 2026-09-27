// One-time back-fill: record which invoices are ALREADY in Google Drive, so the
// dashboard shows them as "In Drive" without ever re-uploading or re-searching.
// Runs from this Mac through the Composio CLI Aereon is logged into (the same
// trick as ig-refresh.mjs) — no API key and no model involved.
//
//   npm run drive:reconcile               # dry run: prints what it WOULD record
//   npm run drive:reconcile -- --write    # records it on the invoice rows
//   npm run drive:reconcile -- --year 2025 --write
//
// How a Drive file is matched to an invoice row:
//   1. By invoice number — the back catalogue is named "SYCP-YYYYMM-NNN - Job.pdf".
//   2. When several files (or several rows — the old book reused numbers) share
//      a number, by how many words of the job name the filename shares, then by
//      folder: the export folder "SYCP Client Invoice" or a folder inside it
//      wins over copies elsewhere (the accountant's "Processed" folders).
// Rows that already carry meta.drive are left alone. Nothing in Drive changes.
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { createClient } from '@supabase/supabase-js'

const run = promisify(execFile)
const CLI = `${process.env.HOME}/.local/bin/composio`
const args = process.argv.slice(2)
const WRITE = args.includes('--write')
const YEAR = args.includes('--year') ? args[args.indexOf('--year') + 1] : '2026'

async function exec(slug, data) {
  const { stdout } = await run(CLI, ['execute', slug, '-d', JSON.stringify(data)], {
    maxBuffer: 1 << 26,
    env: { ...process.env, NO_COLOR: '1' },
  })
  const json = JSON.parse(stdout)
  if (json.successful === false) throw new Error(`${slug}: ${json.error ?? 'failed'}`)
  if (json.storedInFile && json.outputFilePath) {
    const stored = JSON.parse(await readFile(json.outputFilePath, 'utf8'))
    return stored.data ?? stored
  }
  return json.data
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

// The export folder comes from the same setting the app uses (lib/invoice-export.ts).
const { data: setting } = await db
  .from('records')
  .select('meta')
  .eq('category', 'doc')
  .eq('status', 'setting')
  .eq('title', 'setting:invoice_export')
  .limit(1)
const EXPORT = setting?.[0]?.meta?.value?.driveFolderId ?? '1NQJsEAXTN6iSiuiNG_DhQ7aeUU2b9srW'

// ── Drive: every invoice PDF for the year, in one or two list calls ─────────
const files = []
let pageToken
do {
  const page = await exec('GOOGLEDRIVE_FIND_FILE', {
    q: `name contains 'SYCP-${YEAR}' and trashed = false and mimeType = 'application/pdf'`,
    fields: 'nextPageToken, files(id,name,parents,createdTime,webViewLink)',
    pageSize: 200,
    ...(pageToken ? { pageToken } : {}),
  })
  files.push(...(page.files ?? []))
  pageToken = page.nextPageToken
} while (pageToken)

// Which folders sit directly inside the export folder (e.g. "Invoice 2026").
const parentOf = new Map()
for (const id of new Set(files.flatMap(f => f.parents ?? []))) {
  if (id === EXPORT) continue
  const meta = await exec('GOOGLEDRIVE_GET_FILE_METADATA', { fileId: id, fields: 'id,name,parents' }).catch(() => null)
  parentOf.set(id, { name: meta?.name ?? '?', parent: meta?.parents?.[0] })
}
const folderScore = f => {
  const p = f.parents?.[0]
  if (p === EXPORT) return 3
  if (parentOf.get(p)?.parent === EXPORT) return 2
  return 0
}
const folderName = f => (f.parents?.[0] === EXPORT ? 'SYCP Client Invoice' : parentOf.get(f.parents?.[0])?.name ?? '?')

// ── Database: the year's invoices ────────────────────────────────────────────
const { data: rows, error } = await db.from('records').select('id, title, notes, meta').eq('category', 'cash_in').limit(3000)
if (error) throw error
const invoices = rows.filter(r => String(r.meta?.invoice_date ?? '').startsWith(YEAR) && r.meta?.invoice_no)

const words = s =>
  new Set(
    String(s ?? '')
      .toLowerCase()
      .replace(/\.pdf$/, '')
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 2 && !/^sycp$|^\d{6}$|^\d{3}$/.test(w)),
  )
const overlap = (a, b) => [...a].filter(w => b.has(w)).length
const noOf = name => (name.match(/SYCP-\d{6}-\d{3}/) ?? [])[0]

const byNo = new Map()
for (const f of files) {
  const no = noOf(f.name)
  if (no) byNo.set(no, [...(byNo.get(no) ?? []), f])
}

// Score every (row, file) pair that shares a number, then assign best-first so
// a file is never given to two rows.
const pairs = []
for (const r of invoices) {
  const rowWords = words(`${r.meta.job ?? ''} ${r.notes ?? ''} ${r.title ?? ''} ${r.meta.customer ?? ''}`)
  for (const f of byNo.get(r.meta.invoice_no) ?? []) {
    const nameWords = words(f.name.split(' - ').slice(1).join(' - '))
    pairs.push({ r, f, score: overlap(rowWords, nameWords) * 10 + folderScore(f), created: f.createdTime })
  }
}
pairs.sort((a, b) => b.score - a.score || String(b.created).localeCompare(String(a.created)))
const usedFile = new Set()
const match = new Map()
for (const p of pairs) {
  if (match.has(p.r.id) || usedFile.has(p.f.id)) continue
  match.set(p.r.id, p.f)
  usedFile.add(p.f.id)
}

// ── Report, and write when asked ─────────────────────────────────────────────
let wrote = 0
let kept = 0
const missing = []
for (const r of invoices.sort((a, b) => String(a.meta.invoice_no).localeCompare(String(b.meta.invoice_no)))) {
  const f = match.get(r.id)
  if (r.meta.drive?.status === 'uploaded') {
    kept++
    continue
  }
  if (!f) {
    missing.push(`${r.meta.invoice_no}  ${r.meta.customer ?? ''}`)
    continue
  }
  // A file the bot already recorded wins over a search result.
  const fileId = r.meta.render?.drive_file_id ?? f.id
  const drive = {
    status: 'uploaded',
    file_id: fileId,
    url: fileId === f.id ? f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view` : r.meta.render?.drive_url,
    uploaded_at: fileId === f.id ? f.createdTime : r.meta.render?.rendered_at ?? f.createdTime,
    source: 'reconciled',
  }
  console.log(`${WRITE ? 'record' : 'would record'}  ${r.meta.invoice_no}  →  ${f.name}   [${folderName(f)}]`)
  if (WRITE) {
    const { error: e } = await db.from('records').update({ meta: { ...r.meta, drive } }).eq('id', r.id)
    if (e) console.error(`  failed: ${e.message}`)
    else wrote++
  }
}

console.log(`\n${YEAR}: ${invoices.length} invoices · ${files.length} PDFs found in Drive · ${match.size} matched`)
if (kept) console.log(`${kept} already recorded as in Drive — left alone`)
if (missing.length) console.log(`Not in Drive (${missing.length}) — these stay "Not uploaded":\n  ${missing.join('\n  ')}`)
console.log(WRITE ? `Recorded ${wrote} invoice${wrote === 1 ? '' : 's'}.` : 'Dry run — nothing written. Add --write to record.')
