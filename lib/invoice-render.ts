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

  const deliverables = (Array.isArray(m.deliverables) ? m.deliverables : []).map(String).join('\n')
  const terms = String(m.terms ?? '').trim()

  const ops: Operation[] = [
    { type: 'update_title', title: `${m.invoice_no} - ${m.job ?? rec.title}` },

    // Header — number and issue date.
    fill(FIELDS.numberAndDate, 'NUMBER', String(m.invoice_no ?? '')),
    fill(FIELDS.numberAndDate, 'DATE', stamp(String(m.invoice_date))),
    ...strip(FIELDS.numberAndDate),

    // Client — ATTN and company stay bold, the address stays normal.
    fill(FIELDS.client, 'CLIENT_ADDRESS', String(m.address ?? '')),
    fill(FIELDS.client, 'CONTACT', String(m.contact ?? '')),
    fill(FIELDS.client, 'CLIENT', String(m.customer ?? '')),
    ...strip(FIELDS.client),

    // Body — job, the venue/date/time highlights, scope, terms.
    fill(FIELDS.description, 'JOB', String(m.job ?? rec.title)),
    fill(FIELDS.description, 'VENUE', String(m.venue ?? '—')),
    fill(FIELDS.description, 'EVENT_DATE', m.event_date_label ? String(m.event_date_label) : m.event_date ? longDate(String(m.event_date)) : '—'),
    fill(FIELDS.description, 'TIME', String(m.event_time ?? '—')),
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

    // Money.
    fill(FIELDS.price, 'PRICE', money(list, cur)),
    ...strip(FIELDS.price),
    fill(FIELDS.lineAmount, 'AMOUNT', money(list, cur)),
    ...strip(FIELDS.lineAmount),
    fill(FIELDS.subtotal, 'SUBTOTAL', money(list, cur)),
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
