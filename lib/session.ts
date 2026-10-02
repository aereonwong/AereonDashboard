import crypto from 'node:crypto'

// 🔒 The one test for "is this visitor signed in?".
// /api/login mints `cfo_session` as `nonce.HMAC(nonce, APP_PASSCODE)`. Merely
// HAVING the cookie proves nothing — anyone can send `cfo_session=x` — so every
// gate must check the signature here. Changing APP_PASSCODE signs everyone out.

export const SESSION_COOKIE = 'cfo_session'

export function isValidSession(token: string | undefined, passcode: string): boolean {
  if (!token || !passcode) return false
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const nonce = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = crypto.createHmac('sha256', passcode).update(nonce).digest('hex')
  // Equal length first — timingSafeEqual throws on a mismatch.
  if (sig.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}
