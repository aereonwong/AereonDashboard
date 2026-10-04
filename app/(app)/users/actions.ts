'use server'

import { revalidatePath } from 'next/cache'
import { actor, requireSession } from '@/lib/auth'
import { ROLES, envEmails, type AccessRole } from '@/lib/access'
import { supabase, supabaseConfigured } from '@/lib/supabase'

// 👉 Users → add, change, lock, remove. Every action re-checks who is asking:
//   • owner  — manages everyone.
//   • admin  — manages viewers only (can't create or touch admins/owners).
//   • viewer — nothing.
// Nobody changes their own row (no locking yourself out), and ADMIN_EMAILS people are
// read-only here — they live in Vercel env so the database can never lock them out.

type Result = { ok: true } | { ok: false; error: string }
const fail = (error: string): Result => ({ ok: false, error })

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function gate(targetEmail: string, newRole?: AccessRole): Promise<{ error: string } | { onlyViewers: boolean }> {
  await requireSession()
  if (!supabaseConfigured) return { error: 'The database is not connected.' }
  const { who, role } = await actor()
  if (role !== 'owner' && role !== 'admin') return { error: 'Only admins can manage users.' }
  if (who && who === targetEmail) return { error: "You can't change your own access." }
  if (envEmails().includes(targetEmail)) return { error: 'This person is set in ADMIN_EMAILS (Vercel) and always has access.' }
  if (role === 'admin' && newRole && newRole !== 'viewer') return { error: 'Only the owner can grant admin or owner.' }
  if (role === 'admin') {
    const { data, error } = await supabase.from('app_users').select('role').eq('email', targetEmail).maybeSingle()
    if (error) return { error: 'Could not check that person. Try again.' }
    if (data && data.role !== 'viewer') return { error: 'Only the owner can change an admin or owner.' }
  }
  // An admin's write is also pinned to viewer rows in SQL, so a promotion that lands between the
  // check above and the write can't be touched.
  return { onlyViewers: role === 'admin' }
}

const clean = (email: string) => email.trim().toLowerCase()

export async function addUser(emailIn: string, role: AccessRole, noteIn: string): Promise<Result> {
  const email = clean(emailIn)
  if (!EMAIL.test(email) || email.length > 254) return fail('That does not look like an email address.')
  if (!ROLES.includes(role)) return fail('Pick a role.')
  const g = await gate(email, role)
  if ('error' in g) return fail(g.error)
  const { data: existing } = await supabase.from('app_users').select('email').eq('email', email).maybeSingle()
  if (existing) return fail('Already on the list.')
  const { error } = await supabase.from('app_users').insert({ email, role, active: true, note: noteIn.trim().slice(0, 120) || null })
  if (error) return fail('Could not save. Try again.')
  revalidatePath('/users')
  return { ok: true }
}

export async function setRole(emailIn: string, role: AccessRole): Promise<Result> {
  const email = clean(emailIn)
  if (!ROLES.includes(role)) return fail('Pick a role.')
  const g = await gate(email, role)
  if ('error' in g) return fail(g.error)
  let q = supabase.from('app_users').update({ role }).eq('email', email)
  if (g.onlyViewers) q = q.eq('role', 'viewer')
  const { error } = await q
  if (error) return fail('Could not save. Try again.')
  revalidatePath('/users')
  return { ok: true }
}

export async function setActive(emailIn: string, active: boolean): Promise<Result> {
  const email = clean(emailIn)
  const g = await gate(email)
  if ('error' in g) return fail(g.error)
  let q = supabase.from('app_users').update({ active }).eq('email', email)
  if (g.onlyViewers) q = q.eq('role', 'viewer')
  const { error } = await q
  if (error) return fail('Could not save. Try again.')
  revalidatePath('/users')
  return { ok: true }
}

export async function removeUser(emailIn: string): Promise<Result> {
  const email = clean(emailIn)
  const g = await gate(email)
  if ('error' in g) return fail(g.error)
  let q = supabase.from('app_users').delete().eq('email', email)
  if (g.onlyViewers) q = q.eq('role', 'viewer')
  const { error } = await q
  if (error) return fail('Could not remove. Try again.')
  revalidatePath('/users')
  return { ok: true }
}
