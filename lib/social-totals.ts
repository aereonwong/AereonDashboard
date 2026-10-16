import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { latestAccount, latestSnapshot, ninety } from './instagram'
import { fbPageId } from './facebook'

// 👉 The public proof numbers (landing page, media kits, /hello and its share card, the reel):
// every connected platform added into ONE overall figure, from the stored history — never a
// live call. Today that is Instagram and the Facebook Page; a new platform is one more source
// below, and every page picks it up. The pages show the overall figure only, never a
// per-platform split (Aereon's call, 16 Oct 2026).
//
// Views and interactions are counts, so they add up across days and platforms. Reach (Instagram)
// and viewers (Facebook) are unique people per window, so within a platform they are never added
// across windows — only one window per platform goes in, and platforms are then added together,
// the same as the Dashboard's "Social reach".
// A platform whose figures are stale or incomplete is left out of that total, never counted as zero.

const DAY = 86_400_000
/** Older than this and a platform's figures are left out, so a stalled refresh never passes off old numbers. */
const STALE = 7 * DAY

type Metric = 'views' | 'interactions' | 'reach' | 'bestReach'

/** One platform's figures; null = not known (left out of the total). */
type Source = Record<Metric, number | null> & { followers?: number }

export type SocialTotals = {
  /** Views over the last 90 days. */
  views: number | null
  /** Likes, comments, shares, saves (Facebook: post engagements) over the last 90 days. */
  interactions: number | null
  /** People reached in the latest month (Instagram 30 days, Facebook 28 days). */
  reach: number | null
  /** People reached in each platform's best month of the last 90 days. */
  bestReach: number | null
  /** How many platforms went into each total. */
  count: Record<Metric, number>
  /** Live follower counts, swapped into lib/socials.ts in place of the hand-typed ones. */
  followers: { instagram?: number; facebook?: number }
}

/** Instagram: three back-to-back 30-day windows from the stored account snapshot. */
async function instagram(): Promise<Source | null> {
  const [account, snap] = await Promise.all([latestAccount().catch(() => null), latestSnapshot().catch(() => null)])
  const followers = Number(snap?.profile?.followers_count ?? 0) || undefined
  const fresh = account && Date.now() - Date.parse(account.captured_at) < STALE
  if (!fresh) return { views: null, interactions: null, reach: null, bestReach: null, followers }
  const d90 = ninety(account)
  return {
    views: d90?.views ?? null,
    interactions: d90?.interactions ?? null,
    reach: typeof account.totals.reach === 'number' ? account.totals.reach : null,
    bestReach: d90?.peakReach ?? null,
    followers,
  }
}

type FbRow = { day: string; followers: number | null; views: number | null; engagements: number | null }

/** Facebook Page: the last 90 complete days, and Facebook's own 28-day unique viewers. */
async function facebook(): Promise<Source | null> {
  if (!supabaseConfigured) return null
  // The refresh also stores today, still counting — so the window ends yesterday (Malaysia time).
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10)
  const page = fbPageId()
  const [daily, periods] = await Promise.all([
    supabase.from('fb_page_daily').select('day, followers, views, engagements').eq('page_id', page)
      .lt('day', today).order('day', { ascending: false }).limit(90),
    supabase.from('fb_page_periods').select('until, viewers').eq('page_id', page)
      .lt('until', today).order('until', { ascending: false }).limit(90),
  ])
  if (daily.error || !daily.data?.length) return null
  const rows = daily.data as FbRow[]
  const latest = Date.parse(rows[0].day)
  const recent = Date.now() - latest < STALE
  // A stalled refresh must not pass an old count off as live — the hand-typed one stands in.
  const followers = recent ? (rows.find(r => r.followers)?.followers ?? undefined) : undefined
  // All 90 days present, the newest within a week, and every day measured — or no Facebook total.
  const whole = rows.length === 90 && recent && Date.parse(rows[89].day) === latest - 89 * DAY
  const sum = (k: 'views' | 'engagements') => (whole && rows.every(r => typeof r[k] === 'number') ? rows.reduce((t, r) => t + r[k]!, 0) : null)
  // Viewers are unique per 28-day window: take one window, never add windows together.
  const windows = ((periods.data ?? []) as { until: string; viewers: number | null }[])
    .filter(w => typeof w.viewers === 'number' && Date.now() - Date.parse(w.until) < 90 * DAY)
  const newest = windows[0] && Date.now() - Date.parse(windows[0].until) < STALE ? windows[0].viewers : null
  return {
    views: sum('views'),
    interactions: sum('engagements'),
    reach: newest,
    bestReach: newest === null ? null : Math.max(...windows.map(w => w.viewers!)),
    followers,
  }
}

/** Every platform added together. Never throws: a missing platform just drops out. */
export async function socialTotals(): Promise<SocialTotals> {
  const [ig, fb] = await Promise.all([instagram().catch(() => null), facebook().catch(() => null)])
  const sources = [ig, fb].filter(Boolean) as Source[]
  const count = { views: 0, interactions: 0, reach: 0, bestReach: 0 }
  const total = (k: Metric) => {
    const have = sources.map(s => s[k]).filter((v): v is number => typeof v === 'number')
    count[k] = have.length
    return have.length ? have.reduce((t, v) => t + v, 0) : null
  }
  return {
    views: total('views'),
    interactions: total('interactions'),
    reach: total('reach'),
    bestReach: total('bestReach'),
    count,
    followers: { instagram: ig?.followers, facebook: fb?.followers },
  }
}
