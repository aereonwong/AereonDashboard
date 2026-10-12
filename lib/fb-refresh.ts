import 'server-only'
import { Composio } from '@composio/core'
import { logRun } from './runs'
import { supabase } from './supabase'
import { fetchDaily, fetchPeriods, fetchPosts, postMetrics, persist, type Exec } from './fb-fetch'
import { fbPageId } from './facebook'

// 👉 One Facebook refresh: the last ten days of Page figures, then every post of
// the last 30 days with its views. Shared by the Refresh button and the daily
// cron (it runs right after Instagram). Reads Facebook only — nothing is posted.
//
// Needs COMPOSIO_API_KEY + COMPOSIO_USER_ID, and a Facebook connection for that
// user in the dashboard's Composio project.

export type FbRefreshResult =
  | { ok: true; posts: number; days: number; warnings: string[] }
  | { ok: false; status: number; error: string }

const COOLDOWN_MS = 10 * 60_000
const DAY = 86_400_000
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export async function refreshFacebook(source: 'button' | 'cron'): Promise<FbRefreshResult> {
  if (source === 'button') {
    const { data } = await supabase.from('fb_post_metrics').select('captured_at').order('captured_at', { ascending: false }).limit(1)
    const age = data?.[0] ? Date.now() - Date.parse(data[0].captured_at) : Infinity
    if (age < COOLDOWN_MS) {
      const mins = Math.ceil((COOLDOWN_MS - age) / 60_000)
      return { ok: false, status: 429, error: `Refreshed a moment ago — try again in ${mins} minute${mins === 1 ? '' : 's'}.` }
    }
  }
  const apiKey = process.env.COMPOSIO_API_KEY?.trim()
  if (!apiKey) return { ok: false, status: 400, error: 'COMPOSIO_API_KEY is not set — add it in Vercel, then redeploy.' }
  const userId = process.env.COMPOSIO_USER_ID?.trim() || 'default'
  const page = fbPageId()

  try {
    const composio = new Composio({ apiKey })
    const exec: Exec = async (slug, args) =>
      composio.tools.execute(slug, { userId, arguments: args, dangerouslySkipVersionCheck: true })

    const warnings: string[] = []
    const now = Date.now()
    const today = iso(now)
    const days = await fetchDaily(exec, page, iso(now - 10 * DAY), today)
    const periods = await fetchPeriods(exec, page, iso(now - 10 * DAY), today).catch(e => {
      warnings.push(`28-day totals: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200))
      return []
    })
    const posts = await fetchPosts(exec, page, iso(now - 30 * DAY), 300)
    const metrics = await postMetrics(exec, posts, new Date(now).toISOString())
    if (posts.length && !metrics.length) warnings.push('Facebook sent posts but no views for them')
    await persist(supabase, { days, periods, posts, metrics })
    await logRun('facebook', 'ok', { days: days.length, posts: posts.length, metrics: metrics.length, source, warnings })
    return { ok: true, posts: posts.length, days: days.length, warnings }
  } catch (e) {
    const cause = e instanceof Error && e.cause instanceof Error ? ` — ${e.cause.message}` : ''
    const message = (e instanceof Error ? e.message : String(e)) + cause
    console.error('[CFO] facebook refresh failed:', message)
    await logRun('facebook', 'failed', { error: message.slice(0, 300), source })
    return { ok: false, status: 500, error: message.slice(0, 300) }
  }
}
