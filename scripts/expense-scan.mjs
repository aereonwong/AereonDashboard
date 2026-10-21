// Finds company expenses in Gmail and writes them to a preview file — nothing reaches the database from here.
//   npm run expense:scan                    # every source below
//   npm run expense:scan -- --only klia     # one source
//   npm run expense:scan -- --since 2026/01/01
// Output: .expense-data/scan.json (git-ignored: the repo is public) and a table on screen. Check it, then load it with
//   npm run expense:import -- .expense-data/scan.json
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

const SOURCES = [
  { id: 'trip-hotel', query: 'from:MY_HTL_NoReply@trip.com subject:"[Booking confirmation]"', parse: tripHotel, prepare: prepareTripHotel },
  { id: 'klia', query: 'from:eticketing@kliaekspres.com subject:"e-Ticket" has:attachment', parse: klia },
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
await writeFile(new URL('../.expense-data/scan.json', import.meta.url), JSON.stringify(unique, null, 2))

const f = n => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
console.log(`\n${unique.length} expenses → .expense-data/scan.json\n`)
for (const r of unique) console.log(`${r.spent_on}  ${r.kind.padEnd(9)} ${r.vendor.padEnd(14)} ${f(r.amount).padStart(10)}  ${r.description}${r.notes ? `  [${r.notes}]` : ''}`)
console.log(`\nTotal RM ${f(unique.reduce((a, r) => a + r.amount, 0))}`)
if (review.length) console.log(`\nNeeds a look (${review.length}):\n  ${review.join('\n  ')}`)
if (skipped.length) console.log(`\nSkipped (${skipped.length}):\n  ${skipped.join('\n  ')}`)
