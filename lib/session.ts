import crypto from 'node:crypto'

// 🔒 The one test for "is this visitor signed in?".
// Login mints `cfo_session` as `exp.nonce.who.sig` (older sessions are
// `exp.nonce.sig`, which still verify and count as the passcode). `who` is `pw`
// for the backup passcode, or the base64url Google email. Merely HAVING the
// cookie proves nothing — anyone can send `cfo_session=x` — so every gate checks
// the signature and the expiry here.
//
// The signing secret is AUTH_SECRET when set, otherwise APP_PASSCODE (so sessions
// from before Google login stay valid). It is mixed with the Supabase service key,
// so a stolen cookie can't be used to guess the secret offline. Changing the
// secret signs everyone out — that is also the panic button.
//
// PASSCODE_LOGIN=off retires the passcode: its sessions stop verifying at once.

export const SESSION_COOKIE = 'cfo_session'
export const SESSION_DAYS = 30
export const PASSCODE_WHO = 'pw'

/** The key sessions are signed with, or '' when the app has no lock at all. */
export function sessionSecret(): string {
  return (process.env.AUTH_SECRET ?? '').trim() || (process.env.APP_PASSCODE ?? '').trim()
}

export const passcodeLoginOn = () => (process.env.PASSCODE_LOGIN ?? '').trim().toLowerCase() !== 'off'

function signingKey(secret: string): Buffer {
  const pepper = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return crypto.createHmac('sha256', pepper).update(`cfo-session|${secret}`).digest()
}

const sign = (secret: string, body: string) =>
  crypto.createHmac('sha256', signingKey(secret)).update(body).digest('hex')

/** Constant-time string compare. An empty `expected` never matches. */
export function safeEqual(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected) return false
  // Hash both to fixed-length digests: timingSafeEqual throws on a length
  // mismatch, and hashing means the comparison time never leaks the length.
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

/** `who` = PASSCODE_WHO, or a lower-cased Google email. */
export function mintSession(secret: string, who: string = PASSCODE_WHO): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400
  const id = who === PASSCODE_WHO ? who : Buffer.from(who).toString('base64url')
  const body = `${exp}.${crypto.randomUUID()}.${id}`
  return `${body}.${sign(secret, body)}`
}

/** Who the cookie belongs to (`pw` or an email), or null if it isn't a valid session. */
export function readSession(token: string | undefined, secret: string): { who: string } | null {
  if (!token || !secret) return null
  const parts = token.split('.')
  if (parts.length !== 3 && parts.length !== 4) return null
  const sig = parts[parts.length - 1]
  const body = parts.slice(0, -1).join('.')
  const exp = parts[0]
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return null
  if (!safeEqual(sig, sign(secret, body))) return null
  const id = parts.length === 4 ? parts[2] : PASSCODE_WHO
  const who = id === PASSCODE_WHO ? PASSCODE_WHO : Buffer.from(id, 'base64url').toString()
  if (who === PASSCODE_WHO && !passcodeLoginOn()) return null
  return { who }
}

export const isValidSession = (token: string | undefined, secret: string) => readSession(token, secret) !== null
