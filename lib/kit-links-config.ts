// 👉 Private share links for the media kit: aereonwong.com/mediakit?r=<code>. The code is random, so a
// brand reading the link learns nothing; which brand it was made for lives only in the database
// (one `records` row, doc / setting / title 'kit-links', like the /hello settings) and is shown only
// on Site analytics → Media kit. Pure and import-free so the tests can load it.

export type KitLink = { code: string; brand: string; note: string; created: string }
export type KitLinks = { links: KitLink[] }

/** No 0/o, 1/l/i: a code read aloud or retyped from a screenshot still works. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
export const CODE = /^[a-hj-km-np-z2-9]{6}$/

/** A fresh code that is not in `taken`. `rand` returns bytes (crypto.getRandomValues in practice). */
export function newCode(taken: Set<string>, rand: (n: number) => Uint8Array): string {
  for (;;) {
    const b = rand(6)
    const c = [...b].map(x => ALPHABET[x % ALPHABET.length]).join('')
    if (!taken.has(c)) return c
  }
}

const text = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '')

/** Only well-formed rows survive, newest first, one per code. */
export function cleanKitLinks(input: unknown): KitLinks {
  const raw = (input && typeof input === 'object' && Array.isArray((input as KitLinks).links)) ? (input as KitLinks).links : []
  const seen = new Set<string>()
  const links: KitLink[] = []
  for (const l of raw) {
    if (!l || typeof l !== 'object') continue
    const code = typeof l.code === 'string' ? l.code : ''
    const brand = text(l.brand, 60)
    if (!CODE.test(code) || !brand || seen.has(code)) continue
    seen.add(code)
    const created = typeof l.created === 'string' && /^\d{4}-\d\d-\d\d/.test(l.created) ? l.created.slice(0, 10) : ''
    links.push({ code, brand, note: text(l.note, 120), created })
  }
  return { links: links.sort((a, b) => b.created.localeCompare(a.created)) }
}

export const kitUrl = (code: string) => `https://aereonwong.com/mediakit?r=${code}`
