import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import type { World } from './catalog'

// 👉 Site-wide settings that visitors — not just this device — must see. The
// public landing page is the reason this exists: a brand opening the site has no
// cookie, so whether they get the media kit has to be decided on the server.
// Stored as one `doc` row (status 'setting') so no new table is needed.
//
// This file only READS. Saving lives in site-actions.ts, a server action that
// checks the session — kept apart so the public landing page, which imports
// readSite, never carries a callable save action with it.

/** classic = Front door, kit = media kit, reel = motion-reel landing (5 Oct 2026). */
export type Landing = 'classic' | 'kit' | 'reel'
/** Which media kit: v1 (26 Sep 2026) or v2 (2 Oct 2026, with audience data). */
export type KitVersion = 'v1' | 'v2'
export type Site = { landing: Landing; world: World; kit: KitVersion }
export const DEFAULT_SITE: Site = { landing: 'classic', world: 'canon', kit: 'v1' }

export async function siteRow() {
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
  if (!supabaseConfigured) return DEFAULT_SITE
  try {
    const r = await siteRow()
    const m = (r?.meta ?? {}) as Partial<Site>
    return {
      landing: m.landing === 'kit' || m.landing === 'reel' ? m.landing : 'classic',
      world: 'canon', // the only look; an older saved Contact Sheet or HUD choice is ignored
      kit: m.kit === 'v2' ? 'v2' : 'v1',
    }
  } catch {
    return DEFAULT_SITE
  }
}
