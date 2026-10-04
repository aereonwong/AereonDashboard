import type { LoanMonth } from '@/lib/property-math'

// Two strips on one time axis. Top: the outstanding balance. Bottom: each month's interest as a
// solid bar inside a grey bar for the full-rate interest — the grey part is what the flexi
// account saved. Payment holidays and empty months leave a gap. Hover a bar for the figures.

const W = 960
const H = 320
const PAD = { l: 56, r: 8, t: 10, b: 24 }
const SPLIT = 170 // balance strip ends, interest strip starts
const sen = (n: number | null) => (n == null ? '—' : n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}K` : String(Math.round(n)))

export default function LoanChart({ months }: { months: LoanMonth[] }) {
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

  return (
    <div>
      <svg className="v3-chart v3-loan-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outstanding balance and monthly interest over time">
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
              <title>
                {`${m.month.slice(0, 7)} · interest RM ${sen(m.interest)} · full rate RM ${sen(m.fullRate)} · saved RM ${sen(m.saved)} · outstanding RM ${sen(m.outstanding_balance)}`}
              </title>
              <rect className="full" x={cx(i) - bw / 2} y={yi(m.fullRate ?? 0)} width={bw} height={H - PAD.b - yi(m.fullRate ?? 0)} />
              <rect className="paid" x={cx(i) - bw / 2} y={yi(m.interest ?? 0)} width={bw} height={H - PAD.b - yi(m.interest ?? 0)} />
            </g>
          ),
        )}
      </svg>
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
