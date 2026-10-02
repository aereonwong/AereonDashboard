import 'server-only'
import { supabase, supabaseConfigured } from './supabase'
import { latestSnapshot } from './instagram'
import { composioExec } from './composio-exec'

// 👉 Linking Instagram posts to invoices (Invoice Details → Link posts). Optional:
// an invoice keeps `meta.ig_posts`, a short list of the posts the job produced.
//
// The picker starts from the newest stored snapshot (no Instagram call). Only
// "Load older" asks Instagram, 12 posts at a time — tested 2 Oct 2026: 12 with
// cover URLs comes back, 20 does not.

/** A post as stored on the invoice: enough to show it even after it drops out of the latest 40. */
export type LinkedPost = { id: string; permalink: string; timestamp: string; type: string; caption: string }
/** A post in the picker. */
export type PickPost = LinkedPost & { thumb?: string; reach?: number }

export const OLDER_PAGE = 12
const MAX_LINKS = 20

const clip = (s: unknown, n: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/** The newest stored posts, newest first. No Instagram call. */
export async function recentPosts(): Promise<PickPost[]> {
  const snap = await latestSnapshot()
  return (snap?.posts ?? [])
    .filter(p => p.permalink)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map(p => ({
      id: p.id,
      permalink: p.permalink!,
      timestamp: p.timestamp,
      type: p.type,
      caption: clip(p.caption, 160),
      thumb: p.thumb,
      reach: p.reach,
    }))
}

/** Older posts from Instagram, 12 at a time. With no cursor it starts after the
 *  stored 40 (one id-only page to find where that is). */
export async function olderPosts(after?: string): Promise<{ posts: PickPost[]; after: string | null }> {
  const snap = await latestSnapshot()
  const igUserId = String((snap?.profile as { id?: string } | undefined)?.id ?? '')
  if (!igUserId) throw new Error('No Instagram account stored yet — refresh Instagram first.')
  const cursorOf = (d: any): string | null => d?.paging?.cursors?.after ?? d?.data?.paging?.cursors?.after ?? null
  const listOf = (d: any): any[] => (Array.isArray(d?.data) ? d.data : Array.isArray(d?.data?.data) ? d.data.data : [])

  let cursor = after ?? null
  if (!cursor) {
    const skip = await composioExec('INSTAGRAM_GET_IG_USER_MEDIA', { ig_user_id: igUserId, limit: 40, fields: 'id' })
    cursor = cursorOf(skip)
    if (!cursor) return { posts: [], after: null }
  }
  const page = await composioExec('INSTAGRAM_GET_IG_USER_MEDIA', {
    ig_user_id: igUserId,
    limit: OLDER_PAGE,
    after: cursor,
    fields: 'id,caption,media_type,media_product_type,permalink,timestamp,thumbnail_url,media_url',
  })
  const posts = listOf(page)
    .filter(m => m?.id && m?.permalink)
    .map(m => ({
      id: String(m.id),
      permalink: String(m.permalink),
      timestamp: String(m.timestamp ?? ''),
      type: String(m.media_product_type ?? m.media_type ?? 'FEED'),
      caption: clip(m.caption, 160),
      thumb: /VIDEO/i.test(String(m.media_type)) ? m.thumbnail_url : m.media_url ?? m.thumbnail_url,
    }))
  return { posts, after: posts.length === OLDER_PAGE ? cursorOf(page) : null }
}

/** Only well-formed posts are kept, with lengths capped — nothing else is written. */
export function cleanLinks(input: unknown): LinkedPost[] {
  if (!Array.isArray(input)) return []
  const seen = new Set<string>()
  const out: LinkedPost[] = []
  for (const p of input as Record<string, unknown>[]) {
    const id = String(p?.id ?? '')
    const permalink = String(p?.permalink ?? '')
    if (!/^\d{5,30}$/.test(id) || seen.has(id)) continue
    if (!/^https:\/\/www\.instagram\.com\/(p|reel|tv)\/[\w-]+\/?$/.test(permalink)) continue
    seen.add(id)
    out.push({
      id,
      permalink,
      timestamp: clip(p.timestamp, 30),
      type: clip(p.type, 20),
      caption: clip(p.caption, 160),
    })
    if (out.length >= MAX_LINKS) break
  }
  return out
}

/** Latest stored reach for each post id (from ig_post_metrics), for showing linked posts. */
export async function reachFor(ids: string[]): Promise<Record<string, number>> {
  if (!supabaseConfigured || !ids.length) return {}
  const { data } = await supabase
    .from('ig_post_metrics')
    .select('media_id, reach, captured_at')
    .in('media_id', [...new Set(ids)].slice(0, 500))
    .order('captured_at', { ascending: false })
  const out: Record<string, number> = {}
  for (const r of data ?? []) if (out[r.media_id] === undefined && r.reach != null) out[r.media_id] = r.reach
  return out
}
