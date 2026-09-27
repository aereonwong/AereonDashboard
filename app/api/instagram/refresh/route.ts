import { Composio } from '@composio/core'
import { buildSnapshot, saveSnapshot, type Exec } from '@/lib/instagram'
import { logRun } from '@/lib/runs'

// 👉 Pulls your latest Instagram posts + insights through Composio and stores one
// snapshot row. Sits BEHIND the app passcode (proxy.ts guards every /api route
// except the webhook and the crons), so only someone already inside can trigger it.
//
// Needs COMPOSIO_API_KEY (and COMPOSIO_USER_ID if your Composio user isn't
// "default"). Without them the tab still shows the last snapshot and says so.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim()
  if (!apiKey) {
    return Response.json(
      { ok: false, error: 'COMPOSIO_API_KEY is not set — add it in Vercel, then redeploy.' },
      { status: 400 },
    )
  }
  const userId = process.env.COMPOSIO_USER_ID?.trim() || 'default'

  try {
    const composio = new Composio({ apiKey })
    const exec: Exec = async (slug, args) =>
      composio.tools.execute(slug, { userId, arguments: args, dangerouslySkipVersionCheck: true })

    const snap = await buildSnapshot(exec)
    // Instagram sometimes answers with an empty page. Saving that would wipe the
    // tab, so keep the previous snapshot and say what happened.
    if (snap.posts.length === 0) {
      await logRun('instagram', 'noop', { reason: 'Instagram returned no posts' })
      return Response.json(
        { ok: false, error: 'Instagram returned no posts — kept the previous snapshot. Try again in a minute.' },
        { status: 502 },
      )
    }
    await saveSnapshot(snap)
    await logRun('instagram', 'ok', { posts: snap.posts.length, username: snap.username })
    return Response.json({ ok: true, posts: snap.posts.length, captured_at: snap.captured_at })
  } catch (e) {
    // Composio hides a rejected API key behind "Unable to retrieve tool with slug …";
    // the real reason (e.g. "Invalid API key") is on `cause`, so show that too.
    const cause = e instanceof Error && e.cause instanceof Error ? ` — ${e.cause.message}` : ''
    const message = (e instanceof Error ? e.message : String(e)) + cause
    console.error('[CFO] instagram refresh failed:', message)
    await logRun('instagram', 'failed', { error: message.slice(0, 300) })
    return Response.json({ ok: false, error: message.slice(0, 300) }, { status: 500 })
  }
}
