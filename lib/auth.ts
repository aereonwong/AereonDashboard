import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, readSession, sessionSecret } from '@/lib/session'

// 🔒 Second lock for server actions and spending routes. proxy.ts is the front
// door, but a 'use server' function becomes reachable from ANY page that imports
// it — including the public landing page, which the proxy doesn't gate. So every
// action checks the session itself. With no session secret set (AUTH_SECRET or
// APP_PASSCODE) the app is open (same rule as proxy.ts).

export async function signedIn(): Promise<boolean> {
  const secret = sessionSecret()
  if (!secret) return true
  const jar = await cookies()
  return readSession(jar.get(SESSION_COOKIE)?.value, secret) !== null
}

/** Who is signed in: `pw` (backup passcode), a Google email, or null. */
export async function sessionUser(): Promise<string | null> {
  const secret = sessionSecret()
  if (!secret) return null
  const jar = await cookies()
  return readSession(jar.get(SESSION_COOKIE)?.value, secret)?.who ?? null
}

export async function requireSession(): Promise<void> {
  if (!(await signedIn())) throw new Error('Not signed in')
}
