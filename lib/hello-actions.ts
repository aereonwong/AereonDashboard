'use server'

import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { canEdit } from '@/lib/auth'
import { helloRow } from './hello'
import { cleanHello, type HelloConfig } from './hello-config'

// 👉 Saving the /hello link page (Link page tab). A server action can be called by anyone
// who learns its id, so it checks the session itself, and everything goes through
// cleanHello — only known fields and http(s)/mailto links reach the row.

export async function saveHello(input: HelloConfig): Promise<{ ok: true; config: HelloConfig } | { ok: false; error: string }> {
  if (!(await canEdit())) return { ok: false, error: 'Sign in again (or ask the owner for edit access) to change this.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const config = cleanHello(input)
  const r = await helloRow()
  const { error } = r
    ? await supabase.from('records').update({ meta: config }).eq('id', r.id)
    : await supabase.from('records').insert({ category: 'doc', status: 'setting', title: 'hello', amount: 0, notes: 'Link page (/hello) settings', meta: config })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/hello')
  revalidatePath('/links')
  return { ok: true, config }
}
