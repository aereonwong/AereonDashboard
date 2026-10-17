'use client'

import { useEffect, useRef, useState } from 'react'
import { PLATFORM_NAME, type PlatformId } from '@/lib/v3/platforms'
import { compact, num, shortDate } from './fmt'

// 👉 One chart, every connected platform — with a hover readout (docs/CHARTS.md).
//   · kind "stack": bars, platforms stacked — for counts that add up (views, posts, people per day).
//   · kind "lines": one line per platform — for levels that don't stack. With `signed`, the
//     values are changes (followers gained) and the axis takes in zero and below.
// A null is "not measured then" — a gap, never a zero. Platforms come in `ids`, in the fixed
// order of lib/v3/platforms.ts; colour is the platform's own slot (--p-<id>), never its rank.
// Plain data in, no functions.

export type PlatformPoint = { key: string; label: string; v: Partial<Record<PlatformId, number | null>> }

const H = 240
const PAD = { l: 54, r: 12, t: 14, b: 30 }

export default function PlatformChart({
  points,
  ids,
  kind,
  unit,
  dates = false,
  signed = false,
  levels,
}: {
  points: PlatformPoint[]
  ids: PlatformId[]
  kind: 'stack' | 'lines'
  unit: string
  dates?: boolean
  /** Values are changes: show +/−, and let the axis cross zero. */
  signed?: boolean
  /** The latest level per platform (e.g. followers now), shown in the readout's last line. */
  levels?: Partial<Record<PlatformId, number>>
}) {
  const [hover, setHover] = useState<number | null>(null)
  // Drawn at the panel's real width, so axis text stays 11px in a half-width panel and on a phone.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(900)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const has = ids.filter(p => points.some(d => d.v[p] != null))
  const val = (d: PlatformPoint, p: PlatformId) => d.v[p] ?? null
  const totals = points.map(d => has.reduce((t, p) => t + (val(d, p) ?? 0), 0))
  const all = points.flatMap(d => has.map(p => val(d, p)).filter((v): v is number => v !== null))
  if (!has.length || points.length < 2 || (kind === 'stack' ? !totals.some(Boolean) : !all.length))
    return <p className="v3-empty">Not enough history yet.</p>

  // Stacks start at zero; lines fit the range with a little room either side (and keep zero in view when signed).
  const rawMax = kind === 'stack' ? Math.max(1, ...totals) : Math.max(signed ? 0 : -Infinity, ...all)
  const rawMin = kind === 'stack' ? 0 : Math.min(signed ? 0 : Infinity, ...all)
  const span = Math.max(1, rawMax - rawMin)
  const mag = 10 ** Math.floor(Math.log10(kind === 'stack' ? rawMax : span))
  const pad = kind === 'lines' ? span * 0.1 : 0
  const top = Math.ceil((rawMax + pad) / mag) * mag
  const bottom = kind === 'stack' ? 0 : signed ? Math.floor((rawMin - (rawMin < 0 ? pad : 0)) / mag) * mag : Math.max(0, Math.floor((rawMin - pad) / mag) * mag)
  const band = (W - PAD.l - PAD.r) / points.length
  const x = (i: number) => PAD.l + band * (i + 0.5)
  const y = (v: number) => H - PAD.b - ((v - bottom) / (top - bottom || 1)) * (H - PAD.t - PAD.b)
  const every = Math.max(1, Math.ceil(points.length / Math.max(3, Math.floor(W / 90))))
  const bw = Math.max(2, band * 0.62)
  const h = hover !== null ? points[hover] : null
  const label = (d: PlatformPoint) => (dates ? shortDate(d.label) : d.label)
  const ticks = [...new Set([bottom, ...(signed && bottom < 0 && top > 0 ? [0] : [(bottom + top) / 2]), top])]
  const fmt = (v: number) => (signed && v > 0 ? `+${num(v)}` : num(v))
  const axis = (v: number) => (signed && v > 0 ? `+${compact(v)}` : compact(v))

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <svg
        className="v3-chart v3-plat-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${unit} by platform: ${has.map(p => PLATFORM_NAME[p]).join(', ')}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={e => {
          const r = e.currentTarget.getBoundingClientRect()
          const i = Math.floor((((e.clientX - r.left) / r.width) * W - PAD.l) / band)
          setHover(i >= 0 && i < points.length ? i : null)
        }}
      >
        <g className="v3-gridlines">
          {ticks.map(v => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} data-zero={signed && v === 0 ? '' : undefined} />
          ))}
        </g>
        <g className="axis">
          {ticks.map(v => (
            <text key={v} x={PAD.l - 8} y={y(v) + 4} textAnchor="end">
              {axis(v)}
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
                  {has.map(p => {
                    const v = val(d, p) ?? 0
                    const r = v ? <rect key={p} data-p={p} x={x(i) - bw / 2} width={bw} y={y(base + v)} height={Math.max(0, y(base) - y(base + v))} /> : null
                    base += v
                    return r
                  })}
                </g>
              )
            })
          : has.map(p => {
              // Join the days that have a reading; a lone reading shows as a dot.
              const pts = points.map((d, i) => (val(d, p) !== null ? [x(i), y(val(d, p)!)] : null)).filter(Boolean) as number[][]
              return (
                <g key={p} data-p={p} className="line">
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
              <i className="v3-soc-dot" data-p={p} aria-hidden="true" />
              {PLATFORM_NAME[p]} <b>{val(h, p) === null ? '—' : fmt(val(h, p)!)}</b>
              {levels?.[p] !== undefined && hover === points.length - 1 ? <span style={{ color: 'var(--ink-3)' }}> · {num(levels[p]!)} now</span> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
