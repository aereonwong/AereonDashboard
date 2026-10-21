// Loads reviewed expenses into Supabase — run after supabase/expenses.sql and after checking a scan preview.
//   npm run expense:import -- .expense-data/scan-klia.json --dry    # show what would be added; nothing is sent
//   npm run expense:import -- .expense-data/scan-klia.json          # add them
//
// Safe to run twice: a row whose (vendor, reference, doc_type) already exists is skipped and left exactly as it is, so edits made on
// /expenses/all (a corrected amount, an attached receipt) are never overwritten. Every row must carry a reference
// (booking / order / invoice number): that is what stops the same payment being filed twice.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { DOC_TYPES, KINDS } from '../lib/expenses-math.ts'

const file = process.argv.find((a, i) => i > 1 && !a.startsWith('--'))
const dry = process.argv.includes('--dry')
if (!file) {
  console.error('Usage: npm run expense:import -- <file.json> [--dry]')
  process.exit(1)
}
const rows = JSON.parse(readFileSync(file, 'utf8'))

const bad = []
const clean = rows.map((r, i) => {
  const why = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.spent_on ?? '')) why.push('spent_on')
  if (!KINDS.includes(r.kind)) why.push('kind')
  if (!r.vendor) why.push('vendor')
  if (!r.reference) why.push('reference')
  const currency = r.currency ?? 'MYR'
  if (currency === 'MYR' ? !(r.amount >= 0) : r.original_amount == null) why.push(currency === 'MYR' ? 'amount' : 'original_amount')
  if (why.length) bad.push(`#${i + 1} ${r.vendor ?? '?'} ${r.reference ?? '?'}: bad ${why.join(', ')}`)
  return {
    spent_on: r.spent_on,
    kind: r.kind,
    vendor: r.vendor,
    description: r.description ?? null,
    amount: r.amount ?? null,
    amount_estimated: !!r.amount_estimated,
    currency,
    original_amount: currency === 'MYR' ? null : (r.original_amount ?? null),
    doc_type: DOC_TYPES.includes(r.doc_type) ? r.doc_type : 'Receipt',
    paid_with: r.paid_with ?? null,
    reference: r.reference,
    trip: r.trip ?? null,
    recurring: r.recurring ?? null,
    source: r.source ?? 'import',
    source_ref: r.source_ref ?? null,
    notes: r.notes ?? null,
    receipt: r.receipt ?? null, // a receipt already in Drive can be linked at import time
  }
})
if (bad.length) {
  console.error(`Not loading — ${bad.length} row(s) need fixing:\n  ${bad.join('\n  ')}`)
  process.exit(1)
}

const fmt = n => (n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
console.log(`${clean.length} expenses from ${file}; RM total ${fmt(clean.reduce((a, r) => a + (r.doc_type === 'Refund' ? -1 : 1) * (r.amount ?? 0), 0))}`)
if (dry) process.exit(0)

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const db = createClient(url.trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, ''), key.trim(), { auth: { persistSession: false } })

// The unique key is a partial index (only rows with a reference), which an upsert cannot target: read what is already
// there for these vendors and insert only the rest. The key still protects against a race.
const vendors = [...new Set(clean.map(r => r.vendor))]
const have = new Set()
for (const v of vendors) {
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('expense').select('vendor,reference,doc_type').eq('vendor', v).range(from, from + 999)
    if (error) {
      console.error(`${error.message}${/does not exist|schema cache/.test(error.message) ? ' — run supabase/expenses.sql first' : ''}`)
      process.exit(1)
    }
    for (const r of data) have.add(`${r.vendor}|${r.reference}|${r.doc_type}`)
    if (data.length < 1000) break
  }
}
const fresh = clean.filter(r => !have.has(`${r.vendor}|${r.reference}|${r.doc_type}`))
let added = 0
for (let i = 0; i < fresh.length; i += 50) {
  const { data, error } = await db.from('expense').insert(fresh.slice(i, i + 50)).select('id')
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  added += data.length
}
console.log(`✓ ${added} added, ${clean.length - added} already there (left untouched)`)
