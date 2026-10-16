import 'server-only'
import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import type { Rec } from './records'
import { createHmac } from 'node:crypto'
import { actor } from './auth'
import { sessionSecret } from './session'
import { GATE_HEADER, REVEAL_COOKIE } from './privacy-header'

export { GATE_HEADER, REVEAL_COOKIE }

// 👉 Privacy mode on the server. While amounts are hidden, real money never leaves the
// server: the loaders (getRecords, readProperty, readSubmeter, the paid-reach read, the
// Approvals feed) multiply every amount by a secret factor, fixed per person, so the
// HTML and the data the browser receives hold only disguised figures — DevTools, extensions
// and caches see no real amount. Because every amount moves by the same factor, charts,
// shares, rankings and growth stay true; the browser's MoneyMask draws the amounts as
// "RM *****". What a disguise cannot hide: proportions. Someone who already knows one exact
// amount could work out the factor for that page. Panels built on fixed money bands
// ("Under 1K") go blank while hidden, because a band would give the real size away.
//
// Only the OWNER can show real amounts (canRevealMoney). "Show amounts" (MoneyToggle) sets
// the REVEAL cookie to an expiry five minutes ahead and reloads; the browser keeps pushing
// it forward while you work and deletes it when switched off or after 5 idle minutes. A
// reveal cookie from an admin or viewer is ignored.
//
// Only requests proxy.ts let through as signed-in app pages carry GATE_HEADER, so
// the Telegram bot, the crons and the public pages always read real figures.
// It fails OPEN by design (no header → real figures), so every private path in proxy.ts
// must return through gated(); a new early `return NextResponse.next()` there would leak.


/** May this signed-in person see real amounts at all? Owner only (passcode, open door and
 *  ADMIN_EMAILS count as owner). Admins and viewers always get the disguised figures. */
export const canRevealMoney = cache(async (): Promise<boolean> => {
  try {
    return (await actor()).role === 'owner'
  } catch {
    return false
  }
})

/** True while this request must not receive real money figures. Once per request. */
export const moneyHidden = cache(async (): Promise<boolean> => {
  try {
    if ((await headers()).get(GATE_HEADER) !== 'gate') return false
    const until = Number((await cookies()).get(REVEAL_COOKIE)?.value)
    if (!(until > Date.now())) return true
    return !(await canRevealMoney()) // a reveal cookie from a non-owner is ignored
  } catch {
    return false // outside a request (scripts, build)
  }
})

/** The secret factor every amount is multiplied by while hidden. Never sent to the browser.
 *  FIXED per signed-in person (an HMAC of who they are under the session secret), so reloading
 *  shows the same disguised figures — a fresh random factor per load could be averaged away
 *  across reloads to recover real amounts. Between 0.35 and 0.95: below 1, so the loan maths'
 *  fixed tolerances (±0.01, +1) can only shrink and never raise a warning the real figures
 *  would not. Rotating AUTH_SECRET changes everyone's factor. */
export const moneyFactor = cache(async (): Promise<number> => {
  let who = 'open-door'
  try {
    who = (await actor()).who ?? who
  } catch {}
  const h = createHmac('sha256', sessionSecret() || 'no-secret').update(`money-disguise:${who}`).digest()
  return 0.35 + (h.readUInt32BE(0) / 0xffffffff) * 0.6
})

/** For server actions that save an amount: a form drawn while hidden holds disguised figures,
 *  so saving it would overwrite real ones. Returns the refusal, or null. */
export async function moneyLocked(): Promise<string | null> {
  // Owner check first and regardless of the gate header: a server action can be posted to
  // any page, including an ungated one.
  if (!(await canRevealMoney())) return 'Only the owner can change amounts.'
  if (!(await moneyHidden())) return null
  return 'Amounts are hidden — switch on "Show amounts", check the figures, then save again.'
}

// "RM 1,234.50", "USD 2.5K" inside free text (titles, notes, meta strings). Text can't be
// scaled sensibly, so its money is blanked to 0 (the screen masks it as RM ***** anyway).
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
// Plus the usual names a future field might use. A numeric STRING under one of these keys is scaled too.
const MONEY_KEYS = new Set(['amount', 'discount', 'list_price', 'owes', 'total_invoiced', 'total_invoiced_usd', 'value', 'potential', 'price', 'subtotal', 'total', 'tax', 'deposit', 'paid_amount', 'fee', 'balance', 'retainer', 'outstanding', 'budget', 'cost', 'rent'])

function scaleMeta(v: unknown, key: string, underFx: boolean, k: number): unknown {
  const money = underFx || MONEY_KEYS.has(key)
  if (typeof v === 'string') return money && /^\s*[-−]?[\d,]+(\.\d+)?\s*$/.test(v) ? String(Number(v.replace(/[,\s]/g, '').replace('−', '-')) * k) : scrubText(v)
  if (typeof v === 'number') return money ? v * k : v
  if (Array.isArray(v)) return v.map(x => scaleMeta(x, key, underFx, k))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key2, x] of Object.entries(v)) out[key2] = scaleMeta(x, key2, underFx || key2 === 'fx', k)
    return out
  }
  return v
}

/** Any JSON-ish value (a bot proposal's payload, say) with its money disguised and money text blanked. */
export const scrubDeep = (v: unknown, k: number) => scaleMeta(v, '', false, k)

/** The same rows with every amount multiplied by this request's secret factor and money in
 *  free text blanked. Shares, rankings, growth and chart shapes stay true; amounts do not. */
export function scrubRecords(rows: Rec[], k: number): Rec[] {
  return rows.map(r => ({
    ...r,
    amount: Number(r.amount ?? 0) * k,
    title: r.title ? scrubAmounts(r.title)! : r.title,
    notes: r.notes ? scrubAmounts(r.notes) : r.notes,
    meta: scaleMeta(r.meta ?? {}, '', false, k) as Record<string, any>,
  }))
}

/** One amount, disguised the same way. */
export const disguise = (n: number, k: number) => n * k

/** Disguise the named number fields of each row (null stays null, so "not entered yet" survives). */
export function disguiseFields<T extends object>(rows: T[], fields: readonly (keyof T)[], k: number): T[] {
  return rows.map(r => {
    const out = { ...r }
    for (const f of fields) if (typeof out[f] === 'number') (out as Record<keyof T, unknown>)[f] = (out[f] as number) * k
    return out
  })
}
