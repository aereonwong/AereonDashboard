import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { klDay } from '@/lib/site-visits'
import { analyseLanding, type LandingInsights } from './landing-insights'
import { analyseKit, type KitInsights } from './kit-insights'
import type { VisitRow } from './hello-insights'

// 👉 Reads the landing page's rows from site_visits for the Site analytics tab; the maths is
// lib/landing-insights.ts (media kit: lib/kit-insights.ts). The Link page view reads through lib/hello-stats.ts. The signed-in
// owner and bots are never logged.

const VISIT_COLS = 'path, day, visitor_hash, referrer_host, utm_source, country, city, device, browser'

/** site_visits rows matching an `or` filter since a day, read in pages of 1,000 (Supabase's cap per
 *  request) so a busy month is never cut off silently. Null on error. */
export async function readVisits(or: string, since: string): Promise<VisitRow[] | null> {
  const all: VisitRow[] = []
  for (let from = 0; from < 200_000; from += 1000) {
    const { data, error } = await supabase.from('site_visits').select(VISIT_COLS)
      .or(or).gte('day', since).order('id', { ascending: true }).range(from, from + 999)
    if (error || !data) return null
    all.push(...(data as VisitRow[]))
    if (data.length < 1000) break
  }
  return all
}

export async function readLandingStats(days: number = 30): Promise<LandingInsights | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const data = await readVisits('path.eq./,path.eq./login,path.like./land/%', since)
  if (!data) return null
  return analyseLanding(data, days, klDay())
}

export async function readKitStats(days: number = 30, names: Record<string, string> = {}): Promise<KitInsights | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const data = await readVisits('path.eq./mediakit,path.like./kit/%', since)
  if (!data) return null
  return analyseKit(data, days, klDay(), names)
}
