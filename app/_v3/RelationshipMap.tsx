'use client'

import { useState } from 'react'
import type { Relationship } from '@/lib/v3/ledger'
import { QUIET_MONTHS } from '@/lib/v3/catalog'
import { rmFull, compact } from './fmt'

// Every client placed by what they are worth (up) and how long since the last
// job (right). The top-right corner — valuable and gone quiet — is who to
// re-pitch. Value runs on a log scale: a RM 50K client and a RM 500 one both
// need to be visible on the same map. Dot size is the number of jobs.

const W = 900
const H = 380
const PAD = { l: 58, r: 20, t: 20, b: 40 }

const QUAD: Record<Relationship['quadrant'], string> = {
  repitch: 'Re-pitch',
  nurture: 'Nurture',
  new: 'Newer, smaller',
  drifted: 'Drifted',
}

export default function RelationshipMap({ list, median }: { list: Relationship[]; median: number }) {
  const [hover, setHover] = useState<Relationship | null>(null)
  if (!list.length) return <p className="v3-empty">No clients in this range.</p>

  const maxQ = Math.max(QUIET_MONTHS * 2, ...list.map(c => c.monthsQuiet))
  const vals = list.map(c => Math.max(100, c.lifetime))
  const lo = Math.log10(Math.min(...vals))
  const hi = Math.log10(Math.max(...vals)) + 0.05
  // Rounded to a tenth of a pixel: server and browser floats can differ in the
  // last digits, which made React warn that the drawing didn't match (hydration).
  const r1 = (n: number) => Math.round(n * 10) / 10
  const x = (m: number) => r1(PAD.l + (m / maxQ) * (W - PAD.l - PAD.r))
  const y = (v: number) => r1(H - PAD.b - ((Math.log10(Math.max(100, v)) - lo) / Math.max(0.1, hi - lo)) * (H - PAD.t - PAD.b))
  const r = (jobs: number) => r1(4 + Math.sqrt(jobs) * 3)
  const ticks = [500, 1000, 5000, 10000, 50000, 100000].filter(v => Math.log10(v) >= lo - 0.1 && Math.log10(v) <= hi + 0.1)

  return (
    <div style={{ position: 'relative' }}>
      <svg className="v3-chart v3-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Clients by lifetime value and months since last job" onPointerLeave={() => setHover(null)}>
        <rect className="quad-hot" x={x(QUIET_MONTHS)} y={PAD.t} width={W - PAD.r - x(QUIET_MONTHS)} height={y(median) - PAD.t} />
        <g className="v3-gridlines">
          {ticks.map(t => (
            <line key={t} x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
          ))}
        </g>
        <line className="divider" x1={x(QUIET_MONTHS)} x2={x(QUIET_MONTHS)} y1={PAD.t} y2={H - PAD.b} />
        <line className="divider" x1={PAD.l} x2={W - PAD.r} y1={y(median)} y2={y(median)} />
        <g className="axis">
          {ticks.map(t => (
            <text key={t} x={PAD.l - 8} y={y(t) + 4} textAnchor="end">
              {compact(t)}
            </text>
          ))}
          {[...new Set([0, QUIET_MONTHS, Math.round(maxQ / 2), maxQ])].map(m => (
            <text key={m} x={x(m)} y={H - 16} textAnchor="middle">
              {m === 0 ? 'this month' : `${m}m`}
            </text>
          ))}
          <text x={W - PAD.r} y={H - 2} textAnchor="end">
            months since the last job →
          </text>
        </g>
        <g className="quad-labels">
          <text x={W - PAD.r - 6} y={PAD.t + 16} textAnchor="end">
            {QUAD.repitch}
          </text>
          <text x={PAD.l + 8} y={PAD.t + 16}>
            {QUAD.nurture}
          </text>
          <text x={PAD.l + 8} y={H - PAD.b - 8}>
            {QUAD.new}
          </text>
          <text x={W - PAD.r - 6} y={H - PAD.b - 8} textAnchor="end">
            {QUAD.drifted}
          </text>
        </g>
        {list.map(c => (
          <a key={c.client} href={`/invoices?range=all&client=${encodeURIComponent(c.client)}`} aria-label={`${c.client}: ${rmFull(c.lifetime)}`}>
            <circle
              className={`pt ${c.quadrant}`}
              data-on={hover?.client === c.client}
              cx={x(c.monthsQuiet)}
              cy={y(c.lifetime)}
              r={r(c.jobs)}
              onPointerEnter={() => setHover(c)}
            />
          </a>
        ))}
      </svg>
      {hover ? (
        <div className="v3-tip" style={{ left: `${(x(hover.monthsQuiet) / W) * 100}%`, top: `${(y(hover.lifetime) / H) * 100}%` }}>
          <div style={{ fontWeight: 600 }}>{hover.client}</div>
          <b>{rmFull(hover.lifetime)}</b> over {hover.jobs} job{hover.jobs === 1 ? '' : 's'}
          <div style={{ color: 'var(--ink-3)', fontSize: 12 }}>
            {hover.monthsQuiet === 0 ? 'Worked together this month' : `Last job ${hover.monthsQuiet} month${hover.monthsQuiet === 1 ? '' : 's'} ago`} · {QUAD[hover.quadrant]}
          </div>
        </div>
      ) : null}
    </div>
  )
}
