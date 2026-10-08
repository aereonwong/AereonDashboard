'use client'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// 👉 Sends one anonymous page-view beacon per public page (see app/api/track). The server
// decides what counts; this only reports the path, where the visitor came from and any
// utm_* tags. No cookie, no storage, nothing identifying leaves the browser.
export default function Tracker() {
  const path = usePathname()
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const body = JSON.stringify({
        path,
        referrer: document.referrer,
        utm_source: q.get('utm_source'), utm_medium: q.get('utm_medium'), utm_campaign: q.get('utm_campaign'),
      })
      if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
        fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
      }
    } catch { /* tracking must never break a page */ }
  }, [path])
  return null
}
