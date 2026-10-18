import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { cleanKitLinks, type KitLinks } from './kit-links-config'

// 👉 Reads the media kit's private share links (lib/kit-links-config.ts says what they are).
// Saving is lib/kit-links-actions.ts.

export async function kitLinksRow() {
  const { data } = await supabase
    .from('records')
    .select('id, meta')
    .eq('category', 'doc')
    .eq('status', 'setting')
    .eq('title', 'kit-links')
    .limit(1)
  return data?.[0] ?? null
}

export async function readKitLinks(): Promise<KitLinks> {
  if (!supabaseConfigured) return { links: [] }
  try {
    const r = await kitLinksRow()
    return cleanKitLinks(r?.meta)
  } catch {
    return { links: [] }
  }
}
