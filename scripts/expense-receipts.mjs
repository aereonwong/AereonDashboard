// Files the receipt of expenses that came from Gmail: downloads the email's PDF attachment and uploads it to the Drive
// Expenses folder (the `expense_export` setting, "To Process" by default), named by receiptFilename (lib/expenses-math.ts),
// then records the Drive link on the expense row so the page shows "Filed".
//   npm run expense:receipts -- --vendor "KLIA Ekspres" --dry     # list what would be filed
//   npm run expense:receipts -- --vendor "KLIA Ekspres" [--limit 1]
//   npm run expense:receipts -- --vendor "Trip.com" --kind hotel --pick e-receipt   # the attachment whose name matches
//   npm run expense:receipts -- --vendor Google --folder <driveFolderId>   # another folder; rows marked source_ref.render have no
//                                                                          # attachment, so the email itself is printed to PDF (headless Chrome)
// Only rows that have source_ref.gmail_id and no filed receipt yet are touched, so it is safe to run twice.
import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { exec, getMessage } from './_gmail.mjs'
import { receiptFilename } from '../lib/expenses-math.ts'

const run = promisify(execFile)
const args = process.argv.slice(2)
const flag = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const VENDOR = flag('--vendor')
const LIMIT = Number(flag('--limit') ?? 1000)
const DRY = args.includes('--dry')
const KIND = flag('--kind')
const FOLDER_ARG = flag('--folder')
const REDO = args.includes('--redo') // print and file again, then move the old file to Drive's trash
const PICK = flag('--pick') ? new RegExp(flag('--pick'), 'i') : null // which attachment is the receipt, by file name
if (!VENDOR) {
  console.error('Usage: npm run expense:receipts -- --vendor "<vendor>" [--limit n] [--dry]')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, ''), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false } })

const { data: setting } = await db.from('records').select('meta').eq('category', 'doc').eq('status', 'setting').eq('title', 'setting:expense_export').limit(1)
const FOLDER = FOLDER_ARG || setting?.[0]?.meta?.value?.driveFolderId || '1mUamjl2DttIAQSkIw4_73h8N_pLs_n9N'

let q = db.from('expense').select('*').eq('vendor', VENDOR).order('spent_on')
if (KIND) q = q.eq('kind', KIND)
const { data: rows, error } = await q
if (error) throw new Error(error.message)
const todo = rows.filter(r => r.source_ref?.gmail_id && (REDO || (r.receipt?.status !== 'filed' && r.receipt?.status !== 'waived'))).slice(0, LIMIT)
console.log(`${todo.length} of ${rows.length} ${VENDOR} expenses need a receipt → Drive folder ${FOLDER}`)

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const esc = t => String(t ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c])
/** The email itself, printed to PDF: a small header (subject, from, date) then the message as it arrived. */
async function printEmail(msg, htmlPath, pdfPath) {
  const head = `<div style="font:12px Arial;color:#444;border-bottom:1px solid #ccc;margin-bottom:12px;padding-bottom:8px"><b>${esc(msg.subject)}</b><br>From: ${esc(msg.sender)}<br>Date: ${esc(msg.messageTimestamp)}<br>To: ${esc(msg.to)}</div>`
  // Some senders (AirAsia) keep their real content in the HTML part and only a one-line text part in messageText.
  const walk = (p, out = []) => {
    if (p?.body?.data) out.push({ mime: p.mimeType, text: Buffer.from(p.body.data, 'base64url').toString('utf8') })
    ;(p?.parts ?? []).forEach(x => walk(x, out))
    return out
  }
  const html = walk(msg.payload).find(p => p.mime === 'text/html')?.text
  await writeFile(htmlPath, `<!doctype html><meta charset="utf-8">${head}${html && html.length > String(msg.messageText ?? '').length ? html : msg.messageText}`)
  await run(CHROME, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, `file://${htmlPath}`], { timeout: 60_000 }).catch(() => {})
  const { size } = await stat(pdfPath).catch(() => ({ size: 0 }))
  if (!size) throw new Error('could not print the email to PDF')
  if (size > 5 * 1024 * 1024) throw new Error('printed PDF is over Drive upload limit (5 MB)')
}

let done = 0
for (const r of todo) {
  const msg = await getMessage(r.source_ref.gmail_id)
  const render = !!r.source_ref.render
  const att = render ? { filename: 'receipt.pdf' } : (msg.attachmentList ?? []).find(a => (PICK ? PICK.test(a.filename ?? '') : r.source_ref.attachment ? a.filename === r.source_ref.attachment : /pdf/i.test(a.mimeType ?? '')))
  if (!att) {
    console.log(`  ✗ ${r.spent_on} ${r.reference}: no matching attachment`)
    continue
  }
  // The stay dates stay in the description; the file name carries the hotel's name only.
  const name = receiptFilename({ ...r, description: r.description?.replace(/ — check-in .*$/, '') ?? null }, att.filename?.match(/\.(\w+)$/)?.[1] ?? 'pdf')
  if (DRY) {
    console.log(`  · ${name}`)
    continue
  }
  const dir = await mkdtemp(join(tmpdir(), 'receipt-'))
  try {
    const path = join(dir, name)
    if (render) {
      await printEmail(msg, join(dir, 'mail.html'), path)
    } else {
      const got = await exec('GMAIL_GET_ATTACHMENT', { message_id: msg.messageId, attachment_id: att.attachmentId, file_name: att.filename ?? 'receipt.pdf' })
      const res = await fetch(got.file.s3url)
      if (!res.ok) throw new Error(`download failed (${res.status})`)
      await writeFile(path, Buffer.from(await res.arrayBuffer()))
    }
    // Drive limits requests per minute: wait a little between files, and once more if it still says "quota".
    await new Promise(r => setTimeout(r, 2500))
    const upload = () => exec('GOOGLEDRIVE_UPLOAD_FILE', { file_to_upload: path, folder_to_upload_to: FOLDER })
    const up = await upload().catch(async e => {
      if (!/quota/i.test(e.message)) throw e
      await new Promise(r => setTimeout(r, 45_000))
      return upload()
    })
    const file = up?.file ?? up?.response_data ?? up
    const id = String(file?.id ?? '')
    if (!id) throw new Error('Drive did not return a file id')
    const url = String(file?.webViewLink ?? `https://drive.google.com/file/d/${id}/view`)
    const receipt = { status: 'filed', file_id: id, url, name, uploaded_at: new Date().toISOString(), source: 'gmail' }
    const oldId = REDO && r.receipt?.status === 'filed' ? r.receipt.file_id : null
    const { error: e2 } = await db.from('expense').update({ receipt, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (e2) throw new Error(e2.message)
    if (oldId && oldId !== id) await exec('GOOGLEDRIVE_TRASH_FILE', { file_id: oldId, fields: 'id,trashed' }).catch(e => console.log(`    (old file not trashed: ${e.message.slice(0, 80)})`))
    done++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  ✗ ${r.spent_on} ${r.reference}: ${e.message}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
console.log(DRY ? 'dry run: nothing uploaded' : `${done} receipts filed`)
