import { NextResponse } from 'next/server'
import { OAUTH_COOKIE, authUrl, canonicalOrigin, googleConfigured, newFlow } from '@/lib/google-auth'
import { sessionSecret } from '@/lib/session'

// Step 1 of "Sign in with Google": remember a one-time state/nonce/PKCE verifier in a
// short-lived cookie, then send the browser to Google.

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const here = new URL(req.url)
  const home = canonicalOrigin(req)

  if (!googleConfigured() || !sessionSecret()) {
    return NextResponse.redirect(`${home}/login?error=google_off`)
  }
  // Cookies only travel on one host, so always start the flow there.
  if (here.origin !== home) return NextResponse.redirect(`${home}/api/auth/google`)

  const f = newFlow()
  const res = NextResponse.redirect(authUrl(req, f))
  res.cookies.set(OAUTH_COOKIE, `${f.state}.${f.nonce}.${f.verifier}`, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax', // must survive the redirect back from accounts.google.com
    path: '/api/auth/google',
    maxAge: 600,
  })
  return res
}
