// 👉 Turns the landing page's rows from site_visits into the Site analytics tab's Landing view.
// Pure (no runtime imports) so it is unit-tested; lib/site-stats.ts reads the rows. A "visitor"
// is one daily visitor hash, as on the Link page. Rows: '/' = a page view; '/login' = someone
// opened the sign-in page; '/land/…' = what they did (lib/site-visits.ts LANDING_EVENT).
import { sourceOf, top, countryName, bump, byCount, daySeries, splitBots, type Bots, type Count, type VisitRow } from './hello-insights.ts'
import { landingTapKind, landingTapLabel } from './landing-taps.ts'

export type Reached = { id: string; label: string; visitors: number }
export type LandingInsights = {
  days: number
  /** Left out as bots or instant bounces (splitBots in lib/hello-insights.ts). */
  bots: Bots
  visits: number
  visitors: number
  tapped: number
  emailed: number
  social: number
  entered: number
  signIn: number
  daily: { day: string; visitors: number }[]
  clicks: Count[]
  scroll: Reached[]
  time: Reached[]
  versions: Count[]
  languages: Count[]
  sources: Count[]
  countries: Count[]
  cities: Count[]
  devices: Count[]
  browsers: Count[]
}

const SCROLL: [string, string][] = [['25', 'A quarter down'], ['50', 'Halfway'], ['75', 'Three quarters'], ['100', 'The very end']]
const TIME: [string, string][] = [['10s', '10 seconds'], ['30s', '30 seconds'], ['1m', '1 minute'], ['3m', '3 minutes'], ['10m', '10 minutes']]
const VERSION: Record<string, string> = { classic: 'Front door', 'kit-v1': 'Media kit v1', 'kit-v2': 'Media kit v2', reel: 'Motion reel' }

const languageName = (() => {
  let names: Intl.DisplayNames | null = null
  try { names = new Intl.DisplayNames(['en'], { type: 'language' }) } catch { /* plain codes */ }
  return (code: string) => { try { return names?.of(code) ?? code } catch { return code } }
})()

export function analyseLanding(all: VisitRow[], days: number, today: string): LandingInsights {
  // '/login' rows are kept whatever: a sign-in page view is its own signal, not a landing visit.
  const { rows, bots } = splitBots(all.filter(r => r.path !== '/login'), p => p === '/')
  rows.push(...all.filter(r => r.path === '/login'))
  const key = (r: VisitRow) => `${r.day}|${r.visitor_hash}`
  const visitors = new Set<string>(), signIn = new Set<string>()
  const tapped = new Set<string>(), emailed = new Set<string>(), social = new Set<string>(), entered = new Set<string>()
  const scroll = new Map<string, Set<string>>(), time = new Map<string, Set<string>>()
  const daily = new Map<string, Set<string>>()
  const clicks = new Map<string, number>(), versions = new Map<string, number>(), languages = new Map<string, number>()
  const sources = new Map<string, number>(), countries = new Map<string, number>(), cities = new Map<string, number>()
  const devices = new Map<string, number>(), browsers = new Map<string, number>()
  const add = (m: Map<string, Set<string>>, id: string, k: string) => { if (!m.has(id)) m.set(id, new Set()); m.get(id)!.add(k) }
  let visits = 0

  for (const r of rows) {
    const k = key(r)
    if (r.path === '/login') { signIn.add(k); continue }
    if (r.path !== '/' && !r.path.startsWith('/land/')) continue
    visitors.add(k)
    add(daily, r.day, k)
    if (r.path === '/') {
      visits++
      bump(sources, sourceOf(r))
      if (r.country) bump(countries, r.country)
      if (r.city) bump(cities, r.country ? `${r.city}, ${r.country}` : r.city)
      bump(devices, r.device ? r.device[0].toUpperCase() + r.device.slice(1) : 'Unknown')
      bump(browsers, r.browser ?? 'Other')
      continue
    }
    const [, , kind, id] = r.path.split('/')
    if (kind === 'view' && VERSION[id]) bump(versions, id)
    else if (kind === 'lang') bump(languages, id)
    else if (kind === 'scroll') add(scroll, id, k)
    else if (kind === 'time') add(time, id, k)
    else if (kind === 'out' && id) {
      bump(clicks, id)
      tapped.add(k)
      const t = landingTapKind(id)
      if (t === 'email') emailed.add(k)
      else if (t === 'social' || t === 'post') social.add(k)
      else if (t === 'enter') entered.add(k)
    }
  }

  const reached = (m: Map<string, Set<string>>, marks: [string, string][]) =>
    marks.map(([id, label]) => ({ id, label, visitors: m.get(id)?.size ?? 0 }))

  return {
    days, bots, visits, visitors: visitors.size,
    tapped: tapped.size, emailed: emailed.size, social: social.size, entered: entered.size, signIn: signIn.size,
    daily: daySeries(daily, days, today),
    clicks: [...clicks].map(([id, count]) => ({ id, label: landingTapLabel(id), count })).sort(byCount),
    scroll: reached(scroll, SCROLL),
    time: reached(time, TIME),
    versions: top(versions, 4, id => VERSION[id] ?? id),
    languages: top(languages, 6, languageName),
    sources: top(sources, 8),
    countries: top(countries, 8, countryName),
    cities: top(cities, 8),
    devices: top(devices, 4),
    browsers: top(browsers, 6),
  }
}
