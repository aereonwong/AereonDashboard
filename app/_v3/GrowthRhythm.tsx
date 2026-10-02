'use client'

import { useState } from 'react'
import type { DailyPoint, IgPost } from '@/lib/instagram'
import { clip, igDay, isOpenDay } from '@/lib/v3/ig-insights'
import { compact, num, shortDate } from './fmt'

// 👉 Reach and growth on one shared timeline: accounts reached each day (area), its
// 7-day average (dashed), every post pinned on the day it went out (size = its reach),
// and followers gained each day underneath. Hover or use ← → to read a day.
// The two measures keep separate lanes and scales — never one dual-axis chart.

const W = 900
const H = 350
const PAD = { l: 46, r: 14 }
const A = { t: 26, b: 184 } // reach lane
const RAIL = 204 // post pins start here
const B = { t: 262, b: 312 } // follows lane

/** Smooth line through points without overshooting (monotone cubic). */
function smooth(pts: [number, number][]): string {
  const n = pts.length
  if (n < 3) return pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join('')
  const dx: number[] = []
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0])
    m.push((pts[i + 1][1] - pts[i][1]) / dx[i])
  }
  const t = [m[0]]
  for (let i = 1; i < n - 1; i++) t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2)
  t.push(m[n - 2])
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i] }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h},${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h},${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

export default function GrowthRhythm({ days, posts, median }: { days: DailyPoint[]; posts: IgPost[]; median: number }) {
  const withReach = days.filter(d => d.reach !== undefined).slice(-90)
  // The newest day can still be counting — its reach and follows are both partial, so it is left out.
  const shown = withReach.length && isOpenDay(withReach.at(-1)!, withReach.length - 1, withReach) ? withReach.slice(0, -1) : withReach
  const [on, setOn] = useState<number | null>(null)
  if (shown.length < 3) return <p className="v3-empty">The daily line starts after the first account refresh.</p>

  const n = shown.length
  const reach = shown.map(d => d.reach ?? 0)
  const max = Math.max(1, ...reach)
  const mag = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / (mag / 2)) * (mag / 2)
  const topF = Math.max(5, ...shown.map(d => d.new_followers ?? 0))
  // Position by calendar date, so a missing day leaves a gap instead of squeezing the axis.
  const dn = (d: string) => Date.parse(d + 'T00:00:00Z') / 86_400_000
  const d0 = dn(shown[0].day)
  const span = Math.max(1, dn(shown[n - 1].day) - d0)
  const x = (i: number) => PAD.l + ((dn(shown[i].day) - d0) / span) * (W - PAD.l - PAD.r)
  const yA = (v: number) => A.b - (v / top) * (A.b - A.t)
  const step = (W - PAD.l - PAD.r) / span

  // 7-day average over the calendar week ending that day; needs at least 5 days of data in it.
  const avg7 = reach.map((_, i) => {
    const win = reach.filter((__, j) => dn(shown[j].day) <= dn(shown[i].day) && dn(shown[j].day) > dn(shown[i].day) - 7)
    return win.length >= 5 ? win.reduce((t, v) => t + v, 0) / win.length : null
  })
  const line = smooth(reach.map((v, i) => [x(i), yA(v)]))
  const area = `${line}L${x(n - 1)},${A.b}L${x(0)},${A.b}Z`
  const avgPts = avg7.flatMap((v, i) => (v === null ? [] : [[x(i), yA(v)] as [number, number]]))
  const peakI = reach.indexOf(max)
  const counted = shown.filter(d => d.new_followers !== undefined)
  const gained = counted.reduce((t, d) => t + (d.new_followers ?? 0), 0)
  const dayIdx = new Map(shown.map((d, i) => [d.day, i]))

  // Pins: each post on its day, stacked when a day has several.
  const pins: { p: IgPost; i: number; row: number; r: number }[] = []
  const used = new Map<number, number>()
  for (const p of [...posts].filter(q => q.timestamp).sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    const i = dayIdx.get(igDay(p.timestamp))
    if (i === undefined) continue
    const row = used.get(i) ?? 0
    used.set(i, row + 1)
    const r = p.reach !== undefined && median ? 3.5 + Math.min(p.reach / median, 6) * 1.3 : 3
    pins.push({ p, i, row: Math.min(row, 3), r })
  }
  const postsOn = (i: number) => pins.filter(q => q.i === i).map(q => q.p)

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    const target = ((px - PAD.l) / (W - PAD.l - PAD.r)) * span
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(dn(shown[i].day) - d0 - target) < Math.abs(dn(shown[best].day) - d0 - target)) best = i
    setOn(best)
  }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setOn(i => Math.min(n - 1, (i ?? -1) + 1)) }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setOn(i => Math.max(0, (i ?? n) - 1)) }
    else if (e.key === 'Escape') setOn(null)
  }
  const a = on !== null ? shown[on] : null
  const tipX = on !== null ? (x(on) / W) * 100 : 0

  return (
    <figure className="v3-rhythm">
      <div className="v3-rhythm-stats">
        <div>
          <b className="num">{compact(max)}</b>
          <span>best day · {shortDate(shown[peakI].day)}</span>
        </div>
        <div>
          <b className="num">{compact(reach.reduce((t, v) => t + v, 0) / n)}</b>
          <span>average day</span>
        </div>
        <div>
          <b className="num">+{num(gained)}</b>
          <span>followers gained · {counted.length} days</span>
        </div>
      </div>

      <div className="v3-rhythm-plot">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          tabIndex={0}
          aria-label={`Accounts reached each day, ${shortDate(shown[0].day)} to ${shortDate(shown[n - 1].day)}, with posts marked and followers gained. Best day ${compact(max)} on ${shortDate(shown[peakI].day)}. Use the arrow keys to read each day.`}
          onPointerMove={move}
          onPointerLeave={() => setOn(null)}
          onKeyDown={key}
          onBlur={() => setOn(null)}
        >
          <defs>
            <linearGradient id="rh-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0.32" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>

          <g className="grid">
            {[0, 0.5, 1].map(f => (
              <line key={f} x1={PAD.l} x2={W - PAD.r} y1={yA(f * top)} y2={yA(f * top)} />
            ))}
            <line x1={PAD.l} x2={W - PAD.r} y1={B.b} y2={B.b} />
          </g>
          <g className="axis">
            {[0, 0.5, 1].map(f => (
              <text key={f} x={PAD.l - 8} y={yA(f * top) + 4} textAnchor="end">{compact(f * top)}</text>
            ))}
            <text x={PAD.l - 8} y={B.t + 10} textAnchor="end">{topF}</text>
            <text x={PAD.l} y={RAIL - 8} className="lane">POSTS</text>
            <text x={PAD.l} y={B.t - 10} className="lane">FOLLOWERS GAINED</text>
            {[0, Math.floor((n - 1) / 3), Math.floor(((n - 1) * 2) / 3), n - 1].map((i, k) => (
              <text key={i} x={x(i)} y={H - 10} textAnchor={k === 0 ? 'start' : k === 3 ? 'end' : 'middle'}>{shortDate(shown[i].day)}</text>
            ))}
          </g>

          <path className="area" d={area} fill="url(#rh-fill)" />
          <path className="ln" d={line} pathLength={1} />
          <path className="avg" d={smooth(avgPts)} />

          <g className="peak">
            <circle cx={x(peakI)} cy={yA(max)} r={4.5} />
            <text x={peakI > n * 0.82 ? x(peakI) - 10 : x(peakI) + 10} y={yA(max) + 4} textAnchor={peakI > n * 0.82 ? 'end' : 'start'}>
              {compact(max)} · {shortDate(shown[peakI].day)}
            </text>
          </g>

          <g className="pins">
            {pins.map(({ p, i, row, r }, k) => (
              <circle
                key={p.id}
                className={`pin ${/REEL/i.test(p.type) ? 'reel' : 'feed'}`}
                style={{ ['--k' as string]: k }}
                cx={x(i)}
                cy={RAIL + 8 + row * 13}
                r={r}
                data-on={on === i || undefined}
              />
            ))}
          </g>

          <g className="gain">
            {shown.map((d, i) => {
              const v = d.new_followers ?? 0
              const h = Math.max(v ? 2 : 0, (v / topF) * (B.b - B.t))
              return (
                <rect
                  key={d.day}
                  x={x(i) - Math.max(1.5, step * 0.32)}
                  width={Math.max(3, step * 0.64)}
                  y={B.b - h}
                  height={h}
                  rx={2}
                  data-on={on === i || undefined}
                  
                />
              )
            })}
          </g>

          {on !== null ? (
            <g className="cross">
              <line x1={x(on)} x2={x(on)} y1={A.t - 6} y2={B.b} />
              <circle cx={x(on)} cy={yA(reach[on])} r={5} />
            </g>
          ) : null}
        </svg>

        {a && on !== null ? (
          <div className="v3-tip v3-rhythm-tip" style={{ left: `${Math.min(86, Math.max(14, tipX))}%`, top: 0 }}>
            <div className="when">{shortDate(a.day)}</div>
            <div>
              <b>{num(a.reach ?? 0)}</b> reached
              {avg7[on] !== null ? <span className="dim"> · 7-day avg {compact(avg7[on] as number)}</span> : null}
            </div>
            <div>
              {a.new_followers === undefined ? <span className="dim">followers not stored</span> : <><b>+{num(a.new_followers)}</b> followers</>}
            </div>
            {postsOn(on).map(p => (
              <div key={p.id} className="post">
                <i className={/REEL/i.test(p.type) ? 'reel' : 'feed'} />
                <span>
                  {clip(p.caption || p.type, 56)}
                  {p.reach !== undefined ? <b> · {compact(p.reach)}</b> : null}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <figcaption className="v3-legend">
        <span><i className="dot reel" /> Reel</span>
        <span><i className="dot feed" /> Post</span>
        <span><i className="dash" /> 7-day average</span>
        <span className="dim">Pin size follows the post’s reach; a small pin has none stored</span>
      </figcaption>

      <table className="v3-visually-hidden">
        <caption>Accounts reached and followers gained per day</caption>
        <thead><tr><th>Day</th><th>Reached</th><th>Followers gained</th></tr></thead>
        <tbody>
          {shown.map(d => (
            <tr key={d.day}><td>{d.day}</td><td>{d.reach}</td><td>{d.new_followers ?? ''}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
