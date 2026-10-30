import type { Rec } from '@/lib/records'
import { toInvoices, type Invoice, type WorkKind } from '@/lib/invoices'
import { inRange, narrow, type Filters } from './filters'

// 👉 The numbers behind v3's Clients page. Same rules as the
// Dashboard: ringgit only in totals, foreign currency reported alongside, and
// every figure from the records.


const sum = (xs: Invoice[]) => xs.reduce((s, i) => s + i.amount, 0)
const rmOnly = <T extends Invoice>(xs: T[]) => xs.filter(i => i.currency === 'MYR')

// ---------------------------------------------------------------- clients

export type Relationship = {
  client: string
  contact?: string
  address?: string
  lifetime: number // ringgit, all time
  jobs: number
  inRange: number // ringgit inside the chosen range
  first: string
  last: string
  monthsQuiet: number
  kinds: WorkKind[]
  foreign: { currency: string; total: number }[]
  quadrant: 'nurture' | 'repitch' | 'new' | 'drifted'
}

export type ClientSort = 'value' | 'recent' | 'quiet' | 'jobs' | 'name'

const monthsSince = (iso: string, today: string) =>
  Math.max(0, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / (86_400_000 * 30.44)))

import { QUIET_MONTHS } from './catalog'
import { todayISO } from '@/lib/today'
export { QUIET_MONTHS }

export function buildRelationships(
  recs: Rec[],
  f: Filters,
  sort: ClientSort = 'value',
  q = '',
  today = todayISO(),
): { list: Relationship[]; median: number; stats: { clients: number; repeat: number; quiet: number; average: number; repeatShare: number } } {
  const all = toInvoices(recs)
  const inR = inRange(all, f)
  const active = new Set(inR.map(i => i.client))
  const scope = narrow(all, f).filter(i => active.has(i.client))

  const groups = new Map<string, Invoice[]>()
  for (const i of scope) groups.set(i.client, [...(groups.get(i.client) ?? []), i])

  let list: Relationship[] = [...groups.entries()]
    .filter(([c]) => c && c !== '—')
    .map(([client, xs]) => {
      const dates = xs.map(x => x.date).sort()
      const rm = rmOnly(xs)
      const fx = new Map<string, number>()
      for (const x of xs.filter(x => x.currency !== 'MYR')) fx.set(x.currency, (fx.get(x.currency) ?? 0) + x.amount)
      const withContact = xs.find(x => x.contact)
      const withAddress = xs.find(x => x.address)
      return {
        client,
        contact: withContact?.contact,
        address: withAddress?.address,
        lifetime: sum(rm),
        jobs: xs.length,
        inRange: sum(rmOnly(inR.filter(i => i.client === client))),
        first: dates[0],
        last: dates.at(-1)!,
        monthsQuiet: monthsSince(dates.at(-1)!, today),
        kinds: [...new Set(xs.map(x => x.kind))],
        foreign: [...fx.entries()].map(([currency, total]) => ({ currency, total })),
        quadrant: 'new' as Relationship['quadrant'],
      }
    })

  const values = list.map(c => c.lifetime).sort((a, b) => a - b)
  // The true median (mean of the two middle values on an even count), the same as every other "typical" in the app.
  const mid = values.length >> 1
  const median = !values.length ? 0 : values.length % 2 ? values[mid] : (values[mid - 1] + values[mid]) / 2
  list = list.map(c => {
    const high = c.lifetime >= median
    const quiet = c.monthsQuiet >= QUIET_MONTHS
    return { ...c, quadrant: high ? (quiet ? 'repitch' : 'nurture') : quiet ? 'drifted' : 'new' }
  })

  const needle = q.trim().toLowerCase()
  const shown = needle
    ? list.filter(c => `${c.client} ${c.contact ?? ''} ${c.kinds.join(' ')}`.toLowerCase().includes(needle))
    : list
  shown.sort((a, b) =>
    sort === 'recent'
      ? b.last.localeCompare(a.last)
      : sort === 'quiet'
        ? b.monthsQuiet - a.monthsQuiet
        : sort === 'jobs'
          ? b.jobs - a.jobs
          : sort === 'name'
            ? a.client.localeCompare(b.client)
            : b.lifetime - a.lifetime,
  )

  const total = list.reduce((s, c) => s + c.lifetime, 0)
  const repeatList = list.filter(c => c.jobs > 1)
  return {
    list: shown,
    median,
    stats: {
      clients: list.length,
      repeat: repeatList.length,
      quiet: list.filter(c => c.monthsQuiet >= QUIET_MONTHS).length,
      average: list.length ? total / list.length : 0,
      repeatShare: total ? repeatList.reduce((s, c) => s + c.lifetime, 0) / total : 0,
    },
  }
}
