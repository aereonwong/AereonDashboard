// 👉 The link-in-bio page at /hello (the link in Aereon's Instagram bio). Pure: shape,
// defaults and the cleaner that every save goes through. No I/O here, so the public page,
// the editor and the tests can all import it. Reading lives in lib/hello.ts, saving in
// lib/hello-actions.ts. Socials are NOT stored here — they come from lib/socials.ts, the
// same list the landing page and media kits use.
//
// Affiliate links will be their own group later (gear, codes, click counts); `links` is
// only for plain links today, so the future system can sit beside it without a migration.

export type HelloLink = { id: string; label: string; url: string; note: string; on: boolean }

export type HelloConfig = {
  /** One line under the name. */
  tagline: string
  /** Heading of the collab card. */
  collabTitle: string
  /** One sentence under it: what brands can book. */
  collabNote: string
  /** Quick-pick chips. Each opens the collab email with that topic in the subject. */
  topics: string[]
  links: HelloLink[]
}

export const LIMITS = { tagline: 90, collabTitle: 40, collabNote: 140, topic: 28, topics: 6, label: 48, note: 70, url: 500, links: 12 }

export const DEFAULT_HELLO: HelloConfig = {
  tagline: 'Tech & travel creator · drone pilot · Kuala Lumpur',
  collabTitle: 'Work with me',
  collabNote: 'Product reviews, hotel & travel features, aerial filming and launch campaigns.',
  topics: ['Product review', 'Travel & hotel', 'Aerial / drone', 'Event coverage'],
  links: [
    { id: 'kit', label: 'Media kit & past work', url: 'https://aereonwong.com/', note: 'Brands, reach and audience', on: true },
    { id: 'about', label: 'About the studio', url: 'https://aereonwong.com/about', note: 'SY Creative Production', on: true },
  ],
}

const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''

/** Only http(s) and mailto links, so a saved link can never run script (javascript:, data:). */
export function cleanUrl(v: unknown): string {
  const s = text(v, LIMITS.url)
  if (!s) return ''
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    return u.protocol === 'https:' || u.protocol === 'http:' || u.protocol === 'mailto:' ? u.toString() : ''
  } catch {
    return ''
  }
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24)

/** Anything in, a valid config out. Blank fields fall back to the defaults; bad links are dropped. */
export function cleanHello(raw: unknown): HelloConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const topics = (Array.isArray(r.topics) ? r.topics : DEFAULT_HELLO.topics)
    .map(t => text(t, LIMITS.topic)).filter(Boolean).slice(0, LIMITS.topics)
  const seen = new Set<string>()
  const links: HelloLink[] = []
  for (const l of (Array.isArray(r.links) ? r.links : DEFAULT_HELLO.links).slice(0, LIMITS.links)) {
    const o = (l && typeof l === 'object' ? l : {}) as Record<string, unknown>
    const label = text(o.label, LIMITS.label)
    const url = cleanUrl(o.url)
    if (!label || !url) continue
    let id = slug(text(o.id, 24)) || slug(label) || 'link'
    while (seen.has(id)) id = `${id}-x`
    seen.add(id)
    links.push({ id, label, url, note: text(o.note, LIMITS.note), on: o.on !== false })
  }
  return {
    tagline: text(r.tagline, LIMITS.tagline) || DEFAULT_HELLO.tagline,
    collabTitle: text(r.collabTitle, LIMITS.collabTitle) || DEFAULT_HELLO.collabTitle,
    collabNote: text(r.collabNote, LIMITS.collabNote) || DEFAULT_HELLO.collabNote,
    topics,
    links,
  }
}

/** The collab email, pre-filled so a brand sends a usable brief on the first try. */
export function collabMailto(email: string, topic?: string): string {
  const subject = topic ? `Collab enquiry: ${topic}` : 'Collab enquiry'
  const body = [
    'Hi Aereon,', '',
    `Brand / company: `,
    `What we'd like made${topic ? ` (${topic})` : ''}: `,
    'Dates or deadline: ',
    'Budget range: ', '',
    '(Found you through Instagram)',
  ].join('\n')
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
