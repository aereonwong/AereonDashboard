'use client'
import { useEffect } from 'react'
import { landingTapId } from '@/lib/landing-taps'

// 👉 What visitors do on the landing page (/), on top of the page view Tracker.tsx already sends:
// which version they saw, how far they scroll (25/50/75/100%), how long they stay with the page
// visible (10s, 30s, 1m, 3m, 10m), their browser's first language, and every link or button they
// tap (named by lib/landing-taps.ts). Each is one anonymous beacon to /api/track as /land/… —
// same rules as page views: no IP, no cookie, the signed-in owner and bots are never counted.
// Read on the Site analytics tab.

export type LandingVersion = 'classic' | 'kit-v1' | 'kit-v2' | 'reel'

const send = (path: string) => {
  try {
    const body = JSON.stringify({ path, referrer: document.referrer })
    if (!navigator.sendBeacon?.('/api/track', new Blob([body], { type: 'application/json' }))) {
      fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
    }
  } catch { /* tracking must never break the page */ }
}

const MARKS: [number, string][] = [[10, '10s'], [30, '30s'], [60, '1m'], [180, '3m'], [600, '10m']]

/** Scroll depth and visible time, sent as <base>/scroll/<pct> and <base>/time/<mark>. These are what
 *  tell a person from a bot on Site analytics (lib/hello-insights.ts splitBots). */
function useEngagement(base: '/land' | '/hello') {
  useEffect(() => {
    // Deepest point reached, sent once per mark.
    const scrolled = new Set<number>()
    const onScroll = () => {
      const doc = document.documentElement
      const room = doc.scrollHeight - window.innerHeight
      if (room <= 0) return   // nothing to scroll: a fit-on-screen page proves nothing
      const pct = ((window.scrollY + 1) / room) * 100
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m - 1 && !scrolled.has(m)) { scrolled.add(m); send(`${base}/scroll/${m}`) }
      }
    }

    // Seconds with the tab actually visible — a page left open in the background does not count.
    let seen = 0, next = 0
    const tick = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || next >= MARKS.length) return
      seen++
      if (seen >= MARKS[next][0]) send(`${base}/time/${MARKS[next++][1]}`)
    }, 1000)

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearInterval(tick)
    }
  }, [base])
}

/** Scroll and time only — for /hello, whose taps app/hello/TapTracker.tsx already counts. */
export function EngagementTracker({ base }: { base: '/land' | '/hello' }) {
  useEngagement(base)
  return null
}

export default function LandingTracker({ version }: { version: LandingVersion }) {
  useEngagement('/land')
  useEffect(() => {
    send(`/land/view/${version}`)
    const lang = (navigator.language || '').slice(0, 2).toLowerCase()
    if (/^[a-z]{2}$/.test(lang)) send(`/land/lang/${lang}`)

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.('[data-t], a[href]')
      if (!el) return
      const id = landingTapId(el.getAttribute('href'), el.getAttribute('data-t'), window.location.origin)
      if (id) send(`/land/out/${id}`)
    }

    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [version])
  return null
}
