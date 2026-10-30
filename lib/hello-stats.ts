import 'server-only'
import { supabaseConfigured } from '@/lib/supabase'
import { readVisits } from '@/lib/site-stats'
import { klDay } from '@/lib/site-visits'
import { SOCIALS } from '@/lib/socials'
import { analyseHello, type HelloInsights } from './hello-insights'
import type { HelloConfig } from './hello-config'

// 👉 Reads /hello's rows from site_visits for the Link page tab; the maths is
// lib/hello-insights.ts. One row = one visitor using something once within 10 minutes;
// the signed-in owner and bots are never logged.

export const RANGES = [7, 30, 90] as const

export async function readHelloStats(cfg: HelloConfig, days: number = 30): Promise<HelloInsights | null> {
  if (!supabaseConfigured) return null
  const today = klDay()
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const data = await readVisits('path.eq./hello,path.like./hello/%', since)
  if (!data) return null
  return analyseHello(data, cfg, days, today, SOCIALS)
}
