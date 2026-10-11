import { refreshInstagram } from '@/lib/ig-refresh'
import { refreshFacebook } from '@/lib/fb-refresh'
import { safeEqual } from '@/lib/session'

// 👉 The daily social refresh (vercel.json, 6am MYT): Instagram, then the Facebook
// Page. It only READS both and writes history rows — no Claude call, no message
// sent. Collecting daily is what builds the history: Instagram itself keeps just
// 30 days of account figures. The route keeps its old name so vercel.json and
// Vercel's cron list stay as they are (Hobby allows two crons).
//
// AUTH FAILS CLOSED, like the other crons: with no CRON_SECRET set it returns 401
// to everyone. Vercel Cron sends the Bearer token automatically.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  const authed = !!secret && safeEqual(req.headers.get('authorization'), `Bearer ${secret}`)
  if (!authed) return new Response('forbidden', { status: 401 })

  // One failing never stops the other.
  const [ig, fb] = await Promise.all([refreshInstagram('cron'), refreshFacebook('cron')])
  const body = {
    ok: ig.ok,
    instagram: ig.ok ? { posts: ig.posts, warnings: ig.warnings } : { error: ig.error },
    facebook: fb.ok ? { posts: fb.posts, days: fb.days, warnings: fb.warnings } : { error: fb.error },
  }
  return Response.json(body, { status: ig.ok ? 200 : ig.status })
}
