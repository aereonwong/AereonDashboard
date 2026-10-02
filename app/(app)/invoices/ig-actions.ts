'use server'

import { requireSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode } from '@/lib/records'
import { recentPosts, olderPosts, cleanLinks, type PickPost } from '@/lib/ig-links'
import { driveStatus } from '@/lib/invoice-drive'

// 👉 Invoice Details → Link posts. Opening the picker reads stored posts only;
// "Load older" is the one button that asks Instagram. Saving replaces the
// invoice's list in meta.ig_posts — linking is optional and can be undone by
// unticking.

type Fail = { ok: false; error: string }
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function listRecentPosts(): Promise<{ ok: true; posts: PickPost[] } | Fail> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — turn it off in Settings to link posts.' }
  try {
    return { ok: true, posts: await recentPosts() }
  } catch (e) {
    return { ok: false, error: msg(e) }
  }
}

export async function loadOlderPosts(after?: string | null): Promise<{ ok: true; posts: PickPost[]; after: string | null } | Fail> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — turn it off in Settings to load posts from Instagram.' }
  // Instagram's cursors are base64-like text; anything else starts from the top.
  const cursor = typeof after === 'string' && after.length < 500 && /^[\w=+/-]+$/.test(after) ? after : undefined
  try {
    const r = await olderPosts(cursor)
    return { ok: true, ...r }
  } catch (e) {
    return { ok: false, error: `Couldn't load older posts — ${msg(e).slice(0, 200)}` }
  }
}

export async function setInvoicePosts(invoiceId: number, posts: unknown): Promise<{ ok: true; count: number } | Fail> {
  await requireSession()
  if (await demoMode()) return { ok: false, error: 'Demo data is on — turn it off in Settings to link posts.' }
  if (!supabaseConfigured) return { ok: false, error: 'Database not configured' }
  if (!Number.isInteger(invoiceId) || invoiceId <= 0) return { ok: false, error: 'Unknown invoice' }
  const { data: row, error } = await supabase.from('records').select('id, category, meta').eq('id', invoiceId).maybeSingle()
  if (error || !row || row.category !== 'cash_in' || !row.meta?.invoice_no) return { ok: false, error: 'Unknown invoice' }
  // An upload rewrites this row when it finishes; saving now would race it.
  if (driveStatus(row) === 'uploading')
    return { ok: false, error: 'A Google Drive upload for this invoice is running — wait for it, then link posts.' }
  const links = cleanLinks(posts)
  const meta = { ...(row.meta ?? {}) }
  if (links.length) meta.ig_posts = links
  else delete meta.ig_posts
  const { error: upd } = await supabase.from('records').update({ meta }).eq('id', invoiceId)
  if (upd) return { ok: false, error: upd.message }
  revalidatePath('/invoices/details')
  return { ok: true, count: links.length }
}
