import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, PASSCODE_WHO, readSession, sessionSecret } from '@/lib/session'
import { accessFor, envEmails, type AccessRole } from '@/lib/access'

// 🔒 Second lock for server actions and spending routes. proxy.ts is the front
// door, but a 'use server' function becomes reachable from ANY page that imports
// it — including the public landing page, which the proxy doesn't gate. So every
// action checks the session itself. With no session secret set (AUTH_SECRET or
// APP_PASSCODE) the app is open (same rule as proxy.ts).
//
// Unlike the proxy (cookie signature only), this also asks "is this Google account
// still allowed?" — so locking someone in Users cuts them off on their next click,
// without waiting for the 30-day cookie to run out. Passcode sessions and the
// ADMIN_EMAILS list skip the database, so they cost nothing and can't be locked out.

/** The raw signed-in identity: `pw` (backup passcode), a Google email, or null. */
export async function sessionUser(): Promise<string | null> {
  const secret = sessionSecret()
  if (!secret) return null
  const jar = await cookies()
  return readSession(jar.get(SESSION_COOKIE)?.value, secret)?.who ?? null
}

export async function signedIn(): Promise<boolean> {
  if (!sessionSecret()) return true
  const who = await sessionUser()
  if (!who) return false
  if (who === PASSCODE_WHO || envEmails().includes(who)) return true
  return (await accessFor(who)) !== null
}

export async function requireSession(): Promise<void> {
  if (!(await signedIn())) throw new Error('Not signed in')
}

/** Who is acting and with what role. Open-door mode (no secret) and passcode = owner. */
export async function actor(): Promise<{ who: string | null; role: AccessRole | null }> {
  if (!sessionSecret()) return { who: null, role: 'owner' }
  const who = await sessionUser()
  if (!who) return { who: null, role: null }
  if (who === PASSCODE_WHO) return { who, role: 'owner' }
  return { who, role: await accessFor(who) }
}
