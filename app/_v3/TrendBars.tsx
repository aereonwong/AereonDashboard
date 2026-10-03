'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { MonthPoint } from '@/lib/v3/summary'
import { rmFull, compact } from './fmt'

// Invoiced per month across the range, with the same month a year earlier drawn
// as a ghost bar behind it and the 3-month running average as a line — one
// shared scale for all three, so nothing is flattered. Clicking a month narrows
// the page to it, like every v3 chart.

const W = 960
const H = 260
const PAD = { l: 48, r: 8, t: 14, b: 30 }

export default function TrendBars({ months }: { months: MonthPoint[] }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [, start] = useTransition()
  const [hover, setHover] = useState<number | null>(null)

  if (!months.some(m => m.total || m.lastYear)) return <p className="v3-empty">No ringgit invoices in this range.</p>

  const max = Math.max(1, ...months.map(m => Math.max(m.total, m.lastYear)))
  const mag = 10 ** Math.floor(Math.log10(max))
  const top = Math.ceil(max / mag) * mag
  const band = (W - PAD.l - PAD.r) / months.length
  const bw = Math.max(3, band * 0.56)
  const y = (v: number) => H - PAD.b - (v / top) * (H - PAD.t - PAD.b)
  const cx = (i: number) => PAD.l + band * i + band / 2
  const every = Math.max(1, Math.ceil(months.length / 12))
  const avg = months.map((m, i) => (m.avg3 === null ? null : `${cx(i)},${y(m.avg3)}`)).filter(Boolean)
  const hasLastYear = months.some(m => m.lastYear > 0)

  const pick = (m: MonthPoint) => {
    const [yy, mm] = m.key.split('-').map(Number)
    const last = new Date(Date.UTC(yy, mm, 0)).getUTCDate()
    const p = new URLSearchParams(params?.toString())
    p.set('range', 'custom')
    p.set('from', `${m.key}-01`)
    p.set('to', `${m.key}-${String(last).padStart(2, '0')}`)
    start(() => router.replace(`${path}?${p.toString()}`, { scroll: false }))
  }

  const h = hover === null ? null : months[hover]
  const vs = h && h.lastYear ? (h.total - h.lastYear) / h.lastYear : null
  return (
    <div className="v3-trend">
      <div className="v3-trend-key" aria-hidden="true">
        <span><i className="now" /> Invoiced</span>
        {hasLastYear ? <span><i className="ly" /> Same month last year</span> : null}
        {avg.length > 1 ? <span><i className="avg" /> 3-month average</span> : null}
      </div>
      <div style={{ position: 'relative' }}>
        <svg className="v3-chart v3-trend-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ringgit invoiced per month against the year before" onPointerLeave={() => setHover(null)}>
          <g className="v3-gridlines">
            {[0, 0.25, 0.5, 0.75, 1].map(t => (
              <line key={t} x1={PAD.l} x2={W - PAD.r} y1={y(t * top)} y2={y(t * top)} />
            ))}
          </g>
          <g className="axis">
            {[0, 0.5, 1].map(t => (
              <text key={t} x={PAD.l - 8} y={y(t * top) + 4} textAnchor="end">
                {compact(t * top)}
              </text>
            ))}
            {months.map((m, i) =>
              i % every === 0 ? (
                <text key={m.key} x={cx(i)} y={H - 10} textAnchor="middle">
                  {m.label}
                </text>
              ) : null,
            )}
          </g>
          {months.map((m, i) => (
            <g key={m.key} data-on={hover === i ? 'true' : undefined}>
              {m.lastYear ? <rect className="ly" x={cx(i) - bw / 2 - bw * 0.18} y={y(m.lastYear)} width={bw} height={H - PAD.b - y(m.lastYear)} rx={2} /> : null}
              <rect className="now" x={cx(i) - bw / 2 + bw * 0.18} y={y(m.total)} width={bw} height={Math.max(m.total ? 2 : 0, H - PAD.b - y(m.total))} rx={2} />
            </g>
          ))}
          {avg.length > 1 ? <polyline className="avg" points={avg.join(' ')} /> : null}
          {months.map((m, i) => (
            <rect
              key={`hit-${m.key}`}
              className="hit"
              x={PAD.l + band * i}
              y={PAD.t}
              width={band}
              height={H - PAD.t - PAD.b}
              onPointerEnter={() => setHover(i)}
              onClick={() => m.count && pick(m)}
              style={{ cursor: m.count ? 'pointer' : 'default' }}
            >
              <title>{`${m.label}: ${rmFull(m.total)}`}</title>
            </rect>
          ))}
        </svg>
        {h ? (
          <div className="v3-tip" style={{ left: `${(cx(hover!) / W) * 100}%`, top: `${(y(Math.max(h.total, h.lastYear)) / H) * 100}%` }}>
            <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>{h.label}</div>
            <b>{rmFull(h.total)}</b> · {h.count} invoice{h.count === 1 ? '' : 's'}
            {h.lastYear ? (
              <div style={{ fontSize: 12 }}>
                {rmFull(h.lastYear)} a year before{vs !== null ? ` · ${vs >= 0 ? '+' : ''}${Math.round(vs * 100)}%` : ''}
              </div>
            ) : null}
            {h.count ? <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>Click to filter to this month</div> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
