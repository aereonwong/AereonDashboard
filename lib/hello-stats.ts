import 'server-only'
import { supabase, supabaseConfigured } from '@/lib/supabase'
import { klDay } from '@/lib/site-visits'
import { SOCIALS } from '@/lib/socials'
import type { HelloConfig } from './hello-config'

// 👉 What visitors do on /hello, read from site_visits (lib/site-visits.ts HELLO_EVENT):
// page views of /hello, sections opened (/hello/tap/<id>) and links, emails, socials or
// copy buttons used (/hello/out/<id>). One row = one visitor using it once within 10 minutes;
// the signed-in owner and bots are never logged. Shown on the Link page tab.

export type Count = { id: string; label: string; count: number }
export type HelloStats = { days: number; visits: number; sections: Count[]; clicks: Count[] }

const SECTION: Record<string, string> = {
  collab: 'Brand Collab', shoot: 'Photographer or Videographer', drone: 'Drone Pilot', deals: 'Attractions', gear: 'Gear List',
}
const FIXED: Record<string, string> = {
  'mail-collab': 'Email: brand collab', 'mail-topic': 'Email: collab topic chip', 'mail-visitor': 'Email: visiting KL shoot',
  'mail-business': 'Email: local business shoot', 'mail-drone': 'Email: drone job', 'copy-email': 'Copied the email address',
}

/** null = an id the page never had (removed long ago, or made up) — left out of the counts. */
function labelOf(id: string, cfg: HelloConfig): string | null {
  if (FIXED[id]) return FIXED[id]
  if (id.startsWith('social-')) {
    const so = SOCIALS.find(s => s.key === id.slice(7))
    return so ? `Social: ${so.name}` : null
  }
  if (id.startsWith('code-')) {
    const a = cfg.affiliates.find(x => x.id === id.slice(5))
    return a ? `Copied code: ${a.label}` : null
  }
  const l = cfg.links.find(x => x.id === id) ?? cfg.affiliates.find(x => x.id === id)
  return l ? l.label : null
}

const tally = (paths: string[], prefix: string) => {
  const m = new Map<string, number>()
  for (const p of paths) if (p.startsWith(prefix)) m.set(p.slice(prefix.length), (m.get(p.slice(prefix.length)) ?? 0) + 1)
  return m
}

export async function readHelloStats(cfg: HelloConfig, days = 30): Promise<HelloStats | null> {
  if (!supabaseConfigured) return null
  const since = klDay(new Date(Date.now() - (days - 1) * 86_400_000))
  const { data, error } = await supabase.from('site_visits').select('path')
    .or('path.eq./hello,path.like./hello/%').gte('day', since).limit(50_000)
  if (error || !data) return null
  const paths = data.map(r => String(r.path))
  const sections = [...tally(paths, '/hello/tap/')].filter(([id]) => SECTION[id]).map(([id, count]) => ({ id, label: SECTION[id], count }))
  const clicks = [...tally(paths, '/hello/out/')].flatMap(([id, count]) => {
    const label = labelOf(id, cfg)
    return label ? [{ id, label, count }] : []
  })
  const byCount = (a: Count, b: Count) => b.count - a.count || a.label.localeCompare(b.label)
  return { days, visits: paths.filter(p => p === '/hello').length, sections: sections.sort(byCount), clicks: clicks.sort(byCount) }
}
