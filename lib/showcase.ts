// 👉 The showcase: a spread of Aereon's work across every kind he makes, for the
// landing page and the media kits. The live feed alone is mostly recent KLCC
// content, so these picks come from two years of posts instead.
//
// No runtime imports on purpose — scripts/ig-archive.mjs loads this file with
// Node's type stripping, exactly like lib/ig-fetch.ts. The script fetches the
// archive, calls pickShowcase() and writes lib/showcase.json; pages only read it.

export type Kind = 'product' | 'event' | 'car' | 'hotel' | 'aerial' | 'travel'
export type Place = 'Malaysia' | 'Singapore' | 'Brunei' | 'Bali' | 'Abroad'

export type ArchivePost = {
  id: string
  timestamp: string
  type: string
  caption: string
  permalink?: string
  reach?: number
  views?: number
  likes: number
}

export type ShowcaseItem = {
  id: string
  permalink: string
  date: string // YYYY-MM-DD
  type: string
  label: string // what the tile says: "Car review", "Travel · Singapore"
  caption: string
  reach?: number
  /** Reach is printed only when the post did at least as well as a typical
   *  (median) post of the same two years — weaker tiles show their label alone. */
  showReach: boolean
  cover: string // /img/work/<id>.jpg — saved locally, Instagram's URLs expire
}

export type Showcase = {
  generated_at: string
  since: string
  posts: number // how many posts the two years held
  median_reach: number
  items: ShowcaseItem[]
}

// Order matters: a hotel stay in Dubai is a hotel review, not travel; a phone
// filmed at a launch is a product review; a drone SHOW is an event.
const RULES: [Kind, RegExp][] = [
  ['car', /\b(BYD|Honda|Proton|Perodua|Tesla|Toyota|Mercedes-Benz|BMW|Volvo|Zeekr|Chery|test drive|road trip with|one charge|EV lineup|car tint|my car|dream car|SUV|sedan)\b/i],
  ['hotel', /\b(hotel|staycation|resort|Shangri-La|Hyatt|Amari|Meridien|Marriott|Hilton|Sheraton|Westin|Ritz|Indigo|checked in|checking in|check-in|infinit[iy] pool|room tour|suite)\b|@\w*(hotel|shangrila|meridien|resort)\w*/i],
  ['product', /\b(unbox\w*|review|first impressions|hands[- ]on|iPhone|Galaxy|Samsung|HONOR|vivo|Xiaomi|TECNO|OPPO|Huawei|Insta360|DJI (?:Mavic|Avata|Mini|Osmo|RS|Pocket)|Mavic|Avata|GoPro|Sony|Canon|SSD|power ?bank|smart ?lock|Kaadas|slider|microphone|Hollyland|PGYTECH|MagCam|MagScreen|Skinarma|Shargeek|tablet|smartwatch|earbuds|speaker|Acton|Coway|MOVA|Anker|ADATA|Zeapon)\b/i],
  ['event', /\b(launch event|launch|activation|drone show|fireworks?|countdown|festival|celebrat\w+|concert|tour|summit|anniversary|F1|Grand Prix|Pok[eé]mon|exhibition|expo|fair|ceremony|awards?|projection|light show|parade|NYE|New Year'?s Eve)\b/i],
  ['aerial', /\b(from above|aerial|bird'?s[- ]eye|drone(?! show)|top ?down|hyperlapse)\b/i],
]

const PLACES: [Place, RegExp][] = [
  ['Brunei', /Brunei|🇧🇳|Bandar Seri Begawan/i],
  ['Bali', /\bBali\b|🇮🇩|Indonesia|East Java|Bromo|Tumpak Sewu|Ubud|Nusa Penida/i],
  ['Singapore', /Singapore|🇸🇬|Gardens by the Bay|Changi|Marina Bay|Sentosa/i],
  ['Abroad', /China|🇨🇳|Shanghai|Chongqing|Chengdu|Guizhou|Hangzhou|Sichuan|Jiuzhaigou|Guangzhou|Qingdao|Dubai|🇦🇪|Vietnam|🇻🇳|Hong Kong|🇭🇰|Thailand|🇹🇭|Japan|Korea|Taiwan/i],
  ['Malaysia', /Malaysia|🇲🇾|Kuala Lumpur|\bKL\b|KLCC|Penang|Sabah|Kota Kinabalu|Sarawak|Putrajaya|Genting|Langkawi|Melaka|Johor|Ipoh|Batu Caves|Merdeka 118|Bukit Bintang|\bTRX\b|Selangor|Kuantan/i],
]

/** Not work to show a brand: personal mishaps, giveaways and contests. */
const NOT_WORK = /vandali[sz]|incident|giveaway|lucky (draw|winners?)|chance to win|contest/i

/** KLCC is the recent run of content — the showcase allows it once at most. */
export const isKlcc = (caption: string) => /KLCC|Petronas Twin Towers|Twin Tower/i.test(caption)

// The kind is read from the opening of the caption only: further down, travel
// posts credit their gear ("📸 Sony ZV-E1"), which is not what the post is about.
export function classify(caption: string): { kind: Kind; place: Place | null } {
  const head = caption.slice(0, 120)
  const kind = RULES.find(([, re]) => re.test(head))?.[0] ?? 'travel'
  // The place named FIRST wins: "Shanghai, an hour from KL" is a Shanghai post.
  let place: Place | null = null
  let at = Infinity
  for (const [p, re] of PLACES) {
    const i = caption.search(re)
    if (i >= 0 && i < at) [place, at] = [p, i]
  }
  return { kind, place }
}

// One tile per slot, each the furthest-travelling post of its kind. The slots are
// exactly the work Aereon names: product reviews, events, car reviews, hotels,
// drone work and travel in Malaysia, Singapore, Brunei and Bali.
type Slot = { label: string; match: (k: Kind, p: Place | null, caption: string) => boolean }
const SLOTS: Slot[] = [
  { label: 'Product review', match: k => k === 'product' },
  { label: 'Event coverage', match: k => k === 'event' },
  { label: 'Car review', match: k => k === 'car' },
  { label: 'Hotel review', match: k => k === 'hotel' },
  // A drone SHOW is someone else's flying, so it stays an event, never this tile.
  { label: 'Aerial', match: (k, _p, c) => k === 'aerial' || /\bFPV\b|DJI (Mavic|Avata|Air|Mini)/i.test(c.slice(0, 120)) },
  { label: 'Travel · Singapore', match: (k, p) => k === 'travel' && p === 'Singapore' },
  { label: 'Travel · Bali', match: (k, p) => k === 'travel' && p === 'Bali' },
  { label: 'Travel · Brunei', match: (k, p) => k === 'travel' && p === 'Brunei' },
  { label: 'Travel · Malaysia', match: (k, p) => k === 'travel' && p === 'Malaysia' },
  { label: 'Travel · Abroad', match: (k, p) => k === 'travel' && p === 'Abroad' },
]

/** The showcase as Aereon arranged it (7 Oct 2026, F1 tile swapped 7 Oct): these posts, in this order,
 *  matched by the shortcode in the permalink. Five tiles a row, so 1 and 6 sit on
 *  the left — Malaysia leads both rows. While this list is set, ig-archive keeps
 *  it as is (refreshing reach and covers) instead of picking by reach; empty it to
 *  go back to the automatic pick below. */
export const CURATED: { code: string; label: string }[] = [
  { code: 'Dd6vuswzQyT', label: 'Event · PETRONAS F1 activation' },
  { code: 'DCyHLn_JUkC', label: 'Attraction · Malaysia' },
  { code: 'Db-LZ3_E6ai', label: 'Car review' },
  { code: 'DN-RN5ik1cq', label: 'Travel · Dubai' },
  { code: 'DeHa08gzD5n', label: 'Event · Nights of Fright' },
  { code: 'DUSV9BHkwXD', label: 'Tech review · Malaysia' },
  { code: 'DZeRAwVk3Ca', label: 'Travel · Brunei' },
  { code: 'DPYJt-bE9kZ', label: 'Travel · China' },
  { code: 'DEFUBR9J8HP', label: 'Travel · Singapore' },
  { code: 'DaNZnwATq7t', label: 'Travel · Bali' },
]

export const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  if (!s.length) return 0
  const m = s.length >> 1
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/**
 * Picks the showcase, then BLENDS it: tiles are ordered strongest, weakest,
 * second strongest, second weakest… so the kinds that travelled less sit between
 * the ones that travelled most instead of trailing at the end. Reach is printed
 * only on tiles at or above the two-year median — a weaker tile shows its label,
 * never a smaller number. Nothing is invented: a slot with no post is left out.
 */
export function pickShowcase(posts: ArchivePost[], limit = 10): Omit<ShowcaseItem, 'cover'>[] {
  const reached = posts.filter(p => p.reach !== undefined && p.permalink)
  const mid = median(reached.map(p => p.reach!))
  if (CURATED.length) {
    return CURATED.flatMap(c => {
      const hit = reached.find(p => p.permalink!.includes(c.code))
      return hit
        ? [{ id: hit.id, permalink: hit.permalink!, date: hit.timestamp.slice(0, 10), type: hit.type, label: c.label, caption: hit.caption.slice(0, 140), reach: hit.reach, showReach: hit.reach! >= mid }]
        : []
    })
  }
  const byReach = [...reached].sort((a, b) => b.reach! - a.reach!)
  const used = new Set<string>()
  let klcc = 0
  const picked: Omit<ShowcaseItem, 'cover'>[] = []
  for (const slot of SLOTS) {
    const hit = byReach.find(p => {
      if (used.has(p.id) || NOT_WORK.test(p.caption) || (klcc && isKlcc(p.caption))) return false
      const { kind, place } = classify(p.caption)
      return slot.match(kind, place, p.caption)
    })
    if (!hit) continue
    used.add(hit.id)
    if (isKlcc(hit.caption)) klcc++
    picked.push({
      id: hit.id,
      permalink: hit.permalink!,
      date: hit.timestamp.slice(0, 10),
      type: hit.type,
      label: slot.label,
      caption: hit.caption.slice(0, 140),
      reach: hit.reach,
      showReach: hit.reach! >= mid,
    })
  }
  const ranked = picked.slice(0, limit).sort((a, b) => b.reach! - a.reach!)
  const blended: typeof ranked = []
  for (let i = 0, j = ranked.length - 1; i <= j; i++, j--) {
    blended.push(ranked[i])
    if (i !== j) blended.push(ranked[j])
  }
  return blended
}
