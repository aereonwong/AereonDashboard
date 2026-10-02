import crypto from 'node:crypto'

// 🔒 The one test for "is this visitor signed in?".
// /api/login mints `cfo_session` as `exp.nonce.sig`. Merely HAVING the cookie
// proves nothing — anyone can send `cfo_session=x` — so every gate checks the
// signature and the expiry here.
//
// The signing key is derived from APP_PASSCODE *and* the Supabase service key,
// so a stolen cookie can't be used to guess the passcode offline (the attacker
// would need the service key too). Changing APP_PASSCODE signs everyone out.

export const SESSION_COOKIE = 'cfo_session'
export const SESSION_DAYS = 30

function signingKey(passcode: string): Buffer {
  const pepper = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return crypto.createHmac('sha256', pepper).update(`cfo-session|${passcode}`).digest()
}

const sign = (passcode: string, body: string) =>
  crypto.createHmac('sha256', signingKey(passcode)).update(body).digest('hex')

/** Constant-time string compare. An empty `expected` never matches. */
export function safeEqual(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (!given || !expected) return false
  // Hash both to fixed-length digests: timingSafeEqual throws on a length
  // mismatch, and hashing means the comparison time never leaks the length.
  const a = crypto.createHash('sha256').update(given).digest()
  const b = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(a, b)
}

export function mintSession(passcode: string): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86_400
  const body = `${exp}.${crypto.randomUUID()}`
  return `${body}.${sign(passcode, body)}`
}

export function isValidSession(token: string | undefined, passcode: string): boolean {
  if (!token || !passcode) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [exp, nonce, sig] = parts
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false
  return safeEqual(sig, sign(passcode, `${exp}.${nonce}`))
}
