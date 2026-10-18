import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { klDay } from '@/lib/site-visits'
import { analyseLanding, type LandingInsights } from './landing-insights'
import { analyseKit, type KitInsights } from './kit-insights'
import type { VisitRow } from './hello-insights'

// 👉 Reads the landing page's rows from site_visits for the Site analytics tab; the maths is
// lib/landing-insights.ts (media kit: lib/kit-insights.ts). The Link page view reads through lib/hello-stats.ts. The signed-in
// owner and bots are never logged.

export async function readLandingStats(days: number = 30): Promise<LandingInsights | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const { data, error } = await supabase.from('site_visits')
    .select('path, day, visitor_hash, referrer_host, utm_source, country, city, device, browser')
    .or('path.eq./,path.eq./login,path.like./land/%').gte('day', since).limit(50_000)
  if (error || !data) return null
  return analyseLanding(data as VisitRow[], days, klDay())
}

export async function readKitStats(days: number = 30, names: Record<string, string> = {}): Promise<KitInsights | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const { data, error } = await supabase.from('site_visits')
    .select('path, day, visitor_hash, referrer_host, utm_source, country, city, device, browser')
    .or('path.eq./mediakit,path.like./kit/%').gte('day', since).limit(50_000)
  if (error || !data) return null
  return analyseKit(data as VisitRow[], days, klDay(), names)
}
