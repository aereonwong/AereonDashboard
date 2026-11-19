// Reads the company's Hong Leong current-account statements (the PDFs the accountant keeps in Google Drive) and turns
// every line into one bank transaction. Real figures never enter the repo: PDFs and the output live in the git-ignored
// .bank-data/ folder, and `--upload` writes them to the Supabase `bank_txn` table (supabase/bank.sql).
//
//   npm run bank:fetch                 download any statement not in .bank-data/pdf yet (Composio, Google Drive)
//   npm run bank:parse                 PDFs → .bank-data/transactions.json, checking every running balance
//   npm run bank:parse -- --upload     … and upsert them into bank_txn (safe to repeat)
//
// Layout (every statement since 2022 is the same): columns are told apart by where each figure ENDS on the page —
// Deposit ≈ x 398, Withdrawal ≈ x 477, Balance ≈ x 557. A row starts with its date at the left edge; the lines under it
// (x ≈ 102) are its description: transaction type, the payer's reference, the payer's name, a bank reference.
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const DIR = '.bank-data'
const PDF = join(DIR, 'pdf')
const SWIFT = fileURLToPath(new URL('./pdf-words.swift', import.meta.url))
// The accountant's statement folders (Monthly + Daily), comma-separated Drive ids in .env BANK_DRIVE_FOLDERS —
// kept out of this public repo.
const readEnv = async () => Object.fromEntries((await readFile('.env', 'utf8')).split('\n').filter(l => /^[A-Z_]+=/.test(l)).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')]))

const num = s => Number(String(s).replace(/,/g, ''))
const AMOUNT = /^-?[\d,]*\.\d\d$/
const DATE = /^(\d\d)-(\d\d)-(\d{4})$/

async function composio(slug, data) {
  const { stdout } = await run('composio', ['execute', slug, '-d', JSON.stringify(data)], { maxBuffer: 1 << 26 })
  return JSON.parse(stdout.slice(stdout.indexOf('{')))
}

async function fetchAll() {
  await mkdir(PDF, { recursive: true })
  const have = new Set(await readdir(PDF))
  const FOLDERS = ((await readEnv()).BANK_DRIVE_FOLDERS ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (!FOLDERS.length) throw new Error('Set BANK_DRIVE_FOLDERS in .env (the statement folders\' Drive ids, comma-separated)')
  for (const folder of FOLDERS) {
    const res = await composio('GOOGLEDRIVE_FIND_FILE', { q: `'${folder}' in parents and mimeType = 'application/pdf' and trashed = false`, pageSize: 1000 })
    const files = res.data?.files ?? []
    for (const f of files) {
      if (have.has(f.name)) continue
      const got = await composio('GOOGLEDRIVE_DOWNLOAD_FILE', { fileId: f.id })
      const url = got.data?.downloaded_file_content?.s3url
      if (!url) { console.warn('could not download', f.name); continue }
      const r = await fetch(url)
      await writeFile(join(PDF, f.name), Buffer.from(await r.arrayBuffer()))
      console.log('downloaded', f.name)
    }
  }
}

// One statement → { period, opening, closing, totals, rows }
async function parseStatement(file) {
  const { stdout } = await run('swift', [SWIFT, join(PDF, file)], { maxBuffer: 1 << 24 })
  const lines = stdout.trim().split('\n').map(l => {
    const [page, x, y, x2, ...t] = l.split('\t')
    return { page: +page, x: +x, y: +y, x2: +x2, text: t.join('\t') }
  }).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x)
  const all = lines.map(l => l.text).join('\n')
  if (!/CURRENT ACCOUNT STATEMENT/.test(all)) return null // a different report (e.g. a one-off transaction search)
  const account = (all.match(/A\/C No \/ No Akaun : (\d+)/) ?? [])[1] ?? ''
  const per = all.match(/: (\d\d)\/(\d\d)\/(\d\d) - (\d\d)\/(\d\d)\/(\d\d)/)
  const period = per ? { from: `20${per[3]}-${per[2]}-${per[1]}`, to: `20${per[6]}-${per[5]}-${per[4]}` } : null
  const totW = all.match(/Total Withdrawals \/ Jumlah Pengeluaran : (\d+) ([\d,]*\.\d\d)/)
  const totD = all.match(/Total Deposits \/ Jumlah Simpanan : (\d+) ([\d,]*\.\d\d)/)
  const closing = all.match(/Closing Balance \/ Baki Akhir : (-?[\d,]*\.\d\d)/)

  let opening = null
  const rows = []
  let cur = null
  for (const l of lines) {
    // only the transaction table: below the column headings, above the totals / footer
    if (l.y < 265 || /^Total (Withdrawals|Deposits)|^Important Notices|^Hong Leong Bank Berhad/.test(l.text)) continue
    if (/^\d{11}_\d/.test(l.text)) continue // page stamp in the right margin
    if (l.x > 330 && AMOUNT.test(l.text)) {
      const col = l.x2 <= 410 ? 'deposit' : l.x2 <= 500 ? 'withdrawal' : 'balance'
      if (!cur) { if (col === 'balance' && opening === null) opening = num(l.text); continue }
      if (cur[col] != null && col !== 'balance') throw new Error(`${file}: two ${col} figures on ${cur.date}`)
      cur[col] = num(l.text)
      continue
    }
    if (l.x < 100 && DATE.test(l.text)) {
      const [, d, mo, y] = l.text.match(DATE)
      cur = { date: `${y}-${mo}-${d}`, desc: [], deposit: null, withdrawal: null, balance: null, page: l.page }
      rows.push(cur)
      continue
    }
    if (l.x >= 100 && l.x < 330 && cur) cur.desc.push(l.text)
    else if (l.x >= 100 && l.x < 330 && /Balance from previous statement/.test(l.text)) continue
  }
  return { file, account, period, opening, closing: closing ? num(closing[1]) : null,
    totals: { deposits: totD ? num(totD[2]) : null, depositCount: totD ? +totD[1] : null, withdrawals: totW ? num(totW[2]) : null, withdrawalCount: totW ? +totW[1] : null },
    rows }
}

// Each statement must add up: opening + deposits − withdrawals = every printed balance, and the bank's own totals.
function check(st) {
  const problems = []
  let bal = st.opening ?? 0
  for (const r of st.rows) {
    if ((r.deposit == null) === (r.withdrawal == null)) problems.push(`${r.date} ${r.desc[0]}: needs exactly one of deposit / withdrawal`)
    bal = Math.round((bal + (r.deposit ?? 0) - (r.withdrawal ?? 0)) * 100) / 100
    if (r.balance != null && Math.abs(r.balance - bal) > 0.005) problems.push(`${r.date} ${r.desc[0]}: balance ${r.balance} ≠ worked out ${bal}`)
  }
  const dep = st.rows.reduce((s, r) => s + (r.deposit ?? 0), 0)
  const wd = st.rows.reduce((s, r) => s + (r.withdrawal ?? 0), 0)
  if (st.totals.deposits != null && Math.abs(dep - st.totals.deposits) > 0.005) problems.push(`deposits add to ${dep.toFixed(2)}, bank says ${st.totals.deposits}`)
  if (st.totals.withdrawals != null && Math.abs(wd - st.totals.withdrawals) > 0.005) problems.push(`withdrawals add to ${wd.toFixed(2)}, bank says ${st.totals.withdrawals}`)
  if (st.closing != null && Math.abs(bal - st.closing) > 0.005) problems.push(`closing ${st.closing} ≠ worked out ${bal}`)
  return problems
}

// The description lines → type / reference / counterparty. HLB prints: type, then (for transfers) the payer's own
// note, the payer's name, and a long bank reference (e.g. 20260928HLBBMYKL010OCB14189073).
function describe(desc) {
  const type = desc[0] ?? ''
  const rest = desc.slice(1).filter(s => s !== '-')
  const bankRef = rest.find(s => /^\d{8}[A-Z]{4}MYKL|^[A-Z0-9]{14,}$/.test(s) && !/\s/.test(s)) ?? null
  const words = rest.filter(s => s !== bankRef)
  // the payer's name is the last line that looks like a name (letters, no long digit run)
  let party = null
  for (let i = words.length - 1; i >= 0; i--) {
    if (/[A-Za-z]{2}/.test(words[i]) && !/\d{5,}/.test(words[i]) && !/^(Interbank GIRO|DuitNow Transfer|CIMB IBG Transfer|IBG|Instant Transfer)$/i.test(words[i])) { party = words[i]; break }
  }
  // a name can wrap onto a second line (all caps, short)
  const pi = words.lastIndexOf(party)
  if (party && pi > 0 && /^[A-Z .&()'-]+$/.test(words[pi - 1]) && /^[A-Z .&()'-]+$/.test(party) && party.length < 12 && /(SDN|BHD|LIM|YEE)\b/.test(words[pi - 1]) === false) {
    // leave as is: a short last line is usually the wrapped tail of the name
    party = `${words[pi - 1]} ${party}`
  }
  const note = words.filter(s => s !== party && !(party ?? '').includes(s) && !/^(Interbank GIRO|DuitNow Transfer|CIMB IBG Transfer)$/i.test(s)).join(' ') || null
  return { type, party, note, bank_ref: bankRef }
}

async function parseAll() {
  const files = (await readdir(PDF)).filter(f => f.endsWith('.pdf')).sort()
  const statements = []
  for (const f of files) {
    const st = await parseStatement(f)
    if (!st) { console.log('skip (not a statement):', f); continue }
    statements.push(st)
  }
  statements.sort((a, b) => (a.period?.from ?? '').localeCompare(b.period?.from ?? ''))
  let bad = 0
  const seen = new Set()
  const txns = []
  for (const st of statements) {
    const problems = check(st)
    if (problems.length) { bad++; console.log(`✗ ${st.file} (${st.period?.from} → ${st.period?.to})\n  ` + problems.join('\n  ')) }
    const key = `${st.period?.from}|${st.period?.to}`
    if (seen.has(key)) { console.log('skip duplicate period:', st.file); continue }
    seen.add(key)
    st.rows.forEach((r, i) => txns.push({
      account: st.account.slice(-4), statement: st.period?.to, seq: i + 1, txn_date: r.date,
      amount: Math.round(((r.deposit ?? 0) - (r.withdrawal ?? 0)) * 100) / 100,
      balance: r.balance, ...describe(r.desc), description: r.desc.join(' | '), source_file: st.file,
    }))
  }
  // gaps between statements: each one should open where the last one closed
  for (let i = 1; i < statements.length; i++) {
    const a = statements[i - 1], b = statements[i]
    if (a.closing != null && b.opening != null && Math.abs(a.closing - b.opening) > 0.005) console.log(`gap: ${a.file} closes ${a.closing}, ${b.file} opens ${b.opening}`)
  }
  const kept = statements.filter((s, i) => statements.findIndex(o => o.period?.to === s.period?.to) === i && s.period)
  await writeFile(join(DIR, 'transactions.json'), JSON.stringify({ statements: kept.map(({ rows, ...s }) => ({ ...s, count: rows.length })), txns }, null, 1))
  console.log(`${kept.length} statements, ${txns.length} transactions, ${bad} with problems → ${DIR}/transactions.json`)
  if (bad) process.exitCode = 1
  return { txns, statements: kept, bad }
}

async function upload({ txns, statements, bad }) {
  if (bad) throw new Error('not uploading: some statements do not add up (see above)')
  const { createClient } = await import('@supabase/supabase-js')
  const env = await readEnv()
  const db = createClient(env.SUPABASE_URL.trim(), env.SUPABASE_SERVICE_ROLE_KEY.trim())
  const st = statements.map(s => ({ account: s.account.slice(-4), period_from: s.period.from, period_to: s.period.to, opening: s.opening, closing: s.closing, source_file: s.file }))
  const a = await db.from('bank_statement').upsert(st, { onConflict: 'account,period_to' })
  if (a.error) throw new Error(a.error.message)
  // kind / invoice_ids are never sent, so a re-import keeps whatever the owner set on the page
  for (let i = 0; i < txns.length; i += 500) {
    const { error } = await db.from('bank_txn').upsert(txns.slice(i, i + 500), { onConflict: 'account,statement,seq' })
    if (error) throw new Error(error.message)
  }
  console.log(`uploaded ${st.length} statements and ${txns.length} lines`)
}

const args = process.argv.slice(2)
if (args.includes('--fetch')) await fetchAll()
else {
  if (!existsSync(PDF)) throw new Error('no statements yet — run npm run bank:fetch first')
  const parsed = await parseAll()
  if (args.includes('--upload')) await upload(parsed)
}
