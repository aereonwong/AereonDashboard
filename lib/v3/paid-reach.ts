import type { Rec } from '@/lib/records'
import { toInvoices } from '@/lib/invoices'
import { inRange, type Filters } from './filters'

// 👉 What a paid post delivered: invoices that have Instagram posts linked to them
// (Invoice Details → link posts, stored as meta.ig_posts) against those posts' latest
// stored reach. The figure brands price on is the effective CPM — ringgit per 1,000
// people reached. Ringgit invoices only (other currencies are never mixed into RM).
//
// Reach is unique per post. A line's reach adds its posts together, so someone who saw two
// posts counts twice — the panel says so. A post with no stored reading yet is left out of
// the reach, and its invoice out of the CPM (unless EVERY post has one), rather than counted as
// zero — dividing the whole fee by one post's reach would overstate the price.

export type PaidLine = {
  id: number
  no: string
  client: string
  date: string
  amount: number
  posts: number
  /** Posts with a stored reach reading. */
  read: number
  /** Sum of each read post's latest reach; null when none of its posts has a reading. */
  reach: number | null
  /** RM per 1,000 reach; null unless every post has a reading. */
  cpm: number | null
}

export type PaidReach = {
  lines: PaidLine[]
  /** Invoices in range with posts linked (ringgit ones). */
  linked: number
  /** Ringgit invoices in range with no posts linked — the ones still to link. */
  unlinked: number
  /** Pooled: all amounts ÷ all reach, over lines that have reach. */
  cpm: number | null
  /** Middle line's CPM — the typical deal. */
  medianCpm: number | null
}

const median = (xs: number[]) => {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Post ids linked to ringgit invoices in the range — what the loader must read reach for. */
export function linkedPostIds(rows: Rec[], f: Filters): string[] {
  const wanted = new Set(inRange(toInvoices(rows), f).filter(i => i.currency === 'MYR').map(i => i.id))
  return rows
    .filter(r => wanted.has(r.id))
    .flatMap(r => (Array.isArray(r.meta?.ig_posts) ? r.meta.ig_posts : []))
    .map((p: { id?: unknown }) => String(p?.id ?? ''))
    .filter(Boolean)
}

export function paidReach(rows: Rec[], f: Filters, reach: Record<string, { reach: number }>): PaidReach {
  const byId = new Map(rows.map(r => [r.id, r]))
  const inv = inRange(toInvoices(rows), f).filter(i => i.currency === 'MYR')
  const lines: PaidLine[] = []
  let unlinked = 0
  for (const i of inv) {
    const posts: { id?: unknown }[] = Array.isArray(byId.get(i.id)?.meta?.ig_posts) ? byId.get(i.id)!.meta.ig_posts : []
    if (!posts.length) {
      unlinked += 1
      continue
    }
    const read = posts.map(p => reach[String(p?.id ?? '')]?.reach).filter((n): n is number => typeof n === 'number')
    const total = read.length ? read.reduce((s, n) => s + n, 0) : null
    lines.push({
      id: i.id,
      no: i.no,
      client: i.client,
      date: i.date,
      amount: i.amount,
      posts: posts.length,
      read: read.length,
      reach: total,
      cpm: total && read.length === posts.length ? (i.amount / total) * 1000 : null,
    })
  }
  lines.sort((a, b) => (a.cpm ?? Infinity) - (b.cpm ?? Infinity))
  const withReach = lines.filter(l => l.cpm !== null)
  const amt = withReach.reduce((s, l) => s + l.amount, 0)
  const rch = withReach.reduce((s, l) => s + (l.reach ?? 0), 0)
  return {
    lines,
    linked: lines.length,
    unlinked,
    cpm: rch ? (amt / rch) * 1000 : null,
    medianCpm: median(withReach.map(l => l.cpm!)),
  }
}
