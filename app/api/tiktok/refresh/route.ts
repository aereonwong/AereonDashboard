import { refreshTiktok } from '@/lib/tt-refresh'
import { canEdit } from '@/lib/auth'

// 👉 Pulls today's TikTok account totals and the last 60 days of public videos (with their
// views) through Composio, into the tt_* history tables. Behind the passcode like every /api
// route (proxy.ts), plus a second check here because a refresh spends Composio calls. Reads TikTok only.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!(await canEdit())) return Response.json({ ok: false, error: 'Not allowed' }, { status: 403 })
  const r = await refreshTiktok('button')
  return r.ok
    ? Response.json({ ok: true, posts: r.posts, followers: r.followers, warnings: r.warnings })
    : Response.json({ ok: false, error: r.error }, { status: r.status })
}
