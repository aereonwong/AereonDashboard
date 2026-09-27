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
 *  quotation as a `doc` rather than `cash_in`. */
export const FOLDERS = {
  invoice: 'FAE8mD8bgIw', // "Invoices"
  quotation: 'FAE09QXvOvk', // "Quotation"
} as const

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
  const cur = String(m.currency ?? 'MYR')
  const net = Number(rec.amount ?? 0)
  const list = Number(m.list_price ?? net)

  const deliverableList = (Array.isArray(m.deliverables) ? m.deliverables : []).map(String)
  const terms = String(m.terms ?? '').trim()
  const discount = Number(m.discount ?? 0)
  const hasTime = !!(m.event_time && m.event_time !== '-')

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
    { type: 'find_and_replace_text', locator_id: FIELDS.numberAndDate, find_text: '\nINVOICE No.', replace_text: 'INVOICE No.' },
    ...strip(FIELDS.numberAndDate),

    // Client — ATTN and company stay bold, the address stays normal. The
    // registration number is appended to the company name, the way it appears
    // on the client's own letterhead, rather than living in a field of its own.
    // With the header's blank line above gone, the two blocks land level
    // without needing any extra line added on this side.
    fill(FIELDS.client, 'CLIENT_ADDRESS', String(m.address ?? '')),
    fill(FIELDS.client, 'CONTACT', String(m.contact ?? '')),
    // A reg number that already carries its own parenthetical (e.g. a company
    // with both a new and an old registration number) isn't wrapped again —
    // that would print as a confusing double set of parens.
    fill(
      FIELDS.client,
      'CLIENT',
      String(m.customer ?? '') + (m.reg ? (String(m.reg).includes('(') ? ` ${m.reg}` : ` (${m.reg})`) : ''),
    ),
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
