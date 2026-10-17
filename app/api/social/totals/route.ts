import { writeSocialTotals } from '@/lib/social-totals'
import { canEdit } from '@/lib/auth'

// 👉 Recomputes today's social totals (social_totals, read by the public pages) from the stored
// history. No platform is called and nothing is spent — it only reads our own tables and writes
// one day's rows. Behind the passcode like every /api route (proxy.ts), plus an editor check here.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST() {
  if (!(await canEdit())) return Response.json({ ok: false, error: 'Not allowed' }, { status: 403 })
  const r = await writeSocialTotals()
  return Response.json(r, { status: r.ok ? 200 : 500 })
}
