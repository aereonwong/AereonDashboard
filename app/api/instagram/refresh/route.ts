import { refreshInstagram } from '@/lib/ig-refresh'
import { signedIn } from '@/lib/auth'

// 👉 Pulls your latest Instagram posts + insights through Composio and stores one
// snapshot row (plus the history rows). Sits BEHIND the app passcode (proxy.ts
// guards every /api route except the webhook and the crons), so only someone
// already inside can trigger it. Without COMPOSIO_API_KEY the tab still shows the
// last snapshot and says so.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  // Second lock behind proxy.ts — a refresh spends Composio calls.
  if (!(await signedIn())) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401 })
  const r = await refreshInstagram('button')
  return r.ok
    ? Response.json({ ok: true, posts: r.posts, captured_at: r.captured_at, warnings: r.warnings })
    : Response.json({ ok: false, error: r.error }, { status: r.status })
}
