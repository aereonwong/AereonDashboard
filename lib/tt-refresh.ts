import 'server-only'
import { Composio } from '@composio/core'
import { logRun } from './runs'
import { supabase } from './supabase'
import { fetchAccount, fetchVideos, persist, type Exec } from './tt-fetch'

// 👉 One TikTok refresh: today's account totals, then every public video of the last 100 days (the public totals need
// every video of the last 90 read within the week)
// with its lifetime figures. Shared by the Refresh button and the daily cron (it runs after
// Instagram and Facebook). Reads TikTok only — nothing is posted.
//
// Needs COMPOSIO_API_KEY + COMPOSIO_USER_ID, and the TikTok connection (auth config
// tiktok-dashboard) for that user in the dashboard's Composio project.

export type TtRefreshResult =
  | { ok: true; posts: number; followers: number | null; warnings: string[] }
  | { ok: false; status: number; error: string }

const COOLDOWN_MS = 10 * 60_000
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export async function refreshTiktok(source: 'button' | 'cron'): Promise<TtRefreshResult> {
  if (source === 'button') {
    const { data } = await supabase.from('tt_account_daily').select('captured_at').order('captured_at', { ascending: false }).limit(1)
    const age = data?.[0] ? Date.now() - Date.parse(data[0].captured_at) : Infinity
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

    const warnings: string[] = []
    const now = Date.now()
    const account = await fetchAccount(exec, now)
    const { posts, metrics } = await fetchVideos(exec, account.username, new Date(now).toISOString(), { since: iso(now - 100 * DAY), max: 400 })
    await persist(supabase, { account, posts, metrics })
    await logRun('tiktok', 'ok', { posts: posts.length, followers: account.followers, source, warnings })
    return { ok: true, posts: posts.length, followers: account.followers, warnings }
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? ` — ${e.cause.message}` : ''
    const message = (e instanceof Error ? e.message : String(e)) + cause
    console.error('[CFO] tiktok refresh failed:', message)
    await logRun('tiktok', 'failed', { error: message.slice(0, 300), source })
    return { ok: false, status: 500, error: message.slice(0, 300) }
  }
}
