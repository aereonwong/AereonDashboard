import 'server-only'
import crypto from 'node:crypto'
import { supabase, supabaseConfigured } from '@/lib/supabase'

// 🔒 Sign in with Google (OpenID Connect, authorization-code flow + PKCE).
// Hand-written on purpose: no auth library, nothing new to trust. The ID token is
// fetched straight from Google's token endpoint over TLS using our client secret,
// which is the case where Google says the signature check may be skipped — we still
// check issuer, audience, expiry, nonce and that Google verified the email.
//
// WHO may sign in is decided separately (`emailAllowed` below): a verified Google
// account is not enough, it must also be on the list.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const OAUTH_COOKIE = 'g_oauth'
const CANONICAL = 'https://aereonwong.com'

export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID ?? '').trim() && !!(process.env.GOOGLE_CLIENT_SECRET ?? '').trim()

const isLocal = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)

/** The one host Google may send people back to. Cookies set at the start of the
 *  flow only exist on that host, so everything is funnelled through it. */
export function canonicalOrigin(req: Request): string {
  const url = new URL(req.url)
  if (isLocal(url.host)) return url.origin
  return (process.env.APP_BASE_URL ?? '').trim().replace(/\/+$/, '') || CANONICAL
}

export const redirectUri = (req: Request) => `${canonicalOrigin(req)}/api/auth/google/callback`

const b64url = (b: Buffer) => b.toString('base64url')

export function newFlow() {
  const verifier = b64url(crypto.randomBytes(32))
  return {
    state: b64url(crypto.randomBytes(16)),
    nonce: b64url(crypto.randomBytes(16)),
    verifier,
    challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
  }
}

export function authUrl(req: Request, f: ReturnType<typeof newFlow>): string {
  const q = new URLSearchParams({
    client_id: (process.env.GOOGLE_CLIENT_ID ?? '').trim(),
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email',
    state: f.state,
    nonce: f.nonce,
    code_challenge: f.challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return `${AUTH_URL}?${q}`
}

export type GoogleIdentity = { email: string; sub: string }

/** Trade the code for the signed-in Google identity, or null if anything is off. */
export async function identityFromCode(
  req: Request,
  code: string,
  verifier: string,
  nonce: string,
): Promise<GoogleIdentity | null> {
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim()
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: (process.env.GOOGLE_CLIENT_SECRET ?? '').trim(),
      redirect_uri: redirectUri(req),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null)
  if (!res?.ok) return null
  const idToken = ((await res.json().catch(() => null)) as { id_token?: string } | null)?.id_token
  const payload = idToken?.split('.')[1]
  if (!payload) return null
  let c: Record<string, unknown>
  try {
    c = JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    return null
  }
  const okIssuer = c.iss === 'https://accounts.google.com' || c.iss === 'accounts.google.com'
  const okAudience = c.aud === clientId
  const okTime = typeof c.exp === 'number' && c.exp > Date.now() / 1000
  const okNonce = typeof c.nonce === 'string' && c.nonce === nonce
  if (!okIssuer || !okAudience || !okTime || !okNonce) return null
  if (c.email_verified !== true || typeof c.email !== 'string' || typeof c.sub !== 'string') return null
  return { email: c.email.trim().toLowerCase(), sub: c.sub }
}

// ---- Who is allowed ---------------------------------------------------------

const envEmails = () =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

export type AccessRole = 'owner' | 'admin' | 'viewer'

/** Emails in ADMIN_EMAILS always get in (break-glass: needs no database).
 *  Anyone else must be an active row in `app_users` (the future User Management). */
export async function accessFor(email: string): Promise<AccessRole | null> {
  const e = email.trim().toLowerCase()
  if (envEmails().includes(e)) return 'admin'
  if (!supabaseConfigured) return null
  const { data } = await supabase.from('app_users').select('role, active').eq('email', e).maybeSingle()
  if (!data || !data.active) return null
  return data.role as AccessRole
}

/** Best-effort audit trail; never blocks a sign-in. */
export async function noteLogin(email: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('app_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('email', email)
    .then(() => {}, () => {})
}
