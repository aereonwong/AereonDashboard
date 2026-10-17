'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { PLATFORM_NAME, type PlatformId } from '@/lib/v3/platforms'
import './filterbar.css'

// The Social page's filter bar (docs/FILTER-BAR.md): timeline first, then platform, then the
// count and Reset. URL-driven — the server redraws the page. Platforms are the connected ones,
// passed in from the server, in their fixed order.
const WINDOWS = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '12 months' },
]
// The page's default slice (also in app/(app)/social/page.tsx).
const DEFAULT_DAYS = '30'

export default function SocialFilters({ days, platform, ids, count }: { days: string; platform: string; ids: PlatformId[]; count: number }) {
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
    if (!v || (k === 'days' && v === DEFAULT_DAYS)) p.delete(k)
    else p.set(k, v)
    go(p)
  }
  const changed = days !== DEFAULT_DAYS || !!platform
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
        <span className="v3-fbar-label">Platform</span>
        <div className="v3-seg">
          <button type="button" aria-pressed={!platform} onClick={() => set('p', '')}>
            All
          </button>
          {ids.map(p => (
            <button key={p} type="button" aria-pressed={platform === p} onClick={() => set('p', platform === p ? '' : p)}>
              <i className="v3-soc-dot" data-p={p} aria-hidden="true" />
              {PLATFORM_NAME[p]}
            </button>
          ))}
        </div>
      </div>
      <div className="v3-fbar-count" aria-live="polite">
        <b className="num">{count}</b> post{count === 1 ? '' : 's'}
        {changed ? (
          <button type="button" className="v3-fbar-reset" onClick={() => go(new URLSearchParams())}>
            Reset
          </button>
        ) : null}
      </div>
    </div>
  )
}
