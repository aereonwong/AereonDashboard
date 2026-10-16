import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import type { Rec } from './records'
import { GATE_HEADER, REVEAL_COOKIE } from './privacy-header'

export { GATE_HEADER, REVEAL_COOKIE }

// 👉 Privacy mode on the server. While amounts are hidden, money never leaves the
// server: the loaders (getRecords, readProperty, readSubmeter, the paid-reach read)
// hand every page ZEROS in place of real amounts, so neither the HTML nor the data
// the browser receives holds a real figure — DevTools, extensions and caches see
// nothing. The browser's MoneyMask then draws those zeros as "RM *****".
//
// "Show amounts" (MoneyToggle) sets the REVEAL cookie to an expiry time five
// minutes ahead and reloads; the browser keeps pushing it forward while you work
// and deletes it on "Hide" or after 5 idle minutes. The cookie only says "this
// signed-in browser asked to see amounts" — the session cookie still decides who
// is signed in at all.
//
// Only requests proxy.ts let through as signed-in app pages carry GATE_HEADER, so
// the Telegram bot, the crons and the public pages always read real figures.
// It fails OPEN by design (no header → real figures), so every private path in proxy.ts
// must return through gated(); a new early `return NextResponse.next()` there would leak.


/** True while this request must not receive real money figures. Once per request. */
export const moneyHidden = cache(async (): Promise<boolean> => {
  try {
    if ((await headers()).get(GATE_HEADER) !== 'gate') return false
    const until = Number((await cookies()).get(REVEAL_COOKIE)?.value)
    return !(until > Date.now())
  } catch {
    return false // outside a request (scripts, build)
  }
})

/** For server actions that save an amount: a form drawn while hidden holds zeros,
 *  so saving it would overwrite real figures. Returns the refusal, or null. */
export async function moneyLocked(): Promise<string | null> {
  return (await moneyHidden()) ? 'Amounts are hidden — turn off "Hide amounts", check the figures, then save again.' : null
}

// "RM 1,234.50", "USD 2.5K" inside free text (titles, notes, meta strings).
const MONEY_TEXT = /\b(RM|MYR|USD|SGD|EUR|RMB|CNY|GBP|AUD|JPY)\s?[-−]?\d[\d,]*(?:\.\d+)?[KkMm]?/g
export const scrubText = (s: string) => s.replace(MONEY_TEXT, '$1 0')
/** Also bare two-decimal amounts ("1,234.50") — for property notes and data-issue text. */
export const scrubAmounts = (s: string | null) => (s == null ? s : scrubText(s).replace(/\d[\d,]*\.\d{2}\b/g, '0.00'))
/** scrubAmounts on the named text fields of each row. */
export function scrubFields<T extends object>(rows: T[], fields: readonly (keyof T)[]): T[] {
  return rows.map(r => {
    const out = { ...r }
    for (const f of fields) if (typeof out[f] === 'string') (out as Record<keyof T, unknown>)[f] = scrubAmounts(out[f] as string)
    return out
  })
}

// Number fields in a record's meta that are money (found by surveying every row's meta,
// 16 Oct 2026). Anything under `fx` (a client's totals per foreign currency) is money too.
// Plus the usual names a future field might use. A numeric STRING under one of these keys is zeroed too.
const MONEY_KEYS = new Set(['amount', 'discount', 'list_price', 'owes', 'total_invoiced', 'total_invoiced_usd', 'value', 'potential', 'price', 'subtotal', 'total', 'tax', 'deposit', 'paid_amount', 'fee', 'balance', 'retainer', 'outstanding', 'budget', 'cost', 'rent'])

function scrubMeta(v: unknown, key: string, underFx: boolean): unknown {
  if (typeof v === 'string') return (underFx || MONEY_KEYS.has(key)) && /^\s*[-−]?[\d,]+(\.\d+)?\s*$/.test(v) ? '0' : scrubText(v)
  if (typeof v === 'number') return underFx || MONEY_KEYS.has(key) ? 0 : v
  if (Array.isArray(v)) return v.map(x => scrubMeta(x, key, underFx))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) out[k] = scrubMeta(x, k, underFx || k === 'fx')
    return out
  }
  return v
}

/** Any JSON-ish value (a bot proposal's payload, say) with its money zeroed and money text blanked. */
export const scrubDeep = (v: unknown) => scrubMeta(v, '', false)

/** The same rows with every amount zeroed and money in free text blanked. */
export function scrubRecords(rows: Rec[]): Rec[] {
  return rows.map(r => ({
    ...r,
    amount: 0,
    title: r.title ? scrubAmounts(r.title)! : r.title,
    notes: r.notes ? scrubAmounts(r.notes) : r.notes,
    meta: scrubMeta(r.meta ?? {}, '', false) as Record<string, any>,
  }))
}

/** Zero the named number fields of each row (null stays null, so "not entered yet" survives). */
export function zeroFields<T extends object>(rows: T[], fields: readonly (keyof T)[]): T[] {
  return rows.map(r => {
    const out = { ...r }
    for (const f of fields) if (typeof out[f] === 'number') (out as Record<keyof T, unknown>)[f] = 0
    return out
  })
}
