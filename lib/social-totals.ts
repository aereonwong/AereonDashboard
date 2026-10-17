import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { fbPageId, readFacebook } from './facebook'
import { readTiktok } from './tiktok'
import { readAudience } from './v3/audience'
import { readIgPosts, igSource, fbSource, ttSource, buildSocial } from './v3/social'
import { totalsRows, type TotalsRow } from './v3/social-math'
import type { PlatformId } from './v3/platforms'

// 👉 The public proof numbers (landing page, media kits, /hello and its share card, the reel), and the
// table they come from. Since 18 Oct 2026 every figure here is the SAME maths as /social and the
// Dashboard (lib/v3/social-math.ts): views and interactions are those of the posts published in the
// window, each at its latest reading, on every platform alike.
//
//   · writeSocialTotals() computes once and stores one row per platform per window, plus 'all', in
//     social_totals (supabase/social-totals.sql). It runs after the daily 6am refresh, after any
//     Refresh button, and from POST /api/social/totals.
//   · socialTotals() — what the public pages call — reads the newest stored day. Only when there is
//     none fresh (table not created yet, or the job stalled two days) does it compute on the spot,
//     without storing, so a page never goes blank.
//
// The pages show the overall figure only, never a per-platform split (Aereon's call, 16 Oct 2026).
// People reached is each platform's own unique count over its own window (Instagram 30 days,
// Facebook 28), added only across platforms — never across windows. TikTok measures no reach and sits
// out of it. If any platform is stale or unread, that total is null and the tile hides: a partial
// "overall" figure would undersell, and missing is never counted as zero.

const DAY = 86_400_000
const STALE = 7 * DAY
/** Stored totals older than this are recomputed on the spot instead. */
const STORED_FOR = 2 * DAY
const mytDay = (t: number) => new Date(t + 8 * 3_600_000).toISOString().slice(0, 10)

export type SocialTotals = {
  /** Views over the last 90 days' posts. */
  views: number | null
  /** Likes, comments, shares (Instagram adds saves) over the last 90 days' posts. */
  interactions: number | null
  /** Interactions per 100 views, last 30 days' posts. */
  rate: number | null
  /** People reached in the latest month (Instagram 30 days, Facebook 28 days). */
  reach: number | null
  /** People reached in each platform's best month of the last 90 days. */
  bestReach: number | null
  /** Live follower counts, swapped into lib/socials.ts in place of the hand-typed ones. */
  followers: { instagram?: number; facebook?: number; tiktok?: number }
  /** The Malaysia day the figures were computed for, and whether they came from the table. */
  asOf: string | null
  stored: boolean
}

// lib/socials.ts names platforms by their full key.
const KEY: Partial<Record<PlatformId, keyof SocialTotals['followers']>> = { ig: 'instagram', fb: 'facebook', tt: 'tiktok' }

/** Facebook's best 28-day unique viewers among windows wholly inside the last 90 days. */
async function fbBestViewers(now: number): Promise<number | null> {
  const { data, error } = await supabase
    .from('fb_page_periods')
    .select('until, viewers')
    .eq('page_id', fbPageId())
    .gte('until', mytDay(now - (90 - 28) * DAY))
    .order('until', { ascending: false })
  if (error) return null
  const vs = (data ?? []).map(w => w.viewers).filter((v): v is number => typeof v === 'number')
  return vs.length ? Math.max(...vs) : null
}

/** Every row for today, computed from the stored history — real figures, never demo ones. */
export async function computeSocialTotals(now = Date.now()): Promise<TotalsRow[]> {
  const [audience, fb, tt, fbBest] = await Promise.all([readAudience(), readFacebook(true), readTiktok(true), fbBestViewers(now)])
  const ig = await readIgPosts(audience, 100, true)
  const sources = [igSource(audience, ig, now), fbSource(fb, now), ttSource(tt, now)]
  // Instagram's best 30-day window of the last 90, from its three stored windows.
  const igFresh = !!audience.view && now - Date.parse(audience.view.capturedAt) < STALE
  const best: Partial<Record<PlatformId, number | null>> = { ig: igFresh ? (audience.view?.d90?.peakReach ?? null) : null, fb: fbBest }
  const day = mytDay(now)
  return [30, 90].flatMap(w => totalsRows(buildSocial(sources, w, now), best, day))
}

/** Compute and store today's rows. Never throws. */
export async function writeSocialTotals(): Promise<{ ok: true; rows: number } | { ok: false; error: string }> {
  if (!supabaseConfigured) return { ok: false, error: 'Supabase is not configured' }
  try {
    const rows = await computeSocialTotals()
    // Never trade a good day for a worse one: if a platform read came back empty this time and
    // today already has a whole total, keep what is stored.
    // A platform stored before but missing now means its read failed (the readers return empty on
    // error) — writing would shrink the overall figure rather than hide it, so keep the last good day.
    const { data: last } = await supabase.from('social_totals').select('day, platform').eq('window_days', 90).neq('platform', 'all').order('day', { ascending: false }).limit(12)
    const lastDay = last?.[0]?.day
    const missing = (last ?? []).filter(r => r.day === lastDay && !rows.some(x => x.platform === r.platform)).map(r => r.platform)
    if (missing.length) return { ok: false, error: `No figures read for ${missing.join(', ')} — kept the last stored day` }
    const all90 = rows.find(r => r.platform === 'all' && r.window_days === 90)
    if (all90 && all90.views === null) {
      const { data } = await supabase.from('social_totals').select('views').eq('day', all90.day).eq('platform', 'all').eq('window_days', 90).maybeSingle()
      if (data?.views != null) return { ok: true, rows: 0 }
    }
    const at = new Date().toISOString()
    const { error } = await supabase.from('social_totals').upsert(rows.map(r => ({ ...r, computed_at: at })), { onConflict: 'day,platform,window_days' })
    if (error) return { ok: false, error: error.message }
    return { ok: true, rows: rows.length }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

function shape(rows: TotalsRow[], stored: boolean): SocialTotals {
  const at = (p: PlatformId | 'all', w: number) => rows.find(r => r.platform === p && r.window_days === w)
  const all90 = at('all', 90)
  const all30 = at('all', 30)
  const followers: SocialTotals['followers'] = {}
  // A platform whose reading is over a week old gives no live count — the hand-typed one stands in.
  for (const r of rows) {
    const key = r.platform === 'all' ? undefined : KEY[r.platform]
    if (key && r.window_days === 90 && r.fresh && r.followers) followers[key] = Number(r.followers)
  }
  const n = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Number(v)) // bigint arrives as a string
  return {
    views: n(all90?.views),
    interactions: n(all90?.interactions),
    rate: n(all30?.rate),
    reach: n(all30?.people),
    bestReach: n(all90?.best_people),
    followers,
    asOf: all90?.day ?? null,
    stored,
  }
}

// The on-the-spot fallback is held for a few minutes, so a stalled job never turns every public
// page view into a dozen database reads.
let held: { at: number; v: SocialTotals } | null = null
const HOLD = 10 * 60_000

const EMPTY: SocialTotals = { views: null, interactions: null, rate: null, reach: null, bestReach: null, followers: {}, asOf: null, stored: false }

/** The public figures: the newest stored day, or — only if none is fresh — computed on the spot. Never throws. */
export async function socialTotals(): Promise<SocialTotals> {
  if (!supabaseConfigured) return EMPTY
  try {
    const { data, error } = await supabase
      .from('social_totals')
      .select('*')
      .order('day', { ascending: false })
      .order('computed_at', { ascending: false })
      .limit(40)
    const newest = data?.[0] as (TotalsRow & { computed_at: string }) | undefined
    if (!error && newest && Date.now() - Date.parse(newest.computed_at) < STORED_FOR) {
      return shape((data as TotalsRow[]).filter(r => r.day === newest.day), true)
    }
  } catch {
    // Table missing (supabase/social-totals.sql not run yet): compute instead.
  }
  if (held && Date.now() - held.at < HOLD) return held.v
  try {
    const v = shape(await computeSocialTotals(), false)
    held = { at: Date.now(), v }
    return v
  } catch {
    return EMPTY
  }
}
