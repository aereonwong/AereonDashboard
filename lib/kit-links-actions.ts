'use server'

import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { canEdit } from '@/lib/auth'
import { kitLinksRow } from './kit-links'
import { CODE, cleanKitLinks, newCode, type KitLinks } from './kit-links-config'

// 👉 Adding and removing the media kit's private share links (Site analytics → Media kit).
// A server action can be called by anyone who learns its id, so each checks the session itself.

type Result = { ok: true } | { ok: false; error: string }

async function save(next: KitLinks, id: string | undefined): Promise<Result> {
  const meta = cleanKitLinks(next)
  const { error } = id
    ? await supabase.from('records').update({ meta }).eq('id', id)
    : await supabase.from('records').insert({ category: 'doc', status: 'setting', title: 'kit-links', amount: 0, notes: 'Media kit share links (/mediakit?r=)', meta })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/analytics/mediakit')
  return { ok: true }
}

export async function addKitLink(form: FormData): Promise<Result> {
  if (!(await canEdit())) return { ok: false, error: 'Sign in again (or ask the owner for edit access) to change this.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  const brand = String(form.get('brand') ?? '').trim()
  if (!brand) return { ok: false, error: 'Type the brand name first.' }
  const r = await kitLinksRow()
  const cur = cleanKitLinks(r?.meta)
  const code = newCode(new Set(cur.links.map(l => l.code)), n => crypto.getRandomValues(new Uint8Array(n)))
  const created = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date())
  return save({ links: [{ code, brand, note: String(form.get('note') ?? ''), created }, ...cur.links] }, r?.id)
}

export async function removeKitLink(code: string): Promise<Result> {
  if (!(await canEdit())) return { ok: false, error: 'Sign in again (or ask the owner for edit access) to change this.' }
  if (!supabaseConfigured || !CODE.test(code)) return { ok: false, error: 'Nothing to remove.' }
  const r = await kitLinksRow()
  if (!r) return { ok: false, error: 'Nothing to remove.' }
  const cur = cleanKitLinks(r.meta)
  return save({ links: cur.links.filter(l => l.code !== code) }, r.id)
}
