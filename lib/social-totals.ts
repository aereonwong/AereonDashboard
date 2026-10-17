import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { latestAccount, latestSnapshot, ninety } from './instagram'
import { fbPageId } from './facebook'

// 👉 The public proof numbers (landing page, media kits, /hello and its share card, the reel):
// every connected platform added into ONE overall figure, from the stored history — never a
// live call. Today that is Instagram, the Facebook Page and TikTok; a new platform is one more source
// below, and every page picks it up. The pages show the overall figure only, never a
// per-platform split (Aereon's call, 16 Oct 2026).
//
// Views and interactions are counts, so they add up across days and platforms. Reach (Instagram)
// and viewers (Facebook) are unique people per window, so within a platform they are never added
// across windows — only one window per platform goes in, and platforms are then added together,
// the same as the Dashboard's "Social reach". TikTok's API has no reach at all, so TikTok sits out
// of the reach totals (a metric a platform doesn't measure is `undefined`, never a zero), and its
// views/interactions are those of the videos posted in the last 90 days — TikTok only gives each
// video's lifetime count, and a video earns nearly all of it in its first weeks.
// If any platform's figure is stale or incomplete, that total is not shown at all — a partial
// "overall" figure would undersell, and missing is never counted as zero.

const DAY = 86_400_000
/** Older than this and a platform's figures are left out, so a stalled refresh never passes off old numbers. */
const STALE = 7 * DAY

type Metric = 'views' | 'interactions' | 'reach' | 'bestReach'

/** One platform's figures; null = not known (hides the total), undefined = the platform doesn't measure it (sits out). */
type Source = Record<Metric, number | null | undefined> & { followers?: number }

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
  followers: { instagram?: number; facebook?: number; tiktok?: number }
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
  // "Best" only looks at windows that lie wholly inside the last 90 days.
  const all = (periods.data ?? []) as { until: string; viewers: number | null }[]
  const newest = all[0] && typeof all[0].viewers === 'number' && Date.now() - Date.parse(all[0].until) < STALE ? all[0].viewers : null
  const windows = all.filter(w => typeof w.viewers === 'number' && Date.now() - Date.parse(w.until) < (90 - 28) * DAY)
  return {
    views: sum('views'),
    interactions: sum('engagements'),
    reach: newest,
    bestReach: newest === null || !windows.length ? null : Math.max(...windows.map(w => w.viewers!)),
    followers,
  }
}

type TtVideo = { video_id: string; posted_at: string | null }
type TtReading = { video_id: string; captured_at: string; views: number | null; likes: number | null; comments: number | null; shares: number | null }

/** TikTok: the videos posted in the last 90 days, at their latest reading. No reach on TikTok. */
async function tiktok(): Promise<Source | null> {
  if (!supabaseConfigured) return null
  const account = await supabase.from('tt_account_daily').select('username, day, followers, captured_at').order('day', { ascending: false }).limit(1)
  if (account.error || !account.data?.length) return null
  const a = account.data[0] as { username: string; followers: number | null; captured_at: string }
  const fresh = Date.now() - Date.parse(a.captured_at) < STALE
  const followers = fresh ? (a.followers ?? undefined) : undefined
  if (!fresh) return { views: null, interactions: null, reach: undefined, bestReach: undefined, followers }
  const since = new Date(Date.now() - 90 * DAY).toISOString()
  const vids = await supabase.from('tt_posts').select('video_id, posted_at').eq('username', a.username).gte('posted_at', since)
  if (vids.error) return { views: null, interactions: null, reach: undefined, bestReach: undefined, followers }
  const ids = ((vids.data ?? []) as TtVideo[]).map(v => v.video_id)
  const reads = ids.length ? await supabase.from('tt_post_latest').select('*').in('video_id', ids) : { data: [], error: null }
  const rows = (reads.data ?? []) as TtReading[]
  // Every video read, and read within the week — or no TikTok total.
  const whole = !reads.error && rows.length === ids.length && rows.every(r => Date.now() - Date.parse(r.captured_at) < STALE)
  const counted = (r: TtReading) => [r.likes, r.comments, r.shares].every(v => typeof v === 'number')
  return {
    views: whole && rows.every(r => typeof r.views === 'number') ? rows.reduce((t, r) => t + r.views!, 0) : null,
    interactions: whole && rows.every(counted) ? rows.reduce((t, r) => t + r.likes! + r.comments! + r.shares!, 0) : null,
    reach: undefined,
    bestReach: undefined,
    followers,
  }
}

/** Every platform added together. Never throws: a missing platform just drops out. */
export async function socialTotals(): Promise<SocialTotals> {
  const [ig, fb, tt] = await Promise.all([instagram().catch(() => null), facebook().catch(() => null), tiktok().catch(() => null)])
  // A platform with no stored history at all (never connected) is simply not a source.
  const sources = [ig, fb, tt].filter(Boolean) as Source[]
  const count = { views: 0, interactions: 0, reach: 0, bestReach: 0 }
  const total = (k: Metric) => {
    // A platform that doesn't measure this (TikTok and reach) sits out; one that should but can't say hides the total.
    const measured = sources.filter(s => s[k] !== undefined)
    const have = measured.map(s => s[k]).filter((v): v is number => typeof v === 'number')
    count[k] = have.length
    // Every platform in, or no total: a stalled refresh hides the tile instead of shrinking it.
    return have.length && have.length === measured.length ? have.reduce((t, v) => t + v, 0) : null
  }
  return {
    views: total('views'),
    interactions: total('interactions'),
    reach: total('reach'),
    bestReach: total('bestReach'),
    count,
    followers: { instagram: ig?.followers, facebook: fb?.followers, tiktok: tt?.followers },
  }
}
