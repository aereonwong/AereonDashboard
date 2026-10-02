import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE, isValidSession } from '@/lib/session'

// 🔒 Second lock for server actions and spending routes. proxy.ts is the front
// door, but a 'use server' function becomes reachable from ANY page that imports
// it — including the public landing page, which the proxy doesn't gate. So every
// action checks the session itself. With no APP_PASSCODE set the app is open
// (same rule as proxy.ts).

export async function signedIn(): Promise<boolean> {
  const passcode = (process.env.APP_PASSCODE ?? '').trim()
  if (!passcode) return true
  const jar = await cookies()
  return isValidSession(jar.get(SESSION_COOKIE)?.value, passcode)
}

export async function requireSession(): Promise<void> {
  if (!(await signedIn())) throw new Error('Not signed in')
}
