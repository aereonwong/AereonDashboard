import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import type { Audience } from './audience'
import { engagement, followerFlow, type Facebook } from '@/lib/facebook'
import { change, type Tiktok } from '@/lib/tiktok'

// 👉 Social — Instagram, Facebook and TikTok on one page (/social), and the Dashboard's audience band.
//
// Two rules hold every figure here honest:
//   · Counts add up across platforms (followers, views, interactions, posts). People
//     reached do too, but only as a PLATFORM TOTAL: someone who sees both counts twice,
//     and the page says so. Nothing here claims unique people across platforms.
//   · Posts are compared by LIFT — a post's figure ÷ that platform's own typical (median)
//     post — because Instagram reach, Facebook viewers and TikTok views are each platform's own count.
// Instagram's account window is 30 days; Facebook's is its own 28-day window. TikTok reports no
// reach and no account views at all: its "views" are the videos posted in the window, at their
// latest reading, and it sits out of every people-reached figure.

export type Platform = 'ig' | 'fb' | 'tt'
export const PLATFORMS: Platform[] = ['ig', 'fb', 'tt']
export const PLATFORM_NAME: Record<Platform, string> = { ig: 'Instagram', fb: 'Facebook', tt: 'TikTok' }

export type SocialPost = {
  platform: Platform
  id: string
  at: string // posted, ISO
  title: string
  kind: string // Reel, Carousel, Photo, Video, Link…
  people: number | null // Instagram reach / Facebook viewers — unique per post; TikTok has none (null)
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
    // The archive (ig_posts) is filled by a separate job and can lag days behind; the daily
    // snapshot's newest posts that it doesn't have yet are added from the snapshot itself.
    const inArchive = new Set(posts.map(p => p.media_id as string))
    const fresh = (audience.snap?.posts ?? []).filter(p => !inArchive.has(p.id) && p.timestamp >= since).map(snapPost)
    return [...fresh, ...posts.map(p => {
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
    })]
  } catch {
    // Archive tables missing (supabase/instagram-archive.sql not run): fall back to the snapshot's posts.
    return (audience.snap?.posts ?? []).map(snapPost)
  }
}

type SnapPost = NonNullable<Audience['snap']>['posts'][number]
const snapPost = (p: SnapPost): SocialPost => ({
  platform: 'ig' as const,
  id: p.id,
  at: p.timestamp,
  title: firstLine(p.caption) || p.type,
  kind: p.type === 'REELS' ? 'Reel' : 'Photo', // the snapshot doesn't say carousel; the archive corrects it within days
  people: p.reach ?? null,
  views: p.views ?? null,
  interactions: p.interactions ?? (p.saved != null && p.shares != null ? p.likes + p.comments + p.saved + p.shares : null),
  permalink: p.permalink ?? null,
  thumb: p.thumb ?? null,
})

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

export function ttPosts(tt: Tiktok): SocialPost[] {
  return tt.posts
    .filter(p => p.posted_at)
    .map(p => ({
      platform: 'tt' as const,
      id: p.video_id,
      at: p.posted_at!,
      title: firstLine(p.title) || 'Video',
      kind: 'Video',
      people: null, // TikTok reports no reach
      views: p.views,
      // Missing is not zero: all three counts read, or no figure.
      interactions: p.likes !== null && p.comments !== null && p.shares !== null ? p.likes + p.comments + p.shares : null,
      permalink: p.share_url,
      thumb: p.cover_url,
    }))
}

/** The figure a post is ranked by on its own platform: people reached, or views on TikTok. */
export const scoreOf = (p: SocialPost) => (p.platform === 'tt' ? p.views : p.people)

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
  people: number | null // IG 30-day reach / FB 28-day viewers / TikTok: none
  views: number | null // TikTok: views of the videos posted in the last 30 days
  interactions: number | null
  posts: number // in the post window
  perWeek: number
  typical: number // median people per post in the post window (TikTok: views)
  lastPost: string | null
}

export type KindRow = { platform: Platform; kind: string; count: number; typical: number }
export type WeekRow = { start: string; ig: number; fb: number; tt: number }
export type DayRow = { day: string; ig: number | null; fb: number | null }
/** One point per platform: a month's views, or a day's followers. Null = not measured then. */
export type PlatformRow = { key: string; label: string; ig: number | null; fb: number | null; tt: number | null }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function buildSocial(audience: Audience, fb: Facebook, tt: Tiktok, posts: SocialPost[], days: number, now = Date.now()) {
  const today = mytDay(now)
  const cutoff = new Date(now - days * DAY).toISOString()
  const inWindow = posts.filter(p => p.at >= cutoff)

  const figures = (pf: Platform): PlatformFigures => {
    const mine = inWindow.filter(p => p.platform === pf)
    const read = mine.filter(p => scoreOf(p) !== null)
    const last = posts.filter(p => p.platform === pf).reduce<string | null>((a, p) => (!a || p.at > a ? p.at : a), null)
    const base = { posts: mine.length, perWeek: mine.length / (days / 7), typical: median(read.map(p => scoreOf(p)!)), lastPost: last }
    if (pf === 'tt') {
      // No account views on TikTok: the videos posted in the last 30 days, every one read, or no figure.
      const month = posts.filter(p => p.platform === 'tt' && p.at >= new Date(now - 30 * DAY).toISOString())
      const sum = (f: (p: SocialPost) => number | null) => (month.every(p => f(p) !== null) ? month.reduce((t, p) => t + f(p)!, 0) : null)
      return {
        ...base,
        followers: tt.followers,
        net30: change(tt.daily, 'followers', 30, now)?.net ?? null,
        people: null,
        views: sum(p => p.views),
        interactions: sum(p => p.interactions),
      }
    }
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
  const ttf = figures('tt')
  // A Facebook window more than a week old would understate the month; leave it out of totals.
  const fbFresh = !!fb.window && fb.window.until >= mytDay(now - 7 * DAY)
  // Same for Instagram's account row: a stale one would be labelled "last month" when it is not.
  const igFresh = !!audience.view && Date.parse(audience.view.capturedAt) >= now - 7 * DAY
  const hasIg = !!audience.view || audience.followers > 0
  const hasFb = fb.daily.length > 0 || fb.posts.length > 0
  const hasTt = tt.daily.length > 0 || tt.posts.length > 0
  // TikTok's latest account reading (a Malaysia date) within the week, or it sits out of the totals.
  const ttFresh = !!tt.daily.length && tt.daily.at(-1)!.day >= mytDay(now - 7 * DAY)
  const add = (...xs: (number | null)[]) => (xs.every(x => x !== null) ? xs.reduce((t, x) => t! + x!, 0) : null)
  const fbWin = (n: number | null) => (fbFresh ? n : null)
  const igWin = (n: number | null) => (igFresh ? n : null)
  // TikTok joins a total only when connected; a connected but stale TikTok hides the total
  // rather than shrinking it, the same as the other two.
  const withTt = (n: number | null) => (hasTt ? [ttFresh ? n : null] : [])
  // Follower change: TikTok's needs 30 days of our own readings, so until then the combined
  // change covers the platforms that have one — and says which (netOf).
  // A stale TikTok reading sits out of the change too, the same as out of the follower total.
  const nets = PLATFORMS.filter(p => p !== 'tt' || hasTt).map(p => ({ p, n: { ig: ig.net30, fb: fbf.net30, tt: ttFresh ? ttf.net30 : null }[p] }))
  const known = nets.filter(x => x.n !== null)
  const total = {
    followers: ig.followers + fbf.followers + (ttFresh ? ttf.followers : 0),
    net30: known.length >= 2 || (known.length && known.length === nets.length) ? known.reduce((t, x) => t + x.n!, 0) : null,
    netOf: known.map(x => x.p),
    people: add(igWin(ig.people), fbWin(fbf.people)), // TikTok reports no reach
    views: add(igWin(ig.views), fbWin(fbf.views), ...withTt(ttf.views)),
    interactions: add(igWin(ig.interactions), fbWin(fbf.interactions), ...withTt(ttf.interactions)),
    posts: ig.posts + fbf.posts + ttf.posts,
    perWeek: ig.perWeek + fbf.perWeek + ttf.perWeek,
  }

  // Lift against each platform's own typical post in the window.
  const typicalOf = { ig: ig.typical, fb: fbf.typical, tt: ttf.typical }
  const lift = (p: SocialPost) => (scoreOf(p) !== null && typicalOf[p.platform] ? scoreOf(p)! / typicalOf[p.platform] : null)
  const ranked = inWindow
    .filter(p => lift(p) !== null)
    .map(p => ({ ...p, lift: lift(p)! }))
    .sort((a, b) => b.lift - a.lift || (scoreOf(b) ?? 0) - (scoreOf(a) ?? 0))

  // What travels: typical figure per post (people; TikTok views), by platform and kind (2+ posts to count).
  const kinds: KindRow[] = []
  for (const pf of PLATFORMS) {
    const byKind = new Map<string, number[]>()
    for (const p of inWindow) if (p.platform === pf && scoreOf(p) !== null) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), scoreOf(p)!])
    for (const [kind, xs] of byKind) if (xs.length >= 2) kinds.push({ platform: pf, kind, count: xs.length, typical: median(xs) })
  }
  kinds.sort((a, b) => b.typical - a.typical)

  // Posting, week by week — the last 12 weeks, Monday to Sunday, Malaysia time.
  const todayT = Date.parse(`${today}T00:00:00Z`)
  const monday = todayT - ((new Date(todayT).getUTCDay() + 6) % 7) * DAY
  const weeks: WeekRow[] = Array.from({ length: 12 }, (_, i) => ({ start: new Date(monday - (11 - i) * 7 * DAY).toISOString().slice(0, 10), ig: 0, fb: 0, tt: 0 }))
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

  // Views earned by the posts of each month, last 12 months — every platform reports views per
  // post, so this is the one chart that compares all three like for like. Views are counts and
  // stack. A month with no posts read on a platform is null (a gap), never zero.
  const thisMonth = today.slice(0, 7)
  const monthKeys = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 1 - (11 - i), 1))
    return d.toISOString().slice(0, 7)
  })
  const monthViews = new Map<string, Record<Platform, number | null>>(monthKeys.map(k => [k, { ig: null, fb: null, tt: null }]))
  for (const p of posts) {
    const row = monthViews.get(mytDay(Date.parse(p.at)).slice(0, 7))
    if (row && p.views !== null) row[p.platform] = (row[p.platform] ?? 0) + p.views
  }
  const months: PlatformRow[] = monthKeys.map(k => ({ key: k, label: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, ...monthViews.get(k)! }))

  // Followers each day, last 90 days — each platform from the day its history starts
  // (Facebook Aug 2024, Instagram's snapshots Sep 2026, TikTok's readings Oct 2026).
  const igF = new Map(audience.history.map(h => [h.date.slice(0, 10), h.followers]))
  const fbF = new Map(fb.daily.filter(d => d.followers).map(d => [d.day, d.followers!]))
  const ttF = new Map(tt.daily.filter(d => d.followers).map(d => [d.day, d.followers!]))
  const followers: PlatformRow[] = []
  for (let t = todayT - 89 * DAY; t <= todayT; t += DAY) {
    const day = new Date(t).toISOString().slice(0, 10)
    followers.push({ key: day, label: day, ig: igF.get(day) ?? null, fb: fbF.get(day) ?? null, tt: ttF.get(day) ?? null })
  }

  return { ig, fb: fbf, tt: ttf, total, hasIg, hasFb, hasTt, fbFresh, igFresh, ttFresh, ranked, kinds, weeks, daily, months, followers, days }
}

export type Social = ReturnType<typeof buildSocial>
