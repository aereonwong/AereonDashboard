import 'server-only'
import { Composio } from '@composio/core'
import { buildSnapshot, buildAccount, saveSnapshot, latestSnapshot, type Exec } from './instagram'
import { logRun } from './runs'
import { supabase } from './supabase'
import { insightsFor, type IgPost, type IgSnapshot } from './ig-fetch'
import type { LinkedPost } from './ig-link-types'

// 👉 One Instagram refresh, start to finish: posts + their insights, the account's
// 30-day picture, then save. Shared by the Refresh button and the daily cron so
// both collect exactly the same history.
//
// Needs COMPOSIO_API_KEY (and COMPOSIO_USER_ID if your Composio user isn't "default").

export type RefreshResult =
  | { ok: true; posts: number; captured_at: string; warnings: string[] }
  | { ok: false; status: number; error: string }

// A refresh is ~100 Instagram calls and ~40 history rows, so the button waits
// this long after the last one. The daily cron is not held back.
const COOLDOWN_MS = 10 * 60_000

export async function refreshInstagram(source: 'button' | 'cron'): Promise<RefreshResult> {
  if (source === 'button') {
    const last = await latestSnapshot()
    const age = last ? Date.now() - Date.parse(last.captured_at) : Infinity
    if (age < COOLDOWN_MS) {
      const mins = Math.ceil((COOLDOWN_MS - age) / 60_000)
      return { ok: false, status: 429, error: `Refreshed a moment ago — try again in ${mins} minute${mins === 1 ? '' : 's'}.` }
    }
  }
  const apiKey = process.env.COMPOSIO_API_KEY?.trim()
  if (!apiKey) return { ok: false, status: 400, error: 'COMPOSIO_API_KEY is not set — add it in Vercel, then redeploy.' }
  const userId = process.env.COMPOSIO_USER_ID?.trim() || 'default'

  try {
    const composio = new Composio({ apiKey })
    const exec: Exec = async (slug, args) =>
      composio.tools.execute(slug, { userId, arguments: args, dangerouslySkipVersionCheck: true })

    const snap = await buildSnapshot(exec)
    // Instagram sometimes answers with an empty page. Saving that would wipe the
    // tab, so keep the previous snapshot and say what happened.
    // Same for a page of posts with no insights at all (a rate limit at 6am would
    // otherwise publish "0 reach" on every tile of the public kit).
    if (snap.posts.length && !snap.posts.some(p => p.reach !== undefined)) {
      await logRun('instagram', 'noop', { reason: 'Instagram returned posts without insights', source })
      return { ok: false, status: 502, error: 'Instagram sent posts but no reach figures — kept the previous snapshot. Try again later.' }
    }
    if (snap.posts.length === 0) {
      await logRun('instagram', 'noop', { reason: 'Instagram returned no posts', source })
      return { ok: false, status: 502, error: 'Instagram returned no posts — kept the previous snapshot. Try again in a minute.' }
    }
    // The account picture is extra: if Instagram refuses it, the posts still save.
    const igUserId = String((snap.profile as { id?: string }).id ?? '')
    const account = await buildAccount(exec, igUserId || undefined).catch(() => null)
    const warnings = await saveSnapshot(snap, account)
    const tracked = await trackLinked(exec, snap, warnings).catch(e => {
      warnings.push(`linked posts: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200))
      return 0
    })
    if (!account) warnings.push('account insights unavailable this time')
    await logRun('instagram', 'ok', { posts: snap.posts.length, tracked, username: snap.username, source, warnings })
    return { ok: true, posts: snap.posts.length, captured_at: snap.captured_at, warnings }
  } catch (e) {
    // Composio hides a rejected API key behind "Unable to retrieve tool with slug …";
    // the real reason (e.g. "Invalid API key") is on `cause`, so show that too.
    const cause = e instanceof Error && e.cause instanceof Error ? ` — ${e.cause.message}` : ''
    const message = (e instanceof Error ? e.message : String(e)) + cause
    console.error('[CFO] instagram refresh failed:', message)
    await logRun('instagram', 'failed', { error: message.slice(0, 300), source })
    return { ok: false, status: 500, error: message.slice(0, 300) }
  }
}

// Posts linked to invoices (Invoice Details → Link posts) that are older than
// the latest 40 would otherwise stop updating. Their insights are read here too,
// at most 30 per refresh, and stored in ig_post_metrics like any other post.
const MAX_TRACKED = 30
async function trackLinked(exec: Exec, snap: IgSnapshot, warnings: string[]): Promise<number> {
  const { data, error } = await supabase
    .from('records')
    .select('meta')
    .eq('category', 'cash_in')
    .not('meta->ig_posts', 'is', null)
  if (error) throw new Error(error.message)
  const inSnap = new Set(snap.posts.map(p => p.id))
  const want = new Map<string, LinkedPost>()
  for (const r of data ?? [])
    for (const p of (r.meta?.ig_posts ?? []) as LinkedPost[]) if (p?.id && !inSnap.has(p.id)) want.set(p.id, p)
  const posts: IgPost[] = [...want.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, MAX_TRACKED)
    .map(p => ({ id: p.id, timestamp: p.timestamp, type: p.type, caption: '', likes: 0, comments: 0 }))
  if (!posts.length) return 0
  if (want.size > MAX_TRACKED) warnings.push(`linked posts: only the newest ${MAX_TRACKED} of ${want.size} older linked posts were updated`)
  await insightsFor(exec, posts)
  const rows = posts
    .filter(p => p.reach !== undefined)
    .map(p => ({
      captured_at: snap.captured_at,
      media_id: p.id,
      posted_at: p.timestamp || null,
      type: p.type,
      views: p.views ?? null,
      reach: p.reach ?? null,
      likes: null, // not read for these — never stored as a false zero
      comments: null,
      saved: p.saved ?? null,
      shares: p.shares ?? null,
      interactions: p.interactions ?? null,
      watch_ms: p.watchMs ?? null,
      watch_total_ms: p.watchTotalMs ?? null,
      follows: p.follows ?? null,
      profile_visits: p.profileVisits ?? null,
    }))
  if (rows.length < posts.length) warnings.push(`linked posts: Instagram gave no figures for ${posts.length - rows.length} of ${posts.length}`)
  if (rows.length) {
    const { error: ins } = await supabase.from('ig_post_metrics').insert(rows)
    if (ins) throw new Error(ins.message)
  }
  return rows.length
}
