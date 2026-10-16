// 👉 Turns /hello rows from site_visits into the Link page tab's insights. Pure (no I/O) so it
// is unit-tested; lib/hello-stats.ts reads the rows. A "visitor" is one daily visitor hash
// (the hash rotates every day by design, so the same person on two days counts twice).
// Rows: '/hello' = a page view; '/hello/tap/<section>' = a section opened;
// '/hello/out/<id>' = a link, email, social, code or copy used (lib/site-visits.ts HELLO_EVENT).
import type { HelloConfig } from './hello-config'
/** The channels' keys and names (lib/socials.ts SOCIALS), passed in so this file has no runtime imports. */
export type SocialName = { key: string; name: string }

export type VisitRow = {
  path: string; day: string; visitor_hash: string
  referrer_host?: string | null; utm_source?: string | null
  country?: string | null; city?: string | null; device?: string | null; browser?: string | null
}
export type Count = { id: string; label: string; count: number }
export type SectionFunnel = { id: string; label: string; opened: number; acted: number }
export type HelloInsights = {
  days: number
  visits: number
  visitors: number
  opened: number
  emailed: number
  promo: number
  social: number
  daily: { day: string; visitors: number }[]
  sections: SectionFunnel[]
  clicks: Count[]
  sources: Count[]
  countries: Count[]
  cities: Count[]
  devices: Count[]
}

export const SECTION: Record<string, string> = {
  collab: 'Brand Collab', shoot: 'Photographer or Videographer', drone: 'Drone Pilot', deals: 'Attractions', gear: 'Gear List',
}
const FIXED: Record<string, string> = {
  'mail-collab': 'Email: brand collab', 'mail-topic': 'Email: collab topic chip', 'mail-visitor': 'Email: visiting KL shoot',
  'mail-business': 'Email: local business shoot', 'mail-drone': 'Email: drone job', 'copy-email': 'Copied the email address',
}
const MAIL_SECTION: Record<string, string> = {
  'mail-collab': 'collab', 'mail-topic': 'collab', 'mail-visitor': 'shoot', 'mail-business': 'shoot', 'mail-drone': 'drone',
}

/** null = an id the page never had (removed long ago, or made up) — left out of the counts. */
export function labelOf(id: string, cfg: HelloConfig, socials: SocialName[] = []): string | null {
  if (FIXED[id]) return FIXED[id]
  if (id.startsWith('social-')) {
    const so = socials.find(s => s.key === id.slice(7))
    return so ? `Social: ${so.name}` : null
  }
  if (id.startsWith('code-')) {
    const a = cfg.affiliates.find(x => x.id === id.slice(5))
    return a ? `Copied code: ${a.label}` : null
  }
  const l = cfg.links.find(x => x.id === id) ?? cfg.affiliates.find(x => x.id === id)
  return l ? l.label : null
}

/** Which section a tap belongs to, so each section gets its own "opened → acted" rate. */
function sectionOf(id: string, cfg: HelloConfig): string | null {
  if (MAIL_SECTION[id]) return MAIL_SECTION[id]
  const aff = cfg.affiliates.find(a => a.id === (id.startsWith('code-') ? id.slice(5) : id))
  if (aff) return aff.kind === 'gear' ? 'gear' : 'deals'
  return cfg.links.some(l => l.id === id) ? 'collab' : null
}

const APPS: Record<string, string> = {
  'Instagram app': 'Instagram', 'Threads app': 'Threads', 'Facebook app': 'Facebook', 'TikTok app': 'TikTok',
  'Xiaohongshu app': 'Xiaohongshu', 'LINE app': 'LINE',
}
const UTM: Record<string, string> = {
  ig: 'Instagram', instagram: 'Instagram', fb: 'Facebook', facebook: 'Facebook', threads: 'Threads',
  tt: 'TikTok', tiktok: 'TikTok', wa: 'WhatsApp', whatsapp: 'WhatsApp', yt: 'YouTube', youtube: 'YouTube', xhs: 'Xiaohongshu',
}
const HOSTS: [RegExp, string][] = [
  [/instagram/, 'Instagram'], [/threads\./, 'Threads'], [/tiktok/, 'TikTok'], [/facebook|^fb\.|\.fb\./, 'Facebook'],
  [/^t\.co$|(^|\.)x\.com$|twitter/, 'X'], [/whatsapp|^wa\.me$/, 'WhatsApp'], [/(^|\.)google\./, 'Google'],
  [/youtube|youtu\.be/, 'YouTube'], [/xiaohongshu|xhslink/, 'Xiaohongshu'], [/linkedin|lnkd\.in/, 'LinkedIn'],
]

/** Where a visit came from: the app it opened in (plus your own ?utm_source= tag, e.g. "Instagram · bio"),
 *  else the tag, else the referring site. */
export function sourceOf(r: Pick<VisitRow, 'browser' | 'utm_source' | 'referrer_host'>): string {
  if (r.browser && APPS[r.browser]) {
    // Inside an app, your own tag splits it (bio / story / reel); the app's automatic tag (ig…) does not.
    const app = APPS[r.browser]
    const tag = (r.utm_source ?? '').trim()
    return tag && UTM[tag.toLowerCase()] !== app ? `${app} · ${tag}` : app
  }
  if (r.utm_source) {
    // Apps add their own short tags (Instagram's bio link adds utm_source=ig).
    const t = r.utm_source.toLowerCase()
    return UTM[t] ?? `Tag: ${r.utm_source}`
  }
  const h = (r.referrer_host ?? '').toLowerCase()
  if (!h) return 'Direct or unknown'
  return HOSTS.find(([re]) => re.test(h))?.[1] ?? h
}

const region = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }) } catch { return null }
})()
export const countryName = (code: string) => {
  try { return region?.of(code.toUpperCase()) ?? code } catch { return code }
}

export const byCount = (a: Count, b: Count) => b.count - a.count || a.label.localeCompare(b.label)
export function top(m: Map<string, number>, n: number, label = (k: string) => k): Count[] {
  const all = [...m].map(([id, count]) => ({ id, label: label(id), count })).sort(byCount)
  if (all.length <= n) return all
  const rest = all.slice(n - 1).reduce((t, c) => t + c.count, 0)
  return [...all.slice(0, n - 1), { id: '_other', label: 'Everything else', count: rest }]
}
export const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1)

/** Every day in the range, zeros included, oldest first. */
export function daySeries(daily: Map<string, Set<string>>, days: number, today: string) {
  const series: { day: string; visitors: number }[] = []
  const end = new Date(`${today}T00:00:00Z`)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10)
    series.push({ day: d, visitors: daily.get(d)?.size ?? 0 })
  }
  return series
}

export function analyseHello(rows: VisitRow[], cfg: HelloConfig, days: number, today: string, socials: SocialName[] = []): HelloInsights {
  const key = (r: VisitRow) => `${r.day}|${r.visitor_hash}`
  const visitors = new Set<string>()
  const openedBy = new Map<string, Set<string>>()     // section → visitor keys
  const actedIn = new Map<string, Set<string>>()      // section → visitor keys
  const opened = new Set<string>(), emailed = new Set<string>(), promo = new Set<string>(), social = new Set<string>()
  const clicks = new Map<string, number>()
  const sources = new Map<string, number>(), countries = new Map<string, number>(), cities = new Map<string, number>(), devices = new Map<string, number>()
  const daily = new Map<string, Set<string>>()
  let visits = 0

  for (const r of rows) {
    const k = key(r)
    visitors.add(k)
    if (!daily.has(r.day)) daily.set(r.day, new Set())
    daily.get(r.day)!.add(k)
    if (r.path === '/hello') {
      visits++
      bump(sources, sourceOf(r))
      if (r.country) bump(countries, r.country)
      if (r.city) bump(cities, r.country ? `${r.city}, ${r.country}` : r.city)
      bump(devices, r.device ? r.device[0].toUpperCase() + r.device.slice(1) : 'Unknown')
    } else if (r.path.startsWith('/hello/tap/')) {
      const s = r.path.slice(11)
      if (!SECTION[s]) continue
      opened.add(k)
      if (!openedBy.has(s)) openedBy.set(s, new Set())
      openedBy.get(s)!.add(k)
    } else if (r.path.startsWith('/hello/out/')) {
      const id = r.path.slice(11)
      if (!labelOf(id, cfg, socials)) continue
      bump(clicks, id)
      if (id.startsWith('mail-') || id === 'copy-email') emailed.add(k)
      else if (id.startsWith('social-')) social.add(k)
      else if (id.startsWith('code-') || cfg.affiliates.some(a => a.id === id)) promo.add(k)
      const s = sectionOf(id, cfg)
      if (s) {
        if (!actedIn.has(s)) actedIn.set(s, new Set())
        actedIn.get(s)!.add(k)
      }
    }
  }

  const series = daySeries(daily, days, today)

  const sections = Object.keys(SECTION).map(id => {
    const o = openedBy.get(id) ?? new Set<string>()
    const a = [...(actedIn.get(id) ?? [])].filter(k => o.has(k))
    return { id, label: SECTION[id], opened: o.size, acted: a.length }
  }).filter(s => s.opened)

  return {
    days, visits, visitors: visitors.size,
    opened: opened.size, emailed: emailed.size, promo: promo.size, social: social.size,
    daily: series,
    sections: sections.sort((a, b) => b.opened - a.opened),
    clicks: [...clicks].map(([id, count]) => ({ id, label: labelOf(id, cfg, socials)!, count })).sort(byCount),
    sources: top(sources, 8),
    countries: top(countries, 8, countryName),
    cities: top(cities, 8),
    devices: top(devices, 4),
  }
}
