'use server'

import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { World } from './catalog'

// 👉 Site-wide settings that visitors — not just this device — must see. The
// public landing page is the reason this exists: a brand opening the site has no
// cookie, so whether they get the media kit has to be decided on the server.
// Stored as one `doc` row (status 'setting') so no new table is needed.

export type Landing = 'classic' | 'kit'
export type Site = { landing: Landing; world: World }
const DEFAULT: Site = { landing: 'classic', world: 'contact' }

async function row() {
  const { data } = await supabase
    .from('records')
    .select('id, meta')
    .eq('category', 'doc')
    .eq('status', 'setting')
    .eq('title', 'site')
    .limit(1)
  return data?.[0] ?? null
}

export async function readSite(): Promise<Site> {
  if (!supabaseConfigured) return DEFAULT
  try {
    const r = await row()
    const m = (r?.meta ?? {}) as Partial<Site>
    return {
      landing: m.landing === 'kit' ? 'kit' : 'classic',
      world: m.world === 'hud' || m.world === 'canon' || m.world === 'contact' ? m.world : DEFAULT.world,
    }
  } catch {
    return DEFAULT
  }
}

export async function saveSite(patch: Partial<Site>): Promise<{ ok: boolean; error?: string }> {
  await requireSession()
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const current = await readSite()
  // Only the known fields — a caller can't spread arbitrary keys into the row.
  const next: Site = {
    landing: patch.landing === 'kit' || patch.landing === 'classic' ? patch.landing : current.landing,
    world: patch.world === 'contact' || patch.world === 'hud' || patch.world === 'canon' ? patch.world : current.world,
  }
  const r = await row()
  const { error } = r
    ? await supabase.from('records').update({ meta: next }).eq('id', r.id)
    : await supabase.from('records').insert({ category: 'doc', status: 'setting', title: 'site', amount: 0, notes: 'Site-wide settings', meta: next })
  revalidatePath('/')
  revalidatePath('/settings')
  return error ? { ok: false, error: error.message } : { ok: true }
}
