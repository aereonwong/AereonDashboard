import type { IgPost, DailyPoint } from '@/lib/instagram'

// 👉 Instagram insights — pure functions over the stored posts and the daily line.
// No database, no clock: every figure the Instagram page states beyond the basics is
// computed here, so it can be read, tested and trusted in one place.
//
// Rules this file keeps:
//   · "Typical" is the MEDIAN, never the mean (one viral reel would redefine normal).
//   · Times of day are Malaysia time (UTC+8), because that is when the audience is awake.
//   · Instagram's DAILY line is cut at midnight Pacific time, so a post is matched to a
//     daily point by its Pacific date (igDay), never its Malaysian one.
//   · Instagram's newest daily point can still be counting; it is left out when it looks open.
//   · A group of fewer than 3 posts is shown but flagged — never ranked as a finding.

const MYT_MS = 8 * 3_600_000
const DAY_MS = 86_400_000

/** A Date shifted so its UTC getters read Malaysia time. */
const myt = (iso: string | number) => new Date(Date.parse(String(iso)) + MYT_MS)
/** YYYY-MM-DD in Malaysia time. */
export const mytDay = (iso: string | number) => myt(iso).toISOString().slice(0, 10)
const PACIFIC = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' })
/** The Instagram-insights day (Pacific time) a moment falls in, as YYYY-MM-DD. */
export const igDay = (iso: string | number) => PACIFIC.format(new Date(Date.parse(String(iso))))
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10)

/** Cut text to n characters without splitting an emoji in half (a lone surrogate breaks rendering). */
export const clip = (t: string, n: number) => {
  const c = Array.from(t)
  return c.length > n ? c.slice(0, n).join('') + '…' : t
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const isReel = (p: IgPost) => /REEL/i.test(p.type)
const reached = (posts: IgPost[]) => posts.filter(p => p.reach !== undefined)

// ------------------------------------------------------------------ followers by posting day

export type FlowDay = {
  day: string
  posts: IgPost[]
  /** Follows gained on the posting day and the day after. */
  follows: number
  /** That, as a multiple of a normal stretch of the same length. */
  lift: number
  /** The day after is not in yet, so this counts the posting day only. */
  soFar: boolean
}
export type Flow = { rows: FlowDay[]; normalPerDay: number; from: string; to: string } | null

/** Instagram's newest daily point can still be counting; the fetch leaves its follows blank or 0. */
export const isOpenDay = (d: DailyPoint, i: number, all: DailyPoint[]) => i === all.length - 1 && (d.new_followers ?? 0) === 0

/** Which posting days were followed by followers. Instagram does not say which post
 *  earned a follow (photos aside), so this attributes by day: follows in the 48 hours
 *  from the day a post went out. Two posts on one day share that day's follows. */
export function followFlow(posts: IgPost[], daily: DailyPoint[]): Flow {
  const counted = daily.filter(d => d.new_followers !== undefined)
  const days = counted.filter((d, i) => !isOpenDay(d, i, counted))
  if (days.length < 8) return null
  const by = new Map(days.map(d => [d.day, d.new_followers as number]))
  const normalPerDay = median(days.map(d => d.new_followers as number))
  const byDay = new Map<string, IgPost[]>()
  for (const p of posts) byDay.set(igDay(p.timestamp), [...(byDay.get(igDay(p.timestamp)) ?? []), p])
  const rows: FlowDay[] = []
  for (const [day, ps] of byDay) {
    const a = by.get(day)
    if (a === undefined) continue
    const b = by.get(addDays(day, 1))
    const soFar = b === undefined
    const follows = a + (b ?? 0)
    rows.push({ day, posts: ps, follows, soFar, lift: normalPerDay ? follows / ((soFar ? 1 : 2) * normalPerDay) : 0 })
  }
  rows.sort((x, y) => y.follows - x.follows)
  return { rows, normalPerDay, from: days[0].day, to: days.at(-1)!.day }
}

// ------------------------------------------------------------------ when to post

export const DAYPARTS = [
  { key: 'late', label: 'Late night', hours: '12–6am', from: 0, to: 6 },
  { key: 'morning', label: 'Morning', hours: '6am–12', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon', hours: '12–6pm', from: 12, to: 18 },
  { key: 'evening', label: 'Evening', hours: '6pm–12', from: 18, to: 24 },
] as const
export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export type Cell = { n: number; median: number }
export type TimeGrid = {
  cells: Cell[][] // [weekday][daypart]
  byDay: Cell[]
  byPart: Cell[]
  best: { weekday: number; part: number; n: number; median: number } | null
  max: number
  posts: number
}

export function timeGrid(posts: IgPost[]): TimeGrid {
  const buckets: number[][][] = WEEKDAYS.map(() => DAYPARTS.map(() => []))
  const dayB: number[][] = WEEKDAYS.map(() => [])
  const partB: number[][] = DAYPARTS.map(() => [])
  let n = 0
  for (const p of reached(posts)) {
    const d = myt(p.timestamp)
    const wd = (d.getUTCDay() + 6) % 7 // Monday first
    const part = DAYPARTS.findIndex(x => d.getUTCHours() >= x.from && d.getUTCHours() < x.to)
    buckets[wd][part].push(p.reach as number)
    dayB[wd].push(p.reach as number)
    partB[part].push(p.reach as number)
    n++
  }
  const cell = (xs: number[]): Cell => ({ n: xs.length, median: median(xs) })
  const cells = buckets.map(r => r.map(cell))
  let best: TimeGrid['best'] = null
  cells.forEach((r, wd) =>
    r.forEach((c, part) => {
      if (c.n >= 2 && (!best || c.median > best.median)) best = { weekday: wd, part, n: c.n, median: c.median }
    }),
  )
  return {
    cells,
    byDay: dayB.map(cell),
    byPart: partB.map(cell),
    best,
    max: Math.max(1, ...cells.flat().map(c => c.median)),
    posts: n,
  }
}

// ------------------------------------------------------------------ themes

// A post can belong to several themes (a drone show at KLCC is both). Order here is
// only the display order; ranking is by median reach.
export const THEMES: { key: string; label: string; re: RegExp }[] = [
  { key: 'klcc', label: 'KLCC & landmarks', re: /klcc|petronas|twin tower|merdeka 118|bangunan|sultan abdul samad|bukit bintang|kuala lumpur|\bkl\b/i },
  { key: 'drone', label: 'Drone shows & aerial', re: /drone|aerial|from above|dji|fpv/i },
  { key: 'event', label: 'Events & launches', re: /activation|launch|event|conference|celebration|f1\b|invitation|opening|show\b|fireworks/i },
  { key: 'tech', label: 'Tech & gadgets', re: /iphone|android|gimbal|screen|robot|vacuum|osmo|camera|gadget|speaker|zhiyun|laptop|phone|smart/i },
  { key: 'travel', label: 'Travel & places', re: /travel|explore|chongqing|trip|destination|hotel|airline|flight|jetour|places to/i },
  { key: 'food', label: 'Food & lifestyle', re: /matcha|dining|cafe|café|restaurant|rooftop|karaoke|bar\b|food|treatment|facial|wellness/i },
]

export type Theme = { key: string; label: string; posts: IgPost[]; median: number; lift: number; thin: boolean }

export function themes(posts: IgPost[]): { rows: Theme[]; typical: number } {
  const rp = reached(posts)
  const typical = median(rp.map(p => p.reach as number))
  const rows = THEMES.map(t => {
    const ps = rp.filter(p => t.re.test(p.caption))
    const m = median(ps.map(p => p.reach as number))
    return { key: t.key, label: t.label, posts: ps, median: m, lift: typical ? m / typical : 0, thin: ps.length < 3 }
  })
    .filter(t => t.posts.length > 0)
    .sort((a, b) => Number(a.thin) - Number(b.thin) || b.median - a.median)
  return { rows, typical }
}

// ------------------------------------------------------------------ reach vs followers

export type Band = { label: string; sub: string; n: number }
export type ReachVsFollowers = {
  /** Median post, as a percentage of the followers you had that day. */
  typicalPct: number
  /** Share of posts that reached more people than followed you at the time. */
  beyondPct: number
  bands: Band[]
  weeks: { label: string; pct: number; n: number }[]
  posts: number
}

/** Followers on the day of a post, rebuilt from today's count and the follows gained since
 *  (the daily line). Before the daily line starts it uses the oldest figure it can rebuild. */
export function followersOn(day: string, followersNow: number, daily: DailyPoint[]): number {
  const gained = daily.filter(d => d.day > day).reduce((t, d) => t + (d.new_followers ?? 0), 0)
  return Math.max(1, followersNow - gained)
}

export function reachVsFollowers(posts: IgPost[], followersNow: number, daily: DailyPoint[]): ReachVsFollowers | null {
  // Followers on a past day are rebuilt from the daily line, so posts older than that line are left out.
  const start = daily[0]?.day
  const rp = reached(posts).filter(p => followersNow > 0 && (!start || igDay(p.timestamp) >= start))
  if (rp.length < 5) return null
  const pcts = rp.map(p => ({ p, pct: ((p.reach as number) / followersOn(igDay(p.timestamp), followersNow, daily)) * 100 }))
  const cut = [0, 50, 100, 300, Infinity]
  const names = [
    ['Under half', 'fewer than half your followers'],
    ['Half to all', '50–100% of your followers'],
    ['Past your audience', '1–3× your followers'],
    ['Far beyond', 'over 3× your followers'],
  ]
  const bands = names.map(([label, sub], i) => ({
    label,
    sub,
    n: pcts.filter(x => x.pct >= cut[i] && x.pct < cut[i + 1]).length,
  }))
  // Weekly: the median post of each 7-day block, newest block last.
  const newest = Math.max(...rp.map(p => Date.parse(p.timestamp)))
  const weeks: ReachVsFollowers['weeks'] = []
  for (let w = 5; w >= 0; w--) {
    const hi = newest - w * 7 * DAY_MS
    const lo = hi - 7 * DAY_MS
    const inW = pcts.filter(x => Date.parse(x.p.timestamp) > lo && Date.parse(x.p.timestamp) <= hi)
    if (inW.length) weeks.push({ label: w === 0 ? 'Latest' : `${w}w before`, pct: median(inW.map(x => x.pct)), n: inW.length })
  }
  return {
    typicalPct: median(pcts.map(x => x.pct)),
    beyondPct: (pcts.filter(x => x.pct >= 100).length / pcts.length) * 100,
    bands,
    weeks,
    posts: pcts.length,
  }
}

// ------------------------------------------------------------------ shelf life

/** One stored reading of a post (a row of ig_post_metrics). */
export type MetricRow = { media_id: string; posted_at: string | null; type: string | null; reach: number | null; captured_at: string }

export type CurvePoint = { age: number; frac: number; n: number }
export type ShelfLife = {
  curves: { reels: CurvePoint[]; posts: CurvePoint[] }
  tracked: number
  since: string
  readings: number
  /** Share of final reach a typical Reel / post had by the end of day 2. */
  early: { reels: number | null; posts: number | null }
}

/** How a post's reach builds after it goes out: each reading is that post's reach on that
 *  day as a share of its latest reach. Needs the same post read on 2+ days, so it fills
 *  in by itself as the daily refresh keeps running. */
export function shelfLife(rows: MetricRow[]): ShelfLife | null {
  const byPost = new Map<string, MetricRow[]>()
  for (const r of rows) {
    if (r.reach === null || !r.posted_at) continue
    byPost.set(r.media_id, [...(byPost.get(r.media_id) ?? []), r])
  }
  const bins = { reels: new Map<number, number[]>(), posts: new Map<number, number[]>() }
  let tracked = 0
  let readings = 0
  let since = ''
  for (const rs of byPost.values()) {
    const days = new Set(rs.map(r => r.captured_at.slice(0, 10)))
    if (days.size < 2) continue
    const sorted = [...rs].sort((a, b) => a.captured_at.localeCompare(b.captured_at))
    const final = sorted.at(-1)!.reach as number
    if (final <= 0) continue
    tracked++
    const kind = /REEL/i.test(sorted[0].type ?? '') ? 'reels' : 'posts'
    for (const r of sorted) {
      const age = Math.max(0, Math.round((Date.parse(r.captured_at) - Date.parse(r.posted_at as string)) / DAY_MS))
      if (age > 21) continue
      const m = bins[kind]
      m.set(age, [...(m.get(age) ?? []), Math.min(1, (r.reach as number) / final)])
      readings++
      if (!since || r.captured_at < since) since = r.captured_at
    }
  }
  const curve = (m: Map<number, number[]>): CurvePoint[] =>
    [...m.entries()].filter(([, xs]) => xs.length >= 2).map(([age, xs]) => ({ age, frac: median(xs), n: xs.length })).sort((a, b) => a.age - b.age)
  const c = { reels: curve(bins.reels), posts: curve(bins.posts) }
  const at2 = (pts: CurvePoint[]) => {
    const p = pts.find(x => x.age === 2)
    return p && p.n >= 3 ? p.frac : null
  }
  if (!tracked || (!c.reels.length && !c.posts.length)) return null
  return { curves: c, tracked, since, readings, early: { reels: at2(c.reels), posts: at2(c.posts) } }
}

// ------------------------------------------------------------------ brand work

/** A caption that thanks, invites or credits a brand reads as brand work. It is a
 *  guess from the words, so the page says so; an invoice link is the sure signal. */
export const BRANDED = /thanks?\s+@|thank you\s+@|invit(?:ation|ed)|in collaboration|partner|sponsor|#ad\b|#collab|introducing|meet (?:the|nam)|brought to you|\bpresents?\b|activation|launch/i

export type LinkedInvoice = {
  id: number
  no: string
  client: string
  job: string
  amount: number
  currency: string
  date: string
  /** Documented but payment not tracked (isIssued) — shown as invoiced, never as owed or paid. */
  documented: boolean
  postIds: string[]
}

export type CollabView = {
  branded: { n: number; median: number }
  own: { n: number; median: number }
  /** Branded median as a multiple of own median. */
  ratio: number
  /** Post ids that count as brand work (linked or credited in the caption). */
  brandedIds: Set<string>
  invoices: (LinkedInvoice & { posts: IgPost[]; reach: number | null; lift: number | null })[]
  typical: number
}

export function collabs(posts: IgPost[], linked: LinkedInvoice[], extraReach: Record<string, number> = {}): CollabView | null {
  const rp = reached(posts)
  if (rp.length < 6) return null
  const linkedIds = new Set(linked.flatMap(l => l.postIds))
  const brandedIds = new Set(rp.filter(p => linkedIds.has(p.id) || BRANDED.test(p.caption)).map(p => p.id))
  const b = rp.filter(p => brandedIds.has(p.id))
  const o = rp.filter(p => !brandedIds.has(p.id))
  const typical = median(rp.map(p => p.reach as number))
  const byId = new Map(rp.map(p => [p.id, p]))
  const invoices = linked.map(l => {
    const ps = l.postIds.map(id => byId.get(id)).filter(Boolean) as IgPost[]
    const reachOf = (id: string) => byId.get(id)?.reach ?? extraReach[id]
    const known = l.postIds.map(reachOf).filter((x): x is number => x !== undefined)
    const reach = known.length === l.postIds.length ? known.reduce((t, x) => t + x, 0) : null
    return { ...l, posts: ps, reach, lift: known.length && typical ? median(known) / typical : null }
  })
  const mb = median(b.map(p => p.reach as number))
  const mo = median(o.map(p => p.reach as number))
  return {
    branded: { n: b.length, median: mb },
    own: { n: o.length, median: mo },
    ratio: mo && b.length ? mb / mo : 0,
    brandedIds,
    invoices,
    typical,
  }
}

export { isReel }
