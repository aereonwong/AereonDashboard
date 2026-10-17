'use client'

import { useState } from 'react'
import { compact, num, shortDate } from './fmt'

// 👉 One chart, three platforms (Instagram, Facebook, TikTok) — with a hover readout.
//   · kind "stack": bars, platforms stacked — for counts that add up (views).
//   · kind "lines": one line per platform — for levels that don't stack (followers). The axis
//     is fitted to the data, not pinned at zero, so growth is visible; the readout says the figures.
// A null is "not measured then" — a gap, never a zero. Plain data in, no functions.

export type PlatformPoint = { key: string; label: string; ig: number | null; fb: number | null; tt: number | null }
type P = 'ig' | 'fb' | 'tt'
const ORDER: P[] = ['ig', 'tt', 'fb'] // stack bottom-up; lines drawn in the same order
const NAME: Record<P, string> = { ig: 'Instagram', fb: 'Facebook', tt: 'TikTok' }

const W = 900
const H = 240
const PAD = { l: 54, r: 12, t: 14, b: 30 }

export default function PlatformChart({ points, kind, unit, dates = false }: { points: PlatformPoint[]; kind: 'stack' | 'lines'; unit: string; dates?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const has = ORDER.filter(p => points.some(d => d[p] !== null))
  const totals = points.map(d => ORDER.reduce((t, p) => t + (d[p] ?? 0), 0))
  const all = points.flatMap(d => has.map(p => d[p]).filter((v): v is number => v !== null))
  if (!has.length || points.length < 2 || !all.some(Boolean)) return <p className="v3-empty">Not enough history yet.</p>

  // Stacks start at zero; lines fit the range with a little room either side.
  const rawMax = kind === 'stack' ? Math.max(1, ...totals) : Math.max(...all)
  const rawMin = kind === 'stack' ? 0 : Math.min(...all)
  const span = Math.max(1, rawMax - rawMin)
  const mag = 10 ** Math.floor(Math.log10(kind === 'stack' ? rawMax : span))
  const top = Math.ceil((rawMax + (kind === 'lines' ? span * 0.1 : 0)) / mag) * mag
  const bottom = kind === 'stack' ? 0 : Math.max(0, Math.floor((rawMin - span * 0.1) / mag) * mag)
  const band = (W - PAD.l - PAD.r) / points.length
  const x = (i: number) => PAD.l + band * (i + 0.5)
  const y = (v: number) => H - PAD.b - ((v - bottom) / (top - bottom || 1)) * (H - PAD.t - PAD.b)
  const every = Math.max(1, Math.ceil(points.length / 8))
  const bw = Math.max(2, band * 0.62)
  const h = hover !== null ? points[hover] : null
  const label = (d: PlatformPoint) => (dates ? shortDate(d.label) : d.label)
  const ticks = [0, 0.5, 1].map(f => bottom + f * (top - bottom))

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="v3-chart v3-plat-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${unit} by platform: ${has.map(p => NAME[p]).join(', ')}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD.l) / band)
          setHover(i >= 0 && i < points.length ? i : null)
        }}
      >
        <g className="v3-gridlines">
          {ticks.map(v => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map(v => (
            <text key={v} x={PAD.l - 8} y={y(v) + 4} textAnchor="end">
              {compact(v)}
            </text>
          ))}
          {points.map((d, i) =>
            i % every === 0 ? (
              <text key={d.key} x={x(i)} y={H - 8} textAnchor="middle">
                {label(d)}
              </text>
            ) : null,
          )}
        </g>
        {kind === 'stack'
          ? points.map((d, i) => {
              let base = 0
              return (
                <g key={d.key} data-on={hover === i} data-off={hover !== null && hover !== i}>
                  {ORDER.map(p => {
                    const v = d[p] ?? 0
                    const r = <rect key={p} className={p} x={x(i) - bw / 2} width={bw} y={y(base + v)} height={Math.max(0, y(base) - y(base + v))} />
                    base += v
                    return r
                  })}
                </g>
              )
            })
          : has.map(p => {
              // Join the days that have a reading; a lone reading shows as a dot.
              const pts = points.map((d, i) => (d[p] !== null ? [x(i), y(d[p]!)] : null)).filter(Boolean) as number[][]
              return (
                <g key={p} className={p}>
                  {pts.length > 1 ? <polyline points={pts.map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(' ')} /> : null}
                  {pts.length <= 3 || hover !== null
                    ? pts.map((q, j) => (hover === null || Math.abs(q[0] - x(hover)) < 0.5 ? <circle key={j} cx={q[0]} cy={q[1]} r={4} /> : null))
                    : null}
                </g>
              )
            })}
        {kind === 'lines' && hover !== null ? <line className="v3-plat-cursor" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} /> : null}
      </svg>
      {h && hover !== null ? (
        <div className="v3-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: kind === 'stack' ? `${(y(totals[hover]) / H) * 100}%` : '10%' }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{label(h)}</div>
          {kind === 'stack' ? (
            <div>
              <b>{num(totals[hover])}</b> {unit}
            </div>
          ) : null}
          {has.map(p => (
            <div key={p}>
              <i className={`v3-soc-dot ${p}`} aria-hidden="true" />
              {NAME[p]} <b>{h[p] === null ? '—' : num(h[p]!)}</b>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
