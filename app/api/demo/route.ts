import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { signedIn } from '@/lib/auth'

// 🔒 The demo-data switch, guarded by its own password.
//
// Demo mode is set as an httpOnly cookie THE SERVER writes, so it can only be
// turned on or off by someone who knows DEMO_PASSCODE — a browser can no longer
// flip it by editing its own cookies. Turning demo OFF is guarded too: otherwise
// anyone you handed the app to during a demo could reveal your real numbers.
//
// Timing-safe compare, same as /api/login: both sides are hashed to 32 bytes
// first, so the comparison time never leaks the password's length.

export const runtime = 'nodejs'

export async function POST(req: Request) {
  // Second lock behind proxy.ts — this route spends or switches modes.
  if (!(await signedIn())) return Response.json({ ok: false, error: 'Not signed in' }, { status: 401 })
  const secret = (process.env.DEMO_PASSCODE ?? '').trim()
  if (!secret) {
    return NextResponse.json(
      { ok: false, reason: 'not_configured', message: 'DEMO_PASSCODE is not set yet — add it in Vercel, then redeploy.' },
      { status: 400 },
    )
  }

  let submitted = ''
  let enable = false
  try {
    const body = await req.json().catch(() => null)
    if (body && typeof body.passcode === 'string') submitted = body.passcode
    enable = Boolean(body?.enable)
  } catch {
    submitted = ''
  }

  const a = crypto.createHash('sha256').update(submitted.trim()).digest()
  const b = crypto.createHash('sha256').update(secret).digest()
  if (!crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false, reason: 'wrong_passcode', message: "That demo password didn't match." }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true, demo: enable })
  if (enable) {
    res.cookies.set('cfo-demo', '1', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  } else {
    res.cookies.set('cfo-demo', '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 })
  }
  return res
}
