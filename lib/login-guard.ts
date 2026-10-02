import crypto from 'node:crypto'
import { getSetting, setSetting } from '@/lib/settings'

// 🔒 Passcode brute-force brake. 5 wrong tries from one IP → that IP is locked
// out for 15 minutes (even the right passcode is refused while locked, or the
// lock would be pointless). Counts live in one `setting:login-guard` row, so
// they survive across Vercel's serverless instances without a new table.
// IPs are stored hashed (salted). If Supabase is unreachable the in-memory
// count below still applies per instance, and the passcode check always does.
//
// Parallel bursts: the row is read-modify-write, so 50 guesses fired at once
// could all read "0 fails". Two brakes cover that: an in-memory count on this
// instance (bursts land on the same warm instance), and a 1-second pause
// after every wrong guess, which caps how fast anyone can try.

export const MAX_FAILS = 5
export const COOLDOWN_MS = 15 * 60_000

export const WRONG_DELAY_MS = 1000

type Entry = { fails: number; last: number; until?: number }
type Guard = Record<string, Entry>
const KEY = 'login-guard'
const local = new Map<string, Entry>() // this instance's view, updated synchronously

function bump(prev: Entry | undefined, now: number): Entry {
  if (prev?.until && prev.until > now) return prev // already locked — stays locked
  const fails = (prev && now - prev.last < COOLDOWN_MS ? prev.fails : 0) + 1
  return fails >= MAX_FAILS ? { fails: 0, last: now, until: now + COOLDOWN_MS } : { fails, last: now }
}

/** The caller's IP as Vercel reports it (headers Vercel sets itself, which a
 *  client can't spoof), salted and hashed so no raw IP is stored. */
export function clientKey(req: Request): string {
  const ip =
    req.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  const salt = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').slice(-16)
  return crypto.createHash('sha256').update(`login|${salt}|${ip}`).digest('hex').slice(0, 24)
}

/** Drop entries whose lock and fail window have both passed. */
function prune(g: Guard, now: number): Guard {
  const out: Guard = {}
  for (const [k, e] of Object.entries(g)) {
    if ((e.until ?? 0) > now || now - e.last < COOLDOWN_MS) out[k] = e
  }
  return out
}

/** Synchronous first gate, run before the passcode is looked at. Counts the
 *  attempt on this instance straight away, so a burst can't slip through while
 *  the shared row is still being read. Returns ms locked (0 = go ahead). */
export function takeAttempt(key: string): number {
  const now = Date.now()
  const prev = local.get(key)
  if (prev?.until && prev.until > now) return prev.until - now
  const tried = (prev && now - prev.last < COOLDOWN_MS ? prev.fails : 0) + 1
  if (tried > MAX_FAILS) {
    local.set(key, { fails: 0, last: now, until: now + COOLDOWN_MS })
    return COOLDOWN_MS
  }
  local.set(key, { fails: tried, last: now })
  return 0
}

/** Milliseconds left on this caller's lock in the shared row, or 0. */
export async function lockedFor(key: string): Promise<number> {
  const now = Date.now()
  const mem = Math.max((local.get(key)?.until ?? 0) - now, 0)
  try {
    const e = (await getSetting<Guard>(KEY, {}))[key]
    return Math.max((e?.until ?? 0) - now, mem)
  } catch {
    return mem
  }
}

/** Record a wrong passcode. Returns ms of lock now in force (0 if not locked yet). */
export async function recordFail(key: string): Promise<number> {
  const now = Date.now()
  // takeAttempt already counted this try on this instance.
  const mine = local.get(key) ?? { fails: 1, last: now }
  if (mine.fails >= MAX_FAILS) local.set(key, { fails: 0, last: now, until: now + COOLDOWN_MS })
  const locked = local.get(key) ?? mine
  try {
    const g = prune(await getSetting<Guard>(KEY, {}), now)
    // Keep whichever view has seen more: the shared row or this instance.
    const shared = bump(g[key], now)
    g[key] = (locked.until ?? 0) > (shared.until ?? 0) || locked.fails > shared.fails ? locked : shared
    await setSetting(KEY, g)
    return g[key].until ? COOLDOWN_MS : 0
  } catch {
    return locked.until ? COOLDOWN_MS : 0
  }
}

/** A correct passcode clears this caller's count. */
export async function clearFails(key: string): Promise<void> {
  local.delete(key)
  try {
    const g = await getSetting<Guard>(KEY, {})
    if (!g[key]) return
    delete g[key]
    await setSetting(KEY, prune(g, Date.now()))
  } catch {
    // Not worth failing a good login over.
  }
}
