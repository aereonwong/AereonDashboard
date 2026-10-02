'use server'

import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { signedIn } from '@/lib/auth'
import { readSite, siteRow, type Site } from './site'

// 👉 Saving the site-wide settings (Settings → Public landing page). A server
// action can be called by anyone who learns its id, so it checks the session
// itself rather than trusting the page it was rendered on, and it only accepts
// the known values — nothing else is written into the row.

const pick = (patch: Partial<Site>): Partial<Site> => {
  const out: Partial<Site> = {}
  if (patch.landing === 'classic' || patch.landing === 'kit') out.landing = patch.landing
  if (patch.world === 'contact' || patch.world === 'hud' || patch.world === 'canon') out.world = patch.world
  if (patch.kit === 'v1' || patch.kit === 'v2') out.kit = patch.kit
  return out
}

export async function saveSite(patch: Partial<Site>): Promise<{ ok: boolean; error?: string }> {
  // Same rule as proxy.ts (lib/auth.ts): only a signed session may save.
  if (!(await signedIn())) return { ok: false, error: 'Sign in again to change this.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const clean = pick(patch ?? {})
  if (!Object.keys(clean).length) return { ok: false, error: 'Nothing to change' }
  const next = { ...(await readSite()), ...clean }
  const r = await siteRow()
  const { error } = r
    ? await supabase.from('records').update({ meta: next }).eq('id', r.id)
    : await supabase.from('records').insert({ category: 'doc', status: 'setting', title: 'site', amount: 0, notes: 'Site-wide settings', meta: next })
  revalidatePath('/')
  revalidatePath('/settings')
  return error ? { ok: false, error: error.message } : { ok: true }
}
