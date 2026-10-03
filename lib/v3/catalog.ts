// 👉 The version catalogue (and v3's one world) — pure data, safe to import from client
// components (Settings) as well as the server. Reading the cookie lives in version.ts.

export type Version = 'v1' | 'v2' | 'v3'
/** v3 has one look since 3 Oct 2026: Studio Standard. Contact Sheet and Flight HUD were removed. */
export type World = 'canon'

export const VERSIONS: { id: Version; name: string; date: string; note: string }[] = [
  {
    id: 'v3',
    name: 'Creator studio',
    date: '26 Sep 2026',
    note: 'A full redesign around your three questions: on track, audience, and who owes you. Filters, charts and a News desk, in Studio Standard.',
  },
  {
    id: 'v2',
    name: 'Operating picture',
    date: '21 Sep 2026',
    note: 'Built for decisions: how the year is tracking, what needs attention, which work is growing, and who has gone quiet.',
  },
  {
    id: 'v1',
    name: 'Creator view',
    date: '19 Sep 2026',
    note: 'The original: your portrait and headline numbers, last six months, top clients and Instagram.',
  },
]

export const WORLDS: { id: World; name: string; note: string }[] = [
  {
    id: 'canon',
    name: 'Studio Standard',
    note: 'A clean modern analytics dashboard at the craft level of Stripe and Linear. Follows your light and dark setting.',
  },
]

/** How many days of unconfirmed invoices count as "probably still owed". */
export const OWED_WINDOW_DAYS = 120

/** Quiet for this many months counts as "gone quiet" on the relationship map. */
export const QUIET_MONTHS = 6
