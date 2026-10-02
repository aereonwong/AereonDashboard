import { refreshInstagram } from '@/lib/ig-refresh'

// 👉 The daily Instagram refresh (vercel.json, 6am MYT). It only READS Instagram
// and writes history rows — no Claude call, no message sent — so it costs nothing
// but a minute of Composio. Collecting daily is what builds the history: Instagram
// itself keeps just 30 days of account figures.
//
// AUTH FAILS CLOSED, like the other crons: with no CRON_SECRET set it returns 401
// to everyone. Vercel Cron sends the Bearer token automatically.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authed = !!secret && req.headers.get('authorization') === `Bearer ${secret}`
  if (!authed) return new Response('forbidden', { status: 401 })

  const r = await refreshInstagram('cron')
  return r.ok
    ? Response.json({ ok: true, posts: r.posts, warnings: r.warnings })
    : Response.json({ ok: false, error: r.error }, { status: r.status })
}
