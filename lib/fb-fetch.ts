// 👉 Fetching Facebook Page data and shaping it into rows — nothing else. Like
// lib/ig-fetch.ts this file has NO imports: the app (lib/fb-refresh.ts, the cron)
// and the plain-Node Mac script (scripts/fb-backfill.mjs) both load it.
//
// The Composio call is injected as `exec` and the database as `db`.
// Every metric here was tested against the live Page on 12 Oct 2026. Meta retired
// the old impression/reach metrics on 15 Nov 2025: "views" (page_media_view) and
// "unique viewers" (page_total_media_view_unique) are what Facebook reports now.

export type Exec = (slug: string, args: Record<string, unknown>) => Promise<any>
export type Db = { from: (table: string) => any }

/** Aereon's Page ("Aereon Wong"). Page ids are public; FB_PAGE_ID overrides it. */
export const DEFAULT_PAGE_ID = '835556219912496'

export type FbDay = {
  page_id: string
  day: string
  followers: number | null
  follows: number | null
  unfollows: number | null
  views: number | null
  viewers: number | null
  engagements: number | null
  video_views: number | null
}

export type FbPeriod = { page_id: string; until: string; views: number | null; viewers: number | null; engagements: number | null }

export type FbPost = {
  post_id: string
  page_id: string
  posted_at: string | null
  status_type: string | null
  type: 'VIDEO' | 'PHOTO' | 'LINK' | 'TEXT'
  message: string | null
  permalink: string | null
  picture: string | null
  reactions: number | null
  comments: number | null
  shares: number | null
}

export type FbPostMetric = { post_id: string; captured_at: string; views: number | null; viewers: number | null }

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const list = (res: any): any[] => {
  const r = res?.data?.data ?? res?.data
  return Array.isArray(r) ? r : []
}

/** The SDK reports a failed call as `{ successful: false }`; the CLI throws. Both end up throwing here. */
const guard =
  (exec: Exec): Exec =>
  async (slug, args) => {
    const res = await exec(slug, args)
    if (res && res.successful === false) throw new Error(`${slug}: ${res.error ?? 'failed'}`)
    return res
  }

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(fn))
}

const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
// Facebook stamps a day's figure at the END of that day (07:00 UTC = Pacific
// midnight), so the day it describes is the one before end_time's date.
const dayOf = (endTime: string) => isoDay(Date.parse(endTime.slice(0, 10)) - 86_400_000)

// ------------------------------------------------------------
// Page: day by day, and 28-day windows
// ------------------------------------------------------------

const DAILY: Record<string, keyof FbDay> = {
  page_follows: 'followers',
  page_daily_follows_unique: 'follows',
  page_daily_unfollows_unique: 'unfollows',
  page_media_view: 'views',
  page_total_media_view_unique: 'viewers',
  page_post_engagements: 'engagements',
  page_video_views: 'video_views',
}
const GROUPS = [
  ['page_follows', 'page_media_view'],
  ['page_daily_follows_unique', 'page_daily_unfollows_unique'],
  ['page_total_media_view_unique', 'page_post_engagements', 'page_video_views'],
]
const WINDOW: Record<string, keyof FbPeriod> = {
  page_media_view: 'views',
  page_total_media_view_unique: 'viewers',
  page_post_engagements: 'engagements',
}

/** Split [since, until] into ≤ 89-day pieces — Facebook refuses longer ranges. */
function spans(since: string, until: string): [string, string][] {
  const out: [string, string][] = []
  const end = Date.parse(until)
  for (let t = Date.parse(since); t < end; t += 89 * 86_400_000) out.push([isoDay(t), isoDay(Math.min(end, t + 89 * 86_400_000))])
  return out
}

async function insights(exec: Exec, pageId: string, since: string, until: string, period: string, metrics: string[]) {
  const res = await exec('FACEBOOK_GET_PAGE_INSIGHTS', { page_id: pageId, since, until, period, metrics: metrics.join(',') })
  const byDay = new Map<string, Record<string, number | null>>()
  for (const m of list(res)) {
    if (m?.period !== period) continue
    for (const v of m.values ?? []) {
      if (!v?.end_time) continue
      const d = dayOf(String(v.end_time))
      const row = byDay.get(d) ?? {}
      row[m.name] = n(v.value)
      byDay.set(d, row)
    }
  }
  return byDay
}

/** Page figures per day between two dates (YYYY-MM-DD). */
export async function fetchDaily(rawExec: Exec, pageId: string, since: string, until: string): Promise<FbDay[]> {
  const exec = guard(rawExec)
  const out = new Map<string, FbDay>()
  for (const [a, b] of spans(since, until)) {
    // All seven at once over 89 days comes back EMPTY (no error) — asked in threes, every one answers.
    for (const group of GROUPS) {
      const got = await insights(exec, pageId, a, b, 'day', group)
      for (const [day, vals] of got) {
        const row: FbDay = out.get(day) ?? { page_id: pageId, day, followers: null, follows: null, unfollows: null, views: null, viewers: null, engagements: null, video_views: null }
        for (const metric of group) if (metric in vals) (row as any)[DAILY[metric]] = vals[metric]
        out.set(day, row)
      }
    }
  }
  return [...out.values()].sort((x, y) => x.day.localeCompare(y.day))
}

/** Rolling 28-day totals, one per day — Facebook's own unique count for each window. */
export async function fetchPeriods(rawExec: Exec, pageId: string, since: string, until: string): Promise<FbPeriod[]> {
  const exec = guard(rawExec)
  const out = new Map<string, FbPeriod>()
  for (const [a, b] of spans(since, until)) {
    const got = await insights(exec, pageId, a, b, 'days_28', Object.keys(WINDOW))
    for (const [day, vals] of got) {
      const row: FbPeriod = { page_id: pageId, until: day, views: null, viewers: null, engagements: null }
      for (const [metric, col] of Object.entries(WINDOW)) (row as any)[col] = vals[metric] ?? null
      out.set(day, row)
    }
  }
  return [...out.values()].sort((x, y) => x.until.localeCompare(y.until))
}

/** Followers right now, from the Page itself (the daily series lags a day). */
export async function fetchFollowers(rawExec: Exec, pageId: string): Promise<{ name: string; followers: number | null }> {
  const res = await guard(rawExec)('FACEBOOK_GET_PAGE_DETAILS', { page_id: pageId, fields: 'name,followers_count' })
  const d = res?.data ?? {}
  return { name: String(d.name ?? ''), followers: n(d.followers_count) }
}

// ------------------------------------------------------------
// Posts
// ------------------------------------------------------------

const FIELDS =
  'id,message,created_time,permalink_url,status_type,full_picture,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)'

const typeOf = (s: string | null): FbPost['type'] =>
  s === 'added_video' ? 'VIDEO' : s === 'added_photos' ? 'PHOTO' : s === 'shared_story' ? 'LINK' : 'TEXT'

const shapePost = (pageId: string, p: any): FbPost => ({
  post_id: String(p.id),
  page_id: pageId,
  posted_at: p.created_time ?? null,
  status_type: p.status_type ?? null,
  type: typeOf(p.status_type ?? null),
  message: p.message ?? null,
  permalink: p.permalink_url ?? null,
  picture: p.full_picture ?? null,
  reactions: n(p.reactions?.summary?.total_count),
  comments: n(p.comments?.summary?.total_count),
  shares: n(p.shares?.count) ?? 0, // Facebook leaves `shares` out when nobody shared
})

/**
 * Every post from `since` (ISO date) to now, newest first. The tool has no page
 * cursor, so it walks backwards: each request asks for posts before the oldest
 * one already seen. Facebook answers a page that is too heavy (long captions,
 * pictures) with an EMPTY list rather than an error, so an empty page is retried
 * smaller before it is taken as the end.
 */
export async function fetchPosts(rawExec: Exec, pageId: string, since: string, max = 5000): Promise<FbPost[]> {
  const exec = guard(rawExec)
  const out = new Map<string, FbPost>()
  let until: string | undefined
  let size = 25
  for (let calls = 0; calls < 600 && out.size < max; calls++) {
    const args: Record<string, unknown> = { page_id: pageId, limit: size, fields: FIELDS, since }
    if (until) args.until = until
    const page = list(await exec('FACEBOOK_GET_PAGE_POSTS', args))
    if (!page.length && size > 5) {
      size = Math.max(5, Math.floor(size / 2))
      continue
    }
    let fresh = 0
    for (const p of page) {
      if (!p?.id || out.has(String(p.id))) continue
      if (p.created_time && p.created_time.slice(0, 10) < since) continue
      out.set(String(p.id), shapePost(pageId, p))
      fresh++
    }
    const oldest = page.map(p => String(p?.created_time ?? '')).filter(Boolean).sort()[0]
    if (!fresh || !oldest || page.length < size) break
    // One second earlier than the oldest seen, as a Unix timestamp.
    until = String(Math.floor(Date.parse(oldest) / 1000) - 1)
  }
  return [...out.values()].sort((a, b) => String(b.posted_at).localeCompare(String(a.posted_at)))
}

/** Views and unique viewers for each post, lifetime. A post Facebook won't answer for is left out. */
export async function postMetrics(rawExec: Exec, posts: { post_id: string }[], capturedAt: string, size = 4): Promise<FbPostMetric[]> {
  const exec = guard(rawExec)
  const out: FbPostMetric[] = []
  await pool(posts, size, async p => {
    try {
      const res = await exec('FACEBOOK_GET_POST_INSIGHTS', {
        post_id: p.post_id,
        metrics: 'post_media_view,post_total_media_view_unique',
        period: 'lifetime',
      })
      const val = (name: string) => {
        // Lifetime figures carry no end_time; Facebook sometimes adds a dated series beside them.
        const ms = list(res).filter(m => m?.name === name)
        const life = ms.find(m => !m.values?.[0]?.end_time) ?? ms[0]
        return n(life?.values?.[0]?.value)
      }
      const views = val('post_media_view')
      const viewers = val('post_total_media_view_unique')
      if (views !== null || viewers !== null) out.push({ post_id: p.post_id, captured_at: capturedAt, views, viewers })
    } catch {
      /* deleted or restricted post: no row rather than a false zero */
    }
  })
  return out
}

// ------------------------------------------------------------
// Saving
// ------------------------------------------------------------

async function upsert(db: Db, table: string, rows: object[], onConflict: string) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500), { onConflict })
    if (error) throw new Error(`${table}: ${error.message}`)
  }
}

export async function persist(
  db: Db,
  { days = [], periods = [], posts = [], metrics = [] }: { days?: FbDay[]; periods?: FbPeriod[]; posts?: FbPost[]; metrics?: FbPostMetric[] },
) {
  const now = new Date().toISOString()
  // Upserts: a later read of the same day or post replaces the earlier one.
  await upsert(db, 'fb_page_daily', days.map(d => ({ ...d, captured_at: now })), 'page_id,day')
  await upsert(db, 'fb_page_periods', periods.map(p => ({ ...p, captured_at: now })), 'page_id,until')
  await upsert(db, 'fb_posts', posts.map(p => ({ ...p, updated_at: now })), 'post_id')
  await upsert(db, 'fb_post_metrics', metrics, 'post_id,captured_at')
}
