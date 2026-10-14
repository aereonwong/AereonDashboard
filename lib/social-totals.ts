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
  /** Which platforms made it into views/interactions, e.g. ['Instagram', 'Facebook']. */
  platforms: string[]
  /** Live follower counts, swapped into lib/socials.ts in place of the hand-typed ones. */
  followers: { instagram?: number; facebook?: number }
}

type FbRow = { day: string; followers: number | null; views: number | null; engagements: number | null }

/** Facebook Page views and engagements over the last 90 complete days, plus the latest follower count. */
async function facebook90() {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase
    .from('fb_page_daily')
    .select('day, followers, views, engagements')
    .eq('page_id', fbPageId())
    .order('day', { ascending: false })
    .limit(90)
  if (error || !data?.length) return null
  const rows = data as FbRow[]
  const followers = rows.find(r => r.followers)?.followers ?? undefined
  const latest = Date.parse(rows[0].day)
  // All 90 days present, the newest within a week, and every day measured — or no Facebook total.
  const whole = rows.length === 90 && Date.now() - latest < STALE && Date.parse(rows[89].day) === latest - 89 * DAY
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
  const add = (a: number | null | undefined, b: number | null | undefined) =>
    a == null && b == null ? null : (a ?? 0) + (b ?? 0)
  const platforms = [
    ig?.views != null || ig?.interactions != null ? 'Instagram' : null,
    fb?.views != null || fb?.engagements != null ? 'Facebook' : null,
  ].filter(Boolean) as string[]
  const igFollowers = Number(snap?.profile?.followers_count ?? 0)
  return {
    views: add(ig?.views, fb?.views),
    interactions: add(ig?.interactions, fb?.engagements),
    platforms,
    followers: { instagram: igFollowers || undefined, facebook: fb?.followers },
  }
}

const SHORT: Record<string, string> = { Instagram: 'IG', Facebook: 'FB' }

/** "Instagram + Facebook · 90 days" (or "IG + FB · 90 days" for narrow tiles) — the small print under a total. */
export const totalsLabel = (t: SocialTotals, short = false) =>
  `${t.platforms.map(p => (short ? SHORT[p] ?? p : p)).join(' + ')} · 90 days`
