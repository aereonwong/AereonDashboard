'use client'

import { useState } from 'react'
import { compact, num, shortDate } from './fmt'

// People reached per day on each platform, stacked: Instagram at the base, Facebook on top.
// Each day's two figures are each platform's own unique count, so the stack is a platform
// total — someone who saw both counts twice. Plain data in, no functions.

export type DailyPair = { day: string; ig: number | null; fb: number | null }

const W = 900
const H = 240
const PAD = { l: 50, r: 12, t: 14, b: 30 }

export default function SocialDaily({ days }: { days: DailyPair[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const totals = days.map(d => (d.ig ?? 0) + (d.fb ?? 0))
  if (days.length < 3 || !totals.some(Boolean)) return <p className="v3-empty">Not enough daily history yet.</p>

  const max = Math.max(1, ...totals)
  const mag = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / mag) * mag
  const band = (W - PAD.l - PAD.r) / days.length
  const x = (i: number) => PAD.l + band * (i + 0.5)
  const y = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b)
  const every = Math.max(1, Math.ceil(days.length / 8))
  const bw = Math.max(2, band * 0.7)
  const h = hover !== null ? days[hover] : null

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="v3-chart v3-soc-daily"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`People reached per day on Instagram and Facebook, highest ${num(max)}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD.l) / band)
          setHover(i >= 0 && i < days.length ? i : null)
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
          {days.map((d, i) =>
            i % every === 0 ? (
              <text key={d.day} x={x(i)} y={H - 8} textAnchor="middle">
                {shortDate(d.day)}
              </text>
            ) : null,
          )}
        </g>
        {days.map((d, i) => {
          const ig = d.ig ?? 0
          const fb = d.fb ?? 0
          return (
            <g key={d.day} data-on={hover === i}>
              <rect className="ig" x={x(i) - bw / 2} width={bw} y={y(ig)} height={Math.max(0, H - PAD.b - y(ig))} />
              <rect className="fb" x={x(i) - bw / 2} width={bw} y={y(ig + fb)} height={Math.max(0, y(ig) - y(ig + fb))} />
            </g>
          )
        })}
      </svg>
      {h && hover !== null ? (
        <div className="v3-tip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(totals[hover]) / H) * 100}%` }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{shortDate(h.day)}</div>
          <div>
            Instagram <b>{h.ig === null ? '—' : num(h.ig)}</b>
          </div>
          <div>
            Facebook <b>{h.fb === null ? '—' : num(h.fb)}</b>
          </div>
        </div>
      ) : null}
    </div>
  )
}
