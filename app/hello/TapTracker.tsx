'use client'
import { useEffect } from 'react'

// Counts taps on /hello: any element with data-t="tap/<section>" or "out/<id>" sends one
// anonymous beacon to /api/track as /hello/<data-t> (same rules as page views: no IP, no
// cookie, the signed-in owner and bots are not counted). Read on the Link page tab.
export default function TapTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-t]')
      const t = el?.getAttribute('data-t')
      if (!t) return
      try {
        const body = JSON.stringify({ path: `/hello/${t}`, referrer: document.referrer })
        if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
          fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
        }
      } catch { /* tracking must never break a tap */ }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
