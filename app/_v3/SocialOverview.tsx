import { PLATFORM, PLATFORM_NAME, and, type PlatformId } from '@/lib/v3/platforms'
import type { PlatformFigures, Social } from '@/lib/v3/social'
import PlatformChart from './PlatformChart'
import { compact, num } from './fmt'

// 👉 The all-platforms overview, shared by the Social page and the Dashboard's audience band:
// the platform-by-platform table, the legend, and the charts that compare every platform like
// for like. Server component — plain markup; the charts are client components fed plain data.
// Every platform comes from lib/v3/platforms.ts; nothing here names one.

export const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
export const ago = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}
export const windowName = (days: number) => (days === 365 ? '12 months' : `${days} days`)
export const names = (ids: PlatformId[]) => and(ids.map(p => PLATFORM_NAME[p]))

/** What "views" means in this window: each platform's own count (Stories and ads in), except
 *  platforms with no account count, which give the views of the window's posts. */
export const basisNote = (s: Social, lead = 'every view each platform counted') => {
  const posts = s.platforms.filter(f => f.basis === 'posts').map(f => f.id)
  return `${lead} — posts, Reels, Stories, ads${posts.length ? ` · ${names(posts)}: views so far of the window’s posts` : ''}`
}

/** A platform's colour swatch. */
export const Dot = ({ p }: { p: PlatformId }) => <i className="v3-soc-dot" data-p={p} aria-hidden="true" />

/** A thin bar split by platform. Any null (not read) leaves the bar out rather than misstate a share. */
export function Split({ values }: { values: Partial<Record<PlatformId, number | null>> }) {
  const parts = Object.keys(values) as PlatformId[]
  if (parts.length < 2 || parts.some(p => values[p] === null)) return <span className="v3-soc-split empty" aria-hidden="true" />
  const sum = parts.reduce((t, p) => t + (values[p] ?? 0), 0)
  if (!sum) return <span className="v3-soc-split empty" aria-hidden="true" />
  const words = parts.map(p => `${Math.round(((values[p] ?? 0) / sum) * 100)}% ${PLATFORM_NAME[p]}`)
  return (
    <span className="v3-soc-split" data-tip={`Share\n${words.join(' · ')}`} role="img" aria-label={words.join(', ')}>
      {parts.map(p => (
        <i key={p} data-p={p} style={{ ['--w' as string]: ((values[p] ?? 0) / sum).toFixed(3) }} />
      ))}
    </span>
  )
}

type Row = { label: string; note?: string; cell: (f: PlatformFigures) => string; split?: (f: PlatformFigures) => number | null }

export function Compare({ s }: { s: Social }) {
  const w = windowName(s.days)
  const rows: Row[] = [
    { label: 'Followers', cell: f => num(f.followers), split: f => f.followers },
    { label: 'Change, 30 days', note: 'followed less unfollowed', cell: f => (f.net30 !== null ? signed(f.net30) : 'building history') },
    { label: 'Posts', note: `published in the last ${w}`, cell: f => `${f.posts} · ${f.perWeek.toFixed(1)}/wk`, split: f => f.posts },
    {
      label: 'Views',
      note: `last ${w} · ${basisNote(s, 'the platform’s own count')}`,
      cell: f => (f.views !== null ? compact(f.views) : '—') + (f.basis === 'posts' && f.unread ? ` (${f.unread} unread)` : ''),
      split: f => f.views,
    },
    { label: 'Typical post', note: 'median views per post published in the window', cell: f => (f.typical ? compact(f.typical) : '—') },
    { label: 'Interactions', note: 'likes, comments, shares, saves, replies · Facebook adds clicks', cell: f => (f.interactions !== null ? compact(f.interactions) : '—'), split: f => f.interactions },
    { label: 'Engagement rate', note: 'interactions per 100 views, same count', cell: f => (f.rate !== null ? `${f.rate.toFixed(1)}%` : '—') },
    { label: 'Hits', note: 'posts at 2× the typical or more', cell: f => (f.posts ? `${f.hits} of ${f.posts - f.unread}` : '—') },
    {
      label: 'People reached',
      note: 'the platform’s own unique count, its own window',
      cell: f => (!f.people ? 'not measured' : f.people.value !== null ? `${compact(f.people.value)} · ${f.people.window}d` : '—'),
    },
    { label: 'Last post', cell: f => ago(f.lastPost) },
  ]
  const ps = s.platforms
  return (
    <div className="v3-soc-table" role="table" aria-label={`${names(s.ids)} side by side`} style={{ ['--cols' as string]: ps.length }}>
      <div className="v3-soc-tr head" role="row">
        <span role="columnheader" />
        {ps.map(f => (
          <span key={f.id} role="columnheader">
            <a href={PLATFORM[f.id].href}>
              <Dot p={f.id} />
              {PLATFORM_NAME[f.id]}
            </a>
            {!f.fresh ? <small className="v3-soc-stale">reading over a week old</small> : null}
          </span>
        ))}
        <span role="columnheader">Share</span>
      </div>
      {rows.map(r => (
        <div key={r.label} className="v3-soc-tr" role="row">
          <span role="rowheader">
            {r.label}
            {r.note ? <small>{r.note}</small> : null}
          </span>
          {ps.map(f => (
            <span key={f.id} role="cell" className="num">
              {r.cell(f)}
            </span>
          ))}
          <span role="cell">{r.split ? <Split values={Object.fromEntries(ps.map(f => [f.id, r.split!(f)]))} /> : null}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ ids, suffix }: { ids: PlatformId[]; suffix?: Partial<Record<PlatformId, string>> }) {
  return (
    <div className="v3-legend">
      {ids.map(p => (
        <span key={p}>
          <Dot p={p} />
          {PLATFORM_NAME[p]}
          {suffix?.[p] ? ` ${suffix[p]}` : ''}
        </span>
      ))}
    </div>
  )
}

/** Views earned by each month's posts, stacked by platform — the like-for-like chart. */
export function MonthsChart({ s }: { s: Social }) {
  return (
    <>
      <PlatformChart kind="stack" unit="views" ids={s.ids} points={s.months} />
      <Legend ids={s.ids} />
    </>
  )
}

/** Followers gained per platform, last 90 days — indexed to each line's first reading. */
export function FollowersChart({ s }: { s: Social }) {
  return (
    <>
      <PlatformChart kind="lines" signed unit="followers gained" dates ids={s.ids} points={s.followers} levels={s.level} />
      <Legend ids={s.ids} />
    </>
  )
}

/** People reached per day, platforms that report it. */
export function PeopleChart({ s }: { s: Social }) {
  const ids = s.ids.filter(p => PLATFORM[p].people)
  return (
    <>
      <PlatformChart kind="stack" unit="people reached (platform total)" dates ids={ids} points={s.people} />
      <Legend ids={ids} suffix={Object.fromEntries(ids.map(p => [p, PLATFORM[p].people!]))} />
    </>
  )
}

/** Posts per week, stacked by platform. */
export function WeeksChart({ s }: { s: Social }) {
  return (
    <>
      <PlatformChart kind="stack" unit="posts" dates ids={s.ids} points={s.weeks} />
      <Legend ids={s.ids} />
    </>
  )
}
