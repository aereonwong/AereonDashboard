import { PLATFORMS, PLATFORM_NAME, type Platform, type PlatformFigures, type Social } from '@/lib/v3/social'
import PlatformChart from './PlatformChart'
import { compact, num } from './fmt'

// 👉 The all-platforms overview, shared by the Social page and the Dashboard's audience band:
// the platform-by-platform table and the two charts that compare all three like for like.
// Server component — plain markup; the charts are client components fed plain data.

const signed = (n: number) => `${n >= 0 ? '+' : ''}${num(n)}`
const ago = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`
}

/** Platforms on show: Instagram and Facebook always (the page explains an empty one), TikTok once connected. */
export const shown = (s: Social): Platform[] => PLATFORMS.filter(p => p !== 'tt' || s.hasTt)

/** A thin bar split by platform. Values that are null (not measured, or stale) leave the bar out. */
export function Split({ values }: { values: Partial<Record<Platform, number | null>> }) {
  const parts = PLATFORMS.filter(p => p in values)
  if (parts.some(p => values[p] === null)) return <span className="v3-soc-split empty" aria-hidden="true" />
  const sum = parts.reduce((t, p) => t + (values[p] ?? 0), 0)
  if (!sum) return <span className="v3-soc-split empty" aria-hidden="true" />
  const words = parts.map(p => `${Math.round(((values[p] ?? 0) / sum) * 100)}% ${PLATFORM_NAME[p]}`)
  return (
    <span className="v3-soc-split" data-tip={`Split\n${words.join(' · ')}`} role="img" aria-label={words.join(', ')}>
      {parts.map(p => (
        <i key={p} className={p} style={{ ['--w' as string]: ((values[p] ?? 0) / sum).toFixed(3) }} />
      ))}
    </span>
  )
}

export function Compare({ s }: { s: Social }) {
  const ps = shown(s)
  const f: Record<Platform, PlatformFigures> = { ig: s.ig, fb: s.fb, tt: s.tt }
  // A platform's window figure counts toward a split only while its figures are current.
  const fresh: Record<Platform, boolean> = { ig: s.igFresh, fb: s.fbFresh, tt: s.ttFresh }
  const pick = (k: keyof PlatformFigures) => Object.fromEntries(ps.map(p => [p, fresh[p] ? (f[p][k] as number | null) : null]))
  const rate = (x: PlatformFigures) => (x.people && x.interactions !== null ? (x.interactions / x.people) * 100 : null)
  const rows: { label: string; note?: string; cell: (x: PlatformFigures, p: Platform) => string; split?: Partial<Record<Platform, number | null>> }[] = [
    { label: 'Followers', cell: x => num(x.followers), split: Object.fromEntries(ps.map(p => [p, f[p].followers])) },
    { label: 'Change, 30 days', note: 'followed less unfollowed', cell: x => (x.net30 !== null ? signed(x.net30) : '—') },
    {
      label: 'People reached',
      note: 'Instagram 30 days · Facebook 28 days · TikTok reports none',
      cell: (x, p) => (p === 'tt' ? 'n/a' : x.people !== null ? compact(x.people) : '—'),
      split: Object.fromEntries(Object.entries(pick('people')).filter(([p]) => p !== 'tt')),
    },
    {
      label: 'Views',
      note: 'every showing · TikTok: videos posted in the last 30 days',
      cell: x => (x.views !== null ? compact(x.views) : '—'),
      split: pick('views'),
    },
    {
      label: 'Interactions',
      note: 'Facebook adds link clicks · TikTok: likes, comments, shares',
      cell: x => (x.interactions !== null ? compact(x.interactions) : '—'),
      split: pick('interactions'),
    },
    { label: 'Interactions per 100 reached', cell: (x, p) => (p === 'tt' ? 'n/a' : rate(x) !== null ? rate(x)!.toFixed(1) : '—') },
    { label: 'Typical post', note: `median per post, ${s.days} days · people reached (TikTok: views)`, cell: x => (x.typical ? compact(x.typical) : '—') },
    { label: 'Posts a week', note: `${s.days} days`, cell: x => x.perWeek.toFixed(1), split: Object.fromEntries(ps.map(p => [p, f[p].posts])) },
    { label: 'Last post', cell: x => ago(x.lastPost) },
  ]
  return (
    <div className="v3-soc-table" role="table" aria-label={`${ps.map(p => PLATFORM_NAME[p]).join(', ')} side by side`} style={{ ['--cols' as string]: ps.length }}>
      <div className="v3-soc-tr head" role="row">
        <span role="columnheader" />
        {ps.map(p => (
          <span key={p} role="columnheader">
            <i className={`v3-soc-dot ${p}`} aria-hidden="true" />
            {PLATFORM_NAME[p]}
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
          {ps.map(p => (
            <span key={p} role="cell" className="num">
              {r.cell(f[p], p)}
            </span>
          ))}
          <span role="cell">{r.split ? <Split values={r.split} /> : null}</span>
        </div>
      ))}
    </div>
  )
}

export function Legend({ s }: { s: Social }) {
  return (
    <div className="v3-legend">
      {shown(s).map(p => (
        <span key={p}>
          <i className={`v3-soc-dot ${p}`} aria-hidden="true" />
          {PLATFORM_NAME[p]}
        </span>
      ))}
    </div>
  )
}

/** Views earned by each month's posts, stacked by platform — the like-for-like chart. */
export function MonthsChart({ s }: { s: Social }) {
  return (
    <>
      <PlatformChart kind="stack" unit="views" points={s.months} />
      <Legend s={s} />
    </>
  )
}

/** Followers per platform, last 90 days — each line starts where that platform's history does. */
export function FollowersChart({ s }: { s: Social }) {
  return (
    <>
      <PlatformChart kind="lines" unit="followers" dates points={s.followers} />
      <Legend s={s} />
    </>
  )
}
