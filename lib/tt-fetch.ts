// 👉 Fetching TikTok data and shaping it into rows — nothing else. Like lib/fb-fetch.ts this
// file has NO imports: the app (lib/tt-refresh.ts, the cron) and the plain-Node Mac script
// (scripts/tt-backfill.mjs) both load it.
//
// The Composio call is injected as `exec` and the database as `db`. Tested against the live
// account on 17 Oct 2026. TikTok's API gives today's totals only: account counts, and each
// PUBLIC video's lifetime views/likes/comments/shares — no reach, watch time, audience or
// day-by-day history. History is what we store ourselves, one reading per refresh.

export type Exec = (slug: string, args: Record<string, unknown>) => Promise<any>
export type Db = { from: (table: string) => any }

export type TtAccount = {
  username: string
  day: string // Malaysia date of the reading
  followers: number | null
  following: number | null
  likes: number | null
  video_count: number | null
}

export type TtPost = {
  video_id: string
  username: string
  posted_at: string | null
  title: string | null
  duration: number | null
  share_url: string | null
  embed_link: string | null
  cover_url: string | null
}

export type TtPostMetric = { video_id: string; captured_at: string; views: number | null; likes: number | null; comments: number | null; shares: number | null }

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
// Links come from TikTok; anything but https is dropped rather than rendered as a link or image.
const https = (v: unknown) => (typeof v === 'string' && v.startsWith('https://') ? v : null)

/**
 * Composio wraps TikTok's own envelope: `{ successful, data: { data: {...}, error: { code } } }`.
 * TikTok says `code: "ok"` on success. The SDK reports a failed call as `successful: false`;
 * the CLI throws. All of these end up throwing here, never as an empty answer.
 */
async function call(exec: Exec, slug: string, args: Record<string, unknown>) {
  const res = await exec(slug, args)
  if (res && res.successful === false) throw new Error(`${slug}: ${res.error ?? 'failed'}`)
  const code = res?.data?.error?.code
  if (code && code !== 'ok') throw new Error(`${slug}: ${code} ${res?.data?.error?.message ?? ''}`.trim())
  return res?.data?.data ?? {}
}

/** Malaysia date (UTC+8 all year). */
export const myDate = (ms = Date.now()) => new Date(ms + 8 * 3_600_000).toISOString().slice(0, 10)

/** Account totals right now. */
export async function fetchAccount(exec: Exec, now = Date.now()): Promise<TtAccount> {
  const d = await call(exec, 'TIKTOK_GET_USER_STATS', {
    fields: ['follower_count', 'following_count', 'likes_count', 'video_count', 'display_name', 'username'],
  })
  const u = d.user ?? {}
  if (!u.username) throw new Error('TIKTOK_GET_USER_STATS: no username in the answer')
  return {
    username: String(u.username),
    day: myDate(now),
    followers: n(u.follower_count),
    following: n(u.following_count),
    likes: n(u.likes_count),
    video_count: n(u.video_count),
  }
}

/**
 * Public videos, newest first, with their lifetime figures as of `capturedAt`. TikTok pages 20
 * at a time; `cursor` is the create time (ms) to continue from. Stops at `since` (ISO date, by
 * posting date), at `max` videos, or when TikTok says there are no more.
 */
export async function fetchVideos(
  exec: Exec,
  username: string,
  capturedAt: string,
  { since, max = 5000 }: { since?: string; max?: number } = {},
): Promise<{ posts: TtPost[]; metrics: TtPostMetric[] }> {
  const posts = new Map<string, TtPost>()
  const metrics: TtPostMetric[] = []
  let cursor: number | undefined
  for (let calls = 0; calls < 400 && posts.size < max; calls++) {
    const args: Record<string, unknown> = { max_count: 20 }
    if (cursor !== undefined) args.cursor = cursor
    const d = await call(exec, 'TIKTOK_LIST_VIDEOS', args)
    const page: any[] = Array.isArray(d.videos) ? d.videos : []
    let older = false
    for (const v of page) {
      if (!v?.id || posts.has(String(v.id))) continue
      const at = typeof v.create_time === 'number' ? new Date(v.create_time * 1000).toISOString() : null
      if (since && at && at.slice(0, 10) < since) {
        older = true
        continue
      }
      const id = String(v.id)
      posts.set(id, {
        video_id: id,
        username,
        posted_at: at,
        title: typeof v.title === 'string' ? v.title : typeof v.video_description === 'string' ? v.video_description : null,
        duration: n(v.duration),
        share_url: https(v.share_url),
        embed_link: https(v.embed_link),
        cover_url: https(v.cover_image_url),
      })
      metrics.push({ video_id: id, captured_at: capturedAt, views: n(v.view_count), likes: n(v.like_count), comments: n(v.comment_count), shares: n(v.share_count) })
    }
    const next = n(d.cursor)
    if (older || !d.has_more || !page.length || next === null || next === cursor) break
    cursor = next
  }
  return { posts: [...posts.values()], metrics }
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

export async function persist(db: Db, { account, posts = [], metrics = [] }: { account?: TtAccount; posts?: TtPost[]; metrics?: TtPostMetric[] }) {
  const now = new Date().toISOString()
  // Upserts: a later reading of the same day or video replaces the earlier one.
  if (account) await upsert(db, 'tt_account_daily', [{ ...account, captured_at: now }], 'username,day')
  await upsert(db, 'tt_posts', posts.map(p => ({ ...p, updated_at: now })), 'video_id')
  await upsert(db, 'tt_post_metrics', metrics, 'video_id,captured_at')
}
