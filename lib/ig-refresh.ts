import 'server-only'
import { Composio } from '@composio/core'
import { buildSnapshot, buildAccount, saveSnapshot, latestSnapshot, type Exec } from './instagram'
import { logRun } from './runs'

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
    if (!account) warnings.push('account insights unavailable this time')
    await logRun('instagram', 'ok', { posts: snap.posts.length, username: snap.username, source, warnings })
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
