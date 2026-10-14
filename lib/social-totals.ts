import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { latestAccount, latestSnapshot, ninety } from './instagram'
import { fbPageId } from './facebook'

// 👉 The public proof numbers (landing page, /hello and its share card, the reel intro):
// Instagram and the Facebook Page added together, from the stored history — never a live call.
//
// Views and interactions are counts, so they add up across days and platforms. Reach and
// Facebook "viewers" are unique people and are never added. Someone on both platforms
// counts twice, so the labels say "combined", never "people".
// A platform whose figures are stale or incomplete is left out of a total, never half-counted.

const DAY = 86_400_000
/** Older than this and a platform's figures are left out, so a stalled refresh never passes off old numbers. */
const STALE = 7 * DAY

export type SocialTotals = {
  views: number | null
  interactions: number | null
  /** Which platforms made it into each total, e.g. ['Instagram', 'Facebook'] — per metric,
   *  since Instagram can return one metric and not the other. */
  from: { views: string[]; interactions: string[] }
  /** Live follower counts, swapped into lib/socials.ts in place of the hand-typed ones. */
  followers: { instagram?: number; facebook?: number }
}

type FbRow = { day: string; followers: number | null; views: number | null; engagements: number | null }

/** Facebook Page views and engagements over the last 90 complete days, plus the latest follower count. */
async function facebook90() {
  if (!supabaseConfigured) return null
  // The refresh also stores today, still counting — so the window ends yesterday (Malaysia time).
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('fb_page_daily')
    .select('day, followers, views, engagements')
    .eq('page_id', fbPageId())
    .lt('day', today)
    .order('day', { ascending: false })
    .limit(90)
  if (error || !data?.length) return null
  const rows = data as FbRow[]
  const latest = Date.parse(rows[0].day)
  const recent = Date.now() - latest < STALE
  // A stalled refresh must not pass an old count off as live — the hand-typed one stands in.
  const followers = recent ? (rows.find(r => r.followers)?.followers ?? undefined) : undefined
  // All 90 days present, the newest within a week, and every day measured — or no Facebook total.
  const whole = rows.length === 90 && recent && Date.parse(rows[89].day) === latest - 89 * DAY
  const sum = (k: 'views' | 'engagements') => (whole && rows.every(r => typeof r[k] === 'number') ? rows.reduce((t, r) => t + r[k]!, 0) : null)
  return { followers, views: sum('views'), engagements: sum('engagements') }
}

/** Instagram + Facebook over the last 90 days. Never throws: a missing platform just drops out. */
export async function socialTotals(): Promise<SocialTotals> {
  const [account, snap, fb] = await Promise.all([
    latestAccount().catch(() => null),
    latestSnapshot().catch(() => null),
    facebook90().catch(() => null),
  ])
  const fresh = account && Date.now() - Date.parse(account.captured_at) < STALE
  const ig = fresh ? ninety(account) : null
  // Each total names exactly the platforms in it; a platform without the metric is left out, never zero.
  const total = (parts: [string, number | null | undefined][]) => {
    const have = parts.filter((p): p is [string, number] => typeof p[1] === 'number')
    return { value: have.length ? have.reduce((t, p) => t + p[1], 0) : null, from: have.map(p => p[0]) }
  }
  const views = total([['Instagram', ig?.views], ['Facebook', fb?.views]])
  const interactions = total([['Instagram', ig?.interactions], ['Facebook', fb?.engagements]])
  const igFollowers = Number(snap?.profile?.followers_count ?? 0)
  return {
    views: views.value,
    interactions: interactions.value,
    from: { views: views.from, interactions: interactions.from },
    followers: { instagram: igFollowers || undefined, facebook: fb?.followers },
  }
}

/** True when a total adds both Instagram and Facebook. */
export const bothIn = (t: SocialTotals | undefined, k: 'views' | 'interactions') =>
  !!t && t.from[k].includes('Instagram') && t.from[k].includes('Facebook')

const SHORT: Record<string, string> = { Instagram: 'IG', Facebook: 'FB' }

/** "Instagram + Facebook · 90 days" (or "IG + FB · 90 days" for narrow tiles) — the small print under a total. */
export const totalsLabel = (t: SocialTotals, k: 'views' | 'interactions', short = false) =>
  `${t.from[k].map(p => (short ? SHORT[p] ?? p : p)).join(' + ')} · 90 days`
