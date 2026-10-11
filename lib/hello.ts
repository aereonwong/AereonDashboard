import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { DEFAULT_HELLO, cleanHello, type HelloConfig } from './hello-config'

// 👉 Reads the /hello link page's settings. Stored like the site settings (lib/v3/site.ts):
// one `doc` row, status 'setting', title 'hello' — no new table. Read-only on purpose, so
// the public page never imports a save action; saving is lib/hello-actions.ts.

export async function helloRow() {
  const { data } = await supabase
    .from('records')
    .select('id, meta')
    .eq('category', 'doc')
    .eq('status', 'setting')
    .eq('title', 'hello')
    .limit(1)
  return data?.[0] ?? null
}

export async function readHello(): Promise<HelloConfig> {
  if (!supabaseConfigured) return DEFAULT_HELLO
  try {
    const r = await helloRow()
    return r ? cleanHello(r.meta) : DEFAULT_HELLO
  } catch {
    return DEFAULT_HELLO
  }
}
