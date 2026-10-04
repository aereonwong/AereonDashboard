import 'server-only'
import { cache } from 'react'
import { supabase, supabaseConfigured } from '@/lib/supabase'

// 🔒 Who may be in the app, and as what.
//   • ADMIN_EMAILS (env, comma-separated) — always in, as owner. Needs no database, so a
//     broken or paused Supabase can never lock Aereon out. Shown read-only in Users.
//   • `app_users` table — the managed list (Users page): role, active flag, last sign-in.
// The backup passcode (`pw` sessions) counts as owner: it is Aereon's own key.

export type AccessRole = 'owner' | 'admin' | 'viewer'
export const ROLES: AccessRole[] = ['owner', 'admin', 'viewer']

export const envEmails = (): string[] =>
  (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)

/** Role for an email, or null when it must not get in (unknown, locked, or DB unreachable). */
export const accessFor = cache(async (email: string): Promise<AccessRole | null> => {
  const e = email.trim().toLowerCase()
  if (envEmails().includes(e)) return 'owner'
  if (!supabaseConfigured) return null
  const { data } = await supabase.from('app_users').select('role, active').eq('email', e).maybeSingle()
  if (!data || !data.active) return null
  return ROLES.includes(data.role as AccessRole) ? (data.role as AccessRole) : 'viewer'
})

/** Best-effort audit trail; never blocks a sign-in. */
export async function noteLogin(email: string): Promise<void> {
  if (!supabaseConfigured) return
  await supabase
    .from('app_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('email', email)
    .then(() => {}, () => {})
}

export type UserRow = {
  email: string
  role: AccessRole
  active: boolean
  note: string | null
  last_login_at: string | null
  created_at: string | null
  source: 'env' | 'db'
}

/** Env-listed people first (read-only), then the table. */
export async function listUsers(): Promise<UserRow[]> {
  const env = envEmails()
  const rows: UserRow[] = env.map(email => ({
    email, role: 'owner', active: true, note: null, last_login_at: null, created_at: null, source: 'env',
  }))
  if (!supabaseConfigured) return rows
  const { data } = await supabase
    .from('app_users')
    .select('email, role, active, note, last_login_at, created_at')
    .order('created_at', { ascending: true })
  for (const r of data ?? []) {
    const hit = rows.find(x => x.email === r.email)
    if (hit) {
      hit.last_login_at = r.last_login_at
      hit.note = r.note
    } else {
      rows.push({ ...(r as Omit<UserRow, 'source'>), source: 'db' })
    }
  }
  return rows
}
