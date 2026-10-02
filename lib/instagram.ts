import { supabase, supabaseConfigured } from './supabase'
import { persist, type IgSnapshot, type IgPost, type IgAccount, type Slice } from './ig-fetch'

// 👉 Instagram analytics. Data arrives through Composio's Instagram tools and is
// stored as a SNAPSHOT (one row per refresh) in `ig_snapshots`, so the tab loads
// instantly and a slow API never blocks a page view. Fetching and shaping live in
// lib/ig-fetch.ts (shared with the Mac script); this file reads and analyses.

export {
  buildSnapshot,
  buildAccount,
  MAX_POSTS,
  type IgProfile,
  type IgPost,
  type IgSnapshot,
  type IgAccount,
  type Slice,
  type Exec,
} from './ig-fetch'

/** Store a refresh; returns warnings for history tables that could not take a row. */
export async function saveSnapshot(snap: IgSnapshot, account?: IgAccount | null): Promise<string[]> {
  if (!supabaseConfigured) throw new Error('Supabase not configured')
  return persist(supabase, snap, account)
}

export async function latestSnapshot(): Promise<IgSnapshot | null> {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase
    .from('ig_snapshots')
    .select('captured_at, username, profile, posts')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data as IgSnapshot
}

// ------------------------------------------------------------
// The numbers the tab shows. Engagement is measured against REACH (accounts that
// actually saw it), which is the honest denominator — not follower count.
// ------------------------------------------------------------
export type IgStats = {
  posts: IgPost[]
  window: { days: number; count: number }
  totals: { views: number; reach: number; likes: number; comments: number; saves: number; shares: number }
  engagementRate: number // % of reach that interacted
  reachPerPost: number
  reachVsFollowers: number // % of your followers a typical post reaches
  postsPerWeek: number
  daysSinceLastPost: number
  byType: { type: string; count: number; avgReach: number; avgEngagement: number }[]
  byWeekday: { day: string; count: number; avgReach: number }[]
  weekly: { label: string; reach: number; posts: number }[]
  top: IgPost[]
  quiet: IgPost[]
  /** The account's normal: median and upper-quartile reach across every stored post.
   *  Medians, because one viral reel would drag an average far from typical. */
  baseline: { median: number; p75: number; posts: number }
  /** Each post's reach as a multiple of the median — 2.4 reads "2.4× a normal post". */
  lift: Record<string, number>
  /** Posts in the window that reached at least twice the median. */
  hits: IgPost[]
  /** Per 100 accounts reached. Saves and shares are what Instagram rewards most. */
  rates: { save: number; share: number; comment: number }
  /** Reels only, when Instagram returned watch time. */
  watch: { reels: number; avgSec: number; totalHours: number } | null
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const interactions = (p: IgPost) => p.likes + p.comments + (p.saved ?? 0) + (p.shares ?? 0)
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
/** The q-th quantile (0–1) of a list, interpolated. */
export function quantile(xs: number[], q: number): number {
  if (!xs.length) return 0
  const a = [...xs].sort((x, y) => x - y)
  const i = (a.length - 1) * q
  const lo = Math.floor(i)
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (i - lo)
}

export function analyse(snap: IgSnapshot, days = 30): IgStats {
  const since = Date.now() - days * 86_400_000
  const all = [...snap.posts].sort((a, b) => b.timestamp.localeCompare(a.timestamp))
  const posts = all.filter(p => Date.parse(p.timestamp) >= since)
  const scope = posts.length ? posts : all.slice(0, 12) // young account / quiet month
  const reached = scope.filter(p => p.reach !== undefined)

  const totals = {
    views: scope.reduce((s, p) => s + (p.views ?? 0), 0),
    reach: scope.reduce((s, p) => s + (p.reach ?? 0), 0),
    likes: scope.reduce((s, p) => s + p.likes, 0),
    comments: scope.reduce((s, p) => s + p.comments, 0),
    saves: scope.reduce((s, p) => s + (p.saved ?? 0), 0),
    shares: scope.reduce((s, p) => s + (p.shares ?? 0), 0),
  }

  const types = new Map<string, IgPost[]>()
  for (const p of scope) types.set(p.type, [...(types.get(p.type) ?? []), p])

  const weekdays = new Map<number, IgPost[]>()
  for (const p of scope) {
    const d = new Date(p.timestamp).getDay()
    weekdays.set(d, [...(weekdays.get(d) ?? []), p])
  }

  // Last 6 calendar weeks of reach, oldest → newest.
  const weekly: { label: string; reach: number; posts: number }[] = []
  for (let w = 5; w >= 0; w--) {
    const end = Date.now() - w * 7 * 86_400_000
    const start = end - 7 * 86_400_000
    const mine = all.filter(p => {
      const t = Date.parse(p.timestamp)
      return t > start && t <= end
    })
    weekly.push({
      label: w === 0 ? 'This wk' : `${w}w ago`,
      reach: mine.reduce((s, p) => s + (p.reach ?? 0), 0),
      posts: mine.length,
    })
  }

  const spanDays = all.length
    ? Math.max((Date.now() - Date.parse(all[all.length - 1].timestamp)) / 86_400_000, 1)
    : 1
  const followers = snap.profile.followers_count ?? 0
  const reachPerPost = avg(reached.map(p => p.reach as number))
  const allReach = all.filter(p => p.reach !== undefined).map(p => p.reach as number)
  const median = quantile(allReach, 0.5)
  const lift = Object.fromEntries(
    all.filter(p => p.reach !== undefined && median).map(p => [p.id, (p.reach as number) / median]),
  )
  const watched = scope.filter(p => p.watchMs !== undefined)

  return {
    posts: scope,
    window: { days, count: posts.length },
    totals,
    engagementRate: totals.reach ? ((totals.likes + totals.comments + totals.saves + totals.shares) / totals.reach) * 100 : 0,
    reachPerPost,
    reachVsFollowers: followers ? (reachPerPost / followers) * 100 : 0,
    postsPerWeek: (all.length / spanDays) * 7,
    daysSinceLastPost: all.length ? Math.floor((Date.now() - Date.parse(all[0].timestamp)) / 86_400_000) : 0,
    byType: [...types.entries()]
      .map(([type, xs]) => ({
        type,
        count: xs.length,
        avgReach: avg(xs.filter(p => p.reach !== undefined).map(p => p.reach as number)),
        avgEngagement: avg(
          xs.filter(p => p.reach).map(p => (interactions(p) / (p.reach as number)) * 100),
        ),
      }))
      .sort((a, b) => b.avgReach - a.avgReach),
    byWeekday: [...weekdays.entries()]
      .map(([d, xs]) => ({
        day: DAYS[d],
        count: xs.length,
        avgReach: avg(xs.filter(p => p.reach !== undefined).map(p => p.reach as number)),
      }))
      .sort((a, b) => b.avgReach - a.avgReach),
    weekly,
    top: [...scope].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0)).slice(0, 5),
    quiet: [...reached].sort((a, b) => (a.reach ?? 0) - (b.reach ?? 0)).slice(0, 3),
    baseline: { median, p75: quantile(allReach, 0.75), posts: allReach.length },
    lift,
    hits: scope.filter(p => (lift[p.id] ?? 0) >= 2).sort((a, b) => lift[b.id] - lift[a.id]),
    rates: {
      save: totals.reach ? (totals.saves / totals.reach) * 100 : 0,
      share: totals.reach ? (totals.shares / totals.reach) * 100 : 0,
      comment: totals.reach ? (totals.comments / totals.reach) * 100 : 0,
    },
    watch: watched.length
      ? {
          reels: watched.length,
          avgSec: avg(watched.map(p => p.watchMs as number)) / 1000,
          totalHours: watched.reduce((t, p) => t + (p.watchTotalMs ?? 0), 0) / 3_600_000,
        }
      : null,
  }
}

// ------------------------------------------------------------
// The account picture — who follows, who the work reaches, how it grows.
// Read from the history tables; each is optional until it has rows.
// ------------------------------------------------------------

export type DailyPoint = { day: string; reach?: number; new_followers?: number }

export async function latestAccount(): Promise<IgAccount | null> {
  if (!supabaseConfigured) return null
  const { data, error } = await supabase
    .from('ig_account_snapshots')
    .select('captured_at, window_days, totals, follow_type, formats, demographics')
    .order('captured_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return { ...(data as Omit<IgAccount, 'daily'>), daily: [] }
}

/** Daily reach and follows gained, oldest first. Grows by a day with every refresh. */
export async function accountDaily(days = 400): Promise<DailyPoint[]> {
  if (!supabaseConfigured) return []
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('ig_account_daily')
    .select('day, reach, new_followers')
    .gte('day', since)
    .order('day', { ascending: true })
  if (error || !data) return []
  return data.map(r => ({
    day: String(r.day),
    reach: r.reach ?? undefined,
    new_followers: r.new_followers ?? undefined,
  }))
}

export type Share = { key: string; label: string; value: number; pct: number }

export type AudienceView = {
  capturedAt: string
  totals: Record<string, number>
  /** % of accounts reached that do NOT follow — how far past the fan base the work travels. */
  newPeoplePct: number | null
  follows: number | null
  unfollows: number | null
  ages: Share[]
  genders: Share[]
  countries: Share[]
  cities: Share[]
  formats: Share[]
  /** The age band with the most followers, and the 25–44 share brands usually ask about. */
  topAge: Share | null
  coreAgePct: number | null
  homePct: number | null // % of followers in Malaysia
}

const REGION = (() => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
  } catch {
    return null
  }
})()
const FORMAT: Record<string, string> = {
  REEL: 'Reels', POST: 'Posts', CAROUSEL_CONTAINER: 'Carousels', STORY: 'Stories', AD: 'Ads', LIVE: 'Live',
}
const GENDER: Record<string, string> = { F: 'Women', M: 'Men', U: 'Not stated' }

// `of` is the denominator. Country and city lists are only Instagram's top 45, so
// they are shared out of all followers — never re-based to make 100% of a partial list.
const share = (xs: Slice[] | undefined, label: (k: string) => string, of?: number): Share[] => {
  if (!xs?.length) return []
  const total = of || xs.reduce((t, x) => t + x.value, 0)
  return xs.map(x => ({ key: x.key, label: label(x.key), value: x.value, pct: total ? (x.value / total) * 100 : 0 }))
}
const valueOf = (xs: Slice[] | undefined, key: string) => xs?.find(x => x.key === key)?.value

export function readAudienceView(acc: IgAccount, followers: number): AudienceView {
  const d = acc.demographics.followers ?? {}
  const reachSplit = acc.follow_type.reach
  const nonFollower = valueOf(reachSplit, 'NON_FOLLOWER')
  const reachTotal = (reachSplit ?? []).reduce((t, x) => t + x.value, 0)
  const ages = share(d.age, k => k, undefined).sort((a, b) => a.key.localeCompare(b.key))
  const countries = share(d.country, k => REGION?.of(k) ?? k, followers)
  const core = ages.filter(a => a.key === '25-34' || a.key === '35-44')
  return {
    capturedAt: acc.captured_at,
    totals: acc.totals,
    newPeoplePct: nonFollower !== undefined && reachTotal ? (nonFollower / reachTotal) * 100 : null,
    follows: valueOf(acc.follow_type.follows, 'FOLLOWER') ?? null,
    unfollows: valueOf(acc.follow_type.follows, 'NON_FOLLOWER') ?? null,
    ages,
    genders: share(d.gender, k => GENDER[k] ?? k),
    countries,
    cities: share(d.city, k => k.split(',')[0], followers),
    formats: share(acc.formats.reach, k => FORMAT[k] ?? k),
    topAge: [...ages].sort((a, b) => b.value - a.value)[0] ?? null,
    coreAgePct: core.length ? core.reduce((t, a) => t + a.pct, 0) : null,
    homePct: countries.find(c => c.key === 'MY')?.pct ?? null,
  }
}
