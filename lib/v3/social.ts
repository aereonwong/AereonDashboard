import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import type { Audience } from './audience'
import { engagement, followerFlow, type Facebook } from '@/lib/facebook'
import { change, type Tiktok } from '@/lib/tiktok'

// 👉 Social — every connected platform on one page (/social) and in the Dashboard's audience band.
//
// One currency across platforms: VIEWS PER POST. Every platform reports how many times each
// post was viewed (Instagram, Facebook, TikTok today; YouTube, Threads, Xiaohongshu too), so
// views, interactions, engagement rate, the typical post and the post ranking are all read the
// same way on every platform: the posts PUBLISHED in the window, each at its latest reading.
// Account-level figures each platform defines differently (Instagram's views include Stories and
// ads; TikTok has none) are left to the platform's own page.
//
// The rules that keep every figure honest:
//   · Counts add up across platforms (followers, views, interactions, posts). Someone on two
//     platforms counts twice — the page says so; nothing here claims unique people.
//   · People reached is each platform's OWN unique count over its OWN window (Instagram 30 days,
//     Facebook 28). It is added only as a platform total, only across platforms that measure it,
//     and never across windows.
//   · Missing is never zero: an unread post sits out of the sums and the page counts it.
//   · A platform whose account reading is over a week old is flagged as stale.
//
// Adding a platform = one adapter below returning a `Source`; see lib/v3/platforms.ts.

export { PLATFORM_NAME } from './platforms'
export type { PlatformId } from './platforms'

export type { SocialPost, Source, PlatformFigures, PlatformRow, KindRow, Social } from './social-math'
export { buildSocial, median, rateOf } from './social-math'
import type { SocialPost, Source } from './social-math'

const DAY = 86_400_000
const STALE = 7 * DAY
// Malaysia is UTC+8 all year.
const mytDay = (t: number) => new Date(t + 8 * 3_600_000).toISOString().slice(0, 10)
const firstLine = (t: string | null | undefined) => (t ?? '').split('\n')[0].trim()

// ------------------------------------------------------------
// Reading posts
// ------------------------------------------------------------

const IG_KIND = (type: string | null, mediaType: string | null) =>
  type === 'REELS' ? 'Reel' : mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : mediaType === 'VIDEO' ? 'Video' : 'Photo'
const FB_KIND: Record<string, string> = { VIDEO: 'Video', PHOTO: 'Photo', LINK: 'Link', TEXT: 'Text' }

/** Instagram posts of the last `days` days from the archive (ig_posts), each with its latest stored reading. */
export async function readIgPosts(audience: Audience, days = 365, real = false): Promise<SocialPost[]> {
  if (!supabaseConfigured || (!real && (await demoMode()))) return []
  const since = new Date(Date.now() - days * DAY).toISOString()
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
    return [
      ...fresh,
      ...posts.map(p => {
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
      }),
    ]
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

// ------------------------------------------------------------
// Adapters — one per platform, stored rows → Source
// ------------------------------------------------------------

export function igSource(audience: Audience, posts: SocialPost[], now = Date.now(), demo = false): Source | null {
  // Demo mode shows no real social figures — the post read is empty there, so the account is too.
  if (demo || (!audience.view && !audience.followers && !posts.length)) return null
  const v = audience.view
  const read = Math.max(Date.parse(v?.capturedAt ?? '') || 0, Date.parse(audience.snap?.captured_at ?? '') || 0)
  return {
    id: 'ig',
    followers: audience.followers,
    // A stale reading's change is not "the last 30 days": no figure rather than an old one.
    net30: now - read < STALE && v?.follows != null && v?.unfollows != null ? v.follows - v.unfollows : null,
    fresh: now - read < STALE,
    followerDays: audience.history.map(h => [h.date, h.followers]),
    peopleDays: audience.daily.filter(d => d.reach !== undefined).map(d => [d.day, d.reach!]),
    // A stale account row would be labelled "last 30 days" when it is not.
    people: { value: v && now - Date.parse(v.capturedAt) < STALE ? v.totals.reach : null, window: 30 },
    posts,
  }
}

export function fbSource(fb: Facebook, now = Date.now()): Source | null {
  if (!fb.daily.length && !fb.posts.length) return null
  const latest = fb.daily.at(-1)?.day ?? ''
  const fresh = latest >= mytDay(now - STALE)
  const windowFresh = !!fb.window && fb.window.until >= mytDay(now - STALE)
  return {
    id: 'fb',
    followers: fb.followers,
    // Only when the 30 days are (nearly) all read — Facebook's newest day lands a day or two late, but a
    // longer gap would shorten the span under a "30 days" label.
    net30: fresh && followerFlow(fb.daily, 30, now).days >= 27 ? followerFlow(fb.daily, 30, now).net : null,
    fresh,
    followerDays: fb.daily.filter(d => d.followers).map(d => [d.day, d.followers!]),
    peopleDays: fb.daily.filter(d => d.viewers != null).map(d => [d.day, d.viewers!]),
    people: { value: windowFresh ? (fb.window?.viewers ?? null) : null, window: 28 },
    posts: fb.posts
      .filter(p => p.posted_at)
      .map(p => ({
        platform: 'fb' as const,
        id: p.post_id,
        at: p.posted_at!,
        title: firstLine(p.message) || FB_KIND[p.type] || 'Post',
        kind: FB_KIND[p.type] ?? p.type,
        people: p.viewers,
        views: p.views,
        // Missing is not zero: all three counts read, or no figure.
        interactions: p.reactions != null && p.comments != null && p.shares != null ? engagement(p) : null,
        permalink: p.permalink ?? null,
        thumb: p.picture ?? null,
      })),
  }
}

export function ttSource(tt: Tiktok, now = Date.now()): Source | null {
  if (!tt.daily.length && !tt.posts.length) return null
  const fresh = !!tt.daily.length && tt.daily.at(-1)!.day >= mytDay(now - STALE)
  return {
    id: 'tt',
    followers: tt.followers,
    net30: fresh ? (change(tt.daily, 'followers', 30, now)?.net ?? null) : null,
    fresh,
    followerDays: tt.daily.filter(d => d.followers).map(d => [d.day, d.followers!]),
    peopleDays: null, // TikTok reports no reach
    people: null,
    posts: tt.posts
      .filter(p => p.posted_at)
      .map(p => ({
        platform: 'tt' as const,
        id: p.video_id,
        at: p.posted_at!,
        title: firstLine(p.title) || 'Video',
        kind: 'Video',
        people: null,
        views: p.views,
        // Missing is not zero: all three counts read, or no figure.
        interactions: p.likes !== null && p.comments !== null && p.shares !== null ? p.likes + p.comments + p.shares : null,
        permalink: p.share_url,
        thumb: p.cover_url,
      })),
  }
}

