import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { SESSION_COOKIE, SESSION_DAYS, mintSession, passcodeLoginOn, sessionSecret } from '@/lib/session'
import { clientKey, takeAttempt, lockedFor, recordFail, clearFails, WRONG_DELAY_MS } from '@/lib/login-guard'

// 🔒 Don't edit — this keeps your robot safe.
// Checks the passcode and, on success, hands back an opaque session cookie.
//
// Two safety details worth knowing:
//  1) TIMING-SAFE compare. We hash BOTH the submitted code and APP_PASSCODE to
//     fixed 32-byte SHA-256 digests, then crypto.timingSafeEqual them. Hashing
//     first guarantees equal length (timingSafeEqual throws on length mismatch)
//     AND means the comparison time never leaks the passcode's length.
//  2) BRUTE-FORCE BRAKE. 5 wrong tries from one IP → 15-minute lock (lib/login-guard.ts).
//  3) The cookie is NEVER the raw passcode. It's `nonce.HMAC(nonce)` — an opaque
//     token signed with your passcode as the server secret. Nobody can read your
//     passcode out of it, and it can't be forged without the secret.

export const runtime = 'nodejs'   // needs Node crypto, not the edge runtime

export async function POST(req: Request) {
  const passcode = (process.env.APP_PASSCODE ?? '').trim()

  // No passcode configured → nothing to check. Tell the client calmly; the app
  // isn't gated in this state anyway (see proxy.ts).
  if (!passcode) {
    return NextResponse.json({ ok: false, reason: 'no_passcode_set' }, { status: 200 })
  }
  // Passcode retired (PASSCODE_LOGIN=off) → Google is the only way in.
  if (!passcodeLoginOn()) {
    return NextResponse.json({ ok: false, reason: 'passcode_off' }, { status: 403 })
  }

  // Locked out? Refuse before even looking at the passcode.
  const who = clientKey(req)
  const burst = takeAttempt(who) // synchronous: counts this try before any await
  if (burst > 0) return tooMany(burst)
  const wait = await lockedFor(who)
  if (wait > 0) return tooMany(wait)

  // Accept either JSON {passcode} or a posted form field, so the login page can be
  // simple. Never throw on a malformed body — just treat it as an empty attempt.
  let submitted = ''
  try {
    const ct = req.headers.get('content-type') || ''
    if (ct.includes('application/json')) {
      const body = await req.json().catch(() => null)
      if (body && typeof body.passcode === 'string') submitted = body.passcode
    } else {
      const form = await req.formData().catch(() => null)
      const v = form?.get('passcode')
      if (typeof v === 'string') submitted = v
    }
  } catch {
    submitted = ''
  }

  const a = crypto.createHash('sha256').update(submitted.trim()).digest()
  const b = crypto.createHash('sha256').update(passcode).digest()
  const ok = crypto.timingSafeEqual(a, b)

  if (!ok) {
    const lock = await recordFail(who)
    await new Promise(r => setTimeout(r, WRONG_DELAY_MS)) // slows guessing to ~1/s
    if (lock > 0) return tooMany(lock)
    return NextResponse.json({ ok: false, reason: 'wrong_passcode' }, { status: 401 })
  }
  await clearFails(who)

  // Mint the opaque cookie: expiry + nonce, signed (see lib/session.ts).
  const token = mintSession(sessionSecret())

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS, // the token carries the same expiry
  })
  return res
}

function tooMany(ms: number) {
  const seconds = Math.ceil(ms / 1000)
  return NextResponse.json(
    { ok: false, reason: 'too_many_attempts', retryAfter: seconds },
    { status: 429, headers: { 'Retry-After': String(seconds) } },
  )
}
