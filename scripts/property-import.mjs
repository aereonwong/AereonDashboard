// Loads the Property tab's loan history into Supabase — run once, after supabase/property.sql.
//   npm run property:import -- --dry   work everything out locally and print it; nothing is sent
//   npm run property:import            first load into Supabase (refuses if months already exist)
//   npm run property:import -- --force  overwrite anyway (undoes months recorded on the page)
//
// Everything lives in .property-data/ (git-ignored: the repo is public), bank rates included,
// since which banks they are says who lends to Aereon.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { computeLoan, validate } from '../lib/property-math.ts'

const dry = process.argv.includes('--dry')
const read = f => JSON.parse(readFileSync(new URL(`../.property-data/${f}`, import.meta.url), 'utf8'))
const loans = read('loans.json')
const months = read('loan_months.json')
const issues = read('issues.json')

const rates = read('bank_rates.json')

const fmt = n => (n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
for (const loan of loans) {
  const rows = computeLoan(loan, months.filter(m => m.property_id === loan.id), rates)
  console.log(`\n${loan.name} — ${rows.length} months`)
  for (const r of rows.slice(-6))
    console.log(`  ${r.month.slice(0, 7)}  out ${fmt(r.outstanding_balance).padStart(11)}  int ${fmt(r.interest).padStart(9)}  full ${fmt(r.fullRate).padStart(9)}  saved ${fmt(r.saved).padStart(9)}  ${r.rate ?? '—'}%  ${r.status}`)
  for (const w of validate(rows)) console.log(`  ⚠ ${w.month.slice(0, 7)} ${w.msg}`)
}
if (dry) process.exit(0)

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env')
  process.exit(1)
}
const db = createClient(url.trim().replace(/\/+$/, '').replace(/\/rest\/v\d+$/i, ''), key.trim(), { auth: { persistSession: false } })

const step = async (label, p) => {
  const { error } = await p
  if (error) {
    console.error(`${label}: ${error.message}${/does not exist|schema cache/.test(error.message) ? ' — run supabase/property.sql first' : ''}`)
    process.exit(1)
  }
  console.log(`✓ ${label}`)
}
// One-time load. Once months exist, the page is where figures change: re-running would put
// recorded months back to "pending" and reopen findings marked fixed. --force overrides.
const { count } = await db.from('property_loan_month').select('*', { count: 'exact', head: true })
if (count && !process.argv.includes('--force')) {
  console.error(`Already loaded (${count} months in Supabase). Nothing changed. Use --force to overwrite with .property-data/.`)
  process.exit(1)
}
await step(`${rates.length} bank rates`, db.from('property_bank_rate').upsert(rates))
await step(`${loans.length} loans`, db.from('property_loan').upsert(loans))
await step(`${months.length} months`, db.from('property_loan_month').upsert(months.map(m => ({ ...m, updated_at: new Date().toISOString() }))))
// Findings are replaced as a set, so re-running never duplicates them.
await step('old findings cleared', db.from('property_data_issue').delete().gte('id', 0))
await step(`${issues.length} findings`, db.from('property_data_issue').insert(issues))
