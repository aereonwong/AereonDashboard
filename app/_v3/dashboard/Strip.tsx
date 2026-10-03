'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { MonthFrame } from '@/lib/v3/studio'
import { rmFull, compact } from '../fmt'

// The months of the year as frames, every one on the same scale. Selecting one
// prints its invoice numbers underneath and filters the whole page to that
// month (crossfilter).

export default function Strip({
  frames,
  bestKey,
}: {
  frames: MonthFrame[]
  bestKey: string | null
}) {
  const [sel, setSel] = useState<string | null>(bestKey)
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [, start] = useTransition()
  const chosen = frames.find(f => f.key === sel) ?? null

  const pick = (f: MonthFrame) => {
    if (f.future) return
    setSel(f.key)
    const [y, m] = f.key.split('-').map(Number)
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
    const p = new URLSearchParams(params?.toString())
    p.set('range', 'custom')
    p.set('from', `${f.key}-01`)
    p.set('to', `${f.key}-${String(last).padStart(2, '0')}`)
    start(() => router.replace(`${path}?${p.toString()}`, { scroll: false }))
  }

  return (
    <>
      <div className="v3-strip" role="list">
        {frames.map(f => (
          <button
            key={f.key}
            type="button"
            role="listitem"
            className="v3-cell"
            style={{ ['--d' as string]: f.density.toFixed(3) }}
            data-future={f.future}
            data-lit={f.density > 0.42}
            data-keeper={f.key === bestKey}
            data-selected={f.key === sel}
            onClick={() => pick(f)}
            aria-label={f.future ? `${f.label}: still to come` : `${f.label}: ${rmFull(f.total)} from ${f.count} invoices`}
          >
            <span className="v3-cell-v num">{f.future ? '' : f.total ? compact(f.total) : '0'}</span>
            <span className="v3-cell-m">{f.label}</span>
          </button>
        ))}
      </div>
      <p className="v3-strip-detail" aria-live="polite">
        {chosen ? (
          chosen.count ? (
            <>
              <b>{chosen.label}</b> · {rmFull(chosen.total)} across {chosen.count} invoice{chosen.count === 1 ? '' : 's'}
              <br />
              <span className="code">
                {chosen.numbers.slice(0, 5).join('  ▸  ')}
                {chosen.numbers.length > 5 ? `  ▸  +${chosen.numbers.length - 5} more` : ''}
              </span>
            </>
          ) : (
            <>
              <b>{chosen.label}</b> · no invoice was raised this month.
            </>
          )
        ) : (
          'Select a month to see the invoices behind it.'
        )}
      </p>
    </>
  )
}
