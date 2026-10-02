// 👉 Fetching Instagram data and shaping it into rows — nothing else. This file
// has no static imports on purpose (only `sharp`, loaded on demand and optional):
// the app (lib/instagram.ts, the cron) and the plain-Node Mac script
// (scripts/ig-refresh.mjs, via Node's type stripping) both load it, so the two
// can never drift apart again.
//
// The Composio call is injected as `exec` and the database as `db`.
// Every metric here was tested against the live account on 2 Oct 2026.

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
  /** Instagram's own count of every interaction (likes, comments, saves, shares, reposts). */
  interactions?: number
  /** Reels only: average watch time per play, and all watch time added up, in milliseconds. */
  watchMs?: number
  watchTotalMs?: number
  /** Photos and carousels only: follows and profile visits the post caused. */
  follows?: number
  profileVisits?: number
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

/** One labelled count from an Instagram breakdown: a country, an age band, a format. */
export type Slice = { key: string; value: number }

/** The account as a whole over the last 30 days — figures no single post carries. */
export type IgAccount = {
  captured_at: string
  window_days: number
  /** reach, views, accounts_engaged, total_interactions, likes, comments, shares, saves,
   *  replies, profile_views, profile_links_taps, website_clicks — whichever Instagram returned. */
  totals: Record<string, number>
  /** Followers vs everyone else. `follows` is FOLLOWER = new follows, NON_FOLLOWER = unfollows. */
  follow_type: { reach?: Slice[]; views?: Slice[]; follows?: Slice[] }
  /** Reach and views per format: REEL, POST, CAROUSEL_CONTAINER, STORY, AD, LIVE. */
  formats: { reach?: Slice[]; views?: Slice[] }
  /** Who follows (lifetime) and who engaged this month. Instagram returns the top 45 cities/countries. */
  demographics: {
    followers?: { age?: Slice[]; gender?: Slice[]; country?: Slice[]; city?: Slice[] }
    engaged?: { age?: Slice[]; gender?: Slice[]; country?: Slice[]; city?: Slice[] }
  }
  /** One point per day. `new_followers` is follows gained that day (Instagram's follower_count). */
  daily: { day: string; reach?: number; new_followers?: number }[]
}

export type Exec = (slug: string, args: Record<string, unknown>) => Promise<any>
/** The slice of a Supabase client this file needs. */
export type Db = { from: (table: string) => any }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const rows = (res: any): any[] => {
  const r = res?.data?.data ?? res?.data
  return Array.isArray(r) ? r : []
}

/** Composio's SDK reports a failed tool call as `{ successful: false }` rather than
 *  throwing, and the CLI throws. Both callers go through this, so a failure always
 *  throws here and every fallback below behaves the same in the app and the script. */
const guard =
  (exec: Exec): Exec =>
  async (slug, args) => {
    const res = await exec(slug, args)
    if (res && res.successful === false) throw new Error(`${slug}: ${res.error ?? 'failed'}`)
    return res
  }

// Run tasks a few at a time — fast, but gentle on Instagram's rate limit.
async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

// ------------------------------------------------------------
// Posts
// ------------------------------------------------------------

// Instagram quietly returns ZERO items when the page is too big for this field
// set (50 gives nothing, 40 is fine), so the request is capped at 40.
export const MAX_POSTS = 40

// Which insights each format accepts. Asking for one a format does not support
// fails the WHOLE call, so each list is tried in turn until one is accepted.
const BASE = ['views', 'reach', 'saved', 'shares', 'total_interactions']
const METRICS: Record<string, string[][]> = {
  REELS: [[...BASE, 'ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'], BASE],
  FEED: [[...BASE, 'follows', 'profile_visits'], BASE],
}

export async function buildSnapshot(rawExec: Exec, limit = MAX_POSTS): Promise<IgSnapshot> {
  const exec = guard(rawExec)
  limit = Math.min(Math.max(limit, 1), MAX_POSTS)
  const info = await exec('INSTAGRAM_GET_USER_INFO', {})
  const profile: IgProfile = info?.data ?? info ?? {}
  const igUserId = String((profile as any).id ?? '')
  if (!igUserId) throw new Error('Instagram account id missing from INSTAGRAM_GET_USER_INFO')

  const media = await exec('INSTAGRAM_GET_IG_USER_MEDIA', {
    ig_user_id: igUserId,
    limit,
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
  })
  const posts: IgPost[] = rows(media).map(m => ({
    id: String(m.id),
    timestamp: String(m.timestamp ?? ''),
    type: String(m.media_product_type ?? m.media_type ?? 'FEED'),
    caption: String(m.caption ?? '').replace(/\s+/g, ' ').trim(),
    permalink: m.permalink ? String(m.permalink) : undefined,
    likes: Number(m.like_count ?? 0),
    comments: Number(m.comments_count ?? 0),
  }))

  await pool(posts, 5, post => postInsights(exec, post))
  await attachCovers(exec, igUserId, posts)

  return {
    captured_at: new Date().toISOString(),
    username: String((profile as any).username ?? ''),
    profile,
    posts,
  }
}

/** Insights for posts outside the latest page (e.g. older posts linked to an
 *  invoice), with the same per-format metric lists and fallbacks. */
export async function insightsFor(rawExec: Exec, posts: IgPost[]): Promise<void> {
  const exec = guard(rawExec)
  await pool(posts, 5, p => postInsights(exec, p))
}

async function postInsights(exec: Exec, post: IgPost) {
  for (const metric of (Object.hasOwn(METRICS, post.type) ? METRICS[post.type] : null) ?? [BASE]) {
    try {
      const ins = await exec('INSTAGRAM_GET_IG_MEDIA_INSIGHTS', { ig_media_id: post.id, metric })
      for (const row of rows(ins)) {
        const v = num(row?.values?.[0]?.value ?? row?.total_value?.value)
        switch (row?.name) {
          case 'views': post.views = v; break
          case 'reach': post.reach = v; break
          case 'saved': post.saved = v; break
          case 'shares': post.shares = v; break
          case 'total_interactions': post.interactions = v; break
          case 'ig_reels_avg_watch_time': post.watchMs = v; break
          case 'ig_reels_video_view_total_time': post.watchTotalMs = v; break
          case 'follows': post.follows = v; break
          case 'profile_visits': post.profileVisits = v; break
        }
      }
      return
    } catch {
      // try the smaller list; a post with no insights at all is still a post
    }
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
// Only Instagram's own image hosts are fetched.
const isInstagramCdn = (url: string) => {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && /(^|\.)(cdninstagram\.com|fbcdn\.net)$/.test(u.hostname)
  } catch {
    return false
  }
}

async function measureLetterbox(posts: IgPost[]): Promise<void> {
  let sharp: any
  try {
    sharp = (await import('sharp')).default
  } catch {
    return
  }
  for (const p of posts) {
    if (!p.thumb || !/REEL|VIDEO/i.test(p.type) || !isInstagramCdn(p.thumb)) continue
    try {
      const res = await fetch(p.thumb, { signal: AbortSignal.timeout(8_000) })
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

// ------------------------------------------------------------
// The account
// ------------------------------------------------------------

const TOTALS = [
  'reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves',
  'replies', 'profile_views', 'profile_links_taps', 'website_clicks',
]

const slices = (row: any): Slice[] | undefined => {
  const res = row?.total_value?.breakdowns?.[0]?.results
  if (!Array.isArray(res)) return undefined
  return res
    .map((r: any) => ({ key: String(r.dimension_values?.[0] ?? ''), value: Number(r.value ?? 0) }))
    .filter((s: Slice) => s.key && s.key !== 'DEFAULT_DO_NOT_USE')
    .sort((a: Slice, b: Slice) => b.value - a.value)
}

// Each call is independent and any one may fail or come back empty (Instagram
// hides figures it has too little data for). A missing piece is left out — never
// filled with a zero that would read as a real figure.
export async function buildAccount(rawExec: Exec, igUserId?: string): Promise<IgAccount> {
  const exec = guard(rawExec)
  const id = igUserId ?? String((await exec('INSTAGRAM_GET_USER_INFO', {}))?.data?.id ?? '')
  if (!id) throw new Error('Instagram account id missing')
  // Instagram allows at most 30 days between `since` and `until`.
  const until = Math.floor(Date.now() / 1000)
  const since = until - 30 * 86_400 + 3_600
  const ask = (args: Record<string, unknown>) =>
    exec('INSTAGRAM_GET_USER_INSIGHTS', { ig_user_id: id, ...args }).then(rows, () => [] as any[])
  const window = { period: 'day', metric_type: 'total_value', since, until }
  const demo = (metric: string, breakdown: string, timeframe = 'this_month') =>
    ask({ metric: [metric], period: 'lifetime', metric_type: 'total_value', breakdown, timeframe }).then(r => slices(r[0]))

  // Run a few at a time, like the post insights, to stay gentle on the rate limit.
  // (engaged_audience_demographics was tried on 2 Oct 2026 and returns nothing for
  // this account, so it is not asked for.)
  const jobs: (() => Promise<any>)[] = [
    () => ask({ metric: ['reach', 'follower_count'], period: 'day', since, until }),
    () => ask({ metric: TOTALS, ...window }),
    () => ask({ metric: ['reach', 'views'], ...window, breakdown: 'follow_type' }),
    () => ask({ metric: ['follows_and_unfollows'], ...window, breakdown: 'follow_type' }),
    () => ask({ metric: ['reach', 'views'], ...window, breakdown: 'media_product_type' }),
    ...['age', 'gender', 'country', 'city'].map(b => () => demo('follower_demographics', b)),
  ]
  const results: any[] = new Array(jobs.length)
  await pool(
    jobs.map((job, i) => ({ job, i })),
    4,
    async ({ job, i }) => {
      results[i] = await job()
    },
  )
  const [series, totals, follow, follows, formats, ...demos] = results as [any[], any[], any[], any[], any[], ...(Slice[] | undefined)[]]

  // A day's value carries an end_time of the NEXT day's start (Pacific time),
  // so the day it describes is the one before.
  const byDay = new Map<string, { day: string; reach?: number; new_followers?: number }>()
  for (const row of series) {
    for (const v of row?.values ?? []) {
      const value = num(v?.value)
      if (value === undefined || !v?.end_time) continue
      const day = new Date(Date.parse(v.end_time) - 86_400_000).toISOString().slice(0, 10)
      const point = byDay.get(day) ?? { day }
      if (row.name === 'reach') point.reach = value
      if (row.name === 'follower_count') point.new_followers = value
      byDay.set(day, point)
    }
  }

  // Instagram fills in the newest day's follows late (it reads 0, then the real
  // figure a day later), so that one value is left out until a later refresh.
  const settle = (days: { day: string; reach?: number; new_followers?: number }[]) =>
    days.map((d, i) => (i === days.length - 1 ? { day: d.day, reach: d.reach } : d))
  const named = (rs: any[], name: string) => rs.find(r => r?.name === name)
  const [fAge, fGender, fCountry, fCity] = demos
  const clean = <T extends Record<string, unknown>>(o: T) =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && (!Array.isArray(v) || v.length))) as T

  return {
    captured_at: new Date().toISOString(),
    window_days: 30,
    totals: Object.fromEntries(
      totals.map(r => [r?.name, num(r?.total_value?.value)]).filter(([, v]) => v !== undefined),
    ),
    follow_type: clean({
      reach: slices(named(follow, 'reach')),
      views: slices(named(follow, 'views')),
      follows: slices(named(follows, 'follows_and_unfollows')),
    }),
    formats: clean({ reach: slices(named(formats, 'reach')), views: slices(named(formats, 'views')) }),
    demographics: clean({
      followers: clean({ age: fAge, gender: fGender, country: fCountry, city: fCity }),
    }),
    daily: settle([...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))),
  }
}

// ------------------------------------------------------------
// Saving
// ------------------------------------------------------------

/** One row per post per snapshot, so each post's numbers can be followed as it ages. */
export const postRows = (snap: IgSnapshot) =>
  snap.posts.map(p => ({
    captured_at: snap.captured_at,
    media_id: p.id,
    posted_at: p.timestamp || null,
    type: p.type,
    views: p.views ?? null,
    reach: p.reach ?? null,
    likes: p.likes,
    comments: p.comments,
    saved: p.saved ?? null,
    shares: p.shares ?? null,
    interactions: p.interactions ?? null,
    watch_ms: p.watchMs ?? null,
    watch_total_ms: p.watchTotalMs ?? null,
    follows: p.follows ?? null,
    profile_visits: p.profileVisits ?? null,
  }))

/**
 * Store a refresh. The snapshot row is the one that must land (the tabs read it),
 * so its failure throws. The history tables are extra: if one is missing or
 * refuses a row, the reason comes back as a warning and the refresh still counts.
 */
export async function persist(db: Db, snap: IgSnapshot, account?: IgAccount | null): Promise<string[]> {
  const warnings: string[] = []
  const { error } = await db.from('ig_snapshots').insert({
    captured_at: snap.captured_at,
    username: snap.username,
    profile: snap.profile,
    posts: snap.posts,
  })
  if (error) throw new Error(error.message)

  const note = (table: string, e: { message?: string } | null) => {
    if (e) warnings.push(`${table}: ${e.message ?? 'failed'}`)
  }
  note('ig_post_metrics', (await db.from('ig_post_metrics').insert(postRows(snap))).error)
  if (account) {
    const { daily, ...rest } = account
    note('ig_account_snapshots', (await db.from('ig_account_snapshots').insert(rest)).error)
    if (daily.length) {
      const stamped = daily.map(d => ({ ...d, updated_at: account.captured_at }))
      note('ig_account_daily', (await db.from('ig_account_daily').upsert(stamped, { onConflict: 'day' })).error)
    }
  }
  return warnings
}
