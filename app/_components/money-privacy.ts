'use client'

import { REVEAL_COOKIE } from '@/lib/privacy-header'

// Privacy mode in the browser. The SERVER decides what a page holds (lib/privacy.ts):
// while hidden it sends zeros, so this side only flips the reveal cookie and reloads.
// The cookie holds an expiry time; any mouse movement, click, key, scroll or touch pushes it 30 minutes
// ahead, and once it lapses the next check (every 15 s, on tab return, on back/forward)
// reloads the page hidden — the banking "hides after 30 idle minutes" rule.

export const IDLE_MS = 30 * 60_000
const COOKIE_RE = new RegExp(`(?:^|;\\s*)${REVEAL_COOKIE}=(\\d+)`)

const until = () => Number(document.cookie.match(COOKIE_RE)?.[1] ?? 0)

function write(ms: number | null) {
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = ms
    ? `${REVEAL_COOKIE}=${ms}; Path=/; Max-Age=${IDLE_MS / 1000}; SameSite=Strict${secure}`
    : `${REVEAL_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict${secure}`
}

/** Show or hide every amount: the server redraws the page with or without them. */
export function setShown(next: boolean) {
  write(next ? Date.now() + IDLE_MS : null)
  document.documentElement.setAttribute('data-privacy', 'switching')
  location.reload()
}

/** Activity while shown: push the auto-hide back (at most every 30 s). */
let lastTouch = 0
export function touch() {
  const now = Date.now()
  if (now - lastTouch < 1000) return // mouse movement fires constantly; check once a second
  lastTouch = now
  const left = until() - Date.now()
  if (left > 0 && left < IDLE_MS - 30_000) write(Date.now() + IDLE_MS)
}

/** A page drawn with amounts whose time has run out (idle, laptop asleep) reloads hidden. */
export function hideIfExpired() {
  if (until() <= Date.now()) setShown(false)
}
