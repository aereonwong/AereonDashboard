'use client'

import { useRef, useState } from 'react'
import type { PacePoint } from '@/lib/v3/studio'
import { rmFull, compact } from '../fmt'

// Question 1, drawn: this year's running total against last year's, month by
// month, on ONE shared scale — so the gap between the lines is the real gap.

const W = 820
const H = 260
const PAD = { l: 52, r: 16, t: 16, b: 28 }

export default function PaceChart({ pace, year }: { pace: PacePoint[]; year: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)

  const max = Math.max(1, ...pace.map(p => Math.max(p.now ?? 0, p.before)))
  const niceMax = (() => {
    const mag = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / mag) * mag
  })()
  const x = (i: number) => PAD.l + (i / 11) * (W - PAD.l - PAD.r)
  const y = (v: number) => H - PAD.b - (v / niceMax) * (H - PAD.t - PAD.b)

  const nowPts = pace.map((p, i) => (p.now === null ? null : [x(i), y(p.now)] as const)).filter(Boolean) as (readonly [number, number])[]
  const beforePts = pace.map((p, i) => [x(i), y(p.before)] as const)
  const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = nowPts.length
    ? `${line(nowPts)} L${nowPts.at(-1)![0].toFixed(1)},${H - PAD.b} L${nowPts[0][0].toFixed(1)},${H - PAD.b} Z`
    : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * niceMax)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const px = ((e.clientX - box.left) / box.width) * W
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * 11)
    setHover(Math.max(0, Math.min(11, i)))
  }

  const h = hover === null ? null : pace[hover]
  const tipLeft = hover === null ? 0 : (x(hover) / W) * 100
  const tipTop = h ? (y(Math.max(h.now ?? 0, h.before)) / H) * 100 : 0

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={ref}
        className="v3-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Running income for ${year} against ${year - 1}`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <g className="v3-gridlines">
          {ticks.map(t => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <g className="axis">
          {ticks.map(t => (
            <text key={t} x={PAD.l - 10} y={y(t) + 4} textAnchor="end" data-money>
              {compact(t)}
            </text>
          ))}
          {pace.map((p, i) => (
            <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle">
              {p.month}
            </text>
          ))}
        </g>
        <path className="before" d={line(beforePts)} />
        {area ? <path className="now-area" d={area} /> : null}
        {nowPts.length ? <path className="now" d={line(nowPts)} /> : null}
        {h ? (
          <g>
            <line className="scrub" x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={H - PAD.b} />
            <circle className="dot" cx={x(hover!)} cy={y(h.before)} r={4} style={{ color: 'var(--ink-3)' }} />
            {h.now !== null ? <circle className="dot" cx={x(hover!)} cy={y(h.now)} r={5} style={{ color: 'var(--ink)' }} /> : null}
          </g>
        ) : null}
      </svg>
      {h ? (
        <div className="v3-tip" style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>End of {h.month}</div>
          {h.now !== null ? (
            <div>
              {year}: <b>{rmFull(h.now)}</b>
            </div>
          ) : null}
          <div>
            {year - 1}: <b>{rmFull(h.before)}</b>
          </div>
        </div>
      ) : null}
      <div className="v3-legend">
        <span>
          <i />
          {year} so far
        </span>
        <span>
          <i className="dash" />
          {year - 1}
        </span>
      </div>
    </div>
  )
}
