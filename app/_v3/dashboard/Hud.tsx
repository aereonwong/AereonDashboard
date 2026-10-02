'use client'

import { useCallback, useRef, useState } from 'react'
import type { PacePoint, MonthFrame } from '@/lib/v3/studio'
import { rmFull, compact, pct } from '../fmt'

// The Flight HUD's instrument cluster. Signature interaction: the tape scrub —
// drag or step along the month timeline and the altitude tape, the ground-speed
// readout and the pointer all follow, like live telemetry.
//
//   altitude     = running income for the year at the selected month
//   ground speed = that running total against the same point last year
//   battery      = how much recent income is confirmed paid

export default function Hud({
  year,
  pace,
  frames,
  projection,
  lastFull,
  owedTotal,
  owedCount,
  recentTotal,
  reachPerPost,
  followers,
  reachWindow,
}: {
  year: number
  pace: PacePoint[]
  frames: MonthFrame[]
  projection: number
  lastFull: number
  owedTotal: number
  owedCount: number
  recentTotal: number
  reachPerPost: number
  followers: number
  reachWindow: string
}) {
  const current = Math.max(0, pace.findLastIndex(p => p.now !== null))
  const [m, setM] = useState(current)
  const stripRef = useRef<HTMLDivElement>(null)

  const top = (() => {
    const max = Math.max(1, projection, lastFull, ...pace.map(p => Math.max(p.now ?? 0, p.before)))
    const mag = 10 ** Math.floor(Math.log10(max))
    return Math.ceil(max / mag) * mag
  })()
  const alt = pace[m].now ?? 0
  const before = pace[m].beforeAt
  const speed = before ? ((alt - before) / before) * 100 : null
  const pos = (v: number) => `${(1 - v / top) * 100}%`
  const ticks = Array.from({ length: 11 }, (_, i) => (top / 10) * i)

  // Battery: of the last 120 days' income, the share already confirmed paid.
  const charge = recentTotal ? Math.max(0, Math.min(1, 1 - owedTotal / recentTotal)) : 1
  const bars = Math.round(charge * 10)
  const level = charge < 0.3 ? 'alert' : charge < 0.6 ? 'warn' : 'ok'

  const scrubTo = useCallback(
    (clientX: number) => {
      const box = stripRef.current?.getBoundingClientRect()
      if (!box) return
      const i = Math.floor(((clientX - box.left) / box.width) * 12)
      setM(Math.max(0, Math.min(current, i)))
    },
    [current],
  )

  return (
    <div className="v3-hero">
      <div className="v3-hud">
        <div className="v3-tape" aria-hidden="true">
          <div className="v3-tape-scale">
            {ticks.map((t, i) => (
              <span key={i} className={`v3-tape-tick${i % 2 === 0 ? ' major' : ''}${i === 0 || i === 10 ? ' edge' : ''}`} style={{ top: pos(t) }}>
                {i % 2 === 0 ? compact(t) : ''}
              </span>
            ))}
            <span className="v3-tape-pointer" style={{ top: pos(alt) }}>
              <span>{compact(alt)}</span>
            </span>
          </div>
          <span className="v3-tape-label">ALT · RM</span>
        </div>

        <div className="v3-hud-centre">
          <span className="v3-reticle" aria-hidden="true" />
          <div className="v3-gs" aria-live="polite">
            <div className="v3-gs-label">Ground speed · vs {year - 1}</div>
            <div className={`v3-gs-value${speed !== null && speed < 0 ? ' down' : ''}`}>{pct(speed)}</div>
          </div>
          <div className="v3-readout" aria-live="polite">
            <div className="v3-readout-label">
              Income · {pace[m].month} {year}
            </div>
            <div className="v3-readout-value num">
              <span className="cur">RM</span>
              {Math.round(alt).toLocaleString('en-MY')}
            </div>
            <div className="v3-readout-sub">
              {rmFull(before)} at this point in {year - 1}
            </div>
          </div>
          <div className="v3-live">
            <i aria-hidden="true" /> LIVE · RECORDS AS OF TODAY
          </div>
        </div>

        <div className="v3-gauges">
          <a className="v3-gauge" href="#owed">
            <span className="v3-gauge-label">
              <span>Battery</span>
              <span>{Math.round(charge * 100)}% confirmed</span>
            </span>
            <div className="v3-gauge-value num">{rmFull(owedTotal)}</div>
            <div className="v3-battery" data-level={level} aria-hidden="true">
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < bars ? 'on' : ''} />
              ))}
            </div>
            <div className="v3-gauge-note">
              unconfirmed across {owedCount} invoice{owedCount === 1 ? '' : 's'} · mark them paid to charge
            </div>
          </a>
          <a className="v3-gauge" href="#on-track">
            <span className="v3-gauge-label">
              <span>ETA · year end</span>
            </span>
            <div className="v3-gauge-value num">{rmFull(projection)}</div>
            <div className="v3-gauge-note">
              At this pace. {year - 1} closed at {rmFull(lastFull)}.
            </div>
          </a>
          <a className="v3-gauge" href="#audience">
            <span className="v3-gauge-label">
              <span>Signal · reach</span>
            </span>
            <div className="v3-gauge-value num">{compact(reachPerPost)}</div>
            <div className="v3-gauge-note">per post, {reachWindow} · {compact(followers)} followers</div>
          </a>
        </div>
      </div>

      <div
        ref={stripRef}
        className="v3-strip"
        style={{ marginTop: 'var(--space-6)', touchAction: 'none' }}
        onPointerDown={e => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          scrubTo(e.clientX)
        }}
        onPointerMove={e => e.buttons === 1 && scrubTo(e.clientX)}
        role="slider"
        tabIndex={0}
        aria-label="Month"
        aria-valuemin={1}
        aria-valuemax={current + 1}
        aria-valuenow={m + 1}
        aria-valuetext={`${pace[m].month} ${year}`}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') setM(v => Math.max(0, v - 1))
          if (e.key === 'ArrowRight') setM(v => Math.min(current, v + 1))
        }}
      >
        {frames.map((f, i) => (
          <div
            key={f.key}
            className="v3-cell"
            data-future={f.future}
            data-selected={i === m}
            style={{ ['--d' as string]: f.density.toFixed(3) }}
          >
            <span className="v3-cell-v num">{f.total ? compact(f.total) : ''}</span>
            <span className="v3-cell-m">{f.label.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
