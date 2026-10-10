// 👉 Content Lab — the pure maths behind the Instagram "Content Lab" view.
//
// No database, no React: the server reads the archive (lib/v3/content-lab.ts), the
// client filters it, and every figure the Lab shows comes out of a function here.
//
// Rules this file keeps (the same as lib/v3/ig-insights.ts):
//   · "Typical" is the MEDIAN post reach, never the mean.
//   · A HIT is a post that reached at least twice the typical post IN THE SAME SLICE.
//   · Times of day are Malaysia time (UTC+8).
//   · Post reach is per post; adding it up counts a person once per post they saw,
//     so every sum is labelled "combined". Unique reach only comes from the account windows.
//   · A group of fewer than 3 posts is drawn but flagged "thin" — never called a finding.

export type Format = 'reel' | 'carousel' | 'photo'

/** One post as the Lab ships it to the browser: the hook line, not the whole caption. */
export type LabPost = {
  id: string
  at: string // ISO timestamp
  format: Format
  hook: string // the caption's first line, clipped
  link: string | null
  reach: number
  views: number | null // null = Instagram did not return it; never counted as 0
  likes: number | null
  comments: number | null
  saves: number | null
  shares: number | null
  watchSec: number | null // Reels: average watch time per play
  follows: number | null // photos/carousels: follows the post caused
  angle: AngleKey
  hookType: HookKey
  brand: BrandKey
}

/** Instagram's own 30-day account windows: the only UNIQUE reach figures. */
export type LabWindow = { since: string; until: string; reach: number; followers: number; nonFollowers: number; views: number; interactions: number }

// ------------------------------------------------------------------ classifiers

// Hook = what the caption's FIRST LINE promises. Order matters: the first match wins,
// so "Happy New Year" is a Greeting before News ("new"), and "Asia's largest GoKart circuit
// is now available" is News (the urgency) before Superlative (the size).
export const HOOKS = [
  { key: 'greeting', label: 'Greeting · countdown', short: 'Greeting', example: 'Happy 69th Merdeka, Malaysia! 🇲🇾', re: /^happy|counting down|selamat|wishing/i },
  { key: 'news', label: 'News · it’s happening', short: 'News', example: 'Ombak KLCC opening soon this year 🌟', re: /opening|now (?:available|open)|announced|set to|\bwill\b|reopen|\breturn|coming|\bnew\b|launch|tonight|situation|update|finally/i },
  { key: 'guide', label: 'List · guide', short: 'Guide', example: 'Places to explore in Chongqing 🇨🇳', re: /places to|things to|guide|tips?\b|how to|\d+ (?:spots|places|things)/i },
  { key: 'curiosity', label: 'Curiosity · discovery', short: 'Curiosity', example: 'Did you know many Chinese movies were filmed here?', re: /did you know|some say|secret|hidden|\bpov\b|didn.t know|never thought|can.t believe|in awe|discovered|why /i },
  { key: 'superlative', label: 'Superlative', short: 'Superlative', example: 'One of the most photogenic spots in KL', re: /largest|biggest|best|\bmost\b|iconic|\bfirst\b|\bonly\b|tallest|longest/i },
  { key: 'question', label: 'Question', short: 'Question', example: 'Are you ready for F1 to return?', re: /\?/ },
  { key: 'plain', label: 'Plain description', short: 'Plain', example: 'Kuala Lumpur viewpoint from Ampang 🌃', re: /.*/ },
] as const
export type HookKey = (typeof HOOKS)[number]['key']

// Angle = what the post is FOR. One per post, first match wins: a sponsored Merdeka
// post is Brand work first, because that is the decision it informs.
export const ANGLES = [
  { key: 'brand', label: 'Brand work' },
  { key: 'moment', label: 'Festive & national moments' },
  { key: 'guide', label: 'Destination guides' },
  { key: 'abroad', label: 'Travel abroad' },
  { key: 'local', label: 'KL & Malaysia' },
  { key: 'personal', label: 'Personal' },
] as const
export type AngleKey = (typeof ANGLES)[number]['key']

/** Brands and gadgets that, when named, make a post brand-led, and the words of a paid post.
 *  Narrower than ig-insights' BRANDED on purpose: "launch" and "presents" there catch news
 *  posts ("F1 launch"), which would hide the News hook's best examples inside Brand work. */
const BRAND_NAMES = /xiaomi|honor|samsung|galaxy|vivo|oppo|\bdji\b|osmo|insta360|skinarma|mova|\btng\b|casetif|outdoor products|playstation|magic8|iphone|zhiyun|realme|huawei/i
const COLLAB = /thanks?\s+@|thank you\s+@|in collaboration|partner|sponsor|#ad\b|#collab|brought to you|#sp\b|paid partnership|invit(?:ation|ed)/i
const MOMENT = /merdeka|malaysia day|independence|chinese new year|\bcny\b|chap goh meh|thaipusam|raya|deepavali|christmas|new year|ramadan|mid-autumn|hari kebangsaan|countdown|national day/i
const ABROAD = /china|chongqing|chengdu|shanghai|beijing|jiuzhaigou|bali|indonesia|thailand|singapore|japan|korea|vietnam|taiwan|hong kong|brunei|dubai|europe|london|paris|australia|marina bay/i
const HOME = /kuala lumpur|\bkl\b|klcc|klia|petronas|merdeka 118|selangor|malaysia|penang|sabah|sarawak|johor|melaka|malacca|langkawi|putrajaya|ipoh/i
const PERSONAL = /birthday|my eyes|thank you everyone|anniversary of me|grateful for you/i

export type BrandKey = 'hook' | 'body' | 'none'

const firstLine = (caption: string) => caption.trim().split('\n')[0] ?? ''

export function hookOf(caption: string): HookKey {
  const f = firstLine(caption)
  if (!f) return 'plain'
  return HOOKS.find(h => h.re.test(f))!.key
}

/** Where a brand appears in the caption: in the hook line, only further down, or nowhere. */
export function brandOf(caption: string): BrandKey {
  const f = firstLine(caption)
  if (BRAND_NAMES.test(f) || COLLAB.test(f)) return 'hook'
  const rest = caption.slice(f.length)
  return BRAND_NAMES.test(rest) || COLLAB.test(rest) ? 'body' : 'none'
}

export function angleOf(caption: string): AngleKey {
  const f = firstLine(caption)
  const head = caption.slice(0, 300)
  if (brandOf(caption) !== 'none') return 'brand'
  if (PERSONAL.test(f)) return 'personal'
  if (MOMENT.test(f)) return 'moment'
  if (/places to|things to/i.test(f)) return 'guide'
  if (ABROAD.test(head) && !HOME.test(f)) return 'abroad'
  return 'local'
}

// ------------------------------------------------------------------ filters

export type Range = { from: string; to: string } // inclusive YYYY-MM-DD, Malaysia time
export type Filters = { range: Range; format: Format | ''; angle: AngleKey | ''; hook: HookKey | '' }

const MYT_MS = 8 * 3_600_000
export const myt = (iso: string) => new Date(Date.parse(iso) + MYT_MS)
export const mytDay = (iso: string) => myt(iso).toISOString().slice(0, 10)

/** The timeline presets. The Lab opens on '90' (Aereon, 10 Oct 2026: default to the last 90 days or
 *  the year, never a long range a panel does not need). `today` is the newest post's day, not the clock, so the same data
 *  always gives the same slice; `since` is where the Lab's data starts (1 January). A single
 *  month is picked from the month list, which `months()` builds. */
export function presets(today: string, since: string): { key: string; label: string; range: Range }[] {
  const back = (days: number) => {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - days * 86_400_000).toISOString().slice(0, 10)
    return d < since ? since : d
  }
  const short = back(89) === since // the year so far is 90 days or less: "90 days" and "the year" are the same slice
  return [
    ...(short ? [] : [{ key: 'ytd', label: `${today.slice(0, 4)} so far`, range: { from: since, to: today } }]),
    // Early in the year 90 days would reach back before 1 January, where the Lab has no data,
    // so it is clamped — and labelled for what it then is.
    { key: '90', label: back(89) === since ? `${today.slice(0, 4)} so far` : 'Last 90 days', range: { from: back(89), to: today } },
    { key: '30', label: 'Last 30 days', range: { from: back(29), to: today } },
  ]
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Every calendar month from `since` to `today`, newest first. */
export function months(today: string, since: string): { key: string; label: string; range: Range }[] {
  const out: { key: string; label: string; range: Range }[] = []
  for (const d = new Date(since.slice(0, 7) + '-01T00:00:00Z'); d.toISOString().slice(0, 10) <= today; d.setUTCMonth(d.getUTCMonth() + 1)) {
    const from = d.toISOString().slice(0, 10)
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
    out.unshift({ key: from.slice(0, 7), label: `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`, range: { from, to: end > today ? today : end } })
  }
  return out
}

export const inRange = (p: LabPost, r: Range) => {
  const d = mytDay(p.at)
  return d >= r.from && d <= r.to
}

/** Apply every filter except the ones named in `skip` — a panel that IS a filter
 *  (the hook board, the angle grid) shows all its own options and highlights the chosen one. */
export function slice(posts: LabPost[], f: Filters, skip: ('format' | 'angle' | 'hook')[] = []): LabPost[] {
  return posts.filter(
    p =>
      inRange(p, f.range) &&
      (skip.includes('format') || !f.format || p.format === f.format) &&
      (skip.includes('angle') || !f.angle || p.angle === f.angle) &&
      (skip.includes('hook') || !f.hook || p.hookType === f.hook),
  )
}

// ------------------------------------------------------------------ figures

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
/** Per 1,000 accounts reached — a rate, so a viral post and a quiet one weigh the same.
 *  Posts without the figure are left out; null when none have it. */
const perK = (ps: LabPost[], k: 'shares' | 'saves' | 'comments'): number | null => {
  const xs = ps.filter(p => p[k] !== null && p.reach > 0).map(p => ((p[k] as number) / p.reach) * 1000)
  return xs.length ? median(xs) : null
}

export type Group = { n: number; median: number; lift: number; hitRate: number; sharesK: number | null; savesK: number | null; reach: number; thin: boolean; best: LabPost | null }

export function group(ps: LabPost[], typical: number): Group {
  const m = median(ps.map(p => p.reach))
  return {
    n: ps.length,
    median: m,
    lift: typical ? m / typical : 0,
    hitRate: ps.length ? ps.filter(p => p.reach >= 2 * typical).length / ps.length : 0,
    sharesK: perK(ps, 'shares'),
    savesK: perK(ps, 'saves'),
    reach: sum(ps.map(p => p.reach)),
    thin: ps.length < 3,
    best: ps.reduce<LabPost | null>((b, p) => (!b || p.reach > b.reach ? p : b), null),
  }
}

export type Pulse = {
  posts: number
  reach: number
  views: number
  typical: number
  hits: number
  hitRate: number
  sharesK: number | null
  savesK: number | null
  watch: number | null
}

export function pulse(ps: LabPost[]): Pulse {
  const typical = median(ps.map(p => p.reach))
  const reels = ps.filter(p => p.watchSec !== null)
  const hits = ps.filter(p => p.reach >= 2 * typical).length
  return {
    posts: ps.length,
    reach: sum(ps.map(p => p.reach)),
    views: sum(ps.map(p => p.views ?? 0)),
    typical,
    hits,
    hitRate: ps.length ? hits / ps.length : 0,
    sharesK: perK(ps, 'shares'),
    savesK: perK(ps, 'saves'),
    watch: reels.length ? median(reels.map(p => p.watchSec!)) : null,
  }
}

/** One bar per calendar month (or per week when the slice is under ~10 weeks). */
export type Bucket = { key: string; from: string; to: string; label: string; n: number; reach: number; median: number; best: LabPost | null }

export function timeline(ps: LabPost[], r: Range): Bucket[] {
  const days = (Date.parse(r.to) - Date.parse(r.from)) / 86_400_000 + 1
  const weekly = days <= 70
  const out: Bucket[] = []
  const start = new Date(r.from + 'T00:00:00Z')
  if (weekly) start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)) // Monday
  else start.setUTCDate(1)
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  for (let d = start; d.toISOString().slice(0, 10) <= r.to; ) {
    const next = new Date(d)
    if (weekly) next.setUTCDate(next.getUTCDate() + 7)
    else next.setUTCMonth(next.getUTCMonth() + 1)
    const from = d.toISOString().slice(0, 10)
    const to = new Date(next.getTime() - 86_400_000).toISOString().slice(0, 10)
    const inB = ps.filter(p => {
      const x = mytDay(p.at)
      return x >= from && x <= to
    })
    out.push({
      key: from,
      from: from < r.from ? r.from : from,
      to: to > r.to ? r.to : to,
      label: weekly ? `${d.getUTCDate()} ${M[d.getUTCMonth()]}` : `${M[d.getUTCMonth()]}${d.getUTCMonth() === 0 || out.length === 0 ? ` ${String(d.getUTCFullYear()).slice(2)}` : ''}`,
      n: inB.length,
      reach: sum(inB.map(p => p.reach)),
      median: median(inB.map(p => p.reach)),
      best: inB.reduce<LabPost | null>((b, p) => (!b || p.reach > b.reach ? p : b), null),
    })
    d = next
  }
  return out
}

/** Reels by average watch time — the clearest lever the data shows. */
export const WATCH_BANDS = [
  { label: 'Under 6s', from: 0, to: 6 },
  { label: '6–8s', from: 6, to: 8 },
  { label: '8–10s', from: 8, to: 10 },
  { label: '10–15s', from: 10, to: 15 },
  { label: '15s+', from: 15, to: Infinity },
]
export function watchBands(ps: LabPost[], typical: number) {
  const reels = ps.filter(p => p.watchSec !== null)
  return WATCH_BANDS.map(b => ({ ...b, ...group(reels.filter(p => p.watchSec! >= b.from && p.watchSec! < b.to), typical) }))
}

export const DAYPARTS = [
  { label: 'Late night', hours: '12–6am', from: 0, to: 6 },
  { label: 'Morning', hours: '6am–12', from: 6, to: 12 },
  { label: 'Afternoon', hours: '12–6pm', from: 12, to: 18 },
  { label: 'Evening', hours: '6pm–12', from: 18, to: 24 },
]
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function when(ps: LabPost[]) {
  const cells = WEEKDAYS.map(() => DAYPARTS.map(() => [] as LabPost[]))
  for (const p of ps) {
    const d = myt(p.at)
    cells[(d.getUTCDay() + 6) % 7][DAYPARTS.findIndex(x => d.getUTCHours() >= x.from && d.getUTCHours() < x.to)].push(p)
  }
  const grid = cells.map(r => r.map(c => ({ n: c.length, median: median(c.map(p => p.reach)), best: c.reduce<LabPost | null>((b, p) => (!b || p.reach > b.reach ? p : b), null) })))
  const rows = cells.map(r => median(r.flat().map(p => p.reach)))
  const cols = DAYPARTS.map((_, i) => median(cells.flatMap(r => r[i]).map(p => p.reach)))
  return { grid, rows, cols, max: Math.max(1, ...grid.flat().filter(c => c.n >= 2).map(c => c.median)) }
}

/** How much of the slice's combined reach the top N posts carry. */
export function concentration(ps: LabPost[]) {
  const r = ps.map(p => p.reach).sort((a, b) => b - a)
  const total = sum(r) || 1
  let run = 0
  return r.map((x, i) => ((run += x), { n: i + 1, share: run / total }))
}

/** The one-line verdict for the slice: the strongest hook against plain captions. */
export function verdict(ps: LabPost[]): { lead: string; detail: string } | null {
  if (ps.length < 6) return null
  const typical = median(ps.map(p => p.reach))
  const groups = HOOKS.map(h => ({ h, g: group(ps.filter(p => p.hookType === h.key), typical) })).filter(x => !x.g.thin)
  const plain = groups.find(x => x.h.key === 'plain')
  const best = groups.filter(x => x.h.key !== 'plain').sort((a, b) => b.g.median - a.g.median)[0]
  if (!best) return null
  const vs = plain && plain.g.median ? best.g.median / plain.g.median : best.g.lift
  return {
    lead: `${best.h.short} hooks travel ${vs >= 10 ? vs.toFixed(0) : vs.toFixed(1)}× further`,
    detail: plain
      ? `than plain captions — ${Math.round(best.g.hitRate * 100)}% of them doubled your typical reach. ${Math.round((plain.g.n / ps.length) * 100)}% of posts here still open with a plain description.`
      : `than your typical post — ${Math.round(best.g.hitRate * 100)}% of them doubled it.`,
  }
}
