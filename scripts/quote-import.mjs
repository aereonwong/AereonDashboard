// scripts/quote-import.mjs — record the old Canva quotations in the dashboard.
//
//   npm run quote:import -- --dry     show what would happen, change nothing
//   npm run quote:import              insert the quotes, then link invoices
//
// Reads .quote-data/old-quotes.jsonl (one quote per line, read from Canva's
// "Quotation" folder) and .quote-data/links.json (quote → invoices it became).
// Both are git-ignored: client names and amounts never go in the public repo.
//
// Record only: the Canva designs are never touched, and every quote keeps the
// number exactly as printed — they were already sent to clients. Each quote is
// a `doc` row with status 'quotation', so nothing here can count as income.
// Safe to run again: a quote whose Canva design is already on file is skipped,
// and an invoice that already has a quote link keeps it.
import { readFileSync } from 'node:fs'

const dry = process.argv.includes('--dry')
const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '')
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env')
const H = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const api = async (path, init = {}) => {
  const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...H, ...init.headers } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path}: ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

const quotes = readFileSync('.quote-data/old-quotes.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
const links = JSON.parse(readFileSync('.quote-data/links.json', 'utf8'))
const linkOf = new Map([...Object.entries(links.sure), ...Object.entries(links.likely)].map(([d, ids]) => [d, ids]))
const likely = new Set(Object.keys(links.likely))

const existing = await api(`records?select=id,meta&category=eq.doc&status=eq.quotation`)
const onFile = new Set(existing.map(r => r.meta?.canva_design).filter(Boolean))
const invoices = await api(`records?select=id,meta&category=eq.cash_in&meta->>invoice_no=not.is.null&limit=3000`)
const invById = new Map(invoices.map(r => [r.id, r]))

const short = s => (s.length > 60 ? s.slice(0, 57) + '…' : s)
// One spelling per client: a quote takes the invoices' spelling when the names
// match once brackets and company suffixes are set aside ("LSH Service Master
// Sdn Bhd (KL Tower)" → "LSH Service Master Sdn Bhd").
const norm = s => String(s ?? '').toLowerCase().replace(/\(.*?\)/g, ' ').replace(/sdn\.?\s*bhd\.?|berhad|pte\.?\s*ltd\.?|[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
const spelling = new Map()
for (const r of invoices) if (r.meta?.customer && !spelling.has(norm(r.meta.customer))) spelling.set(norm(r.meta.customer), r.meta.customer)
let added = 0
let skipped = 0
const ids = new Map() // design → quote row id
for (const r of existing) if (r.meta?.canva_design) ids.set(r.meta.canva_design, r.id)

for (const q of quotes) {
  if (onFile.has(q.design)) {
    skipped++
    continue
  }
  // A quote that became an invoice takes the invoice's spelling of the client,
  // so both sit under one name on the Clients page.
  const inv = invById.get((linkOf.get(q.design) ?? [])[0])
  const note = [q.title_no && q.title_no !== q.no ? `Canva title says ${q.title_no}.` : '', q.note ?? ''].filter(Boolean).join(' ')
  const row = {
    category: 'doc',
    status: 'quotation',
    amount: q.total ?? 0,
    created_at: `${q.date}T09:00:00+08:00`,
    title: `${q.no} · ${short(q.job)}`,
    notes: q.job,
    meta: {
      customer: inv?.meta?.customer ?? spelling.get(norm(q.client)) ?? q.client,
      contact: q.contact,
      invoice_no: q.no,
      invoice_date: q.date,
      currency: q.currency && q.currency !== 'MYR' ? q.currency : undefined,
      list_price: q.list_price,
      discount: q.discount,
      job: q.job,
      venue: q.venue,
      event_date: q.event_date,
      no_total: q.total == null ? true : undefined,
      pages: q.pages,
      quote_note: note || undefined,
      canva_design: q.design,
      canva_url: `https://www.canva.com/design/${q.design}/view`,
      source: 'canva_quote',
      imported_at: new Date().toISOString(),
    },
  }
  if (dry) {
    console.log(`+ ${q.no.padEnd(22)} ${q.date}  ${String(row.meta.customer).slice(0, 34).padEnd(34)} ${q.total ?? 'options'}`)
    added++
    continue
  }
  const [made] = await api('records', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(row) })
  ids.set(q.design, made.id)
  added++
}

let linked = 0
let kept = 0
for (const [design, invIds] of linkOf) {
  const qid = ids.get(design)
  for (const id of invIds) {
    const inv = invById.get(id)
    if (!inv) throw new Error(`Invoice row ${id} not found`)
    if (inv.meta?.quotation_id) {
      kept++
      continue
    }
    const how = likely.has(design) ? 'import-likely' : 'import'
    if (dry) {
      console.log(`  link ${inv.meta.invoice_no} → ${quotes.find(q => q.design === design)?.no} (${how})`)
      linked++
      continue
    }
    if (!qid) throw new Error(`No quote row for ${design}`)
    await api(`records?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ meta: { ...inv.meta, quotation_id: qid, quotation_link: how } }) })
    linked++
  }
}

console.log(`\n${dry ? 'Would add' : 'Added'} ${added} quotations (${skipped} already on file). ${dry ? 'Would link' : 'Linked'} ${linked} invoices (${kept} already linked).`)
