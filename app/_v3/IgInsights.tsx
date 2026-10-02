import type { IgPost } from '@/lib/instagram'
import {
  DAYPARTS,
  WEEKDAYS,
  type CollabView,
  type Flow,
  type ReachVsFollowers,
  type ShelfLife,
  type TimeGrid as TimeGridData,
  type Theme,
  clip,
} from '@/lib/v3/ig-insights'
import { compact, money, num, shortDate } from './fmt'

// 👉 The Instagram page's analysis panels. Server components, no client JS: each is
// plain HTML/SVG drawn from the figures in lib/v3/ig-insights.ts. Every panel states
// what it can't know yet instead of drawing a trend it does not have.

const kind = (p: IgPost) => (/REEL/i.test(p.type) ? 'reel' : 'feed')
const times = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}×`

// ------------------------------------------------------------------ who followed after which posts

export function FollowFlow({ flow }: { flow: Flow }) {
  if (!flow || !flow.rows.length) {
    return <p className="v3-empty">Needs about a week and a half of daily follower counts. It fills in as the daily refresh runs.</p>
  }
  const rows = flow.rows.slice(0, 6)
  const max = Math.max(1, ...rows.map(r => r.follows))
  return (
    <div className="v3-flow">
      {rows.map(r => {
        const lead = [...r.posts].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0]
        return (
          <div key={r.day} className="v3-flow-row">
            <div className="v3-flow-when">
              <b>{shortDate(r.day)}</b>
              <span>
                {r.posts.length} post{r.posts.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="v3-flow-main">
              <div className="v3-flow-cap">
                <i className={`v3-kind ${kind(lead)}`} />
                {clip(lead.caption || lead.type, 70)}
              </div>
              <div className="v3-flow-track">
                <i style={{ ['--w' as string]: (r.follows / max).toFixed(3) }} data-hot={r.lift >= 2 || undefined} />
              </div>
            </div>
            <div className="v3-flow-num">
              <b className="num">+{num(r.follows)}</b>
              <span>{r.lift >= 1.5 ? `${times(r.lift)} normal` : r.lift < 0.8 ? 'below normal' : 'about normal'}{r.soFar ? ' · so far' : ''}</span>
            </div>
          </div>
        )
      })}
      <p className="v3-panel-note v3-flow-foot">
        Followers gained in the 48 hours from each posting day, against a normal {num(flow.normalPerDay)} a day. Instagram doesn’t say which post earned a
        follow, so posts that share a day share its followers.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ when to post

export function TimeGrid({ grid }: { grid: TimeGridData }) {
  if (grid.posts < 8) return <p className="v3-empty">Needs more posts with reach to say anything about timing.</p>
  const bestCell = grid.best
  return (
    <div>
      <div className="v3-heat" role="table" aria-label="Median reach by weekday and time of day, Malaysia time">
        <div className="v3-heat-corner" role="presentation" />
        {DAYPARTS.map(d => (
          <div key={d.key} className="v3-heat-col" role="columnheader">
            {d.label}
            <span>{d.hours}</span>
          </div>
        ))}
        <div className="v3-heat-col" role="columnheader">
          Any time
        </div>
        {WEEKDAYS.map((w, wd) => (
          <div key={w} className="v3-heat-row" role="row">
            <div className="v3-heat-label" role="rowheader">
              {w}
            </div>
            {grid.cells[wd].map((c, pi) => {
              const best = bestCell && bestCell.weekday === wd && bestCell.part === pi
              return (
                <div
                  key={pi}
                  role="cell"
                  className="v3-heat-cell"
                  data-empty={c.n === 0 || undefined}
                  data-thin={c.n === 1 || undefined}
                  data-best={best || undefined}
                  style={{ ['--v' as string]: c.n ? (c.median / grid.max).toFixed(3) : 0 }}
                  title={c.n ? `${w}, ${DAYPARTS[pi].label}: median ${num(c.median)} reached across ${c.n} post${c.n === 1 ? '' : 's'}` : `${w}, ${DAYPARTS[pi].label}: no posts`}
                >
                  {c.n ? <b className="num">{compact(c.median)}</b> : null}
                  {c.n ? <span>{c.n}</span> : null}
                </div>
              )
            })}
            <div className="v3-heat-cell v3-heat-sum" role="cell">
              {grid.byDay[wd].n ? <b className="num">{compact(grid.byDay[wd].median)}</b> : null}
              {grid.byDay[wd].n ? <span>{grid.byDay[wd].n}</span> : null}
            </div>
          </div>
        ))}
        <div className="v3-heat-label v3-heat-sumrow" role="rowheader">
          Any day
        </div>
        {grid.byPart.map((c, i) => (
          <div key={i} className="v3-heat-cell v3-heat-sum" role="cell">
            {c.n ? <b className="num">{compact(c.median)}</b> : null}
            {c.n ? <span>{c.n}</span> : null}
          </div>
        ))}
        <div />
      </div>
      <p className="v3-panel-note v3-heat-foot">
        Median reach per slot, Malaysia time; the small number is how many posts. Dotted slots rest on one post — don’t trust them.
        {bestCell ? (
          <>
            {' '}
            Strongest slot with 2+ posts: <b>{WEEKDAYS[bestCell.weekday]} {DAYPARTS[bestCell.part].label.toLowerCase()}</b> ({compact(bestCell.median)}, {bestCell.n} posts).
          </>
        ) : null}
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ themes

export function ThemeStrip({ rows, typical, all }: { rows: Theme[]; typical: number; all: IgPost[] }) {
  const reach = all.filter(p => p.reach !== undefined && (p.reach as number) > 0).map(p => p.reach as number)
  if (!rows.length || reach.length < 6) return <p className="v3-empty">Needs more posts to group by subject.</p>
  const lo = Math.log(Math.min(...reach))
  const hi = Math.log(Math.max(...reach))
  const at = (v: number) => (hi === lo ? 0.5 : Math.min(1, Math.max(0, (Math.log(Math.max(1, v)) - lo) / (hi - lo))))
  return (
    <div className="v3-subj" style={{ ['--t' as string]: at(typical).toFixed(3) }}>
      {rows.map(t => (
        <div key={t.key} className="v3-subj-row" data-thin={t.thin || undefined}>
          <div className="v3-subj-label">
            <b>{t.label}</b>
            <span>
              {t.posts.length} post{t.posts.length === 1 ? '' : 's'}
              {t.thin ? ' · too few' : ''}
            </span>
          </div>
          <div className="v3-subj-track">
            {t.posts.map(p => (
              <i
                key={p.id}
                className={`v3-subj-dot ${kind(p)}`}
                style={{ ['--x' as string]: at(p.reach as number).toFixed(4) }}
                title={`${num(p.reach as number)} reached · ${clip(p.caption || p.type, 60)}`}
              />
            ))}
            <i className="v3-subj-med" style={{ ['--x' as string]: at(t.median).toFixed(4) }} title={`Median ${num(t.median)}`} />
          </div>
          <div className="v3-subj-num">
            <b className="num">{compact(t.median)}</b>
            <span>{times(t.lift)} typical</span>
          </div>
        </div>
      ))}
      <div className="v3-subj-axis" aria-hidden="true">
        <span>fewer reached</span>
        <span className="mid">typical post {compact(typical)}</span>
        <span>more reached</span>
      </div>
      <p className="v3-panel-note">
        Each dot is a post, spread on a log scale; the bar is the subject’s median. A post can sit in several subjects. Grouped from caption words, so treat it as a
        guide.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ reach vs followers

export function ReachBeyond({ v }: { v: ReachVsFollowers | null }) {
  if (!v) return <p className="v3-empty">Needs a few more posts with reach.</p>
  const total = v.bands.reduce((t, b) => t + b.n, 0) || 1
  const maxW = Math.max(100, ...v.weeks.map(w => w.pct))
  const W = 360
  const H = 84
  const px = (i: number) => 8 + (v.weeks.length < 2 ? 0.5 : i / (v.weeks.length - 1)) * (W - 16)
  const py = (p: number) => H - 8 - (p / maxW) * (H - 22)
  return (
    <div className="v3-beyond">
      <div className="v3-beyond-head">
        <span className="v3-beyond-big num">{Math.round(v.typicalPct)}%</span>
        <span className="v3-beyond-note">
          is what the typical post reached, measured against your follower count — and <b>{Math.round(v.beyondPct)}%</b> of posts reached more people than follow you.
        </span>
      </div>
      <div className="v3-bands" role="img" aria-label={v.bands.map(b => `${b.label}: ${b.n} posts`).join(', ')}>
        {v.bands.map((b, i) => (
          <i key={b.label} style={{ flexGrow: Math.max(b.n, 0.0001) }} data-step={i} data-zero={b.n === 0 || undefined} title={`${b.sub}: ${b.n} posts`} />
        ))}
      </div>
      <div className="v3-bands-key">
        {v.bands.map((b, i) => (
          <div key={b.label} data-step={i}>
            <b className="num">{Math.round((b.n / total) * 100)}%</b>
            <span>{b.label}</span>
          </div>
        ))}
      </div>
      {v.weeks.length >= 2 ? (
        <figure className="v3-beyond-trend">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Typical post reach as a share of followers, by week: ${v.weeks.map(w => `${Math.round(w.pct)}%`).join(', ')}`}>
            {maxW >= 100 ? <line className="ref" x1={0} x2={W} y1={py(100)} y2={py(100)} /> : null}
            <polyline points={v.weeks.map((w, i) => `${px(i)},${py(w.pct)}`).join(' ')} />
            {v.weeks.map((w, i) => (
              <circle key={w.label} cx={px(i)} cy={py(w.pct)} r={4}>
                <title>{`${w.label}: ${Math.round(w.pct)}% (${w.n} posts)`}</title>
              </circle>
            ))}
          </svg>
          <figcaption>Typical post each week{maxW >= 100 ? ' · dashed line = your whole audience' : ''}</figcaption>
        </figure>
      ) : null}
    </div>
  )
}

// ------------------------------------------------------------------ shelf life

export function ShelfCurve({ life, readingDays, since }: { life: ShelfLife | null; readingDays: number; since: string | null }) {
  if (!life) {
    return (
      <p className="v3-empty">
        Needs the same post read on two or more days. Instagram history here began {since ? <b>{shortDate(since)}</b> : 'with the next refresh'}; the 6am refresh adds a
        reading each day{readingDays ? ` (${readingDays} so far)` : ''}, so the curves draw themselves in a few days.
      </p>
    )
  }
  const W = 520
  const H = 210
  const P = { l: 40, r: 12, t: 12, b: 28 }
  const maxAge = Math.max(7, ...life.curves.reels.map(c => c.age), ...life.curves.posts.map(c => c.age))
  const x = (a: number) => P.l + (a / maxAge) * (W - P.l - P.r)
  const y = (f: number) => H - P.b - f * (H - P.t - P.b)
  const path = (pts: { age: number; frac: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.age)},${y(p.frac)}`).join('')
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)
  return (
    <div>
      <svg className="v3-shelf" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Share of a post's final reach by days since posting, Reels and posts">
        <g className="grid">
          {[0, 0.5, 1].map(f => (
            <line key={f} x1={P.l} x2={W - P.r} y1={y(f)} y2={y(f)} />
          ))}
        </g>
        <g className="axis">
          {[0, 0.5, 1].map(f => (
            <text key={f} x={P.l - 6} y={y(f) + 4} textAnchor="end">
              {Math.round(f * 100)}%
            </text>
          ))}
          {Array.from({ length: Math.floor(maxAge / 2) + 1 }, (_, i) => i * 2).map(a => (
            <text key={a} x={x(a)} y={H - 8} textAnchor="middle">
              {a === 0 ? 'day 0' : `d${a}`}
            </text>
          ))}
        </g>
        {life.curves.posts.length ? <path className="posts" d={path(life.curves.posts)} /> : null}
        {life.curves.reels.length ? <path className="reels" d={path(life.curves.reels)} /> : null}
        {life.curves.posts.map(c => (
          <circle key={`p${c.age}`} className="posts" cx={x(c.age)} cy={y(c.frac)} r={3.5}><title>{`Posts, day ${c.age}: ${Math.round(c.frac * 100)}% of final reach (${c.n})`}</title></circle>
        ))}
        {life.curves.reels.map(c => (
          <circle key={`r${c.age}`} className="reels" cx={x(c.age)} cy={y(c.frac)} r={3.5}><title>{`Reels, day ${c.age}: ${Math.round(c.frac * 100)}% of final reach (${c.n})`}</title></circle>
        ))}
      </svg>
      <div className="v3-legend">
        <span><i className="dot reel" /> Reels · {pct(life.early.reels)} by day 2</span>
        <span><i className="dot feed" /> Posts · {pct(life.early.posts)} by day 2</span>
      </div>
      <p className="v3-panel-note">
        {life.tracked} post{life.tracked === 1 ? '' : 's'} followed since {shortDate(life.since)}. Each point is the median post’s reach that day as a share of where it ended up.
      </p>
    </div>
  )
}

// ------------------------------------------------------------------ brand work

export function CollabPanel({ view }: { view: CollabView | null }) {
  if (!view) return <p className="v3-empty">Needs more posts with reach.</p>
  const max = Math.max(view.branded.median, view.own.median, 1)
  const row = (label: string, sub: string, n: number, m: number, tone: 'brand' | 'own') => (
    <div className="v3-collab-row" data-tone={tone}>
      <div className="v3-collab-label">
        <b>{label}</b>
        <span>{sub}</span>
      </div>
      <div className="v3-collab-bar"><i style={{ ['--w' as string]: (m / max).toFixed(3) }} /></div>
      <div className="v3-collab-num"><b className="num">{compact(m)}</b><span>median · {n} posts</span></div>
    </div>
  )
  return (
    <div className="v3-collab">
      {row('Looks like brand work', 'linked to an invoice, or caption words credit a brand', view.branded.n, view.branded.median, 'brand')}
      {row('Your own content', 'everything else', view.own.n, view.own.median, 'own')}
      <p className="v3-collab-verdict">
        {view.branded.n < 3 || view.own.n < 3
          ? 'Too few posts in one of the groups to compare yet.'
          : view.ratio >= 1.15
            ? `The typical brand post reaches ${times(view.ratio)} the typical organic one.`
            : view.ratio <= 0.85
              ? `The typical brand post reaches ${times(1 / view.ratio)} less than the typical organic one.`
              : 'Brand posts and organic posts reach about the same.'}
      </p>
      {view.invoices.length ? (
        <div className="v3-collab-inv">
          {view.invoices.map(i => (
            <div key={i.id} className="v3-collab-invrow">
              <div>
                <b>{i.client}</b>
                <span>
                  {i.job} · {i.no}
                </span>
              </div>
              <div className="r">
                <b className="num">{i.reach === null ? 'reach not stored for every post' : `${compact(i.reach)} combined reach`}</b>
                <span>
                  invoiced {money(i.amount, i.currency)}{i.documented ? ' · payment not tracked' : ''}
                  {i.lift !== null ? ` · ${times(i.lift)} a typical post` : ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="v3-panel-note">No invoice has posts linked yet. Link them in Invoice Details and each job shows the reach it delivered, beside what it billed.</p>
      )}
    </div>
  )
}
