'use client'

import { useState } from 'react'
import { compact, num } from './fmt'

// One series over time — a line for days, bars for months — with a hover readout.
// Plain data in, no functions: server pages pass `unit` as a word.

export type SeriesPoint = { key: string; label: string; value: number | null; note?: string }

const W = 900
const H = 240
const PAD = { l: 50, r: 12, t: 14, b: 30 }

export default function SeriesChart({ points, kind = 'line', unit }: { points: SeriesPoint[]; kind?: 'line' | 'bars'; unit: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const vals = points.map(p => p.value ?? 0)
  if (points.length < 2 || !vals.some(Boolean)) return <p className="v3-empty">Not enough history yet.</p>

  const max = Math.max(1, ...vals)
  const mag = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / mag) * mag
  const band = (W - PAD.l - PAD.r) / points.length
  const x = (i: number) => PAD.l + band * (i + 0.5)
  const y = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b)
  const every = Math.max(1, Math.ceil(points.length / 8))
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.value ?? 0).toFixed(1)}`).join(' ')
  const h = hover !== null ? points[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="v3-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${unit} over time, highest ${num(max)}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD.l) / band)
          setHover(i >= 0 && i < points.length ? i : null)
        }}
      >
        <g className="v3-gridlines">
          {[0, 0.5, 1].map(f => (
            <line key={f} x1={PAD.l} x2={W - PAD.r} y1={y(f * top)} y2={y(f * top)} />
          ))}
        </g>
        <g className="axis">
          {[0, 0.5, 1].map(f => (
            <text key={f} x={PAD.l - 8} y={y(f * top) + 4} textAnchor="end">
              {compact(f * top)}
            </text>
          ))}
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={x(i)} y={H - 8} textAnchor="middle">
                {p.label}
              </text>
            ) : null,
          )}
        </g>
        {kind === 'bars' ? (
          points.map((p, i) => (
            <rect
              key={p.key}
              className="v3-series-bar"
              data-on={hover === i}
              x={x(i) - Math.max(2, band * 0.32)}
              width={Math.max(4, band * 0.64)}
              y={y(p.value ?? 0)}
              height={Math.max(0, H - PAD.b - y(p.value ?? 0))}
              rx={2}
            />
          ))
        ) : (
          <>
            <polygon className="now-area" points={`${x(0)},${H - PAD.b} ${line} ${x(points.length - 1)},${H - PAD.b}`} />
            <polyline className="now" points={line} />
          </>
        )}
        {h && hover !== null ? (
          <>
            <line className="scrub" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />
            {kind === 'line' ? <circle className="dot" cx={x(hover)} cy={y(h.value ?? 0)} r={4} style={{ color: 'var(--accent)' }} /> : null}
          </>
        ) : null}
      </svg>
      {h && hover !== null ? (
        <div className="v3-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(h.value ?? 0) / H) * 100}%` }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{h.label}</div>
          <b>{h.value === null ? '—' : num(h.value)}</b> {unit}
          {h.note ? <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>{h.note}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
