import { refreshFacebook } from '@/lib/fb-refresh'
import { canEdit } from '@/lib/auth'

// 👉 Pulls the last ten days of Facebook Page figures and the last 30 days of
// posts (with their views) through Composio, into the fb_* history tables.
// Behind the passcode like every /api route (proxy.ts), plus a second check here
// because a refresh spends Composio calls. Reads Facebook only.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!(await canEdit())) return Response.json({ ok: false, error: 'Not allowed' }, { status: 403 })
  const r = await refreshFacebook('button')
  return r.ok
    ? Response.json({ ok: true, posts: r.posts, days: r.days, warnings: r.warnings })
    : Response.json({ ok: false, error: r.error }, { status: r.status })
}
