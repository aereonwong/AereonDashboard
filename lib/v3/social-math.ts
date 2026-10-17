// 👉 The cross-platform maths behind /social and the Dashboard's audience band — pure, no
// database, no aliases, so tests/social.test.mjs loads it directly. The rules are in lib/v3/social.ts.
import { PLATFORM_ORDER, type PlatformId } from './platforms.ts'

export type SocialPost = {
  platform: PlatformId
  id: string
  at: string // posted, ISO
  title: string
  kind: string // Reel, Carousel, Photo, Video, Link…
  views: number | null // every platform: views so far
  people: number | null // the platform's own unique count per post, where it has one
  interactions: number | null // null when the counts behind it were not all read
  permalink: string | null
  thumb: string | null
}

/** One connected platform, in the shape every cross-platform figure is built from. */
export type Source = {
  id: PlatformId
  followers: number
  /** Followers gained less lost, last 30 days — null until history reaches back that far. */
  net30: number | null
  /** Latest account reading within the week. */
  fresh: boolean
  /** Followers by Malaysia date, from our own readings. */
  followerDays: [string, number][]
  /** Unique people reached per day — only platforms that report it. */
  peopleDays: [string, number][] | null
  /** The platform's own unique-people window, or null when the platform doesn't measure people. */
  people: { value: number | null; window: number } | null
  /**
   * The platform's OWN count of every view and interaction in a window of N days — Instagram's
   * account totals (posts, Reels, Stories, ads), Facebook's Page totals. A window the platform
   * doesn't report is absent, and that platform falls back to its posts for it; a window it
   * should report but couldn't (stale, gap) is present with nulls, so the total hides.
   */
  reported?: Partial<Record<number, { views: number | null; interactions: number | null }>>
  posts: SocialPost[]
}

const DAY = 86_400_000
// Malaysia is UTC+8 all year.
const mytDay = (t: number) => new Date(t + 8 * 3_600_000).toISOString().slice(0, 10)

// ------------------------------------------------------------
// Maths — pure, no database
// ------------------------------------------------------------

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Interactions per 100 views, over posts where both were read. Null with nothing to divide. */
export function rateOf(posts: SocialPost[]): number | null {
  const both = posts.filter(p => p.views !== null && p.interactions !== null)
  const v = both.reduce((t, p) => t + p.views!, 0)
  return v ? (both.reduce((t, p) => t + p.interactions!, 0) / v) * 100 : null
}

export type PlatformFigures = {
  id: PlatformId
  fresh: boolean
  followers: number
  net30: number | null
  /** Posts published in the window. */
  posts: number
  perWeek: number
  /** 'account' = the platform's own count of every view in the window (incl. Stories and ads);
   *  'posts' = views so far of the posts published in the window (platforms with no account count). */
  basis: 'account' | 'posts'
  /** Every view in the window on that basis; null when it couldn't be read. */
  views: number | null
  /** Views so far of the posts published in the window — what the typical post and ranking use. */
  postViews: number | null
  /** Posts in the window with no views reading yet. */
  unread: number
  interactions: number | null
  /** Interactions per 100 views. */
  rate: number | null
  /** Median views per post in the window. */
  typical: number
  /** Posts that reached twice the typical. */
  hits: number
  lastPost: string | null
  /** Own unique-people window (Instagram 30d, Facebook 28d); undefined = not measured. */
  people: { value: number | null; window: number } | undefined
}

/** One point per platform — a month's views, a day's followers. Null = not measured then. */
export type PlatformRow = { key: string; label: string; v: Partial<Record<PlatformId, number | null>> }
export type KindRow = { platform: PlatformId; kind: string; count: number; typical: number }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const sumOf = (xs: (number | null)[]) => {
  const have = xs.filter((x): x is number => x !== null)
  return have.length ? have.reduce((t, x) => t + x, 0) : null
}

export function buildSocial(input: (Source | null)[], days: number, now = Date.now()) {
  const sources = PLATFORM_ORDER.map(id => input.find(s => s?.id === id)).filter(Boolean) as Source[]
  const ids = sources.map(s => s.id)
  const today = mytDay(now)
  const todayT = Date.parse(`${today}T00:00:00Z`)
  const cutoff = now - days * DAY
  const allPosts = sources.flatMap(s => s.posts)
  // Compared as times: stored ISO strings carry different zone suffixes (Z, +00:00, +0000).
  const inWindow = allPosts.filter(p => Date.parse(p.at) >= cutoff)

  const figures = (s: Source): PlatformFigures => {
    const mine = inWindow.filter(p => p.platform === s.id)
    const viewed = mine.filter(p => p.views !== null)
    const typical = median(viewed.map(p => p.views!))
    const rep = s.reported?.[days]
    const fromPosts = {
      views: sumOf(mine.map(p => p.views)),
      // Over the same posts as the rate (views and interactions both read), so "N interactions" sits honestly beside it.
      interactions: sumOf(mine.filter(p => p.views !== null).map(p => p.interactions)),
      rate: rateOf(mine),
    }
    const counted = rep
      ? { views: rep.views, interactions: rep.interactions, rate: rep.views && rep.interactions !== null ? (rep.interactions / rep.views) * 100 : null }
      : fromPosts
    return {
      id: s.id,
      fresh: s.fresh,
      followers: s.followers,
      net30: s.net30,
      posts: mine.length,
      perWeek: mine.length / (days / 7),
      basis: rep ? ('account' as const) : ('posts' as const),
      ...counted,
      postViews: fromPosts.views,
      unread: mine.length - viewed.length, // posts with no views reading — on either basis
      typical,
      hits: typical ? viewed.filter(p => p.views! >= 2 * typical).length : 0,
      lastPost: s.posts.reduce<string | null>((a, p) => (!a || p.at > a ? p.at : a), null),
      people: s.people ?? undefined,
    }
  }
  const platforms = sources.map(figures)
  const by = Object.fromEntries(platforms.map(f => [f.id, f])) as Partial<Record<PlatformId, PlatformFigures>>

  // Follower change: a platform without 30 days of history sits out, and the note says which.
  const known = platforms.filter(f => f.net30 !== null)
  // People: only platforms that measure them; one that should but can't say hides the total.
  const measuring = platforms.filter(f => f.people)
  const total = {
    followers: platforms.reduce((t, f) => t + f.followers, 0),
    net30: known.length ? known.reduce((t, f) => t + f.net30!, 0) : null,
    netOf: known.map(f => f.id),
    views: sumOf(platforms.map(f => f.views)),
    /** Platforms that posted in the window but have no views read at all — the total leaves them out and says so. */
    partial: platforms.filter(f => f.views === null && (f.basis === 'account' || f.posts > 0)).map(f => f.id),
    interactions: sumOf(platforms.map(f => f.interactions)),
    rate: null as number | null,
    unread: platforms.reduce((t, f) => t + f.unread, 0),
    people: measuring.length && measuring.every(f => f.people!.value !== null) ? measuring.reduce((t, f) => t + f.people!.value!, 0) : null,
    peopleOf: measuring.map(f => f.id),
    posts: platforms.reduce((t, f) => t + f.posts, 0),
    perWeek: platforms.reduce((t, f) => t + f.perWeek, 0),
  }
  // Interactions per 100 views on the same basis as the two figures beside it.
  if (total.views && total.interactions !== null && platforms.filter(f => f.basis === 'account' || f.posts > 0).every(f => f.views !== null && f.interactions !== null)) total.rate = (total.interactions / total.views) * 100
  const stale = platforms.filter(f => !f.fresh).map(f => f.id)

  // Lift: a post's views ÷ its own platform's typical post in the window.
  const lift = (p: SocialPost) => (p.views !== null && by[p.platform]?.typical ? p.views / by[p.platform]!.typical : null)
  const ranked = inWindow
    .filter(p => lift(p) !== null)
    .map(p => ({ ...p, lift: lift(p)! }))
    .sort((a, b) => b.lift - a.lift || (b.views ?? 0) - (a.views ?? 0))

  // What travels: typical views per post, by platform and format (2+ posts to count).
  const kinds: KindRow[] = []
  for (const id of ids) {
    const byKind = new Map<string, number[]>()
    for (const p of inWindow) if (p.platform === id && p.views !== null) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p.views])
    for (const [kind, xs] of byKind) if (xs.length >= 2) kinds.push({ platform: id, kind, count: xs.length, typical: median(xs) })
  }
  kinds.sort((a, b) => b.typical - a.typical)

  // Posts per week — the last 12 weeks, Monday to Sunday, Malaysia time.
  const monday = todayT - ((new Date(todayT).getUTCDay() + 6) % 7) * DAY
  const weeks: PlatformRow[] = Array.from({ length: 12 }, (_, i) => {
    const start = new Date(monday - (11 - i) * 7 * DAY).toISOString().slice(0, 10)
    return { key: start, label: start, v: Object.fromEntries(ids.map(id => [id, 0])) }
  })
  const first = Date.parse(`${weeks[0].key}T00:00:00Z`)
  for (const p of allPosts) {
    const i = Math.floor((Date.parse(`${mytDay(Date.parse(p.at))}T00:00:00Z`) - first) / (7 * DAY))
    if (i >= 0 && i < weeks.length) weeks[i].v[p.platform] = (weeks[i].v[p.platform] ?? 0) + 1
  }

  // Views earned by each month's posts, last 12 months — the like-for-like chart. Views are
  // counts and stack. A month with no post read on a platform is a gap, never zero.
  const thisMonth = today.slice(0, 7)
  const months: PlatformRow[] = Array.from({ length: 12 }, (_, i) => {
    const key = new Date(Date.UTC(Number(thisMonth.slice(0, 4)), Number(thisMonth.slice(5, 7)) - 1 - (11 - i), 1)).toISOString().slice(0, 7)
    return { key, label: `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(2, 4)}`, v: Object.fromEntries(ids.map(id => [id, null])) }
  })
  const monthAt = new Map(months.map(m => [m.key, m]))
  for (const p of allPosts) {
    const row = monthAt.get(mytDay(Date.parse(p.at)).slice(0, 7))
    if (row && p.views !== null) row.v[p.platform] = (row.v[p.platform] ?? 0) + p.views
  }

  // The last 90 days, one row a day.
  const span = (fill: (s: Source) => Map<string, number> | null) => {
    const maps = sources.map(s => [s.id, fill(s)] as const).filter(([, m]) => m) as [PlatformId, Map<string, number>][]
    const rows: PlatformRow[] = []
    for (let t = todayT - 89 * DAY; t <= todayT; t += DAY) {
      const day = new Date(t).toISOString().slice(0, 10)
      rows.push({ key: day, label: day, v: Object.fromEntries(maps.map(([id, m]) => [id, m.get(day) ?? null])) })
    }
    return rows
  }

  // Followers GAINED since each platform's first reading in the 90 days. Platforms sit tens of
  // thousands apart, so absolute lines on one axis would flatten every one of them; indexed to
  // zero, their growth compares directly. The readout gives the count too.
  const followerRows = span(s => new Map(s.followerDays))
  const followers: PlatformRow[] = followerRows.map(r => ({ ...r, v: { ...r.v } }))
  const level: Partial<Record<PlatformId, number>> = {}
  for (const id of ids) {
    const base = followerRows.find(r => r.v[id] != null)?.v[id]
    if (base == null) continue
    for (const r of followers) if (r.v[id] != null) r.v[id] = r.v[id]! - base
    level[id] = [...followerRows].reverse().find(r => r.v[id] != null)!.v[id]!
  }

  // People reached each day, platforms that report it. Each day is that platform's own unique
  // count, so the stack is a platform total — someone on two counts twice.
  const people = span(s => (s.peopleDays ? new Map(s.peopleDays) : null))
  while (people.length && Object.values(people.at(-1)!.v).every(v => v === null)) people.pop()

  return { days, ids, platforms, by, total, stale, ranked, kinds, weeks, months, followers, level, people }
}

export type Social = ReturnType<typeof buildSocial>

// ------------------------------------------------------------
// The stored totals (supabase/social-totals.sql) — one row per platform per window, plus 'all'
// ------------------------------------------------------------

export type TotalsRow = {
  day: string
  platform: PlatformId | 'all'
  window_days: number
  followers: number | null
  net30: number | null
  posts: number
  unread: number
  views: number | null
  interactions: number | null
  /** Interactions per 100 views over posts where both were read — never the two sums divided. */
  rate: number | null
  typical: number | null
  people: number | null
  best_people: number | null
  people_window: number | null
  fresh: boolean
}

/**
 * Rows for one Malaysia day from one `buildSocial` result. `best` = each platform's best own
 * unique-people window inside the last 90 days (Instagram 30-day, Facebook 28-day), where it has one.
 * The 'all' row follows the public rule: a total that would be missing a platform — stale, or with
 * posts in the window but none read — is null, never a quietly smaller figure.
 */
export function totalsRows(s: Social, best: Partial<Record<PlatformId, number | null>>, day: string): TotalsRow[] {
  const rows: TotalsRow[] = s.platforms.map(f => ({
    day,
    platform: f.id,
    window_days: s.days,
    followers: f.followers || null,
    net30: f.net30,
    posts: f.posts,
    unread: f.unread,
    views: f.views,
    interactions: f.interactions,
    rate: f.rate,
    typical: f.typical ? Math.round(f.typical) : null, // a median of an even count can be .5; stored as a whole view
    people: f.people ? f.people.value : null,
    best_people: f.people ? (best[f.id] ?? null) : null,
    people_window: f.people?.window ?? null,
    fresh: f.fresh,
  }))
  const whole = s.stale.length === 0 && s.total.partial.length === 0
  const measuring = s.platforms.filter(f => f.people)
  const bests = measuring.map(f => best[f.id] ?? null)
  rows.push({
    day,
    platform: 'all',
    window_days: s.days,
    followers: s.total.followers || null,
    net30: s.total.net30,
    posts: s.total.posts,
    unread: s.total.unread,
    views: whole ? s.total.views : null,
    interactions: whole ? s.total.interactions : null,
    rate: whole ? s.total.rate : null,
    typical: null,
    people: whole ? s.total.people : null,
    best_people: whole && bests.length && bests.every(b => b !== null) ? bests.reduce((t, b) => t! + b!, 0) : null,
    people_window: null,
    fresh: whole,
  })
  return rows
}
