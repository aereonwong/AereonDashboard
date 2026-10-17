import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { demoMode } from './records'
import type { TtAccount, TtPost } from './tt-fetch'

// 👉 TikTok analytics, read from the stored history (supabase/tiktok.sql) — never from TikTok
// at render time. Filled by the daily cron and `npm run tt:backfill`.
//
// TikTok gives lifetime counts only: account totals today, and each public video's views,
// likes, comments and shares so far. So growth comes from our own daily account rows, and a
// video's figure is its latest reading. Views are counts and add up; there is no reach.
// "Typical video" is the MEDIAN video, as on Instagram and Facebook.

export type TtPostRow = TtPost & { views: number | null; likes: number | null; comments: number | null; shares: number | null }

export type Tiktok = {
  daily: TtAccount[] // oldest first
  posts: TtPostRow[] // newest first
  username: string | null
  followers: number
  updated: string | null
}

// Stored links are re-checked before they reach a page: only plain https is ever rendered.
const https = (v: string | null) => (v && v.startsWith('https://') ? v : null)

const EMPTY: Tiktok = { daily: [], posts: [], username: null, followers: 0, updated: null }

async function all<T>(q: () => any, size = 1000): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const { data, error } = await q().range(from, from + size - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < size) return out
  }
}

/** Everything the TikTok page and the Dashboard show. Empty in demo mode or before the first refresh. */
/** `real` skips the demo switch — for the stored totals (lib/social-totals.ts), which never show demo figures. */
export async function readTiktok(real = false): Promise<Tiktok> {
  if (!supabaseConfigured || (!real && (await demoMode()))) return EMPTY
  try {
    const [daily, posts, latest] = await Promise.all([
      all<TtAccount & { captured_at: string }>(() => supabase.from('tt_account_daily').select('*').order('day', { ascending: true })),
      all<TtPost>(() => supabase.from('tt_posts').select('*').order('posted_at', { ascending: false })),
      all<{ video_id: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; captured_at: string }>(() =>
        supabase.from('tt_post_latest').select('video_id, views, likes, comments, shares, captured_at'),
      ),
    ])
    // One account only; if a second ever appears, follow the newest reading's.
    const username = daily.at(-1)?.username ?? posts[0]?.username ?? null
    const mine = daily.filter(d => d.username === username)
    const byId = new Map(latest.map(m => [m.video_id, m]))
    const updated = [mine.at(-1)?.captured_at, ...latest.map(m => m.captured_at)].filter(Boolean).sort().at(-1) ?? null
    return {
      daily: mine,
      posts: posts
        .filter(p => p.username === username)
        .map(p => {
          const m = byId.get(p.video_id)
          return { ...p, share_url: https(p.share_url), embed_link: https(p.embed_link), cover_url: https(p.cover_url), views: m?.views ?? null, likes: m?.likes ?? null, comments: m?.comments ?? null, shares: m?.shares ?? null }
        }),
      username,
      followers: [...mine].reverse().find(d => d.followers)?.followers ?? 0,
      updated,
    }
  } catch {
    // Tables not created yet (supabase/tiktok.sql not run): the page says so.
    return EMPTY
  }
}

// ------------------------------------------------------------
// Analysis — pure, no database
// ------------------------------------------------------------

export const median = (xs: number[]) => {
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
export const interactions = (p: TtPostRow) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0)

export const LENGTHS = [
  { id: 'short', label: 'Under 30s', test: (s: number) => s < 30 },
  { id: 'mid', label: '30–60s', test: (s: number) => s >= 30 && s <= 60 },
  { id: 'long', label: 'Over 60s', test: (s: number) => s > 60 },
] as const
export const lengthOf = (p: TtPostRow) => (p.duration === null ? null : (LENGTHS.find(l => l.test(p.duration!))?.id ?? null))

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
// Malaysia is UTC+8 all year.
const myDay = (iso: string) => new Date(Date.parse(iso) + 8 * 3_600_000).getUTCDay()

export type TtStats = ReturnType<typeof analyseTt>

/**
 * Videos posted in the last `days` days (anchored to `now`; 0 = every stored video), judged
 * against their own median. A video's views are lifetime-so-far, so a new video is young —
 * the page says so beside the newest ones.
 */
export function analyseTt(all: TtPostRow[], days: number, now = Date.now()) {
  const cutoff = days ? new Date(now - days * 86_400_000).toISOString() : ''
  const posts = all.filter(p => p.posted_at && p.posted_at >= cutoff)
  const read = posts.filter(p => p.views !== null)
  const views = read.map(p => p.views!)
  const typical = median(views)
  const totals = {
    views: read.reduce((s, p) => s + p.views!, 0),
    likes: read.reduce((s, p) => s + (p.likes ?? 0), 0),
    comments: read.reduce((s, p) => s + (p.comments ?? 0), 0),
    shares: read.reduce((s, p) => s + (p.shares ?? 0), 0),
  }
  const per1k = (x: number) => (totals.views ? (x / totals.views) * 1000 : 0)
  const byLength = LENGTHS.map(l => {
    const ps = read.filter(p => lengthOf(p) === l.id)
    const v = ps.reduce((s, p) => s + p.views!, 0)
    return { id: l.id, label: l.label, count: ps.length, typical: median(ps.map(p => p.views!)), rate: v ? (ps.reduce((s, p) => s + interactions(p), 0) / v) * 1000 : 0 }
  }).filter(l => l.count)
  const byWeekday = WEEKDAYS.map((day, i) => {
    const ps = read.filter(p => myDay(p.posted_at!) === i)
    return { day, count: ps.length, typical: median(ps.map(p => p.views!)) }
  })
  const top = [...read].sort((a, b) => b.views! - a.views!)
  const last = all.find(p => p.posted_at)?.posted_at
  const span = days || (posts.length ? Math.max(7, (now - Date.parse(posts.at(-1)!.posted_at!)) / 86_400_000) : 7)
  return {
    posts,
    read: read.length,
    typical,
    p75: quantile(views, 0.75),
    totals,
    rates: { like: per1k(totals.likes), comment: per1k(totals.comments), share: per1k(totals.shares) },
    byLength,
    byWeekday,
    top: top.slice(0, 10),
    quiet: top.slice(-3).reverse(),
    hits: typical ? read.filter(p => p.views! >= 2 * typical) : [],
    postsPerWeek: posts.length / (span / 7),
    daysSinceLast: last ? Math.floor((now - Date.parse(last)) / 86_400_000) : null,
  }
}

/**
 * Change in an account total over the last `days` days, from our own daily rows: today's
 * reading against the newest one at least `days` old. Null until history reaches back that
 * far — a short history is never stretched into a "30-day" change.
 */
export function change(daily: TtAccount[], key: 'followers' | 'likes' | 'video_count', days = 30, now = Date.now()) {
  const have = daily.filter(d => typeof d[key] === 'number')
  const latest = have.at(-1)
  if (!latest) return null
  const before = new Date(now + 8 * 3_600_000 - days * 86_400_000).toISOString().slice(0, 10)
  const base = [...have].reverse().find(d => d.day <= before)
  return base ? { net: latest[key]! - base[key]!, since: base.day } : null
}
