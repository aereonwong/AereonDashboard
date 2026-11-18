'use client'

import { useRef, useState } from 'react'
import type { PacePoint } from '@/lib/v3/studio'
import { rmFull, compact } from '../fmt'

// Question 1, drawn two ways on the same panel:
//   · Running total — this year's running total against last year's, month by month.
//   · By month — each month's own invoiced total, this year beside last year.
// Both years always share ONE scale, so the gap between them is the real gap.

const W = 820
const H = 260
const PAD = { l: 52, r: 16, t: 16, b: 28 }

type Mode = 'running' | 'month'

const niceCeil = (max: number) => {
  const mag = 10 ** Math.floor(Math.log10(Math.max(1, max)))
  return Math.ceil(max / mag) * mag
}

export default function PaceChart({ pace, year }: { pace: PacePoint[]; year: number }) {
  const ref = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode>('running')
  const bars = mode === 'month'

  const max = bars
    ? Math.max(1, ...pace.map(p => Math.max(p.nowMonth ?? 0, p.beforeMonth)))
    : Math.max(1, ...pace.map(p => Math.max(p.now ?? 0, p.before)))
  const niceMax = niceCeil(max)
  const plotW = W - PAD.l - PAD.r
  const slot = plotW / 12
  // Running total: points sit on month edges 0..11. By month: bars sit in the middle of 12 slots.
  const x = (i: number) => (bars ? PAD.l + slot * (i + 0.5) : PAD.l + (i / 11) * plotW)
  const y = (v: number) => H - PAD.b - (v / niceMax) * (H - PAD.t - PAD.b)
  const base = H - PAD.b

  const nowPts = pace.map((p, i) => (p.now === null ? null : [x(i), y(p.now)] as const)).filter(Boolean) as (readonly [number, number])[]
  const beforePts = pace.map((p, i) => [x(i), y(p.before)] as const)
  const line = (pts: readonly (readonly [number, number])[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const area = nowPts.length
    ? `${line(nowPts)} L${nowPts.at(-1)![0].toFixed(1)},${base} L${nowPts[0][0].toFixed(1)},${base} Z`
    : ''
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => t * niceMax)
  const barW = Math.min(22, slot * 0.34)

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const px = ((e.clientX - box.left) / box.width) * W
    const i = bars ? Math.floor((px - PAD.l) / slot) : Math.round(((px - PAD.l) / plotW) * 11)
    setHover(Math.max(0, Math.min(11, i)))
  }

  const h = hover === null ? null : pace[hover]
  const tipLeft = hover === null ? 0 : (x(hover) / W) * 100
  const tipTop = h
    ? (y(bars ? Math.max(h.nowMonth ?? 0, h.beforeMonth) : Math.max(h.now ?? 0, h.before)) / H) * 100
    : 0

  return (
    <div style={{ position: 'relative' }}>
      <div className="v3-seg v3-pace-mode" role="group" aria-label="Chart view">
        <button type="button" aria-pressed={!bars} onClick={() => setMode('running')}>
          Running total
        </button>
        <button type="button" aria-pressed={bars} onClick={() => setMode('month')}>
          By month
        </button>
      </div>
      <svg
        ref={ref}
        className={`v3-chart${bars ? ' v3-pace-bars' : ''}`}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={bars ? `Invoiced each month, ${year} beside ${year - 1}` : `Running income for ${year} against ${year - 1}`}
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
        {bars ? (
          <g>
            {pace.map((p, i) => (
              <g key={p.month} data-on={hover === i ? '' : undefined} data-off={hover !== null && hover !== i ? '' : undefined}>
                <rect className="bar-before" x={x(i) - barW - 1} y={y(p.beforeMonth)} width={barW} height={base - y(p.beforeMonth)} rx={2} />
                {p.nowMonth !== null ? (
                  <rect className="bar-now" x={x(i) + 1} y={y(p.nowMonth)} width={barW} height={base - y(p.nowMonth)} rx={2} />
                ) : null}
              </g>
            ))}
          </g>
        ) : (
          <>
            <path className="before" d={line(beforePts)} />
            {area ? <path className="now-area" d={area} /> : null}
            {nowPts.length ? <path className="now" d={line(nowPts)} /> : null}
            {h ? (
              <g>
                <line className="scrub" x1={x(hover!)} x2={x(hover!)} y1={PAD.t} y2={base} />
                <circle className="dot" cx={x(hover!)} cy={y(h.before)} r={4} style={{ color: 'var(--ink-3)' }} />
                {h.now !== null ? <circle className="dot" cx={x(hover!)} cy={y(h.now)} r={5} style={{ color: 'var(--ink)' }} /> : null}
              </g>
            ) : null}
          </>
        )}
      </svg>
      {h ? (
        <div className="v3-tip" style={{ left: `${tipLeft}%`, top: `${tipTop}%` }}>
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{bars ? `Invoiced in ${h.month}` : `End of ${h.month}`}</div>
          {(bars ? h.nowMonth : h.now) !== null ? (
            <div>
              {year}: <b>{rmFull((bars ? h.nowMonth : h.now) ?? 0)}</b>
            </div>
          ) : null}
          <div>
            {year - 1}: <b>{rmFull(bars ? h.beforeMonth : h.before)}</b>
          </div>
        </div>
      ) : null}
      <div className="v3-legend">
        <span>
          <i className={bars ? 'sq' : undefined} />
          {year} so far
        </span>
        <span>
          <i className={bars ? 'sq before' : 'dash'} />
          {year - 1}
        </span>
      </div>
    </div>
  )
}
