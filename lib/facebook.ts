import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import { DEFAULT_PAGE_ID, type FbDay, type FbPeriod, type FbPost } from './fb-fetch'

// 👉 Facebook Page analytics, read from the stored history (supabase/facebook.sql) —
// never from Facebook at render time. Filled by the daily cron and `npm run fb:backfill`.
//
// Facebook's words, kept: "views" counts every time content was shown; "viewers"
// counts unique people. Viewers are unique per day or per 28-day window only, so
// they are never added across days, windows or posts — sums of views are fine.
// "Typical post" is the MEDIAN post, as on Instagram.

export const fbPageId = () => process.env.FB_PAGE_ID?.trim() || DEFAULT_PAGE_ID

export type FbPostRow = FbPost & { views: number | null; viewers: number | null }

export type Facebook = {
  daily: FbDay[] // oldest first
  window: FbPeriod | null // latest 28-day window
  prevWindow: FbPeriod | null // the 28 days before it
  posts: FbPostRow[] // newest first
  followers: number
  updated: string | null
}

const EMPTY: Facebook = { daily: [], window: null, prevWindow: null, posts: [], followers: 0, updated: null }

async function all<T>(q: () => any, size = 1000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await q().range(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

/** Everything the Facebook page and the Dashboard show. Empty in demo mode or before the first refresh. */
/** `real` skips the demo switch — for the stored totals (lib/social-totals.ts), which never show demo figures. */
export async function readFacebook(real = false): Promise<Facebook> {
  if (!supabaseConfigured || (!real && (await demoMode()))) return EMPTY
  const page = fbPageId()
  try {
    const [daily, periods, posts, latest] = await Promise.all([
      all<FbDay & { captured_at: string }>(() => supabase.from('fb_page_daily').select('*').eq('page_id', page).order('day', { ascending: true })),
      supabase.from('fb_page_periods').select('*').eq('page_id', page).order('until', { ascending: false }).limit(60),
      all<FbPost>(() => supabase.from('fb_posts').select('*').eq('page_id', page).order('posted_at', { ascending: false })),
      all<{ post_id: string; views: number | null; viewers: number | null; captured_at: string }>(() =>
        supabase.from('fb_post_latest').select('post_id, views, viewers, captured_at'),
      ),
    ])
    const byId = new Map(latest.map(m => [m.post_id, m]))
    const windows = (periods.data ?? []) as FbPeriod[]
    const window = windows[0] ?? null
    const prevUntil = window ? new Date(Date.parse(window.until) - 28 * 86_400_000).toISOString().slice(0, 10) : null
    const followers = [...daily].reverse().find(d => d.followers)?.followers ?? 0
    const updated = [daily.at(-1)?.captured_at, ...latest.map(m => m.captured_at)].filter(Boolean).sort().at(-1) ?? null
    return {
      daily,
      window,
      prevWindow: windows.find(w => w.until === prevUntil) ?? null,
      posts: posts.map(p => ({ ...p, views: byId.get(p.post_id)?.views ?? null, viewers: byId.get(p.post_id)?.viewers ?? null })),
      followers,
      updated,
    }
  } catch {
    // Tables not created yet (supabase/facebook.sql not run): the page says so.
    return EMPTY
  }
}

// ------------------------------------------------------------
// Analysis — pure, no database
// ------------------------------------------------------------

const median = (xs: number[]) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]
}
export const engagement = (p: FbPostRow) => (p.reactions ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Malaysia is UTC+8 all year.
const myDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).getUTCDay()

export type FbStats = ReturnType<typeof analyseFb>

/** Posts of the last `days` days (anchored to `now`), judged against their own median. */
export function analyseFb(all: FbPostRow[], days: number, now = Date.now()) {
  const cutoff = new Date(now - days * 86_400_000).toISOString()
  const posts = all.filter(p => p.posted_at && p.posted_at >= cutoff)
  const read = posts.filter(p => p.viewers !== null)
  const viewers = read.map(p => p.viewers!)
  const typical = median(viewers)
  const p75 = quantile(viewers, 0.75)
  const totals = {
    views: posts.reduce((s, p) => s + (p.views ?? 0), 0),
    reactions: posts.reduce((s, p) => s + (p.reactions ?? 0), 0),
    comments: posts.reduce((s, p) => s + (p.comments ?? 0), 0),
    shares: posts.reduce((s, p) => s + (p.shares ?? 0), 0),
  }
  // Per 100 viewers, using only posts with viewers AND all three counts read, so both sides match —
  // an unread count is missing, not zero, and would drag the rate down.
  const full = read.filter(fullyRead)
  const fullViewers = full.reduce((s, p) => s + p.viewers!, 0)
  const per100 = (f: (p: FbPostRow) => number) => (fullViewers ? (full.reduce((s, p) => s + f(p), 0) / fullViewers) * 100 : 0)
  const rates = {
    reaction: per100(p => p.reactions ?? 0),
    comment: per100(p => p.comments ?? 0),
    share: per100(p => p.shares ?? 0),
    engagement: per100(engagement),
  }
  const types = [...new Set(posts.map(p => p.type))]
  const byType = types
    .map(type => {
      const ps = read.filter(p => p.type === type)
      return { type, count: posts.filter(p => p.type === type).length, typical: median(ps.map(p => p.viewers!)), rate: rateOf(ps) }
    })
    .sort((a, b) => b.typical - a.typical)
  const byWeekday = WEEKDAYS.map((day, i) => {
    const ps = read.filter(p => myDay(p.posted_at!) === i)
    return { day, count: ps.length, typical: median(ps.map(p => p.viewers!)) }
  })
  const top = [...read].sort((a, b) => b.viewers! - a.viewers!)
  const hits = typical ? read.filter(p => p.viewers! >= 2 * typical) : []
  const last = all.find(p => p.posted_at)?.posted_at
  return {
    posts,
    read: read.length,
    typical,
    p75,
    totals,
    rates,
    byType,
    byWeekday,
    top: top.slice(0, 8),
    // The three quietest from outside the top 8, so no post shows in both lists.
    quiet: top.slice(8).slice(-3).reverse(),
    hits,
    postsPerWeek: posts.length / (days / 7),
    daysSinceLast: last ? Math.floor((now - Date.parse(last)) / 86_400_000) : null,
    lift: (p: FbPostRow) => (typical && p.viewers !== null ? p.viewers / typical : null),
  }
}

const fullyRead = (p: FbPostRow) => p.viewers !== null && p.reactions !== null && p.comments !== null && p.shares !== null

function rateOf(ps: FbPostRow[]) {
  const full = ps.filter(fullyRead)
  const v = full.reduce((s, p) => s + p.viewers!, 0)
  return v ? (full.reduce((s, p) => s + engagement(p), 0) / v) * 100 : 0
}

/** Follower change over the last `days` Malaysia days, today included: follows − unfollows. A missed refresh leaves a gap, never stretches the window. */
export function followerFlow(daily: FbDay[], days = 30, now = Date.now()) {
  const since = new Date(now + 8 * 3_600_000 - (days - 1) * 86_400_000).toISOString().slice(0, 10)
  const span = daily.filter(d => d.day >= since)
  const follows = span.reduce((s, d) => s + (d.follows ?? 0), 0)
  const unfollows = span.reduce((s, d) => s + (d.unfollows ?? 0), 0)
  return { follows, unfollows, net: follows - unfollows, days: span.length }
}
