import { type Rec } from './records'
import { toInvoices, type Invoice } from './invoices'

// 👉 The operating picture: everything the v2 Dashboard states about the
// business is computed HERE, in code, from the invoice rows. Nothing on that
// page is estimated, rounded up, or written by a model — if a sentence claims a
// number, the function that produced it is in this file.
//
// Two rules carried over from the rest of the app:
//   · an invoice is a `cash_in` row with meta.invoice_no
//   · a row with meta.currency is foreign and NEVER lands in a RM total
//
// Everything below works on ringgit invoices only, and says so where it counts.

// ---------------------------------------------------------------- classifying

// Aereon works across several niches, so one label is never enough. We cut the
// same invoice two ways and let the page switch between them:
//   · SERVICE — what he actually did
//   · SECTOR  — whose industry paid for it
// Both are keyword rules over the invoice title + notes. Order matters: the
// first match wins, so the most specific patterns are listed first.

export type Lens = 'service' | 'sector'

export const SERVICES = [
  'Social campaign',
  'Drone & aerial',
  'Event coverage',
  'Licensing & footage',
  'Production',
  'Workshops',
  'Print & resale',
  'Other',
] as const
export type Service = (typeof SERVICES)[number]

export const SECTORS = [
  'Consumer tech',
  'Travel & tourism',
  'Property & places',
  'Automotive',
  'Finance & telco',
  'Retail & commerce',
  'Media & entertainment',
  'Corporate & B2B',
  'Other',
] as const
export type Sector = (typeof SECTORS)[number]

const has = (t: string, re: RegExp) => re.test(t)

// Order is the logic. Licensing beats drone (footage sold on is a licence, not a
// shoot); drone beats social (a drone job posted to Instagram is still a drone
// job); social beats event (a launch with a reel attached is a campaign, not
// coverage); workshops sit last so a phone campaign that happens to include one
// is not miscounted as teaching.
export function service(text: string): Service {
  const t = text.toLowerCase()
  if (has(t, /printing material|photo folder|laminated/)) return 'Print & resale'
  if (has(t, /licen[cs]|usage right|image right|exclusive right|buyout|non-exclusive/)) return 'Licensing & footage'
  if (has(t, /\bdrone|aerial|fpv/)) return 'Drone & aerial'
  if (
    has(
      t,
      /reel|tiktok|carousel|\bstor(y|ies)\b|posting|\bposts?\b|campaign|collab|influencer|\bkol\b|shout-?out|giveaway|retainer|promo content|creative content|content creation|teaser|feed post|all platforms|programme|\btour\b/,
    )
  )
    return 'Social campaign'
  if (
    has(
      t,
      /company dinner|event photograph|event coverage|conference|townhall|town hall|photographer|videographer|soft opening|roadshow|\bfair\b|ceremony|media coverage|\blaunch\b|portraits|photography \+ videography/,
    )
  )
    return 'Event coverage'
  if (has(t, /workshop|mobilegraphy|course|training/)) return 'Workshops'
  if (has(t, /production|video shoot|cinematic|cinemagic|feature video|editing|footage|raw file|raw clip|\bnye\b|countdown|fireworks/))
    return 'Production'
  return 'Other'
}

export function sector(text: string): Sector {
  const t = text.toLowerCase()
  if (
    has(
      t,
      /playstation|marvel|wolverine|astro|cineplex|miss intercontinental|pageant|band rehearsal|rave festival|stargather|fashion journal|malaysiatalk|borneotalk/,
    )
  )
    return 'Media & entertainment'
  if (has(t, /\bbyd\b|mg motors|\bgwm\b|tank 500|isuzu|mitsubishi|carsome|proton|tesla|bridgestone|mudah|autoshow|\bxg coating\b/))
    return 'Automotive'
  if (
    has(
      t,
      /xiaomi|redmi|realme|oppo|\bvivo\b|honor|huawei|samsung|galaxy|pixel|oneplus|one plus|asus|aorus|\brog\b|gigabyte|canon|sony|anker|soundcore|insta360|ricoh|mova|kaadas|70mai|dasher|roborock|varlens|gopro|coway|senheng|expertbook|pura70|\bp60\b|\bnord\b|reno|magic ?8|magic ?5|\bcbs monitor\b|inqubi|gadget/,
    )
  )
    return 'Consumer tech'
  if (
    has(
      t,
      /tourism|tourist|\btravel\b|klook|trip\.com|trip go|trip online|visit singapore|mandai|river hongbao|songkran|thailand|uzbekistan|tajikistan|sandakan|matta|sedunia|saudia|cameron|bentong|glamping|hobbitoon|resort|erya|roamingman|embassy|taiwan|lucky land|shandong|fuzhou|disneyland|borneo safari|safari|okinawa|vsing|central forest spine|iccfs/,
    )
  )
    return 'Travel & tourism'
  if (
    has(
      t,
      /celcomdigi|celcom|\bdigi\b|bigpay|\brhb\b|\bcimb\b|sunlife|etiqa|\bhata\b|\btng\b|touch ?'?n ?go|public bank|maybank|insurance|securities|conservation|pay with debit/,
    )
  )
    return 'Finance & telco'
  if (
    has(
      t,
      /lazada|shopee|shopback|harvey norman|foodpanda|colegacy|\becco\b|urban republic|pak john|\bteva\b|practicum|craftla|grand bazaar|mitsui|outlet|sunsilk|axis-?y/,
    )
  )
    return 'Retail & commerce'
  if (
    has(
      t,
      /gamuda|splashmania|discovery park|\bioi\b|w kuala lumpur|wkualalumpur|merdeka 118|klcc|tower 3|pavilion|great eastern|ecoworld|\bbbcc\b|lumen|genting|brightton|lot ?94|putrajaya|sultan abdul samad|kl tower|\btrx\b|exchange 106|wolo|thean hou|saloma|pickleball|property|monorail|glass box|bridge|temple|sunjer/,
    )
  )
    return 'Property & places'
  if (
    has(
      t,
      /company dinner|townhall|town hall|conference|printing material|photo folder|petronas|indus viva|corporate|staff portrait|healthcare day/,
    )
  )
    return 'Corporate & B2B'
  return 'Other'
}

export const labelOf = (inv: Invoice, lens: Lens) =>
  lens === 'service' ? service(`${inv.no} ${inv.project}`) : sector(`${inv.no} ${inv.project} ${inv.client}`)

// ------------------------------------------------------------------ the basics

export type Book = {
  all: Invoice[] // every invoice, any currency
  rm: Invoice[] // ringgit only, oldest first
  today: string
}

export function openBook(rows: Rec[], now = new Date()): Book {
  const all = toInvoices(rows)
  return {
    all,
    rm: all.filter(i => i.currency === 'MYR').sort((a, b) => a.date.localeCompare(b.date)),
    today: now.toISOString().slice(0, 10),
  }
}

const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)

/** The same calendar day, `months` months earlier. Used for rolling windows. */
export function shift(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 - months, d)).toISOString().slice(0, 10)
}

const between = (xs: Invoice[], after: string, until: string) => xs.filter(i => i.date > after && i.date <= until)

// ------------------------------------------------------------------------ KPIs

export type Kpi = {
  key: string
  label: string
  value: number
  /** Percent change against the comparison window. `null` when there is nothing to compare. */
  delta: number | null
  /** Which direction is the good one — decides the colour of the arrow. */
  better: 'up' | 'down'
  /** One line of plain English saying what the number means. */
  note: string
  unit: 'rm' | 'percent'
  href?: string
}

export function headline(book: Book) {
  const { rm, today } = book
  const t12 = between(rm, shift(today, 12), today)
  const p12 = between(rm, shift(today, 24), shift(today, 12))
  const revenue = sum(t12)
  const prior = sum(p12)
  const avg = t12.length ? revenue / t12.length : 0
  const priorAvg = p12.length ? prior / p12.length : 0

  // Concentration: how much of the last year leaned on the five biggest payers.
  // Rising concentration is the quiet risk in a one-person business.
  const byClient = new Map<string, number>()
  for (const i of t12) byClient.set(i.client, (byClient.get(i.client) ?? 0) + i.amount)
  const ranked = [...byClient.entries()].sort((a, b) => b[1] - a[1])
  const top5 = ranked.slice(0, 5).reduce((s, [, v]) => s + v, 0)
  const concentration = revenue ? (top5 / revenue) * 100 : 0

  const byClientPrior = new Map<string, number>()
  for (const i of p12) byClientPrior.set(i.client, (byClientPrior.get(i.client) ?? 0) + i.amount)
  const priorTop5 = [...byClientPrior.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).reduce((s, [, v]) => s + v, 0)
  const priorConcentration = prior ? (priorTop5 / prior) * 100 : 0

  // Returning revenue: money from clients who had already invoiced before this
  // window opened. The share that says whether relationships are compounding.
  const windowStart = shift(today, 12)
  const firstSeen = new Map<string, string>()
  for (const i of rm) if (!firstSeen.has(i.client)) firstSeen.set(i.client, i.date)
  const returning = t12.filter(i => (firstSeen.get(i.client) ?? i.date) <= windowStart)
  const returningShare = revenue ? (sum(returning) / revenue) * 100 : 0

  const priorStart = shift(today, 24)
  const priorReturning = p12.filter(i => (firstSeen.get(i.client) ?? i.date) <= priorStart)
  const priorReturningShare = prior ? (sum(priorReturning) / prior) * 100 : 0

  const pc = (now: number, was: number) => (was ? ((now - was) / was) * 100 : null)

  const kpis: Kpi[] = [
    {
      key: 'revenue',
      label: 'Invoiced, last 12 months',
      value: revenue,
      delta: pc(revenue, prior),
      better: 'up',
      unit: 'rm',
      note: `${t12.length} invoices, against ${p12.length} the year before`,
      href: '/invoices',
    },
    {
      key: 'average',
      label: 'Average invoice',
      value: avg,
      delta: pc(avg, priorAvg),
      better: 'up',
      unit: 'rm',
      note: priorAvg ? `was RM ${Math.round(priorAvg).toLocaleString('en-MY')} the year before` : 'no prior year to compare',
      href: '/invoices',
    },
    {
      key: 'concentration',
      label: 'Top 5 clients’ share',
      value: concentration,
      delta: pc(concentration, priorConcentration),
      better: 'down',
      unit: 'percent',
      note: `${ranked.length} clients invoiced in the last 12 months`,
      href: '/clients',
    },
    {
      key: 'returning',
      label: 'From returning clients',
      value: returningShare,
      delta: pc(returningShare, priorReturningShare),
      better: 'up',
      unit: 'percent',
      note: `${new Set(returning.map(i => i.client)).size} of them had hired you before`,
      href: '/clients',
    },
  ]

  return { kpis, revenue, prior, count: t12.length, priorCount: p12.length, concentration, returningShare, t12, p12 }
}

// ------------------------------------------------------- category over time 📈

export type MixBucket = { period: string; label: string; total: number; parts: { name: string; value: number }[] }

/**
 * Revenue split by category, period by period — the chart that answers "what
 * kind of work am I actually doing now, and how has that moved?".
 * `grain` is 'year' for the long arc or 'quarter' for the recent detail.
 */
export function mixOverTime(book: Book, lens: Lens, grain: 'year' | 'quarter' = 'year', limit = 8): MixBucket[] {
  const key = (d: string) =>
    grain === 'year' ? d.slice(0, 4) : `${d.slice(0, 4)}-Q${Math.floor(Number(d.slice(5, 7) as unknown as number) / 3.01) + 1}`
  const buckets = new Map<string, Map<string, number>>()
  const overall = new Map<string, number>()
  for (const i of book.rm) {
    const k = key(i.date)
    const name = labelOf(i, lens)
    const b = buckets.get(k) ?? new Map<string, number>()
    b.set(name, (b.get(name) ?? 0) + i.amount)
    buckets.set(k, b)
    overall.set(name, (overall.get(name) ?? 0) + i.amount)
  }
  // Stack in the SAME order in every column — biggest category all-time at the
  // bottom — so a colour sits at the same height year to year and the eye can
  // follow one band across the chart. Sorting each column by its own size would
  // make the blocks jump around and the trend unreadable.
  const rank = (name: string) => -(overall.get(name) ?? 0)
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-limit)
    .map(([period, parts]) => ({
      period,
      label: grain === 'year' ? period : period.replace('-', ' '),
      total: [...parts.values()].reduce((s, v) => s + v, 0),
      parts: [...parts.entries()]
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => rank(a.name) - rank(b.name)),
    }))
}

export type CategoryLine = {
  name: string
  total: number
  count: number
  average: number
  /** Share of the last 12 months, and of the 12 before it — the trend that matters. */
  shareNow: number
  sharePrior: number
  rmNow: number
  rmPrior: number
}

/** Every category, with how it is doing now versus the year before. */
export function categories(book: Book, lens: Lens): CategoryLine[] {
  const { rm, today } = book
  const t12 = between(rm, shift(today, 12), today)
  const p12 = between(rm, shift(today, 24), shift(today, 12))
  const now = sum(t12)
  const was = sum(p12)

  const names = new Set(rm.map(i => labelOf(i, lens)))
  return [...names]
    .map(name => {
      const mine = rm.filter(i => labelOf(i, lens) === name)
      const a = t12.filter(i => labelOf(i, lens) === name)
      const b = p12.filter(i => labelOf(i, lens) === name)
      return {
        name,
        total: sum(mine),
        count: mine.length,
        average: mine.length ? sum(mine) / mine.length : 0,
        shareNow: now ? (sum(a) / now) * 100 : 0,
        sharePrior: was ? (sum(b) / was) * 100 : 0,
        rmNow: sum(a),
        rmPrior: sum(b),
      }
    })
    .sort((x, y) => y.rmNow - x.rmNow || y.total - x.total)
}

// ------------------------------------------------------------- client movement

export type Mover = { client: string; now: number; was: number; delta: number; last: string }

/** Who grew and who went quiet, this year to date against the same days last year. */
export function movers(book: Book): { up: Mover[]; down: Mover[] } {
  const { rm, today } = book
  const year = Number(today.slice(0, 4))
  const tail = today.slice(4) // '-MM-DD'
  const thisYTD = rm.filter(i => i.date >= `${year}-01-01` && i.date <= today)
  const lastYTD = rm.filter(i => i.date >= `${year - 1}-01-01` && i.date <= `${year - 1}${tail}`)

  const tally = (xs: Invoice[]) => {
    const m = new Map<string, number>()
    for (const i of xs) m.set(i.client, (m.get(i.client) ?? 0) + i.amount)
    return m
  }
  const a = tally(thisYTD)
  const b = tally(lastYTD)
  const last = new Map<string, string>()
  for (const i of rm) last.set(i.client, i.date)

  const rows: Mover[] = [...new Set([...a.keys(), ...b.keys()])].map(client => {
    const now = a.get(client) ?? 0
    const was = b.get(client) ?? 0
    return { client, now, was, delta: now - was, last: last.get(client) ?? '' }
  })
  return {
    up: rows.filter(r => r.delta > 0).sort((x, y) => y.delta - x.delta).slice(0, 6),
    down: rows.filter(r => r.delta < 0).sort((x, y) => x.delta - y.delta).slice(0, 6),
  }
}

export type Dormant = { client: string; lifetime: number; last: string; monthsQuiet: number; jobs: number }

/**
 * Clients worth money who have not booked in a while — the call list.
 * Deliberately narrow: still warm (quiet between `quietMonths` and `coldAfter`
 * months) and worth the call (`floor` or more spent). A client who last hired
 * you four years ago is history, not a lead, and padding the list with them
 * would make the number on the Dashboard meaningless.
 */
export function dormant(book: Book, quietMonths = 12, floor = 5000, coldAfter = 36): Dormant[] {
  const { rm, today } = book
  const cut = shift(today, quietMonths)
  const cold = shift(today, coldAfter)
  const lifetime = new Map<string, number>()
  const last = new Map<string, string>()
  const jobs = new Map<string, number>()
  for (const i of rm) {
    lifetime.set(i.client, (lifetime.get(i.client) ?? 0) + i.amount)
    jobs.set(i.client, (jobs.get(i.client) ?? 0) + 1)
    if (!last.has(i.client) || i.date > last.get(i.client)!) last.set(i.client, i.date)
  }
  const months = (from: string) => {
    const [y1, m1] = from.split('-').map(Number)
    const [y2, m2] = today.split('-').map(Number)
    return (y2 - y1) * 12 + (m2 - m1)
  }
  return [...lifetime.entries()]
    .filter(([c, v]) => {
      const seen = last.get(c) ?? ''
      return v >= floor && seen <= cut && seen > cold
    })
    .map(([client, v]) => ({
      client,
      lifetime: v,
      last: last.get(client)!,
      monthsQuiet: months(last.get(client)!),
      jobs: jobs.get(client) ?? 0,
    }))
    .sort((a, b) => b.lifetime - a.lifetime)
}

// --------------------------------------------------------------- rhythm ⏱️

export type MonthCell = { month: string; label: string; year: string; total: number; count: number }

/** The last `n` calendar months, gaps included, so empty months show as empty. */
export function rhythm(book: Book, n = 24): MonthCell[] {
  const { rm, today } = book
  const out: MonthCell[] = []
  const [y0, m0] = today.split('-').map(Number)
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(Date.UTC(y0, m0 - 1 - k, 1))
    const key = d.toISOString().slice(0, 7)
    const mine = rm.filter(i => i.date.startsWith(key))
    out.push({
      month: key,
      label: d.toLocaleString('en-MY', { month: 'short', timeZone: 'UTC' }),
      year: key.slice(0, 4),
      total: sum(mine),
      count: mine.length,
    })
  }
  return out
}

export type SeasonCell = { month: number; label: string; total: number; count: number; average: number; years: number }

/** Which months of the year actually pay, averaged across every full year on record. */
export function seasonality(book: Book): SeasonCell[] {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const yearsSeen = new Set(book.rm.map(i => i.date.slice(0, 4)))
  return names.map((label, idx) => {
    const mine = book.rm.filter(i => Number(i.date.slice(5, 7)) === idx + 1)
    const total = sum(mine)
    return {
      month: idx + 1,
      label,
      total,
      count: mine.length,
      average: yearsSeen.size ? total / yearsSeen.size : 0,
      years: yearsSeen.size,
    }
  })
}

// ------------------------------------------------------------------- signals 🔔

export type Signal = {
  id: string
  level: 'risk' | 'chance' | 'note'
  headline: string
  detail: string
  /** Ringgit at stake, for ranking and for the right-hand column. `null` hides the figure. */
  money: number | null
  href?: string
  cta?: string
}

/**
 * What an analyst would put in front of you first. Every signal is derived, and
 * only fires when the data actually crosses the threshold — an empty list here
 * means there is genuinely nothing demanding attention, and the page says so.
 */
export function signals(book: Book): Signal[] {
  const out: Signal[] = []
  const h = headline(book)
  const quiet = dormant(book)
  const cells = rhythm(book, 24)
  const rmFmt = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`

  if (quiet.length) {
    const pot = quiet.reduce((s, d) => s + d.lifetime, 0)
    out.push({
      id: 'dormant',
      level: 'chance',
      headline: `${quiet.length} paying clients have gone quiet`,
      detail: `${quiet
        .slice(0, 3)
        .map(d => `${d.client.replace(/ (Sdn\.? ?Bhd\.?|Pte\.? ?Ltd\.?|Berhad)$/i, '')} (${rmFmt(d.lifetime)}, ${d.monthsQuiet} months)`)
        .join(', ')}${quiet.length > 3 ? ' and others' : ''}. They already know your work.`,
      money: pot,
      href: '/clients',
      cta: 'See the call list',
    })
  }

  if (h.concentration >= 40) {
    out.push({
      id: 'concentration',
      level: 'risk',
      headline: `Your five biggest clients are ${h.concentration.toFixed(0)}% of the year`,
      detail:
        'If one of them pauses, the gap is hard to replace quickly. Worth widening the base while the year is strong.',
      money: (h.concentration / 100) * h.revenue,
      href: '/clients',
      cta: 'See client spread',
    })
  }

  // The month we are standing in is not finished, so it cannot be a "gap" yet.
  const thisMonth = book.today.slice(0, 7)
  const empty = cells.filter(c => c.count === 0 && c.month !== thisMonth)
  if (empty.length >= 3) {
    out.push({
      id: 'gaps',
      level: 'risk',
      headline: `${empty.length} of the last two years’ months had no invoice at all`,
      detail: `Nothing was raised in ${empty
        .slice(-3)
        .map(c => `${c.label} ${c.year}`)
        .join(', ')}. Work usually happened — the invoice simply came later, in a batch.`,
      money: null,
      href: '/invoices',
      cta: 'Check invoicing',
    })
  }

  // Lowest-yield work: the category earning least per job, when there is a
  // meaningfully better option to spend the same day on.
  const cats = categories(book, 'service').filter(c => c.count >= 4)
  if (cats.length >= 2) {
    const best = [...cats].sort((a, b) => b.average - a.average)[0]
    const worst = [...cats].sort((a, b) => a.average - b.average)[0]
    if (best.average > worst.average * 1.5) {
      out.push({
        id: 'yield',
        level: 'note',
        headline: `${worst.name} earns ${rmFmt(worst.average)} a job, ${worst.name === best.name ? '' : `against ${rmFmt(best.average)} for ${best.name}`}`,
        detail: `${worst.count} ${worst.name.toLowerCase()} jobs on record. Same day of your time, very different return.`,
        money: null,
        href: '/invoices',
        cta: 'Compare work types',
      })
    }
  }

  const order = { risk: 0, chance: 1, note: 2 } as const
  return out.sort((a, b) => order[a.level] - order[b.level] || (b.money ?? 0) - (a.money ?? 0))
}

// ------------------------------------------------------------------ everything

export function operatingPicture(rows: Rec[], now = new Date()) {
  const book = openBook(rows, now)
  const h = headline(book)
  return {
    book,
    ...h,
    signals: signals(book),
    movers: movers(book),
    dormant: dormant(book),
    rhythm: rhythm(book, 24),
    seasonality: seasonality(book),
    clientCount: new Set(book.all.map(i => i.client)).size,
    invoiceCount: book.all.length,
    rmInvoiceCount: book.rm.length,
    lifetime: book.rm.reduce((s, i) => s + i.amount, 0),
    firstInvoice: book.rm[0]?.date,
  }
}
