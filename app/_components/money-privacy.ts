'use client'

// Privacy mode, the one switch behind every money figure: hidden (the default,
// for every role) or shown. MoneyMask reads it to mask the page; MoneyToggle
// and a click on any masked figure write it. Like a banking session, "shown"
// lasts for this browser tab only and falls back to hidden after IDLE_MS
// without a click, key, scroll or touch — page loads count as activity.

export const IDLE_MS = 5 * 60_000
const KEY = 'cfo-money-until' // sessionStorage: shown until this time (ms)

let shown: boolean | null = null
const subs = new Set<() => void>()

function stored() {
  try {
    return Number(sessionStorage.getItem(KEY)) > Date.now()
  } catch {
    return false
  }
}

export const isShown = () => (shown ??= stored())
export const serverShown = () => false

/** Timers freeze while a laptop sleeps or a tab is suspended — check the clock itself. */
export function hideIfExpired() {
  if (shown && !stored()) setShown(false)
}

/** Activity while shown: push the auto-hide back. */
export function touch() {
  if (!shown) return
  if (!stored()) return setShown(false) // the first click after a long sleep must not extend it
  try {
    sessionStorage.setItem(KEY, String(Date.now() + IDLE_MS))
  } catch {}
}

export function setShown(next: boolean) {
  if (next === isShown()) return
  shown = next
  try {
    if (next) sessionStorage.setItem(KEY, String(Date.now() + IDLE_MS))
    else sessionStorage.removeItem(KEY)
  } catch {}
  document.documentElement.setAttribute('data-privacy', next ? 'shown' : 'hidden')
  subs.forEach(f => f())
}

export function subscribe(f: () => void) {
  subs.add(f)
  return () => {
    subs.delete(f)
  }
}
