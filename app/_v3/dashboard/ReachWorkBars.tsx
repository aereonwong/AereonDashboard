'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { ReachMonth } from '@/lib/v3/insights'
import { compact, rmFull } from '../fmt'

// 👉 The month bars of "Reach and invoicing". Opens on the last 12 months so the current
// picture is what you see first; longer ranges keep oldest → newest but open scrolled to
// the newest month (phones too), so nobody has to scroll to the end to find this month.

const RANGES = [
  { id: '12', label: '12 months', n: 12 },
  { id: '24', label: '2 years', n: 24 },
  { id: 'all', label: 'All', n: Infinity },
] as const

export function ReachWorkBars({ months }: { months: ReachMonth[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('12')
  const n = RANGES.find(r => r.id === range)!.n
  const shown = months.slice(-Math.min(n, months.length))
  const box = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (box.current) box.current.scrollLeft = box.current.scrollWidth
  }, [range])
  const reachPeak = Math.max(1, ...shown.map(m => m.reach))
  const rmPeak = Math.max(1, ...shown.map(m => m.invoiced))
  const reach = shown.reduce((s, m) => s + m.reach, 0)
  const invoiced = shown.reduce((s, m) => s + m.invoiced, 0)
  const fits = shown.length <= 12
  return (
    <>
      <div className="v3-rvw-bar">
        <div className="v3-seg" role="group" aria-label="Months shown">
          {RANGES.filter(r => r.n === Infinity || r.n < months.length).map(r => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <span className="v3-rvw-sum">
          {shown[0].label} – {shown[shown.length - 1].label}: <b>{compact(reach)}</b> reach ·{' '}
          <b>{rmFull(invoiced)}</b> invoiced
        </span>
      </div>
      <div
        ref={box}
        className="v3-rvw"
        data-fit={fits ? '' : undefined}
        style={{ ['--n' as string]: shown.length }}
        role="table"
        aria-label="Reach and invoiced ringgit by month"
      >
        {shown.map((m, i) => (
          <div className="v3-rvw-col" role="row" key={m.key} data-now={i === shown.length - 1 ? '' : undefined}>
            <div className="v3-rvw-bars" aria-hidden="true">
              <i className="reach" style={{ ['--h' as string]: (m.reach / reachPeak).toFixed(3) }} />
              <i className="rm" style={{ ['--h' as string]: (m.invoiced / rmPeak).toFixed(3) }} />
            </div>
            <span role="rowheader" className="v3-rvw-label">
              {m.label}
            </span>
            <span role="cell" className="v3-rvw-num">
              {m.posts ? compact(m.reach) : '0 posts'}
            </span>
            <span role="cell" className="v3-rvw-num rm" data-money>
              {m.invoiced ? compact(m.invoiced) : '—'}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}
