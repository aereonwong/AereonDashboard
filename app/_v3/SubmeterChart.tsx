'use client'

import { useState } from 'react'

// One bar per TNB bill: each unit's kWh stacked (worked out from its readings), with TNB's own kWh as a
// line across the bar — a bar that pokes out above the line means the sub-meters read more than TNB.
// The dashed line is 600 kWh, past which TNB adds its retail charge and service tax. Move across the
// chart (or use the arrow keys) for the bill's figures.

export type ChartCycle = {
  date: string
  tnbKwh: number | null
  amount: number
  perKwh: number | null
  perKwhEstimated: boolean
  gap: number | null
  units: { unit: string; tenant: string | null; kwh: number | null }[]
}

const W = 960
const H = 300
const PAD = { l: 48, r: 8, t: 14, b: 26 }
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ’${iso.slice(2, 4)}`
const full = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const kwh = (n: number | null) => (n == null ? '—' : `${n.toLocaleString('en-MY', { maximumFractionDigits: 0 })} kWh`)
const sen = (n: number) => n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct = (f: number | null) => (f == null ? '—' : `${f > 0 ? '+' : f < 0 ? '−' : ''}${Math.abs(f * 100).toFixed(1)}%`)

export default function SubmeterChart({ cycles, high }: { cycles: ChartCycle[]; high: number }) {
  const [at, setAt] = useState<number | null>(null)
  if (cycles.length < 2) return <p className="v3-empty">Two TNB bills with readings around them are needed to see the trend.</p>

  const n = cycles.length
  const band = (W - PAD.l - PAD.r) / n
  const cx = (i: number) => PAD.l + band * i + band / 2
  const bw = Math.min(56, band * 0.62)
  const top = Math.max(high * 1.1, ...cycles.map(c => Math.max(c.tnbKwh ?? 0, c.units.reduce((t, u) => t + (u.kwh ?? 0), 0)))) * 1.04
  const y = (v: number) => H - PAD.b - (Math.max(0, v) / top) * (H - PAD.b - PAD.t)
  const ticks = [0, 200, 400, 600, 800, 1000, 1200].filter(v => v <= top)
  const unitNames = cycles[cycles.length - 1].units.map(u => u.unit)

  const c = at == null ? null : cycles[at]
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    setAt(Math.min(n - 1, Math.max(0, Math.floor((x - PAD.l) / band))))
  }
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setAt(a => Math.min(n - 1, Math.max(0, (a ?? (e.key === 'ArrowLeft' ? n : -1)) + (e.key === 'ArrowLeft' ? -1 : 1))))
    } else if (e.key === 'Escape') setAt(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        className="v3-chart v3-loan-chart v3-sub-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label="Each unit's electricity for every TNB bill, against TNB's own kWh. Use the left and right arrow keys to read each bill."
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={e => e.pointerType === 'mouse' && setAt(null)}
        onKeyDown={key}
        onBlur={() => setAt(null)}
      >
        {at != null ? <rect className="v3-loan-band" x={cx(at) - band / 2} y={PAD.t} width={band} height={H - PAD.b - PAD.t} /> : null}
        <g className="v3-gridlines">
          {ticks.map(v => (
            <line key={v} x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
          ))}
        </g>
        <line className="v3-sub-high" x1={PAD.l} x2={W - PAD.r} y1={y(high)} y2={y(high)} />
        <g className="axis">
          {ticks.map(v => (
            <text key={v} x={PAD.l - 8} y={y(v) + 4} textAnchor="end">
              {v}
            </text>
          ))}
          {cycles.map((c, i) => (
            <text key={c.date} x={cx(i)} y={H - 6} textAnchor="middle">
              {label(c.date)}
            </text>
          ))}
        </g>
        {cycles.map((c, i) => {
          let base = 0
          return (
            <g key={c.date}>
              {c.units.map((u, j) => {
                if (u.kwh == null) return null
                const y0 = y(base)
                base += u.kwh
                return <rect key={u.unit} className="v3-sub-bar" data-i={j} x={cx(i) - bw / 2} y={y(base)} width={bw} height={Math.max(0, y0 - y(base))} />
              })}
              {c.tnbKwh != null ? <line className="v3-sub-tnb" x1={cx(i) - bw / 2 - 6} x2={cx(i) + bw / 2 + 6} y1={y(c.tnbKwh)} y2={y(c.tnbKwh)} /> : null}
            </g>
          )
        })}
      </svg>
      {c ? (
        <div className="v3-tip v3-loan-tip" role="status" data-side={cx(at!) < W / 2 ? 'right' : 'left'}>
          <div className="v3-loan-tip-head">TNB bill of {full(c.date)}</div>
          <dl>
            {c.units.map(u => (
              <div key={u.unit}>
                <dt>
                  {u.unit}
                  {u.tenant ? ` · ${u.tenant}` : ''}
                </dt>
                <dd className="num">{kwh(u.kwh)}</dd>
              </div>
            ))}
            <div>
              <dt>TNB billed</dt>
              <dd className="num">{kwh(c.tnbKwh)}</dd>
            </div>
            <div>
              <dt>Meters vs TNB</dt>
              <dd className="num">{pct(c.gap)}</dd>
            </div>
            <div>
              <dt>Bill</dt>
              <dd className="num">RM {sen(c.amount)}</dd>
            </div>
            <div>
              <dt>TNB per kWh</dt>
              <dd className="num">
                {c.perKwh != null ? `RM ${c.perKwh.toFixed(3)}` : '—'}
                {c.perKwhEstimated ? ' est.' : ''}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
      <div className="v3-legend">
        {unitNames.map((u, j) => (
          <span key={u}>
            <b className="v3-loan-key v3-sub-key" data-i={j} />
            {u}
          </span>
        ))}
        <span>
          <i className="tnb" />
          TNB&rsquo;s kWh
        </span>
        <span>
          <i className="dash" />
          {high} kWh: TNB adds retail charge and tax above it
        </span>
      </div>
    </div>
  )
}
