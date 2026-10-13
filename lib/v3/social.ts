import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import type { Audience } from './audience'
import { engagement, followerFlow, type Facebook } from '@/lib/facebook'

// 👉 Social — Instagram and Facebook on one page (/social).
//
// Two rules hold every figure here honest:
//   · Counts add up across platforms (followers, views, interactions, posts). People
//     reached do too, but only as a PLATFORM TOTAL: someone who sees both counts twice,
//     and the page says so. Nothing here claims unique people across platforms.
//   · Posts are compared by LIFT — people reached ÷ that platform's own typical (median)
//     post — because Instagram reach and Facebook viewers are each platform's own count.
// Instagram's account window is 30 days; Facebook's is its own 28-day window.

export type Platform = 'ig' | 'fb'

export type SocialPost = {
  platform: Platform
  id: string
  at: string // posted, ISO
  title: string
  kind: string // Reel, Carousel, Photo, Video, Link…
  people: number | null // Instagram reach / Facebook viewers — unique per post
  views: number | null
  interactions: number | null // null when the counts behind it were not all read
  permalink: string | null
  thumb: string | null
}

const firstLine = (t: string | null | undefined) => (t ?? '').split('\n')[0].trim()

const IG_KIND = (type: string | null, mediaType: string | null) =>
  type === 'REELS' ? 'Reel' : mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : mediaType === 'VIDEO' ? 'Video' : 'Photo'
const FB_KIND: Record<string, string> = { VIDEO: 'Video', PHOTO: 'Photo', LINK: 'Link', TEXT: 'Text' }

/** Instagram posts of the last `days` days from the archive (ig_posts), each with its latest stored reading. */
export async function readIgPosts(audience: Audience, days = 365): Promise<SocialPost[]> {
  if (!supabaseConfigured || (await demoMode())) return []
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  try {
    const posts: any[] = []
    for (let from = 0; from < 20_000; from += 1000) {
      const { data, error } = await supabase
        .from('ig_posts')
        .select('media_id, posted_at, type, media_type, caption, permalink, likes, comments')
        .gte('posted_at', since)
        .order('posted_at', { ascending: false })
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      posts.push(...(data ?? []))
      if ((data?.length ?? 0) < 1000) break
    }
    // Newest readings first: the first reading met for a post is its latest. The daily
    // refresh re-reads only recent posts, so every post is met within a few pages.
    const want = new Set(posts.map(p => p.media_id as string))
    const latest = new Map<string, any>()
    // Capped at 30 pages: a post with no reading at all must not make every page load walk the whole table.
    for (let from = 0; from < 30_000 && latest.size < want.size; from += 1000) {
      const { data, error } = await supabase
        .from('ig_post_metrics')
        .select('media_id, captured_at, reach, views, interactions, likes, comments, saved, shares')
        .gte('posted_at', since)
        .order('captured_at', { ascending: false })
        .order('media_id', { ascending: true })
        .range(from, from + 999)
      if (error) throw new Error(error.message)
      for (const r of data ?? []) if (!latest.has(r.media_id)) latest.set(r.media_id, r)
      if ((data?.length ?? 0) < 1000) break
    }
    const snapById = new Map((audience.snap?.posts ?? []).map(p => [p.id, p]))
    return posts.map(p => {
      const m = latest.get(p.media_id)
      const s = snapById.get(p.media_id)
      // Missing is not zero: without Instagram's own total, every part must have been read.
      const parts = [m?.likes, m?.comments, m?.saved, m?.shares]
      const interactions = m?.interactions ?? (parts.every(v => v != null) ? parts.reduce((a, v) => a + v, 0) : null)
      return {
        platform: 'ig' as const,
        id: p.media_id,
        at: p.posted_at,
        title: firstLine(p.caption) || IG_KIND(p.type, p.media_type),
        kind: IG_KIND(p.type, p.media_type),
        // The snapshot stands in only for a post with no stored reading — never over a newer, failed one.
        people: m ? m.reach : (s?.reach ?? null),
        views: m ? m.views : (s?.views ?? null),
        interactions,
        permalink: p.permalink ?? s?.permalink ?? null,
        thumb: s?.thumb ?? null, // Instagram covers expire; only the newest snapshot has fresh ones
      }
    })
  } catch {
    // Archive tables missing (supabase/instagram-archive.sql not run): fall back to the snapshot's posts.
    return (audience.snap?.posts ?? []).map(p => ({
      platform: 'ig' as const,
      id: p.id,
      at: p.timestamp,
      title: firstLine(p.caption) || p.type,
      kind: p.type === 'REELS' ? 'Reel' : 'Photo',
      people: p.reach ?? null,
      views: p.views ?? null,
      interactions: p.interactions ?? (p.saved != null && p.shares != null ? p.likes + p.comments + p.saved + p.shares : null),
      permalink: p.permalink ?? null,
      thumb: p.thumb ?? null,
    }))
  }
}

export function fbPosts(fb: Facebook): SocialPost[] {
  return fb.posts
    .filter(p => p.posted_at)
    .map(p => ({
      platform: 'fb' as const,
      id: p.post_id,
      at: p.posted_at!,
      title: firstLine(p.message) || FB_KIND[p.type] || 'Post',
      kind: FB_KIND[p.type] ?? p.type,
      people: p.viewers,
      views: p.views,
      interactions: engagement(p),
      permalink: p.permalink ?? null,
      thumb: p.picture ?? null,
    }))
}

// ------------------------------------------------------------
// Maths — pure, no database
// ------------------------------------------------------------

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const DAY = 86_400_000
// Malaysia is UTC+8 all year.
const mytDay = (t: number) => new Date(t + 8 * 3_600_000).toISOString().slice(0, 10)

export type PlatformFigures = {
  followers: number
  net30: number | null // follows − unfollows, last 30 days
  people: number | null // IG 30-day reach / FB 28-day viewers
  views: number | null
  interactions: number | null
  posts: number // in the post window
  perWeek: number
  typical: number // median people per post in the post window
  lastPost: string | null
}

export type KindRow = { platform: Platform; kind: string; count: number; typical: number }
export type WeekRow = { start: string; ig: number; fb: number }
export type DayRow = { day: string; ig: number | null; fb: number | null }

export function buildSocial(audience: Audience, fb: Facebook, posts: SocialPost[], days: number, now = Date.now()) {
  const today = mytDay(now)
  const cutoff = new Date(now - days * DAY).toISOString()
  const inWindow = posts.filter(p => p.at >= cutoff)

  const figures = (pf: Platform): PlatformFigures => {
    const mine = inWindow.filter(p => p.platform === pf)
    const read = mine.filter(p => p.people !== null)
    const last = posts.filter(p => p.platform === pf).reduce<string | null>((a, p) => (!a || p.at > a ? p.at : a), null)
    const base = { posts: mine.length, perWeek: mine.length / (days / 7), typical: median(read.map(p => p.people!)), lastPost: last }
    if (pf === 'ig') {
      const v = audience.view
      return {
        ...base,
        followers: audience.followers,
        net30: v?.follows != null && v?.unfollows != null ? v.follows - v.unfollows : null,
        people: v?.totals.reach ?? null,
        views: v?.totals.views ?? null,
        interactions: v?.totals.total_interactions ?? null,
      }
    }
    const flow = fb.daily.length ? followerFlow(fb.daily, 30, now) : null
    return {
      ...base,
      followers: fb.followers,
      net30: flow ? flow.net : null,
      people: fb.window?.viewers ?? null,
      views: fb.window?.views ?? null,
      interactions: fb.window?.engagements ?? null,
    }
  }
  const ig = figures('ig')
  const fbf = figures('fb')
  // A Facebook window more than a week old would understate the month; leave it out of totals.
  const fbFresh = !!fb.window && fb.window.until >= mytDay(now - 7 * DAY)
  // Same for Instagram's account row: a stale one would be labelled "last month" when it is not.
  const igFresh = !!audience.view && Date.parse(audience.view.capturedAt) >= now - 7 * DAY
  const hasIg = !!audience.view || audience.followers > 0
  const hasFb = fb.daily.length > 0 || fb.posts.length > 0
  const add = (a: number | null, b: number | null) => (a !== null && b !== null ? a + b : null)
  const fbWin = (n: number | null) => (fbFresh ? n : null)
  const igWin = (n: number | null) => (igFresh ? n : null)
  const total = {
    followers: ig.followers + fbf.followers,
    net30: add(ig.net30, fbf.net30),
    people: add(igWin(ig.people), fbWin(fbf.people)),
    views: add(igWin(ig.views), fbWin(fbf.views)),
    interactions: add(igWin(ig.interactions), fbWin(fbf.interactions)),
    posts: ig.posts + fbf.posts,
    perWeek: ig.perWeek + fbf.perWeek,
  }

  // Lift against each platform's own typical post in the window.
  const typicalOf = { ig: ig.typical, fb: fbf.typical }
  const lift = (p: SocialPost) => (p.people !== null && typicalOf[p.platform] ? p.people / typicalOf[p.platform] : null)
  const ranked = inWindow
    .filter(p => lift(p) !== null)
    .map(p => ({ ...p, lift: lift(p)! }))
    .sort((a, b) => b.lift - a.lift || (b.people ?? 0) - (a.people ?? 0))

  // What travels: typical people per post, by platform and kind (2+ posts to count).
  const kinds: KindRow[] = []
  for (const pf of ['ig', 'fb'] as const) {
    const byKind = new Map<string, number[]>()
    for (const p of inWindow) if (p.platform === pf && p.people !== null) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p.people])
    for (const [kind, xs] of byKind) if (xs.length >= 2) kinds.push({ platform: pf, kind, count: xs.length, typical: median(xs) })
  }
  kinds.sort((a, b) => b.typical - a.typical)

  // Posting, week by week — the last 12 weeks, Monday to Sunday, Malaysia time.
  const todayT = Date.parse(`${today}T00:00:00Z`)
  const monday = todayT - ((new Date(todayT).getUTCDay() + 6) % 7) * DAY
  const weeks: WeekRow[] = Array.from({ length: 12 }, (_, i) => ({ start: new Date(monday - (11 - i) * 7 * DAY).toISOString().slice(0, 10), ig: 0, fb: 0 }))
  const first = Date.parse(`${weeks[0].start}T00:00:00Z`)
  for (const p of posts) {
    const i = Math.floor((Date.parse(`${mytDay(Date.parse(p.at))}T00:00:00Z`) - first) / (7 * DAY))
    if (i >= 0 && i < weeks.length) weeks[i][p.platform]++
  }

  // People reached each day, last 90 days. Each platform's day is unique people on that
  // platform; stacking them is a platform total, never unique people across both.
  const igByDay = new Map(audience.daily.filter(d => d.reach !== undefined).map(d => [d.day, d.reach!]))
  const fbByDay = new Map(fb.daily.filter(d => d.viewers != null).map(d => [d.day, d.viewers!]))
  const daily: DayRow[] = []
  for (let t = todayT - 89 * DAY; t <= todayT; t += DAY) {
    const day = new Date(t).toISOString().slice(0, 10)
    daily.push({ day, ig: igByDay.get(day) ?? null, fb: fbByDay.get(day) ?? null })
  }
  // Drop trailing days neither platform has reported yet.
  while (daily.length && daily.at(-1)!.ig === null && daily.at(-1)!.fb === null) daily.pop()

  return { ig, fb: fbf, total, hasIg, hasFb, fbFresh, igFresh, ranked, kinds, weeks, daily, days }
}

export type Social = ReturnType<typeof buildSocial>
