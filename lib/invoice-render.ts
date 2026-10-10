import type { Rec } from './records'

// 👉 Turning a filed invoice or quotation into the exact Canva edit that draws it.
//
// ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
// Canva's design-editing API lives only in the MCP connector, so the Canva step
// is driven by Claude rather than by this app. The expensive part is DISCOVERY:
// `read-design` returns the whole element tree (~9,000 tokens) just to learn
// which element holds which field. It only has to be learnt once, because every
// document is a copy of a template and a Canva copy inherits element ids.
// With the map below the render is four cheap calls and no exploration:
//
//   1. copy-design     TEMPLATES[kind]                        ~200 tokens
//   2. read-design     filter: {fields:["thumbnails"]}      ~1,800 tokens
//      → returns ONLY a transaction_id and a thumbnail, not the tree
//   3. edit-design     operations: buildOperations(rec)     ~12,000 tokens
//   4. edit-design     finalize: "commit"                     ~100 tokens
//
// The PDF export afterwards costs nothing — a plain REST call the server makes
// through Composio (CANVA_POST_EXPORTS), no model involved.
//
// ── THE RULE THAT SHAPES EVERYTHING BELOW ───────────────────────────────────
// Canva has no operation for formatting part of a text element. Mixed bold and
// normal text inside one element exists only as "runs", and the API can only
// preserve runs, never create them. Text inserted by find_and_replace inherits
// the formatting of the character IMMEDIATELY BEFORE it — so writing at the
// very start of a run silently adopts the previous run's formatting. That is
// how the client address kept turning bold.
//
// Hence the two-step token pattern used throughout. Instead of replacing the
// whole `{{TOKEN}}`, replace only the NAME inside the braces — which always has
// a `{{` before it in the same run, so the value inherits the right formatting —
// and then delete the braces separately. Deletion never triggers inheritance.
//
//   "{{CLIENT_ADDRESS}}"  →  "{{<the address>}}"  →  "<the address>"
//
// Break that pattern and Aereon's bold/normal distinctions collapse.

/** The canonical templates, both in the Canva folder "SYCP Templates (bot)".
 *  Built from the quotation Aereon corrected by hand on 22 Sep 2026: the
 *  invoice is a copy of it with only the wording changed, so the two layouts
 *  are identical by construction and cannot drift apart again.
 *
 *  When Aereon changes a template by hand, REBUILD the other one as a fresh
 *  copy rather than trying to repeat the edit — the API cannot re-create mixed
 *  bold/normal runs, so a copy is the only way to carry a formatting fix across.
 *  That is how the invoice template got his un-bolded Venue value. */
export const TEMPLATES = {
  invoice: 'DAHV7BUsplg',
  quotation: 'DAHV7GY129w',
} as const
export type DocKind = keyof typeof TEMPLATES

/** Where a finished document belongs. Quotations must never land in the
 *  Invoices folder — mixing the two is what made the old back catalogue so hard
 *  to audit, and it is the same separation the database enforces by filing a
 *  quotation as a `doc` rather than `cash_in`.
 *
 *  Invoices moved off a single flat folder (27 Sep 2026, ~200 items hit
 *  Canva's 200-per-folder cap) into "Invoices" → one "Invoices (YYYY)"
 *  subfolder per year, picked by the invoice's own date, not by when it
 *  happens to be filed. `invoiceYearFolders` below holds the ones that exist
 *  so far; add the next year's as soon as it's created. A superseded draft
 *  (re-rendered after a fix) goes to "TODO: Delete" at the account root
 *  (FAHWX1OiB6Q) instead of staying in its year folder — Claude has no way to
 *  delete a Canva design outright, so Aereon clears that folder by hand.
 *  Quotations were left on their original flat folder; only invoices had the
 *  volume to need this. */
export const FOLDERS = {
  invoice: 'FAHWXzGiKeY', // "Invoices" (parent) — do not file directly here, use invoiceYearFolders
  quotation: 'FAE09QXvOvk', // "Quotation"
  todoDelete: 'FAHWX1OiB6Q', // "TODO: Delete", at the account root
} as const

/** Year-subfolder ids under FOLDERS.invoice, keyed by the invoice's own
 *  4-digit year (from meta.invoice_date), not the filing date. */
export const invoiceYearFolders: Record<string, string> = {
  '2021': 'FAHWX8VDasI',
  '2022': 'FAHWX433-kw',
  '2023': 'FAHWX6rjp9Q',
  '2024': 'FAHWX77QEh8',
  '2025': 'FAHWX6zUwiE',
  '2026': 'FAHWX-2apUY',
}

/** Page id of the templates — every locator is prefixed with it. */
const PAGE = 'PBCY2tSg9MmB06fp'

/** Which element holds which field. The four totals elements are NOT a group:
 *  Aereon ungrouped them so the values could be right-aligned under AMOUNT. */
export const FIELDS = {
  numberAndDate: `${PAGE}-LBKPP21CHKtJ2yf1-LBkZscVPqvZqvNck`,
  client: `${PAGE}-LBhtPsYH96y17cpl`,
  description: `${PAGE}-LB9DT0m1PNrmts7w`,
  price: `${PAGE}-LBBbkYJgmJD49hf9`,
  qty: `${PAGE}-LB2N80sgNgMB5fjk`,
  qtyHeader: `${PAGE}-LB53KwQrxw8K1wC7`, // the static "QTY" column heading
  lineAmount: `${PAGE}-LB1pMj0cQ4zv02w0`,
  subtotal: `${PAGE}-LBqP0hvs588mJgRF`,
  total: `${PAGE}-LB2WPPKpqK756JyQ`,
} as const

const money = (n: number, cur: string) =>
  `${cur} ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** DD/MM/YY, the form used across the whole back catalogue. */
const stamp = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(2)}`
}

/** "22 October 2026" — the long form Aereon uses for the event date. */
const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

/** Break a client address into short lines instead of one line running into
 *  the payment-info block on the right. Confirmed with Aereon on 27 Sep 2026
 *  against his own manual line breaks for Fusion Works Sdn Bhd:
 *
 *    B-5-1, Ativo Plaza, No. 1, Jln. PJU 9/1,
 *    Damansara Avenue, Bandar Sri Damansara,
 *    52200 Kuala Lumpur, Malaysia
 *
 *  The postcode (and everything after it — city, state, country) always stays
 *  together on its own final line. Everything before that is greedily packed,
 *  comma by comma, into lines no longer than 42 characters — the width that
 *  reproduced his exact line breaks above. */
const formatAddress = (address: string): string => {
  // Already broken into lines by hand (e.g. Dex Ventures') — keep them as typed.
  if (address.includes('\n')) return address
  const parts = address.split(',').map(p => p.trim()).filter(Boolean)
  const postcodeIdx = parts.findIndex(p => /\b\d{5}\b/.test(p))
  const body = postcodeIdx === -1 ? parts : parts.slice(0, postcodeIdx)
  const tail = postcodeIdx === -1 ? [] : parts.slice(postcodeIdx)

  const MAX_LINE = 42
  const lines: string[] = []
  let current = ''
  for (const part of body) {
    const candidate = current ? `${current}, ${part}` : part
    if (candidate.length > MAX_LINE && current) {
      lines.push(`${current},`)
      current = part
    } else {
      current = candidate
    }
  }
  if (current) lines.push(tail.length ? `${current},` : current)
  if (tail.length) lines.push(tail.join(', '))
  return lines.join('\n')
}

export type Operation = Record<string, unknown>

const fill = (locator: string, token: string, value: string): Operation => ({
  type: 'find_and_replace_text',
  locator_id: locator,
  find_text: token,
  replace_text: value,
})

/** Strip the brace anchors once every value in an element has been written. */
const strip = (locator: string): Operation[] => [
  { type: 'find_and_replace_text', locator_id: locator, find_text: '{{', replace_text: '' },
  { type: 'find_and_replace_text', locator_id: locator, find_text: '}}', replace_text: '' },
]

/**
 * The full `operations` array for `edit-design`.
 *
 * Token order matters: CLIENT_ADDRESS must be written before CLIENT, because
 * "CLIENT" is a substring of "CLIENT_ADDRESS" and would otherwise match it
 * first and corrupt the address.
 */
export function buildOperations(rec: Rec, kind: DocKind = 'invoice'): Operation[] {
  const m = rec.meta ?? {}
  const isQuote = kind === 'quotation'
  // Laid out once, so the blank-line check below counts the lines actually printed.
  const address = formatAddress(String(m.address ?? ''))
  const cur = String(m.currency ?? 'MYR')
  const net = Number(rec.amount ?? 0)
  const list = Number(m.list_price ?? net)

  const deliverableList = (Array.isArray(m.deliverables) ? m.deliverables : []).map(String)
  const terms = String(m.terms ?? '').trim()
  const discount = Number(m.discount ?? 0)
  const hasTime = !!(m.event_time && m.event_time !== '-')
  // An invoice that follows a quotation prints "QUOTATION No." as a reference
  // line above its own number — the line the template's leading blank is there for.
  const quoteRef = !isQuote ? String(m.quotation_no ?? '').trim() : ''

  // A discount prints as the LAST scope-of-work bullet, plain weight — not
  // bold. Bold only survives a find-and-replace when the new text extends an
  // existing bold run; tried here, right before "Payment Terms:", it instead
  // strips the bold off "Payment Terms:" itself (confirmed by testing, not
  // assumed). Price/Qty/Amount skip down to match: JOB, Venue, Date, Time
  // (if any), a blank line, "Scope of Work:", then one line per deliverable
  // ahead of the discount bullet itself.
  const discountLineGap = discount ? 5 + (hasTime ? 1 : 0) + deliverableList.length : 0
  const deliverables = [...deliverableList, ...(discount ? ['Discount Offer'] : [])].join('\n')

  const ops: Operation[] = [
    { type: 'update_title', title: `${m.invoice_no} - ${m.job ?? rec.title}` },

    // Header — number and issue date. The template's own leading blank line
    // (there to leave room for a quotation reference that's never actually
    // printed) is closed up so "INVOICE No." sits right under "Invoice", not
    // a line below it.
    fill(FIELDS.numberAndDate, 'NUMBER', String(m.invoice_no ?? '')),
    fill(FIELDS.numberAndDate, 'DATE', stamp(String(m.invoice_date))),
    // With a quotation reference the blank line becomes that reference; without
    // one it is closed up.
    {
      type: 'find_and_replace_text',
      locator_id: FIELDS.numberAndDate,
      find_text: '\nINVOICE No.',
      replace_text: quoteRef ? `QUOTATION No. ${quoteRef}\nINVOICE No.` : 'INVOICE No.',
    },
    ...strip(FIELDS.numberAndDate),

    // Client — ATTN and company stay bold, the address stays normal. The
    // registration number is appended to the company name, the way it appears
    // on the client's own letterhead, rather than living in a field of its own.
    fill(FIELDS.client, 'CLIENT_ADDRESS', address),
    fill(FIELDS.client, 'CONTACT', String(m.contact ?? '')),
    // A reg number that already carries its own parenthetical (e.g. a company
    // with both a new and an old registration number) isn't wrapped again —
    // that would print as a confusing double set of parens.
    fill(
      FIELDS.client,
      'CLIENT',
      String(m.customer ?? '') + (m.reg ? (String(m.reg).includes('(') ? ` ${m.reg}` : ` (${m.reg})`) : ''),
    ),
    // The template leads this box with one blank line, there to keep the client
    // block level with the QUOTATION No. header — which is one line taller than
    // the invoice header (its own leading blank line only gets closed up above
    // when the doc IS an invoice; see numberAndDate's "\nINVOICE No." fix). So on
    // an invoice a 2-line address still lands level with the date as-is, but a
    // 3-line address overshoots it — Aereon found this on Dex Ventures' 3-line
    // address (27 Sep 2026) and closed the gap by hand. Do it here instead: drop
    // this box's own blank line only when it's an invoice AND the address runs
    // to 3+ lines. A quotation never drops it — its header keeps its own blank
    // line, so the two stay level no matter how long the address is.
    // With a quotation reference the left header is a line taller again, so the
    // address keeps its blank line (one line lower) to end level with the date.
    ...(!isQuote && !quoteRef && address.split('\n').length >= 3
      ? [{ type: 'find_and_replace_text', locator_id: FIELDS.client, find_text: '\nATTN:', replace_text: 'ATTN:' }]
      : []),
    ...strip(FIELDS.client),

    // Body — job, the venue/date/time highlights, scope, terms. A blank time
    // is dropped as a whole line (not just an empty value), so the gap before
    // "Scope of Work" stays the same single blank line as when it's filled.
    fill(FIELDS.description, 'JOB', String(m.job ?? rec.title)),
    fill(FIELDS.description, 'VENUE', String(m.venue ?? '—')),
    fill(FIELDS.description, 'EVENT_DATE', m.event_date_label ? String(m.event_date_label) : m.event_date ? longDate(String(m.event_date)) : '—'),
    ...(m.event_time && m.event_time !== '-'
      ? [fill(FIELDS.description, 'TIME', String(m.event_time))]
      : [{ type: 'find_and_replace_text', locator_id: FIELDS.description, find_text: 'Time: {{TIME}}\n', replace_text: '' }]),
    fill(FIELDS.description, 'DELIVERABLES', deliverables),
    fill(FIELDS.description, 'TERMS', terms),
    ...(isQuote
      ? [
          fill(
            FIELDS.description,
            'VALIDITY',
            `This quotation is valid for ${Number(m.validity_days ?? 14)} days from the date above.`,
          ),
        ]
      : []),
    ...strip(FIELDS.description),

    // Money. Qty and its header are both centred in their (near-identical)
    // column boxes, so the value sits directly under the word "QTY" rather
    // than the two being centred in slightly different places.
    { type: 'format_text', locator_id: FIELDS.qty, formatting: { text_align: 'center' } },
    { type: 'format_text', locator_id: FIELDS.qtyHeader, formatting: { text_align: 'center' } },
    // The template's qty cell is a bare "1", not a token — a second "1" is
    // appended the same way the discount row is: breaklines, not a new box,
    // enough of them to land level with the discount bullet however far down
    // the scope-of-work list it ends up.
    ...(discount ? [{ type: 'find_and_replace_text', locator_id: FIELDS.qty, find_text: '1', replace_text: `1${'\n'.repeat(discountLineGap)}1` }] : []),
    fill(FIELDS.price, 'PRICE', discount ? `${money(list, cur)}${'\n'.repeat(discountLineGap)}(${money(discount, cur)})` : money(list, cur)),
    ...strip(FIELDS.price),
    fill(FIELDS.lineAmount, 'AMOUNT', discount ? `${money(list, cur)}${'\n'.repeat(discountLineGap)}(${money(discount, cur)})` : money(list, cur)),
    ...strip(FIELDS.lineAmount),
    fill(FIELDS.subtotal, 'SUBTOTAL', money(discount ? net : list, cur)),
    ...strip(FIELDS.subtotal),
    fill(FIELDS.total, 'TOTAL', money(net, cur)),
    ...strip(FIELDS.total),
  ]

  return ops
}

/** Invoices AND quotations filed by the bot that have no Canva document yet. */
export function pendingRender(rows: Rec[]): Rec[] {
  return rows
    .filter(
      r =>
        (r.category === 'cash_in' || (r.category === 'doc' && r.status === 'quotation')) &&
        r.meta?.invoice_no &&
        r.meta?.render?.status === 'pending',
    )
    .sort((a, b) => String(a.meta?.invoice_date).localeCompare(String(b.meta?.invoice_date)))
}

/** Which template a filed row should be drawn from. */
export const kindOf = (r: Rec): DocKind =>
  r.category === 'doc' && r.status === 'quotation' ? 'quotation' : 'invoice'
