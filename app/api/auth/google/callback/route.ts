import { NextResponse } from 'next/server'
import {
  OAUTH_COOKIE,
  accessFor,
  canonicalOrigin,
  googleConfigured,
  identityFromCode,
  noteLogin,
} from '@/lib/google-auth'
import { SESSION_COOKIE, SESSION_DAYS, mintSession, safeEqual, sessionSecret } from '@/lib/session'

// Step 2: Google sends the browser back here with ?code&state. Check the state
// against the cookie, trade the code for the verified Google identity, check that
// identity is on the list, then set the same signed session cookie the passcode uses.

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const home = canonicalOrigin(req)
  const back = (reason: string) => {
    const res = NextResponse.redirect(`${home}/login?error=${reason}`)
    res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
    return res
  }

  const secret = sessionSecret()
  if (!googleConfigured() || !secret) return back('google_off')
  if (url.searchParams.get('error')) return back('google_cancelled')

  const [state, nonce, verifier] = (req.headers.get('cookie') ?? '')
    .split(/;\s*/)
    .find(c => c.startsWith(`${OAUTH_COOKIE}=`))
    ?.slice(OAUTH_COOKIE.length + 1)
    .split('.') ?? []
  const code = url.searchParams.get('code')
  if (!code || !state || !nonce || !verifier || !safeEqual(url.searchParams.get('state'), state)) {
    return back('google_failed')
  }

  const who = await identityFromCode(req, code, verifier, nonce)
  if (!who) return back('google_failed')

  const role = await accessFor(who.email)
  if (!role) return back('not_allowed')
  await noteLogin(who.email)

  const res = NextResponse.redirect(`${home}/dashboard`)
  res.cookies.delete({ name: OAUTH_COOKIE, path: '/api/auth/google' })
  res.cookies.set(SESSION_COOKIE, mintSession(secret, who.email), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
  })
  return res
}
