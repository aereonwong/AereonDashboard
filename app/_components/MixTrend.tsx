'use client'
import { useState } from 'react'
import Delta from './Delta'

// 👉 The chart the Dashboard is built around: what kind of work the money came
// from, year by year, and how that has shifted. Two lenses over the same
// invoices — what you DID (service) and who PAID (sector) — because a creator
// working across niches needs both readings.
//
// Server components cannot hand functions across the boundary, so everything
// arrives as plain data and all formatting happens in here.

export type Part = { name: string; value: number }
export type Bucket = { period: string; label: string; total: number; parts: Part[] }
export type Line = {
  name: string
  total: number
  count: number
  average: number
  shareNow: number
  sharePrior: number
  rmNow: number
}
export type LensData = { id: string; label: string; buckets: Bucket[]; lines: Line[] }

const rm = (n: number) => `RM ${Math.round(n).toLocaleString('en-MY')}`
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n)))

export default function MixTrend({ lenses }: { lenses: LensData[] }) {
  const [lensId, setLensId] = useState(lenses[0].id)
  const [hover, setHover] = useState<{ period: string; name: string } | null>(null)
  const lens = lenses.find(l => l.id === lensId) ?? lenses[0]

  // A stable colour per category, assigned by overall size so the biggest slice
  // keeps the same colour when you switch lens.
  const order = lens.lines.map(l => l.name)
  const colourOf = (name: string) => `var(--cat-${(order.indexOf(name) % 8) + 1})`

  const tallest = Math.max(...lens.buckets.map(b => b.total), 1)
  const showing = hover
    ? lens.buckets.find(b => b.period === hover.period)?.parts.find(p => p.name === hover.name)
    : null
  const showingBucket = hover ? lens.buckets.find(b => b.period === hover.period) : null

  return (
    <div className="mix">
      <div className="mix-top">
        <p className="mix-read" aria-live="polite">
          {showing && showingBucket ? (
            <>
              <span className="mix-swatch" style={{ background: colourOf(showing.name) }} aria-hidden="true" />
              <strong>{showing.name}</strong> earned <strong>{rm(showing.value)}</strong> in {showingBucket.label} —{' '}
              {((showing.value / showingBucket.total) * 100).toFixed(0)}% of that year
            </>
          ) : (
            <>Each column is one year, split by {lens.id === 'service' ? 'the kind of work' : 'the client’s industry'}. Hover a block.</>
          )}
        </p>
        <div className="mix-lens" role="group" aria-label="Choose how to split the work">
          {lenses.map(l => (
            <button
              key={l.id}
              type="button"
              className={l.id === lensId ? 'on' : ''}
              aria-pressed={l.id === lensId}
              onClick={() => {
                setLensId(l.id)
                setHover(null)
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mix-plot">
        {lens.buckets.map((b, bi) => (
          <div className="mix-col" key={b.period}>
            <div className="mix-track">
              <div
                className="mix-stack"
                style={{ height: `${(b.total / tallest) * 100}%`, animationDelay: `${bi * 70}ms` }}
              >
              {b.parts.map(p => {
                const pct = (p.value / b.total) * 100
                const on = hover?.period === b.period && hover?.name === p.name
                const dim = hover !== null && !on
                return (
                  <button
                    type="button"
                    key={p.name}
                    className={`mix-seg${on ? ' on' : ''}${dim ? ' dim' : ''}`}
                    style={{ height: `${pct}%`, background: colourOf(p.name) }}
                    onMouseEnter={() => setHover({ period: b.period, name: p.name })}
                    onFocus={() => setHover({ period: b.period, name: p.name })}
                    onMouseLeave={() => setHover(null)}
                    onBlur={() => setHover(null)}
                    aria-label={`${p.name}, ${b.label}: ${rm(p.value)}, ${pct.toFixed(0)} percent`}
                  />
                )
              })}
              </div>
            </div>
            <p className="mix-total" data-money>{compact(b.total)}</p>
            <p className="mix-period">{b.label}</p>
          </div>
        ))}
      </div>

      <table className="mix-key">
        <caption className="vh">Each category, its share of the last 12 months and the 12 before</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Last 12 months</th>
            <th scope="col">Share</th>
            <th scope="col">Year before</th>
            <th scope="col">Per job</th>
          </tr>
        </thead>
        <tbody>
          {lens.lines.map(l => {
            const move = l.shareNow - l.sharePrior
            return (
              <tr
                key={l.name}
                onMouseEnter={() => setHover(null)}
                className={l.rmNow === 0 ? 'quiet' : undefined}
              >
                <th scope="row">
                  <span className="mix-swatch" style={{ background: colourOf(l.name) }} aria-hidden="true" />
                  {l.name}
                </th>
                <td data-label="Last 12 months" className="num">{l.rmNow ? rm(l.rmNow) : '—'}</td>
                <td data-label="Share" className="num">
                  {l.shareNow.toFixed(0)}%
                  {Math.abs(move) >= 1 ? <Delta value={move} tone="plain" suffix="pt" /> : null}
                </td>
                <td data-label="Year before" className="num">{l.sharePrior.toFixed(0)}%</td>
                <td data-label="Per job" className="num">{rm(l.average)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
