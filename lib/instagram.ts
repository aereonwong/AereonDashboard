import { supabase, supabaseConfigured } from './supabase'

// 👉 Instagram analytics. Data arrives through Composio's Instagram tools and is
// stored as a SNAPSHOT (one row per refresh) in `ig_snapshots`, so the tab loads
// instantly and a slow API never blocks a page view.
//
// The fetching itself is injected as `exec` — the app route passes a Composio
// SDK call, the local script passes the Composio CLI. Same shaping either way.

export type IgProfile = {
  username?: string
  name?: string
  followers_count?: number
  follows_count?: number
  media_count?: number
  biography?: string
  profile_picture_url?: string
}

export type IgPost = {
  id: string
  timestamp: string
  type: string // REELS | FEED | STORY …
  caption: string
  permalink?: string
  likes: number
  comments: number
  views?: number
  reach?: number
  saved?: number
  shares?: number
  /** Cover image: the photo itself, or a reel's thumbnail. Instagram CDN URLs
   *  expire, so these are refreshed with every snapshot and may be stale between. */
  thumb?: string
  /** A letterbox baked into the cover (a landscape video in a vertical frame):
   *  the fraction of the image height that is black band, top and bottom. */
  crop?: { t: number; b: number }
}

export type IgSnapshot = {
  captured_at: string
  username: string
  profile: IgProfile
  posts: IgPost[]
}

export type Exec = (slug: string, args: Record<string, unknown>) => Promise<any>

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)

// Pull profile + the most recent posts, then one insights call per post.
// Instagram quietly returns ZERO items when the page is too big for this field
// set (50 gives nothing, 40 is fine), so the request is capped at 40.
export const MAX_POSTS = 40
export async function buildSnapshot(exec: Exec, limit = MAX_POSTS): Promise<IgSnapshot> {
  limit = Math.min(Math.max(limit, 1), MAX_POSTS)
  const info = await exec('INSTAGRAM_GET_USER_INFO', {})
  const profile: IgProfile = info?.data ?? info ?? {}
  const igUserId = String((profile as any).id ?? '')
  if (!igUserId) throw new Error('Instagram account id missing from INSTAGRAM_GET_USER_INFO')

  const media = await exec('INSTAGRAM_GET_IG_USER_MEDIA', {
    ig_user_id: igUserId,
    limit,
    fields:
      'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
  })
  const items: any[] = media?.data?.data ?? media?.data ?? []

  const posts: IgPost[] = []
  for (const m of items) {
    const post: IgPost = {
      id: String(m.id),
      timestamp: String(m.timestamp ?? ''),
      type: String(m.media_product_type ?? m.media_type ?? 'FEED'),
      caption: String(m.caption ?? '').replace(/\s+/g, ' ').trim(),
      permalink: m.permalink ? String(m.permalink) : undefined,
      likes: Number(m.like_count ?? 0),
      comments: Number(m.comments_count ?? 0),
    }
    try {
      const ins = await exec('INSTAGRAM_GET_IG_MEDIA_INSIGHTS', {
        ig_media_id: post.id,
        metric: ['views', 'reach', 'saved', 'shares'],
      })
      for (const row of ins?.data?.data ?? []) {
        const v = num(row?.values?.[0]?.value)
        if (row?.name === 'views') post.views = v
        if (row?.name === 'reach') post.reach = v
        if (row?.name === 'saved') post.saved = v
        if (row?.name === 'shares') post.shares = v
      }
    } catch {
      // Insights can be unavailable for an individual post — keep the post.
    }
    posts.push(post)
  }

  await attachCovers(exec, igUserId, posts)

  return {
    captured_at: new Date().toISOString(),
    username: String((profile as any).username ?? ''),
    profile,
    posts,
  }
}

// Cover images, fetched in their own small pages. Instagram's CDN URLs run to
// 800+ characters each, and asking for them alongside the main field set pushes
// the response past the size at which Instagram silently returns ZERO posts —
// tested on 26 Sep 2026: 40, 25 and 20 per page all came back empty. Ten per
// page with only the image fields works, following the `after` cursor.
//
// A reel's `media_url` is the whole .mp4, which is useless as a picture; its
// cover is `thumbnail_url`. A photo or carousel has no thumbnail; its cover is
// `media_url`. These URLs expire, so they are refreshed with every snapshot.
const COVER_PAGE = 10
async function attachCovers(exec: Exec, igUserId: string, posts: IgPost[]): Promise<void> {
  const want = new Map(posts.map(p => [p.id, p]))
  let after: string | undefined
  for (let page = 0; page < Math.ceil(MAX_POSTS / COVER_PAGE) + 1 && want.size; page++) {
    let res: any
    try {
      res = await exec('INSTAGRAM_GET_IG_USER_MEDIA', {
        ig_user_id: igUserId,
        limit: COVER_PAGE,
        fields: 'id,media_type,media_url,thumbnail_url',
        ...(after ? { after } : {}),
      })
    } catch {
      return // covers are a nicety; a failure here never costs the snapshot
    }
    const body = res?.data ?? res
    const items: any[] = body?.data ?? []
    for (const m of items) {
      const post = want.get(String(m.id))
      if (!post) continue
      const cover = /VIDEO/i.test(String(m.media_type)) ? m.thumbnail_url : m.media_url ?? m.thumbnail_url
      if (cover) post.thumb = String(cover)
      want.delete(post.id)
    }
    after = body?.paging?.cursors?.after
    if (!items.length || !after) break
  }
  await measureLetterbox(posts)
}

// Some reel covers carry a letterbox: a landscape video placed in a vertical
// frame leaves solid black bands above and below. Measured here, once per
// snapshot, so the page can crop the band out rather than show it. Uses sharp,
// which ships with Next.js; if it is unavailable the covers simply stay as they are.
async function measureLetterbox(posts: IgPost[]): Promise<void> {
  let sharp: (input: Buffer) => import('sharp').Sharp
  try {
    sharp = (await import('sharp')).default as unknown as typeof sharp
  } catch {
    return
  }
  for (const p of posts) {
    if (!p.thumb || !/REEL|VIDEO/i.test(p.type)) continue
    try {
      const res = await fetch(p.thumb)
      if (!res.ok) continue
      const buf = Buffer.from(await res.arrayBuffer())
      const { data, info } = await sharp(buf).greyscale().resize({ width: 90 }).raw().toBuffer({ resolveWithObject: true })
      const dark = (row: number) => {
        let sum = 0
        let max = 0
        for (let x = 0; x < info.width; x++) {
          const v = data[row * info.width + x]
          sum += v
          if (v > max) max = v
        }
        return sum / info.width < 14 && max < 40
      }
      let top = 0
      while (top < info.height && dark(top)) top++
      let bottom = 0
      while (bottom < info.height - top && dark(info.height - 1 - bottom)) bottom++
      const t = top / info.height
      const b = bottom / info.height
      // A letterbox is symmetric. A dark band on one side only is usually real
      // content — night sky over a skyline — and must not be cropped away.
      if (t >= 0.04 && b >= 0.04 && Math.abs(t - b) < 0.05 && t + b < 0.7) {
        p.crop = { t: Math.round(t * 1000) / 1000, b: Math.round(b * 1000) / 1000 }
      }
    } catch {
      // a cover that cannot be read is shown as it is
    }
  }
}

export async function saveSnapshot(snap: IgSnapshot): Promise<void> {
  if (!supabaseConfigured) throw new Error('Supabase not configured')
  const { error } = await supabase.from('ig_snapshots').insert({
    captured_at: snap.captured_at,
    username: snap.username,
    profile: snap.profile,
    posts: snap.posts,
  })
  if (error) throw new Error(error.message)
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
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const interactions = (p: IgPost) => p.likes + p.comments + (p.saved ?? 0) + (p.shares ?? 0)
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)

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
  }
}
