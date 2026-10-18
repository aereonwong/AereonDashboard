// 👉 Turns the media kit deck's rows from site_visits into the Site analytics tab's Media kit view.
// Pure (no runtime imports) so it is unit-tested; lib/site-stats.ts reads the rows. The deck is a
// static page (public/mediakit/index.html) whose inline script sends the beacons. A "visitor" is one
// daily visitor hash, as on the other pages. Rows: '/mediakit' = a page view; '/kit/…' = what they did
// (lib/site-visits.ts KIT_EVENT).
import { sourceOf, top, countryName, bump, byCount, daySeries, splitBots, type Bots, type Count, type VisitRow } from './hello-insights.ts'
import { landingTapLabel } from './landing-taps.ts'

export type Reached = { id: string; label: string; visitors: number }
export type KitInsights = {
  days: number
  /** Left out as bots or instant bounces (splitBots in lib/hello-insights.ts). */
  bots: Bots
  visits: number
  visitors: number
  tapped: number
  work: number
  pdf: number
  emailed: number
  social: number
  /** Reached the last slide (Contact). */
  finished: number
  daily: { day: string; visitors: number }[]
  slides: Reached[]
  clicks: Count[]
  time: Reached[]
  languages: Count[]
  sources: Count[]
  countries: Count[]
  cities: Count[]
  devices: Count[]
  browsers: Count[]
}

/** The deck's slides in order — keep in step with public/mediakit/index.html. */
export const KIT_SLIDES = ['Cover', 'Audience', 'Tech reviews', 'Travel creator', 'Drone pilot', 'Production', 'KOL event coverage', 'Brand wall', 'Contact']
const TIME: [string, string][] = [['10s', '10 seconds'], ['30s', '30 seconds'], ['1m', '1 minute'], ['3m', '3 minutes'], ['10m', '10 minutes']]

const languageName = (() => {
  let names: Intl.DisplayNames | null = null
  try { names = new Intl.DisplayNames(['en'], { type: 'language' }) } catch { /* plain codes */ }
  return (code: string) => { try { return names?.of(code) ?? code } catch { return code } }
})()

/** A readable name for a tap id from the deck. */
export function kitTapLabel(id: string): string {
  if (id === 'pdf') return 'Downloaded the PDF'
  if (id === 'mail') return 'Email collab@'
  if (id.startsWith('work-')) {
    const t = id.slice(5).replace(/-/g, ' ')
    return `Work: ${t.charAt(0).toUpperCase()}${t.slice(1)}`
  }
  return landingTapLabel(id)
}

/** What kind of tap it is, for the funnel. */
export function kitTapKind(id: string): 'work' | 'pdf' | 'email' | 'social' | 'other' {
  if (id.startsWith('work-')) return 'work'
  if (id === 'pdf') return 'pdf'
  if (id === 'mail' || id.startsWith('mail-') || id === 'phone') return 'email'
  if (id.startsWith('social-') || id.startsWith('post-')) return 'social'
  return 'other'
}

export function analyseKit(all: VisitRow[], days: number, today: string): KitInsights {
  const { rows, bots } = splitBots(all.filter(r => r.path === '/mediakit' || r.path.startsWith('/kit/')), p => p === '/mediakit')
  const key = (r: VisitRow) => `${r.day}|${r.visitor_hash}`
  const visitors = new Set<string>()
  const tapped = new Set<string>(), work = new Set<string>(), pdf = new Set<string>(), emailed = new Set<string>(), social = new Set<string>()
  const slides = new Map<string, Set<string>>(), time = new Map<string, Set<string>>(), daily = new Map<string, Set<string>>()
  const clicks = new Map<string, number>(), languages = new Map<string, number>()
  const sources = new Map<string, number>(), countries = new Map<string, number>(), cities = new Map<string, number>()
  const devices = new Map<string, number>(), browsers = new Map<string, number>()
  const add = (m: Map<string, Set<string>>, id: string, k: string) => { if (!m.has(id)) m.set(id, new Set()); m.get(id)!.add(k) }
  let visits = 0

  for (const r of rows) {
    const k = key(r)
    visitors.add(k)
    add(daily, r.day, k)
    if (r.path === '/mediakit') {
      visits++
      bump(sources, sourceOf(r))
      if (r.country) bump(countries, r.country)
      if (r.city) bump(cities, r.country ? `${r.city}, ${r.country}` : r.city)
      bump(devices, r.device ? r.device[0].toUpperCase() + r.device.slice(1) : 'Unknown')
      bump(browsers, r.browser ?? 'Other')
      continue
    }
    const [, , kind, id] = r.path.split('/')
    if (kind === 'slide') add(slides, id, k)
    else if (kind === 'time') add(time, id, k)
    else if (kind === 'lang') bump(languages, id)
    else if (kind === 'out' && id) {
      bump(clicks, id)
      tapped.add(k)
      const t = kitTapKind(id)
      if (t === 'work') work.add(k)
      else if (t === 'pdf') pdf.add(k)
      else if (t === 'email') emailed.add(k)
      else if (t === 'social') social.add(k)
    }
  }

  const last = String(KIT_SLIDES.length)
  return {
    days, bots, visits, visitors: visitors.size,
    tapped: tapped.size, work: work.size, pdf: pdf.size, emailed: emailed.size, social: social.size,
    finished: slides.get(last)?.size ?? 0,
    daily: daySeries(daily, days, today),
    slides: KIT_SLIDES.map((label, i) => ({ id: String(i + 1), label: `${i + 1}. ${label}`, visitors: slides.get(String(i + 1))?.size ?? 0 })),
    clicks: [...clicks].map(([id, count]) => ({ id, label: kitTapLabel(id), count })).sort(byCount),
    time: TIME.map(([id, label]) => ({ id, label, visitors: time.get(id)?.size ?? 0 })),
    languages: top(languages, 6, languageName),
    sources: top(sources, 8),
    countries: top(countries, 8, countryName),
    cities: top(cities, 8),
    devices: top(devices, 4),
    browsers: top(browsers, 6),
  }
}
