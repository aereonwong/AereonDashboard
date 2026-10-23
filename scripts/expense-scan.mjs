// Finds company expenses in Gmail and writes them to a preview file — nothing reaches the database from here.
//   npm run expense:scan                    # every source below
//   npm run expense:scan -- --only klia     # one source
//   npm run expense:scan -- --since 2026/01/01
// Output: .expense-data/scan-<source>.json (git-ignored: the repo is public) and a table on screen. Check it, then load it with
//   npm run expense:import -- .expense-data/scan-klia.json
//
// Each source is a Gmail search plus a parser that reads the email (or its PDF) and returns one expense row. The amount
// is what the email says was paid, in RM. Anything the parser cannot read, or that looks wrong (a booking in someone
// else's name, a cancelled booking), is listed under "needs a look" instead of being guessed.
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { exec, getMessage, myDay, plain, searchIds } from './_gmail.mjs'

const run = promisify(execFile)
const args = process.argv.slice(2)
const flag = n => (args.includes(n) ? args[args.indexOf(n) + 1] : null)
const ONLY = flag('--only')
const SINCE = flag('--since') ?? '2023/10/21'
const OWNER = /seng yue|aereon|wong/i // guest names that are Aereon's own

const money = s => Number(String(s).replace(/,/g, ''))
const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()

// ── Trip.com hotels ─────────────────────────────────────────────────────────
// "[Booking confirmation] Your booking at <hotel> has been confirmed". Paid online: the "Total / Prepay Online / RM x"
// block. A booking cancelled for free later is dropped; one with a refund started is flagged, not guessed.
async function tripHotel(msg, ctx) {
  const text = plain(msg.messageText)
  const no = text.match(/Booking No\.?\s*(\d{10,})/)?.[1]
  const hotel = clean(msg.subject.match(/Your booking at (.+?) has been confirmed/i)?.[1])
  if (!no || !hotel) return { skip: 'not a confirmation' }
  if (ctx.cancelled.has(no)) return { skip: `cancelled for free (${hotel})` }
  const total = text.match(/Total\s*\n?\s*Prepay Online\s*\n?\s*RM\s?([\d,]+\.\d{2})/i)?.[1]
  if (!total) return { review: `${hotel} (${no}): no prepaid total in the email — maybe pay-at-hotel`, ref: no }
  const guests = clean(text.match(/Guest names?\s*\n([^\n]+)/i)?.[1])
  const stay = text.match(/Check-in\s*\n?\s*([A-Z][a-z]{2} \d{1,2}, \d{4})/)?.[1]
  const card = text.match(/([A-Za-z]+ (?:credit|debit) card)/i)?.[1]
  const row = {
    spent_on: myDay(msg.messageTimestamp),
    kind: 'hotel',
    vendor: 'Trip.com',
    description: hotel + (stay ? ` — check-in ${stay}` : ''),
    amount: money(total),
    reference: no,
    paid_with: card ?? null,
    notes: guests && !OWNER.test(guests) ? `Guest: ${guests}` : null,
    source: 'gmail',
    source_ref: { gmail_id: msg.messageId },
  }
  if (ctx.refunds.has(no)) return { row, review: `${hotel} (${no}): a refund was started — check the final amount` }
  if (guests && !OWNER.test(guests)) return { row, review: `${hotel} (${no}): booked for ${guests}, not Aereon — company expense?` }
  return { row }
}

// ── KLIA Ekspres tickets ────────────────────────────────────────────────────
// The email has no price; the PDF ticket does ("Ticket & Receipt": order id, date of purchase, from/to, ticket fare).
async function klia(msg) {
  const att = (msg.attachmentList ?? []).find(a => /pdf/i.test(a.mimeType ?? a.filename ?? ''))
  if (!att) return { skip: 'no PDF attached' }
  const dir = await mkdtemp(join(tmpdir(), 'klia-'))
  try {
    const got = await exec('GMAIL_GET_ATTACHMENT', { message_id: msg.messageId, attachment_id: att.attachmentId, file_name: 'klia.pdf' })
    const res = await fetch(got.file.s3url)
    if (!res.ok) throw new Error(`could not download the PDF (${res.status})`)
    const pdf = join(dir, 'klia.pdf')
    await writeFile(pdf, Buffer.from(await res.arrayBuffer()))
    const { stdout } = await run('swift', [fileURLToPath(new URL('./pdf-text.swift', import.meta.url)), pdf], { maxBuffer: 1 << 24 })
    // The ticket's own layout (PDFKit keeps one printed row per line):
    //   FROM STATION   DATE OF PURCHASE  RECEIPT NUMBER      →  KLIA (T1/T2) 19 Dec 2025 8776314
    //   TO STATION     VALID FROM        TICKET FARE         →  Bandar Tasik Selatan 19 Dec 2025 RM 34.60
    const order = stdout.match(/Order ID:?\s*([A-Z0-9]{8,})/i)?.[1]
    const top = stdout.match(/FROM STATION[^\n]*\n(.+?) (\d{1,2} [A-Za-z]{3} \d{4}) (\d+)\s*\n/i)
    const low = stdout.match(/TO STATION[^\n]*\n(.+?) (\d{1,2} [A-Za-z]{3} \d{4}) RM ?([\d,]+\.\d{2})/i)
    const from = top?.[1]
    const to = low?.[1]
    const bought = top?.[2]
    const fare = low?.[3]
    if (!order || !fare) return { review: `KLIA e-ticket ${msg.messageId}: could not read order id / fare from the PDF`, ref: msg.messageId }
    const day = bought ? new Date(`${bought} UTC`).toISOString().slice(0, 10) : myDay(msg.messageTimestamp)
    return {
      row: {
        spent_on: day,
        kind: 'transport',
        vendor: 'KLIA Ekspres',
        description: from && to ? `KLIA Transit ${clean(from)} → ${clean(to)}` : 'KLIA Transit ticket',
        amount: money(fare),
        reference: order,
        source: 'gmail',
        source_ref: { gmail_id: msg.messageId, attachment: att.filename },
      },
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}


// ── Subscriptions: ManyChat invoices, Envato (PayPal receipts), Google Play (Google One) ──────────────────────────
// These emails ARE the receipt, so the row says `render: true` and scripts/expense-receipts.mjs prints the email to PDF.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
/** "Jul 11, 2024", "8 Oct 2025" or "October 8, 2024" → 2024-07-11 */
function parseDate(t) {
  let m = t.match(/([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})/)
  if (m) return iso(m[3], MONTHS.indexOf(m[1]) + 1, m[2])
  m = t.match(/(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})/)
  return m ? iso(m[3], MONTHS.indexOf(m[2]) + 1, m[1]) : null
}

async function manychat(msg) {
  const t = plain(msg.messageText).replace(/ |&#xA0;/g, ' ')
  const id = t.match(/Invoice ID\s*\n\s*([\d-]+)/)?.[1]
  const date = parseDate(t.match(/Invoice Date\s*\n\s*([^\n]+)/)?.[1] ?? '')
  const total = t.match(/\nTotal\s*\n?\s*\$\s?([\d,]+(?:\.\d+)?)/)?.[1]
  if (!id || !date || !total) return { review: `ManyChat ${msg.messageId}: could not read invoice id / date / total`, ref: msg.messageId }
  return {
    row: { spent_on: date, kind: 'subscription', vendor: 'ManyChat', description: 'ManyChat Pro', amount: null, currency: 'USD', original_amount: money(total), doc_type: 'Invoice', recurring: 'monthly', reference: id, source: 'gmail', source_ref: { gmail_id: msg.messageId, render: true } },
  }
}

async function envato(msg) {
  const t = plain(msg.messageText)
  const usd = t.match(/You paid \$([\d,]+\.\d{2}) USD to Envato/)?.[1]
  const inv = t.match(/Invoice ID\s*\n\s*(\d+)/)?.[1]
  const txn = t.match(/Transaction ID\s*\n\s*([A-Z0-9]+)/)?.[1]
  const date = parseDate(t.match(/Transaction date\s*\n\s*([^\n]+)/)?.[1] ?? '')
  const plan = t.match(/Description[\s\S]*?\n(Annual|Monthly)[^\n]*/)?.[1] ?? 'Annual'
  if (!usd || !date || !(inv || txn)) return { review: `Envato ${msg.messageId}: could not read amount / date / invoice`, ref: msg.messageId }
  return {
    row: { spent_on: date, kind: 'subscription', vendor: 'Envato', description: `Envato Elements ${plan}`, amount: null, currency: 'USD', original_amount: money(usd), doc_type: 'Receipt', recurring: plan === 'Annual' ? 'yearly' : 'monthly', reference: inv ?? txn, notes: txn ? `PayPal ${txn}` : null, paid_with: 'PayPal', source: 'gmail', source_ref: { gmail_id: msg.messageId, render: true } },
  }
}

async function googlePlay(msg) {
  const t = plain(msg.messageText)
  const order = t.match(/Order number:\s*(\S+)/)?.[1]
  const date = parseDate(t.match(/Order date:\s*([^\n]+)/)?.[1] ?? '')
  const total = t.match(/Total:\s*RM\s?([\d,]+\.\d{2})/)?.[1]
  const item = clean(t.match(/Item\s*Price\s*\n(.+?)\s+RM\s?[\d,.]+/)?.[1])
  if (!order || !date || !total) return { skip: 'not a Google Play order receipt' }
  const one = item.match(/(\d+ [GT]B) \(Google One\)/)
  const card = t.match(/Payment method:\s*\n?\s*([^\n]+)/)?.[1]
  return {
    row: { spent_on: date, kind: 'subscription', vendor: 'Google', description: one ? `Google One ${one[1]}` : item || 'Google Play purchase', amount: money(total), currency: 'MYR', doc_type: 'Receipt', recurring: /Auto-renewing/i.test(t) ? 'monthly' : null, reference: order, paid_with: clean(card) || null, source: 'gmail', source_ref: { gmail_id: msg.messageId, render: true } },
  }
}

/** Claude Pro (and any other Anthropic charge): a Stripe receipt, charged in USD with Malaysian SST included, so the RM
 *  amount stays empty until the card statement shows it. The email carries the Receipt PDF, which is what gets filed. */
async function anthropic(msg) {
  const t = plain(msg.messageText).replace(/\s+/g, ' ')
  const no = t.match(/Receipt #([\d-]{8,})/)?.[1]
  const total = t.match(/Amount paid \$([\d,]+\.\d{2})/)?.[1]
  const date = parseDate(t.match(/Paid (?:on )?([A-Za-z]+ \d{1,2}, \d{4})/)?.[1] ?? '')
  const card = t.match(/(?:Payment method|\d{4} with)\s*-?\s*(\d{4})\b/)?.[1]
  const item = clean(t.match(/Receipt #[\d-]+ (.+?) Qty \d/)?.[1]?.replace(/^[A-Z][a-z]{2} \d{1,2}, \d{4}\s*[–-]\s*[A-Z][a-z]{2} \d{1,2}, \d{4} /, '').replace(/^[A-Z][a-z]{2} \d{1,2}\s*[–-]\s*[A-Z][a-z]{2} \d{1,2}, \d{4} /, ''))
  if (!no || !total || !date) return { review: `Anthropic ${msg.messageId}: could not read receipt no. / date / total`, ref: msg.messageId }
  const att = (msg.attachmentList ?? []).find(a => /^receipt/i.test(a.filename ?? ''))
  const credits = /credit/i.test(item)
  return {
    row: { spent_on: date, kind: credits ? 'other' : 'subscription', vendor: 'Anthropic', description: credits ? 'Anthropic API credits' : item || 'Claude', amount: null, currency: 'USD', original_amount: money(total), doc_type: 'Receipt', recurring: !credits && /pro|max|team/i.test(item) ? 'monthly' : null, reference: no, paid_with: card ? `Card ${card}` : null, notes: 'USD charge incl. 8% SST', source: 'gmail', source_ref: { gmail_id: msg.messageId, ...(att ? { attachment: att.filename } : { render: true }) } },
  }
}

/** A domain bought at Cloudflare and paid through PayPal: the PayPal receipt is the proof of payment. The domain's name is
 *  read from Cloudflare's "Domain registered" email of the same day. */
async function cloudflare(msg) {
  const t = plain(msg.messageText).replace(/\s+/g, ' ')
  const usd = t.match(/You paid \$([\d,]+\.\d{2}) USD to Cloudflare/)?.[1]
  const txn = t.match(/Transaction ID\s+([A-Z0-9]{10,})/)?.[1]
  const date = parseDate(t.match(/Transaction date\s+(\d{1,2} [A-Za-z]{3} \d{4})/)?.[1] ?? '')
  if (!usd || !date || !txn) return { review: `Cloudflare ${msg.messageId}: could not read amount / date / transaction`, ref: msg.messageId }
  const day = Date.parse(`${date}T00:00:00Z`)
  const ymd = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '/')
  const [reg] = await searchIds(`from:noreply@notify.cloudflare.com subject:"Domain registered" after:${ymd(day - 86400_000)} before:${ymd(day + 2 * 86400_000)}`)
  const domain = reg ? (await getMessage(reg)).subject.match(/Domain registered - (\S+)/i)?.[1] : null
  return {
    row: { spent_on: date, kind: 'subscription', vendor: 'Cloudflare', description: domain ? `Domain ${domain}` : 'Domain registration', amount: null, currency: 'USD', original_amount: money(usd), doc_type: 'Receipt', recurring: 'yearly', reference: txn, notes: `PayPal ${txn}`, paid_with: 'PayPal', source: 'gmail', source_ref: { gmail_id: msg.messageId, render: true } },
  }
}

// ── Flights ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Trip.com: the E-receipt PDF attached to "Flight Booking Confirmed" has the total. Ctrip (Chinese) confirmations state the
// total in yuan, kept as CNY. Royal Brunei states the total in the email itself, which is then printed to PDF as the receipt.
async function pdfText(msg, att) {
  const dir = await mkdtemp(join(tmpdir(), 'flight-'))
  try {
    const got = await exec('GMAIL_GET_ATTACHMENT', { message_id: msg.messageId, attachment_id: att.attachmentId, file_name: 'x.pdf' })
    const res = await fetch(got.file.s3url)
    if (!res.ok) throw new Error(`could not download the PDF (${res.status})`)
    const pdf = join(dir, 'x.pdf')
    await writeFile(pdf, Buffer.from(await res.arrayBuffer()))
    return (await run('swift', [fileURLToPath(new URL('./pdf-text.swift', import.meta.url)), pdf], { maxBuffer: 1 << 24 })).stdout
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

async function tripFlight(msg) {
  const att = (msg.attachmentList ?? []).find(a => /e-?receipt/i.test(a.filename ?? ''))
  if (!att) return { review: `Trip.com flight ${msg.messageId} (${msg.subject.slice(0, 60)}): no E-receipt attached`, ref: msg.messageId }
  const t = await pdfText(msg, att)
  const no = t.match(/Booking No\.?\s*(\d{10,})/)?.[1]
  const total = t.match(/Total[^\n]*?(?:MYR|RM)\s?(-?[\d,]+\.\d{2})/)?.[1]
  const booked = parseDate(t.match(/Date of Booking:[^\n]*?([A-Za-z]+ \d{1,2}, \d{4})/)?.[1] ?? '')
  if (!no || !total) return { review: `Trip.com flight ${msg.messageId}: could not read booking no. / total`, ref: msg.messageId }
  // The E-receipt lists "NAME ticket-no" lines under the passenger heading and "A - B" legs under "Flights".
  const pax = (t.match(/Passenger & E-ticket No\.?\s*\n([\s\S]*?)\nFlights/i)?.[1] ?? '').split('\n').map(l => clean(l).replace(/\s*[\d-]{8,}$/, '')).filter(Boolean)
  const others = pax.filter(x => !OWNER.test(x))
  const legs = (t.match(/\nFlights\s*\n([\s\S]*?)\nPrice Summary/i)?.[1] ?? '').split('\n').map(clean).filter(l => /^[A-Z][A-Za-z .'()]+ - [A-Z][A-Za-z .'()]+$/.test(l))
  const route = legs.join(', ')
  const row = {
    spent_on: booked ?? myDay(msg.messageTimestamp), kind: 'flight', vendor: 'Trip.com', description: route ? `Flight ${route}` : 'Flight', amount: money(total), reference: no,
    notes: Number(total.replace(/,/g, '')) === 0 ? 'Paid with Trip Coins and promo code — no cash charged' : null, source: 'gmail', source_ref: { gmail_id: msg.messageId, attachment: att.filename },
  }
  if (Number(total.replace(/,/g, '')) < 0) return { review: `Trip.com flight ${no}: negative total (a refund?)`, row: undefined }
  return others.length ? { row, review: `Trip.com flight ${no}: other passengers on it (${others.join('; ')}) — all company?` } : { row }
}

async function ctrip(msg) {
  const t = plain(msg.messageText)
  const order = t.match(/订单\s*(\d{10,})/)?.[1]
  const total = t.match(/总金额[：:]\s*¥\s*([\d,]+(?:\.\d+)?)/)?.[1]
  const pnr = t.match(/航司预订号[：:]\s*([A-Z0-9]{5,7})/)?.[1]
  const route = t.match(/出发[：:]\s*([^\n|‪]+?)\s*[|‪]/)?.[1]
  const att = (msg.attachmentList ?? []).find(a => /英文|english/i.test(a.filename ?? '')) ?? msg.attachmentList?.[0]
  if (!order || !total) return { review: `Ctrip ${msg.messageId}: could not read order / total`, ref: msg.messageId }
  return {
    row: { spent_on: myDay(msg.messageTimestamp), kind: 'flight', vendor: 'Trip.com', description: `Flight ${route ? clean(route) : ''}`.trim(), amount: null, currency: 'CNY', original_amount: money(total), reference: order, notes: pnr ? `Airline booking ${pnr}` : null, source: 'gmail', source_ref: { gmail_id: msg.messageId, attachment: att?.filename } },
  }
}

async function royalBrunei(msg) {
  const t = plain(msg.messageText)
  const pnr = t.match(/PNR\)?:\s*([A-Z0-9]{5,7})/)?.[1]
  const total = t.match(/TOTAL PRICE\s*\n?\s*MYR\s?([\d,]+\.\d{2})/)?.[1]
  if (!/booking confirmation/i.test(msg.subject)) return { skip: 'not the booking confirmation' }
  if (!pnr || !total) return { review: `Royal Brunei ${msg.messageId}: could not read PNR / total`, ref: msg.messageId }
  return {
    row: { spent_on: myDay(msg.messageTimestamp), kind: 'flight', vendor: 'Royal Brunei Airlines', description: 'Flight Kuala Lumpur - Bandar Seri Begawan', amount: money(total), reference: pnr, source: 'gmail', source_ref: { gmail_id: msg.messageId, render: true } },
  }
}

const SOURCES = [
  { id: 'trip-hotel', query: 'from:MY_HTL_NoReply@trip.com subject:"[Booking confirmation]"', parse: tripHotel, prepare: prepareTripHotel },
  { id: 'klia', query: 'from:eticketing@kliaekspres.com subject:"e-Ticket" has:attachment', parse: klia },
  { id: 'trip-flight', query: '(from:myen_flt_noreply@trip.com OR from:en_flight_noreply@trip.com OR from:my_flt_noreply@trip.com) subject:"Flight Booking Confirmed"', parse: tripFlight },
  { id: 'ctrip', query: 'from:ia_rsv@trip.com subject:出行确认单', parse: ctrip },
  { id: 'royal-brunei', query: 'from:noreply@mail.flyroyalbrunei.com subject:"booking confirmation"', parse: royalBrunei },
  { id: 'manychat', query: 'from:noreply@manychat.com subject:"Manychat Invoice"', parse: manychat },
  { id: 'envato', query: 'from:service@intl.paypal.com subject:"Payment to Envato"', parse: envato },
  { id: 'anthropic', query: 'from:invoice+statements@mail.anthropic.com subject:"Your receipt from Anthropic"', parse: anthropic },
  { id: 'cloudflare', query: 'from:service@intl.paypal.com subject:"Payment to Cloudflare"', parse: cloudflare },
  { id: 'google-play', query: 'from:googleplay-noreply@google.com subject:"Order Receipt"', parse: googlePlay },
]

async function prepareTripHotel() {
  const cancelled = new Set()
  const refunds = new Set()
  for (const id of await searchIds(`from:MY_HTL_NoReply@trip.com subject:"cancelled for free" after:${SINCE}`)) {
    const m = await getMessage(id)
    const no = plain(m.messageText).match(/Booking No\.?\s*(\d{10,})/)?.[1]
    if (no) cancelled.add(no)
  }
  for (const id of await searchIds(`from:MY_HTL_NoReply@trip.com subject:"Refund initiated" after:${SINCE}`)) {
    const m = await getMessage(id)
    const no = plain(m.messageText).match(/Booking No\.?\s*(\d{10,})/)?.[1]
    if (no) refunds.add(no)
  }
  return { cancelled, refunds }
}

const rows = []
const review = []
const skipped = []
for (const src of SOURCES.filter(s => !ONLY || s.id === ONLY)) {
  const ctx = src.prepare ? await src.prepare() : {}
  const ids = await searchIds(`${src.query} after:${SINCE}`)
  console.log(`${src.id}: ${ids.length} emails`)
  for (const id of ids) {
    try {
      const out = await src.parse(await getMessage(id), ctx)
      if (out.row) rows.push(out.row)
      if (out.review) review.push(out.review)
      if (out.skip) skipped.push(`${src.id} ${id}: ${out.skip}`)
    } catch (e) {
      review.push(`${src.id} ${id}: ${e.message}`)
    }
  }
}

// The same booking can arrive in more than one email: one row per vendor + reference.
const seen = new Map()
for (const r of rows) if (!seen.has(`${r.vendor}|${r.reference}`)) seen.set(`${r.vendor}|${r.reference}`, r)
const unique = [...seen.values()].sort((a, b) => a.spent_on.localeCompare(b.spent_on))

await mkdir(new URL('../.expense-data/', import.meta.url), { recursive: true })
const OUT = `scan-${ONLY ?? 'all'}.json`
await writeFile(new URL(`../.expense-data/${OUT}`, import.meta.url), JSON.stringify(unique, null, 2))

const f = n => (n == null ? '—' : n).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
console.log(`\n${unique.length} expenses → .expense-data/${OUT}\n`)
for (const r of unique) console.log(`${r.spent_on}  ${r.kind.padEnd(9)} ${r.vendor.padEnd(14)} ${f(r.amount).padStart(10)}  ${r.description}${r.notes ? `  [${r.notes}]` : ''}`)
console.log(`\nTotal RM ${f(unique.reduce((a, r) => a + r.amount, 0))}`)
if (review.length) console.log(`\nNeeds a look (${review.length}):\n  ${review.join('\n  ')}`)
if (skipped.length) console.log(`\nSkipped (${skipped.length}):\n  ${skipped.join('\n  ')}`)
