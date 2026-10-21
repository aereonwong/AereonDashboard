// Files the receipt of expenses that came from Gmail: downloads the email's PDF attachment and uploads it to the Drive
// Expenses folder (the `expense_export` setting, "To Process" by default), named by receiptFilename (lib/expenses-math.ts),
// then records the Drive link on the expense row so the page shows "Filed".
//   npm run expense:receipts -- --vendor "KLIA Ekspres" --dry     # list what would be filed
//   npm run expense:receipts -- --vendor "KLIA Ekspres" [--limit 1]
//   npm run expense:receipts -- --vendor "Trip.com" --kind hotel --pick e-receipt   # the attachment whose name matches
// Only rows that have source_ref.gmail_id and no filed receipt yet are touched, so it is safe to run twice.
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { exec, getMessage } from './_gmail.mjs'
import { receiptFilename } from '../lib/expenses-math.ts'

const args = process.argv.slice(2)
const flag = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const VENDOR = flag('--vendor')
const LIMIT = Number(flag('--limit') ?? 1000)
const DRY = args.includes('--dry')
const KIND = flag('--kind')
const PICK = flag('--pick') ? new RegExp(flag('--pick'), 'i') : null // which attachment is the receipt, by file name
if (!VENDOR) {
  console.error('Usage: npm run expense:receipts -- --vendor "<vendor>" [--limit n] [--dry]')
  process.exit(1)
}

const db = createClient(process.env.SUPABASE_URL.trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, ''), process.env.SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false } })

const { data: setting } = await db.from('records').select('meta').eq('category', 'doc').eq('status', 'setting').eq('title', 'setting:expense_export').limit(1)
const FOLDER = setting?.[0]?.meta?.value?.driveFolderId || '1mUamjl2DttIAQSkIw4_73h8N_pLs_n9N'

let q = db.from('expense').select('*').eq('vendor', VENDOR).order('spent_on')
if (KIND) q = q.eq('kind', KIND)
const { data: rows, error } = await q
if (error) throw new Error(error.message)
const todo = rows.filter(r => r.source_ref?.gmail_id && r.receipt?.status !== 'filed' && r.receipt?.status !== 'waived').slice(0, LIMIT)
console.log(`${todo.length} of ${rows.length} ${VENDOR} expenses need a receipt → Drive folder ${FOLDER}`)

let done = 0
for (const r of todo) {
  const msg = await getMessage(r.source_ref.gmail_id)
  const att = (msg.attachmentList ?? []).find(a => (PICK ? PICK.test(a.filename ?? '') : r.source_ref.attachment ? a.filename === r.source_ref.attachment : /pdf/i.test(a.mimeType ?? '')))
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
    const got = await exec('GMAIL_GET_ATTACHMENT', { message_id: msg.messageId, attachment_id: att.attachmentId, file_name: att.filename ?? 'receipt.pdf' })
    const res = await fetch(got.file.s3url)
    if (!res.ok) throw new Error(`download failed (${res.status})`)
    const path = join(dir, name)
    await writeFile(path, Buffer.from(await res.arrayBuffer()))
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
    const { error: e2 } = await db.from('expense').update({ receipt, updated_at: new Date().toISOString() }).eq('id', r.id)
    if (e2) throw new Error(e2.message)
    done++
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.log(`  ✗ ${r.spent_on} ${r.reference}: ${e.message}`)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
console.log(DRY ? 'dry run: nothing uploaded' : `${done} receipts filed`)
