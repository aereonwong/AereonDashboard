import { supabase, supabaseConfigured } from '@/lib/supabase'
import { demoMode, isIssued } from '@/lib/records'
import type { LinkedInvoice, MetricRow } from './ig-insights'

// 👉 What the Instagram page reads beyond the audience: every post's stored readings
// (for shelf life) and the invoices that have posts linked to them (for brand work).
// Both are optional — an empty table just means the panel says "not yet".

export type IgExtras = {
  metrics: MetricRow[]
  linked: LinkedInvoice[]
  /** Latest stored reach for every post id seen in the readings — covers linked posts
   *  that have scrolled out of the newest 40. */
  reachById: Record<string, number>
}

export async function readIgExtras(): Promise<IgExtras> {
  if (!supabaseConfigured) return { metrics: [], linked: [], reachById: {} }
  // Demo mode shows invented records only: real client names and amounts never appear in it.
  const demo = await demoMode()
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
  // Supabase returns at most 1,000 rows a request, and each refresh adds about 40, so the
  // readings are paged — a silent cut would drop the NEWEST rows and make every curve stale.
  const readings = async (): Promise<MetricRow[]> => {
    const out: MetricRow[] = []
    for (let from = 0; from < 20_000; from += 1000) {
      const { data } = await supabase
        .from('ig_post_metrics')
        .select('media_id, posted_at, type, reach, captured_at')
        .gte('captured_at', since)
        .order('captured_at', { ascending: true })
        .order('media_id', { ascending: true })
        .range(from, from + 999)
      out.push(...((data ?? []) as MetricRow[]))
      if ((data?.length ?? 0) < 1000) break
    }
    return out
  }
  const [metrics, r] = await Promise.all([
    readings(),
    supabase
      .from('records')
      .select('id, title, amount, status, meta')
      .eq('category', 'cash_in')
      .not('meta->invoice_no', 'is', null)
      .not('meta->ig_posts', 'is', null)
      .order('id', { ascending: false })
      .limit(200),
  ])
  const reachById: Record<string, number> = {}
  for (const row of metrics) if (row.reach !== null) reachById[row.media_id] = row.reach // ascending: the last one wins
  const linked: LinkedInvoice[] = (demo ? [] : r.data ?? [])
    .map((row: any) => ({
      id: Number(row.id),
      no: String(row.meta?.invoice_no ?? ''),
      client: String(row.meta?.customer ?? '—'),
      job: String(row.meta?.job ?? row.title ?? ''),
      amount: Number(row.amount ?? 0),
      currency: String(row.meta?.currency || 'MYR'),
      date: String(row.meta?.invoice_date ?? '').slice(0, 10),
      documented: isIssued({ status: String(row.status ?? ''), meta: row.meta }),
      postIds: (Array.isArray(row.meta?.ig_posts) ? row.meta.ig_posts : []).map((p: any) => String(p?.id ?? '')).filter(Boolean),
    }))
    .filter(l => l.postIds.length)
  return { metrics, linked, reachById }
}

/** The Dashboard's light read: the latest reach of every post seen in the last
 *  120 days of readings — four columns, no invoice query. Empty in demo mode, so
 *  invented invoices are never plotted against real Instagram figures. */
export async function readPostReach(): Promise<MetricRow[]> {
  if (!supabaseConfigured || (await demoMode())) return []
  const since = new Date(Date.now() - 120 * 86_400_000).toISOString()
  const latest = new Map<string, MetricRow>()
  for (let from = 0; from < 20_000; from += 1000) {
    const { data } = await supabase
      .from('ig_post_metrics')
      .select('media_id, posted_at, reach, captured_at')
      .gte('captured_at', since)
      .not('reach', 'is', null)
      .order('captured_at', { ascending: true })
      .order('media_id', { ascending: true })
      .range(from, from + 999)
    for (const r of (data ?? []) as Omit<MetricRow, 'type'>[]) latest.set(r.media_id, { ...r, type: null }) // ascending: last wins
    if ((data?.length ?? 0) < 1000) break
  }
  return [...latest.values()]
}
