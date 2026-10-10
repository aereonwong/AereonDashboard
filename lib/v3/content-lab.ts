import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import { angleOf, brandOf, hookOf, type Format, type LabPost, type LabWindow } from './lab-math'

// 👉 Content Lab — what it reads. This calendar year's posts (ig_posts for the caption and
// format, the LATEST reading in ig_post_metrics for the numbers), plus
// Instagram's own account windows and daily reach. The browser gets one compact row
// per post — the hook line, not the caption — and filters it there, instantly.
//
// Empty in demo mode: the Lab is built on real posts and never mixes invented records in.

/** 1 January of the current year, Malaysia time. Aereon chose this-year-only on 10 Oct 2026
 *  (the archive goes back to 2020, but that is more than the Lab needs to answer "what next").
 *  It rolls over by itself on 1 January. */
export const labSince = () => `${new Date(Date.now() + 8 * 3_600_000).getUTCFullYear()}-01-01`

export type Lab = { since: string; today: string; posts: LabPost[]; windows: LabWindow[]; newest: string | null; read: string | null }

const EMPTY: Lab = { since: '', today: '', posts: [], windows: [], newest: null, read: null }

type PostRow = { media_id: string; posted_at: string | null; type: string | null; media_type: string | null; caption: string | null; permalink: string | null; likes: number | null; comments: number | null }
type MetricRow = {
  media_id: string
  captured_at: string
  reach: number | null
  views: number | null
  likes: number | null
  comments: number | null
  saved: number | null
  shares: number | null
  watch_ms: number | null
  follows: number | null
}

// Supabase returns at most 1,000 rows a request, so every read is paged. Oldest first,
// so a failed page — or running past the cap — gives up rather than quietly dropping the newest rows.
async function paged<T>(build: (from: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[] | null> {
  const out: T[] = []
  for (let from = 0; from < 100_000; from += 1000) {
    const { data, error } = await build(from)
    if (error) return null
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) return out
  }
  return null
}

const formatOf = (type: string | null, media: string | null): Format =>
  /REEL/i.test(type ?? '') || media === 'VIDEO' ? 'reel' : media === 'CAROUSEL_ALBUM' ? 'carousel' : 'photo'

/** The hook line as the reader sees it: first line, clipped without splitting an emoji. */
const hookLine = (caption: string) => {
  const c = Array.from((caption.trim().split('\n')[0] ?? '').trim())
  return c.length > 110 ? c.slice(0, 110).join('') + '…' : c.join('')
}

export async function readLab(): Promise<Lab> {
  if (!supabaseConfigured || (await demoMode())) return EMPTY
  const since = labSince()
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10) // Malaysia's date: "last 30 days" ends today, not on the last post
  const sinceUtc = new Date(Date.parse(since + 'T00:00:00+08:00')).toISOString()
  const [posts, metrics, periods] = await Promise.all([
    paged<PostRow>(from =>
      supabase
        .from('ig_posts')
        .select('media_id, posted_at, type, media_type, caption, permalink, likes, comments')
        .gte('posted_at', sinceUtc)
        .or('type.is.null,type.neq.STORY') // a NULL type is a post, not a story: neq alone would drop it
        .order('posted_at', { ascending: true })
        .order('media_id', { ascending: true })
        .range(from, from + 999),
    ),
    paged<MetricRow>(from =>
      supabase
        .from('ig_post_metrics')
        .select('media_id, captured_at, reach, views, likes, comments, saved, shares, watch_ms, follows')
        .gte('captured_at', sinceUtc) // any reading of a this-year post was taken after 1 Jan
        .not('reach', 'is', null) // a refresh whose insights failed must not hide the last good reading
        .order('captured_at', { ascending: true })
        .order('media_id', { ascending: true })
        .range(from, from + 999),
    ),
    supabase.from('ig_account_periods').select('since, until, totals, follow_type').gte('until', since).order('since', { ascending: true }),
  ])
  if (!posts || !metrics) return EMPTY

  // Ascending by capture time, so the last reading of each post wins.
  const latest = new Map<string, MetricRow>()
  for (const m of metrics) latest.set(m.media_id, m)

  const out: LabPost[] = []
  for (const p of posts) {
    const m = latest.get(p.media_id)
    if (!m || m.reach === null || !p.posted_at) continue // listed but never measured: nothing to judge it by
    const caption = p.caption ?? ''
    const format = formatOf(p.type, p.media_type)
    out.push({
      id: p.media_id,
      at: p.posted_at,
      format,
      hook: hookLine(caption),
      link: p.permalink,
      reach: m.reach,
      // Missing is not zero: a metric Instagram did not return stays null and is left out of every median.
      views: m.views,
      likes: m.likes ?? p.likes,
      comments: m.comments ?? p.comments,
      saves: m.saved,
      shares: m.shares,
      watchSec: format === 'reel' && m.watch_ms ? m.watch_ms / 1000 : null,
      follows: format === 'reel' ? null : m.follows,
      angle: angleOf(caption),
      hookType: hookOf(caption),
      brand: brandOf(caption),
    })
  }

  const share = (list: unknown, key: string) =>
    Array.isArray(list) ? Number((list as { key: string; value: number }[]).find(x => x.key === key)?.value ?? 0) : 0
  const windows: LabWindow[] = ((periods.data ?? []) as { since: string; until: string; totals: any; follow_type: any }[]).map(w => ({
    since: w.since.slice(0, 10),
    until: w.until.slice(0, 10),
    reach: Number(w.totals?.reach ?? 0),
    followers: share(w.follow_type?.reach, 'FOLLOWER'),
    nonFollowers: share(w.follow_type?.reach, 'NON_FOLLOWER'),
    views: Number(w.totals?.views ?? 0),
    interactions: Number(w.totals?.total_interactions ?? 0),
  })).filter(w => w.followers + w.nonFollowers > 0) // the backfill omits the split when that call failed

  return {
    since,
    today,
    posts: out,
    windows,
    newest: out.at(-1)?.at ?? null,
    read: metrics.at(-1)?.captured_at ?? null,
  }
}
