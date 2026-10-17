'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import './filterbar.css'

// TikTok's filter bar (docs/FILTER-BAR.md): timeline first, then video length, then the count
// and Reset. URL-driven — the server redraws the page from the query string.
const WINDOWS = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '12 months' },
  { id: 'all', label: 'All time' },
]
const LENGTHS = [
  { id: '', label: 'Any length' },
  { id: 'short', label: 'Under 30s' },
  { id: 'mid', label: '30–60s' },
  { id: 'long', label: 'Over 60s' },
]
// The page's default slice: the last 90 days (also in app/_v3/pages/Tiktok.tsx).
const TT_DEFAULT_DAYS = '90'

export default function TtFilters({ days, len, count }: { days: string; len: string; count: number }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const go = (p: URLSearchParams) => {
    const q = p.toString()
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }))
  }
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params?.toString())
    if (!v || (k === 'days' && v === TT_DEFAULT_DAYS)) p.delete(k)
    else p.set(k, v)
    go(p)
  }
  const changed = days !== TT_DEFAULT_DAYS || !!len
  return (
    <div className="v3-fbar" role="toolbar" aria-label="Filter every panel" data-pending={pending}>
      <div className="v3-fbar-group">
        <span className="v3-fbar-label">Timeline</span>
        <div className="v3-seg">
          {WINDOWS.map(w => (
            <button key={w.id} type="button" aria-pressed={days === w.id} onClick={() => set('days', w.id)}>
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <div className="v3-fbar-group">
        <span className="v3-fbar-label">Length</span>
        <div className="v3-seg">
          {LENGTHS.map(l => (
            <button key={l.id || 'any'} type="button" aria-pressed={len === l.id} onClick={() => set('len', l.id)}>
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="v3-fbar-count" aria-live="polite">
        <b className="num">{count}</b> video{count === 1 ? '' : 's'}
        {changed ? (
          <button type="button" className="v3-fbar-reset" onClick={() => go(new URLSearchParams())}>
            Reset
          </button>
        ) : null}
      </div>
    </div>
  )
}
