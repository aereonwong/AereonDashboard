'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

// The Social page's post filters: how far back, and which platform. URL-driven, like FbFilters.
const WINDOWS = [
  { id: '30', label: '30 days' },
  { id: '90', label: '90 days' },
  { id: '365', label: '12 months' },
]
const PLATFORMS = [
  { id: '', label: 'All' },
  { id: 'ig', label: 'Instagram' },
  { id: 'fb', label: 'Facebook' },
  { id: 'tt', label: 'TikTok' },
]

export default function SocialFilters({ days, platform, tiktok = false }: { days: string; platform: string; tiktok?: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [pending, start] = useTransition()
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params?.toString())
    if (!v || (k === 'days' && v === '30')) p.delete(k)
    else p.set(k, v)
    const q = p.toString()
    start(() => router.replace(q ? `${path}?${q}` : path, { scroll: false }))
  }
  return (
    <div className="v3-filters" data-pending={pending} role="group" aria-label="Filters">
      <div className="v3-seg" role="group" aria-label="Time window">
        {WINDOWS.map(w => (
          <button key={w.id} type="button" aria-pressed={days === w.id} onClick={() => set('days', w.id)}>
            {w.label}
          </button>
        ))}
      </div>
      <span className="v3-divider" aria-hidden="true" />
      <div className="v3-seg" role="group" aria-label="Platform">
        {PLATFORMS.filter(t => t.id !== 'tt' || tiktok).map(t => (
          <button key={t.id || 'both'} type="button" aria-pressed={platform === t.id} onClick={() => set('p', t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  )
}
