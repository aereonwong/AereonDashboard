import { supabase, supabaseConfigured } from '@/lib/supabase'
import {
  latestSnapshot,
  latestAccount,
  accountDaily,
  readAudienceView,
  analyse,
  type IgSnapshot,
  type IgStats,
  type IgPost,
  type AudienceView,
  type DailyPoint,
} from '@/lib/instagram'

// 👉 Question 2: is my audience growing? Growth needs history, and history needs
// snapshots taken over time. This reports honestly how much history exists, so a
// surface can say "tracking since 20 Sep" instead of drawing a trend it does not have.

export type FollowerPoint = { date: string; followers: number }

export type Audience = {
  snap: IgSnapshot | null
  stats: IgStats | null
  followers: number
  history: FollowerPoint[] // one point per day that has a snapshot
  historyDays: number // days between the first and latest snapshot
  top: IgPost[]
  /** Showcase for the public kits: the furthest-travelling posts of the last 3 months only. */
  best: IgPost[]
  /** Who follows and how far the work travels — null until the first account refresh. */
  view: AudienceView | null
  /** Daily reach and follows gained, oldest first. */
  daily: DailyPoint[]
}

/** How far back the public kits look for their best work (about 3 months). */
export const BEST_DAYS = 90

export async function readAudience(days = 30): Promise<Audience> {
  const [snap, account, daily] = await Promise.all([latestSnapshot(), latestAccount(), accountDaily()])
  let history: FollowerPoint[] = []
  if (supabaseConfigured) {
    const { data } = await supabase
      .from('ig_snapshots')
      .select('captured_at, profile')
      .order('captured_at', { ascending: true })
      .limit(1000)
    const byDay = new Map<string, number>()
    for (const r of data ?? []) {
      const f = Number((r.profile as { followers_count?: number } | null)?.followers_count ?? 0)
      if (f) byDay.set(String(r.captured_at).slice(0, 10), f)
    }
    history = [...byDay.entries()].map(([date, followers]) => ({ date, followers }))
  }
  const first = history[0]?.date
  const last = history.at(-1)?.date
  const historyDays = first && last ? Math.round((Date.parse(last) - Date.parse(first)) / 86_400_000) : 0
  const stats = snap ? analyse(snap, days) : null
  const top = snap ? [...snap.posts].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)) : []
  // Anchored to the snapshot, so a missed refresh doesn't quietly shrink the window.
  // Posts whose insights failed have no reach — missing is not zero, so they are left out.
  const cutoff = Date.parse(snap?.captured_at ?? '') - BEST_DAYS * 86_400_000
  const best = top.filter(p => p.reach !== undefined && Date.parse(p.timestamp) >= cutoff)
  return {
    snap,
    stats,
    followers: Number(snap?.profile?.followers_count ?? 0),
    history,
    historyDays,
    top,
    best,
    view: account ? readAudienceView(account, Number(snap?.profile?.followers_count ?? 0)) : null,
    daily,
  }
}

/** Instagram's own player for a post, from its permalink. Never expires, needs no key. */
export const embedUrl = (permalink?: string) =>
  permalink ? `${permalink.replace(/\/?$/, '/')}embed/` : undefined

/** Countries left off the PUBLIC pages (landing reel, media kits) at Aereon's
 *  request, 6 Oct 2026 — the next country moves up. The Instagram tab still
 *  shows every country. Percentages are untouched: each is still its share of
 *  all followers. */
const PUBLIC_HIDDEN_COUNTRIES = new Set(['IN'])
export const publicCountries = <T extends { key: string }>(list: T[]) => list.filter(c => !PUBLIC_HIDDEN_COUNTRIES.has(c.key))
