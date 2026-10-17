// 👉 The social platforms, in one list. Every cross-platform surface (/social, the Dashboard's
// audience band, their charts, filters and legends) loops over this — nothing else names a
// platform. Client-safe: no imports, so client charts read it too.
//
// Adding a platform (YouTube, Threads, Xiaohongshu are reserved below):
//   1. its fetch/refresh/history tables, as Facebook and TikTok did (lib/fb-*, lib/tt-*);
//   2. an adapter in lib/v3/social.ts that turns its stored rows into a `Source`;
//   3. its own page and a nav line (V3Nav, Nav, BottomNav) — `href` below;
//   4. nothing else: tables, charts, legends, filters and totals pick it up from the source.
//
// Colour: each platform owns ONE fixed slot (--p-<id> in app/_v3/v3.css), so a filter that
// hides one never repaints the others. The six were validated together (dataviz validator,
// light #FFFFFF and dark #111113 surfaces): every adjacent pair clears the normal-vision
// floor; the weakest colour-blind pair (red ↔ aqua) sits in the 6–8 band, which is why every
// stack has a 2px gap, a legend and a hover readout. Never generate a seventh hue — fold extras
// into "Other".

export type PlatformId = 'ig' | 'fb' | 'tt' | 'yt' | 'th' | 'xhs'

export type PlatformMeta = {
  id: PlatformId
  name: string
  href: string
  /** What the platform calls one item. */
  noun: string
  /** The platform's own unique-people figure, if it has one: Instagram "reach", Facebook "viewers". */
  people: string | null
}

/** Colour-slot and stacking order — fixed. */
export const PLATFORM_ORDER: PlatformId[] = ['ig', 'fb', 'tt', 'yt', 'th', 'xhs']

export const PLATFORM: Record<PlatformId, PlatformMeta> = {
  ig: { id: 'ig', name: 'Instagram', href: '/instagram', noun: 'post', people: 'reach' },
  fb: { id: 'fb', name: 'Facebook', href: '/facebook', noun: 'post', people: 'viewers' },
  tt: { id: 'tt', name: 'TikTok', href: '/tiktok', noun: 'video', people: null },
  // Reserved: not connected yet. Their slots and colours are kept so adding one repaints nothing.
  yt: { id: 'yt', name: 'YouTube', href: '/youtube', noun: 'video', people: null },
  th: { id: 'th', name: 'Threads', href: '/threads', noun: 'post', people: null },
  xhs: { id: 'xhs', name: 'Xiaohongshu', href: '/xiaohongshu', noun: 'note', people: null },
}

export const isPlatform = (v: unknown): v is PlatformId => typeof v === 'string' && v in PLATFORM

export const PLATFORM_NAME = Object.fromEntries(PLATFORM_ORDER.map(p => [p, PLATFORM[p].name])) as Record<PlatformId, string>

/** "Instagram, Facebook and TikTok" */
export const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''))
