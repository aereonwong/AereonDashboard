'use client'

import { useState } from 'react'
import type { LoanMonth } from '@/lib/property-math'

// Two strips on one time axis. Top: the outstanding balance. Bottom: each month's interest as a
// solid bar inside a grey bar for the full-rate interest — the grey part is what the flexi
// account saved. Payment holidays and empty months leave a gap. Move across the chart (or use the arrow
// keys) and the month under the pointer is marked, with its figures in a card.

const W = 960
const H = 320
const PAD = { l: 56, r: 8, t: 10, b: 24 }
const SPLIT = 170 // balance strip ends, interest strip starts
const sen = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n)))

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const label = (iso: string) => `${MON[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`
const STATUS: Record<string, string> = { moratorium: 'Payment holiday', interest_only: 'Interest only', pending: 'Waiting for the statement', missing: 'No data' }

export default function LoanChart({ months }: { months: LoanMonth[] }) {
  const [at, setAt] = useState<number | null>(null)
  if (months.filter(m => m.outstanding_balance != null).length < 2) return <p className="v3-empty">Record two months to see the trend.</p>

  const n = months.length
  const band = (W - PAD.l - PAD.r) / n
  const cx = (i: number) => PAD.l + band * i + band / 2

  const bals = months.map(m => m.outstanding_balance).filter((v): v is number => v != null)
  const lo = Math.min(...bals)
  const hi = Math.max(...bals)
  const pad = (hi - lo) * 0.08 || 1000
  const yb = (v: number) => PAD.t + (SPLIT - 34 - PAD.t) * (1 - (v - (lo - pad)) / (hi - lo + 2 * pad))
  let d = ''
  months.forEach((m, i) => {
    if (m.outstanding_balance == null) return
    const prevGap = i === 0 || months[i - 1].outstanding_balance == null
    d += `${prevGap ? 'M' : 'L'}${cx(i).toFixed(1)},${yb(m.outstanding_balance).toFixed(1)}`
  })

  const top = Math.max(1, ...months.map(m => Math.max(m.fullRate ?? 0, m.interest ?? 0)))
  const ih = H - PAD.b - SPLIT
  const yi = (v: number) => H - PAD.b - (Math.max(0, v) / top) * ih
  const bw = Math.max(2, band * 0.7)
  const years = months.map((m, i) => ({ i, y: m.month.slice(0, 4) })).filter((p, i, a) => i === 0 || p.y !== a[i - 1].y)
  const every = Math.max(1, Math.ceil(years.length / 10))

  const m = at == null ? null : months[at]
  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width) * W
    setAt(Math.min(n - 1, Math.max(0, Math.floor((x - PAD.l) / band)))) // the margins count as the first and last month
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
        className="v3-chart v3-loan-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        tabIndex={0}
        aria-label="Outstanding balance and monthly interest over time. Use the left and right arrow keys to read each month."
        onPointerMove={move}
        onPointerDown={move}
        onPointerLeave={e => e.pointerType === 'mouse' && setAt(null)} // a finger lifting is not leaving: the tapped month stays until you tap elsewhere
        onKeyDown={key}
        onBlur={() => setAt(null)}
      >
        {at != null ? <rect className="v3-loan-band" x={cx(at) - band / 2} y={PAD.t} width={band} height={H - PAD.b - PAD.t} /> : null}
        <g className="v3-gridlines">
          <line x1={PAD.l} x2={W - PAD.r} y1={SPLIT} y2={SPLIT} />
          <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} />
        </g>
        <g className="axis">
          <text x={PAD.l - 8} y={yb(hi) + 5} textAnchor="end">{k(hi)}</text>
          <text x={PAD.l - 8} y={yb(lo) + 5} textAnchor="end">{k(lo)}</text>
          <text x={PAD.l - 8} y={yi(top) + 14} textAnchor="end">{k(top)}</text>
          <text x={PAD.l - 8} y={H - PAD.b} textAnchor="end">0</text>
          {years.filter((_, j) => j % every === 0).map(p => (
            <text key={p.y} x={PAD.l + band * p.i} y={H - 6}>{p.y}</text>
          ))}
        </g>
        <path className="now" d={d} />
        {months.map((m, i) =>
          m.fullRate == null && m.interest == null ? null : (
            <g key={m.month}>
              <rect className="full" x={cx(i) - bw / 2} y={yi(m.fullRate ?? 0)} width={bw} height={H - PAD.b - yi(m.fullRate ?? 0)} />
              <rect className="paid" x={cx(i) - bw / 2} y={yi(m.interest ?? 0)} width={bw} height={H - PAD.b - yi(m.interest ?? 0)} />
            </g>
          ),
        )}
        {at != null && m?.outstanding_balance != null ? <circle className="v3-loan-dot" cx={cx(at)} cy={yb(m.outstanding_balance)} r={6} /> : null}
      </svg>
      {m ? (
        <div className="v3-tip v3-loan-tip" role="status" data-side={cx(at!) < W / 2 ? 'right' : 'left'}>
          <div className="v3-loan-tip-head">
            {label(m.month)}
            {m.status !== 'normal' ? <span> · {STATUS[m.status] ?? m.status}</span> : null}
          </div>
          <dl>
            <div>
              <dt>Outstanding</dt>
              <dd className="num">{m.outstanding_balance != null ? `RM ${sen(m.outstanding_balance)}` : '—'}</dd>
            </div>
            <div>
              <dt>Instalment</dt>
              <dd className="num">{m.instalment != null ? `RM ${sen(m.instalment)}` : '—'}</dd>
            </div>
            <div>
              <dt>Interest charged</dt>
              <dd className="num">{m.interest != null ? `RM ${sen(m.interest)}` : '—'}</dd>
            </div>
            <div>
              <dt>Full-rate interest</dt>
              <dd className="num">{m.fullRate != null ? `RM ${sen(m.fullRate)}` : '—'}</dd>
            </div>
            <div>
              <dt>Saved by flexi</dt>
              <dd className="num">{m.saved != null ? `RM ${sen(m.saved)}` : '—'}</dd>
            </div>
            <div>
              <dt>Rate</dt>
              <dd className="num">{m.rate != null ? `${m.rate.toFixed(2)}%` : '—'}</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <div className="v3-legend">
        <span>
          <i />
          Outstanding
        </span>
        <span>
          <b className="v3-loan-key paid" />
          Interest charged
        </span>
        <span>
          <b className="v3-loan-key full" />
          Saved by the flexi account
        </span>
      </div>
    </div>
  )
}
